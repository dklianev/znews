import { getTodayStr, isValidDateStr } from './gameDate';

export function addPuzzleDays(dateStr, offsetDays) {
    const [year, month, day] = String(dateStr || getTodayStr()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

export function getPuzzleDurationDays(startDate, endDate) {
    if (!isValidDateStr(startDate)) return 1;
    const safeEndDate = isValidDateStr(endDate) && endDate >= startDate ? endDate : startDate;
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = safeEndDate.split('-').map(Number);
    const diffMs = Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay);
    return Math.max(1, Math.round(diffMs / 86400000) + 1);
}

export function normalizePuzzleActiveUntilDate(startDate, endDate) {
    const safeStartDate = isValidDateStr(startDate) ? startDate : getTodayStr();
    if (!isValidDateStr(endDate) || endDate < safeStartDate) return safeStartDate;
    return endDate;
}

export function formatPuzzleDateLabel(dateStr) {
    if (!isValidDateStr(dateStr)) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('bg-BG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function getPuzzleWindowLabel(startDate, endDate) {
    const safeStartDate = isValidDateStr(startDate) ? startDate : getTodayStr();
    const safeEndDate = normalizePuzzleActiveUntilDate(safeStartDate, endDate);
    if (safeStartDate === safeEndDate) return formatPuzzleDateLabel(safeStartDate);
    return formatPuzzleDateLabel(safeStartDate) + ' - ' + formatPuzzleDateLabel(safeEndDate);
}
