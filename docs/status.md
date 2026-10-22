# Estado
Spec activa: 0008 — Correcciones: migración, actualización, núcleo PHP y desinstalación · Fase: 2 en curso · Plan: [`phase-2.md`](specs/0008-migration-and-core-fixes/phase-2.md) · Actualizado: 2026-10-23

## En curso
- Spec 0008 ([`spec.md`](specs/0008-migration-and-core-fixes/spec.md)). Fase 1 (migración) cerrada el 2026-10-22: K29, K30, K31, K32, K84 y K85 corregidos (ADR 0037, 0038, 0039 y 0040; K79 retirado). Fase 2 (actualización, entidades y desinstalación: K33, K21, K43, C11, K7) en curso desde el 2026-10-23, con 7 tareas; nuevos ADR 0041 (migración sin admin; el aviso de éxito ya no caduca) y 0042 (desinstalación). Queda la 3, página limpia y API (K23 con RTL, K26, K24, K25).
- **No publicar una versión entre la fase 1 y la 2:** la desinstalación aún no borra la opción `radplapag_migrating` (`backcompat-reviewer`) ni el aviso de éxito, que desde la 2.2 no caduca (hasta la 2.7).
- Spec 0007 cerrada y fusionada en `trunk` (PR #41, 2026-10-22).

## Siguiente (máx. 5)
1. Tarea 2.6 de la fase 2 (K7, `fix-bug`; de la 2.1 a la 2.5, K33, K21, K43 y el ADR 0042, hechas) y después la 2.7 (C11).
2. La fase 1 se cerró con revisión mínima (decisión del usuario): solo `spec-conformance-reviewer` y `backcompat-reviewer`. Al cerrar la fase 2, pasar `wp-security-reviewer` y `wporg-reviewer` sobre el diff completo de la spec (incluye el SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente).
3. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrige y en qué spec K76 (baja: `completeTimeFields` sin uso; propuesta: 0010 admin).
- Decidir si se corrige y en qué spec K83 (baja, 2026-10-22): durante el reintento de C1 el controlador publica `error` sin `loading`; no se ve con `useState`, pero impide volver a `useSyncExternalStore` (ADR 0030).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna (las de la 0007 ya están en `deviations.md`). Las de las specs cerradas están en [`deviations.md`](deviations.md).
