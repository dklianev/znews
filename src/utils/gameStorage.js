/**
 * gameStorage.js
 * Utility for managing local player progress and state for zNews Games.
 * Safe for SSR (next.js) or regular React.
 */

const PROFILE_KEY = 'zn_game_profile';
const DEFAULT_PROFILE = Object.freeze({
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    completedDatesByGame: {},
    streaksByGame: {},
});

function getStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function getScopedGameKey(gameSlug, scope) {
    return `zn_game_${gameSlug}_${scope}`;
}

function getGameKey(gameSlug, dateStr) {
    return getScopedGameKey(gameSlug, dateStr);
}

export function saveScopedGameProgress(gameSlug, scope, data) {
    const storage = getStorage();
    if (!storage) return false;
    try {
        const key = getScopedGameKey(gameSlug, scope);
        storage.setItem(key, JSON.stringify(data));
        return true;
    } catch {
        return false;
    }
}

export function loadScopedGameProgress(gameSlug, scope) {
    const storage = getStorage();
    if (!storage) return null;
    try {
        const key = getScopedGameKey(gameSlug, scope);
        const stored = storage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

export function saveGameProgress(gameSlug, dateStr, data) {
    return saveScopedGameProgress(gameSlug, dateStr, data);
}

export function loadGameProgress(gameSlug, dateStr) {
    return loadScopedGameProgress(gameSlug, dateStr);
}

export function saveGameProfile(profileData) {
    const storage = getStorage();
    if (!storage) return false;
    try {
        const current = loadGameProfile();
        const updated = normalizeGameProfile({
            ...current,
            ...profileData,
            completedDatesByGame: {
                ...(current?.completedDatesByGame || {}),
                ...(profileData?.completedDatesByGame || {}),
            },
            streaksByGame: {
                ...(current?.streaksByGame || {}),
                ...(profileData?.streaksByGame || {}),
            },
        });
        storage.setItem(PROFILE_KEY, JSON.stringify(updated));
        return true;
    } catch {
        return false;
    }
}

export function loadGameProfile() {
    const storage = getStorage();
    if (!storage) return { ...DEFAULT_PROFILE };
    try {
        const stored = storage.getItem(PROFILE_KEY);
        return normalizeGameProfile(stored ? JSON.parse(stored) : {});
    } catch {
        return { ...DEFAULT_PROFILE };
    }
}

function isValidDateStr(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function toUtcDayNumber(dateStr) {
    if (!isValidDateStr(dateStr)) return Number.NaN;
    const [year, month, day] = dateStr.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}

function getPreviousDateStr(dateStr) {
    const utcDay = toUtcDayNumber(dateStr);
    if (!Number.isFinite(utcDay)) return null;
    return new Date(utcDay - 86400000).toISOString().slice(0, 10);
}

function getNextDateStr(dateStr) {
    const utcDay = toUtcDayNumber(dateStr);
    if (!Number.isFinite(utcDay)) return null;
    return new Date(utcDay + 86400000).toISOString().slice(0, 10);
}

function uniqueSortedDates(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(isValidDateStr))].sort();
}

function countCurrentStreakFromDates(dates) {
    if (!Array.isArray(dates) || dates.length === 0) return 0;
    let streak = 1;
    for (let index = dates.length - 1; index > 0; index -= 1) {
        if (getNextDateStr(dates[index - 1]) !== dates[index]) break;
        streak += 1;
    }
    return streak;
}

function countMaxStreakFromDates(dates) {
    if (!Array.isArray(dates) || dates.length === 0) return 0;
    let best = 1;
    let current = 1;
    for (let index = 1; index < dates.length; index += 1) {
        if (getNextDateStr(dates[index - 1]) === dates[index]) {
            current += 1;
        } else {
            current = 1;
        }
        if (current > best) best = current;
    }
    return best;
}

function normalizeStreakEntry(entry, dates) {
    const normalizedDates = uniqueSortedDates(dates);
    const lastCompletedDate = normalizedDates.at(-1) || null;
    const currentStreakFromDates = countCurrentStreakFromDates(normalizedDates);
    const maxStreakFromDates = countMaxStreakFromDates(normalizedDates);
    const safeEntry = entry && typeof entry === 'object' ? entry : {};
    const hasExplicitCurrentStreak = Number.isFinite(Number(safeEntry.currentStreak));
    const currentStreak = hasExplicitCurrentStreak
        ? Math.max(0, Number.parseInt(safeEntry.currentStreak, 10))
        : currentStreakFromDates;
    const maxStreak = Number.isFinite(Number(safeEntry.maxStreak))
        ? Math.max(currentStreak, Number.parseInt(safeEntry.maxStreak, 10))
        : Math.max(currentStreak, maxStreakFromDates);

    return {
        currentStreak: currentStreak,
        maxStreak: normalizedDates.length > 0 ? Math.max(maxStreak, maxStreakFromDates) : maxStreak,
        lastCompletedDate: isValidDateStr(safeEntry.lastCompletedDate) ? safeEntry.lastCompletedDate : lastCompletedDate,
        lastAttemptDate: isValidDateStr(safeEntry.lastAttemptDate) ? safeEntry.lastAttemptDate : null,
    };
}

function normalizeGameProfile(profile) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const completedDatesByGame = {};
    const streaksByGame = {};
    const gameSlugs = new Set([
        ...Object.keys(safeProfile.completedDatesByGame || {}),
        ...Object.keys(safeProfile.streaksByGame || {}),
    ]);

    for (const gameSlug of gameSlugs) {
        const dates = uniqueSortedDates(safeProfile.completedDatesByGame?.[gameSlug]);
        completedDatesByGame[gameSlug] = dates;
        streaksByGame[gameSlug] = normalizeStreakEntry(safeProfile.streaksByGame?.[gameSlug], dates);
    }

    const streakEntries = Object.values(streaksByGame);
    const currentStreak = streakEntries.reduce((best, entry) => Math.max(best, entry.currentStreak || 0), 0);
    const maxStreak = streakEntries.reduce((best, entry) => Math.max(best, entry.maxStreak || 0), 0);

    return {
        ...DEFAULT_PROFILE,
        ...safeProfile,
        currentStreak,
        maxStreak,
        lastPlayedDate: isValidDateStr(safeProfile.lastPlayedDate) ? safeProfile.lastPlayedDate : null,
        completedDatesByGame,
        streaksByGame,
    };
}

