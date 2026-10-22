# Spec 0008 · Fase 2 — Actualización, entidades y desinstalación
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0005, 0010, 0017, 0021, 0028, 0037, 0040; nuevos 0041 (migración sin admin) y 0042 (desinstalación)

## Contexto
Lo medido al planificar:
- `radplapag_run_legacy_migration_if_needed()` (`includes/radplapag-upgrade.php`) sale si `! is_admin() || ! is_user_logged_in() || ! current_user_can( 'manage_options' )`. Solo está enganchada en `admin_init` 20. `init` 100 solo la engancha `radplapag_schedule_legacy_migration()` tras el *upgrader*. Los CPT se registran en `init` 10 y la meta en 20, así que en `init` 100 ya existen.
- **D1 con el mismo callback:** `add_action( 'init', 'radplapag_run_legacy_migration_if_needed', 100 )` y sin la guarda. `add_action()` descarta el duplicado (mismo callback y prioridad), así que la rama del *upgrader* sigue valiendo. `admin_init` 20 se queda: es contrato, y es donde migra un sitio con conflicto justo después de que `admin_init` 5 borre la bandera.
- **Conflicto en el front (D2):** hoy la pasada llama a `radplapag_maybe_clear_migration_conflict_flag()`, que cuenta las emisoras (`wp_count_posts`) cuando la bandera está puesta. Ese recuento sería una consulta en cada visita de un sitio con conflicto. La pasada solo llama a la limpieza si `is_admin()`. En el front, con la bandera puesta, sale sin contar.
- **kses (D9):** `wp_set_current_user()` dispara `set_current_user` y, con él, `kses_init`, que pone los filtros si el autor no tiene `unfiltered_html`. Pero `wp_set_current_user()` no hace nada si el ID ya es el actual (un administrador que dispara la migración), así que no basta con restaurar el usuario. Plan: `kses_remove_filters()` tras cambiar de usuario y, después de restaurarlo, `kses_init()`, que vuelve a dejar los filtros de quien estaba.
- **Aviso de éxito:** hoy caduca a los 60 s. Si la migración corre en el front, el administrador casi nunca lo vería. **Decisión del usuario (2026-10-23):** pasa a no caducar (caducidad 0). Se borra al pintarlo, como hoy, y al desinstalar. Va en el ADR 0041 y en `SPEC.md` §3.1. El de error se queda en 900 s: cada reintento lo vuelve a poner, y una petición del admin reintenta en `init` antes de `admin_notices`.
- **Tests sin `currently` que cambian por D1.** **Decisión del usuario (2026-10-23):** pasan a regresión en el commit de K33, y §4.3 de la spec se amplía en el commit del plan:
  - `test_migration_does_not_run_off_admin` → `…_runs_off_admin`.
  - `test_migration_does_not_run_logged_out` → `…_runs_logged_out`.
  - `test_migration_does_not_run_without_manage_options` → `…_runs_without_manage_options`, con el usuario restaurado.
- K21 y K43 en lo guardado y en la API no cambian (A8). `ConfigTest::test_currently_titles_saved_through_kses_keep_their_entities` y `SaveProgramMetaTest::test_currently_less_than_is_stored_as_an_entity` pierden el prefijo y conservan la aserción, como el de K32 en la 1.11. El que pasa a regresión es `GlobalsBuilderTest::test_currently_titles_and_descriptions_keep_their_entities`.
- `get_bloginfo( 'name' )` devuelve el nombre guardado con entidades (`sanitize_option` de `blogname`). Decodificar `siteTitle` cubre también ese caso.
- `uninstall.php` busca con `'post_status' => 'any'`, que deja fuera `trash` y `auto-draft` (K7), y solo borra 2 opciones (C11). No carga el plugin. Las funciones `radplapag_uninstall_*` conservan su firma.
- Lo que tiene que borrar (§3.1 tras la fase 1):
  - Opciones: `radplapag_settings`, `radplapag_db_version`, `radplapag_migration_skipped_cpt_conflict` y `radplapag_migrating`.
  - Transients: `radplapag_migrating` (el heredado), `radplapag_migration_success_notice`, `radplapag_migration_error_notice`, y `radplapag_station_schedule_errors_<id>` y `radplapag_station_field_errors_<id>` de cada emisora.
  - La meta `_radplapag_migration_pending`.

