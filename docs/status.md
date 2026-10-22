# Estado
Spec activa: 0008 — Correcciones: migración, actualización, núcleo PHP y desinstalación · Fase: 1 en curso · Plan: [`phase-1.md`](specs/0008-migration-and-core-fixes/phase-1.md) · Actualizado: 2026-10-22

## En curso
- Spec 0008 ([`spec.md`](specs/0008-migration-and-core-fixes/spec.md)), fase 1 (migración) planificada el 2026-10-22: 11 tareas, de K29 a K32, con el ADR 0037. §4.3 amplía las excepciones a los tests de caracterización que cambian por diseño (decisión del usuario). Fusiona la 0008 y la 0012 de la hoja de ruta (decisión del usuario): comparten `uninstall.php` y `SPEC.md` §3.7. Tres fases: migración (K29, K30 con el bloqueo atómico, K79, K31, K32), actualización, entidades y desinstalación (K33, K21, K43, C11, K7) y página limpia y API (K23 con RTL, K26, K24, K25).
- Spec 0007 cerrada y fusionada en `trunk` (PR #41, 2026-10-22).

## Siguiente (máx. 5)
1. Tarea 1.2 de la fase 1 de la 0008 (K29, `fix-bug`), y después de la 1.3 a la 1.11 en orden. La 1.1 dejó el ADR 0037 (contrato de la migración) con `SPEC.md` §3.1 y §3.2 y la rule de datos al día.
2. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrige y en qué spec K76 (baja: `completeTimeFields` sin uso; propuesta: 0010 admin). K79 ya va en la 0008.
- Decidir si se corrige y en qué spec K83 (baja, 2026-10-22): durante el reintento de C1 el controlador publica `error` sin `loading`; no se ve con `useState`, pero impide volver a `useSyncExternalStore` (ADR 0030).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna (las de la 0007 ya están en `deviations.md`). Las de las specs cerradas están en [`deviations.md`](deviations.md).
