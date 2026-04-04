export const DEFAULT_TITLE = 'zNews — Горещи Новини и Скандали';

export function makeTitle(pageTitle) {
  const trimmed = String(pageTitle || '').trim();
  if (!trimmed) return DEFAULT_TITLE;
  return `${trimmed} | zNews`;
}

/**
 * React 19 declarative document title.
 * Returns a <title> element that React hoists to <head>.
 */
export function DocumentTitle({ title }) {
  return <title>{title || DEFAULT_TITLE}</title>;
}

/**
 * @deprecated Use <DocumentTitle> instead for React 19 declarative metadata.
 * Kept for backward compat with tests and admin pages.
 */
export function useDocumentTitle(title) {
  // React 19: just set it — pages should migrate to <DocumentTitle> over time.
  // Kept as a no-op-safe imperative fallback.
  if (typeof document !== 'undefined') {
    document.title = title || DEFAULT_TITLE;
  }
}
