# Spec 0008 · Fase 1 — Migración
Estado: en curso · Inicio: 2026-10-22 · ADRs: 0005, 0010, 0021, 0028; nuevos 0037 (migración) y 0038 (toma con `INSERT IGNORE`)

## Contexto
Lo medido al planificar:
- La migración la lanzan `radplapag_run_legacy_migration_if_needed()` (`includes/radplapag-upgrade.php`), `Migration\Legacy_Plan`, `WP\Migration_Writer` y `Upgrade\Upgrade_Policy`. El bloqueo es el transient `radplapag_migrating` (120 s) y se suelta también tras un fallo.
- **Migración cortada:** si la migración se corta tras crear una emisora publicada, la pasada siguiente la cuenta como conflicto y nunca migra; si se corta solo con programas, los duplica. Para que la purga de D5 funcione, el bloqueo se toma **antes** de contar las emisoras publicadas.
- `MigrationGoldenTest::dump()` lee el transient de éxito (`'1'` en 8 *goldens*) y el transient `radplapag_migrating`, no la opción. Con D4 el *dump* no cambia; con D6 cambian los 8 *goldens*.
- Varios tests de caracterización sin `currently` cambian por diseño (D2, D3, D4, D6). **Decisión del usuario (2026-10-22):** §4.3 de la spec se amplía con la lista en el commit del plan, y cada test pasa a regresión en el commit de su tarea:
  - D2: `test_dismiss_with_valid_nonce_deletes_flag_and_redirects`, `test_conflict_notice_links_to_nonced_dismiss_url` (`is-dismissible`).
  - D4: `test_migration_does_not_run_while_locked`, `test_migration_lock_expires_in_120_seconds`, `test_failed_migration_rolls_back_and_records_error`, `test_failed_migration_is_retried_on_next_request`, `test_migration_writes_programs_then_stations_then_options`.
  - D3: `test_skipped_slots_of_stations_after_a_failing_one_are_not_logged`.
  - D6: `test_successful_migration_records_outcome_and_releases_lock`, `test_conflict_flag_is_cleared_and_migration_runs_without_published_stations`, y `transients.radplapag_migration_success_notice` en los 8 *goldens* que migran.
- `Slot_Validator::validate()` ordena por inicio y solo informa del primer solape entre días. D3 llama a `validate()` con lo aceptado más la franja candidata, así que no depende de eso.

## Objetivo
Corregir K29, el bloqueo y el reintento (4.3), K30, K79, K31 y K32 con su test de regresión. `SPEC.md` §3.1 y §3.2, el ADR 0037 y la rule de datos quedan al día.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A1 K29 | `UpgradeFlowTest` (descarte → `'dismissed'`, no vuelve a `'1'` y no se pinta; con 0 publicadas se borra y migra; `is-dismissible`) + `UpgradePolicyTest` |
| A2 K30 | `SlotFilterTest` (vectores) + `UpgradeFlowTest` (lunes se conserva, martes se descarta, el aviso la nombra) + *golden* `v3.2-cross-day-overlap` + `corrupt-times` regenerado |
| A3 4.3 | `UpgradeFlowTest`: bloqueo vigente, caducado, valor cambiado entre la lectura y la toma, transient heredado ignorado, sin reintento antes de 15 min y purga de los posts pendientes |
| A4 K79 | `LegacyPlanTest` + `UpgradeFlowTest` + *golden* `corrupt` |
| A5 K31 | `UpgradeFlowTest` (`AC\DC`, `\o/`, `C:\x`) |
| A6 K32 | `UpgradeFlowTest`: opción borrada, `'330'` y aviso de 0 emisoras |
| Global | `npm run check` y `npm run test:php:integration` en verde; la baseline de PHPStan no sube; `check:zip` con las altas |

