# Spec 0005 · Fase 1 — Cimientos y horario en PHP
Estado: en curso · Inicio: 2026-10-20 · ADRs: 0017, 0021, 0024, 0028 (nuevo)

## Contexto (medido al planificar)

- La lógica del horario está en cuatro archivos: `includes/radplapag-schedule-block.php` (`radplapag_parse_time_to_minutes`, `radplapag_is_slot_active`, `radplapag_get_schedule_day_keys_and_labels`, `radplapag_build_programs_map`, `radplapag_get_schedule_for_station`), `includes/radplapag-now-playing-block.php`, `includes/radplapag-programs-list-block.php` y `radplapag_sanitize_station_schedule()` en `includes/radplapag-station-cpt.php:261`.
- Lo que hoy ata esa lógica a WordPress: `__()` (etiquetas de día y mensajes), `wp_timezone()`, `radplapag_get_program_data()`, `get_permalink()` y `sanitize_text_field()` sobre `program_id` (bloque de horario siempre; lista de programas solo si no es numérico). Para no cambiar ningún caso límite, el núcleo recibe el saneador como `callable` (el envoltorio pasa `'sanitize_text_field'`), las etiquetas ya traducidas y los programas ya cargados (`id => datos`). Cargar los programas de antemano en lugar de bajo demanda no cambia el resultado (lecturas sin efectos).
- `radplapag_sanitize_station_schedule()` compara con `strtotime( '2000-01-01 HH:MM:00' )`. Con la regex `HH:MM` ya aplicada, equivale a minutos (+1440 si `end <= start`); el núcleo usa minutos. El `trim()` sin `is_string()` (K38) se conserva tal cual.
- Caracterización ya existente de la zona: `ScheduleHelpersTest` (unit), `SanitizeScheduleTest`, `ScheduleVectorsTest`, `BlockDataTest`, `SiteTimezoneTest` (integración), snapshots de bloques y e2e. No se ha detectado ningún hueco a priori; la cobertura por función no se pudo medir al planificar (el entorno de tests está arrancado sin Xdebug: `coverage/php-xml` no se genera). La tarea 1.6 la mide antes de mover nada y caracteriza lo que falte.
- No hay Xdebug ni pcov en el PHP local (8.5). **Cobertura del núcleo (§4.4, decisión del plan):** se añade una segunda `testsuite` (`unit`, `tests/php/unit`) a `phpunit-integration.xml.dist`. El informe de wp-env ya incluye `includes/**`, así que cuenta lo que prueban los tests unitarios, y de paso la suite unit corre también en PHP 7.4 + WP 6.6. `tests/php/integration/bootstrap.php` define `RADPLAPAG_TESTS_PLUGIN_DIR` si falta. Va en el ADR 0028.
- `scripts/check-php-coverage.mjs` solo conoce las zonas `critical` y `rest`; se generaliza a zonas en orden (las de glob descuentan las líneas reclamadas por las anteriores) con `exclude` opcional, para la zona `core` (`includes/src/**` menos `includes/src/wp/**`, `min: 90`).
- PHPStan: la baseline tiene entradas en `radplapag-schedule-block.php`, `-programs-list-block.php`, `-now-playing-block.php` y `-station-cpt.php`. Las que desaparezcan al adelgazar los envoltorios salen en el mismo commit; el código nuevo entra sin entradas.
- `RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES` sigue definida donde está; el envoltorio pasa su valor al resolutor.

## Objetivo

Montar los cimientos del código nuevo (ADR, autoloader, guardias de arquitectura, zip y cobertura) y mover la lógica del horario de PHP a `RadioPlayerPage\Schedule\…`, con TDD, dejando las funciones `radplapag_*` como envoltorios finos sin cambiar ningún comportamiento.

## Criterios de aceptación

| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A1 Comportamiento sin cambios | `npm run check`; `npm run test:php:integration`, `:ms` y `npm run test:e2e` en `env:start:min` y `env:start:latest`; `git diff trunk -- tests/php/integration tests/e2e/snapshots tests/e2e/a11y-baseline.json` solo con altas (bootstrap y `PublicApiTest`) |
| A2 Contrato PHP | `HooksTest` sin cambios; `tests/php/integration/Contract/PublicApiTest.php` (1.2) en verde en las dos puntas |
| A3 Núcleo sin WordPress | `tests/php/unit/Architecture/PureCoreTest.php`; los tests del núcleo pasan con `npm run test:php:unit` (sin Docker) |
| A4 (PHP) Vectores | `tests/php/unit/Schedule/ScheduleVectorsTest.php` (resolución, `tz` y validación capa `php`); `schedule-vectors.json` sin cambios (`git diff trunk -- tests/fixtures`) |
| A5 (núcleo y zonas PHP) | `node scripts/check-php-coverage.mjs coverage/php-xml` con la zona `core` ≥ 90 % y `critical`/`rest` en verde |
| A6 Estándares | `npm run lint:php` y `npm run lint:phpstan`; `git diff trunk -- phpstan-baseline.neon` solo con bajas; `grep -rn 'phpcs:' includes/src` vacío |
| A9 Zip | `npm run check:zip` con `tests/zip/expected-additions.txt` = los archivos de `includes/src/` creados |

## Tareas

### 1.1 ADR 0028 y contrato (≤ 1 h)
- Qué: ADR 0028 «Código nuevo en `includes/src/` con autoloader propio» (D1–D3, §4.5 del zip, decisión de cobertura de esta fase). `SPEC.md` §3.4 (namespace interno) y §3.6 (`radplapag-schedule-rules`, alta prevista para la fase 2). `php.md` y `admin.md` con la convención de nombres y la capa pura / adaptador / envoltorio. Índice de ADRs.
- Archivos: `docs/adr/0028-*.md`, `docs/adr/README.md`, `SPEC.md`, `.claude/rules/php.md`, `.claude/rules/admin.md`.
- Test: — (documentación).
- Verificación: `grep -n 'RadioPlayerPage' SPEC.md && grep -n '0028' docs/adr/README.md`
- Resultado: ADR 0028 aceptado (D1–D3, capas, namespace interno, zip con altas, segunda `testsuite` para la cobertura del núcleo y zonas en orden). `SPEC.md` §3.4 (namespace interno) y §3.6 (`radplapag-schedule-rules`, alta prevista en la fase 2); el historial (§6) lo actualiza la tarea 4.4. `php.md` (nombres, `expected-additions.txt`, tres capas) y `admin.md` (`schedule-rules.js`, sin script modules). `npm run check` en verde.
- [x] hecha · commit: (este)

### 1.2 Inventario de la API pública (≤ 1 h)
- Qué: `PublicApiTest` con la lista fija (constante del test) de cada función `radplapag_*`, clase `Radplapag_*` (métodos públicos) y constante `RADPLAPAG_*` de la 3.4.2: nombre, parámetros (nombre, tipo, opcional, valor por defecto, por referencia) y tipo de retorno, comprobados por reflexión. Incluye `admin/` (cargado como en `AdminScreensTest`) y `blocks/*/render.php`; las de `uninstall.php` se comprueban por tokens (cargarlo borra datos). La lista se genera una vez desde el código de hoy y se contrasta con `git show v3.4.2:<archivo>`.
- Archivos: `tests/php/integration/Contract/PublicApiTest.php`.
- Test: caracterización: el propio archivo (mutación: renombrar un parámetro en local y verlo fallar).
- Verificación: `npm run test:php:integration -- --filter PublicApiTest`
- [ ] hecha · commit: —

### 1.3 Guarda del zip con altas declaradas (≤ 1 h)
- Qué: `tests/zip/expected-additions.txt` (vacío por ahora) y la comparación extraída a `tests/zip/compare-lists.sh <referencia> <actual> <altas>`: acepta exactamente referencia + altas; falla si falta o sobra una ruta, o si un alta ya estaba en la referencia. `compare-with-v3.4.2.sh` la usa. `check:zip` ejecuta antes su test.
- Archivos: `tests/zip/compare-lists.sh`, `tests/zip/compare-lists.test.sh`, `tests/zip/compare-with-v3.4.2.sh`, `tests/zip/expected-additions.txt`, `package.json`, `CLAUDE.md` (tabla de comandos).
- Test: primero (TDD): `tests/zip/compare-lists.test.sh`.
- Verificación: `npm run check:zip`
- [ ] hecha · commit: —

