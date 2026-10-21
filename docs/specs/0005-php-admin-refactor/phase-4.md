# Spec 0005 · Fase 4 — Migración y actualización
Estado: en curso · Inicio: 2026-10-21 · ADRs: 0005, 0010, 0017, 0021, 0024, 0028

## Contexto (medido al planificar)

- Rama `spec/0005-php-admin-refactor` con `origin/trunk` ya fusionado y PR #39 en borrador: sin push ni PR nuevos. Última fase de la spec.
- Migración: `Radplapag_Migrator_Settings_To_Cpt` (296 líneas) mezcla el plan (deduplicar programas por ID heredado con huella `md5`, traducir el horario, descartar franjas sin programa conocido, listas blancas, `menu_order`) con la escritura (`wp_insert_post`, `update_post_meta`, reversión, `delete_option`/`update_option`) y dos `error_log()` con `WP_DEBUG` (K72).
- El horario se valida al escribir con `radplapag_sanitize_station_schedule()`, que lee el nombre de los programas **ya guardados** (con kses) para los mensajes: el aviso de error de `corrupt-times` y de K30 lo incluye. La validación se queda en el escritor, después de crear los programas, para que el mensaje no cambie.
- Fijado ya: `MigrationGoldenTest` (10 fixtures y sus goldens, dos pasadas) y `UpgradeFlowTest` (44 tests, K4, K21, K29–K33). **Sin fijar:** las líneas del registro de depuración (todos los tests lo mandan a `/dev/null`; `.wp-env.tests.json` tiene `WP_DEBUG`) y el orden de las escrituras y de la reversión (riesgo 6). Se caracterizan en la 4.1 y la 4.2.
- La traducción del horario quita `is_rerun` (golden `corrupt`: `true` → `false`). No está en `known-issues.md`: se conserva y se anota en la 4.1.
- **Decisión del usuario (2026-10-21):** `error_log()` no va en `WP\Migration_Writer` (la letra de §4.3), porque `includes/src/` no lleva `phpcs:` (A6). `Radplapag_Migrator_Settings_To_Cpt::run()` le pasa al escritor un closure que comprueba `WP_DEBUG` y llama a `error_log()`, con **un solo** `phpcs:ignore` y su motivo (K72). El escritor recibe un `callable $log` y lo llama en el mismo momento que hoy: los duplicados antes de crear nada, y las franjas descartadas de cada emisora justo antes de validarla (si falla la emisora 1, las de la 2 no se registran). Desviación anotada en `docs/status.md`.
- Como en las fases 1 y 3, el núcleo recibe como `callable` los saneadores de WP (`sanitize_text_field`, `sanitize_textarea_field`, `esc_url_raw`, `sanitize_key`, `absint`); los textos por defecto («Program», «Radio Station») los pone el escritor con `__()` cuando el núcleo da `''`. Las listas blancas del migrador pasan a `Data\Station::THEMES`/`VISUALIZERS` (el primero es el valor por defecto, igual que hoy).
- Actualización: los callbacks de `radplapag-upgrade.php` hacen lecturas y escrituras intercaladas (`radplapag_maybe_clear_migration_conflict_flag()` escribe entre dos comprobaciones). `Upgrade\Upgrade_Policy` son **predicados puros** (`has_migratable_stations`, `is_current`, `published_count`, `should_clear_conflict`, `is_this_plugin_update`); los callbacks siguen siendo la secuencia de hoy y los llaman, así no cambian ni el orden ni la pereza de las lecturas. Las notificaciones, el descarte (`$_GET` + nonce) y `radplapag_migration_resolve_author_user_id()` son presentación o lecturas de WP: se quedan.
- PHPStan: salen las 10 entradas de los métodos privados del migrador al moverlos; las de firma de `radplapag-upgrade.php` se quedan si siguen.

## Objetivo

