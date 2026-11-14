import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTimestamp } from '../src/api/parse.js';
import { chooseBest, parseArrival, reachableDepartures } from '../src/api/routes.js';

const at = (hhmm) => toTimestamp('20261114', `${hhmm}00`, 60);

const dep = (line, direction, planned, real = null, extra = {}) => ({
    line,
    direction,
    plannedMs: at(planned),
    actualMs: real ? at(real) : null,
    cancelled: false,
    ...extra,
});

const TEN = { stopId: '3937', line: '10', direction: 'Hauptbahnhof', walkMinutes: 2 };
const SEVEN = { stopId: '5095', line: '7', direction: 'Kröllwitz', walkMinutes: 7 };

test('reachableDepartures drops trams that leave before the walk is done', () => {
    const now = at('1300') + 30_000; // 13:00:30
    const departures = [
        dep('7', 'Halle (Saale), Kröllwitz', '1306'), // 6 min: too soon for a 7 min walk
        dep('7', 'Halle (Saale), Kröllwitz', '1307'),
        dep('7', 'Halle (Saale), Büschdorf', '1308'), // wrong direction
        dep('10', 'Halle (Saale), Hauptbahnhof (Tram/Bus)', '1302'),
    ];
    assert.deepEqual(
        reachableDepartures(departures, SEVEN, now).map((d) => d.plannedMs),
        [at('1307')]
    );
    assert.equal(reachableDepartures(departures, TEN, now).length, 1);
});

test('reachableDepartures judges by the predicted time and skips cancelled trams', () => {
    const now = at('1300');
    const departures = [
        dep('10', 'Hauptbahnhof', '1301', '1305'), // planned too early, but late enough
        dep('10', 'Hauptbahnhof', '1310', null, { cancelled: true }),
        dep('10', 'Hauptbahnhof', '1312'),
    ];
    assert.deepEqual(
        reachableDepartures(departures, TEN, now).map((d) => d.effectiveMs),
        [at('1305'), at('1312')]
    );
});

test('reachableDepartures keeps only the next two per route', () => {
    const departures = ['1310', '1320', '1330'].map((t) => dep('10', 'Hauptbahnhof', t));
    assert.equal(reachableDepartures(departures, TEN, at('1300')).length, 2);
});

test('chooseBest takes the earliest arrival, not the earliest departure', () => {
    const slowEarly = { route: TEN, effectiveMs: at('1330'), arrivalMs: at('1344') };
    const fastLate = { route: SEVEN, effectiveMs: at('1332'), arrivalMs: at('1338') };
    const { best, alternative } = chooseBest([slowEarly, fastLate]);
    assert.equal(best, fastLate);
    assert.equal(alternative, slowEarly);
});

test('chooseBest: ties go to the earlier departure, unknown arrivals rank last', () => {
    const a = { route: TEN, effectiveMs: at('1330'), arrivalMs: at('1340') };
    const b = { route: SEVEN, effectiveMs: at('1335'), arrivalMs: at('1340') };
    const c = { route: SEVEN, effectiveMs: at('1325'), arrivalMs: null };
    assert.equal(chooseBest([b, a]).best, a);
    assert.equal(chooseBest([c, b]).best, b);
    assert.equal(chooseBest([c]).best, c);
});

test('chooseBest: no options, and no alternative when only one route has options', () => {
    assert.deepEqual(chooseBest([]), { best: null, alternative: null });
    const a = { route: TEN, effectiveMs: at('1330'), arrivalMs: at('1340') };
    const b = { route: TEN, effectiveMs: at('1350'), arrivalMs: at('1400') };
    assert.equal(chooseBest([a, b]).alternative, null);
});

const journey = (stops) => ({
    err: 'OK',
    svcResL: [
        {
            err: 'OK',
            res: {
                common: {
                    locL: [
                        { name: 'Halle (Saale), Freiimfelder Str.', lid: 'A=1@L=5095@' },
                        { name: 'Halle (Saale), Riebeckplatz', lid: 'A=1@L=1@' },
                        { name: 'Halle (Saale), Hauptbahnhof (Tram/Bus)', lid: 'A=1@L=2@' },
                    ],
                },
                journey: { date: '20261114', stopL: stops },
            },
        },
    ],
});

test('parseArrival returns the predicted arrival at the destination after the boarding stop', () => {
    const raw = journey([
        { locX: 2, aTimeS: '125500', aTimeR: '125500' }, // earlier visit of the station: ignored
        { locX: 0, dTimeS: '130000' },
        { locX: 1, aTimeS: '130100', aTimeR: '130100' },
        { locX: 2, aTimeS: '130200', aTimeR: '130400', aTZOffset: 60 },
    ]);
    assert.equal(parseArrival(raw, { stopId: '5095', destination: 'Hauptbahnhof' }), at('1304'));
});

test('parseArrival uses the planned time without realtime data', () => {
    const raw = journey([
        { locX: 0, dTimeS: '130000' },
        { locX: 2, aTimeS: '130200' },
    ]);
    assert.equal(parseArrival(raw, { stopId: '5095', destination: 'Hauptbahnhof' }), at('1302'));
});

test('parseArrival returns null for errors and when the destination is not on the way', () => {
    const noStation = journey([{ locX: 0, dTimeS: '130000' }, { locX: 1, aTimeS: '130100' }]);
    assert.equal(parseArrival(noStation, { stopId: '5095', destination: 'Hauptbahnhof' }), null);
    assert.equal(parseArrival({ err: 'FAIL' }, { stopId: '5095', destination: 'x' }), null);
});
