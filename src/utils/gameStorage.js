/**
 * gameStorage.js
 * Utility for managing local player progress and state for zNews Games.
 * Safe for SSR (next.js) or regular React.
 */

const PROFILE_KEY = 'zn_game_profile';

function getStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function getGameKey(gameSlug, dateStr) {
    return `zn_game_${gameSlug}_${dateStr}`;
}

export function saveGameProgress(gameSlug, dateStr, data) {
    const storage = getStorage();
    if (!storage) return false;
    try {
        const key = getGameKey(gameSlug, dateStr);
        storage.setItem(key, JSON.stringify(data));
        return true;
    } catch {
        return false;
    }
}

export function loadGameProgress(gameSlug, dateStr) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const key = getGameKey(gameSlug, dateStr);
        const stored = storage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

export function saveGameProfile(profileData) {
    const storage = getStorage();
    if (!storage) return false;
    try {
        const current = loadGameProfile() || {};
        const updated = { ...current, ...profileData };
        storage.setItem(PROFILE_KEY, JSON.stringify(updated));
        return true;
    } catch {
        return false;
    }
}

export function loadGameProfile() {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const stored = storage.getItem(PROFILE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

// Utility to track win streaks
export function recordGameWin(gameSlug, dateStr) {
    const profile = loadGameProfile() || { currentStreak: 0, maxStreak: 0, completedDatesByGame: {} };

    if (!profile.completedDatesByGame[gameSlug]) {
        profile.completedDatesByGame[gameSlug] = [];
    }

    // Don't double count if already recorded
    if (!profile.completedDatesByGame[gameSlug].includes(dateStr)) {
        profile.completedDatesByGame[gameSlug].push(dateStr);

        // Simplistic streak logic - could be expanded to check contiguous days
        profile.currentStreak += 1;
        if (profile.currentStreak > profile.maxStreak) {
            profile.maxStreak = profile.currentStreak;
        }

        profile.lastPlayedDate = dateStr;
        saveGameProfile(profile);
    }
}

export function recordGameLoss(gameSlug, dateStr) {
    const profile = loadGameProfile() || { currentStreak: 0, maxStreak: 0, completedDatesByGame: {} };

    // Reset streak on loss
    profile.currentStreak = 0;
    profile.lastPlayedDate = dateStr;

    saveGameProfile(profile);
}