## Tareas
### 1.1 ADR 0037: contrato de la migración (≤ 1 h)
- Qué: `write-adr`. Cubre la opción `radplapag_migrating` (sin autoload; guarda la hora en que caduca; se toma con `add_option()` y, si ha caducado, con un `UPDATE` condicional). Espera de 120 s mientras corre y de 900 s tras un fallo, y el aviso de error dura 900 s. El transient heredado se ignora. También cubre la meta `_radplapag_migration_pending`, el valor `'dismissed'`, el resumen del aviso de éxito (`'1'` se sigue leyendo), el descarte de franjas (enmienda el ADR 0010) e `is_rerun`. `SPEC.md` §3.1 y §3.2 y `.claude/rules/data-and-migrations.md` se actualizan en el mismo commit.
- Archivos: `docs/adr/0037-*.md`, `docs/adr/README.md`, `SPEC.md`, `.claude/rules/data-and-migrations.md`
- Test: — (docs)
- Verificación: `npm run check`
- [x] hecha · commit: `865a49a`

### 1.2 K29: el descarte se recuerda (≤ 1 h)
- Qué: `fix-bug`. El descarte pone la bandera a `'dismissed'`. Tras `radplapag_maybe_clear_migration_conflict_flag()` (que la sigue borrando con cualquier valor si hay 0 emisoras publicadas), si la bandera sigue puesta, la pasada sale sin contar las emisoras. Solo se fija `'1'` sin bandera previa. El aviso sale solo con `'1'` y lleva `is-dismissible`. En `Upgrade_Policy`, el predicado nuevo `shows_conflict_notice( $flag )`.
- Archivos: `includes/radplapag-upgrade.php`, `includes/src/upgrade/class-upgrade-policy.php`, `tests/php/integration/Migration/UpgradeFlowTest.php`, `tests/php/unit/Upgrade/UpgradePolicyTest.php`
- Test: primero. `test_currently_conflict_notice_reappears_after_dismissal` pasa a `test_dismissed_conflict_notice_stays_dismissed`. Además, los 2 tests de D2 y un test nuevo: `'dismissed'` con 0 publicadas → se borra y migra.
- Verificación: `npm run test:php:unit -- --filter UpgradePolicyTest && npm run test:php:integration -- --filter UpgradeFlowTest`
- Rojo (2026-10-22): `Call to undefined method Upgrade_Policy::shows_conflict_notice()`; en `UpgradeFlowTest`, 3 fallos: `test_dismissed_conflict_notice_stays_dismissed` y `test_dismiss_with_valid_nonce_marks_flag_dismissed_and_redirects` (`false` en vez de `'dismissed'`) y `test_conflict_notice_links_to_nonced_dismiss_url` (sin `is-dismissible`). `test_dismissed_conflict_is_cleared_and_migration_runs_without_published_stations` ya pasaba (la limpieza borra con cualquier valor): se vio en rojo con una mutación temporal (`should_clear_conflict()` solo con `'1'`), revertida. `test_dismiss_with_valid_nonce_deletes_flag_and_redirects` pasa a `test_dismiss_with_valid_nonce_marks_flag_dismissed_and_redirects`.
- Changelog: «The migration conflict notice can now be dismissed, and stays dismissed.»
- [x] hecha · commit: `84209c9`

### 1.3 Caracterizar el bloqueo y la migración cortada (≤ 1 h)
- Qué: `characterize`. Dos tests nuevos: `test_currently_interrupted_migration_duplicates_programs` (programas creados, bloqueo caducado → al reintentar quedan duplicados) y `test_currently_interrupted_migration_with_a_station_is_a_conflict`. Se validan con una mutación temporal y se apuntan en `known-issues.md` (fila nueva o nota en 4.3, según lo que diga la skill).
- Archivos: `tests/php/integration/Migration/UpgradeFlowTest.php`, `docs/known-issues.md`
- Test: caracterización
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- Resultado (2026-10-22): el corte se simula con una excepción lanzada desde un hook (`wp_insert_post_empty_content` de la emisora; `added_post_meta` de `radplapag_station_stream_url`), sin costura. Mutaciones temporales en `radplapag-upgrade.php`, revertidas: `> 1` en vez de `> 0` al contar las emisoras publicadas (falla el del conflicto) y el bloqueo siempre puesto (fallan los dos). Fila nueva K84 en `known-issues.md`.
- [x] hecha · commit: `d65a0fd`

