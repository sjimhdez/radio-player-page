# Spec 0010 · Fase 1 — Editor de franjas
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0021, 0028, 0044 (sin ADR nuevo en esta fase)

## Contexto
- `admin/js/station-admin.js` (765 líneas) tiene la revalidación repetida: `revalidateAdjacentDays()` (salida de una fila: da la vuelta a la semana con `dayMap`/`prevDayMap` y **salta las filas ocultas** de los vecinos) y el bloque del borrado (array `days`, **sin vuelta y sin saltar ocultas**). Las dos diferencias quedan en un parámetro que K16 quita.
- Orden de las escrituras en la salida de una fila (riesgo 1): la propia fila, luego el resto del día (sin saltar ocultas), luego el día siguiente y el anterior. En el borrado: el día entero, siguiente, anterior. Se conserva.
- `schedule-rules.js` ya expone `DAYS`, `nextDay()` y `prevDay()`: la lista de días del adaptador sale de ahí (sin cuarta copia).
- El índice de una fila nueva es `existingPrograms.length` (K15). PHP ya pinta `data-program-index` con el índice guardado.
- K44/K74: el mensaje se monta solo en `overlapMessage()`/`message()` de `schedule-rules.js` (`station-admin.js` ya no monta textos).
- K75: `findSameDayOverlap()` no mira `programId`; `isComplete()` (cruces) sí.
- K38: `Slot_Validator::validate()` hace `trim()` sin `is_string()`. La migración también pasa por ahí (`Slot_Filter`), pero los formatos legados de `tests/fixtures/legacy-settings/` solo tienen horas en cadena: nada cambia para ella.
- happy-dom no pierde el foco al mover un nodo con `appendChild`: el foco al tabular solo se prueba en e2e; el foco al quitar, también en Vitest.

## Objetivo
Corregir K15 (alta), K16, K39, K44, K74, K75 y K38 con su test de regresión, tras unificar lo repetido del editor (§4.2) sin cambiar comportamiento.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| §4.2 sin cambio de comportamiento | `npm test` en verde sin editar ningún test (1.1, 1.2) |
| K15: índice nuevo = mayor `data-program-index` del día + 1 (0 en día vacío) | `station-fields.test.js` (K15 a regresión + día vacío); `admin.spec.ts` (K15 a regresión: guarda 08–09, 12–13 reemisión y 14–15 sin reemisión) |
| K16: el borrado revalida los vecinos dando la vuelta, con la función de la salida de una fila | `station-fields.test.js` (K16 a regresión) |
| K39: el foco no se pierde al tabular ni al quitar | `a11y.spec.ts` (los dos `currently` a regresión, Chromium y WebKit); `station-fields.test.js` (foco al quitar: siguiente `select` o «Add Time Slot») |
| K44: «Money $$ Talk» sale tal cual | `schedule-rules.test.js` y `station-validation.test.js` (K44 a regresión) |
| K74: los cruces usan la reserva `unnamedProgram` | `schedule-rules.test.js` y `station-validation.test.js` (K74 a regresión, las cuatro escrituras) |
| K75: el solape del mismo día ignora filas sin programa; vectores `validation` sin cambios | `schedule-rules.test.js` y `station-validation.test.js` (K75 a regresión); `npm test` y `npm run test:php:unit` (vectores) |
| K38: hora que no es cadena → franja descartada (`required`), sin *warning* ni `TypeError` | `SlotValidatorTest` y `SanitizeScheduleTest` (K38 a regresión), en PHP 7.4 y 8.4 |

## Tareas

### 1.1 Unificar la revalidación y la lista de días (≤ 1 h)
- Qué: `revalidateDay( scheduleWrapper, day, options )` (`except`: fila que no se valida; `skipHidden`) y `revalidateAround( scheduleWrapper, day, options )` (vecinos siguiente y anterior con `rules.nextDay()`/`prevDay()`; parámetro `legacyRemoval`: sin vuelta y sin saltar ocultas, como el borrado de hoy). La salida de una fila: `validateProgramRow( row )` + `revalidateDay( …, { except: row } )` + `revalidateAround()`; el borrado: `revalidateDay()` + `revalidateAround( …, { legacyRemoval: true } )`. Desaparecen `revalidateAdjacentDays()`, `dayMap`, `prevDayMap` y el array `days`. Sin cambio de comportamiento.
- Archivos: `admin/js/station-admin.js`
- Test: caracterización existente (~110 tests del DOM en `station-fields.test.js` y `station-validation.test.js`), sin editar.
- Verificación: `npm test && npm run lint:js`
- [x] hecha · commit: ver `git log` («refactor(0010): unify the schedule revalidation and the day list (1.1)»)

