# Spec 0009 · Fase 1 — Modelo y programa en antena
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0044 (nuevo), 0006, 0017, 0019, 0023, 0028, 0029

## Contexto
- El modelo «día + minutos» está en `Schedule\Time::is_slot_active()` (lo usan `Now_Playing_Resolver`, `Schedule_View`, `Programs_List_View` y `radplapag_is_slot_active()`), en `player/src/utils/program-schedule.ts` (`isProgramActive()`, `findActiveProgram()`, `findIncomingProgram()`, `getProgramsForDay()`, `getAllProgramsWithSlots()`) y en `admin/js/schedule-rules.js`.
- **El arreglo de C16 en PHP es una línea** (la rama del día propio de `Time::is_slot_active()`), y las tres clases del núcleo y la integración cambian a la vez: los tests `currently` de C16 de PHP (unit e integración) pasan a regresión en la misma tarea.
- Los vectores son compartidos. Para que cada commit quede en verde: al corregir C16 en PHP, los vectores 13, 14 y C3-4 pasan a su resultado correcto y ganan un objeto `ts` con el resultado del player (`currently`, `C16`), el mecanismo que ya usa C3-2 (K8). La tarea del player borra esos `ts`. Igual con los vectores nuevos de K52.
- **Excepciones aprobadas por el usuario (2026-10-23) a «no editar caracterización»:**
  - `player/src/utils/program-schedule.test.ts` «picks the earliest start when slots overlap» → con D3 gana la que empezó más tarde.
  - `tests/php/unit/Schedule/NowPlayingResolverTest.php` `test_unknown_program_today_falls_back_to_yesterday` → en la fase 1 espera `null` (gana la franja de hoy, cuyo programa no se conoce); la fase 2 lo pasa a `'1'` al ignorar los desconocidos (C10).
- **La spec decía algo falso:** `a11y.spec.ts` no puede fijar la hora con `page.clock`, porque `now-playing` se pinta en el servidor. Decisión del usuario: sin `page.clock`. Tras K52, el e2e espera un solo `article` a cualquier hora; las 23:55 las cubren `BlockAuditTest` (con `Support/Clock`) y el núcleo. §2 de la spec se corrige en la 1.1.
- Comprobado que no caen otros tests con D3: `test_first_active_slot_wins` (09:30 gana a 09:00), `test_today_wins_over_yesterday`, `test_today_upcoming_wins_over_tomorrow_on_tie` y los datos de `TimeTest`/`ScheduleHelpersTest` fuera de los `currently`.
- La resolución de «Coming up» en PHP solo necesita `start` (una franja sin `end` cuenta, `test_malformed_entries_are_skipped`): se conserva.

## Objetivo
Un modelo común de intervalos de la semana (D1) en PHP, player y admin, probado con los vectores `model`; el programa en antena, «en directo» y «Coming up» de PHP y del player resueltos sobre él (C16, C4, K8, K52, D3).

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| Modelo en las tres capas con los vectores `model` (cruce de medianoche, domingo → lunes, 24 h, fin a las 00:00) | `WeekIntervalTest.php`, `week-interval.test.ts`, `schedule-rules.test.js` |
| C16: vectores 13, 14 y C3-4 con su resultado correcto en todas las capas | `TimeTest`, `ScheduleHelpersTest`, `ScheduleVectorsTest` (unit e integración), `ScheduleViewTest`, `ProgramsListViewTest`, `BlockDataTest`, `schedule-vectors.test.ts`, `program-schedule.test.ts`; e2e `schedule.spec.ts` (lunes 00:10 → E) |
| C4: el modal marca «On Air» en la franja de ayer | `program-schedule.test.ts` (`getProgramsForDay()`); e2e `modals.spec.ts` (martes 01:00, C del lunes) |
| K8: C3-2 sin `ts`; sábado 01:00 → viernes 22:00–02:00 | `schedule-vectors.test.ts`, `program-schedule.test.ts` |
| K52: no se anuncia el mismo programa contiguo | `NowPlayingResolverTest`, `BlockAuditTest`, `program-schedule.test.ts`, vectores nuevos; `a11y.spec.ts` «always on air» en verde sin cambios (verificación manual al cerrar, a cualquier hora) |
| D3: con solapes gana la que empezó más tarde (empate: orden guardado), igual en PHP y player | `NowPlayingResolverTest`, `program-schedule.test.ts` |
| ADR 0044 y `SPEC.md` §3.1, §3.4, §3.8 | revisión en la 1.1 y en `close-phase` |
| Filas C16, C4, K8, K52 → «corregido (spec 0009)» | `docs/known-issues.md` |
| Cobertura: núcleo PHP ≥ 90 %, TS puro ≥ 90 %, JS admin ≥ 85 % | `npm run check`, cobertura de la CI |

