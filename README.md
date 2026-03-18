# Work Journal

A beautiful, privacy-first PWA for tracking work hours and earnings across multiple jobs — all in a single file, no backend required.

## Features

- **Multi-job tracking** — log sessions across up to 4 jobs simultaneously
- **Multi-currency support** — each job can have its own currency; Overview shows stacked totals per currency
- **Live rate conversion** — tap "Convert" to collapse all earnings into one primary currency using live exchange rates (cached 24h, manual refresh available)
- **PIN app lock** — optional 4-digit PIN that activates after 3 minutes away
- **Swipe navigation** — swipe left/right to move between Overview and job tabs
- **Milestones & celebrations** — confetti + toast notifications at hours and earnings milestones
- **Session auto-hide** — recent sessions disappear from the dashboard after 30 seconds; always available in All Sessions
- **Light / dark mode**
- **Offline-ready** — service worker caches the app for offline use
- **Zero dependencies** — one HTML file, vanilla JS/CSS

## Tech

- Vanilla HTML / CSS / JavaScript
- `localStorage` for all persistence (key: `wj3`)
- Exchange rates: [fawazahmed0 Currency API](https://github.com/fawazahmed0/exchange-api) (primary) · [open.er-api.com](https://open.er-api.com) (fallback)
- Fonts: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) · [Fraunces](https://fonts.google.com/specimen/Fraunces)
- PWA: `manifest.json` + service worker (`sw.js`)

## Getting Started

Just open `index.html` in a browser — or deploy anywhere that can serve a static file.

1. Enter your name
2. Add your first job with its currency and hourly rate
3. Start logging sessions

## Deployment

Deployed on Vercel — push to `main` and it goes live automatically.

## License

MIT
