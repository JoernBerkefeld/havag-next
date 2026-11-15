/**
 * Converts a HAFAS date (YYYYMMDD) and time (HHMMSS or DDHHMMSS with a day offset)
 * into epoch milliseconds, using the UTC offset (minutes) reported by the API.
 *
 * @param {string} date YYYYMMDD
 * @param {string} time HHMMSS or DDHHMMSS
 * @param {number} tzOffsetMinutes offset of the local timezone to UTC
 * @returns {number} epoch milliseconds
 */
export function toTimestamp(date, time, tzOffsetMinutes = 60) {
    const dayOffset = time.length > 6 ? Number(time.slice(0, time.length - 6)) : 0;
    const t = time.slice(-6);
    return (
        Date.UTC(
            Number(date.slice(0, 4)),
            Number(date.slice(4, 6)) - 1,
            Number(date.slice(6, 8)) + dayOffset,
            Number(t.slice(0, 2)),
            Number(t.slice(2, 4)),
            Number(t.slice(4, 6))
        ) -
        tzOffsetMinutes * 60_000
    );
}

/**
 * Reads the departures out of a raw StationBoard response.
 *
 * @param {object} raw parsed JSON response of the HAFAS mgate endpoint
 * @returns {{line: string, direction: string, plannedMs: number, actualMs: number|null, cancelled: boolean, jid: string|null, date: string}[]} departures
 */
export function parseDepartures(raw) {
    const svc = raw?.svcResL?.[0];
    if (raw?.err !== 'OK' || svc?.err !== 'OK') {
        throw new Error(`HAFAS error: ${svc?.err ?? raw?.err ?? 'unknown'}`);
    }
    const prods = svc.res.common?.prodL ?? [];
    return (svc.res.jnyL ?? []).flatMap((jny) => {
        const stop = jny.stbStop;
        if (!stop?.dTimeS) return [];
        const tz = stop.dTZOffset ?? 60;
        const prod = prods[jny.prodX];
        return [
            {
                line: prod?.nameS ?? prod?.number ?? '',
                direction: jny.dirTxt ?? '',
                plannedMs: toTimestamp(jny.date, stop.dTimeS, tz),
                actualMs: stop.dTimeR ? toTimestamp(jny.date, stop.dTimeR, tz) : null,
                cancelled: Boolean(stop.dCncl),
                jid: jny.jid ?? null,
                date: jny.date,
            },
        ];
    });
}

/**
 * A line often runs to a different last stop depending on the day (for example only to a
 * turnaround stop on Sundays), so a direction can list several last stops that all count.
 *
 * @param {{direction: string}} departure parsed departure
 * @param {string|string[]} direction last stop name part, or several
 * @returns {boolean} true if the departure heads to one of the given last stops
 */
export function matchesDirection(departure, direction) {
    const text = departure.direction.toLowerCase();
    return [direction].flat().some((d) => text.includes(d.toLowerCase()));
}

/**
 * Picks the next departure of a line toward a direction that has not left yet.
 * Cancelled departures before it are returned separately so the UI can mention them.
 *
 * @param {ReturnType<typeof parseDepartures>} departures parsed departures
 * @param {{line: string, direction: string, nowMs: number}} opts selection options
 * @returns {{next: object|null, skipped: object[]}} next departure plus cancelled ones ahead of it
 */
export function selectNext(departures, { line, direction, nowMs }) {
    const candidates = departures
        .filter((d) => d.line === line && matchesDirection(d, direction))
        .map((d) => ({ ...d, effectiveMs: d.actualMs ?? d.plannedMs }))
        .filter((d) => d.effectiveMs >= nowMs)
        .sort((a, b) => a.effectiveMs - b.effectiveMs);
    const next = candidates.find((d) => !d.cancelled) ?? null;
    const skipped = candidates.filter(
        (d) => d.cancelled && (!next || d.effectiveMs < next.effectiveMs)
    );
    return { next, skipped };
}
