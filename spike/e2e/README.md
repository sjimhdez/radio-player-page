# spike/e2e — R3

Plays the **real** `player/dist` build (no WordPress) against local media servers.

```bash
npm install && npx playwright install chromium webkit
npm run media            # ffmpeg: 60 s tone as MP3, HLS (AAC/TS) and DASH (AAC/fMP4) into media/
npx playwright test      # starts server.mjs: page :8900, media with CORS :8901, without CORS :8902
NO_AUTOPLAY_FLAG=1 npx playwright test --project=chromium   # without --autoplay-policy

# Linux (same image family as CI)
docker run --rm --ipc=host -v "$PWD/../..":/repo -w /repo/spike/e2e \
  mcr.microsoft.com/playwright:v1.64.1-noble npx playwright test
```
