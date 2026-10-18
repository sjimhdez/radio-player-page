# Spec 0002 · Mapa del contrato (punto → test)

> Trazabilidad del criterio **A4**: cada punto de `SPEC.md` §3 y §4 tiene al menos un test. Parte PHP/TS hecha en la fase 1 y e2e en la fase 2 (2026-10-17): ya no queda ninguna fila «fase 2» ni «parcial». Lo revisa `spec-conformance-reviewer` en `close-phase`.

**Estado:** cubierto = un test fija el punto · parcial = lo que falta se indica · herramienta = lo fija la CI o un hook, no un test de comportamiento · n/a = aún no existe.

**Rutas:** `PI/` = `tests/php/integration/`, `PU/` = `tests/php/unit/`, `JS/` = `tests/js/`, `PL/` = `player/src/`, `E2E/` = `tests/e2e/`. Los vectores son los de `tests/fixtures/schedule-vectors.json`.

## §3.1 Datos

| Punto | Test(s) | Estado |
|---|---|---|
| CPT `radplapag_station` / `radplapag_program`: argumentos, etiquetas, `map_meta_cap` | `PI/Cpt/CptTest.php` (`test_post_type_arguments`, `test_post_type_labels`, `test_post_type_capabilities_use_the_custom_type`); `PI/SmokeTest.php` | cubierto |
| Capacidades propias concedidas con `manage_options` (`user_has_cap`) y resueltas por `map_meta_cap` | `PI/Cpt/CptTest.php` (`test_user_has_cap_grants_*`, `test_type_capabilities_of_administrator_and_editor`, `test_post_meta_capabilities_of_administrator_and_editor`, `test_map_meta_cap_*`) | cubierto |
| Emisora con el editor clásico forzado (C12: no se reproduce) | `PI/Cpt/CptTest.php` (`test_station_use_classic_editor_filter`, `test_both_types_use_the_classic_editor`) | cubierto |
| Orden de emisoras: `menu_order`, después título | `PI/Data/ConfigTest.php` (`test_get_stations_orders_by_menu_order_then_title`) | cubierto |
| Meta de emisora y de programa: claves registradas, argumentos, saneadores, `auth_callback` | `PI/Cpt/CptTest.php` (`test_registered_meta_keys_and_arguments`, `test_meta_auth_callbacks_require_manage_options`, `test_station_*_sanitizer`, `test_image_id_sanitizers`, `test_program_description_sanitizers`, `test_station_schedule_is_not_sanitized`) | cubierto |
| Valores cerrados `theme_color` y `visualizer` (desconocido → primero) | `PI/Data/ConfigTest.php` (`test_station_row_replaces_unknown_theme_and_visualizer`, `test_station_row_keeps_every_valid_*`); `PI/Station/SaveStationMetaTest.php` (`test_theme_whitelist`, `test_visualizer_whitelist`); `PI/Admin/AdminScreensTest.php` (`test_station_details_box_unknown_values_fall_back`); `PL/hooks/use-config.test.tsx` (`replaces the theme color %j with neutral`) | cubierto |
| Opción `radplapag_settings` (origen, se borra al migrar) | `PI/Migration/MigrationGoldenTest.php`; `PI/Migration/UpgradeFlowTest.php` (`test_successful_migration_records_outcome_and_releases_lock`) | cubierto |
| Opción `radplapag_db_version` (`'330'`) | `PI/Migration/UpgradeFlowTest.php` (`test_ensure_schema_version_*`, `test_successful_migration_records_outcome_and_releases_lock`) | cubierto |
| Opción `radplapag_migration_skipped_cpt_conflict` | `PI/Migration/UpgradeFlowTest.php` (`test_published_station_skips_migration_and_flags_conflict`, `test_clear_conflict_flag_*`, `test_conflict_flag_is_cleared_and_migration_runs_without_published_stations`) | cubierto |
| Transient `radplapag_station_schedule_errors_<id>` (45 s) | `PI/Station/SaveStationMetaTest.php` (`test_invalid_schedule_sets_transient_and_keeps_meta`, con la caducidad); el aviso tras guardar, `E2E/admin.spec.ts` (`an overlap shows the schedule notice and keeps the saved schedule`, `an incomplete slot and an overlap join their messages in one notice`) | cubierto |
| Transient `radplapag_station_field_errors_<id>` (45 s) | `PI/Station/SaveStationMetaTest.php` (`test_missing_player_page_is_reported`, `test_page_assigned_to_another_station_is_reported`, `test_field_errors_expire_in_45_seconds`); la URL del stream y el aviso tras guardar, `E2E/admin.spec.ts` (`an empty stream URL shows its notice once and keeps the saved URL`) | cubierto |
| Transient `radplapag_migrating` (bloqueo, 120 s) | `PI/Migration/UpgradeFlowTest.php` (`test_migration_does_not_run_while_locked`, `test_successful_migration_records_outcome_and_releases_lock`, `test_failed_migration_rolls_back_and_records_error`, `test_migration_lock_expires_in_120_seconds`) | cubierto |
| Transients `radplapag_migration_success_notice` (60 s) y `radplapag_migration_error_notice` (120 s) | `PI/Migration/UpgradeFlowTest.php` (`test_successful_migration_records_outcome_and_releases_lock`, `test_failed_migration_rolls_back_and_records_error`, con la caducidad) | cubierto |
| Formato del horario y validación del servidor (campos, programa, `HH:MM`, solapes, medianoche) | `PI/Schedule/SanitizeScheduleTest.php` (`test_validation_vector` sobre los vectores de validación y el resto del archivo; C3 y C10 como `currently`); `PI/Station/SaveStationMetaTest.php` (`test_valid_schedule_is_saved_as_json`, `test_missing_schedule_stores_empty_json`, `test_invalid_schedule_sets_transient_and_keeps_meta`) | cubierto |

