# Spec 0002 · Fase 1 — Caracterización unit e integración
Estado: en curso · Inicio: 2026-10-16 · ADRs: 0001, 0003, 0004, 0005, 0006, 0017, 0018, 0021

## Contexto
Esto es lo que se midió al planificar (2026-10-16) y da forma al plan:

- **La rama** `spec/0002-safety-net` está en `origin/trunk` + 1 commit (la spec), sin push y sin PR. No hace falta fusionar `trunk`.
- **Admin solo con `is_admin()`.** `admin/admin.php` y los hooks de guardado, meta boxes y avisos (`radplapag-station-cpt.php:883`, `radplapag-program-cpt.php:334`) solo se cargan si `is_admin()` es verdadero cuando se carga el plugin. En el bootstrap de integración es falso, así que faltarían callbacks de `SPEC.md` §3.4. **Decisión:** el bootstrap (código de test) hace que `is_admin()` sea verdadero mientras se carga el plugin. Cada test fija después su pantalla con `set_current_screen()` (`'front'` para el lado público). Mecanismo, de preferencia a reserva: pantalla de admin en `muplugins_loaded` → `WP_ADMIN`. **Elegido en la 1.1:** pantalla de admin. En `muplugins_loaded`, el bootstrap carga `class-wp-screen.php` y `screen.php`, hace `set_current_screen( 'dashboard' )`, carga el plugin y deja `$current_screen` a `null`; funciona en las dos puntas. `WP_ADMIN` se descarta porque haría `is_admin()` verdadero en toda la ejecución.
- **`filter_input()` en CLI** devuelve `null` (`radplapag-station-cpt.php:723`, `:811`; `admin/admin.php:48`). En integración, la URL del stream siempre llega vacía y el cuerpo del aviso de errores es inalcanzable. **Decisión del usuario:** la integración fija lo que sí llega. El guardado correcto de URL y página, el aviso tras guardar y **C13** pasan al escenario 10 de e2e (fase 2). Es una desviación de §5, que ponía C13 en la fase 1.
- **Cobertura por función.** El clover de php-code-coverage 9 solo lista métodos de clase, no funciones globales (`Report/Clover.php`). El informe `--coverage-xml` sí lista cada función con su cobertura (`Report/Xml/Facade.php:164`). **Decisión:** `scripts/check-php-coverage.mjs` lee `--coverage-xml` y mide la zona crítica por función. Es una desviación de §4.5 (clover), pero conserva la granularidad que pide la spec.
- **Rutas de la cobertura.** El unit corre en el host y la integración en el contenedor: las rutas no coinciden. Para la cobertura se usa solo la integración, con Xdebug en el contenedor de la punta PHP 8.4. El unit se fusiona con `phpcov` solo si aporta líneas que la integración no cubre; se mide en la 1.20.
- **`uninstall.php`** define funciones y se ejecuta al incluirlo: solo se puede incluir una vez por proceso. Se incluye en `wpSetUpBeforeClass` y los tests de la clase comprueban el resultado. Multisite: una ejecución aparte con `WP_TESTS_MULTISITE=1` (la librería de tests instala un multisite en las tablas `wptests_`, aunque wp-env no lo sea). Si no funciona en las dos puntas, se apunta y queda como verificación manual (riesgo 7).
- **`exit` tras `wp_safe_redirect()`** (`radplapag_handle_migration_notice_dismiss()`): el test engancha `wp_redirect` y lanza una excepción, así que se puede comprobar el estado sin llegar al `exit`. No se toca el código.
- **Helpers puros PHP:** `includes/radplapag-schedule-block.php` se carga sin WordPress (`__()` solo se llama dentro de funciones), así que `radplapag_parse_time_to_minutes()` y `radplapag_is_slot_active()` van a unit.
- **PHP y TS no son simétricos.** PHP elige la franja actual en el orden del array y TS ordena por inicio. Con los vectores aparecerá si difieren: entonces cada vector lleva un resultado `php`/`ts` y una fila en `known-issues.md`. TS: `getProgramsForDay()` solo mira «hoy» (C4 en el util; el modal se confirma en e2e en la fase 2).
- **Locales:** los 14 tienen ya las mismas 42 claves que `en-US`. A11 se fija con un test, sin cambiar nada.
- **Truncado del programa:** `radplapag_save_program_meta()` corta con `substr()` por bytes (256/512), lo que puede partir UTF-8. Se caracteriza y, si se confirma, entra como `K5`.
- **Admin JS:** `station-admin.js` es un IIFE que lee `window.radplapagAdmin` y el DOM al cargar. Con happy-dom (dev de la raíz, §4.2) se ejecuta sobre el HTML real del meta box.