## Tareas

### 1.1 ADR 0044 y contrato (≤ 1 h)
- Qué: `write-adr` «Modelo del horario: intervalos de la semana» (D1, D3, K52, C16 en `radplapag_is_slot_active()`). `SPEC.md` §3.1, §3.4, §3.8. En la spec: §2 K52 sin `page.clock` (el motivo) y las dos excepciones de tests en §4.3.
- Archivos: `docs/adr/0044-*.md`, `docs/adr/README.md`, `SPEC.md`, `docs/specs/0009-schedule-model/spec.md`
- Test: — (docs)
- Verificación: `npm run check`
- [x] hecha · commit: este

### 1.2 Vectores `model` y `Schedule\Week_Interval` en PHP (≤ 1 h)
- Qué: sección `model` en `schedule-vectors.json` (`from_slot`, `contains`, `minutes_until_start`, `overlaps`) y `_doc`. Clase del núcleo con: minuto de la semana de un `DateTimeImmutable` y de (día, «HH:MM»); franja → `{start, duration}`; `contains`; `minutes_until_start`; `overlaps` (con la vuelta de la semana). Usa `Time::to_minutes()`. Entrada en `tests/zip/expected-additions.txt`.
- Archivos: `includes/src/schedule/class-week-interval.php`, `tests/fixtures/schedule-vectors.json`, `tests/zip/expected-additions.txt`
- Test: primero (TDD): `tests/php/unit/Schedule/WeekIntervalTest.php`
- Verificación: `npm run test:php:unit -- --filter WeekInterval && npm run check:zip && npm run lint:phpstan`
- [ ] hecha · commit: —

### 1.3 `utils/week-interval.ts` en el player (≤ 1 h)
- Qué: las mismas operaciones en TS puro, leyendo los vectores `model`.
- Archivos: `player/src/utils/week-interval.ts`
- Test: primero (TDD): `player/src/utils/week-interval.test.ts`
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

### 1.4 Funciones del modelo en `schedule-rules.js` (≤ 1 h)
- Qué: las mismas operaciones expuestas en `radplapagScheduleRules`, sin usarlas todavía (las usa la fase 3).
- Archivos: `admin/js/schedule-rules.js`
- Test: primero (TDD): `tests/js/admin/schedule-rules.test.js` (bloque nuevo sobre `model`)
- Verificación: `npm test -- tests/js/admin/schedule-rules.test.js`
- [ ] hecha · commit: —

