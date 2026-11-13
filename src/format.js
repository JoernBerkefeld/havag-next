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
 * @returns {string} m:ss countdown, or "jetzt" once due
 */
export function formatCountdown(diffMs) {
    if (diffMs <= 0) return 'jetzt';
    const total = Math.floor(diffMs / 1000);
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
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