### 1.4 Bloqueo atómico como opción (D4, primera parte) (≤ 1 h)
- Qué: adaptador nuevo `WP\Migration_Lock` (`acquire( int $now, int $ttl ): bool`, `hold_until( int $until )`, `release()`). Primero `$wpdb->query( $wpdb->prepare( 'INSERT IGNORE INTO … ( option_name, option_value, autoload ) VALUES ( %s, %s, \'off\' )' ) )` (ADR 0038). Si ya existe y ha caducado, se toma con `$wpdb->query( $wpdb->prepare( 'UPDATE … WHERE option_name = %s AND option_value = %s' ) )`. Las dos solo ganan si cambian 1 fila; después, `wp_cache_delete()` de la opción, `alloptions` y `notoptions`. La excepción de PHPCS va en su línea con el motivo. En `Upgrade_Policy`, el predicado `is_lock_held( $stored, int $now )`. El transient heredado se ignora. Orden de la pasada: versión, datos heredados, bandera, tomar el bloqueo, contar las emisoras publicadas (si hay conflicto se suelta el bloqueo) y migrar.
- Archivos: `includes/src/wp/class-migration-lock.php` (nuevo), `includes/src/upgrade/class-upgrade-policy.php`, `includes/radplapag-upgrade.php`, `tests/zip/expected-additions.txt`, `UpgradeFlowTest.php`, `UpgradePolicyTest.php`
- Test: primero. Los tests de D4 sobre el bloqueo vigente, el de 120 s y el orden de escrituras, más tests nuevos: caducado → se toma; valor cambiado entre la lectura y la toma (un filtro `option_radplapag_migrating` devuelve un valor viejo) → no se toma; el transient heredado no bloquea; la opción en la tabla con `notoptions` en la caché diciendo que no existe → no se toma (ADR 0038).
- Verificación: `npm run test:php:unit -- --filter UpgradePolicyTest && npm run test:php:integration -- --filter UpgradeFlowTest`
- ADR 0038 (2026-10-22, decisión del usuario): al empezar se vio que `add_option()` hace `INSERT … ON DUPLICATE KEY UPDATE` y deja ganar a dos peticiones, así que la primera toma es un `INSERT IGNORE`. Se enmiendan el punto 2 del ADR 0037, la D4, §3 de la spec y `SPEC.md` §3.1.
- Rojo (2026-10-22): en `UpgradePolicyTest`, 6 errores (`Call to undefined method Upgrade_Policy::is_lock_held()`). En `UpgradeFlowTest`, 2 errores (`Migration_Lock` no existe) y 9 fallos: el bloqueo vigente, caducado, cambiado entre la lectura y la toma, en la tabla con `notoptions`, el transient heredado, la toma antes de contar, el conflicto que suelta el bloqueo, los 120 s y los dos de K84 (su precondición del bloqueo). Mutación temporal (la primera toma con `add_option()`): solo falla `test_lock_in_the_table_is_not_taken_when_the_cache_says_it_is_missing`; revertida.
- Ajustes de ayudantes por D4, sin cambiar aserciones de tests fuera de la lista: `migration_writes()` deja fuera la opción del bloqueo, como antes dejaba el transient (el test del orden de escrituras y el del *rollback* siguen sin cambios), e `interrupt_migration()` (K84) comprueba que queda la opción y la caduca moviendo su hora al pasado. `test_successful_…` y `test_failed_migration_rolls_back_…` comprueban la opción en vez del transient (en la 1.5 el segundo pasa a retenerla 900 s).
- [x] hecha · commit: `dad4126`