### 1.5 C16 en PHP (`fix-bug`) (≤ 1 h)
- Qué: `Time::is_slot_active()` delega en `Week_Interval` (su día propio deja de dar `true` antes del inicio; firma igual). Tests `currently` de C16 → regresión en rojo y luego verde: `TimeTest`, `ScheduleHelpersTest`, `ScheduleViewTest`, `ProgramsListViewTest`, `ScheduleVectorsTest` (unit e integración) y `BlockDataTest` (se quitan los `test_currently_*` con proveedor vacío). Vectores 13, 14 y C3-4 → resultado correcto + objeto `ts` del player (`currently`, `C16`). Fila C16: parte PHP corregida.
- Archivos: `includes/src/schedule/class-time.php`, `includes/radplapag-schedule-block.php` (docblock `@since`), los tests citados, `tests/fixtures/schedule-vectors.json`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm run test:php:unit && npm run test:php:integration -- --filter 'ScheduleVectors|BlockData|ScheduleHelpers' && npm --prefix player test -- schedule-vectors`
- [ ] hecha · commit: —

### 1.6 `Now_Playing_Resolver` sobre el modelo (D3) (≤ 1 h)
- Qué: «On Air» = la franja activa que empezó más tarde (empate: orden guardado); «Coming up» = menor `minutes_until_start` en `(0, ventana]`, solo con `start`. Se edita el test aprobado (`null`) y se añaden los de D3 (solape: gana la más tardía; empate: la primera). `Schedule_View` y `Programs_List_View` calculan `is_live` con `Week_Interval::contains()` sin pasar por la rama de ayer (refactor, sus tests como red).
- Archivos: `includes/src/schedule/class-now-playing-resolver.php`, `class-schedule-view.php`, `class-programs-list-view.php`, `tests/php/unit/Schedule/NowPlayingResolverTest.php`
- Test: primero (TDD) para D3; caracterización existente como red
- Verificación: `npm run test:php:unit && npm run test:php:integration -- --filter 'NowPlaying|BlockData|BlockAudit|ScheduleVectors' && npm run lint:phpstan`
- [ ] hecha · commit: —

### 1.7 K52 en PHP (`fix-bug`) (≤ 1 h)
- Qué: «Coming up» omite la franja del mismo programa que empieza justo cuando acaba la actual. `test_currently_24_hour_slot_is_coming_up_while_on_air` (`NowPlayingResolverTest`, `BlockAuditTest`) → regresión; test del partido en la medianoche. Vectores de resolución nuevos (24 h diario y lunes 22:00–00:00 + martes 00:00–02:00, a las 23:55) con resultado PHP y `ts` del player (`currently`, `K52`).
- Archivos: `class-now-playing-resolver.php`, los dos tests, `schedule-vectors.json`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm run test:php:unit && npm run test:php:integration -- --filter 'BlockAudit|ScheduleVectors|BlockData' && npm --prefix player test -- schedule-vectors`
- [ ] hecha · commit: —

### 1.8 C16 y K8 en el player (`fix-bug`) (≤ 1 h)
- Qué: `isProgramActive()` (misma firma) y `findActiveProgram()` sobre `week-interval.ts` y D3: mira toda la semana, también ayer con hoy vacío. Tests `currently` de C16 y K8 → regresión; se edita el test aprobado del solape. Se borran los `ts` de 13, 14, C3-4 y C3-2. e2e `schedule.spec.ts` (C16, vector 13) → regresión: el lunes 00:10 se ve E.
- Archivos: `player/src/utils/program-schedule.ts`, `program-schedule.test.ts`, `schedule-vectors.test.ts`, `schedule-vectors.json`, `tests/e2e/schedule.spec.ts`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/schedule.spec.ts`
- [ ] hecha · commit: —

### 1.9 C4 en el player (`fix-bug`) (≤ 1 h)
- Qué: `getProgramsForDay()` marca activa la franja de ayer que sigue sonando (con `contains()` del modelo, no solo «hoy»); `getAllProgramsWithSlots()` sobre el modelo (refactor). Test `currently` de C4 → regresión; e2e `modals.spec.ts` (C4) → regresión.
- Archivos: `program-schedule.ts`, `program-schedule.test.ts`, `tests/e2e/modals.spec.ts`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/modals.spec.ts`
- [ ] hecha · commit: —

### 1.10 K52 en el player (`fix-bug`) (≤ 1 h)
- Qué: `findIncomingProgram()` sobre el modelo con la regla de K52 (y D3 para el actual). Los dos tests `currently` de K52 → regresión; se borran los `ts` de los vectores de K52.
- Archivos: `program-schedule.ts`, `program-schedule.test.ts`, `schedule-vectors.json`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/schedule.spec.ts tests/e2e/a11y.spec.ts`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- ADR 0044 (tarea 1.1). Ninguna otra prevista.

## Pasos de proceso (tras aprobar el plan)
1. `git fetch origin`; ya en `spec/0009-schedule-model`; `git merge origin/trunk` si avanzó.
2. Guardar este plan en `docs/specs/0009-schedule-model/phase-1.md`, actualizar `docs/status.md` y commit `docs(0009): add phase 1 plan`.
3. `git push -u origin spec/0009-schedule-model` y `gh pr create --draft --base trunk --title "Spec 0009: Correcciones: horario y programa en antena" --body "<enlaces a spec y plan>"`.
4. `npm run check` en verde.
