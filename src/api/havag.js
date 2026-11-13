import { parseDepartures, selectNext } from './parse.js';

// Public INSA (Sachsen-Anhalt) HAFAS endpoint and the public client key that the open-source
// hafas-client library uses as well. Nothing here is a secret.
const ENDPOINT = 'https://reiseauskunft.insa.de/bin/mgate.exe';
const STOP_ID = '3937'; // Halle (Saale), Betriebshof Freiimfelder Str.
export const LINE = '10';
export const DIRECTION = 'Soltauer Str.';

/**
 * @param {Date} now current time
 * @returns {{date: string, time: string}} Halle local date (YYYYMMDD) and time (HHMMSS)
 */
function berlinParts(now) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Berlin',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(now)
            .map((p) => [p.type, p.value])
    );
    return {
        date: `${parts.year}${parts.month}${parts.day}`,
        time: `${parts.hour}${parts.minute}${parts.second}`,
    };
}

/**
 * @param {Date} now current time
 * @returns {string} request body
 */
export function buildRequest(now) {
    const { date, time } = berlinParts(now);
    return JSON.stringify({
        lang: 'de',
        svcReqL: [
            {
                cfg: { polyEnc: 'GPA' },
                meth: 'StationBoard',
                req: {
                    type: 'DEP',
                    date,
                    time,
                    stbLoc: { type: 'S', extId: STOP_ID, lid: `A=1@L=${STOP_ID}@` },
                    dur: 60,
                    maxJny: 40,
                },
            },
        ],
        client: { type: 'IPH', id: 'NASA', v: '4000200', name: 'nasaPROD' },
        ext: 'NASA.1',
        ver: '1.44',
        auth: { type: 'AID', aid: 'nasa-apps' },
    });
}

/**
 * Fetches live data. The body is sent as text/plain on purpose: the endpoint answers cross-origin
 * requests, but not the preflight that a JSON content type would trigger.
 *
 * @param {AbortSignal} [signal] abort signal
 * @returns {Promise<{next: object|null, skipped: object[]}>} next departure of the line
 */
export async function fetchNext(signal) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: buildRequest(new Date()),
        cache: 'no-store',
        signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const departures = parseDepartures(await res.json());
    return selectNext(departures, { line: LINE, direction: DIRECTION, nowMs: Date.now() });
}
