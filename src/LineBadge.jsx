// Line colors as the local transport service shows them. Other lines fall back to grey.
const LINE_COLORS = { 10: '#066f08', 7: '#fe3f9a' };

/**
 * A tram icon followed by the line number on its line color, like the transport app.
 *
 * @param {{line: string}} props the line name
 * @returns {import('react').ReactElement} the badge
 */
export default function LineBadge({ line }) {
    return (
        <span className="inline-flex items-center gap-2" aria-label={`Linie ${line}`}>
            <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="5" y="6" width="14" height="12" rx="3" />
                <path d="M5 12h14M9 21l1.5-3M15 21l-1.5-3M9 3h6M12 3v3" />
                <circle cx="9" cy="15" r=".6" />
                <circle cx="15" cy="15" r=".6" />
            </svg>
            <span
                className="inline-flex h-9 min-w-11 items-center justify-center rounded-lg px-3 text-2xl font-semibold text-white"
                style={{ backgroundColor: LINE_COLORS[line] ?? '#4b5563' }}
            >
                {line}
            </span>
        </span>
    );
}
