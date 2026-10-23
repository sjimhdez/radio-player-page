# Spec 0009 · Fase 3 — Validación sobre el modelo (C3)
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0044, 0028

## Contexto
- `Schedule\Slot_Validator` (PHP) calcula los solapes con su propia aritmética lineal: mismo día con `end_min = end <= start ? end + 1440 : end`, y entre días solo para las filas que cruzan la medianoche (`end <= start`), comparando `end > start` de la fila del día siguiente; el primer solape entre días corta la búsqueda. Todas las filas que llegan ahí ya pasaron el formato HH:MM.
- `admin/js/schedule-rules.js` repite lo mismo a su manera: `sameDayEnd()` recorta a 1440 la franja que cruza, `findNextDayOverlap()` / `findPrevDayOverlap()` solo miran las que cruzan. Las funciones del modelo (`fromSlot`, `contains`, `overlaps`…) ya están (fase 1) y no se usan.
- Medido: con horas válidas, `Week_Interval::overlaps()` sobre `from_slot( día, start, end )` da lo mismo que las dos aritméticas en todos los casos (mismo día, día siguiente, domingo → lunes, franjas que se tocan, 24 h, fin a las 00:00): las franjas duran ≤ 1440 y no llegan a dos días. Así que se cambia el predicado y se conservan los bucles, el orden, los códigos y las escrituras (D2). Los guardas «solo las que cruzan» quedan redundantes y se quitan.
- Admin: en otras filas, una hora fuera de formato podría leerse distinto (hoy `timeToMinutes()` recorta, el modelo da la vuelta). Es inalcanzable (`<input type="time">` vacía lo que no es hora) y ningún test lo fija; el intervalo de la validación se arma con `timeToMinutes()` (la lectura propia del admin), no con la lectura laxa del modelo.
- C3: el servidor ya acepta `start == end` (24 h); el admin lo rechaza en `checkSlotFields()` con `start_equals_end`. Tras quitarlo, la franja sigue por los solapes con duración 1440.
- `startEndSame` de `admin/admin-strings.php` queda sin uso, como `completeTimeFields` (K76). Se queda: `AdminScreensTest` fija las claves de `radplapagAdmin.strings` y quitarla se decide con K76 (0010). Se amplía la fila K76.
- **Ediciones de tests aprobadas por el usuario con el plan (2026-10-23)** (no están en §4.3 de la spec; caen por quitar `start_equals_end`):
  - `schedule-rules.test.js` «message»: salen las filas `start_equals_end` de «falls back to English» y «uses the translated strings».
  - `station-validation.test.js` «replaces the previous message of a row on a new submit»: el segundo envío con `06:00–06:00` ya es válido; pasa a vaciar el programa (error `invalid_program`), mismo comportamiento probado (un solo mensaje, el nuevo).
  - `station-validation.test.js` «currently differs from the correct result in %s»: sin vectores `currently` del admin la tabla queda vacía; se borra el bloque.
  - `tests/js/admin/support/mount-station-screen.js`: fuera `startEndSame` de las cadenas del soporte.
  - Vectores `c3-*` de `validation`: pierden `currently`/`issue`/`correct`; la `note` de `c3-start-equals-end-next-day-conflict` se reescribe (ya no hay `start_equals_end` previo); `_doc` sin `start_equals_end (admin only)`.
- Cualquier otro test de caracterización que caiga: se para y se pregunta.

## Objetivo
La validación del horario en PHP y en el admin calcula los solapes con el modelo de intervalos de la semana sin cambiar ningún código, mensaje, orden ni escritura, y el admin acepta `start == end` como 24 h, igual que el servidor.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| `Slot_Validator` calcula los solapes con `Week_Interval`; mismos errores, orden y salida | `SlotValidatorTest`, `ScheduleVectorsTest` (unit, `validation`) y `SanitizeScheduleTest` sin editar (salvo el renombre de C3); mutación de `overlaps()` → fallan |
| `schedule-rules.js` calcula los solapes con el modelo; mismas escrituras | `schedule-rules.test.js` y `station-validation.test.js` sin editar sus tests no `currently`; mutación → fallan |
| C3: el admin acepta `start == end` (24 h); los vectores `c3-*` dan su `correct`; desaparece `start_equals_end` | `schedule-rules.test.js` y `station-validation.test.js` (los `currently` de C3 a regresión, en rojo primero), vectores `c3-*` y uno nuevo (24 h a las 00:00 que toca el día siguiente: válido en las dos capas) |
| PHP: `test_currently_accepts_start_equals_end` → `test_accepts_start_equals_end` (mismo comportamiento) | `SlotValidatorTest`, `SanitizeScheduleTest` |
| `SPEC.md` §3.6 (el cliente acepta `start == end` como 24 h) y §6; fila C3 → «corregido (spec 0009)»; K76 con `startEndSame` | revisión en `close-phase` |
| Cobertura: núcleo PHP ≥ 90 %, JS admin ≥ 85 % | `npm run check` |