## Objetivo
Fijar con tests unit, de integración y de Vitest el comportamiento de la 3.4.2 en las zonas de §4.2 que no son e2e, en orden de riesgo. El objetivo incluye los vectores compartidos PHP/TS, la paridad de locales y los mínimos de cobertura exigidos por la CI, sin tocar código publicado.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A1: mínimos de cobertura de la 0002 (utils ≥ 90 %, hooks ≥ 70 %, PHP crítico ≥ 80 %, resto ≥ 60 %) | `npm --prefix player run test:coverage` (umbrales en `player/vitest.config.ts`); `node scripts/check-php-coverage.mjs coverage/php-xml` en el job `PHPUnit integration (PHP 8.4 + latest WP)`; mutación: subir un umbral por encima de lo medido hace fallar |
| A3: integración en verde en las dos puntas | jobs `PHPUnit integration (…)`; en local, `npm run test:php:integration` tras `env:start:min` y `env:start:latest` |
| A5: PHP y TS pasan los mismos vectores | `tests/php/integration/Schedule/ScheduleVectorsTest.php` y `player/src/utils/schedule-vectors.test.ts` leen `tests/fixtures/schedule-vectors.json`; un vector sin resultado hace fallar los dos |
| A11: paridad de claves de los 14 locales | `player/src/config/locales.test.ts` |
| A4 (parte PHP/TS): cada punto de `SPEC.md` §3–§4 de estas capas tiene un test | `docs/specs/0002-safety-net/contract-map.md` con las filas PHP/TS rellenas |
| A6 (parte PHP/TS): C2, C3, C9 (TS), C10, C11, C12, C16 y K4 con su test `currently` o «no se reproduce» | `docs/known-issues.md`, columna «Test que lo fija» |
| Ningún archivo publicado cambia | `git diff --stat origin/trunk -- radio-player-page.php includes admin uninstall.php blocks/*/render.php blocks/*/src blocks/*/block.json player/src player/dist blocks/*/build` vacío, salvo `player/src/**/*.test.ts(x)` y `player/src/test/**` (fuera del bundle; `dist/` idéntico) |
| `npm run check` en verde | `npm run check` |

## Tareas

### 1.1 Arnés de integración (≤ 1 h)
- Qué: el bootstrap hace que `is_admin()` sea verdadero al cargar el plugin; se apunta el mecanismo elegido. Helpers en `tests/php/integration/Support/`:
  - `Factory`: programas, emisoras con horario y adjuntos;
  - `Clock`: §4.3. Calcula un `gmt_offset` en (−12 h, +12 h] para que el minuto local sea el del vector, rota la parrilla al día local resultante y repite una vez si cambia el minuto. Comprueba con `wp_timezone()` que la hora queda exacta (redondeo de `wp_timezone_string()`);
  - `Snapshot`: normaliza el origen, `AAAA/MM` y los IDs → nombres. Solo escribe con `RADPLAPAG_UPDATE_SNAPSHOTS=1`; sin esa variable, si falta el archivo, falla.
