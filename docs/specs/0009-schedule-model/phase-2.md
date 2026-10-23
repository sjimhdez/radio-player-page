# Spec 0009 · Fase 2 — Programas no publicados (C10, K41, contraseña, K78, K17)
Estado: cerrada (2026-10-23) · Inicio: 2026-10-23 · ADRs: 0045 (nuevo), 0044, 0019, 0028, 0029

## Contexto
- Hoy cada punto de entrada carga los programas con `radplapag_get_program_data( $id, true )` (solo `publish`, **acepta contraseña**) pero resuelve sobre el horario crudo: página limpia (`radio-player-page.php:348`), bloque de horario (`radplapag_build_programs_map()` + `radplapag_get_schedule_for_station()`), lista de programas (`radplapag_get_programs_list_for_station()`) y `radplapag_get_now_playing_for_station()` (que alimenta `now-playing`). De ahí C10: la franja del borrador se queda (bloque con «—», `RADPLAPAG_SCHEDULE`, ventana de «Coming up»).
- `Now_Playing_Resolver` deja ganar a una franja de programa desconocido (`current` nulo) y le deja la ventana de «Coming up» (variante de C10). `Schedule_View` del núcleo pinta lo desconocido con nombre vacío (`test_unknown_program_has_empty_name`): **no se toca**; el adaptador filtra antes (D4).
- `Globals_Builder::program_ids()` lee el horario crudo (K78); `schedule()` devuelve `[]` sin franjas (K17). Su firma no cambia: el envoltorio llama a `program_ids()` sobre el horario ya impreso y convierte el vacío en objeto.
- El player resuelve con nombre vacío lo que no está en `programs` (`resolveProgram()` en `utils/program-schedule.ts`).
- Admin: `radplapag_get_all_programs_for_select()` lista `publish` + `draft`; una franja con programa en la papelera/privado/pendiente/programado se pinta sin selección y bloquea el guardado (K41). `radplapagAdmin.programs` sale de `radplapag_get_admin_strings()`, sin contexto de emisora; `admin/admin.php` ya conoce `$post_id`.
- La sospecha de la contraseña (5.8 de la 0002) no tiene fila: se abre como K88 con su test `currently` (2.2).
- **Excepciones aprobadas por el usuario (2026-10-23) a «no editar caracterización»**, además de las de §4.3 de la spec:
  - `NowPlayingResolverTest::test_malformed_entries_are_skipped`: la franja `'not numeric'` ya no corta la búsqueda; a las 23:55 suena el programa 3.
  - `program-schedule.test.ts` «leaves the name empty for an unknown program» y «keeps unknown programs with an empty name»: pasan a ignorar la franja / dejar fuera el programa (también con `programs` undefined).
  - `clean-page.spec.ts` «skips the raw schedule entries that cannot be printed»: desaparecen la franja del borrador y la de `'tagged id'` (un ID no numérico es un programa que no existe).
  - Admin: el estado va en el texto de la opción («Draft Show (Draft)») para todo programa no público del selector; el fixture `tests/fixtures/admin/station-meta-box.html` se regenera con su test.
  - `BlockDataTest::test_unknown_program_slot_has_empty_name` (integración) pasa a «la franja de un programa que no existe no sale», literal de §2 («o no existe … ni con “—”») (aprobado con el plan).
  - `ScheduleVectorsTest::test_malformed_entries_are_skipped` (integración): gemelo de la unit, `current` C (aprobado en la 2.4, 2026-10-23).
  - `admin-dom.test.js` «builds the row with the default strings»: gana la opción «Draft Show (Draft)» por los datos del soporte (2.9; dentro de la excepción del selector).
  - `AdminScreensTest::test_station_screen_localizes_radplapag_admin`: `radplapagAdmin.programs` es `radplapag_get_station_programs_for_select( $post_id )` (con `label` y `public`), no `radplapag_get_admin_strings()['programs']` (aprobado en la 2.8, 2026-10-23).
- Cualquier otro test de caracterización que caiga: se para y se pregunta.

