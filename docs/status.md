# Estado
Spec activa: 0007 — Correcciones: reproducción · Fase: 2 por empezar · Plan anterior: [`phase-1.md`](specs/0007-playback-fixes/phase-1.md) · Actualizado: 2026-10-22

## En curso
- Spec 0007 (Correcciones: reproducción, [`spec.md`](specs/0007-playback-fixes/spec.md)), rama `spec/0007-playback-fixes` con el PR #41 en borrador contra `trunk`. Fase 0 (spike) cerrada el 2026-10-22 ([informe](spikes/0007-phase-0.md)). Fase 1 cerrada el 2026-10-22 ([`phase-1.md`](specs/0007-playback-fixes/phase-1.md)): K67, C7 (con K12 y el *fixture* de K18), C1 y la visualización decidida por el núcleo (K82), con los ADR 0032 y 0033. A15 verificado en Safari de macOS con el player corregido.
- Spec 0006 (Refactor del player) cerrada y fusionada en `trunk` (PR #40, 2026-10-21).

## Siguiente (máx. 5)
1. Fase 2 de la 0007 (estados del audio: C2; K1 y la revisión del ADR 0030, A13; K64; D3 y D4, K11 y K81; K63): `start-phase` en una sesión nueva.
2. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrigen y en qué spec dos rarezas bajas: K76 (`completeTimeFields` sin uso; propuesta: 0010 admin) y K79 (la migración heredada pierde `is_rerun` de las franjas, que el refactor conserva; propuesta: 0008 migración).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza: es la zona de K63 (fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna. Las de las specs cerradas están en [`deviations.md`](deviations.md).
