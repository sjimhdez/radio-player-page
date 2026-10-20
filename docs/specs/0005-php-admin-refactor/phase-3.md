# Spec 0005 · Fase 3 — Datos, guardado y globales del player
Estado: en curso · Inicio: 2026-10-21 · ADRs: 0017, 0021, 0024, 0028

## Contexto (medido al planificar)

- Rama `spec/0005-php-admin-refactor` con `origin/trunk` ya fusionado y PR #39 en borrador: sin push ni PR nuevos.
- Lectura: `ConfigTest` (35 tests) fija `radplapag_get_stations()`, `radplapag_get_config()`, `radplapag_get_program_data()`, las dos `Radplapag_*_Config`, `radplapag_get_station_for_current_page()` y `radplapag_get_player_pages_assigned_to_other_stations()`. No hace falta caracterizar más.
- Guardado: `SaveStationMetaTest` y `SaveProgramMetaTest` fijan guardas, saneado, listas blancas, adjuntos, transients y el horario, pero **no el orden de las escrituras** (riesgo 6): se caracteriza en la 3.2. `filter_input()` da `null` en CLI, así que el camino con URL válida solo lo cubre e2e (`admin.spec.ts`).
- Globales: `radplapag_output_clean_page()` termina con `exit` y solo se fija por HTTP (`clean-page.spec.ts`, snapshots `minimal` y `mp3`). Falta la meta cruda: `program_id` no numérico (pasa por `sanitize_text_field`), `start` vacío o `'0'` (`empty()`), entradas y días que no son array, `is_rerun` *truthy*, programa en borrador (C10) y título `'0'` (`empty()` → nombre del sitio). Se caracteriza en la 3.1.
- Las listas blancas de tema y visualizador están repetidas en `Radplapag_Station_Config`, el guardado y la página limpia: pasan a constantes de `Data\Station`.
- **Decisión del usuario (2026-10-21):** las guardas (nonce, capacidad, autosave, tipo de post) y la lectura de `$_POST` se quedan en `radplapag_save_*_meta()`, con su `phpcs:ignore` de siempre. WPCS (`NonceVerification`) exige el nonce en la misma función que lee `$_POST`, y mover el horario crudo al adaptador metería una supresión en `includes/src/` (A6). El adaptador recibe `( $post_id, array $input )`, sanea, valida y escribe; así el camino con URL válida también se prueba en integración. Desviación de la letra de §4.3, anotada en `docs/status.md`.
- Como en la fase 1, el núcleo recibe como `callable` los saneadores de WP que hoy se aplican sobre los datos (`sanitize_text_field`, `sanitize_key`), y el adaptador hace antes las lecturas de WP: adjuntos, mime, páginas asignadas y programas. Son lecturas sin efectos. Las páginas asignadas se siguen leyendo solo si `player_page > 0`.
- Fuera de §4.3, sin cambios: `radplapag_get_all_programs_for_select()`. `Radplapag_Program_Config` ya delega en `radplapag_get_program_data()`.
- PHPStan: las entradas de las funciones que adelgazan salen en el mismo commit. Las de firma (tipos de `array` de los envoltorios) se quedan. El código nuevo entra sin entradas.

## Objetivo