## Tareas

### 3.1 `Slot_Validator` sobre el modelo (≤ 1 h)
- Qué: el solape del mismo día y el de días contiguos usan `Week_Interval::overlaps( Week_Interval::from_slot( … ), … )`. Se quedan el orden por inicio (`Time::to_minutes()`), los bucles, la regla «la primera entre días corta» y los códigos (`overlap` mismo día, `cross_midnight_overlap` día siguiente). Fuera `end_min`, `DAY_MINUTES` si queda sin uso y el guarda «solo las que cruzan». Docblock de la clase (ADR 0044).
- Archivos: `includes/src/schedule/class-slot-validator.php`
- Test: caracterización existente (`SlotValidatorTest`, `ScheduleVectorsTest`, `SanitizeScheduleTest`) sin editar; mutación temporal de `overlaps()` para verlos fallar.
- Verificación: `npm run test:php:unit -- --filter 'SlotValidator|ScheduleVectors' && npm run test:php:integration -- --filter SanitizeSchedule && npm run lint:phpstan`
- [x] hecha · commit: ver `git log` («refactor(0009): compute schedule overlaps in Slot_Validator with the week-interval model (3.1)»)

### 3.2 `schedule-rules.js`: solapes sobre el modelo (≤ 1 h)
- Qué: `findSameDayOverlap()`, `findNextDayOverlap()` y `findPrevDayOverlap()` comparan con `overlaps()` sobre un intervalo de la fila (`intervalOf( day, slot )`, con `timeToMinutes()`). Mismos filtros de filas (`hidden`, sin horas, `isComplete()`), mismo orden y escrituras. Fuera `sameDayEnd()` y `crossesMidnight()`. El comentario «Not used yet» del bloque del modelo se actualiza.
- Archivos: `admin/js/schedule-rules.js`
- Test: caracterización existente (`schedule-rules.test.js`, `station-validation.test.js`) sin editar; mutación temporal.
- Verificación: `npm test`
- [x] hecha · commit: ver `git log` («refactor(0009): compute schedule overlaps in schedule-rules.js with the week-interval model (3.2)»)

### 3.3 C3 en el admin (`fix-bug`) (≤ 1 h)
- Qué: los dos `currently rejects a slot whose start equals its end (C3)` pasan a regresión (`accepts … as a 24 h slot`) y los vectores `c3-*` a su `correct`, en rojo primero. Después, fuera `start_equals_end` de `checkSlotFields()` y de `message()`. Vector nuevo `c3-24h-at-midnight-touches-next-day`. Ediciones aprobadas del «Contexto». PHP: renombre a `test_accepts_start_equals_end` en unit e integración (docblock sin «Currently»). `SPEC.md` §3.6 y §6 (fila «0009 (fase 3)»); `known-issues.md` C3 → corregido, K76 con `startEndSame`.
- Archivos: `admin/js/schedule-rules.js`, `tests/js/admin/schedule-rules.test.js`, `tests/js/admin/station-validation.test.js`, `tests/js/admin/support/mount-station-screen.js`, `tests/fixtures/schedule-vectors.json`, `tests/php/unit/Schedule/SlotValidatorTest.php`, `tests/php/integration/Schedule/SanitizeScheduleTest.php`, `SPEC.md`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm test && npm run test:php:unit && npm run test:php:integration -- --filter 'SanitizeSchedule|ScheduleVectors' && npm run check`
- [ ] hecha · commit: —
- Changelog: en el admin, una franja con la misma hora de inicio y de fin se guarda como 24 h.

## Decisiones abiertas → ADR
- Ninguna: `start == end` = 24 h ya está en el ADR 0044.

