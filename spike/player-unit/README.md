# spike/player-unit — R4

Vitest + Testing Library on `player/src/hooks/use-audio-player.tsx`, with a FakeAudioElement
(`fake-audio.ts`) and `vi.mock('hls.js')` / `vi.mock('dashjs')` for the dynamic imports.

`run.sh` creates a throwaway git worktree, installs the tools into its `player/` with
`--no-save`, copies the tests to `player/src/__spike__/` and runs them. The real
`player/package.json` is never touched; the worktree is removed on exit.

```bash
./run.sh                 # happy-dom and jsdom
./run.sh happy-dom
MUTATE=1 ./run.sh        # removes every crossOrigin assignment: 2 tests must fail
```
