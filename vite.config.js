import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import postcss from 'postcss';
import postcssOklabFunction from '@csstools/postcss-oklab-function';
import postcssColorMixFunction from '@csstools/postcss-color-mix-function';
import postcssMediaMinmax from '@csstools/postcss-media-minmax';

// ─── Vite Plugin: CSS Color Fallback for Chrome 103 ───
// Runs oklch→rgb, color-mix→rgba, and media-range→minmax conversions
// on the final CSS bundle via generateBundle (not PostCSS config) because
// Vite's built-in PostCSS runner doesn't execute Declaration hooks from
// @csstools "plugin pack" objects.
//
// Uses default enableProgressiveCustomProperties (true) so that oklch
// values inside CSS custom properties (--color-*) stay wrapped in
// @supports blocks — Chrome 103 skips them and uses hex fallbacks.
//
// preserve:true keeps original oklch/color-mix values for modern browsers.
function cssColorFallbackPlugin() {
  // Flatten plugin packs: @csstools plugins return { postcssPlugin, plugins }
  // objects. We need to extract the inner plugins array.
  function flattenPlugins(pluginOrPack) {
    if (pluginOrPack && typeof pluginOrPack === 'object' && Array.isArray(pluginOrPack.plugins)) {
      // Plugin pack — return inner plugins
      return pluginOrPack.plugins.flatMap(flattenPlugins);
    }
    return [pluginOrPack];
  }

  const oklabPlugin = postcssOklabFunction({ preserve: true });
  const colorMixPlugin = postcssColorMixFunction({ preserve: true });
  const mediaMinmaxPlugin = postcssMediaMinmax();

  const allPlugins = [oklabPlugin, colorMixPlugin, mediaMinmaxPlugin]
    .flatMap(flattenPlugins);

  return {
    name: 'vite-plugin-css-color-fallback',
    apply: 'build',

    async generateBundle(_, bundle) {
      const processor = postcss(allPlugins);

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (!fileName.endsWith('.css')) continue;
        const source = typeof asset.source === 'string' ? asset.source : '';
        if (!source) continue;

        try {
          const result = await processor.process(source, { from: fileName, to: fileName });
          let css = result.css;

          // Add gradient "in oklab/oklch/lab" fallbacks AFTER minification.
          // Vite's Lightning CSS minifier strips duplicate custom properties,
          // so we must inject fallbacks post-minify.
          // Strategy: for each declaration containing "in oklab" etc., insert a
          // duplicate property WITHOUT "in oklab" before it.
          // Chrome 103 can't parse "in oklab" → drops it → uses the fallback.
          // Modern browsers parse both → last wins → keep smooth interpolation.
          css = css.replace(
            /([\w-]+)\s*:\s*([^;{}]*?\s+in\s+(?:oklab|oklch|lab)\b[^;{}]*)/g,
            (match, prop, value) => {
              // Skip custom properties — handled by PostCSS @supports wrapping
              if (prop.startsWith('--')) return match;

              const fallback = value
                .replace(/\s+in\s+oklab/g, '')
                .replace(/\s+in\s+oklch/g, '')
                .replace(/\s+in\s+lab/g, '');
              if (fallback !== value) {
                return `${prop}:${fallback};${prop}:${value}`;
              }
              return match;
            }
          );

          asset.source = css;
        } catch (err) {
          console.warn(`[css-color-fallback] Error processing ${fileName}:`, err.message);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cssColorFallbackPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'zNews',
        short_name: 'zNews',
        description: 'Горещи новини, скандали и слухове',
        lang: 'bg',
        theme_color: '#1C1428',
        background_color: '#ECE9E6',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        importScripts: ['/custom-sw.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/znewsmedia01\.blob\.core\.windows\.net\/.*\.(?:avif|webp|jpe?g|png)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'znews-azure-images',
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        navigateFallbackDenylist: [
          /^\/assets\//,
          /^\/api\//,
          /^\/sw\.js$/,
          /^\/workbox-.*\.js$/,
          /^\/manifest\.webmanifest$/,
          /^\/.*\.(?:js|css|map|png|jpg|jpeg|svg|webp|avif|woff2?|ttf|ico)$/,
        ],
      }
    })
  ],
  build: {
    target: 'chrome103',
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');
          if (!normalizedId.includes('/node_modules/')) return undefined;
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/react-is/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'vendor';
          }
          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'lucide';
          }
          if (
            normalizedId.includes('/node_modules/motion/')
            || normalizedId.includes('/node_modules/motion-dom/')
            || normalizedId.includes('/node_modules/motion-utils/')
          ) {
            return 'motion';
          }
          if (
            normalizedId.includes('/node_modules/recharts/')
            || normalizedId.includes('/node_modules/d3-')
          ) {
            return undefined;
          }
          return undefined;
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
    }
  }
})
