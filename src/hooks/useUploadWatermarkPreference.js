import { useEffect, useState } from 'react';

const STORAGE_KEY = 'zn-upload-apply-watermark';

function readStoredPreference(defaultValue) {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // Ignore localStorage access issues.
  }
  return defaultValue;
}

export default function useUploadWatermarkPreference(defaultValue = true) {
  const [applyWatermark, setApplyWatermark] = useState(() => readStoredPreference(defaultValue));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, applyWatermark ? 'true' : 'false');
    } catch {
      // Ignore localStorage access issues.
    }
  }, [applyWatermark]);

  return [applyWatermark, setApplyWatermark];
}
