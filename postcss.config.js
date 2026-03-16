import tailwindcss from '@tailwindcss/postcss';
import valueParser from 'postcss-value-parser';
import postcss from 'postcss';

// ─── Custom Plugin: @property initial-value → :root fallbacks ───
// Collects @property rules and injects their initial-value as regular
// CSS custom properties in :root (safety net for Chrome 103 which
// doesn't fully support @property).
function propertyInjectPlugin() {
  return {
    postcssPlugin: 'postcss-property-inject',
    Once(root) {
      const vars = {};

      root.walkAtRules('property', (rule) => {
        const propName = rule.params.trim();
        rule.walkDecls('initial-value', (decl) => {
          vars[propName] = decl.value;
        });
      });

      const entries = Object.entries(vars);
      if (entries.length === 0) return;

      const rootRule = postcss.rule({ selector: ':root' });
      for (const [name, value] of entries) {
        rootRule.append(postcss.decl({ prop: name, value }));
      }

      let lastProperty = null;
      root.walkAtRules('property', (rule) => { lastProperty = rule; });
      if (lastProperty) {
        lastProperty.after(rootRule);
      } else {
        root.prepend(rootRule);
      }
    },
  };
}
propertyInjectPlugin.postcss = true;

// ─── Custom Plugin: Resolve var() inside color-mix() ───
// Tailwind v4 generates: color-mix(in oklab, var(--color-white) 40%, transparent)
// The @csstools/postcss-color-mix-function plugin can't evaluate var() references.
// This plugin inlines the resolved variable values so downstream plugins can process them.
function colorMixVarResolverPlugin() {
  return {
    postcssPlugin: 'postcss-color-mix-var-resolver',
    Once(root) {
      // Step 1: Collect all CSS variable definitions from :root / :host / * / .dark
      const varMap = {};

      root.walkRules((rule) => {
        if (!rule.selector) return;
        const sel = rule.selector.trim();
        if (sel === ':root' || sel === ':host' || sel === '*' || sel.includes(':root') || sel === '.dark') {
          rule.walkDecls((decl) => {
            if (decl.prop.startsWith('--')) {
              varMap[decl.prop] = decl.value;
            }
          });
        }
      });

      // Also collect from @property initial-values
      root.walkAtRules('property', (rule) => {
        const propName = rule.params.trim();
        rule.walkDecls('initial-value', (decl) => {
          if (!varMap[propName]) {
            varMap[propName] = decl.value;
          }
        });
      });

      // Step 2: Resolve a var() reference using the collected map
      function resolveVar(name, fallback) {
        let val = varMap[name];
        if (val === undefined) {
          return fallback || 'black';
        }
        if (val.includes('var(')) {
          const parsed = valueParser(val);
          parsed.walk((node) => {
            if (node.type === 'function' && node.value === 'var') {
              const args = node.nodes.filter(n => n.type !== 'div' && n.type !== 'space');
              const innerName = args[0] ? args[0].value : '';
              const innerFallback = args[1] ? valueParser.stringify(args[1]) : '';
              const resolved = resolveVar(innerName, innerFallback);
              node.type = 'word';
              node.value = resolved;
              node.nodes = undefined;
            }
          });
          val = valueParser.stringify(parsed);
        }
        return val;
      }

      // Step 3: Walk all declarations and resolve var() inside color-mix()
      root.walkDecls((decl) => {
        if (!decl.value || !decl.value.includes('color-mix(')) return;
        if (!decl.value.includes('var(')) return;

        const parsed = valueParser(decl.value);
        let changed = false;

        parsed.walk((node) => {
          if (node.type === 'function' && node.value === 'color-mix') {
            valueParser.walk(node.nodes, (inner) => {
              if (inner.type === 'function' && inner.value === 'var') {
                const args = [];
                let currentArg = [];
                for (const child of inner.nodes) {
                  if (child.type === 'div' && child.value === ',') {
                    args.push(currentArg);
                    currentArg = [];
                  } else {
                    currentArg.push(child);
                  }
                }
                args.push(currentArg);

                const varName = args[0] ? args[0].map(n => n.value).join('').trim() : '';
                const fallback = args[1] ? args[1].map(n => valueParser.stringify(n)).join('').trim() : '';

                const resolved = resolveVar(varName, fallback);
                inner.type = 'word';
                inner.value = resolved;
                inner.nodes = undefined;
                changed = true;
              }
            });
          }
        });

        if (changed) {
          decl.value = valueParser.stringify(parsed);
        }
      });
    },
  };
}
colorMixVarResolverPlugin.postcss = true;

