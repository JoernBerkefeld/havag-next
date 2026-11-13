import { useEffect, useState } from 'react';
import { MODES, PLACES, resolvePlaceKey } from './places.js';

const STORAGE_KEY = 'placeMode';
const LOCATION_REFRESH_MS = 30_000;

function readMode() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return MODES.includes(stored) ? stored : 'auto';
    } catch {
        return 'auto';
    }
}

/**
 * Decides which place to show. In "auto" mode it follows the phone's location (nearest of the
 * two stops) and refreshes it while the page is visible. "home" and "kita" are manual overrides
 * that are remembered between visits.
 */
export function usePlace() {
    const [mode, setModeState] = useState(readMode);
    const [position, setPosition] = useState(null);
    const [locationFailed, setLocationFailed] = useState(false);

    const setMode = (next) => {
        setModeState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // storage unavailable: the choice just is not remembered
        }
    };

    useEffect(() => {
        if (mode !== 'auto') return undefined;
        if (!('geolocation' in navigator)) {
            setLocationFailed(true);
            return undefined;
        }
        let timer;
        const update = () =>
            navigator.geolocation.getCurrentPosition(
                (p) => {
                    setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
                    setLocationFailed(false);
                },
                () => setLocationFailed(true),
                { maximumAge: LOCATION_REFRESH_MS, timeout: 10_000 }
            );
        const start = () => {
            update();
            clearInterval(timer);
            timer = setInterval(update, LOCATION_REFRESH_MS);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') start();
            else clearInterval(timer);
        };
        start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [mode]);

    const placeKey = resolvePlaceKey(mode, position);
    return {
        mode,
        setMode,
        place: PLACES[placeKey],
        hasPosition: position !== null,
        locationFailed,
    };
}