## §3.2 Migración y actualización

| Punto | Test(s) | Estado |
|---|---|---|
| Unidireccional e idempotente; formatos 2.0.x–3.2.x | `PI/Migration/MigrationGoldenTest.php` (`test_migration_matches_golden_and_is_idempotent`: dos pasadas sobre `tests/fixtures/legacy-settings/`, golden en `golden/`) | cubierto |
| 1.x fuera del contrato (K4) | `PI/Migration/UpgradeFlowTest.php` (`test_currently_flat_1x_settings_are_orphaned_without_notice`) | cubierto |
| Paso 1: `radplapag_ensure_schema_version_option()` | `PI/Migration/UpgradeFlowTest.php` (`test_ensure_schema_version_*`) | cubierto |
| Paso 2: `radplapag_run_legacy_migration_if_needed()` (admin, `manage_options`, versión, `stations`, conflicto, bloqueo, primer administrador, aviso) | `PI/Migration/UpgradeFlowTest.php` (`test_migration_does_not_run_*`, `test_published_station_skips_migration_and_flags_conflict`, `test_draft_station_does_not_block_migration`, `test_migrated_posts_belong_to_the_first_administrator`, `test_failed_migration_*`) | cubierto |
| Paso 3: `upgrader_process_complete` (y diferido a `init` 100) | `PI/Migration/UpgradeFlowTest.php` (`test_upgrader_ignores_other_runs`, `test_upgrader_runs_migration_for_this_plugin`, `test_upgrader_defers_migration_to_init_before_post_type_exists`) | cubierto |
| Avisos en `admin_notices` y descarte con nonce | `PI/Migration/UpgradeFlowTest.php` (`test_notices_*`, `test_success_notice_is_printed_once`, `test_error_notice_is_printed_once_and_escaped`, `test_empty_error_message_prints_nothing`, `test_conflict_notice_links_to_nonced_dismiss_url`, `test_dismiss_*`) | cubierto |
| Al migrar: programa compartido una vez, franja con programa desconocido descartada, título vacío → «Radio Station», `is_rerun: false` | `PI/Migration/MigrationGoldenTest.php` (fixtures `shared-program`, `corrupt`, `corrupt-times`, `multi-station`, `attachments`) | cubierto |