- Archivos: `tests/php/integration/bootstrap.php`, `tests/php/integration/Support/*.php`, `tests/php/integration/SupportTest.php`.
- Test: primero (TDD), `SupportTest.php`: con `Clock`, `new DateTime('now', wp_timezone())` da el día y el minuto pedidos (incluidos 00:00, 23:59 y un día distinto del UTC). También comprueba que están registrados todos los callbacks de admin.
- Verificación: `npm run test:php:integration -- --filter SupportTest` en `env:start:min` y en `env:start:latest`.
- Nota: `Clock` suma medio minuto al `gmt_offset` porque `wp_timezone_string()` trunca los minutos con `%02d` (17/60 h daría 16 min); la mutación sin ese medio minuto hace fallar `SupportTest`. Los snapshots viven en `tests/php/integration/snapshots/`.
- [x] hecha · commit: 69ddcd3

### 1.2 Fixtures del horario y helpers puros (≤ 1 h)
- Qué: `tests/fixtures/schedule-vectors.json` con este contenido:
  - la parrilla de `known-issues.md`;
  - `resolution` 1–14 y los de C3, con el resultado de la 3.4.2 (`"currently": true` + ID en 13, 14 y C3);
  - casos `tz`: instante UTC + `timezoneOffset` −5, +5.5, 0 y un cambio de DST para TS;
  - `validation`, con `error` como código (`required`, `invalid_program`, `format`, `overlap`, `cross_midnight_overlap`), no como texto.

  Unit sin WP de `radplapag_parse_time_to_minutes()` (`''`, `'7:5'`, `'24:00'`, basura) y `radplapag_is_slot_active()` (normal, cruce, día anterior y C16 `currently`).
- Archivos: `tests/fixtures/schedule-vectors.json`, `tests/php/unit/ScheduleHelpersTest.php`.
- Test: caracterización, `ScheduleHelpersTest.php`. Mutación: `||` → `&&` en `radplapag_is_slot_active()`.
- Verificación: `npm run test:php:unit`
- Nota: PHP y TS dan la misma resolución en todos los vectores (el saneador guarda las franjas ordenadas por inicio), así que no hay resultados `php`/`ts`. La validación sí lleva `php`/`admin` (C3) y el código `start_equals_end`, que solo da el admin. C3-4 (martes 07:00 con la franja `08:00–08:00`) es C16, no C3. Mutación `||` → `&&`: 10 tests fallan.
- [x] hecha · commit: b53c8d7

### 1.3 Saneado y validación del horario (≤ 1 h)
- Qué: `radplapag_sanitize_station_schedule()` con los vectores `validation` y además:
  - entrada que no es array → `[]`;
  - días desconocidos ignorados, `trim`, `is_rerun` booleano;
  - salida ordenada por inicio y días vacíos omitidos;
  - concatenación de errores y `return` temprano del solape entre días;
  - **C3** (el servidor acepta `start == end`) y **C10** (acepta programas en borrador) como `currently`.
- Archivos: `tests/php/integration/Schedule/SanitizeScheduleTest.php`, `docs/known-issues.md` (C3, C10).
- Test: caracterización. Mutación: quitar el `continue` tras el error de formato.
- Verificación: `npm run test:php:integration -- --filter SanitizeScheduleTest`
- Nota: los códigos de error salen del primer mensaje (en inglés, `en_US`). La rama «End time must be after start time» es inalcanzable: con `end <= start` el fin pasa al día siguiente. Del solape entre días solo se informa el primero, detrás de todos los errores por día. Mutación sin el `continue`: 2 tests fallan (con `'ab:cd'` no mordía; el test usa `'7:00'`, que solaparía).
- [x] hecha · commit: ae81980

### 1.4 Guardado de la emisora (≤ 1 h)
- Qué: `radplapag_save_station_meta()`:
  - guardas de nonce, capacidad, autosave y tipo de post;
  - URL siempre vacía en CLI → transient `radplapag_station_field_errors_<id>` (45 s) y la URL y la página sin guardar (se documenta el límite de `filter_input`; el camino correcto va a e2e);
  - página ya asignada a otra emisora;
  - lista blanca de tema y visualizador;
  - adjuntos (imagen, `audio/mpeg`) → 0 si no valen;
  - horario: transient de error frente a meta JSON guardado.

  `radplapag_station_schedule_errors_notice()`: solo las salidas tempranas (pantalla y `post` vacío).
