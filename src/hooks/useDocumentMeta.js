import { useEffect } from 'react';

/**
 * Sets per-page Open Graph, Twitter, and canonical meta tags.
 * Falls back to the static defaults from index.html when unmounted.
 */

const DEFAULTS = {
  title: 'zNews — Горещи Новини и Скандали',
  description: 'Най-горещите новини, скандали и ексклузивни разкрития. Клюки, криминални истории и повече!',
  image: 'https://znews.live/og.png',
  url: 'https://znews.live/',
};

function setMetaContent(selector, content) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', content);
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

/**
 * @param {{ title?: string, description?: string, image?: string, url?: string, type?: string }} meta
 */
export function useDocumentMeta(meta) {
  useEffect(() => {
    const title = meta?.title || DEFAULTS.title;
    const description = meta?.description || DEFAULTS.description;
    const image = meta?.image || DEFAULTS.image;
    const url = meta?.url || (typeof window !== 'undefined' ? window.location.href : DEFAULTS.url);
    const type = meta?.type || 'website';

    // OG
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:image"]', image);
    setMetaContent('meta[property="og:url"]', url);
    setMetaContent('meta[property="og:type"]', type);

    // Twitter
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[name="twitter:image"]', image);

    // Description
    setMetaContent('meta[name="description"]', description);

    // Canonical
    setCanonical(url);

    // Reset on unmount
    return () => {
      setMetaContent('meta[property="og:title"]', DEFAULTS.title);
      setMetaContent('meta[property="og:description"]', DEFAULTS.description);
      setMetaContent('meta[property="og:image"]', DEFAULTS.image);
      setMetaContent('meta[property="og:url"]', DEFAULTS.url);
      setMetaContent('meta[property="og:type"]', 'website');
      setMetaContent('meta[name="twitter:title"]', DEFAULTS.title);
      setMetaContent('meta[name="twitter:description"]', DEFAULTS.description);
      setMetaContent('meta[name="twitter:image"]', DEFAULTS.image);
      setMetaContent('meta[name="description"]', DEFAULTS.description);
      setCanonical(DEFAULTS.url);
    };
  }, [meta?.title, meta?.description, meta?.image, meta?.url, meta?.type]);
}