## §3.3 Página del reproductor

| Punto | Test(s) | Estado |
|---|---|---|
| `radplapag_get_station_for_current_page()`: solo una página asignada a una emisora publicada | `PI/Data/ConfigTest.php` (`test_station_for_current_page_*`) | cubierto |
| `template_redirect` → `radplapag_output_clean_page()`; casos no interceptados (borrador, contraseña, sin emisora, no página) | `PI/Admin/HooksTest.php` (el enganche); `E2E/clean-page.spec.ts` (`matches the snapshot of …`, `serves the theme for password` / `not-a-page` / `no-station`, `serves the theme for a draft, even to the admin`) | cubierto |
| HTML mínimo sin `wp_head()`/`wp_footer()`; `<head>` (`lang`, `<title>`, favicon, `description`, Open Graph, Twitter Card, imagen social) | `E2E/clean-page.spec.ts` (snapshots `E2E/snapshots/minimal.html` y `mp3.html`; `prints a bare document, without wp_head() or wp_footer()`, `prints the language, title, description and social tags`, `escapes the title in the tags and in the globals`, `prints no social image without logo, background or favicon`, `falls back from logo to background to favicon for the social image`); `E2E/smoke.spec.ts` | cubierto |
| Assets desde `player/dist/manifest.json`; `wp_die()` sin manifiesto o sin JS | `E2E/clean-page.spec.ts` (`loads the stylesheet and the entry named in the manifest`; `dies with radplapag-no-manifest`, `dies with radplapag-no-main-entry`, con el `player/dist` alternativo de `tests/fixtures/player-dist/` montado en `.wp-env.tests.json`) | cubierto |
| `window.RADPLAPAG_CONFIG` / `PROGRAMS` / `SCHEDULE`: forma, escapes `JSON_HEX_*`, orden de primera aparición, `timezoneOffset` por petición (C9, parte PHP) | Lado del player: `PL/hooks/use-config.test.tsx` (lectura y validación de las tres globales); impresión en PHP: `E2E/clean-page.spec.ts` (snapshots; `escapes the title in the tags and in the globals`, `lists the programs in order of first appearance in the schedule`, `omits the empty days from the schedule`, `currently prints an empty schedule as a JSON array (K17)`, `prints timezoneOffset as a number fixed per request (C9)`) | cubierto |

## §3.4 API PHP

| Punto | Test(s) | Estado |
|---|---|---|
| `radplapag_get_config()` | `PI/Data/ConfigTest.php` (`test_get_config_*`) | cubierto |
| `radplapag_get_stations()` (lista, publicadas, orden, forma de cada fila, valores por defecto, horario inválido) | `PI/Data/ConfigTest.php` (`test_get_stations_*`, `test_station_row_*`) | cubierto |
| `radplapag_get_station_for_current_page()` | ver §3.3 | cubierto |
| `radplapag_get_now_playing_for_station()` (actual, siguiente a ≤ 10 min, índice inexistente → `null`, programa en borrador oculto; C16) | `PI/Schedule/ScheduleVectorsTest.php` (`test_resolution_vector` sobre los vectores 1–14 y C3, `test_currently_midnight_slot_is_active_early_on_its_own_day`, `test_invalid_station_index_gives_null`, `test_current_has_logo_and_upcoming_has_none`, `test_draft_program_is_hidden`); `PI/Schedule/SiteTimezoneTest.php` (zona del sitio con horario de verano); `PU/ScheduleHelpersTest.php` (helpers puros) | cubierto |
| Callbacks enganchados (hook, prioridad, nº de argumentos), exactamente los de la tabla | `PI/Admin/HooksTest.php` (`test_hooked_callbacks_match_the_contract_exactly`, `test_no_callback_is_hooked_twice_on_a_hook`, `test_every_callback_can_be_unhooked_by_name`, `test_same_priority_callbacks_run_in_registration_order`); `PI/SupportTest.php` (`test_every_contract_callback_is_hooked`) | cubierto |
| Funciones `radplapag_*`, clases `Radplapag_*` y constantes `RADPLAPAG_*` (existen) | cubiertas por los tests de cada zona; `PU/SmokeTest.php` (`Radplapag_Program_Config` sin WordPress) | cubierto en lo que se usa; una lista exhaustiva de nombres la vigila `backcompat-reviewer` en cada diff |

