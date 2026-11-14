import { Component } from 'react';
import { canAutoReload } from './autoReload.js';

/**
 * Catches a crash while rendering. Without it React unmounts the whole app and the screen stays
 * empty. It reloads once automatically, and if the crash comes back shows a message with a
 * reload button instead.
 */
export default class ErrorBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error(error);
        if (canAutoReload('crashReloadAt')) window.location.reload();
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <main className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center text-white">
                <p className="text-2xl text-gray-300">Etwas ist schiefgelaufen.</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-full bg-gray-700 px-6 py-3 text-lg font-medium"
                >
                    Neu laden
                </button>
                <p className="text-xs text-gray-600">Code: crash</p>
            </main>
        );
    }
}
