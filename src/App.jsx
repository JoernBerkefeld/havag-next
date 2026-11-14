import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNext } from './api/havag.js';
import InstallBanner from './InstallBanner.jsx';
import LineBadge from './LineBadge.jsx';
import { delayMinutes, formatClock, formatClockSeconds, formatCountdown } from './format.js';
import { HOME_DIRECTIONS, MODES } from './places.js';
import { usePlace } from './usePlace.js';

const REFRESH_MS = 30_000;
const MODE_LABELS = { auto: 'Auto', home: 'Zuhause', kita: 'Kita' };
const DIRECTION_LABELS = { kita: 'Kita', hbf: 'Hauptbahnhof' };

export default function App() {
    const { mode, setMode, placeKey, place, homeDirection, setHomeDirection, hasPosition, locationFailed } =
        usePlace();
    const [data, setData] = useState(null); // { next, skipped, fetchedAt, placeKey }
    const [error, setError] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const controller = useRef(null);

    const load = useCallback(async () => {
        controller.current?.abort();
        const ctrl = new AbortController();
        controller.current = ctrl;
        try {
            const result = await fetchNext(place, ctrl.signal);
            setData({ ...result, fetchedAt: Date.now(), placeKey: place.key });
            setError(false);
        } catch (e) {
            if (e.name !== 'AbortError') setError(true);
        }
    }, [place]);

    // Refresh on open, whenever the place changes, every 30 s while visible, and when the app
    // returns to the foreground.
    useEffect(() => {
        let timer;
        const start = () => {
            load();
            clearInterval(timer);
            timer = setInterval(load, REFRESH_MS);
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
            controller.current?.abort();
        };
    }, [load]);

    // Local tick for the countdown.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // Never show data that belongs to the other place while the new one loads.
    const view = data?.placeKey === place.key ? data : null;
    const next = view?.next;
    const effectiveMs = next ? (next.actualMs ?? next.plannedMs) : null;
    const delay = next ? delayMinutes(next.plannedMs, next.actualMs) : null;

    let modeHint = null;
    if (mode === 'auto') {
        modeHint = hasPosition
            ? `automatisch: ${place.label}`
            : locationFailed
              ? 'Standort nicht verfügbar · zeige Zuhause'
              : 'Standort wird ermittelt …';
    }

    return (
        <main className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center text-white select-none">
            <div className="flex flex-col items-center gap-2">
                <div
                    role="group"
                    aria-label="Ort"
                    className="flex gap-1 rounded-full bg-gray-900 p-1 text-sm"
                >
                    {MODES.map((m) => (
                        <button
                            key={m}
                            type="button"
                            aria-pressed={mode === m}
                            onClick={() => setMode(m)}
                            className={`rounded-full px-4 py-1.5 font-medium ${
                                mode === m ? 'bg-gray-700 text-white' : 'text-gray-500'
                            }`}
                        >
                            {MODE_LABELS[m]}
                        </button>
                    ))}
                </div>
                <p className="h-4 text-xs text-gray-500">{modeHint}</p>
            </div>

            <h1 className="text-xl font-semibold tracking-wide text-gray-400">
                {next?.route ? (
                    <span className="inline-flex items-center gap-3">
                        <LineBadge line={next.line} />
                        <span>→ {place.destination}</span>
                    </span>
                ) : (
                    place.heading
                )}
            </h1>

            {!view && !error && <p className="text-2xl text-gray-400">Lade …</p>}
            {!view && error && <p className="text-2xl text-red-400">Fahrplan nicht abrufbar</p>}

            {view && !next && <p className="text-3xl text-gray-300">Keine Abfahrt gefunden</p>}

            {next && (
                <>
                    <div
                        className="leading-none font-bold tabular-nums"
                        style={{ fontSize: 'clamp(5rem, 30vw, 12rem)' }}
                    >
                        {formatClock(effectiveMs)}
                    </div>
                    <div className="text-5xl font-semibold text-gray-100 tabular-nums">
                        {formatCountdown(effectiveMs - now)}
                    </div>
                    <div className="text-2xl">
                        {delay == null && (
                            <span className="text-gray-400">
                                geplant {formatClock(next.plannedMs)} · keine Echtzeitdaten
                            </span>
                        )}
                        {delay != null && delay <= 0 && (
                            <span className="text-green-400">pünktlich</span>
                        )}
                        {delay != null && delay > 0 && (
                            <span className="text-amber-400">
                                +{delay} min · geplant {formatClock(next.plannedMs)}
                            </span>
                        )}
                    </div>
                    {next.route && (
                        <div className="flex flex-col gap-1 text-lg text-gray-300">
                            <p>
                                ab {next.route.stopName} · losgehen{' '}
                                {formatCountdown(
                                    effectiveMs - next.route.walkMinutes * 60_000 - now
                                )}
                            </p>
                            {next.arrivalMs && (
                                <p className="text-gray-400">
                                    Ankunft {place.destination} {formatClock(next.arrivalMs)}
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}

            {view?.alternative && (
                <p className="text-base text-gray-500">
                    Alternativ: Linie {view.alternative.line} ab{' '}
                    {formatClock(view.alternative.effectiveMs)} ({view.alternative.route.stopName}
                    {view.alternative.arrivalMs
                        ? `, Ankunft ${formatClock(view.alternative.arrivalMs)}`
                        : ''}
                    )
                </p>
            )}

            {view?.skipped.length > 0 && (
                <p className="text-lg text-red-400">
                    {view.skipped.map((d) => `${formatClock(d.plannedMs)} fällt aus`).join(' · ')}
                </p>
            )}

            {view && error && (
                <p className="text-lg text-amber-400">
                    Fahrplan nicht abrufbar · Stand {formatClockSeconds(view.fetchedAt)}
                </p>
            )}

            <div className="h-9">
                {placeKey === 'home' && (
                    <div
                        role="group"
                        aria-label="Richtung"
                        className="flex gap-1 rounded-full bg-gray-900 p-1 text-sm"
                    >
                        {HOME_DIRECTIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                aria-pressed={homeDirection === d}
                                onClick={() => setHomeDirection(d)}
                                className={`rounded-full px-4 py-1.5 font-medium ${
                                    homeDirection === d
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-500'
                                }`}
                            >
                                {DIRECTION_LABELS[d]}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <InstallBanner />
        </main>
    );
}
