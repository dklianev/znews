import { useEffect } from 'react';

export const DEFAULT_TITLE = 'zNews — Горещи Новини и Скандали';

export function makeTitle(pageTitle) {
  const trimmed = String(pageTitle || '').trim();
  if (!trimmed) return DEFAULT_TITLE;
  return `${trimmed} | zNews`;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title || DEFAULT_TITLE;
  }, [title]);
}