- Archivos: `tests/php/integration/Station/SaveStationMetaTest.php`.
- Test: caracterización. Mutación: cambiar el valor por defecto `neutral`.
- Verificación: `npm run test:php:integration -- --filter SaveStationMetaTest`
- Nota: 41 tests. `DOING_AUTOSAVE` no se puede deshacer: ese test corre en su propio proceso. En CLI la URL nunca se lee, así que la rama que guarda URL y página y borra el transient de campos no se alcanza (va a e2e). Sin rarezas nuevas para `known-issues.md`: los campos que faltan se guardan como 0 / valor por defecto y los errores de campo no frenan el resto, como se espera de un formulario que siempre los envía. Mutaciones: el defecto `neutral` → `blue` (1 test), el `neutral` de la lista blanca (2), sin la guarda de autosave (1) y sin excluir la propia emisora (1).
- [x] hecha · commit: 6e6d028

### 1.5 Golden master de la migración (≤ 1 h)
- Qué: `tests/fixtures/legacy-settings/`:
  - copia de `v2.0-branding`, `v3.1-schedule`, `v3.2-descriptions` y `v1.1-flat` del spike;
  - nuevos: `multi-station`, `no-schedule`, `corrupt` (tipos erróneos, días desconocidos, horas mal formadas), `shared-program` y `attachments` (`{{ATTACHMENT:<nombre>}}`).

  Un test con proveedor de datos: crea las páginas y los adjuntos, ejecuta `plugins_loaded` + `admin_init` como administrador **dos veces** y compara con `golden/<fixture>.json`. Las idas del spike (no los archivos) se reescriben en `tests/`.
- Archivos: `tests/fixtures/legacy-settings/**`, `tests/php/integration/Migration/MigrationGoldenTest.php`.
- Test: caracterización. Mutación: quitar `'is_rerun' => false` en el migrador.
- Verificación: `npm run test:php:integration -- --filter MigrationGoldenTest` en las dos puntas (los goldens deben ser idénticos).
- Nota: los marcadores de página pasan a `{{PAGE:<nombre>}}` (el test crea las páginas que nombra el fixture y los adjuntos de su mapa `attachments`). Se ejecutan solo los callbacks `radplapag_*` de `plugins_loaded` y `admin_init`, en orden de prioridad: los de core envían cabeceras. `corrupt` se parte en dos, porque una hora mal formada hace fallar toda la migración y taparía el resto: `corrupt` (tipos erróneos, días desconocidos o en mayúsculas, filas sin campos; la migración termina) y `corrupt-times` (`7:00`/`25:00` en la segunda emisora → rollback de todo, la opción se queda, transient de error y se reintenta en cada petición). Sin rarezas nuevas para `known-issues.md`: el saneador de la 3.2 usaba la misma regex de hora, así que `corrupt-times` solo sale de datos editados a mano; el migrador no comprueba que la página no esté repetida ni conserva `is_rerun` (los formatos heredados no lo tenían). La mutación del plan no existe tal cual (el migrador no escribe `is_rerun`; lo añade el saneador): se quitó `'is_rerun' => $prog_data['is_rerun']` en `radplapag_sanitize_station_schedule()` y fallan 5 de 10. Goldens idénticos en PHP 7.4 + WP 6.6.10 y PHP 8.4 + WP 7.1.3.
- [x] hecha · commit: 4cf70a9

### 1.6 Flujo de actualización (≤ 1 h)
- Qué:
  - `radplapag_ensure_schema_version_option()`;
  - guardas de `radplapag_run_legacy_migration_if_needed()`: no admin, sin capacidad, ya migrado;
  - bloqueo `radplapag_migrating`;
  - conflicto con CPT publicados (opción) y su limpieza;
  - error: se fuerza `wp_insert_post` a fallar con `wp_insert_post_empty_content` → rollback y transient de error;
  - éxito: transient y aviso;
  - HTML de `radplapag_migration_admin_notices()`;
  - descarte con nonce válido e inválido (vía `wp_redirect`);
  - `radplapag_on_upgrader_process_complete()`: otro plugin, sin `plugins`, este plugin, post type aún sin registrar → `init` 100;
  - **K4** `currently` con `v1.1-flat`.