Mover la lectura de emisoras y programas, el guardado de sus campos y el armado de las globales del player al núcleo `RadioPlayerPage\` (TDD) y a adaptadores de WP, y dejar las funciones y clases de siempre como envoltorios, sin cambiar ningún comportamiento (C13, K17, K21, K34, K37 y K43 se conservan).

## Criterios de aceptación

| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A1 Comportamiento sin cambios | `npm run check`; `npm run test:php:integration`, `:ms` y `npm run test:e2e` en `env:start:min` y `env:start:latest`; `git diff trunk -- tests/php/integration/snapshots tests/e2e/snapshots tests/e2e/a11y-baseline.json` vacío; en `tests/php/integration` y `tests/e2e`, solo altas (3.1, 3.2, 3.8) |
| A2 Contrato PHP | `HooksTest` sin cambios; `PublicApiTest` en verde en las dos puntas |
| A3 Núcleo sin WordPress | `tests/php/unit/Architecture/PureCoreTest.php`; los tests de `tests/php/unit/{Data,Station,Program,Player}/` con `npm run test:php:unit` |
| A5 Cobertura | `node scripts/check-php-coverage.mjs coverage/php-xml`: `core` ≥ 90 %, `critical` (con los adaptadores nuevos) y `rest` en verde |
| A6 Estándares | `npm run lint:php` y `npm run lint:phpstan`; `grep -rn 'phpcs:' includes/src` vacío; `git diff trunk -- phpstan-baseline.neon` solo con bajas |
| A9 Zip | `npm run check:zip` con los archivos nuevos de `includes/src/` en `tests/zip/expected-additions.txt` |

## Tareas

### 3.1 Caracterización: globales con meta cruda (≤ 1 h)
- Qué: test nuevo en `clean-page.spec.ts`. Escribe con `wpCli` en `station-minimal` una meta de horario cruda: `program_id` no numérico y `' 7'`, `start` `''` y `'0'`, entrada y día que no son array, `is_rerun: "yes"`, un programa en borrador (C10) y un día que queda vacío. Cambia también el título de la emisora a `'0'`. Fija `RADPLAPAG_SCHEDULE`, `RADPLAPAG_PROGRAMS` y `siteTitle`, y restaura en `finally` (patrón del test del favicon; `workers: 1`).
- Archivos: `tests/e2e/clean-page.spec.ts`.
- Test: caracterización: `tests/e2e/clean-page.spec.ts` (validada con una mutación temporal).
- Verificación: `npx playwright test tests/e2e/clean-page.spec.ts --project=chromium`
- [x] hecha · commit: (este)
- Resultado: 3 tests nuevos (18 → 21 en Chromium), solo altas, con un helper `withRawSchedule()` que escribe la meta con `wpCli`, crea el programa en borrador y lo deshace en `finally`. Fijado: `program_id` no numérico pasa por `sanitize_text_field()` (`<b>tagged</b> id` → `tagged id`), `' <id>'` y el número JSON salen como cadena del entero, `start` `''` y `'0'` y `end` `''` quitan la franja, la entrada y el día que no son array se saltan, el día que queda vacío no sale, `is_rerun: "yes"` → `true` y `0` → `false`, la franja del borrador se queda en `RADPLAPAG_SCHEDULE` y el programa no sale en `RADPLAPAG_PROGRAMS` (C10), y con el título `'0'` `siteTitle` y `<title>` dicen el nombre del sitio. En lugar del `' 7'` literal del plan va `' <ID de B>'`, para que además se resuelva en `RADPLAPAG_PROGRAMS`. Rareza nueva: K78 (un programa cuya única franja se quita sale igual en `RADPLAPAG_PROGRAMS`; orden `B, C, A`), con su test `currently`. Mutaciones en `radio-player-page.php`, revertidas: `empty( $start )` → `'' === $start`, `! empty( $station_title )` → `'' !== $station_title` y saltar las entradas sin `start` al armar los programas: falla cada test.

### 3.2 Caracterización: orden de las escrituras del guardado (≤ 1 h)
- Qué: registra con `added_post_meta`, `updated_post_meta`, `setted_transient` y `deleted_transient` la secuencia de claves de un guardado de emisora con errores de campo y horario válido, de otro con horario inválido, y del guardado de un programa.
- Archivos: `tests/php/integration/Station/SaveStationMetaTest.php`, `tests/php/integration/Cpt/SaveProgramMetaTest.php` (altas).
- Test: caracterización (mutación temporal: cambiar el orden de dos `update_post_meta`).
- Verificación: `npm run test:php:integration -- --filter 'SaveStationMetaTest|SaveProgramMetaTest'`
- [x] hecha · commit: (este)
- Resultado: 3 tests nuevos, solo altas (2 en `SaveStationMetaTest`, 1 en `SaveProgramMetaTest`; 57 → 60 con los dos filtros). Emisora con errores de campo y horario válido: `setted_transient` de campos, las cinco metas en el orden del formulario (fondo, logo, audio, tema, visualizador), `deleted_transient` del error de horario y la meta del horario. Con horario inválido: lo mismo y al final `setted_transient` del error de horario, sin meta de horario. Programa: descripción, descripción extendida y logo. La emisora empieza sin meta (todo es `added_post_meta`) y el error de horario se siembra antes, porque WP solo dispara `deleted_transient` si existía y los hooks de meta si el valor cambia. El camino con URL válida (borrar el transient de campos y escribir URL y página) no se alcanza en CLI: lo cubrirá `StationMetaSaverTest` en la 3.8. Mutaciones, revertidas: intercambiar tema y visualizador (emisora) y las dos descripciones (programa) falla los tres tests; borrar el error de horario después de escribir la meta falla el de horario válido. Sin rarezas nuevas.

### 3.3 `Data\Station` (≤ 1 h)
- Qué: constantes `THEMES` y `VISUALIZERS`, y `row( int $id, string $title, array $meta ): array` con la forma de `Radplapag_Station_Config::to_array()`: JSON del horario (solo una cadena no vacía que decodifica a array), listas blancas, casts.
- Archivos: `includes/src/data/class-station.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Data/StationTest.php`.
- Verificación: `npm run test:php:unit -- --filter StationTest && npm run check:zip`
- [x] hecha · commit: (este)
- Resultado: `Data\Station` con `THEMES`, `VISUALIZERS` y `row( $id, $title, $meta )`; `$meta` va por meta key (`radplapag_station_*`) y la clave que falta se lee como `''`, igual que `get_post_meta( ..., true )`. 24 tests en `StationTest`, en rojo primero (clase inexistente). Fijado: el horario solo se decodifica de una cadena no vacía que da array y se devuelve tal cual (una lista JSON o entradas crudas también); tema y visualizador fuera de la lista blanca, con otra mayúscula, con espacios o que no son cadena pasan al primero; `stream_url` solo si es cadena, sin recortar; los IDs con `(int)` (`'12abc'` → 12, `'-4'` → -4). Las demás copias de las listas blancas (guardado, página limpia, migrador) se cambian en sus tareas; la del migrador no está en el plan de la fase y no se toca. Sin entradas de baseline.

### 3.4 `Data\Stations` (≤ 1 h)
- Qué: `for_page( array $stations, int $page_id )`, la primera emisora con `player_page` igual y `stream_url` no vacía, o `false`, y `player_pages( array $page_by_station, int $exclude ): array`, con las páginas únicas, sin vacías y sin la de la emisora excluida.
- Archivos: `includes/src/data/class-stations.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Data/StationsTest.php`.
- Verificación: `npm run test:php:unit -- --filter StationsTest && npm run check:zip`
- [x] hecha · commit: (este)
- Resultado: `Data\Stations` con `for_page( $stations, $page_id )` y `player_pages( $page_by_station, $exclude )`. 13 tests en `StationsTest`, en rojo primero (clase inexistente). Fijado como en la 3.4.2: `for_page` devuelve la fila tal cual, gana la primera, compara la página con `intval()` (`'10abc'` → 10) y la URL con `empty()` (`''`, `'0'` y `null` se saltan), salta las filas sin `player_page` o `stream_url` (o con `null`) y las que no son array, y con página 0 casa con una emisora sin página (K24). `player_pages` recibe la meta cruda por ID de emisora, la pasa por `(int)`, quita las ≤ 0 y las repetidas (orden de primera aparición) y solo excluye si `$exclude > 0`; la misma página de otra emisora se queda. La guarda `is_array()` es nueva: en la 3.4.2 las filas siempre son arrays (`radplapag_get_config()`). Sin entradas de baseline.

### 3.5 La lectura de emisoras delega (≤ 1 h)
- Qué: `WP\Station_Repository` con `row( WP_Post )`, que lee la meta y llama a `Data\Station::row`, `published_rows()` y `player_pages_except( int )`. Delegan `Radplapag_Station_Config::to_array()`, `radplapag_get_stations()`, `radplapag_get_station_for_current_page()` y `radplapag_get_player_pages_assigned_to_other_stations()`, con un `@since 3.5.0` que dice que delegan. El repositorio va a la zona `critical`; salen las entradas de baseline que desaparezcan.
- Archivos: `includes/src/wp/class-station-repository.php`, `includes/data/class-radplapag-station-config.php`, `includes/radplapag-stations.php`, `includes/radplapag-station-cpt.php`, `radio-player-page.php`, `tests/coverage/php-zones.json`, `tests/zip/expected-additions.txt`, `phpstan-baseline.neon`.
- Test: caracterización: `ConfigTest`, `PublicApiTest`, `HooksTest` (sin cambios).
- Verificación: `npm run test:php:integration -- --filter 'ConfigTest|PublicApiTest|HooksTest' && npm run lint:php && npm run lint:phpstan`
- [x] hecha · commit: (este)
- Resultado: `WP\Station_Repository` con `row( WP_Post )` (lee las ocho metas en el orden de la 3.4.2 y llama a `Data\Station::row`), `published_rows()` (mismo `get_posts` y la guarda del tipo de post de `from_post()`) y `player_pages_except( int )` (IDs en cualquier estado → `Data\Stations::player_pages`). Las cuatro funciones de siempre son envoltorios de una línea con su `@since 3.5.0`; `radplapag_get_station_for_current_page()` sigue leyendo `radplapag_get_config()` y delega en `Data\Stations::for_page`. Repositorio en la zona `critical` y en `expected-additions.txt`. `ConfigTest`, `PublicApiTest` y `HooksTest` sin cambios (49 tests), integración completa (692), `npm run check` y `clean-page.spec.ts` + `admin.spec.ts` en Chromium (35) en verde. Baseline sin cambios: las entradas de estas funciones son de firma (tipos de `array`) y se quedan; ninguna desaparece. Sin rarezas nuevas.

### 3.6 `Data\Program` y la lectura de programas (≤ 1 h)
- Qué: `Data\Program::data( string $title, $description, $extended, int $logo_id, $logo_url ): array` con la forma de hoy, y `WP\Program_Repository::data( int $post_id, bool $require_published ): ?array`. Delega `radplapag_get_program_data()`.
- Archivos: `includes/src/data/class-program.php`, `includes/src/wp/class-program-repository.php`, `includes/radplapag-program-cpt.php`, `tests/coverage/php-zones.json`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Data/ProgramTest.php`; caracterización: `ConfigTest`.
- Verificación: `npm run test:php:unit -- --filter ProgramTest && npm run test:php:integration -- --filter 'ConfigTest|PublicApiTest'`
- [ ] hecha · commit: —