## Objetivo
Corregir K33 (con la variante de K21 en la migración), K21 y K43 en las globales del player, y C11 y K7 en la desinstalación, cada uno con su test de regresión. `SPEC.md` §3.1, §3.2, §3.4 y §3.7, los ADR 0041 y 0042 y la rule de datos quedan al día.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A7 K33 + K21 (migración) | `UpgradeFlowTest`: con el usuario 0 en el front, la pasada de `init` migra, `radplapag_get_station_for_current_page()` devuelve la emisora en la misma petición y el usuario sigue siendo el 0. Se cumplen los 3 tests de D1. En el front, con la bandera de conflicto puesta, no se cuenta ninguna emisora. Con un primer administrador sin `unfiltered_html`, los títulos se guardan sin `&amp;`, y después los filtros de kses son los de quien estaba. La migración en `admin_init` sigue en verde. El aviso de éxito no caduca. |
| A8 K21, K43 | `GlobalsBuilderTest` (decodificado). `ConfigTest` y `SaveProgramMetaTest`: lo guardado y la API no cambian. `clean-page.spec.ts`: el `h1` dice «Rock & Roll» y el JSON sigue escapado con `JSON_HEX_*`. |
| A9 C11, K7 | `UninstallTest` y `UninstallMultisiteTest` (en cada sitio): no queda ninguna opción ni transient de §3.1 (heredados y por emisora incluidos), ni posts de los dos CPT en ningún estado, ni su meta. |
| Global | `npm run check` y `npm run test:php:integration` (también `:ms`) en verde. `npm run test:e2e` en verde en las dos puntas al cerrar. La baseline de PHPStan no sube. Se mide el tiempo de la migración en el front con `multi-station`. |

## Tareas
### 2.1 ADR 0041: la migración corre sin un administrador delante (≤ 1 h)
- Qué: `write-adr`. Cubre:
  - D1: el mismo callback enganchado también en `init` 100, en cualquier petición, sin la guarda de admin y de capacidad, como el primer administrador y restaurando el usuario.
  - D9: sin kses durante la escritura y `kses_init()` al restaurar.
  - En el front, con la bandera puesta, sale sin contar emisoras; la limpieza de la bandera solo se hace en el admin.
  - El aviso de éxito sin caducidad.

  Enmienda el ADR 0037 (los 60 s) y precisa el 0010. En el mismo commit:
  - `SPEC.md` §3.2, paso 2: `init` 100 y `admin_init` 20.
  - `SPEC.md` §3.4: la fila de `init` con `radplapag_run_legacy_migration_if_needed` (100).
  - `SPEC.md` §3.1: la caducidad del transient de éxito.
  - `SPEC.md` §6: el historial.
  - `.claude/rules/data-and-migrations.md`.
- Archivos: `docs/adr/0041-*.md`, `docs/adr/README.md`, `docs/adr/0037-*.md` (nota de enmienda), `SPEC.md`, `.claude/rules/data-and-migrations.md`
- Test: — (docs)
- Verificación: `npm run check`
- [x] hecha · commit: fca23ee

### 2.2 K33: migrar en `init` en cualquier petición (D1) (≤ 1 h)
- Qué: `fix-bug`.
  - Se quita la guarda de `is_admin`, de la sesión y de `manage_options`.
  - `add_action( 'init', …, 100 )`.
  - `radplapag_maybe_clear_migration_conflict_flag()` solo si `is_admin()`.
  - El transient de éxito con caducidad 0.
  - El docblock con `@since 3.5.0` y la fila K33 a «corregido (spec 0008)».

  Se mide cuánto tarda la pasada con el *fixture* `multi-station`, con una prueba temporal que no se commitea. Si pasa de unos segundos, se para y se pregunta (riesgo 1). El resultado se apunta como «Resultado».