## Objetivo
Una sola regla en el adaptador de WordPress (D4): solo cuentan en lo público las franjas de programas publicados y sin contraseña; se aplica en los cinco puntos de entrada antes de resolver, el núcleo del resolutor y el player ignoran lo desconocido, `RADPLAPAG_PROGRAMS` sale de las franjas impresas, `RADPLAPAG_SCHEDULE` vacío es `{}`, y el admin conserva y avisa de las franjas de programas no publicados sin bloquear el guardado.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| C10 + contraseña + K78: la franja de un programa no publicado, con contraseña o inexistente no cuenta en `RADPLAPAG_SCHEDULE`, `RADPLAPAG_PROGRAMS`, los tres bloques ni `radplapag_get_now_playing_for_station()` (tampoco en la ventana de «Coming up») | `GlobalsBuilderTest`, `NowPlayingResolverTest`, `PublicSlotsTest`, `ScheduleViewTest` (sin cambios), `BlockDataTest`, `BlockAuditTest`, `ScheduleVectorsTest` (unit e integración, vectores con programas no publicados), `clean-page.spec.ts` (K78 y entradas crudas) |
| `radplapag_get_program_data( $id, true )` rechaza la contraseña | `BlockDataTest` (el `currently` de K88 a regresión) |
| Player: franja con `program_id` fuera de `RADPLAPAG_PROGRAMS` se ignora | `program-schedule.test.ts`, `schedule-vectors.test.ts` |
| Admin C10/K41: franja de programa no publicado → programa seleccionado con su estado + aviso «This program is not published; this time slot is not shown on the site.» al pintar y al elegirlo; se puede guardar; el servidor la acepta | `AdminScreensTest` (K41 a regresión, aviso), `station-validation.test.js` / `admin-dom.test.js`, `SanitizeScheduleTest` y `SlotValidatorTest` (sin `currently`) |
| K17: sin franjas `RADPLAPAG_SCHEDULE` es `{}`; el player sigue aceptando `[]` | `GlobalsBuilderTest`, `clean-page.spec.ts`, snapshot `minimal.html`, `read-config.test.ts` y `use-config.test.tsx` (sin `currently`) |
| ADR 0045 y `SPEC.md` §3.3–§3.6 | revisión en la 2.1 y en `close-phase` |
| Filas C10, K41, K78, K17 y K88 → «corregido (spec 0009)» | `docs/known-issues.md` |
| Cobertura: núcleo PHP ≥ 90 %, TS puro ≥ 90 %, JS admin ≥ 85 % | `npm run check`, cobertura de la CI |

## Tareas

### 2.1 ADR 0045 y contrato (≤ 1 h)
- Qué: `write-adr` «El horario público solo muestra programas publicados» (D4, D5, D8 parte K17, contraseña, IDs no numéricos = inexistentes, `{}`). `SPEC.md` §3.3, §3.4, §3.5, §3.6. Spec §4.3: las excepciones aprobadas de este plan.
- Archivos: `docs/adr/0045-*.md`, `docs/adr/README.md`, `SPEC.md`, `docs/specs/0009-schedule-model/spec.md`
- Test: — (docs)
- Verificación: `npm run check`
- [x] hecha · commit: ver `git log` («docs(0009): add ADR 0045 on the public schedule showing only published programs (2.1)»)
- ADR 0045 (puntos 1–8: programa público, contraseña, regla única antes de resolver, `RADPLAPAG_PROGRAMS` de las franjas impresas, `{}`, admin). `SPEC.md` §3.3 (globales y párrafo «Programas públicos»), §3.4 (`radplapag_get_program_data()` y `now-playing`), §3.5, §3.6 y §6. Spec §4.3 con las excepciones del plan. `npm run check` en verde.
- Changelog: los programas con contraseña ya no salen en la página limpia ni en los bloques; `RADPLAPAG_SCHEDULE` vacío es `{}` (también en `== Upgrade Notice ==`, con C10).