- Archivos: `tests/php/integration/Migration/UpgradeFlowTest.php`, `docs/known-issues.md` (K4: el test pasa a ser este).
- Test: caracterización. Mutación: quitar `delete_transient( 'radplapag_migrating' )`.
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- [ ] hecha · commit: —

### 1.7 Config y lectura (≤ 1 h)
- Qué:
  - `radplapag_get_stations()`: solo publicadas, orden `menu_order` + título, forma y valores cerrados de `Radplapag_Station_Config::to_array()`, horario JSON inválido → `[]`;
  - `radplapag_get_config()`;
  - `Radplapag_Program_Config`;
  - `radplapag_get_station_for_current_page()` con `go_to()`: coincide; sin URL; otra página; `false`;
  - `radplapag_get_player_pages_assigned_to_other_stations()`;
  - `radplapag_get_program_data()` (borrador con y sin `require_published`);
  - `radplapag_get_all_programs_for_select()` (publicados + borradores, por título).
- Archivos: `tests/php/integration/Data/ConfigTest.php`.
- Test: caracterización. Mutación: `'publish'` → `'any'` en `radplapag_get_stations()`.
- Verificación: `npm run test:php:integration -- --filter ConfigTest`
- [ ] hecha · commit: —

### 1.8 Programa en antena con los vectores (≤ 1 h)
- Qué: `ScheduleVectorsTest` recorre `resolution` con `Clock` y comprueba `radplapag_get_now_playing_for_station(0)`:
  - `current` y `upcoming`: nombre, rerun, `day_label`, `time_range`;
  - `upcoming` sin `logo_id`;
  - **C16** en 13 y 14 como `currently`.

  Además: índice inválido → `null`, `station_page_url` y programa en borrador oculto. Un vector sin resultado PHP falla.
- Archivos: `tests/php/integration/Schedule/ScheduleVectorsTest.php`, `docs/known-issues.md` (C16, parte PHP).
- Test: caracterización. Mutación: ventana de 10 → 9 minutos.
- Verificación: `npm run test:php:integration -- --filter ScheduleVectorsTest` en las dos puntas.
- [ ] hecha · commit: —

### 1.9 Helpers de los bloques de horario y programas (≤ 1 h)
- Qué:
  - `radplapag_get_schedule_for_station()`: `current_first` frente a `natural`, slots ordenados, `is_live` según los vectores (C16 en el bloque), mapa de programas, descripciones vacías → `null`/`''`;
  - `radplapag_get_programs_list_for_station()`: orden de primera aparición, slots por día e inicio, `is_live` (C16) y programas en borrador fuera;
  - `radplapag_build_programs_map()`;
  - `radplapag_get_schedule_day_keys_and_labels()`.
- Archivos: `tests/php/integration/Schedule/BlockDataTest.php`.
- Test: caracterización. Mutación: quitar el reordenado `current_first`.
- Verificación: `npm run test:php:integration -- --filter BlockDataTest`
- [ ] hecha · commit: —

### 1.10 Render de los bloques (≤ 1 h)
- Qué: snapshot del HTML normalizado (helper `Snapshot`, reloj con `Clock`) de cada combinación de atributos:
  - `schedule`: 8 combinaciones;
  - `programs-list`: 16;
  - `now-playing`: `showLogo` × con y sin programa.

  `now-playing` vacío en el front y su marcador con `REST_REQUEST`. Índice inexistente. Registro de los bloques (`block.json`: atributos y valores por defecto de `SPEC.md` §3.5). Datos del editor (`radplapagScheduleBlock`, `radplapagProgramsListBlock`, `radplapagNowPlayingBlock`) tras `enqueue_block_editor_assets`.
- Archivos: `tests/php/integration/Blocks/BlockRenderTest.php`, `tests/fixtures/blocks/*.html`.
- Test: caracterización. Mutación: quitar una clase del markup de `blocks/schedule/render.php`.
- Verificación: `npm run test:php:integration -- --filter BlockRenderTest` en las dos puntas.
- [ ] hecha · commit: —