### 3.7 `Station\Field_Sanitizer` (≤ 1 h)
- Qué: `sanitize( array $input, callable $is_image, callable $mime_type, array $taken_pages ): array`, que devuelve `values` y `errors`. Aplica las listas blancas y pone a 0 los adjuntos que no son imagen o `audio/mpeg`, sin aviso (K37). Los códigos son `stream_url_required`, `player_page_required` y `player_page_taken`, en el orden de hoy. Sin `__()`.
- Archivos: `includes/src/station/class-field-sanitizer.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Station/FieldSanitizerTest.php`.
- Verificación: `npm run test:php:unit -- --filter 'Station\\\\FieldSanitizerTest'`
- [ ] hecha · commit: —

### 3.8 El guardado de la emisora delega (≤ 1 h)
- Qué: `WP\Station_Meta_Saver::save( int $post_id, array $input )`. Aplica los saneadores de WP (`esc_url_raw`, `absint`, `sanitize_key`), llama al núcleo y traduce los códigos con los textos de hoy. Escribe en el orden de hoy: el transient de campos, la URL y la página solo sin errores, las cinco metas y el horario por `radplapag_sanitize_station_schedule()`. `radplapag_save_station_meta()` conserva las guardas y la lectura de `$_POST` (decisión del usuario). Test nuevo del adaptador con una URL válida.
- Archivos: `includes/src/wp/class-station-meta-saver.php`, `includes/radplapag-station-cpt.php`, `tests/php/integration/Station/StationMetaSaverTest.php`, `tests/coverage/php-zones.json`, `tests/zip/expected-additions.txt`, `phpstan-baseline.neon`.
- Test: caracterización: `SaveStationMetaTest` (incluida la 3.2); el adaptador, primero: `StationMetaSaverTest`.
- Verificación: `npm run test:php:integration -- --filter 'SaveStationMetaTest|StationMetaSaverTest|HooksTest|PublicApiTest' && npm run lint:php && npm run lint:phpstan`
- [ ] hecha · commit: —

