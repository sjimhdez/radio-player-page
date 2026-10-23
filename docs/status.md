# Estado
Spec activa: 0009 — Correcciones: horario y programa en antena · Fase: 1 en curso · Plan: [`phase-1.md`](specs/0009-schedule-model/phase-1.md) · Actualizado: 2026-10-23

## En curso
- Spec 0009 ([`spec.md`](specs/0009-schedule-model/spec.md)) en curso en la rama `spec/0009-schedule-model` (PR en borrador contra `trunk`): modelo de intervalos de la semana en PHP, player y admin; 4 fases.
- Fase 1 (modelo y programa en antena: C16, C4, K8, K52) planificada el 2026-10-23: 10 tareas. Cuatro tests de caracterización se editan con la aprobación del usuario (D3 y K52) y el e2e de K52 va sin `page.clock` (se pinta en el servidor); ver el plan. Hechas la 1.1 (ADR 0044, `SPEC.md` §3.1, §3.4, §3.8 y §6), la 1.2 (`Schedule\Week_Interval` y los vectores `model`: 41 casos de `from_slot`, `contains`, `minutes_until_start` y `overlaps`), la 1.3 (`utils/week-interval.ts`, mismas operaciones y vectores, más `at(dayOfWeek, minutos)` con el domingo = 0 de `getCurrentTimeInTimezone()`) la 1.4 (`minuteOfWeek`, `fromSlot`, `contains`, `minutesUntilStart` y `overlaps` en `radplapagScheduleRules`, sin uso hasta la fase 3; `timeToMinutes()` no cambia) y la 1.5 (C16 en PHP: `Time::is_slot_active()` delega en `Week_Interval`; vectores 13, 14 y C3-4 con su resultado correcto y el del player en `ts` hasta la 1.8), la 1.6 (D3 en `Now_Playing_Resolver`: gana la franja activa que empezó más tarde; `Schedule_View` y `Programs_List_View` con `Week_Interval::contains()`; el gemelo de integración del test editado, también editado con aprobación) y la 1.7 (K52 en PHP: «Coming up» salta la franja del mismo programa que empieza al acabar la actual; vectores K52-1 y K52-2 con `ts` del player hasta la 1.10; `test_current_has_logo_and_upcoming_has_none` editado con aprobación: su segunda franja pasa a 10:05) la 1.8 (C16 y K8 en el player: `isProgramActive()` delega en `week-interval.ts` y `findActiveProgram()` mira toda la semana con D3; fuera los `ts` de 13, 14, C3-2 y C3-4; el e2e de C16 ve E el lunes 00:10) la 1.9 (C4 en el player: `getProgramsForDay()` marca activa la franja de ayer que sigue sonando y `getAllProgramsWithSlots()` usa `contains()`; el e2e del modal del horario ve «On Air» en C el martes 01:00) y la 1.10 (K52 en el player: `findIncomingProgram()` sobre el modelo, salta la franja del mismo programa que empieza al acabar la actual; fuera los `ts` de K52-1 y K52-2). Las 10 tareas hechas: falta `close-phase`.
- Spec 0008 cerrada y fusionada en `trunk` (PR #42, 2026-10-22).

## Siguiente (máx. 5)
1. `close-phase` de la fase 1 de la 0009 (incluye la verificación manual de K52: `a11y.spec.ts` «blocks page with a program always on air» ya no depende de la hora).
2. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.
3. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente). No se pasaron al cerrarla (decisión del usuario).

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