### 1.2 `nextIndex()` y un solo punto de pintado del error (≤ 30 min)
- Qué: `nextIndex( dayWrapper )` con el comportamiento de hoy (número de filas); `showProgramError`/`clearProgramError` pasan a `setRowError( row, message )`/`clearRowError( row )`. Sin cambio de comportamiento.
- Archivos: `admin/js/station-admin.js`
- Test: caracterización existente, sin editar.
- Verificación: `npm test && npm run lint:js`
- [x] hecha · commit: ver `git log` («refactor(0010): add nextIndex() and a single row error painter (1.2)»)

### 1.3 K15: índice = mayor `data-program-index` del día + 1 (≤ 1 h) — `fix-bug`
- Qué: `nextIndex()` recorre las filas del día y devuelve el mayor `data-program-index` + 1 (0 si no hay filas).
- Archivos: `admin/js/station-admin.js`, `tests/js/admin/station-fields.test.js`, `tests/e2e/admin.spec.ts` (`addMondaySlot( page, 3 )` y el `schedule()` esperado), `docs/known-issues.md`
- Test: primero (regresión en rojo): `station-fields.test.js` «uses the highest index + 1 after a removal (K15)» + «starts at 0 in an empty day»; `admin.spec.ts` «keeps every slot after removing a middle row and adding one (K15)».
- Verificación: `npm test -- tests/js/admin/station-fields.test.js && npx playwright test tests/e2e/admin.spec.ts -g K15`
- Rojo: Vitest `expected '1' to be '2'`; e2e (Chromium y WebKit) sin fila `data-program-index="3"` tras quitar la del medio. «Starts at 0 in an empty day» ya existía (`starts at index 0 on an empty day`) y no cambia.
- Changelog: al quitar una franja y añadir otra ya no se pierde ni se mezcla ninguna al guardar (K15).
- [x] hecha · commit: ver `git log` («fix(0010): number a new slot after the day's highest index (1.3)»)

### 1.4 K16: el borrado revalida con la vuelta de la semana (≤ 30 min) — `fix-bug`
- Qué: el borrado llama a `revalidateAround()` sin `legacyRemoval`; el parámetro desaparece. Además de la vuelta, los vecinos saltan las filas ocultas, como al salir de una fila (§2: «con la misma función»).
- Archivos: `admin/js/station-admin.js`, `tests/js/admin/station-fields.test.js`, `docs/known-issues.md`
- Test: primero: «revalidates Monday after removing the Sunday slot (K16)».
- Verificación: `npm test -- tests/js/admin/station-fields.test.js`
- Rojo: Vitest `expected 'cross_midnight_overlap' to be null` (el lunes conserva el error tras quitar la franja del domingo). Ningún otro test fijaba que el borrado validara las filas ocultas de los vecinos.
- Changelog: al quitar una franja, el aviso de solape del día siguiente o anterior se actualiza también entre domingo y lunes (K16).
- [x] hecha · commit: ver `git log` («fix(0010): revalidate the neighbour days across the week on removal (1.4)»)

### 1.5 K39: el foco no se pierde al reordenar ni al quitar (≤ 1 h) — `fix-bug`
- Qué: `sortProgramsByStartTime()` guarda `document.activeElement` si está en la lista y, tras los `appendChild`, si ya no es el activo, le devuelve el foco con `focus( { preventScroll: true } )` (D3). Al quitar: antes de `remove()`, la fila siguiente del día (`nextElementSibling`); después de revalidar, foco a su `.radplapag-program-id` o, si no hay, a `.radplapag-add-program` del día.
- Archivos: `admin/js/station-admin.js`, `tests/e2e/a11y.spec.ts`, `tests/js/admin/station-fields.test.js`, `docs/known-issues.md`
- Test: primero: `a11y.spec.ts` «keeps the keyboard focus when tabbing into the next slot of the day (K39)» (activo = `select` de la segunda fila) y «moves the focus to the next slot when a slot is removed (K39)»; `station-fields.test.js` «moves the focus to the next row's program, or to Add Time Slot, after a removal (K39)». Si WebKit difiere (riesgo 2), se para y se pregunta.
- Verificación: `npm test -- tests/js/admin/station-fields.test.js && npx playwright test tests/e2e/a11y.spec.ts -g K39`
- Rojo: Vitest `expected <body> to be <select>`; e2e (Chromium y WebKit) `toBeFocused()` → `inactive` en los dos tests. WebKit no difiere (riesgo 2 no se da).
- Changelog: el foco del teclado ya no se pierde en el horario al pasar con Tab a otra franja del día ni al quitar una franja (K39).
- [x] hecha · commit: ver `git log` («fix(0010): keep the keyboard focus in the schedule editor (1.5)»)

### 1.6 K44: reemplazo con función (≤ 30 min) — `fix-bug`
- Qué: `overlapMessage()` usa `.replace( '%s', function () { return description; } )`; fuera el comentario «Kept as today».
- Archivos: `admin/js/schedule-rules.js`, `tests/js/admin/schedule-rules.test.js`, `tests/js/admin/station-validation.test.js`, `docs/known-issues.md`
- Test: primero: los dos `currently` de K44 a «keeps `$$` in the program name … (K44)».
- Verificación: `npm test -- tests/js/admin`
- Rojo: Vitest `expected 'This time slot overlaps with: Money $ Talk …' to be '… Money $$ Talk …'` (`message()`) y `expected '[overlap] Money $ Talk …' to be '[overlap] Money $$ Talk …'` (pantalla).
- Changelog: los avisos de solape muestran el nombre del programa tal cual, también con `$` (K44).
- [x] hecha · commit: ver `git log` («fix(0010): keep `$` patterns in the overlap message (1.6)»)

### 1.7 K74: reserva `unnamedProgram` en los cruces entre días (≤ 30 min) — `fix-bug`
- Qué: `message()` aplica a `cross_midnight_overlap` la misma reserva que a `overlap` (`error.other.name || strings.unnamedProgram || 'Unnamed program'`), en una función común.
- Archivos: `admin/js/schedule-rules.js`, `tests/js/admin/schedule-rules.test.js`, `tests/js/admin/station-validation.test.js`, `docs/known-issues.md`
- Test: primero: los `currently` de K74 (`message()` y las cuatro escrituras) a regresión.
- Verificación: `npm test -- tests/js/admin`
- [ ] hecha · commit: —

### 1.8 K75: el solape del mismo día ignora filas sin programa (≤ 30 min) — `fix-bug`
- Qué: `findSameDayOverlap()` salta `other` sin `programId`. Si cambia un vector de `validation` de `schedule-vectors.json`, se para y se pregunta.
- Archivos: `admin/js/schedule-rules.js`, `tests/js/admin/schedule-rules.test.js`, `tests/js/admin/station-validation.test.js`, `docs/known-issues.md`
- Test: primero: los `currently` de K75 a regresión (sin solape; la fila sin programa muestra solo `invalid_program`).
- Verificación: `npm test && npm run test:php:unit -- --filter ScheduleVectors`
- [ ] hecha · commit: —

### 1.9 K38: `is_string()` antes de `trim()` (≤ 30 min) — `fix-bug`
- Qué: `$start`/`$end` = `trim()` solo si son cadena; si no, `''` → la franja da `required` y se descarta, como cualquier entrada incompleta.
- Archivos: `includes/src/schedule/class-slot-validator.php`, `tests/php/unit/Schedule/SlotValidatorTest.php`, `tests/php/integration/Schedule/SanitizeScheduleTest.php`, `docs/known-issues.md`
- Test: primero: `test_array_time_is_discarded_without_warning` en los dos (sin *warning* con `set_error_handler`, error `required`, horario vacío), `start` y `end`.
- Verificación: `npm run test:php:unit -- --filter SlotValidatorTest && npm run test:php:integration -- --filter SanitizeScheduleTest`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
Ninguna. K16 cambia también que el borrado salte las filas ocultas de los vecinos (lo implica «la misma función» de §2); si cae un test que lo fije, se para y se pregunta.