### 2.2 Caracterización de la contraseña (K88) (≤ 1 h)
- Qué: `test_currently_password_protected_program_is_public` en integración: con `post_password`, `radplapag_get_program_data( $id, true )` devuelve datos, el programa sale en el bloque de horario, en la lista de programas y como `current` de `radplapag_get_now_playing_for_station()`. Fila K88 en `known-issues.md` (decisión: corregir en la 0009, 5.8). Mutación de comprobación.
- Archivos: `tests/php/integration/Schedule/BlockDataTest.php`, `docs/known-issues.md`
- Test: caracterización
- Verificación: `npm run test:php:integration -- --filter BlockData`
- [x] hecha · commit: ver `git log` («test(0009): characterize password-protected programs (2.2)»)
- Fila K88 (media, corregir en la 2.5). Mutación: `data()` rechaza `post_password` no vacío con `$require_published` → el test falla.

### 2.3 `Schedule\Public_Slots` en el núcleo (≤ 1 h)
- Qué: `Public_Slots::filter( array $schedule, array $program_ids ): array` — conserva días y orden guardado; quita entradas que no son arrays, días que no son arrays y franjas cuyo `program_id` no es numérico o no está en `$program_ids`. Entrada en `tests/zip/expected-additions.txt`.
- Archivos: `includes/src/schedule/class-public-slots.php`, `tests/zip/expected-additions.txt`
- Test: primero (TDD): `tests/php/unit/Schedule/PublicSlotsTest.php`
- Verificación: `npm run test:php:unit -- --filter PublicSlots && npm run check:zip && npm run lint:phpstan`
- [x] hecha · commit: ver `git log` («feat(0009): add Schedule\Public_Slots to keep only slots of public programs (2.3)»)
- `filter( $schedule, int[] $program_ids )`: un día que se queda sin franjas sale vacío (`[]`), no desaparece; las franjas salen tal cual se guardaron (sin normalizar). 7 tests, rojo visto antes de la clase.

### 2.4 C10 en `Now_Playing_Resolver` (`fix-bug`) (≤ 1 h)
- Qué: el resolutor ignora las franjas cuyo programa no está en el mapa (ni «On Air» ni ventana de «Coming up»). `test_currently_unknown_program_slot_hides_the_next_upcoming_program` → regresión (anuncia el 1). Ediciones aprobadas: `test_unknown_program_that_started_latest_gives_no_current` → `'1'` (y nombre nuevo), `test_malformed_entries_are_skipped` → `current` 3. Vectores de resolución con programas no publicados (campo `unpublished` por vector; cada capa los deja fuera del mapa) con resultado PHP y `ts` del player (`currently`, C10). Docblock de la clase.
- Archivos: `includes/src/schedule/class-now-playing-resolver.php`, `tests/php/unit/Schedule/NowPlayingResolverTest.php`, `tests/php/unit/Schedule/ScheduleVectorsTest.php`, `tests/php/integration/Schedule/ScheduleVectorsTest.php`, `player/src/utils/schedule-vectors.test.ts` (lee `unpublished`), `tests/fixtures/schedule-vectors.json`
- Test: regresión (`fix-bug`)
- Verificación: `npm run test:php:unit && npm --prefix player test -- schedule-vectors`
- [x] hecha · commit: ver `git log` («fix(0009): skip slots of unknown programs in Now_Playing_Resolver (2.4)»)
- Rojo visto: los tres tests editados de `NowPlayingResolverTest` («Trying to access array offset on null») y los vectores C10-1 y C10-2 en `ScheduleVectorsTest` unit. Vectores: `unpublished` por vector, grids `c10` y `c10-upcoming`; el player los fija con `ts` (`currently`, C10).
- **Adelantado de la 2.5 (aprobado por el usuario, 2026-10-23):** `radplapag_get_now_playing_for_station()` ya carga solo publicados, así que el arreglo del núcleo llega a la integración: `BlockAuditTest` C10 variante → regresión (anuncia «Show»), gemelo de integración → programa A, y `ScheduleVectorsTest::test_malformed_entries_are_skipped` de integración → `current` C (edición aprobada, gemela de la unit). `ScheduleVectorsTest` de integración crea los `unpublished` como borradores. `BlockDataTest`: los vectores con `unpublished` salen de `test_live_slots_by_vector` y C10-1 se fija en `test_currently_unpublished_slot_is_live_in_the_schedule_block` (el bloque de horario aún marca en directo la franja del borrador con nombre vacío); la 2.5 lo pasa a regresión y devuelve esos vectores al proveedor.

