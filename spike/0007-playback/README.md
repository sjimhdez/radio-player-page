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
AUTOPLAY_POLICY=user-gesture-required npx playwright test --project=chromium   # Chromium, strict autoplay
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

- `/live.mp3`: endless, Icecast-like (the audio frames of `tone.mp3` in a loop: no ID3, no Info frame,
  no length, no Range).
- `/live-tagged.mp3`: endless, as `tests/e2e/media-server.mjs` (the whole `tone.mp3` in a loop, ID3 and
  Info frame included; WebKit on macOS stops at the 8.05 s the Info frame declares).
- `/404.mp3`: 404.
- `/frames.mp3`: finite, `tone.mp3`'s audio frames alone (no ID3, no Info frame), with length and Range.
- `?chunked=1` on files and `/frames.mp3`: no `Content-Length`, no `Accept-Ranges`, Range ignored.
- `/live.mpd`: live DASH (`type="dynamic"`) without `<UTCTiming>`, looping the four fixture
  segments with their `tfdt` rewritten (`/live/seg-<t>.m4s`, 404 until the segment is complete,
  counted as `404 /live/` in `/__requests`).
- `?exposeDate=1` on any route adds `Date` to `Access-Control-Expose-Headers`.
- `GET /__requests` (`DELETE` resets): requests of that origin by path and query.

The tests abort and record every request that leaves `localhost` (`tests/helpers.ts`).

`page.evaluate()` runs with a user gesture in Chromium and WebKit, so it gives the page user
activation. Cases that need a page without activation (or with only a real click) are driven by the
harness itself on load (`/?auto=context[&click=1&delay=ms]`) and report through `console.log`.
