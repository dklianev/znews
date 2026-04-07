import { useCallback, useEffect, useMemo, useState } from 'react';
import { isHuntActive } from '../utils/seasonalCampaigns';

const STORAGE_PREFIX = 'zn-easter-hunt-v';
const BADGE_DISMISSED_KEY = 'zn-easter-badge-dismissed';

function getStorageKey(version) {
  return `${STORAGE_PREFIX}${version}`;
}

function loadCollected(version) {
  try {
    const raw = localStorage.getItem(getStorageKey(version));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveCollected(version, collected) {
  try {
    localStorage.setItem(getStorageKey(version), JSON.stringify([...collected]));
  } catch {
    /* quota exceeded */
  }
}

function isBadgeDismissed(version) {
  try {
    return localStorage.getItem(BADGE_DISMISSED_KEY) === String(version);
  } catch {
    return false;
  }
}

function dismissBadge(version) {
  try {
    localStorage.setItem(BADGE_DISMISSED_KEY, String(version));
  } catch {
    /* storage unavailable */
  }
}

export default function useEasterEggHunt(settings) {
  const easter = settings?.seasonalCampaigns?.easter;
  const version = easter?.huntVersion || 1;
  const total = easter?.huntEggCount || 6;
  const rewardText = easter?.huntRewardText || 'Браво! Намери всички яйца!';
  const showProgress = easter?.showProgress ?? true;
  const huntActive = isHuntActive(settings);

  const [collected, setCollected] = useState(() => loadCollected(version));
  const [badgeDismissed, setBadgeDismissed] = useState(() => isBadgeDismissed(version));

  useEffect(() => {
    setCollected(loadCollected(version));
    setBadgeDismissed(isBadgeDismissed(version));
  }, [version]);

  const collectEgg = useCallback((eggId) => {
    if (!huntActive) return;
    setCollected((prev) => {
      if (prev.has(eggId)) return prev;
      const next = new Set(prev);
      next.add(eggId);
      saveCollected(version, next);
      return next;
    });
  }, [huntActive, version]);

  const isCollected = useCallback((eggId) => collected.has(eggId), [collected]);

  const handleDismissBadge = useCallback(() => {
    dismissBadge(version);
    setBadgeDismissed(true);
  }, [version]);

  return useMemo(() => ({
    huntActive,
    collected,
    total,
    collectEgg,
    isCollected,
    completionPercent: total > 0 ? Math.round((collected.size / total) * 100) : 0,
    isComplete: collected.size >= total,
    rewardText,
    showProgress,
    badgeDismissed,
    dismissBadge: handleDismissBadge,
  }), [huntActive, collected, total, collectEgg, isCollected, rewardText, showProgress, badgeDismissed, handleDismissBadge]);
}
