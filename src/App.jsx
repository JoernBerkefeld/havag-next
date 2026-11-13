import { useCallback, useEffect, useRef, useState } from 'react';
import { DIRECTION, LINE, fetchNext } from './api/havag.js';
import { delayMinutes, formatClock, formatClockSeconds, formatCountdown } from './format.js';

const REFRESH_MS = 30_000;

export default function App() {
    const [data, setData] = useState(null); // { next, skipped, fetchedAt }
    const [error, setError] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const controller = useRef(null);

    const load = useCallback(async () => {
        controller.current?.abort();
        const ctrl = new AbortController();
        controller.current = ctrl;
        try {
            const result = await fetchNext(ctrl.signal);
            setData({ ...result, fetchedAt: Date.now() });
            setError(false);
        } catch (e) {
            if (e.name !== 'AbortError') setError(true);
        }
    }, []);

    // Refresh on open, every 30 s while visible, and when the app returns to the foreground.
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

    const next = data?.next;
    const effectiveMs = next ? (next.actualMs ?? next.plannedMs) : null;
    const delay = next ? delayMinutes(next.plannedMs, next.actualMs) : null;

    return (
        <main className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center text-white select-none">
            <h1 className="text-xl font-semibold tracking-wide text-gray-400">
                Linie {LINE} → {DIRECTION}
            </h1>

            {!data && !error && <p className="text-2xl text-gray-400">Lade …</p>}
            {!data && error && <p className="text-2xl text-red-400">Keine Verbindung</p>}

            {data && !next && <p className="text-3xl text-gray-300">Keine Abfahrt gefunden</p>}

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
                </>
            )}

            {data?.skipped.length > 0 && (
                <p className="text-lg text-red-400">
                    {data.skipped.map((d) => `${formatClock(d.plannedMs)} fällt aus`).join(' · ')}
                </p>
            )}

            {data && error && (
                <p className="text-lg text-amber-400">
                    Keine Verbindung · Stand {formatClockSeconds(data.fetchedAt)}
                </p>
            )}
        </main>
    );
}