- Archivos: `includes/radplapag-upgrade.php`, `tests/php/integration/Migration/UpgradeFlowTest.php`, `docs/known-issues.md`
- Test: primero.
  - `test_currently_station_page_is_not_served_until_an_admin_visits` pasa a `test_station_page_is_served_on_the_first_front_request`. Con el usuario 0, corre `do_action( 'init' )` o el callback y luego `go_to()`; la emisora se devuelve y el usuario sigue siendo el 0.
  - Los 3 tests de D1 pasan a regresión.
  - Tests nuevos:
    - `test_migration_is_hooked_on_init_at_100`.
    - `test_front_pass_with_conflict_flag_does_not_count_stations`: un filtro sobre `wp_count_posts` cuenta las llamadas.
    - `test_success_notice_does_not_expire`: `_transient_timeout_…` ausente.
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- Changelog: «After updating from a version before 3.3.0, the radio station pages are served again right away, without waiting for an administrator to open the dashboard.»
- Rojo (2026-10-23): 6 fallos en `UpgradeFlowTest`. Los 3 de D1 (`false` en vez de `'330'`), `test_migration_is_hooked_on_init_at_100` (`false` en vez de `100`), `test_success_notice_does_not_expire` (con `_transient_timeout_…`) y `test_station_page_is_served_on_the_first_front_request` (`false` en vez de la emisora). `test_front_pass_with_conflict_flag_does_not_count_stations` ya pasaba (la guarda salía antes): se vio en rojo con una mutación temporal (la limpieza sin `is_admin()`, 2 recuentos), revertida.
- Resultado (2026-10-23): la aserción de los 60 s sale de `test_successful_migration_records_outcome_and_releases_lock` (la cubre el test nuevo). En la caracterización `test_upgrader_ignores_other_runs` sale `assertFalse( has_action( 'init', … ) )`: con D1 la migración siempre está enganchada en `init` 100 y la aserción ya no distingue nada (ADR 0041); se queda `assert_not_migrated()`. `HooksTest::EXPECTED` añade `init` → `radplapag_run_legacy_migration_if_needed` (100), la fila de `SPEC.md` §3.4 de la 2.1. Medida en el front, con el usuario 0 y el *fixture* `multi-station` (3 emisoras): 12–20 ms en 3 pasadas, con una prueba temporal borrada después.
- [x] hecha · commit: 54b9298

### 2.3 K21 (migración): escribir sin el kses del usuario cambiado (D9) (≤ 1 h)
- Qué: `fix-bug`. En `radplapag_run_legacy_migration_if_needed()`:
  - `kses_remove_filters()` tras `wp_set_current_user( $author_id )`.
  - `kses_init()` tras restaurar el usuario.
- Archivos: `includes/radplapag-upgrade.php`, `UpgradeFlowTest.php`, `docs/known-issues.md` (la parte de la migración de K21)
- Test: primero.
  - `test_currently_migration_without_unfiltered_html_stores_entities` pasa a `test_migration_without_unfiltered_html_keeps_ampersands`. El primer administrador no tiene `unfiltered_html`; quien dispara es otro usuario que sí lo tiene. Los títulos quedan como «Rock & Roll» y «Drum & Bass».
  - Test nuevo: `test_kses_filters_of_the_previous_user_are_restored`. Quien dispara no tiene `unfiltered_html`, así que al terminar `has_filter( 'title_save_pre', 'wp_filter_kses' )`. Y al revés: quien dispara sí lo tiene, así que no.
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- Changelog: «Radio station and radio show titles migrated from the legacy settings keep their ampersands on sites where administrators cannot post unfiltered HTML.»
- Rojo (2026-10-23): `test_migration_without_unfiltered_html_keeps_ampersands` falla con `'Rock &amp; Roll'`. `test_kses_filters_of_the_previous_user_are_restored` pasaba antes del arreglo (`wp_set_current_user()` reponía los filtros): se vio en rojo con el arreglo a medias, solo `kses_remove_filters()` y sin `kses_init()` (`false` en vez de `10` cuando quien dispara es el primer administrador).
- Resultado (2026-10-23): `UpgradeFlowTest` y `MigrationGoldenTest`, 88 tests en verde. El `map_meta_cap` de los tests niega `unfiltered_html` a un usuario y lo concede (`exist`) a los demás, para que el caso valga también en multisite (`UpgradeFlowTest` no está en el grupo `ms-required`).
- [x] hecha · commit: bb86490