## §3.5 Bloques

| Punto | Test(s) | Estado |
|---|---|---|
| Registro: apiVersion 3, atributos y valores por defecto, `supports`, render en el servidor | `PI/Blocks/BlockRenderTest.php` (`test_block_registration`, `test_render_callbacks`) | cubierto |
| Markup del render (clases, `data-program-id`, estilos en línea) con cada combinación de atributos | `PI/Blocks/BlockRenderTest.php` (`test_schedule_render`, `test_programs_list_render`, `test_now_playing_render`; snapshots en `PI/snapshots/blocks/`); K6 como `currently` | cubierto |
| Datos de los bloques: días, orden, franjas, en directo, lista de programas (C10, C16) | `PI/Schedule/BlockDataTest.php` | cubierto |
| `stationIndex` inválido | `PI/Blocks/BlockRenderTest.php` (`test_*_invalid_index*`); `PI/Schedule/BlockDataTest.php` (`test_invalid_station_index_gives_null`) | cubierto |
| `now-playing` vacío en el front sin programa en antena | `PI/Blocks/BlockRenderTest.php` (`test_now_playing_empty_on_front`, `test_now_playing_empty_in_rest_request`) | cubierto |
| Datos del editor `{ stations: [ etiquetas ] }` | `PI/Blocks/BlockRenderTest.php` (`test_editor_data`, `test_editor_data_needs_registered_script`); insertar y previsualizar, `E2E/blocks.spec.ts` (`the three blocks are inserted and preview the chosen station`) | cubierto |

## §3.6 Admin

| Punto | Test(s) | Estado |
|---|---|---|
| Menú «RPP» y submenú duplicado | `PI/Admin/AdminScreensTest.php` (`test_admin_menu_adds_the_rpp_top_level_page`, `test_duplicate_rpp_submenu_is_removed`, `test_menu_page_redirects_to_the_stations_list`) | cubierto |
| Meta boxes de emisora y de programa, nonces | `PI/Admin/AdminScreensTest.php` (`test_meta_boxes_are_registered`, `test_station_details_box_*`, `test_schedule_box_*`, `test_program_box*`, `test_station_meta_box_fixture`); `PI/Station/SaveStationMetaTest.php` y `PI/Cpt/SaveProgramMetaTest.php` (nonce, capacidad, autoguardado, otro tipo; K5); guardado correcto, `E2E/admin.spec.ts` (`creates a program with a description`, `creates a station with an http stream, page, theme, visualizer and a slot, without any notice (C13)`, `the player page reflects the saved station`, `the assigned page is disabled in another station`; K15 `currently`) | cubierto |
| Validación en el cliente (solapes, medianoche, campos) | `JS/admin/station-validation.test.js` (vectores de validación, C3); `JS/admin/station-fields.test.js` (K15, K16) | cubierto |
| Validación en el servidor y aviso tras guardar | ver §3.1 (horario y transients); `PI/Station/SaveStationMetaTest.php` (`test_notice_*`); `E2E/admin.spec.ts` (`server, without the client validation`: los tres avisos; C13 en `creates a station with an http stream…`; validación del cliente: `an overlapping slot…`, `an incomplete slot…`, K19 `currently`) | cubierto |
| Páginas asignadas a otra emisora desactivadas | `PI/Data/ConfigTest.php` (`test_assigned_pages_*`); `PI/Admin/AdminScreensTest.php` (`test_player_pages_assigned_to_other_stations`); `JS/admin/station-fields.test.js` (`pages assigned to other stations`) | cubierto |
| Cadenas del JS (`radplapag_get_admin_strings()`, `radplapagAdmin`) | `PI/Admin/AdminScreensTest.php` (`test_admin_strings_keys`, `test_admin_strings_programs`, `test_station_screen_localizes_radplapag_admin`) | cubierto |
| Scripts del admin (encolado por pantalla, selectores de medios) | `PI/Admin/AdminScreensTest.php` (`test_admin_scripts_*`, `test_station_edit_scripts_enqueue_media_on_the_station_screen`); `JS/admin/program-admin.test.js`; `JS/admin/smoke.test.js` | cubierto |