### 1.11 CPT, capacidades, meta y editor (≤ 1 h)
- Qué:
  - argumentos de los dos `register_post_type`;
  - `register_post_meta`: claves, tipo, `single`, `show_in_rest`, saneado y `auth_callback`;
  - capacidades de administrador frente a editor (`user_has_cap`, `map_meta_cap`: editar, borrar, leer y publicar);
  - editor clásico en la emisora y **C12** `currently` (el programa usa bloques);
  - `radplapag_save_program_meta()`: guardas, saneado, truncado por bytes (si parte UTF-8 → **K5** `currently`) y logo no imagen → 0.
- Archivos: `tests/php/integration/Cpt/CptTest.php`, `tests/php/integration/Cpt/SaveProgramMetaTest.php`, `docs/known-issues.md` (C12, K5 si procede).
- Test: caracterización. Mutación: quitar `manage_options` en `radplapag_grant_station_caps_to_manage_options()`.
- Verificación: `npm run test:php:integration -- --filter 'CptTest|SaveProgramMetaTest'`
- [ ] hecha · commit: —

### 1.12 Callbacks, admin PHP y fixture del meta box (≤ 1 h)
- Qué:
  - la tabla de callbacks de `SPEC.md` §3.4 exacta: hook, prioridad y nº de argumentos, leídos de `$wp_filter`;
  - `radplapag_admin_menu()` y `radplapag_remove_duplicate_rpp_submenu()`;
  - `radplapag_admin_scripts()`: solo en las dos pantallas, handles, forma de `radplapagAdmin`;
  - `radplapag_get_admin_strings()`;
  - render de los meta boxes (nonce, `#radplapag-station-cpt-container`).

  Escribe y compara `tests/fixtures/admin/station-meta-box.html` (los dos meta boxes dentro de `<form id="post">`, normalizado) para Vitest.
- Archivos: `tests/php/integration/Admin/HooksTest.php`, `tests/php/integration/Admin/AdminScreensTest.php`, `tests/fixtures/admin/station-meta-box.html`.
- Test: caracterización. Mutación: cambiar la prioridad de `radplapag_run_legacy_migration_if_needed()` en una copia temporal.
- Verificación: `npm run test:php:integration -- --filter 'HooksTest|AdminScreensTest'`
- [ ] hecha · commit: —

### 1.13 Desinstalación (≤ 1 h)
- Qué:
  - sitio simple: borra los posts de los dos CPT y su meta, y las opciones `radplapag_db_version` y `radplapag_migration_skipped_cpt_conflict`; no toca otros posts;
  - **C11** `currently`: quedan `radplapag_settings` y los transients;
  - multisite: cada sitio, con el grupo `ms-required` y el script nuevo `test:php:integration:ms` (`WP_TESTS_MULTISITE=1`), en el job de integración de la CI (sin cambiar el nombre del job).

  Si multisite no arranca: se apunta aquí y en «Verificación manual pendiente».
- Archivos: `tests/php/integration/Uninstall/UninstallTest.php`, `tests/php/integration/Uninstall/UninstallMultisiteTest.php`, `package.json`, `phpunit-integration.xml.dist` (excluir `ms-required`), `.github/workflows/ci.yml`, `docs/known-issues.md` (C11).
- Test: caracterización. Mutación: quitar `radplapag_uninstall_delete_programs()` del bucle multisite.
- Verificación: `npm run test:php:integration -- --filter UninstallTest && npm run test:php:integration:ms`
- [ ] hecha · commit: —

### 1.14 Utils del player con los vectores (≤ 1 h)
- Qué:
  - `schedule-vectors.test.ts` lee `../tests/fixtures/schedule-vectors.json`: `findActiveProgram` y `findIncomingProgram` (C16 `currently`) y los casos `tz` con `getCurrentTimeInTimezone` y `vi.setSystemTime`;
  - `program-schedule.test.ts`: `getProgramsForDay` (C4 `currently` en el util), `getProgramsForWeekOrdered`, `getAllProgramsWithSlots` (orden alfabético e `isLive`) e `isProgramActive`;
  - `timezone.test.ts`: con `TZ` variadas, `getBrowserTimezoneOffset`, `getTimezoneDifference`, `formatTimeInTimezone`, `formatTimezoneDifference` y las reservas con offset inválido;
  - **C9** (parte TS) `currently`: el offset fijo no sigue un cambio de DST con la página abierta.
