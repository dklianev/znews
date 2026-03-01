/**
 * gameDate.js
 * Utility for ensuring all game date logic is locked to 'Europe/Sofia' timezone
 * regardless of the user's local timezone.
 */

/**
 * Returns the current date as an ISO string YYYY-MM-DD locked to the Sofia timezone.
 * Used for determining "today's" game.
 */
export function getTodayStr() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Sofia',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;

    return `${year}-${month}-${day}`;
}

/**
 * Validates if the given string is a valid YYYY-MM-DD format
 */
export function isValidDateStr(str) {
    return /^\d{4}-\d{2}-\d{2}$/.test(str);
}