Mover el plan de la migración heredada y las decisiones de la actualización al núcleo `RadioPlayerPage\` (TDD) y la escritura a `WP\Migration_Writer`, dejando `Radplapag_Migrator_Settings_To_Cpt::run()` y los callbacks de `radplapag-upgrade.php` como envoltorios, sin cambiar ningún comportamiento (K4, K21, K29–K33 se conservan), cerrar K72 y dejar la spec lista para `close-phase` (A1–A9).

## Criterios de aceptación

| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A1 Comportamiento sin cambios | `npm run check`; `npm run test:php:integration`, `:ms` y `npm run test:e2e` en `env:start:min` y `env:start:latest`; `git diff trunk -- tests/php/integration/snapshots tests/e2e/snapshots tests/e2e/a11y-baseline.json tests/fixtures/legacy-settings` vacío; en `tests/php/integration`, solo altas (4.1, 4.2) |
| A2 Contrato PHP | `HooksTest` y `PublicApiTest` sin cambios, en verde en las dos puntas |
| A3 Núcleo sin WordPress | `PureCoreTest`; `tests/php/unit/{Migration,Upgrade}/` con `npm run test:php:unit` |
| A4 Vectores | `ScheduleVectorsTest` (PHP) y `schedule-rules.test.js` (admin) sin tocar el JSON (ya cumplido; se reverifica) |
| A5 Cobertura | `node scripts/check-php-coverage.mjs coverage/php-xml`: `core` ≥ 90 %, `critical` (con `WP\Migration_Writer`) y `rest` en verde; `npm run test:coverage` (`schedule-rules.js` ≥ 85 %) |
| A6 Estándares | `npm run lint:php`, `npm run lint:phpstan`; `grep -rn 'phpcs:' includes/src` vacío; `git diff trunk -- phpstan-baseline.neon` solo con bajas |
| A7 DOM del admin | `grep -nE 'innerHTML\|\.html\(\|insertAdjacentHTML' admin/js` vacío (ya cumplido; se reverifica) |
| A8 K72 cerrada | `grep -rn 'phpcs:ignore.*error_log' includes/` con motivo en cada línea; fila K72 en «corregido (spec 0005)» |
| A9 Zip | `npm run check:zip` con los archivos nuevos en `tests/zip/expected-additions.txt` |

## Tareas

### 4.1 Caracterización: registro de depuración de la migración (≤ 1 h)
- Qué: altas en `UpgradeFlowTest` que llevan `error_log` a un archivo temporal (con `WP_DEBUG` del entorno de tests) y fijan las líneas y su orden: ID duplicado con datos distintos (una línea, antes que las de las franjas), duplicado con los mismos datos (ninguna), franjas con programa desconocido en dos emisoras (en orden de emisora), y la emisora 1 que falla la validación (las franjas de la 2 no se registran). Fija también que la franja migrada pierde `is_rerun`.
- Archivos: `tests/php/integration/Migration/UpgradeFlowTest.php` (altas).
- Test: caracterización (mutación temporal: registrar las franjas desconocidas antes de crear los programas).
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- [x] hecha · commit: (este)
- Resultado: 5 tests nuevos en `UpgradeFlowTest` (47 → 52), solo altas, con un helper `migration_log()` que manda `error_log()` a un archivo de `wp_tempnam()` durante la migración (con `WP_DEBUG` del entorno, comprobado como precondición) y devuelve los mensajes sin la fecha. Fijado: un ID heredado con datos distintos da una línea antes de las de las franjas y gana la última aparición (`Second`); con los mismos datos, ninguna línea y un solo programa; las franjas con programa desconocido se registran por emisora y en el orden del horario; si la emisora 1 falla la validación (`start` `abc`), solo se registran sus franjas, no las de la 2, no se crea ninguna emisora y el aviso empieza por «Schedule migration failed: ». Rareza nueva: K79 (la franja migrada pierde `is_rerun`), con su test `currently`. Mutaciones en el migrador, revertidas: traducir el horario de todas las emisoras antes de crear la primera (registra las franjas por adelantado) falla los tres tests de orden; registrar el duplicado sin comparar la huella falla el de los mismos datos; conservar `is_rerun` al traducir falla el de K79.

### 4.2 Caracterización: orden de las escrituras y de la reversión (≤ 1 h)
- Qué: altas que registran con `wp_insert_post`, `added_post_meta`, `deleted_post`, `deleted_option`, `added_option`/`updated_option` la secuencia de una migración de dos programas y dos emisoras, y la de una que falla en la segunda emisora (reversión del más nuevo al más viejo, sin tocar opciones).
- Archivos: `tests/php/integration/Migration/UpgradeFlowTest.php` (altas).
- Test: caracterización (mutación temporal: revertir en orden de creación).
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- [x] hecha · commit: (este)
- Resultado: 2 tests nuevos en `UpgradeFlowTest` (52 → 54), solo altas, con un helper `migration_writes()` que registra, durante la migración, los posts creados (tipo y título), su meta `radplapag_*`, los posts borrados y las opciones `radplapag_*` añadidas, actualizadas o borradas (sin transients). Fijado: con dos programas (A y B, B repetido con los mismos datos en la segunda emisora) y dos emisoras, se crean A y su meta (descripción, descripción extendida, logo), B, la emisora One con su meta en el orden de hoy (stream, página, fondo, logo, tema, visualizador, horario) y Two; después se borra `radplapag_settings` y se añade `radplapag_db_version`. Si falla la creación de la segunda emisora, se borran One, B y A (del más nuevo al más viejo) y no se toca ninguna opción. Mutaciones en el migrador, revertidas: revertir en orden de creación falla el de la reversión; guardar la versión antes de borrar la opción y escribir el horario antes que el resto de la meta fallan el de las escrituras.

### 4.3 `Migration\Legacy_Plan` (≤ 1 h)
- Qué: `build( $raw, array $sanitizers ): ?array` → `null` sin `stations` útiles (no_data), o `programs` (por ID heredado, orden de primera aparición y datos de la última), `duplicates` (IDs con huella distinta), y `stations` (título, URL, página, adjuntos, tema y visualizador con las listas de `Data\Station`, `menu_order`, horario por ID heredado y `skipped`). Títulos vacíos como `''`. `test_currently_*` replicados: K32 (`stations: ['x']` → plan sin emisoras), K30 (el plan conserva la franja que cruza y `Slot_Validator` la rechaza). El test recorre los fixtures de `tests/fixtures/legacy-settings/` con saneadores de prueba y compara una proyección del plan (más `Slot_Validator::validate` del horario) con su golden; `v1.1-flat` da `null` y `corrupt-times` falla en la segunda emisora con `format`.
- Archivos: `includes/src/migration/class-legacy-plan.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Migration/LegacyPlanTest.php`.
- Verificación: `npm run test:php:unit -- --filter LegacyPlanTest && npm run check:zip`
- [x] hecha · commit: (este)
- Resultado: `Migration\Legacy_Plan::build()` con 31 tests en `LegacyPlanTest` (TDD, en rojo sin la clase). Los programas salen como lista con `id` (string) en vez de indexados por ID heredado, para no depender de que PHP convierta en entero una clave numérica; el escritor arma el mapa. `duplicates` repite el ID cada vez que la huella cambia frente a la última aparición (una línea de registro por vez, como hoy). Las franjas de un programa desconocido van a `skipped` aunque estén en otra emisora: el plan conoce todos los programas antes de escribir, igual que hoy (se crean todos antes de la primera emisora). El test de los fixtures usa saneadores de prueba, IDs falsos para los marcadores y emula las comprobaciones de adjuntos de `register_post_meta`; cuadra con los 10 goldens. `currently` replicados: K30, K32 y K79 (citados en `known-issues.md`). Mutación, revertida: registrar como duplicado cualquier ID repetido falla el test de duplicados.

### 4.4 `WP\Migration_Writer`; el migrador delega; K72 (≤ 1 h)
- Qué: `write( array $plan, int $author, callable $log )`: registra los duplicados, crea los programas (título por defecto con `__()`), traduce los IDs, registra las franjas descartadas de cada emisora, valida con `radplapag_sanitize_station_schedule()`, crea la emisora, revierte si algo falla y al final borra la opción y guarda la versión, en el orden de hoy. `Radplapag_Migrator_Settings_To_Cpt::run()` conserva la comprobación del autor y los dos `WP_Error`, construye el plan y le pasa el closure de registro con un `phpcs:ignore … -- Debug output only behind WP_DEBUG` (K72). Salen los métodos privados y sus 10 entradas de baseline. K72 a «corregido (spec 0005)».
- Archivos: `includes/src/wp/class-migration-writer.php`, `includes/migration/class-radplapag-migrator-settings-to-cpt.php`, `tests/coverage/php-zones.json`, `tests/zip/expected-additions.txt`, `phpstan-baseline.neon`, `docs/known-issues.md`.
- Test: caracterización: `MigrationGoldenTest`, `UpgradeFlowTest` (con la 4.1 y la 4.2), `PublicApiTest`, sin cambios.
- Verificación: `npm run test:php:integration -- --filter 'MigrationGoldenTest|UpgradeFlowTest|PublicApiTest|HooksTest' && npm run lint:php && npm run lint:phpstan && grep -rn 'phpcs:ignore.*error_log' includes/`
- [x] hecha · commit: (este)
- Resultado: `WP\Migration_Writer::write()` escribe el plan en el orden de hoy (duplicados al registro, programas con su meta, y por emisora: franjas descartadas al registro, validación con `radplapag_sanitize_station_schedule()`, post y meta) y revierte del más nuevo al más viejo; al final borra `radplapag_settings` y guarda `radplapag_db_version`. El escritor arma el mapa ID heredado → post y traduce los `program_id`. `Radplapag_Migrator_Settings_To_Cpt::run()` conserva la comprobación del autor y los dos `WP_Error`, pasa los saneadores de WP por nombre y el closure de registro con el único `phpcs:ignore` (K72, corregido). Salen los seis métodos privados y sus 11 entradas de baseline (las 10 previstas más el `is_array()` siempre cierto de la reversión). 74 tests en verde (`MigrationGoldenTest`, `UpgradeFlowTest`, `PublicApiTest`, `HooksTest`) sin tocarlos. Mutación, revertida: revertir en orden de creación falla `test_failed_migration_rolls_back_newest_first_without_touching_options`.

### 4.5 `Upgrade\Upgrade_Policy` (≤ 1 h)
- Qué: predicados puros: `has_migratable_stations( $raw )`, `is_current( $stored, string $target )` (`===`), `published_count( $counts )`, `should_clear_conflict( $flag, int $published )`, `is_this_plugin_update( $options, string $basename )`. `test_currently_*` de K4 (opción plana → sin emisoras migrables).
- Archivos: `includes/src/upgrade/class-upgrade-policy.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `tests/php/unit/Upgrade/UpgradePolicyTest.php`.
- Verificación: `npm run test:php:unit -- --filter UpgradePolicyTest && npm run check:zip`
- [x] hecha · commit: (este)
- Resultado: `Upgrade\Upgrade_Policy` con los cinco predicados y 28 tests en `UpgradePolicyTest` (TDD, en rojo sin la clase). `has_migratable_stations()` cuenta cualquier lista no vacía, también `['x']` (K32); `published_count()` pide un objeto con `publish` (con `false`, `null` o un array da 0, igual que hoy); `should_clear_conflict()` usa la veracidad de la opción, como `! get_option()`; `is_this_plugin_update()` compara el basename con `in_array( …, true )`, igual que el `===` del bucle (un `0` en `plugins` no cuenta, ni en PHP 7.4). `currently` de K4 replicado (citado en `known-issues.md`). Mutación, revertida: `==` en `is_current()` falla `test_is_current`.

