import { useEffect } from 'react';

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
  const value = title || DEFAULT_TITLE;
  // useEffect ensures title is only set after commit, not during render/retries
  // eslint-disable-next-line react-hooks/rules-of-hooks -- always runs in browser
  useEffect(() => { document.title = value; }, [value]);
}
