// The two places the app can show. Coordinates are those of the public tram stops (INSA stop
// data), not of any address.
export const PLACES = {
    home: {
        key: 'home',
        label: 'Zuhause',
        stopId: '3937', // Halle (Saale), Betriebshof Freiimfelder Str.
        line: '10',
        direction: 'Soltauer Str.',
        heading: 'Linie 10 → Soltauer Str.',
        lat: 51.484827,
        lon: 11.994756,
    },
    kita: {
        key: 'kita',
        label: 'Kita',
        stopId: '5237', // Halle (Saale), Am Steintor
        line: '10',
        direction: 'Hauptbahnhof',
        heading: 'Linie 10 → nach Hause',
        lat: 51.488198,
        lon: 11.97809,
    },
};

export const MODES = ['auto', 'home', 'kita'];

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance (haversine).
 *
 * @param {{lat: number, lon: number}} a first point
 * @param {{lat: number, lon: number}} b second point
 * @returns {number} distance in metres
 */
export function distanceMeters(a, b) {
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * @param {{lat: number, lon: number}} position current position
 * @returns {'home'|'kita'} the place whose stop is nearest
 */
export function nearestPlaceKey(position) {
    return distanceMeters(position, PLACES.home) <= distanceMeters(position, PLACES.kita)
        ? 'home'
        : 'kita';
}

/**
 * @param {string} mode 'auto', 'home' or 'kita'
 * @param {{lat: number, lon: number}|null} position current position, if known
 * @returns {'home'|'kita'} the place to show. Auto without a position falls back to home.
 */
export function resolvePlaceKey(mode, position) {
    if (mode === 'home' || mode === 'kita') return mode;
    return position ? nearestPlaceKey(position) : 'home';
}