### 1.5 Espera de 15 min tras un fallo (D4, segunda parte) (≤ 1 h)
- Qué: si la escritura falla, `hold_until( now + 900 )` en lugar de soltar el bloqueo, y el aviso de error dura 900 s. Si termina bien, `release()`.
- Archivos: `includes/radplapag-upgrade.php`, `UpgradeFlowTest.php`
- Test: primero. `test_failed_migration_rolls_back_and_records_error` (bloqueo retenido, 900 s) y `test_failed_migration_is_retried_on_next_request` pasa a `…_is_not_retried_until_the_wait_expires` (no reintenta; con la opción caducada, sí).
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- [x] hecha · commit: `805d5ee`

### 1.6 Reintento sin duplicados (D5) (≤ 1 h)
- Qué: `Migration_Writer` crea cada post con `meta_input => [ '_radplapag_migration_pending' => '1' ]` y, al terminar bien, llama a `delete_post_meta_by_key()`. Tras tomar el bloqueo y antes de contar las emisoras, `Migration_Lock::purge_pending()` (o una función en el escritor) borra para siempre los posts que tienen la meta, en cualquier estado. El *rollback* actual se queda.
- Archivos: `includes/src/wp/class-migration-writer.php`, `includes/src/wp/class-migration-lock.php`, `includes/radplapag-upgrade.php`, `UpgradeFlowTest.php`, `docs/known-issues.md`
- Test: primero. Los dos `currently` de 1.3 pasan a regresión (`…_is_retried_without_duplicates` y `…_with_a_station_is_purged_and_migrated`). Otro test nuevo comprueba que no queda ninguna meta pendiente tras el éxito.
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- Rojo (2026-10-22): 3 fallos en `UpgradeFlowTest`. `test_interrupted_migration_is_retried_without_duplicates` (`['Morning', 'Morning']` en vez de `['Morning']`), `test_interrupted_migration_with_a_station_is_purged_and_migrated` (la opción heredada se queda: conflicto) y `test_pending_posts_in_any_status_are_purged_before_migrating` (el programa en `trash` sigue). `test_successful_migration_leaves_no_pending_meta` pasaba sin la meta: se vio en rojo con una mutación temporal (sin `delete_post_meta_by_key()`), revertida. La purga es `Migration_Writer::purge_pending()`, con todos los estados de `get_post_stati()`.
- Changelog: «An interrupted legacy migration is now retried without duplicating radio shows and without being blocked by its own stations.»
- [x] hecha · commit: `354b0d2`

