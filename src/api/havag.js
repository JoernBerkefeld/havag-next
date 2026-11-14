import { parseDepartures, selectNext } from './parse.js';
import { chooseBest, parseArrival, reachableDepartures } from './routes.js';

// Public INSA (Sachsen-Anhalt) HAFAS endpoint and the public client key that the open-source
// hafas-client library uses as well. Nothing here is a secret.
const ENDPOINT = 'https://reiseauskunft.insa.de/bin/mgate.exe';

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
 * @param {string} stopId INSA stop id
 * @returns {string} request body
 */
export function buildRequest(now, stopId) {
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
                    stbLoc: { type: 'S', extId: stopId, lid: `A=1@L=${stopId}@` },
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
 * @param {string} jid journey id from a departure
 * @param {string} date journey date (YYYYMMDD)
 * @returns {string} request body for the stops of one journey
 */
export function buildJourneyRequest(jid, date) {
    return JSON.stringify({
        lang: 'de',
        svcReqL: [{ cfg: { polyEnc: 'GPA' }, meth: 'JourneyDetails', req: { jid, date } }],
        client: { type: 'IPH', id: 'NASA', v: '4000200', name: 'nasaPROD' },
        ext: 'NASA.1',
        ver: '1.44',
        auth: { type: 'AID', aid: 'nasa-apps' },
    });
}

/**
 * Posts a request. The body is sent as text/plain on purpose: the endpoint answers cross-origin
 * requests, but not the preflight that a JSON content type would trigger.
 *
 * @param {string} body request body
 * @param {AbortSignal} [signal] abort signal
 * @returns {Promise<object>} parsed response
 */
async function post(body, signal) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        cache: 'no-store',
        signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function fetchRouteOptions(route, destination, signal) {
    const departures = parseDepartures(await post(buildRequest(new Date(), route.stopId), signal));
    const reachable = reachableDepartures(departures, route, Date.now());
    return Promise.all(
        reachable.map(async (d) => {
            let arrivalMs = null;
            try {
                const raw = await post(buildJourneyRequest(d.jid, d.date), signal);
                arrivalMs = parseArrival(raw, { stopId: route.stopId, destination });
            } catch (e) {
                if (e.name === 'AbortError') throw e;
            }
            return { ...d, arrivalMs, route };
        })
    );
}

/**
 * Of several stops/lines, finds the tram that reaches the destination first when the walk to its
 * stop is taken into account.
 *
 * @param {{destination: string, routes: object[]}} place place with routes
 * @param {AbortSignal} [signal] abort signal
 * @returns {Promise<{next: object|null, alternative: object|null, skipped: object[]}>} result
 */
async function fetchBestRoute(place, signal) {
    const lists = await Promise.all(
        place.routes.map((r) => fetchRouteOptions(r, place.destination, signal))
    );
    const { best, alternative } = chooseBest(lists.flat());
    return { next: best, alternative, skipped: [] };
}

/**
 * Fetches live data.
 *
 * @param {{stopId?: string, line?: string, direction?: string, routes?: object[]}} place stop,
 *   line and direction, or several routes to compare
 * @param {AbortSignal} [signal] abort signal
 * @returns {Promise<{next: object|null, skipped: object[]}>} next departure of the line
 */
export async function fetchNext(place, signal) {
    if (place.routes) return fetchBestRoute(place, signal);
    const departures = parseDepartures(await post(buildRequest(new Date(), place.stopId), signal));
    return selectNext(departures, {
        line: place.line,
        direction: place.direction,
        nowMs: Date.now(),
    });
}