### 2.5 C10 y contraseña en los cinco puntos de entrada (`fix-bug`) (≤ 1 h)
- Qué: `Program_Repository::data()` rechaza `post_password` no vacío cuando se pide publicado; `Program_Repository::public_programs( array $schedule ): array<int, data>` (la regla, en un sitio). Los envoltorios (página limpia, `radplapag_build_programs_map()`, `radplapag_get_schedule_for_station()`, `radplapag_get_programs_list_for_station()`, `radplapag_get_now_playing_for_station()`) filtran con `Public_Slots::filter()` antes de resolver; `@since` en sus docblocks. Regresión: `BlockDataTest` (C10 draft, K88 y `test_currently_unpublished_slot_is_live_in_the_schedule_block`, que devuelve los vectores con `unpublished` a `test_live_slots_by_vector`), `BlockDataTest::test_unknown_program_slot_has_empty_name` (aprobado). (`BlockAuditTest` C10 variante y el gemelo de `ScheduleVectorsTest` se adelantaron a la 2.4.) Snapshots de bloques solo con `RADPLAPAG_UPDATE_SNAPSHOTS=1` si cambian (no se espera).
- Archivos: `includes/src/wp/class-program-repository.php`, `radio-player-page.php`, `includes/radplapag-{schedule,programs-list,now-playing}-block.php`, los tests citados, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm run test:php:integration -- --filter 'BlockData|BlockAudit|ScheduleVectors|PublicApi' && npm run lint:phpstan`
- [x] hecha · commit: ver `git log` («fix(0009): leave out slots of non-public programs in the public entry points (2.5)»)
- Rojo visto (4 fallos en `BlockDataTest`): `test_unknown_program_slot_is_left_out` y `test_draft_program_slot_is_left_out` (la franja seguía con nombre vacío), `test_password_protected_program_is_not_public` (`data()` devolvía «Locked») y el vector C10-1 de `test_live_slots_by_vector` (el bloque de horario marcaba en directo `monday  09:30-10:00`). Se borra `test_currently_unpublished_slot_is_live_in_the_schedule_block` y el parámetro `$schedule_expected` que solo usaba él.
- `Program_Repository::public_programs()` sigue el orden de `Schedule_View::program_ids()`. `radplapag_get_now_playing_for_station()` arma su mapa con esos datos (el bucle propio quedó redundante y PHPStan lo marcaba). Docblock de `radplapag_get_program_data()` con la contraseña.
- La página limpia ya filtra, así que la edición aprobada de `clean-page.spec.ts` «skips the raw schedule entries that cannot be printed» (sin la franja del borrador ni la de `'tagged id'`) se adelanta de la 2.6. K78 sigue igual (`[b, c, a]`).
- Changelog: ya anotado en la 2.1 (programas con contraseña y C10).

### 2.6 K78 y K17 en la página limpia (`fix-bug`) (≤ 1 h)
- Qué: el envoltorio imprime `program_ids()` del horario ya impreso (K78) y `Globals_Builder::printable_schedule()` (`stdClass` vacío si no hay franjas; `schedule()` sigue devolviendo array). Regresión: `GlobalsBuilderTest` K17 (sobre `printable_schedule()`), `clean-page.spec.ts` K17 (`{}`) y K78 (`[b, a]`), edición aprobada de «skips the raw schedule entries…», snapshot `minimal.html`. Player: `read-config.test.ts` y `use-config.test.tsx` pierden `currently` (mismo comportamiento).
- Archivos: `includes/src/player/class-globals-builder.php`, `radio-player-page.php`, `tests/php/unit/Player/GlobalsBuilderTest.php`, `tests/e2e/clean-page.spec.ts`, `tests/e2e/snapshots/minimal.html`, `player/src/core/config/read-config.test.ts`, `player/src/hooks/use-config.test.tsx`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm run test:php:unit -- --filter GlobalsBuilder && npm --prefix player run check && npm run test:e2e -- tests/e2e/clean-page.spec.ts`
- [x] hecha · commit: ver `git log` («fix(0009): print the programs of the printed slots and an empty schedule as {} on the clean page (2.6)»)
- Rojo visto: `GlobalsBuilderTest::test_an_empty_schedule_prints_as_a_json_object` («Call to undefined method …printable_schedule()») y en `clean-page.spec.ts` K17 (`Expected: "{}"`, `Received: "[]"`) y K78 (C de más en `[b, c, a]`). Snapshot `minimal.html` regenerado con `--update-snapshots`: solo cambia `RADPLAPAG_SCHEDULE = {}`. La edición de «skips the raw schedule entries…» ya llegó en la 2.5.
- Changelog: ya anotado en la 2.1 (`{}`, también en `== Upgrade Notice ==`).

