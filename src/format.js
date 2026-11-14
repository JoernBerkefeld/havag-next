const TZ = 'Europe/Berlin';

/**
 * @param {number} ms epoch milliseconds
 * @returns {string} HH:MM in Halle local time
 */
export function formatClock(ms) {
    return new Date(ms).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TZ,
    });
}

/**
 * @param {number} ms epoch milliseconds
 * @returns {string} HH:MM:SS in Halle local time
 */
export function formatClockSeconds(ms) {
    return new Date(ms).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: TZ,
    });
}

/**
 * @param {number} diffMs milliseconds until departure
 * @returns {string} "in N min" (whole minutes, rounded down), or "sofort" below one minute
 */
export function formatCountdown(diffMs) {
    const minutes = Math.floor(diffMs / 60_000);
    return minutes >= 1 ? `in ${minutes} min` : 'sofort';
}

/**
 * @param {number} plannedMs planned departure
 * @param {number|null} actualMs predicted departure
 * @returns {number|null} delay in whole minutes (null without realtime data)
 */
export function delayMinutes(plannedMs, actualMs) {
    if (actualMs == null) return null;
    return Math.round((actualMs - plannedMs) / 60_000);
}
