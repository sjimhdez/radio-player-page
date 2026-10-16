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

R6 (Node versions and build reproducibility) has no code: the commands are in the report.