### 2.7 C10 en el player (`fix-bug`) (≤ 1 h)
- Qué: en `program-schedule.ts`, `findActiveSlot()`, `findIncomingProgram()`, `getProgramsForDay()` y `getAllProgramsWithSlots()` ignoran la franja cuyo `program_id` no está en `programs` (undefined = ninguno). Ediciones aprobadas de los dos tests; test nuevo de la ventana de «Coming up» (un desconocido no tapa al siguiente). Se borran los `ts` de C10 de los vectores.
- Archivos: `player/src/utils/program-schedule.ts`, `program-schedule.test.ts`, `tests/fixtures/schedule-vectors.json`
- Test: regresión (`fix-bug`)
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/schedule.spec.ts tests/e2e/modals.spec.ts`
- [x] hecha · commit: ver `git log` («fix(0009): ignore slots of unknown programs in the player (2.7)»)
- Rojo visto (7 fallos): los dos tests editados, tres nuevos (la franja que empezó antes sigue en antena, la ventana de «Coming up» y `getProgramsForDay()`) y los vectores C10-1 y C10-2 sin `ts` (`programName: ''` en vez de A / C). Arreglo: `isKnownProgram()` filtra en `findActiveSlot()`, `findIncomingProgram()`, `getProgramsForDay()` (y con ella `getProgramsForWeekOrdered()`) y `getAllProgramsWithSlots()`; con `programs` undefined no queda ninguna franja. `_doc` de los vectores sin la nota del `program ""`. E2E de `schedule.spec.ts` y `modals.spec.ts`: 26/26.

### 2.8 Admin: el programa de la franja con su estado (K41, C10) (`fix-bug`) (≤ 1 h)
- Qué: `radplapag_get_station_programs_for_select( $station_id )` (nueva; `radplapag_get_all_programs_for_select()` no cambia): la lista de siempre + el programa de cada franja guardada en cualquier estado, cada uno con `label` («Name (Draft)», «(Trash)», «(Private)», «(Pending)», «(Scheduled)», «(Password protected)»; el nombre solo si es público) y `public`. El meta box la usa e imprime bajo la fila un aviso `.radplapag-program-notice` si el programa no es público. `admin/admin.php` pasa esa lista como `radplapagAdmin.programs`. Textos en `admin/admin-strings.php` (`programNotPublished`). `test_currently_schedule_box_empties_a_slot_whose_program_is_trashed` → regresión; tests del aviso (borrador, contraseña); fixture `station-meta-box.html` regenerado.
- Archivos: `includes/radplapag-program-cpt.php`, `includes/radplapag-station-cpt.php`, `admin/admin.php`, `admin/admin-strings.php`, `tests/php/integration/Admin/AdminScreensTest.php`, `tests/fixtures/admin/station-meta-box.html`, `docs/known-issues.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm run test:php:integration -- --filter AdminScreens && npm test`
- [x] hecha · commit: ver `git log` («fix(0009): keep the program of each slot with its status and warn when it is not public in the station meta box (2.8)»)
- Rojo: `Call to undefined function radplapag_get_station_programs_for_select()`; la franja del programa en la papelera, sin selección (`Array ()`); el borrador y el de contraseña, `>Night Owl</option>` sin estado.
- Hecho: `radplapag_get_station_programs_for_select()` (lista de siempre por título y después los programas de las franjas en otro estado, por orden de aparición; descarta IDs que no son programas), el meta box con `label` y el aviso `<div class="radplapag-program-notice">` dentro de la fila, tras el mensaje de error; `radplapagAdmin.programs` con esa lista; `programNotPublished`; la función nueva en `PublicApiTest`; una regla de `admin/css/admin.css` para el aviso (ancho completo en la fila flex); el hook de formato reindentó el archivo entero (espacios → tabuladores), sin cambio de comportamiento. Excepción aprobada: `test_station_screen_localizes_radplapag_admin` (ver «Contexto»). El JS de `station-admin.js` aún construye las opciones con `name` (2.9).
- Changelog: en el admin, la franja de un programa no publicado conserva su programa, con su estado, y avisa de que no sale en el sitio (con la 2.9).

### 2.9 Admin JS: el aviso al elegir un programa no publicado (≤ 1 h)
- Qué: `station-admin.js` construye las opciones con `label`, muestra u oculta el aviso al cambiar el selector (y en filas nuevas) con `textContent`; la validación acepta los programas no públicos de la lista, así que se puede enviar. `SanitizeScheduleTest` y `SlotValidatorTest`: `test_currently_accepts_draft_program` → `test_accepts_draft_program` (mismo comportamiento). Fila C10 y K41 → corregido.
- Archivos: `admin/js/station-admin.js`, `tests/js/admin/station-validation.test.js`, `tests/js/admin/support/mount-station-screen.js` (si hace falta `public`), `tests/php/unit/Schedule/SlotValidatorTest.php`, `tests/php/integration/Schedule/SanitizeScheduleTest.php`, `docs/known-issues.md`
- Test: primero (TDD): `station-validation.test.js` (aviso al elegir un borrador; con él, el envío no se bloquea)
- Verificación: `npm test && npm run check`
- [x] hecha · commit: ver `git log` («fix(0009): show the notice for a program that is not public when it is chosen in the station meta box (2.9)»)
- Rojo visto (5 fallos): las opciones de una fila nueva con `name` en vez de `label` y el aviso, que no salía ni se iba al cambiar el selector. «saves a slot whose program is not public» ya pasaba (desde la 2.8 la lista incluye los no públicos); mutación: `programIds()` sin los no públicos → falla.
- Hecho: `buildProgramSelect()` usa `label` (o `name` si falta); `updateProgramNotice()` en el evento `change` del contenedor (vale para filas nuevas) pone o quita `.radplapag-program-notice` con `textContent` y `decodeEntities()` (`programNotPublished`, con el texto inglés de respaldo); un programa sin `public` cuenta como público. `adminData()` del soporte con la forma de `radplapag_get_station_programs_for_select()` (los tres programas del fixture), así que `admin-dom.test.js` «builds the row with the default strings» gana la opción «Draft Show (Draft)» (excepción aprobada del «Contexto»). `test_currently_accepts_draft_program` → `test_accepts_draft_program` en unit e integración; comentario de `radplapag_sanitize_station_schedule()`.
- Changelog: ya anotado en la 2.8.

## Decisiones abiertas → ADR
- ADR 0045 (tarea 2.1). Ninguna otra prevista.

## Cierre (2026-10-23)
- `npm run check` en verde (cobertura incluida: núcleo PHP, TS puro y JS admin sobre sus umbrales). Integración 976/976 y e2e 231/231 en WP 6.6 + PHP 7.4 y en la última WP + PHP 8.4. Builds sin diff, `check:zip` en verde. CI del PR tras el push.
- Revisión mínima (decisión del usuario): `spec-conformance-reviewer` y `backcompat-reviewer`. Backcompat sin hallazgos de contrato. Conformidad: columnas de `known-issues.md` (Estado/decisión) y referencias a tests corregidas, excepciones aprobadas añadidas a §4.3 de la spec y al «Contexto», nota de release ampliada. `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` quedan para antes de la release (`docs/status.md`).