### 2.4 K21 y K43: entidades decodificadas en las globales del player (D10) (≤ 1 h)
- Qué: `fix-bug`. `Player\Globals_Builder` decodifica, con `html_entity_decode( $v, ENT_QUOTES | ENT_HTML5, 'UTF-8' )` y solo en los valores de cadena:
  - `siteTitle` en `config()`;
  - `name`, `description` y `extendedDescription` en `programs()`.

  Lo hace un método privado `decode()`, y los `null` siguen siendo `null`. El `<title>` y las `meta` usan `$config['siteTitle']` ya decodificado y escapan como hoy. Se actualizan los docblocks y las filas K21 y K43 a «corregido (spec 0008)».

  Para el e2e, en `tests/e2e/fixtures/seed-e2e.php` va una variante `entities`: emisora con el título guardado `Rock &amp; Roll`, insertado tal cual en la base de datos, como lo deja kses.
- Archivos: `includes/src/player/class-globals-builder.php`, `tests/php/unit/Player/GlobalsBuilderTest.php`, `tests/php/integration/Data/ConfigTest.php`, `tests/php/integration/Cpt/SaveProgramMetaTest.php`, `tests/e2e/fixtures/seed-e2e.php`, `tests/e2e/clean-page.spec.ts`, `docs/known-issues.md`
- Test: primero.
  - El `currently` de `GlobalsBuilderTest` pasa a `test_titles_and_descriptions_are_decoded` (`Rock & Roll`, `Jazz & Blues`, `I <3 jazz`), con un vector `&#039;`/`&quot;` y el `null` intacto.
  - Los dos `currently` de integración pierden el prefijo con la misma aserción: `test_titles_saved_through_kses_keep_their_entities_in_the_api` y `test_less_than_is_stored_as_an_entity`.
  - `clean-page.spec.ts`, test nuevo: el `h1` dice «Rock & Roll», `<title>Rock &amp; Roll</title>` y `siteTitle` en el JSON crudo es `Rock \u0026 Roll`. El test de escape existente no cambia.
- Verificación: `npm run test:php:unit -- --filter GlobalsBuilderTest && npm run test:php:integration -- --filter 'ConfigTest|SaveProgramMetaTest|CleanPage' && npm run test:e2e -- clean-page.spec.ts`
- Changelog: «The player no longer shows HTML entities such as &amp;amp; or &amp;lt; in radio station and radio show names and descriptions.»
- Rojo (2026-10-23): `test_titles_and_descriptions_are_decoded` falla con `'Rock &amp; Roll'` en vez de `'Rock & Roll'`. En `clean-page.spec.ts`, «decodes the entities of a title saved through kses (K21)» falla en el JSON crudo: `"siteTitle":"Rock \u0026amp; Roll"`. El `<title>` ya decía `Rock &amp; Roll` (`esc_html()` no codifica dos veces).
- Resultado (2026-10-23): el test unitario cubre también el `siteTitle` que cae al nombre del sitio, decodificado una sola vez (`Tom &amp;amp; Jerry` → `Tom &amp; Jerry`). La variante `entities` del *seed* escribe el título con `$wpdb->update()` después de crearla (un `phpcs:ignore` en su línea, como el resto del *seeder*) y añade `'entities'` a `SeedUrlKey`. Los snapshots (`mp3`, `minimal`) no cambian. `GlobalsBuilderTest`, `ConfigTest`, `SaveProgramMetaTest` y `CleanPage` en verde; `clean-page.spec.ts` en verde en Chromium (en WebKit se salta, como el resto del archivo); `npm run check` en verde.
- [x] hecha · commit: 274e39b