function getNormalizedStreak(profile, gameSlug) {
    const safeProfile = normalizeGameProfile(profile);
    return safeProfile.streaksByGame?.[gameSlug] || {
        currentStreak: 0,
        maxStreak: 0,
        lastCompletedDate: null,
        lastAttemptDate: null,
    };
}

export function getGameStreak(profile, gameSlug) {
    return getNormalizedStreak(profile, gameSlug);
}

export function recordGameWin(gameSlug, dateStr) {
    if (!gameSlug || !isValidDateStr(dateStr)) return;
    const profile = loadGameProfile();
    const existingDates = uniqueSortedDates(profile.completedDatesByGame?.[gameSlug]);

    if (existingDates.includes(dateStr)) {
        return;
    }

    const previousStreak = getNormalizedStreak(profile, gameSlug);
    const nextCurrentStreak = previousStreak.lastCompletedDate === getPreviousDateStr(dateStr)
        ? previousStreak.currentStreak + 1
        : 1;

    profile.completedDatesByGame[gameSlug] = [...existingDates, dateStr].sort();
    profile.streaksByGame[gameSlug] = {
        currentStreak: nextCurrentStreak,
        maxStreak: Math.max(previousStreak.maxStreak || 0, nextCurrentStreak),
        lastCompletedDate: dateStr,
        lastAttemptDate: dateStr,
    };
    profile.lastPlayedDate = dateStr;

    saveGameProfile(profile);
}

export function recordGameLoss(gameSlug, dateStr) {
    if (!gameSlug || !isValidDateStr(dateStr)) return;
    const profile = loadGameProfile();
    const previousStreak = getNormalizedStreak(profile, gameSlug);

    profile.streaksByGame[gameSlug] = {
        ...previousStreak,
        currentStreak: 0,
        lastAttemptDate: dateStr,
    };
    profile.lastPlayedDate = dateStr;

    saveGameProfile(profile);
}
