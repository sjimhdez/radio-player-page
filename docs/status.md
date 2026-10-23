# Estado
Spec activa: 0009 — Correcciones: horario y programa en antena · Fase: 2 en curso · Plan: [`phase-2.md`](specs/0009-schedule-model/phase-2.md) · Actualizado: 2026-10-23

## En curso
- Spec 0009 ([`spec.md`](specs/0009-schedule-model/spec.md)) en curso en la rama `spec/0009-schedule-model` (PR en borrador contra `trunk`): modelo de intervalos de la semana en PHP, player y admin; 4 fases.
- Fase 1 (modelo y programa en antena: C16, C4, K8, K52) cerrada el 2026-10-23 (revisión mínima: solo conformidad y backcompat).
- Fase 2 (programas no publicados: C10, K41, contraseña → K88, K78 y K17) en curso desde el 2026-10-23: 9 tareas, ADR 0045. Excepciones de caracterización aprobadas en el «Contexto» del plan.
- Spec 0008 cerrada y fusionada en `trunk` (PR #42, 2026-10-22).

## Siguiente (máx. 5)
1. Tarea 2.1 de la fase 2 de la 0009 (ADR 0045 y contrato); al terminar las 9, `close-phase`.
2. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.
3. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente). No se pasaron al cerrarla (decisión del usuario). Tampoco `wp-security-reviewer`, `wporg-reviewer` ni `a11y-reviewer` en la fase 1 de la 0009. Y el changelog de `readme.txt` con el cambio de `radplapag_is_slot_active()` (ADR 0044).

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
Ninguna (las de la 0008 ya están en `deviations.md`). Las de las specs cerradas están en [`deviations.md`](deviations.md).