## §3.7 Desinstalación

| Punto | Test(s) | Estado |
|---|---|---|
| Borra las dos opciones y los posts de los dos CPT con su meta, sin tocar otros posts | `PI/Uninstall/UninstallTest.php` (`test_deletes_*`, `test_does_not_touch_other_posts`); C11 y K7 como `currently` | cubierto |
| Solo con `WP_UNINSTALL_PLUGIN` | `PI/Uninstall/UninstallTest.php` (`test_exits_without_wp_uninstall_plugin`, en un proceso PHP aparte) | cubierto |
| Vacía la caché de objetos | `PI/Uninstall/UninstallTest.php` (`test_flushes_the_object_cache`) | cubierto |
| En cada sitio si es multisite | `PI/Uninstall/UninstallMultisiteTest.php` | cubierto |
| Desactivar no borra nada | `PI/Uninstall/UninstallTest.php` (`test_nothing_is_hooked_on_deactivation`: ningún `deactivate_*` enganchado) | cubierto |

## §3.8 Reproductor (comportamiento)

| Punto | Test(s) | Estado |
|---|---|---|
| `use-config.tsx`, única entrada de datos, valida las tres globales | `PL/hooks/use-config.test.tsx` | cubierto |
| Protocolo por la extensión (HLS, DASH, directo; C2) | `PL/hooks/use-audio-player.test.tsx` (`HLS`, `DASH`, `direct streams`, `protocol detection (C2)`); reproducción real, `E2E/mp3.spec.ts` (`plays the finite MP3`, `plays the endless live MP3`, `plays the OGG stream as a direct source`; C7, C8 y K18 `currently`) y `E2E/hls-dash.spec.ts` (`plays HLS with hls.js (MSE)`, `plays DASH with dashjs (MSE)`) | cubierto |
| HLS nativo en iOS, `hls.js` en el resto, nativo como alternativa; DASH con autoplay; carga con `import()` | `PL/hooks/use-audio-player.test.tsx` (`uses native HLS on iOS…`, `falls back to native HLS…`, `uses dashjs with autoplay…`; `vi.mock` intercepta los `import()`); K11, K12 como `currently`; `PL/hooks/use-is-ios.test.tsx` (K13); chunks solo cuando hacen falta, `E2E/hls-dash.spec.ts` (`plays HLS…` y `plays DASH…` piden solo su chunk, `requests neither hls.js nor dashjs for MP3`). HLS nativo no se mide en e2e: el WebKit de escritorio no es iOS para el player (2.8) | cubierto |
| `crossOrigin = 'anonymous'` en las fuentes directas, `null` en MSE (ADR 0004) | `PL/hooks/use-audio-player.test.tsx` (`plays an MP3 by assigning src with crossOrigin anonymous`, `uses hls.js … without crossOrigin`, `uses dashjs … without crossOrigin`, intro y HLS nativo con `crossOrigin`); en el navegador, `E2E/cross-origin.spec.ts` (`sets crossOrigin anonymous on a direct MP3 source`, `… on the welcome audio and on the live stream after it`, `leaves crossOrigin unset on the MSE path (hls / dash)`; C1 y K1 `currently`) | cubierto |
| Audio de bienvenida | `PL/hooks/use-audio-player.test.tsx` (`welcome audio (intro)`); `E2E/intro.spec.ts` (`plays the welcome audio once, unpausable, then the live stream`, `falls through to the live stream without an error when the welcome audio is broken`) | cubierto |
| Volumen; oculto en iOS | `PL/hooks/use-audio-player.test.tsx` (`volume`); `PL/hooks/use-is-ios.test.tsx` (K13) | cubierto (sin e2e: el WebKit de Playwright es de escritorio y el player no lo trata como iOS; 2.8) |
| Media Session (K14) | `PL/hooks/use-media-session.test.tsx` | cubierto |
| Temporizador de sueño | `E2E/sleep.spec.ts` (`counts down and pauses when the shortest option runs out`, `a manual pause cancels the timer`, `the cancel button stops the timer`) | cubierto |
| Programa actual y siguiente (zona horaria, reposiciones, medianoche, 10 min; C16, K8) | `PL/utils/program-schedule.test.ts`; `PL/utils/schedule-vectors.test.ts` (vectores de resolución y de `tz`); `PL/hooks/use-program-schedule.test.tsx`; en la página, `E2E/schedule.spec.ts` (vectores 2, 3, 5 y 7, franja vacía; C16 `currently`, vector 13) | cubierto |
| Reloj de la emisora (C9, K9, K10) | `PL/hooks/use-transmission-time.test.tsx`; `PL/utils/timezone.test.ts` | cubierto |
| Modales del horario y de todos los programas (C4, C6) | `PL/utils/program-schedule.test.ts` (`getProgramsForDay`, `getProgramsForWeekOrdered`, `getAllProgramsWithSlots`; C4 en el util); `E2E/modals.spec.ts` (cierre con Escape y con el botón, días desde hoy sin los vacíos y la reposición marcada, «On Air» en el modal de programas; C4 y C6 `currently`) | cubierto |
| El horario es solo informativo | `E2E/schedule.spec.ts` (`changes the program shown without touching playback`) | cubierto |
| Errores del stream («Unable to play the stream…»; K1) | `PL/hooks/use-audio-player.test.tsx` (`sets error when play() rejects`, `sets error on a fatal hls.js error only`, `sets error on a dashjs error`, `audio element events`); en pantalla, `E2E/cross-origin.spec.ts` (C1 y K1 `currently`: sin mensaje con MP3 en Chromium, con mensaje en WebKit y con HLS); `E2E/intro.spec.ts` (sin mensaje con la intro rota) | cubierto |
| i18n: 14 locales, paridad de claves, reserva `en-US` | `PL/config/locales.test.ts`; detección en la página, `E2E/i18n.spec.ts` (`translates the player to the site language`, `falls back to English for a language without translation`, `the page language wins over the one stored in localStorage`); el paso al navegador no se alcanza nunca, porque la página limpia siempre imprime `lang` (auditoría 4.6, K55: `currently never uses the browser language…`; es el contrato desde el ADR 0025) | cubierto |