// ─── Custom Plugin: @supports unwrap + Chrome 103 fallbacks ───
// 1. Unwraps @supports blocks gating on oklch/oklab/color-mix (except custom props)
// 2. Adds "in oklab" gradient fallbacks (preserve original for modern browsers)
// 3. Converts translate:/rotate:/scale: → transform: fallback (with @keyframes guard)
// 4. Fixes empty var() fallbacks: var(--foo,) → var(--foo, )
function supportsUnwrapPlugin() {
  return {
    postcssPlugin: 'postcss-supports-unwrap',
    Once(root) {
      // 1. Unwrap @supports blocks for oklch/oklab/color-mix
      root.walkAtRules('supports', (rule) => {
        const params = rule.params || '';

        if (
          params.includes('oklch') ||
          params.includes('oklab') ||
          params.includes('color-mix') ||
          params.includes('lab,')
        ) {
          // Skip unwrapping if the block contains custom properties (--*).
          // Chrome 103 stores oklch(...) as raw string in custom props and
          // fails to resolve it. Keeping the @supports wrapper means Chrome 103
          // skips the block and uses the hex fallbacks defined outside.
          let hasCustomProps = false;
          rule.walkDecls((decl) => {
            if (decl.prop.startsWith('--')) {
              hasCustomProps = true;
            }
          });
          if (hasCustomProps) return;

          // Move all children to parent (before the @supports rule)
          rule.each((child) => {
            rule.before(child.clone());
          });
          rule.remove();
        }
      });

      // 2. Add fallback for "in oklab" gradient interpolation
      // Chrome 103 can't parse "in oklab" → drops the declaration → uses fallback
      // Modern browsers parse both → use last (with "in oklab") for smooth interpolation
      // NOTE: Gradient "in oklab" fallback (adding duplicate property before original)
      // is handled in the Vite generateBundle hook (vite.config.js) because Vite's
      // CSS minifier (Lightning CSS) strips duplicate custom properties if done here.

      // 3. Convert individual transform properties (translate:/rotate:/scale:)
      // to combined "transform:" fallback for Chrome 103.
      // Wrapped in @supports not (translate: 0) so modern browsers skip it.
      // GUARD: skip declarations inside @keyframes — @supports inside @keyframes is invalid CSS.
      const transformProps = new Set(['translate', 'rotate', 'scale']);
      const processedRules = new WeakSet();

      function isInsideKeyframes(node) {
        let parent = node.parent;
        while (parent) {
          if (parent.type === 'atrule' && parent.name === 'keyframes') return true;
          parent = parent.parent;
        }
        return false;
      }

      root.walkDecls((decl) => {
        if (!transformProps.has(decl.prop)) return;
        const parentRule = decl.parent;
        if (!parentRule || parentRule.type !== 'rule') return;
        if (processedRules.has(parentRule)) return;
        if (isInsideKeyframes(parentRule)) return; // Skip @keyframes
        processedRules.add(parentRule);

        // Collect all individual transform properties in this rule
        const transforms = {};
        parentRule.walkDecls((d) => {
          if (transformProps.has(d.prop)) {
            transforms[d.prop] = d.value.trim();
          }
        });

        // Build combined transform: value
        const parts = [];
        if (transforms.translate) {
          const p = transforms.translate.split(/\s+/);
          parts.push(`translate(${p[0] || '0'}, ${p[1] || '0'})`);
        }
        if (transforms.rotate) {
          parts.push(`rotate(${transforms.rotate})`);
        }
        if (transforms.scale) {
          const p = transforms.scale.split(/\s+/);
          parts.push(p.length === 1 ? `scale(${p[0]})` : `scale(${p[0]}, ${p[1]})`);
        }

        if (parts.length === 0) return;

        const fallbackRule = postcss.rule({ selector: parentRule.selector });
        fallbackRule.append(postcss.decl({ prop: 'transform', value: parts.join(' ') }));
        const supportsRule = postcss.atRule({
          name: 'supports',
          params: 'not (translate: 0)',
        });
        supportsRule.append(fallbackRule);
        parentRule.after(supportsRule);
      });

      // 4. Wrap custom properties with "in oklab/oklch/lab" values in @supports
      // Tailwind v4 generates: .bg-gradient-to-b { --tw-gradient-position: to bottom in oklab }
      // Chrome 103 stores "to bottom in oklab" as-is (custom props accept any value),
      // then linear-gradient(to bottom in oklab, ...) fails → no gradient.
      // Fix: replace with fallback value, move "in oklab" version into @supports.
      // Chrome 103 → uses "to bottom" → gradient works.
      // Modern browsers → @supports overrides → "to bottom in oklab" → smooth interpolation.
      root.walkDecls((decl) => {
        if (!decl.prop.startsWith('--')) return;
        if (!decl.value) return;
        if (!/\bin\s+(?:oklab|oklch|lab)\b/.test(decl.value)) return;

        const parentRule = decl.parent;
        if (!parentRule || parentRule.type !== 'rule') return;

        const fallbackValue = decl.value
          .replace(/\s+in\s+oklab/g, '')
          .replace(/\s+in\s+oklch/g, '')
          .replace(/\s+in\s+lab/g, '');

        // Find if we're inside a relevant @supports block
        let existingSupports = null;
        let ancestor = parentRule.parent;
        while (ancestor) {
          if (ancestor.type === 'atrule' && ancestor.name === 'supports' &&
              /in\s+(?:oklab|oklch|lab)/.test(ancestor.params)) {
            existingSupports = ancestor;
            break;
          }
          ancestor = ancestor.parent;
        }

        if (existingSupports) {
          // Already inside @supports — the "in oklab" version stays here.
          // Add a fallback rule (without "in oklab") BEFORE the @supports block.
          const fallbackRule = postcss.rule({ selector: parentRule.selector });
          fallbackRule.append(postcss.decl({ prop: decl.prop, value: fallbackValue }));
          existingSupports.before(fallbackRule);
        } else {
          // Not inside @supports — move "in oklab" into @supports, keep fallback.
          const supportsInner = postcss.rule({ selector: parentRule.selector });
          supportsInner.append(postcss.decl({ prop: decl.prop, value: decl.value }));
          const supportsRule = postcss.atRule({
            name: 'supports',
            params: '(background: linear-gradient(in oklab, red, red))',
          });
          supportsRule.append(supportsInner);
          parentRule.after(supportsRule);

          // Replace original with fallback
          decl.value = fallbackValue;
        }
      });

      // 5. Fix empty var() fallbacks: var(--foo,) → var(--foo, )
      // Tailwind v4 generates filter chains like:
      //   filter: var(--tw-blur,) var(--tw-brightness,) ...
      // Chrome 103 can't parse var(--foo,) → drops the entire declaration.
      // Adding a space makes it a valid empty-string fallback.
      // Modern browsers treat both identically — zero visual difference.
      root.walkDecls((decl) => {
        if (!decl.value || !decl.value.includes('var(')) return;
        const fixed = decl.value.replace(/var\(([^,)]+),\)/g, 'var($1, )');
        if (fixed !== decl.value) {
          decl.value = fixed;
        }
      });
    },
  };
}
supportsUnwrapPlugin.postcss = true;

// ─── PostCSS Config ───
// Plugin order:
// 1. Tailwind generates CSS (oklch, color-mix, @supports, @property)
// 2. propertyInject adds :root fallbacks for @property initial-values
// 3. colorMixVarResolver inlines var() refs inside color-mix() expressions
// 4. supportsUnwrap: unwraps @supports, adds gradient/transform/var fallbacks
// Note: oklab→rgb and color-mix→rgba conversion is handled by the Vite plugin
// in vite.config.js (generateBundle only) because Vite's PostCSS runner
// doesn't execute Declaration hooks from @csstools plugin packs.
export default {
  plugins: [
    tailwindcss(),
    propertyInjectPlugin(),
    colorMixVarResolverPlugin(),
    supportsUnwrapPlugin(),
  ],
};
