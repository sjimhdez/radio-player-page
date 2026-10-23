# Estado
Spec activa: 0008 — Correcciones: migración, actualización, núcleo PHP y desinstalación · Fase: 3 en curso · Plan: [`phase-3.md`](specs/0008-migration-and-core-fixes/phase-3.md) · Actualizado: 2026-10-23

## En curso
- Spec 0008 ([`spec.md`](specs/0008-migration-and-core-fixes/spec.md)). Fases 1 (migración) y 2 (actualización, entidades y desinstalación) cerradas el 2026-10-22 y el 2026-10-23. Fase 3 (página limpia y API: K23 con RTL, K26, K24, K25, más K86, K87 y dos huecos de test de la fase 2) en curso desde el 2026-10-23: tareas 3.1–3.9 hechas; falta el cierre.
- Spec 0007 cerrada y fusionada en `trunk` (PR #41, 2026-10-22).

## Siguiente (máx. 5)
1. Cerrar la fase 3 de la 0008 (última de la spec) con `close-phase`: tareas 3.1–3.9 hechas. El entorno de tests monta `tests/e2e/mu-plugins/` (hay que reiniciarlo con `env:start:min|latest` para que lo vea).
2. Al cerrar la fase 3 (última de la spec), pasar `wp-security-reviewer` y `wporg-reviewer` sobre el diff completo de la spec (incluye el SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente). Las fases 1 y 2 se cerraron solo con `spec-conformance-reviewer` y `backcompat-reviewer` (decisión del usuario).
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
