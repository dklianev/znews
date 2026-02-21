const TAG_REMAP = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  div: 'p',
};

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'blockquote',
  'h2', 'h3', 'h4',
  'a',
  'img',
]);

const IMAGE_WIDTH_VALUES = new Set(['25', '50', '75', '100']);
const IMAGE_ALIGN_VALUES = new Set(['left', 'center', 'right']);

function sanitizeHref(value) {
  if (typeof value !== 'string') return '#';
  const trimmed = value.trim();
  if (!trimmed) return '#';
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch { }
  return '#';
}

function sanitizeImageSrc(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch { }
  return '';
}

function normalizeImageAlt(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function sanitizeImageWidth(value) {
  const normalized = String(value || '').trim();
  return IMAGE_WIDTH_VALUES.has(normalized) ? normalized : '100';
}

function sanitizeImageAlign(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return IMAGE_ALIGN_VALUES.has(normalized) ? normalized : 'center';
}

function unwrapElement(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

function replaceTag(element, nextTagName) {
  const doc = element.ownerDocument;
  const next = doc.createElement(nextTagName);
  while (element.firstChild) next.appendChild(element.firstChild);
  element.parentNode.replaceChild(next, element);
  return next;
}

function wrapChildrenWithTag(element, tagName) {
  const doc = element.ownerDocument;
  const wrapper = doc.createElement(tagName);
  while (element.firstChild) wrapper.appendChild(element.firstChild);
  element.appendChild(wrapper);
}

function applyInlineStyleSemantics(element) {
  const styleText = (element.getAttribute('style') || '').toLowerCase();
  if (!styleText) return false;

  const hasBold = /font-weight\s*:\s*(bold|[6-9]00)/.test(styleText);
  const hasItalic = /font-style\s*:\s*italic/.test(styleText);
  const hasUnderline = /text-decoration[^;]*underline/.test(styleText);
  const hasStrike = /text-decoration[^;]*line-through/.test(styleText);

  if (!hasBold && !hasItalic && !hasUnderline && !hasStrike) return false;
  if (hasBold) wrapChildrenWithTag(element, 'strong');
  if (hasItalic) wrapChildrenWithTag(element, 'em');
  if (hasUnderline) wrapChildrenWithTag(element, 'u');
  if (hasStrike) wrapChildrenWithTag(element, 's');
  return true;
}

function normalizeNodes(root) {
  const showElement = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_ELEMENT : 1;
  const walker = root.ownerDocument.createTreeWalker(root, showElement);
  const nodes = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }

  nodes.forEach((node) => {
    if (!node.parentNode) return;

    const originalTag = node.tagName.toLowerCase();
    const mappedTag = TAG_REMAP[originalTag] || originalTag;
    const activeNode = mappedTag !== originalTag ? replaceTag(node, mappedTag) : node;
    const tag = activeNode.tagName.toLowerCase();
    const hrefSource = tag === 'a' ? (activeNode.getAttribute('href') || node.getAttribute('href') || '') : '';
    const srcSource = tag === 'img' ? (activeNode.getAttribute('src') || node.getAttribute('src') || '') : '';
    const altSource = tag === 'img' ? (activeNode.getAttribute('alt') || node.getAttribute('alt') || '') : '';
    const widthSource = tag === 'img' ? (activeNode.getAttribute('data-width') || node.getAttribute('data-width') || '') : '';
    const alignSource = tag === 'img' ? (activeNode.getAttribute('data-align') || node.getAttribute('data-align') || '') : '';

    if ((tag === 'span' || tag === 'font') && applyInlineStyleSemantics(activeNode)) {
      unwrapElement(activeNode);
      return;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      unwrapElement(activeNode);
      return;
    }

    [...activeNode.attributes].forEach((attr) => {
      activeNode.removeAttribute(attr.name);
    });

    if (tag === 'a') {
      const href = sanitizeHref(hrefSource);
      if (href === '#') {
        unwrapElement(activeNode);
        return;
      }
      activeNode.setAttribute('href', href);
      activeNode.setAttribute('target', '_blank');
      activeNode.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    if (tag === 'img') {
      const src = sanitizeImageSrc(srcSource);
      if (!src) {
        activeNode.remove();
        return;
      }
      activeNode.setAttribute('src', src);
      activeNode.setAttribute('alt', normalizeImageAlt(altSource));
      activeNode.setAttribute('loading', 'lazy');
      activeNode.setAttribute('decoding', 'async');
      activeNode.setAttribute('data-width', sanitizeImageWidth(widthSource));
      activeNode.setAttribute('data-align', sanitizeImageAlign(alignSource));
    }
  });
}

function wrapLooseTextNodes(root) {
  const doc = root.ownerDocument;
  const toWrap = [];
  root.childNodes.forEach((child) => {
    if (child.nodeType === 3 && child.textContent.trim()) {
      toWrap.push(child);
    }
  });
  toWrap.forEach((textNode) => {
    const paragraph = doc.createElement('p');
    paragraph.textContent = textNode.textContent;
    root.replaceChild(paragraph, textNode);
  });
}

export function normalizeRichTextHtml(inputHtml) {
  const raw = typeof inputHtml === 'string' ? inputHtml : '';
  if (typeof DOMParser === 'undefined') return raw;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="rt-root">${raw}</div>`, 'text/html');
  const root = doc.getElementById('rt-root');
  if (!root) return '<p></p>';

  normalizeNodes(root);
  wrapLooseTextNodes(root);

  const normalized = root.innerHTML
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<blockquote>\s*<\/blockquote>/gi, '')
    .trim();

  return normalized || '<p></p>';
}

export function cleanPastedHtml(inputHtml) {
  const raw = typeof inputHtml === 'string' ? inputHtml : '';
  if (!raw) return '';
  if (typeof DOMParser === 'undefined') {
    return raw
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(meta|style|script|link)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(meta|style|script|link)[^>]*\/?>/gi, '')
      .trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="rt-paste-root">${raw}</div>`, 'text/html');
  const root = doc.getElementById('rt-paste-root');
  if (!root) return '';

  root.querySelectorAll('meta, style, script, link, iframe, object, embed, svg, canvas, form, input, textarea, button, select').forEach((node) => {
    node.remove();
  });

  root.querySelectorAll('*').forEach((node) => {
    const tagName = node.tagName?.toLowerCase() || '';
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
        return;
      }
      if (name === 'style') {
        const cleaned = String(attr.value || '')
          .replace(/mso-[^:]+:[^;]+;?/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleaned) node.setAttribute('style', cleaned);
        else node.removeAttribute('style');
        return;
      }
      if (name === 'href' && tagName === 'a') return;
      if ((name === 'src' || name === 'alt') && tagName === 'img') return;
      if ((name === 'data-width' || name === 'data-align') && tagName === 'img') return;
      node.removeAttribute(attr.name);
    });
  });

  return root.innerHTML.trim();
}

export function extractTextFromHtml(inputHtml) {
  const normalized = normalizeRichTextHtml(inputHtml || '');
  if (typeof DOMParser === 'undefined') return String(normalized).replace(/<[^>]+>/g, ' ').trim();
  const parser = new DOMParser();
  const doc = parser.parseFromString(normalized, 'text/html');
  return (doc.body.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateReadTimeFromHtml(inputHtml, wordsPerMinute = 220) {
  const text = extractTextFromHtml(inputHtml || '');
  if (!text) return 1;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function countWordsFromHtml(inputHtml) {
  const text = extractTextFromHtml(inputHtml || '');
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
