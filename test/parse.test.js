import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDepartures, selectNext, toTimestamp } from '../src/api/parse.js';
import { delayMinutes, formatClock, formatCountdown } from '../src/format.js';
import { buildRequest } from '../src/api/havag.js';

const DIR_SOLTAUER = 'Halle (Saale), Soltauer Str.';
const DIR_HBF = 'Halle (Saale), Hauptbahnhof (Tram/Bus)';

const jny = (prodX, dirTxt, planned, real, extra = {}) => ({
    date: '20261113',
    prodX,
    dirTxt,
    stbStop: { dTimeS: planned, ...(real ? { dTimeR: real } : {}), dTZOffset: 60, ...extra },
});

const raw = (jnyL) => ({
    err: 'OK',
    svcResL: [
        {
            err: 'OK',
            res: { common: { prodL: [{ nameS: '10' }, { nameS: '21' }] }, jnyL },
        },
    ],
});

// 2026-11-13 09:30:00 Berlin (CET, UTC+1) = 08:30:00 UTC
const now = Date.UTC(2026, 10, 13, 8, 30, 0);
const opts = { line: '10', direction: 'Soltauer Str.', nowMs: now };

test('toTimestamp converts Berlin local time to epoch ms', () => {
    assert.equal(toTimestamp('20261113', '093800', 60), Date.UTC(2026, 10, 13, 8, 38, 0));
});

test('toTimestamp handles the day offset prefix', () => {
    assert.equal(toTimestamp('20261113', '01000500', 60), Date.UTC(2026, 10, 13, 23, 5, 0));
});

test('parseDepartures reads line, direction, planned and realtime', () => {
    const [d] = parseDepartures(raw([jny(0, DIR_SOLTAUER, '093800', '093900')]));
    assert.equal(d.line, '10');
    assert.equal(d.direction, DIR_SOLTAUER);
    assert.equal(d.plannedMs, Date.UTC(2026, 10, 13, 8, 38));
    assert.equal(d.actualMs, Date.UTC(2026, 10, 13, 8, 39));
    assert.equal(d.cancelled, false);
});

test('parseDepartures throws on an API error', () => {
    assert.throws(() => parseDepartures({ err: 'OK', svcResL: [{ err: 'PARSE' }] }), /HAFAS error/);
    assert.throws(() => parseDepartures({ err: 'AUTH' }), /HAFAS error/);
});

test('selects the first upcoming line 10 toward Soltauer Str.', () => {
    const deps = parseDepartures(
        raw([
            jny(0, DIR_HBF, '093100', '093000'),
            jny(1, DIR_SOLTAUER, '093200', '093200'),
            jny(0, DIR_SOLTAUER, '093800', '093900'),
            jny(0, DIR_SOLTAUER, '095300', '095300'),
        ])
    );
    const { next, skipped } = selectNext(deps, opts);
    assert.equal(next.plannedMs, Date.UTC(2026, 10, 13, 8, 38));
    assert.equal(next.actualMs, Date.UTC(2026, 10, 13, 8, 39));
    assert.deepEqual(skipped, []);
});

test('a departure whose prediction is already in the past is dropped', () => {
    const deps = parseDepartures(
        raw([jny(0, DIR_SOLTAUER, '092800', '092900'), jny(0, DIR_SOLTAUER, '093800', '093800')])
    );
    assert.equal(selectNext(deps, opts).next.plannedMs, Date.UTC(2026, 10, 13, 8, 38));
});

test('a late tram that is planned in the past but not yet gone is still shown', () => {
    const deps = parseDepartures(raw([jny(0, DIR_SOLTAUER, '092800', '093200')]));
    assert.equal(selectNext(deps, opts).next.actualMs, Date.UTC(2026, 10, 13, 8, 32));
});

test('cancelled departure ahead is skipped and reported', () => {
    const deps = parseDepartures(
        raw([
            jny(0, DIR_SOLTAUER, '093800', null, { dCncl: true }),
            jny(0, DIR_SOLTAUER, '095300', '095300'),
        ])
    );
    const { next, skipped } = selectNext(deps, opts);
    assert.equal(next.plannedMs, Date.UTC(2026, 10, 13, 8, 53));
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].cancelled, true);
});

test('no realtime data falls back to the planned time', () => {
    const deps = parseDepartures(raw([jny(0, DIR_SOLTAUER, '093800', null)]));
    const { next } = selectNext(deps, opts);
    assert.equal(next.actualMs, null);
    assert.equal(next.effectiveMs, Date.UTC(2026, 10, 13, 8, 38));
    assert.equal(delayMinutes(next.plannedMs, next.actualMs), null);
});

test('returns no departure when nothing matches', () => {
    const deps = parseDepartures(raw([jny(1, DIR_SOLTAUER, '093800', '093800')]));
    assert.equal(selectNext(deps, opts).next, null);
    assert.equal(selectNext([], opts).next, null);
});

test('delayMinutes rounds and allows early trams', () => {
    assert.equal(delayMinutes(0, 89_000), 1);
    assert.equal(delayMinutes(0, 29_000), 0);
    assert.equal(delayMinutes(60_000, 0), -1);
});

test('formatCountdown', () => {
    assert.equal(formatCountdown(7 * 60_000 + 23_000), 'in 7 min');
    assert.equal(formatCountdown(119_999), 'in 1 min');
    assert.equal(formatCountdown(60_000), 'in 1 min');
    assert.equal(formatCountdown(59_999), 'sofort');
    assert.equal(formatCountdown(0), 'sofort');
    assert.equal(formatCountdown(-1000), 'sofort');
});

test('formatClock uses Halle time', () => {
    assert.equal(formatClock(Date.UTC(2026, 10, 13, 8, 38)), '09:38');
    assert.equal(formatClock(Date.UTC(2026, 6, 13, 8, 38)), '10:38'); // summer time
});

test('buildRequest uses Halle date/time and the stop id', () => {
    const body = JSON.parse(buildRequest(new Date(Date.UTC(2026, 10, 13, 8, 30, 5))));
    const req = body.svcReqL[0].req;
    assert.equal(req.date, '20261113');
    assert.equal(req.time, '093005');
    assert.equal(req.stbLoc.extId, '3937');
});
