import { toTimestamp } from './parse.js';

const CANDIDATES_PER_ROUTE = 2;

/**
 * Reads when a journey reaches its destination out of a raw JourneyDetails response.
 *
 * @param {object} raw parsed JSON response of the HAFAS mgate endpoint
 * @param {{stopId: string, destination: string}} opts boarding stop id and destination name part
 * @returns {number|null} predicted (else planned) arrival in epoch ms, null if not found
 */
export function parseArrival(raw, { stopId, destination }) {
    const svc = raw?.svcResL?.[0];
    if (raw?.err !== 'OK' || svc?.err !== 'OK') return null;
    const locs = svc.res.common?.locL ?? [];
    const stops = svc.res.journey?.stopL ?? [];
    const origin = stops.findIndex((s) => locs[s.locX]?.lid?.includes(`L=${stopId}@`));
    const wanted = destination.toLowerCase();
    const target = stops.find(
        (s, i) => i > origin && locs[s.locX]?.name?.toLowerCase().includes(wanted) && s.aTimeS
    );
    if (!target) return null;
    const tz = target.aTZOffset ?? 60;
    const time = target.aTimeR ?? target.aTimeS;
    return toTimestamp(svc.res.journey.date, time, tz);
}

/**
 * The next departures of a route that can still be reached on foot: not cancelled and leaving
 * at least the walking time from now (compared per minute, like the timetable).
 *
 * @param {object[]} departures parsed departures of the route's stop
 * @param {{line: string, direction: string, walkMinutes: number}} route the route
 * @param {number} nowMs current time
 * @returns {object[]} the first few reachable departures with their effective time
 */
export function reachableDepartures(departures, route, nowMs) {
    const earliest = Math.floor(nowMs / 60_000) * 60_000 + route.walkMinutes * 60_000;
    const dir = route.direction.toLowerCase();
    return departures
        .filter((d) => d.line === route.line && d.direction.toLowerCase().includes(dir))
        .map((d) => ({ ...d, effectiveMs: d.actualMs ?? d.plannedMs }))
        .filter((d) => !d.cancelled && d.effectiveMs >= earliest)
        .sort((a, b) => a.effectiveMs - b.effectiveMs)
        .slice(0, CANDIDATES_PER_ROUTE);
}

/**
 * Picks the option that gets to the destination first. Options without a known arrival rank
 * behind those with one; ties go to the earlier departure.
 *
 * @param {{arrivalMs: number|null, effectiveMs: number}[]} options reachable departures
 * @returns {{best: object|null, alternative: object|null}} best option, plus the best option
 *   of a different route (to show what the other choice would be)
 */
export function chooseBest(options) {
    const rank = (o) => o.arrivalMs ?? Number.POSITIVE_INFINITY;
    const sorted = [...options].sort(
        (a, b) => rank(a) - rank(b) || a.effectiveMs - b.effectiveMs
    );
    const best = sorted[0] ?? null;
    const alternative = best ? (sorted.find((o) => o.route.line !== best.route.line) ?? null) : null;
    return { best, alternative };
}