### 4.6 Los callbacks de la actualización delegan (≤ 1 h)
- Qué: `radplapag_legacy_has_migratable_stations()`, `radplapag_count_published_stations()`, `radplapag_ensure_schema_version_option()`, `radplapag_maybe_clear_migration_conflict_flag()`, `radplapag_run_legacy_migration_if_needed()` y `radplapag_on_upgrader_process_complete()` llaman a la política, con la misma secuencia de lecturas y escrituras y su `@since 3.5.0`. Avisos, descarte y autor sin cambios. Salen las entradas de baseline que desaparezcan.
- Archivos: `includes/radplapag-upgrade.php`, `phpstan-baseline.neon`.
- Test: caracterización: `UpgradeFlowTest`, `MigrationGoldenTest`, `HooksTest`, `PublicApiTest`, sin cambios.
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest|HooksTest|PublicApiTest' && npm run lint:php && npm run lint:phpstan`
- [x] hecha · commit: (este)
- Resultado: los seis callbacks llaman a `Upgrade\Upgrade_Policy` con un `@since 3.5.0` que lo dice; firmas, ganchos y secuencia de lecturas y escrituras sin cambios. `radplapag_maybe_clear_migration_conflict_flag()` sigue saliendo antes de contar emisoras si la bandera no está puesta (la pereza de la lectura se conserva), y `radplapag_run_legacy_migration_if_needed()` mantiene el `> 0` de las emisoras publicadas, que no tiene predicado. Avisos, descarte y autor sin tocar. Sale de la baseline el `booleanNot.alwaysFalse` de `radplapag_count_published_stations()`; se queda el de la firma de `radplapag_on_upgrader_process_complete()`. 74 tests en verde (`UpgradeFlowTest`, `MigrationGoldenTest`, `HooksTest`, `PublicApiTest`) sin tocarlos.

