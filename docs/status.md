# Estado
Spec activa: 0007 — Correcciones: reproducción · Fase: 0 (spike) por planificar · Plan: — · Actualizado: 2026-10-21

## En curso
- Spec 0007 (Correcciones: reproducción) escrita el 2026-10-21 ([`spec.md`](specs/0007-playback-fixes/spec.md)), rama `spec/0007-playback-fixes` sin push. La fase 0 es un spike: C1 con los visualizadores (decisión del usuario: medir antes de decidir), `dashjs` sin fuente de hora (K67) y K18 en Safari real.
- ADR 0031 (2026-10-21): la decisión visualizador / animación estática se rehace en la 0007. La decide el núcleo según la fuente; `use-can-visualize.tsx` y `use-audio-visualizer.tsx` salen de la zona congelada. El spike (R1) mide lo que falta.
- Spec 0006 (Refactor del player) cerrada y fusionada en `trunk` (PR #40, 2026-10-21).

## Siguiente (máx. 5)
1. Sesión nueva → `start-phase` de la fase 0 (spike) de la 0007.
2. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrigen y en qué spec dos rarezas bajas: K76 (`completeTimeFields` sin uso; propuesta: 0010 admin) y K79 (la migración heredada pierde `is_rerun` de las franjas, que el refactor conserva; propuesta: 0008 migración).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.
- K18: en Safari (macOS e iOS), Pausa + Play de un directo MP3 se congela? (medido solo en el WebKit de Playwright en macOS, tareas 2.7 y 2.21; en la CI, WebKitGTK, no pasa). Lo pide el spike de la 0007 (R3).

## Desviaciones de la spec activa (→ ADR)
Ninguna. Las de las specs cerradas están en [`deviations.md`](deviations.md).
