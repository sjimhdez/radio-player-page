# Spike — spec 0001, phase 0 (throwaway)

Throwaway prototypes that answer risks R1–R7 of `docs/specs/0001-bootstrap/spec.md`.
Findings live in `docs/spikes/0001-phase-0.md`. Nothing here ships in the release zip
(`scripts/build-release-zip.sh` uses an include list) and nothing here is reused by phase 1.

Each folder is independent and has its own dependencies:

| Folder | Risk | How to run |
|---|---|---|
| `php/` | R1, R5, R7 | see `php/README.md` |
| `clean-page/` | R2 | see `clean-page/README.md` |
| `e2e/` | R3 | see `e2e/README.md` |
| `player-unit/` | R4 | see `player-unit/README.md` |
| `node/` | R6 | `./node/check-builds.sh 26.12.0 24.22.0 22.23.3 20.19.2` |
| `php/env-zip/` | R6 (wp-env + remote plugin zip) | `npx @wordpress/env@11.17.0 start` with Node 26 |
