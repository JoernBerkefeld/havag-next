import { useState } from 'react';

const STORAGE_KEY = 'installBannerDismissed';
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

function wasDismissed() {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

/**
 * iOS "Add to Home Screen" hint, shown once per session (same idea as on sfmc.guide and
 * ssjs.guide). iOS Safari has no install event. Chrome on Android shows its own native
 * install prompt, so nothing here touches `beforeinstallprompt` (calling preventDefault on it
 * would suppress that prompt).
 */
export default function InstallBanner() {
    const [dismissed, setDismissed] = useState(wasDismissed);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    if (!isIos || standalone || dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        try {
            sessionStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // storage unavailable: the hint just reappears next time
        }
    };

    return (
        <div
            role="status"
            className="fixed bottom-4 left-1/2 z-10 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-200"
        >
            <span className="flex-1">
                Tippe auf <strong>Teilen</strong>, dann auf <strong>Zum Home-Bildschirm</strong>, um
                die App zu installieren
            </span>
            <button type="button" onClick={dismiss} aria-label="Schließen" className="p-1 text-gray-400">
                ✕
            </button>
        </div>
    );
}