- Archivos: `player/src/utils/schedule-vectors.test.ts`, `player/src/utils/program-schedule.test.ts`, `player/src/utils/timezone.test.ts`, `docs/known-issues.md` (C4 parcial, C9, C16 TS).
- Test: caracterización. Mutación: `<=` → `<` en la ventana de 10 minutos.
- Verificación: `npm --prefix player test -- src/utils`
- [ ] hecha · commit: —

### 1.15 `use-audio-player` (≤ 1 h)
- Qué: `src/test/fake-audio.ts` (*FakeAudioElement*, idea del spike R4 reescrita) y `vi.mock` de `hls.js`/`dashjs`. Casos:
  - MP3 directo con `crossOrigin`;
  - HLS con `hls.js` (`MANIFEST_PARSED`) y DASH: sin `crossOrigin`;
  - HLS nativo en iOS y como alternativa;
  - intro: no se puede pausar, pasa al directo en `ended`, su fallo es silencioso;
  - estado `error`, `loading` y volumen (ignorado en iOS);
  - limpieza al desmontar o cambiar de stream;
  - **C2** `currently`: `.m3u8?token=x` y `.M3U8` se tratan como directo.
- Archivos: `player/src/test/fake-audio.ts`, `player/src/hooks/use-audio-player.test.tsx`, `docs/known-issues.md` (C2).
- Test: caracterización. Mutación: quitar un `crossOrigin = 'anonymous'`.
- Verificación: `npm --prefix player test -- src/hooks/use-audio-player`
- [ ] hecha · commit: —

### 1.16 Resto de hooks del player (≤ 1 h)
- Qué:
  - `use-config`: globales válidas, inválidas y ausentes; listas blancas; rango de `timezoneOffset`;
  - `use-program-schedule`: alineación al minuto y luego cada 60 s, con fake timers; limpieza;
  - `use-transmission-time`;
  - `use-media-session`: metadatos, handlers y `playbackState`; sin `mediaSession`;
  - `use-is-ios`.

  Sin visualizadores (ADR 0018).
- Archivos: `player/src/hooks/*.test.tsx`.
- Test: caracterización. Mutación: valor por defecto `'neutral'` → `'blue'` en `use-config`.
- Verificación: `npm --prefix player test -- src/hooks`
- [ ] hecha · commit: —

### 1.17 Admin JS: arnés y vectores de validación (≤ 1 h)
- Qué:
  - `happy-dom` 21.0.3 como dev de la raíz (§4.2);
  - entorno happy-dom solo para `tests/js/admin/**`;
  - un helper que monta `tests/fixtures/admin/station-meta-box.html`, fija `radplapagAdmin` y ejecuta `station-admin.js`;
  - los vectores `validation` del JSON en el cliente (filas y envío bloqueado);
  - **C3** `currently`: el admin rechaza `start == end`.
- Archivos: `package.json`, `package-lock.json`, `vitest.config.mjs`, `tests/js/admin/support/mount-station-screen.js`, `tests/js/admin/station-validation.test.js`, `docs/known-issues.md` (C3).
- Test: caracterización. Mutación: `>` → `>=` en `checkOverlaps`.
- Verificación: `npm test`
- [ ] hecha · commit: —

### 1.18 Admin JS: campos y comportamiento del DOM (≤ 1 h)
- Qué:
  - campos obligatorios (página y URL);
  - páginas asignadas desactivadas;
  - añadir y quitar franja (HTML del select, índices);
  - reordenar por inicio;
  - revalidación de días adyacentes;
  - `program-admin.js` con un `wp.media` simulado: elegir y quitar imagen.