### 3.9 El guardado del programa delega (≤ 1 h)
- Qué: `Program\Field_Sanitizer` con el recorte por bytes a 256 y 512 (conserva el caso de un corte dentro de un carácter) y el logo a 0 si no es imagen, y `WP\Program_Meta_Saver::save( int $post_id, array $input )`. `radplapag_save_program_meta()` conserva las guardas y la lectura de `$_POST`. K34 y K43 se conservan.
- Archivos: `includes/src/program/class-field-sanitizer.php`, `includes/src/wp/class-program-meta-saver.php`, `includes/radplapag-program-cpt.php`, `tests/coverage/php-zones.json`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Program/FieldSanitizerTest.php`; caracterización: `SaveProgramMetaTest`.
- Verificación: `npm run test:php:unit -- --filter 'Program\\\\FieldSanitizerTest' && npm run test:php:integration -- --filter 'SaveProgramMetaTest|PublicApiTest'`
- [ ] hecha · commit: —

### 3.10 `Player\Globals_Builder` (≤ 1 h)
- Qué:
  - `program_ids( array $schedule ): array`, en el orden de su primera aparición.
  - `config( array $station, array $media, string $site_title, DateTimeImmutable $now, callable $sanitize_key ): array`, con las listas blancas y `timezoneOffset = $now->getOffset() / 3600` (entero si es exacto, como hoy).
  - `programs( array $data_by_id ): array`.
  - `schedule( array $schedule, callable $sanitize_text ): array`.
  - K17 (`[]`) y K21 (entidades) se conservan, con sus `test_currently_*` replicados.
- Archivos: `includes/src/player/class-globals-builder.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Player/GlobalsBuilderTest.php`, con desfase +5:30, negativo y horario de verano.
- Verificación: `npm run test:php:unit -- --filter GlobalsBuilderTest`
- [ ] hecha · commit: —

### 3.11 La página limpia delega (≤ 1 h)
- Qué: `radplapag_output_clean_page()` conserva las guardas, el manifiesto, la plantilla y `exit`. Obtiene las URL de los medios y los programas (`radplapag_get_program_data( $id, true )`) y arma las tres globales con `Globals_Builder` y `WP\Clock::now()`. Salen las entradas de baseline que desaparezcan.
- Archivos: `radio-player-page.php`, `phpstan-baseline.neon`.
- Test: caracterización: `tests/e2e/clean-page.spec.ts` (incluida la 3.1) y los snapshots `tests/e2e/snapshots/` sin cambios.
- Verificación: `npx playwright test tests/e2e/clean-page.spec.ts && git diff --exit-code trunk -- tests/e2e/snapshots`
- [ ] hecha · commit: —

### 3.12 Cobertura y baseline de la fase (≤ 1 h)
- Qué: mide la cobertura con los adaptadores nuevos en `critical` y el núcleo en `core` (≥ 90 %). Caracteriza lo que falte y comprueba que la baseline solo ha bajado.
- Archivos: `tests/coverage/php-zones.json` y los tests que falten.
- Test: —
- Verificación: `npm run test:php:integration:coverage && node scripts/check-php-coverage.mjs coverage/php-xml && git diff trunk -- phpstan-baseline.neon`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- Ninguna nueva. La lectura de `$_POST` en el envoltorio la decidió el usuario al planificar y va como desviación en `docs/status.md`.

## Verificación de la fase (en `close-phase`)

`npm run check`, integración y `:ms` y e2e completos en `env:start:min` y `env:start:latest`, cobertura PHP por zonas, `check:zip`; revisores (spec-conformance, backcompat, wp-security, wporg).
