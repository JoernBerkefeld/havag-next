import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, distanceMeters, nearestPlaceKey, placeFor, resolvePlaceKey } from '../src/places.js';

test('distanceMeters is zero for the same point and plausible between the two stops', () => {
    assert.equal(distanceMeters(PLACES.home, PLACES.home), 0);
    const d = distanceMeters(PLACES.home, PLACES.kita);
    assert.ok(d > 1000 && d < 2500, `unexpected distance ${d}`);
});

test('distanceMeters is symmetric', () => {
    const a = distanceMeters(PLACES.home, PLACES.kita);
    const b = distanceMeters(PLACES.kita, PLACES.home);
    assert.ok(Math.abs(a - b) < 1e-6);
});

test('nearestPlaceKey picks the closer stop', () => {
    assert.equal(nearestPlaceKey({ lat: PLACES.home.lat, lon: PLACES.home.lon }), 'home');
    assert.equal(nearestPlaceKey({ lat: PLACES.kita.lat, lon: PLACES.kita.lon }), 'kita');
    // 100 m beyond each stop, away from the other one
    assert.equal(nearestPlaceKey({ lat: PLACES.home.lat - 0.001, lon: PLACES.home.lon + 0.001 }), 'home');
    assert.equal(nearestPlaceKey({ lat: PLACES.kita.lat + 0.001, lon: PLACES.kita.lon - 0.001 }), 'kita');
});

test('resolvePlaceKey: manual modes win over the position', () => {
    const atKita = { lat: PLACES.kita.lat, lon: PLACES.kita.lon };
    assert.equal(resolvePlaceKey('home', atKita), 'home');
    assert.equal(resolvePlaceKey('kita', null), 'kita');
});

test('resolvePlaceKey: auto follows the position and falls back to home without one', () => {
    const atKita = { lat: PLACES.kita.lat, lon: PLACES.kita.lon };
    assert.equal(resolvePlaceKey('auto', atKita), 'kita');
    assert.equal(resolvePlaceKey('auto', null), 'home');
});

test('placeFor: at home the chosen direction, at the Kita always the way home', () => {
    assert.equal(placeFor('home', 'kita'), PLACES.home);
    assert.equal(placeFor('home', 'hbf'), PLACES.homeHbf);
    assert.equal(placeFor('kita', 'hbf'), PLACES.kita);
});

test('the way to the station compares the two home stops and their walks', () => {
    const [tenStop, sevenStop] = PLACES.homeHbf.routes;
    assert.deepEqual(
        [tenStop.stopId, tenStop.line, tenStop.direction, tenStop.walkMinutes],
        ['3937', '10', 'Hauptbahnhof', 2]
    );
    assert.deepEqual(
        [sevenStop.stopId, sevenStop.line, sevenStop.direction, sevenStop.walkMinutes],
        ['5095', '7', 'Kröllwitz', 9]
    );
    assert.notEqual(PLACES.homeHbf.key, PLACES.home.key);
});

test('the places point at the right stops, lines and directions', () => {
    assert.deepEqual(
        [PLACES.home.stopId, PLACES.home.line, PLACES.home.direction],
        ['3937', '10', 'Soltauer Str.']
    );
    assert.deepEqual(
        [PLACES.kita.stopId, PLACES.kita.line, PLACES.kita.direction],
        ['5237', '10', 'Hauptbahnhof']
    );
});
