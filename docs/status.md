# Estado
Spec activa: 0007 — Correcciones: reproducción · Fase: cerrada (0–3, el 2026-10-22; PR #41 listo, pendiente de merge en `trunk`) · Plan: [`phase-3.md`](specs/0007-playback-fixes/phase-3.md) · Actualizado: 2026-10-22

## En curso
- Spec 0007 (Correcciones: reproducción, [`spec.md`](specs/0007-playback-fixes/spec.md)) cerrada el 2026-10-22, con los ADR 0031–0036. PR #41 (`spec/0007-playback-fixes` → `trunk`) listo: **el merge lo decide el usuario** (merge commit, título `Spec 0007: Correcciones: reproducción`); antes puede lanzar `/code-review`.

## Siguiente (máx. 5)
1. Tras el merge del PR #41, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad del player; notas en la hoja de ruta).
2. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrigen y en qué spec dos rarezas bajas: K76 (`completeTimeFields` sin uso; propuesta: 0010 admin) y K79 (la migración heredada pierde `is_rerun` de las franjas, que el refactor conserva; propuesta: 0008 migración).
- Decidir si se corrige y en qué spec K83 (baja, 2026-10-22): durante el reintento de C1 el controlador publica `error` sin `loading`; no se ve con `useState`, pero impide volver a `useSyncExternalStore` (ADR 0030).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna (las de la 0007 ya están en `deviations.md`). Las de las specs cerradas están en [`deviations.md`](deviations.md).