### 1.7 K30: descarte voraz de franjas (D3) (≤ 1 h)
- Qué: `fix-bug`. Clase pura nueva `Migration\Slot_Filter::filter( array $schedule, array $program_names ): array{schedule, dropped}`. Recorre de lunes a domingo, con las franjas en su orden dentro del día. Una franja se acepta si `Slot_Validator::validate( aceptadas + candidata )` no da errores; si no, va a `dropped` (día, inicio, fin y nombre del programa). `Migration_Writer` la aplica tras crear los programas, registra cada descarte en el log y pasa lo que queda por `radplapag_sanitize_station_schedule()` como red. `write()` devuelve el resumen `{ stations: int, dropped: list<{station, day, start, end, program}> }` o un `WP_Error`, y `Radplapag_Migrator_Settings_To_Cpt::run()` lo devuelve tal cual (se actualiza su `@return`; si `SPEC.md` la lista como contrato, se para). Los docblocks que citan K30 se actualizan.
- Archivos: `includes/src/migration/class-slot-filter.php` (nuevo), `class-migration-writer.php`, `includes/migration/class-radplapag-migrator-settings-to-cpt.php`, `includes/radplapag-upgrade.php` (acepta el resumen), `tests/php/unit/Migration/SlotFilterTest.php` (nuevo), `LegacyPlanTest.php` (`currently` de K30 → regresión; su proyección del *golden* pasa por `Slot_Filter`), `UpgradeFlowTest.php`, `tests/fixtures/legacy-settings/v3.2-cross-day-overlap.json` y su *golden*, *golden* `corrupt-times` (unit e integración), `tests/zip/expected-additions.txt`, `docs/known-issues.md`
- Test: primero. Vectores de solape en el mismo día, entre días, del domingo al lunes (se queda el lunes) y de hora malformada. `test_currently_cross_day_overlap_from_3_2_never_migrates` pasa a `test_cross_day_overlap_from_3_2_drops_the_later_slot`. Se reescribe el test de D3 sobre los logs. Los *goldens* se regeneran con `RADPLAPAG_UPDATE_SNAPSHOTS=1` y se revisa su diff.
- Verificación: `npm run test:php:unit -- --filter 'SlotFilterTest|LegacyPlanTest' && npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- Rojo (2026-10-22): en la unit, `Class "RadioPlayerPage\Migration\Slot_Filter" not found` (los 9 de `SlotFilterTest`, el de K30 de `LegacyPlanTest` y la proyección de todos los *goldens*). En la integración, 3 fallos: `test_cross_day_overlap_from_3_2_drops_the_later_slot` y `test_skipped_and_dropped_slots_are_logged_station_by_station` (sin la línea del descarte; la emisora no migra) y el *golden* `v3.2-cross-day-overlap` (falta); `test_migrator_returns_the_summary`, error (`true` en vez del resumen, tras arreglar el nombre de clase del test). `test_skipped_slots_of_stations_after_a_failing_one_are_not_logged` pasa a `test_skipped_and_dropped_slots_are_logged_station_by_station` (D3). La proyección de `LegacyPlanTest` filtra con un ayudante nuevo, `filter()`; `validate()` y `test_corrupt_times_fails_on_the_second_station` siguen igual. Los *goldens* se regeneran dentro del contenedor (`RADPLAPAG_UPDATE_SNAPSHOTS=1` en el `env` de `wp-env run`: desde fuera no llega). Diff revisado: `corrupt-times` migra las dos emisoras (la rota con `[]`), y el nuevo conserva el lunes 23:00–02:00, descarta el martes 01:00–03:00 y, del domingo al lunes, se queda el lunes. `radplapag-upgrade.php` ya acepta el resumen (`is_wp_error()`); el transient sigue a `'1'` hasta la 1.8.
- Changelog: «A legacy schedule with an overlapping slot (for example, one crossing midnight into the next day, which 3.2 allowed) now migrates: the later slot is dropped and logged instead of the whole migration failing and being retried.»
- [x] hecha · commit: `2a1dc7f`

### 1.8 Resumen del aviso de éxito (D6) (≤ 1 h)
- Qué: el transient de éxito guarda el resumen. Un adaptador nuevo `WP\Migration_Notice` lo traduce con `__()`/`_n()`: «N radio stations were migrated…» y, debajo, una lista de franjas descartadas (emisora, día traducido con `Schedule_Messages::day_label()`, horas y programa), todo con `esc_html()`. El `'1'` antiguo pinta el texto de hoy.
- Archivos: `includes/src/wp/class-migration-notice.php` (nuevo), `includes/radplapag-upgrade.php`, `UpgradeFlowTest.php`, los 8 *goldens*, `tests/zip/expected-additions.txt`
- Test: primero. Los 2 tests de D6, el aviso de K30 con la franja descartada y `test_success_notice_is_printed_once` en verde sin cambios. Se regeneran los *goldens* y se revisa que solo cambie esa clave.
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- Rojo (2026-10-22): 7 fallos y 2 errores en `UpgradeFlowTest`. Los 2 de D6 (`'1'` en vez del resumen); el aviso de K30 (`test_cross_day_overlap_from_3_2_drops_the_later_slot` sin la franja descartada); 3 nuevos del aviso (`test_success_notice_lists_the_dropped_slots`, con el escape; `…_of_one_station_without_dropped_slots` y `…_with_one_dropped_slot`, los singulares de `_n()`); `test_interrupted_migration_with_a_station_is_purged_and_migrated` y `test_dismissed_conflict_is_cleared_and_migration_runs_without_published_stations` (de esta spec, leen `['stations']`), y `test_currently_stations_without_any_station_report_success` (K32), que pasa a esperar `{ stations: 0, dropped: [] }` sin perder el prefijo hasta la 1.11. `test_success_notice_is_printed_once` y `test_notices_print_in_order_success_error_conflict` siguen con `'1'`, sin cambios. `Schedule_Messages::day_label()` pasa a pública. El adaptador devuelve el HTML ya escapado y el envoltorio lo imprime con `wp_kses_post()`. *Goldens* revisados: cambian **10**, no 8, porque `corrupt-times` y `v3.2-cross-day-overlap` migran desde la 1.7; en todos solo cambia esa clave (con `dropped` en esos dos).
- Changelog: «After migrating the legacy settings, the success notice says how many radio stations were migrated and lists any schedule slot that was dropped, so it can be added again by hand.»
- [x] hecha · commit: `1b6f482`

### 1.9 K79: se conserva `is_rerun` (D7) (≤ 1 h)
- Qué: `fix-bug`. `Legacy_Plan::station()` añade `is_rerun => true === ( $slot['is_rerun'] ?? false )` (tipos de PHPDoc incluidos), y el escritor lo pasa.
- Archivos: `class-legacy-plan.php`, `class-migration-writer.php`, `LegacyPlanTest.php`, `UpgradeFlowTest.php`, *golden* `corrupt` (unit e integración), `docs/known-issues.md`
- Test: primero. Los dos `currently` de K79 pasan a regresión (`true` → `true`; sin la clave → `false`).
- Verificación: `npm run test:php:unit -- --filter LegacyPlanTest && npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- Rojo (2026-10-22): en `LegacyPlanTest`, 3 fallos (falta la clave `is_rerun` en el plan): `test_slot_keeps_is_rerun` (`true` en el lunes; sin la clave y con `'1'`, `false`) y los dos que comparan el horario del plan, que pasan a esperarla con el ayudante nuevo `planned()` (cambio de forma por diseño, D7). En `UpgradeFlowTest`, `test_migrated_slot_keeps_is_rerun` (`false` en vez de `true`). Al arreglarlo, `test_cross_day_overlap_from_3_2_drops_the_later_slot` (de la 1.7) comparaba el plan con la entrada y pasa a esperar `planned()`. *Golden* `corrupt` regenerado: solo cambia la franja `is_rerun: true` de la fixture, de `false` a `true` (el mismo *golden* sirve a la unit y a la integración).
- Changelog: «Rerun slots of the legacy settings stay reruns after the migration.»
- [x] hecha · commit: —