### 4.7 Cobertura y baseline de la fase (≤ 1 h)
- Qué: mide en `env:start:latest -- --xdebug=coverage`: `core` ≥ 90 % (con `Migration\*` y `Upgrade\*`), `critical` con el escritor; comprueba que `php-zones.json` cubre todo el código nuevo de la spec, caracteriza lo que falte y que la baseline solo ha bajado frente a `trunk`.
- Archivos: `tests/coverage/php-zones.json` y los tests que falten.
- Test: —
- Verificación: `npm run test:php:integration:coverage && node scripts/check-php-coverage.mjs coverage/php-xml && git diff trunk -- phpstan-baseline.neon`
- [x] hecha · commit: (este)
- Resultado: medido en `env:start:latest` (PHP 8.4) con Xdebug, 839 tests en verde: `critical` 97,04 % (426/439), `core` 100 % (577/577; `Migration\Legacy_Plan` 83/83 y `Upgrade\Upgrade_Policy` 13/13), `rest` 89,43 %. `WP\Migration_Writer` 79/79, el migrador 18/20 y `radplapag-upgrade.php` 83/85. `php-zones.json` ya cubre todo el código nuevo de la spec (`includes/src/**` en `core` y los siete `includes/src/wp/*` en `critical`): sin cambios y sin nada que caracterizar. Baseline frente a `trunk`: 156 líneas menos y ninguna nueva.