### 1.4 Autoloader (≤ 1 h)
- Qué: `RadioPlayerPage\Autoloader` (`register()`, `file_for( $class )`): prefijo `RadioPlayerPage\` → `includes/src/`, segmentos en minúsculas, `_` → `-`, archivo `class-<nombre>.php`; `null` fuera del prefijo. `radio-player-page.php` hace `require_once` del autoloader y `register()` antes de los demás `includes/` (orden actual intacto). `tests/php/unit/bootstrap.php` lo registra. Alta en `expected-additions.txt`.
- Archivos: `includes/src/class-autoloader.php`, `radio-player-page.php`, `tests/php/unit/bootstrap.php`, `tests/php/unit/AutoloaderTest.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/AutoloaderTest.php`.
- Verificación: `npm run test:php:unit && npm run lint:php && npm run check:zip`
- [ ] hecha · commit: —

### 1.5 Guarda de arquitectura del núcleo (≤ 1 h)
- Qué: `PureCoreTest` recorre `includes/src/**/*.php` salvo `wp/`, tokeniza (`token_get_all`) y falla con cualquier llamada a función de WordPress o del plugin (prefijos `get_`, `update_`, `delete_`, `add_`, `wp_`, `esc_`, `sanitize_`, `is_`… de una lista cerrada de funciones de WP, `__`, `_e`, `_x`, `_n`, `apply_filters`, `do_action`, `current_user_can`, `absint`, `radplapag_`), y con `WP_*` en `new`/tipos. También comprueba que cada archivo empieza con `defined( 'ABSPATH' ) || exit;` y declara una sola clase. El escáner se prueba con fragmentos de código en el mismo test (uno limpio y uno con cada tipo de violación).
- Archivos: `tests/php/unit/Architecture/PureCoreTest.php`.
- Test: primero (TDD): el propio archivo.
- Verificación: `npm run test:php:unit -- --filter PureCoreTest`
- [ ] hecha · commit: —

### 1.6 Cobertura del núcleo y medición de partida (≤ 1 h)
- Qué: `testsuite` `unit` en `phpunit-integration.xml.dist`; `RADPLAPAG_TESTS_PLUGIN_DIR` en el bootstrap de integración. `check-php-coverage.mjs` con zonas en orden y `exclude` (Vitest primero); zona `core` (`min: 90`) en `php-zones.json`. Medir con Xdebug la cobertura por función de las cuatro zonas que se mueven; si alguna rama no está cubierta, caracterizarla en un commit propio `test(0005): …` antes de 1.7 y anotarlo aquí.
- Archivos: `phpunit-integration.xml.dist`, `tests/php/integration/bootstrap.php`, `scripts/check-php-coverage.mjs`, `tests/js/scripts/check-php-coverage.test.js` (+ fixture si hace falta), `tests/coverage/php-zones.json`, `CLAUDE.md` (nota en `test:php:integration`).
- Test: primero (TDD): `tests/js/scripts/check-php-coverage.test.js`.
- Verificación: `npm test -- tests/js/scripts && npm run env:start:latest -- --xdebug=coverage && npm run test:php:integration:coverage && node scripts/check-php-coverage.mjs coverage/php-xml`
- [ ] hecha · commit: —

### 1.7 `Schedule\Time` y `Schedule\Week` (≤ 1 h)
- Qué: `Time::to_minutes()` (mismas reglas laxas que hoy) y `Time::is_slot_active()`; `Week::KEYS` (lunes–domingo), conversión clave ↔ día de PHP (`w`) y `Week::local_day_and_minutes( DateTimeImmutable )`. Tests de medianoche, cambio de día, horario de verano (`Europe/Madrid` en el cambio), desfases `-05:00` y `+05:30` (con los vectores `tz`), y `test_currently_*` de C16 replicado. Envoltorios: `radplapag_parse_time_to_minutes()`, `radplapag_is_slot_active()` y las claves de `radplapag_get_schedule_day_keys_and_labels()` delegan; `ScheduleHelpersTest` sin cambios. Fila C16 de `known-issues.md` apunta también al test nuevo.
- Archivos: `includes/src/schedule/class-time.php`, `includes/src/schedule/class-week.php`, `includes/radplapag-schedule-block.php`, `tests/php/unit/Schedule/TimeTest.php`, `tests/php/unit/Schedule/WeekTest.php`, `expected-additions.txt`, `phpstan-baseline.neon`, `docs/known-issues.md`.
- Test: primero (TDD): `TimeTest`, `WeekTest`.
- Verificación: `npm run test:php:unit && npm run lint:php && npm run lint:phpstan && npm run test:php:integration -- --filter 'Schedule|Block'`
- [ ] hecha · commit: —

### 1.8 `Schedule\Slot_Validator` (≤ 1 h)
- Qué: `validate( $input, array $program_names )` → `array{ schedule, errors }`, con errores `{ code, day, program, other, next_day }` y los códigos de los vectores (`required`, `invalid_program`, `format`, `end_before_start`, `overlap`, `cross_midnight_overlap`). Mismo orden de días y filas, mismo corte en el primer solape entre días. Casos de `SanitizeScheduleTest` replicados en unit; `test_currently_*` de C3 (start = end aceptado), C10 (borrador aceptado) y K38 (`trim()` de un array), con sus filas de `known-issues.md` apuntando también aquí. Vectores de validación capa `php` en `tests/php/unit/Schedule/ScheduleVectorsTest.php`.
- Archivos: `includes/src/schedule/class-slot-validator.php`, `tests/php/unit/Schedule/SlotValidatorTest.php`, `tests/php/unit/Schedule/ScheduleVectorsTest.php`, `expected-additions.txt`, `docs/known-issues.md`.
- Test: primero (TDD): `SlotValidatorTest`, `ScheduleVectorsTest` (validación).
- Verificación: `npm run test:php:unit && npm run lint:php && npm run lint:phpstan`
- [ ] hecha · commit: —

### 1.9 `radplapag_sanitize_station_schedule()` delega (≤ 1 h)
- Qué: el envoltorio carga los nombres (`radplapag_get_program_data()`), llama al validador y traduce los códigos con `WP\Schedule_Messages` (los mismos `__()` y `/* translators: */` de hoy, unidos con `' '` en un `WP_Error( 'radplapag_schedule_validation' )`). El adaptador entra en la zona `critical`. `SanitizeScheduleTest`, `SaveStationMetaTest` y e2e del admin sin cambios.
- Archivos: `includes/radplapag-station-cpt.php`, `includes/src/wp/class-schedule-messages.php`, `tests/coverage/php-zones.json`, `expected-additions.txt`, `phpstan-baseline.neon`.
- Test: caracterización: `SanitizeScheduleTest`, `SaveStationMetaTest` (existentes).
- Verificación: `npm run lint:php && npm run lint:phpstan && npm run test:php:integration -- --filter 'Sanitize|SaveStation|AdminScreens'`
- [ ] hecha · commit: —

### 1.10 `Schedule\Now_Playing_Resolver` (≤ 1 h)
- Qué: `resolve( array $schedule, array $programs, array $day_labels, DateTimeImmutable $now, int $window )` → `current`/`upcoming` con la misma forma (sin `logo_id` en `upcoming`). Vectores `resolution` (resultado PHP de primer nivel; los `currently` de C16) en `ScheduleVectorsTest` unit, más medianoche, DST y desfases.
- Archivos: `includes/src/schedule/class-now-playing-resolver.php`, `tests/php/unit/Schedule/NowPlayingResolverTest.php`, `tests/php/unit/Schedule/ScheduleVectorsTest.php`, `expected-additions.txt`.
- Test: primero (TDD): `NowPlayingResolverTest`, `ScheduleVectorsTest` (resolución).
- Verificación: `npm run test:php:unit && npm run lint:php && npm run lint:phpstan`
- [ ] hecha · commit: —

### 1.11 `radplapag_get_now_playing_for_station()` delega (≤ 1 h)
- Qué: el envoltorio valida el índice, calcula `station_page_url`, carga los programas publicados del horario y pasa la hora de `WP\Clock::now()` (`new DateTimeImmutable( 'now', wp_timezone() )`). `ScheduleVectorsTest` y `SiteTimezoneTest` de integración, snapshots y e2e sin cambios.
- Archivos: `includes/radplapag-now-playing-block.php`, `includes/src/wp/class-clock.php`, `tests/coverage/php-zones.json`, `expected-additions.txt`, `phpstan-baseline.neon`.
- Test: caracterización: `ScheduleVectorsTest`, `SiteTimezoneTest`, `BlockRenderTest` (existentes).
- Verificación: `npm run lint:php && npm run lint:phpstan && npm run test:php:integration -- --filter 'Schedule|Block'`
- [ ] hecha · commit: —

### 1.12 `Schedule\Schedule_View` (≤ 1 h)
- Qué: `program_ids( $schedule )` (lo que hoy recoge `radplapag_build_programs_map()`) y `days( $schedule, $programs_map, $day_labels, $now, $day_order, callable $sanitize_id )` con los días, franjas, `is_live` (C16 replicado como `currently`), orden por inicio y `current_first`/`natural`.
- Archivos: `includes/src/schedule/class-schedule-view.php`, `tests/php/unit/Schedule/ScheduleViewTest.php`, `expected-additions.txt`.
- Test: primero (TDD): `ScheduleViewTest`.
- Verificación: `npm run test:php:unit && npm run lint:php && npm run lint:phpstan`
- [ ] hecha · commit: —

### 1.13 Envoltorios del bloque de horario (≤ 1 h)
- Qué: `radplapag_build_programs_map()` y `radplapag_get_schedule_for_station()` delegan (`sanitize_text_field` como saneador, etiquetas de `radplapag_get_schedule_day_keys_and_labels()`, `get_permalink()` en el envoltorio). `BlockDataTest`, snapshots de bloques y e2e sin cambios.
- Archivos: `includes/radplapag-schedule-block.php`, `tests/coverage/php-zones.json`, `phpstan-baseline.neon`.
- Test: caracterización: `BlockDataTest`, `BlockRenderTest` (existentes).
- Verificación: `npm run lint:php && npm run lint:phpstan && npm run test:php:integration -- --filter 'Block'`
- [ ] hecha · commit: —

### 1.14 `Schedule\Programs_List_View` (≤ 1 h)
- Qué: `program_ids_in_order( $schedule )` y `build( $schedule, $programs, $day_labels, $now, callable $sanitize_id )`: franjas por programa (orden por día e inicio), `is_live`, programas en orden de primera aparición, con `C16` replicado.
- Archivos: `includes/src/schedule/class-programs-list-view.php`, `tests/php/unit/Schedule/ProgramsListViewTest.php`, `expected-additions.txt`.
- Test: primero (TDD): `ProgramsListViewTest`.
- Verificación: `npm run test:php:unit && npm run lint:php && npm run lint:phpstan`
- [ ] hecha · commit: —

### 1.15 Envoltorio de la lista de programas y cierre de la medición (≤ 1 h)
- Qué: `radplapag_get_programs_list_for_station()` delega. Cobertura completa con Xdebug: `core` ≥ 90 %, `critical` y `rest` en verde; si no, tests unitarios que falten. Apuntar las cifras en «Resultado:».
- Archivos: `includes/radplapag-programs-list-block.php`, `tests/coverage/php-zones.json`, `phpstan-baseline.neon`.
- Test: caracterización: `BlockDataTest`, `BlockRenderTest` (existentes).
- Verificación: `npm run check && npm run test:php:integration:coverage && node scripts/check-php-coverage.mjs coverage/php-xml`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- Cobertura del núcleo mediante una segunda `testsuite` en `phpunit-integration.xml.dist` (decidido en este plan, §4.4): va en el ADR 0028 (tarea 1.1).
- Ninguna entrada nueva en la baseline de PHPStan. Si el código nuevo diera un error que no se puede corregir sin cambiar el comportamiento, se para y se pregunta.