### 1.10 K31: `wp_slash()` en la escritura (D8) (≤ 1 h)
- Qué: `fix-bug`. Se aplica `wp_slash()` a los arrays que se pasan a `wp_insert_post()` y a los valores de `update_post_meta()`.
- Archivos: `class-migration-writer.php`, `UpgradeFlowTest.php`, `docs/known-issues.md`
- Test: primero. `test_currently_migration_strips_backslashes` pasa a `test_migration_keeps_backslashes`.
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- [ ] hecha · commit: —

### 1.11 K32: el aviso con 0 emisoras (D6) (≤ 1 h)
- Qué: `fix-bug`. Con `stations === 0`, el aviso dice «No radio station was found to migrate; the old settings entry was removed». La opción se sigue borrando y la versión pasa a `'330'`. El docblock de K32 en `Upgrade_Policy`/`Legacy_Plan` se actualiza; el plan vacío se mantiene, así que su test pierde el prefijo `currently` y conserva la aserción (se anota como «Resultado»).
- Archivos: `class-migration-notice.php`, `UpgradeFlowTest.php`, `LegacyPlanTest.php`, `class-upgrade-policy.php`, `class-legacy-plan.php`, `docs/known-issues.md`
- Test: primero. `test_currently_stations_without_any_station_report_success` pasa a `test_stations_without_any_station_report_none_migrated`.
- Verificación: `npm run check && npm run test:php:integration`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- Los valores de la espera (120 s y 900 s) y la toma del bloqueo antes de contar las emisoras: se fijan en el ADR 0037 (1.1).
- Si `wporg-reviewer` objeta el `UPDATE` directo (riesgo 3 de la spec), se pregunta.