## §3.9 Visualizadores (zona congelada)

| Punto | Test(s) | Estado |
|---|---|---|
| Cuatro visualizadores, carga diferida, activos solo con audio | `E2E/visualizers.spec.ts` (`plays with the … visualizer` ×4: dibuja en un `<canvas>` sin errores de consola; `an unknown visualizer falls back to the oscilloscope`). Smoke sin píxeles y fuera de la cobertura (ADR 0018); la carga diferida no se mide | cubierto (smoke); C5 sigue «sin confirmar» |

## §3.10 Release

| Punto | Test(s) | Estado |
|---|---|---|
| Lista de inclusión del zip; sin rutas de desarrollo | `npm run check:zip` (job `Release zip`); Plugin Check sobre el zip en la CI | herramienta |
| `player/dist/` y `blocks/*/build/` commiteados y regenerados | `tests/hooks/protect-generated.test.sh`; jobs `Player` y `Block (…)` de la CI | herramienta |
| Publicación por SVN a mano | — (proceso, ADR 0015) | n/a |

## §4 Invariantes

| # | Invariante | Test / verificación | Estado |
|---|---|---|---|
| 1 | PHP 7.4 y WP 6.6 | PHPCS con PHPCompatibilityWP `7.4-`; integración en las dos puntas (jobs `PHPUnit integration (…)`) | herramienta |
| 2 | Nada de §3 cambia sin ADR | este mapa; `PI/Admin/HooksTest.php`; snapshots de bloques y de la página limpia (`E2E/snapshots/`); `backcompat-reviewer` | cubierto |
| 3 | Migración unidireccional e idempotente | `PI/Migration/MigrationGoldenTest.php` (dos pasadas) | cubierto |
| 4 | El horario es informativo | `E2E/schedule.spec.ts` (`changes the program shown without touching playback`) | cubierto |
| 5 | `crossOrigin` en las fuentes directas, no en MSE | ver §3.8 (`E2E/cross-origin.spec.ts`) | cubierto |
| 6 | Visualizadores solo con ADR | proceso (ADR 0018); `PL/vitest.config.ts` los excluye de la cobertura | herramienta |
| 7 | El núcleo no importa React ni MUI | — (`player/src/core/` no existe hasta la spec 0006) | n/a |
| 8 | Builds regenerados, nunca a mano | `.claude/hooks/protect-generated.sh` y su test | herramienta |
| 9 | El zip solo lleva su lista | `npm run check:zip` | herramienta |
| 10 | Guidelines de WordPress.org; el player solo habla por `window.RADPLAPAG_*` | Plugin Check en la CI; `wporg-reviewer`; `PL/hooks/use-config.test.tsx` | herramienta |
| 11 | Proyectos independientes | jobs `Player` y `Block (…)` de la CI, cada uno con su `npm ci` | herramienta |

