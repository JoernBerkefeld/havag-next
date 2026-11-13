import { useEffect, useState } from 'react';

const STORAGE_KEY = 'installBannerDismissed';
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function wasDismissed() {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * Install hint, shown once per session until dismissed or installed.
 * iOS Safari has no install event, so it gets "Share > Add to Home Screen" guidance
 * (same idea as on sfmc.guide / ssjs.guide). Chrome on Android gets a real install button.
 */
export default function InstallBanner() {
    const [dismissed, setDismissed] = useState(wasDismissed);
    const [installed, setInstalled] = useState(isStandalone);
    const [promptEvent, setPromptEvent] = useState(null);

    useEffect(() => {
        const onPrompt = (e) => {
            e.preventDefault();
            setPromptEvent(e);
        };
        const onInstalled = () => setInstalled(true);
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const dismiss = () => {
        setDismissed(true);
        try {
            sessionStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // storage unavailable: the banner just reappears next time
        }
    };

    const install = async () => {
        if (!promptEvent) return;
        promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
    };

    if (installed || dismissed || (!isIos && !promptEvent)) return null;

    return (
        <div
            role="status"
            className="fixed bottom-4 left-1/2 z-10 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-200"
        >
            {promptEvent ? (
                <>
                    <span className="flex-1">Als App installieren</span>
                    <button
                        type="button"
                        onClick={install}
                        className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white"
                    >
                        Installieren
                    </button>
                </>
            ) : (
                <span className="flex-1">
                    Tippe auf <strong>Teilen</strong>, dann auf{' '}
                    <strong>Zum Home-Bildschirm</strong>, um die App zu installieren
                </span>
            )}
            <button type="button" onClick={dismiss} aria-label="Schließen" className="p-1 text-gray-400">
                ✕
            </button>
        </div>
    );
}