### 2.5 ADR 0042: la desinstalación borra todo lo que guarda el plugin (≤ 1 h)
- Qué: `write-adr`. Fija la lista completa de §3.1 que se borra en cada sitio:
  - las 4 opciones;
  - los transients globales, también el heredado `radplapag_migrating`;
  - los de errores de cada emisora, por su ID y antes de borrar el post;
  - los posts en todos los estados registrados (`get_post_stati()`), con su meta;
  - `delete_post_meta_by_key( '_radplapag_migration_pending' )`.

  Sigue sin cargar el plugin. `SPEC.md` §3.7 y §6 y la rule de datos («si se añade una opción o un transient…») se actualizan en el mismo commit.
- Archivos: `docs/adr/0042-*.md`, `docs/adr/README.md`, `SPEC.md`, `.claude/rules/data-and-migrations.md`
- Test: — (docs)
- Verificación: `npm run check`
- [ ] hecha · commit: —

### 2.6 K7: borrar los posts en cualquier estado (D11) (≤ 1 h)
- Qué: `fix-bug`. `radplapag_uninstall_delete_programs()` y `…_stations()` buscan con `'post_status' => array_keys( get_post_stati() )`. Así entran `trash`, `auto-draft` e `inherit`.
- Archivos: `uninstall.php`, `tests/php/integration/Uninstall/UninstallTest.php`, `UninstallMultisiteTest.php`, `docs/known-issues.md`
- Test: primero.
  - `test_currently_keeps_trashed_and_auto_draft_posts` pasa a `test_deletes_trashed_and_auto_draft_posts`, sin meta restante (`meta_rows()`).
  - El mismo caso en un sitio de la red.
- Verificación: `npm run test:php:integration -- --filter Uninstall && npm run test:php:integration:ms -- --filter Uninstall`
- Changelog: «Uninstalling the plugin also deletes radio stations and radio shows in the trash and auto-drafts.»
- [ ] hecha · commit: —

### 2.7 C11: borrar opciones y transients (D11) (≤ 1 h)
- Qué: `fix-bug`. Función nueva `radplapag_uninstall_delete_site_data()`, que borra todo lo de un sitio:
  - antes de borrar los posts, los dos transients de errores por cada ID de emisora (en cualquier estado);
  - las 4 opciones y los 3 transients globales;
  - `delete_post_meta_by_key( '_radplapag_migration_pending' )`.

  `radplapag_uninstall_plugin()` la llama en el sitio actual y en cada sitio de la red. Las funciones existentes no cambian de firma.
- Archivos: `uninstall.php`, `UninstallTest.php`, `UninstallMultisiteTest.php`, `docs/known-issues.md`
- Test: primero.
  - Los dos `currently` de C11 pasan a `test_deletes_the_legacy_settings_and_the_transients` (y `…_on_a_subsite`). Siembran todas las opciones (`radplapag_migrating` incluida), los transients (el heredado y los de una emisora en la papelera incluidos) y la meta pendiente.
  - `test_deletes_the_schema_and_conflict_options` sigue en verde.
- Verificación: `npm run test:php:integration -- --filter Uninstall && npm run test:php:integration:ms -- --filter Uninstall`
- Changelog: «Uninstalling the plugin now also removes the legacy settings, the migration lock and every notice it stored, on every site of a network.»
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- Si la medida de la 2.2 pasa de unos segundos, se pregunta (riesgo 1 de la spec).
- Al cerrar la fase (`close-phase`), según `status.md`, se pasan `wp-security-reviewer` y `wporg-reviewer` sobre el diff completo de la spec, además de los habituales. La lista se confirma con el usuario antes de lanzarlos.