## Desviaciones de la spec en esta parte

- **`filter_input()` en CLI** (§5, fase 1): devuelve `null`, así que la integración no ve la URL del stream. El guardado correcto de URL y página, el aviso tras guardar y **C13** pasan al escenario 10 de e2e (decisión del usuario, 2026-10-16); los fija `E2E/admin.spec.ts`.
- **C9, parte PHP** (§5, fase 1): el offset por petición lo fijan el snapshot de la página limpia y `E2E/clean-page.spec.ts` (`prints timezoneOffset as a number fixed per request (C9)`). La parte del player está en `PL/utils/timezone.test.ts`.
- **Cobertura de PHP por función** (§4.5): se lee de `--coverage-xml`; el clover de PHPUnit 9.6 no da funciones globales.
- **`schedule-vectors.json`** (§4.1): amplía el formato (parrillas con nombre, resultados por capa, `start_equals_end`, objeto `ts` en C3-2). Detalle en `docs/status.md`.
- **Volumen oculto en iOS y HLS nativo** (§4.4): sin e2e. El WebKit de Playwright es de escritorio y el player no lo trata como iOS (2.8); lo fijan los tests del player.
- **Filas «cubierto» con un hueco dentro** (revisión de `spec-conformance-reviewer` en el cierre de la fase 2): el paso al navegador del orden de detección i18n (`SPEC.md` §4) no se medía (cerrado en la auditoría 4.6: no se alcanza, K55); de los visualizadores, la carga diferida y que solo se animen con el audio sonando no se miden (`visualizers.spec.ts` comprueba que suena y que hay `canvas`; zona congelada, ADR 0018); la existencia de funciones, clases y constantes se cubre en lo que usan los tests, y el resto lo revisa `backcompat-reviewer`.
- **OGG y DASH sin CORS** (§4.4): `tests/fixtures/audio/tone.ogg` se servía, pero ningún e2e reproducía un directo OGG; C1 se medía en e2e con MP3 y HLS, y DASH sin CORS quedaba con la medición del spike (fila K1). Cerrado en la auditoría 4.6: variantes `ogg` y `nocors-dash` del seed, `E2E/mp3.spec.ts` (`plays the OGG stream as a direct source`) y `E2E/cross-origin.spec.ts` (`currently does not play DASH without CORS and shows the error (C1, K1)`).
