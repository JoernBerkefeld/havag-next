# havag-next

Personal full-screen PWA that shows only the next HAVAG **line 10** departure toward **Soltauer Str.** from Halle (Saale), Betriebshof Freiimfelder Str.: the actual time in large type, a live countdown, and the delay or cancellation.

Live at: **https://joernberkefeld.github.io/havag-next/**

## How it works

- The browser calls the public INSA (Sachsen-Anhalt) HAFAS endpoint directly. No server, no key to keep secret.
- Data is never cached: every request uses `cache: 'no-store'`, and the service worker only handles the app shell, never the data call.
- It refreshes on open, every 30 seconds while visible, and when the app returns to the foreground. The countdown ticks locally every second.
- The request body is sent as `text/plain` on purpose. The endpoint allows cross-origin requests but not the preflight a JSON content type would trigger.

The endpoint is unofficial. If it ever stops allowing browser calls, the page shows "Keine Verbindung".

## Install on Android

Open the URL in Chrome, then menu > **Install app** (or **Add to Home screen**).

## Other stop or line

The stop ID, line and direction are constants in `src/api/havag.js`.

## Development

```bash
npm install --no-workspaces
npm run dev
npm test
npm run lint
```

Built with Vite + React + Tailwind CSS v4. Pushing to `main` deploys to GitHub Pages through GitHub Actions.