- Archivos: `tests/js/admin/station-fields.test.js`, `tests/js/admin/program-admin.test.js`.
- Test: caracterización. Mutación: quitar `applyDisabledPlayerPages()`.
- Verificación: `npm test`
- [ ] hecha · commit: —

### 1.19 Paridad de locales (≤ 1 h)
- Qué: cada locale tiene exactamente las claves de `en-US` y los mismos marcadores `{{…}}`, y los 14 están registrados en `src/config/i18n.ts`.
- Archivos: `player/src/config/locales.test.ts`.
- Test: primero (es nuevo; se ve en rojo quitando una clave en una copia temporal).
- Verificación: `npm --prefix player test -- src/config`
- [ ] hecha · commit: —

### 1.20 Cobertura de PHP en la CI (≤ 1 h)
- Qué:
  - `tests/coverage/php-zones.json`: crítico = funciones de saneado del horario y guardado de campos, migrador, `radplapag-upgrade.php`, programa en antena y config; resto = lo demás de `includes/`, `admin/*.php`, `blocks/*/render.php`, `uninstall.php`;
  - `scripts/check-php-coverage.mjs`, que lee `--coverage-xml` y aplica 80 % / 60 %;
  - script `test:php:integration:coverage`;
  - en el job `PHPUnit integration (PHP 8.4 + latest WP)`: `--xdebug=coverage` y el check.

  Se mide si el unit aporta (`phpcov` solo si aporta).
- Archivos: `tests/coverage/php-zones.json`, `scripts/check-php-coverage.mjs`, `tests/js/scripts/check-php-coverage.test.js` (con un XML de muestra), `vitest.config.mjs`, `package.json`, `.github/workflows/ci.yml`.
- Test: primero (TDD) del script sobre el XML de muestra. Mutación: un umbral por encima de lo medido → sale con 1.
- Verificación: `npm test && npm run test:php:integration:coverage && node scripts/check-php-coverage.mjs coverage/php-xml`
- [ ] hecha · commit: —

### 1.21 Cobertura del player en la CI (≤ 1 h)
- Qué: `coverage.thresholds` por glob en `player/vitest.config.ts` (`src/utils/**` ≥ 90 % líneas; `src/hooks/**` ≥ 70 %, con los visualizadores ya excluidos). `test:coverage` sustituye a `test` en el `check` del player (la CI ya lo ejecuta).
- Archivos: `player/vitest.config.ts`, `player/package.json`.
- Test: mutación: subir un umbral por encima de lo medido → falla; se revierte.
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

### 1.22 Mapa del contrato (parte PHP/TS) (≤ 1 h)
- Qué: `contract-map.md`, con una fila por punto de `SPEC.md` §3–§4 → test. Las filas de e2e quedan como «fase 2». Repaso de `known-issues.md`: cada fila de esta fase tiene su test o «no se reproduce». Se apuntan las desviaciones (C13 y el aviso tras guardar → fase 2; C9 PHP → fase 2; cobertura por `--coverage-xml`).
- Archivos: `docs/specs/0002-safety-net/contract-map.md`, `docs/known-issues.md`, `docs/status.md`.
- Test: — (revisión de `spec-conformance-reviewer` en `close-phase`).
- Verificación: `npm run check`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- Ninguna de contrato. Desviaciones de la spec ya decididas (se apuntan en `status.md`):
  - `filter_input` → C13, el guardado correcto de URL y página y el aviso tras guardar pasan a e2e (decisión del usuario, 2026-10-16);
  - cobertura de PHP por función con `--coverage-xml` en lugar de clover;
  - C9 (parte PHP, offset por petición) se confirma con el snapshot de la página limpia en la fase 2.
- Si la técnica del reloj (§4.3) no es fiable en alguna punta en la 1.1: **parar y preguntar** (costura privada con ADR).

## Verificación de la fase
`npm run check`; `npm run test:php:integration` (+ `:ms`) tras `env:start:min` y tras `env:start:latest`; `npm run test:php:integration:coverage` + `check-php-coverage.mjs`; `npm --prefix player run check`; `git diff --stat origin/trunk` sobre los archivos publicados vacío; CI del PR en verde.
