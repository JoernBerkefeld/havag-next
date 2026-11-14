const WINDOW_MS = 60_000;

/**
 * Allows an automatic page reload at most once a minute, so a failure that persists ends in a
 * message instead of a reload loop. Without usable storage it never reloads automatically.
 *
 * @param {string} key storage key for this kind of reload
 * @param {number} [now] current time in milliseconds
 * @param {Pick<Storage, 'getItem' | 'setItem'>} [storage] session storage
 * @returns {boolean} true if a reload is allowed now (and is recorded)
 */
export function canAutoReload(key, now = Date.now(), storage = globalThis.sessionStorage) {
    try {
        const last = Number(storage.getItem(key));
        if (last && now - last < WINDOW_MS) return false;
        storage.setItem(key, String(now));
        return true;
    } catch {
        return false;
    }
}
