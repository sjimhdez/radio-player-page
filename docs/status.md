# Estado
Spec activa: 0006 — Refactor del player · Fase: cerrada (1–3, el 2026-10-21; A9 aprobado; PR #40 listo, pendiente de merge en `trunk`) · Plan: [`phase-3.md`](specs/0006-player-refactor/phase-3.md) · Actualizado: 2026-10-21

## En curso
- Spec 0006 (Refactor del player) cerrada el 2026-10-21: fases 1, 2 y 3 ([`spec.md`](specs/0006-player-refactor/spec.md)). El usuario aprobó la revisión visual (A9) el 2026-10-21. PR #40 listo; el merge espera a la CI en verde sin reintentos en `sleep.spec.ts` (3.12).

## Siguiente (máx. 5)
1. Tras el merge de la 0006: sesión de diseño → `write-spec` de la 0007 (correcciones de reproducción), que arranca la pista del player (`docs/specs/README.md`).
2. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrigen y en qué spec dos rarezas bajas: K76 (`completeTimeFields` sin uso; propuesta: 0010 admin) y K79 (la migración heredada pierde `is_rerun` de las franjas, que el refactor conserva; propuesta: 0008 migración).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.
- K18: en Safari (macOS e iOS), Pausa + Play de un directo MP3 se congela? (medido solo en el WebKit de Playwright en macOS, tareas 2.7 y 2.21; en la CI, WebKitGTK, no pasa).

## Desviaciones de la spec activa (→ ADR)
Las de la 0006, ya cerrada, y las de las specs anteriores están en [`deviations.md`](deviations.md).
