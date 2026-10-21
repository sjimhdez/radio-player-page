# spike/0007-playback — spec 0007, phase 0

Throwaway measurements for risks R1 (C1 and the visualizer), R2 (K67) and R3 (K18) of
`docs/specs/0007-playback-fixes/spec.md`. Findings go to `docs/spikes/0007-phase-0.md`.
Nothing here ships (the release zip uses an include list) and nothing is reused by phase 1.

No WordPress and no player build: `harness.html` + `harness.js` drive a bare `<audio>` (and
`hls.js` / `dashjs`, served from `player/node_modules`, the same versions as the player) through
`window.spike`, one function per measurement.

```bash
npm install && npx playwright install chromium webkit   # once (player/node_modules must exist)
npx playwright test                                     # starts server.mjs; Chromium + WebKit
NO_AUTOPLAY_FLAG=1 npx playwright test --project=chromium   # Chromium without --autoplay-policy
npm run serve                                           # just the servers, to open the pages by hand
```

## Servers (`server.mjs`)

| Port | What |
|---|---|
| 8910 | Page: `/` (harness), `/manual.html`, `/vendor/hls.js`, `/vendor/dash.js` |
| 8911 | Media **with** `Access-Control-Allow-Origin: *` |
| 8912 | Media **without** CORS headers |

The media origins serve `tests/fixtures/audio/` (not copied: `/tone.mp3`, `/hls/index.m3u8`,
`/dash/manifest.mpd`…) plus:

- `/live.mp3`: endless, Icecast-like (no length, no Range).
- `/404.mp3`: 404.
- `/live.mpd`: live DASH (`type="dynamic"`) without `<UTCTiming>`, looping the four fixture
  segments with their `tfdt` rewritten (`/live/seg-<t>.m4s`, 404 until the segment is complete,
  counted as `404 /live/` in `/__requests`).
- `?exposeDate=1` on any route adds `Date` to `Access-Control-Expose-Headers`.
- `GET /__requests` (`DELETE` resets): requests of that origin by path and query.

The tests abort and record every request that leaves `localhost` (`tests/helpers.ts`).