### 4.8 Cierre de la spec: historial y notas para las correcciones (≤ 1 h)
- Qué: `SPEC.md` §6 (namespace interno y script `radplapag-schedule-rules`, sin cambios en el contrato); en `docs/known-issues.md`, la columna de archivo de las filas que corrigen la 0008–0013 apunta también al código nuevo (K4, K29–K33 y las de horario que falten); en `docs/specs/README.md`, una nota por spec (0008, 0009, 0010, 0012, 0013) con dónde queda cada corrección.
- Archivos: `SPEC.md`, `docs/known-issues.md`, `docs/specs/README.md`.
- Test: —
- Verificación: `npm run check`
- [x] hecha · commit: (este)
- Resultado: `SPEC.md` §6 con la fila de la 0005 (sin cambios en el contrato; namespace interno y script `radplapag-schedule-rules`, ADR 0028). En `known-issues.md`, 20 filas de la 0008–0013 (y K4) apuntan también a su clase nueva: C3, C9, C10, C13, C16, K4, K29–K33, K41–K44, K46, K52, K74, K75 y K79 (esta, solo al plan, con el nombre antiguo entre paréntesis); las que ya lo hacían (K5, K17, K21, K24, K34, K37, K38, K78) y las que siguen en código sin mover (página limpia, `uninstall.php`, render de meta boxes y bloques, DOM del admin) no cambian. En `docs/specs/README.md`, una nota por spec (0008, 0009, 0010, 0012, 0013) con dónde queda cada corrección.

## Decisiones abiertas → ADR

- Ninguna nueva. El `error_log()` en el envoltorio lo decidió el usuario al planificar y va como desviación en `docs/status.md`.

## Verificación de la fase (en `close-phase`)

`npm run check`, integración y `:ms` y e2e completos en `env:start:min` y `env:start:latest`, cobertura PHP por zonas y `test:coverage`, `check:zip`; revisores (spec-conformance, backcompat, wp-security, wporg). Es la última fase: `close-phase` cierra la spec y deja el PR #39 listo.
