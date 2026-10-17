# Auditoría · zona 2, migración y actualización

Spec 0002, fase 4, tarea 4.3 · 2026-10-18 · código auditado: 3.4.2 (sin cambios).

**Alcance:** `includes/migration/class-radplapag-migrator-settings-to-cpt.php` e `includes/radplapag-upgrade.php` (versión del esquema, bloqueo, conflicto, avisos, descarte y `upgrader_process_complete`). `radplapag_sanitize_station_schedule()` solo como contexto (zona 3).

**Resultado:** 5 hallazgos confirmados (K29–K33) y una variante nueva de K21. Uno alto (K30). 17 candidatos descartados. No se ha tocado código publicado.

## 1. Herramientas estáticas

| Herramienta | Salida |
|---|---|
| PHPCS (`vendor/bin/phpcs -q` sobre la zona) | limpio. Dos supresiones, `error_log_error_log` en el migrador (`:97`, `:260`), **sin motivo en la línea** (ADR 0021 lo pide). El `error_log()` está detrás de `WP_DEBUG`, como dice `php.md`. Se apunta para el triage: añadir el motivo toca código publicado. |
| PHPStan nivel 8 (entradas de la baseline de la zona) | 12 entradas. 10 son `missingType.iterableValue` (ruido de tipos). `radplapag-upgrade.php:42` `! $counts` siempre falso → ruido: `wp_count_posts()` siempre devuelve un objeto y `isset( $counts->publish )` ya cubre el tipo sin registrar. `is_array()` redundante en `rollback_created_posts()` → ruido. Ninguna es un bug. |
| `.claude/rules/security.md` | entrada: el descarte lee `$_GET` con `wp_unslash` + `sanitize_key`/`sanitize_text_field`, nonce `radplapag_dismiss_<clave>`, `manage_options`, `wp_safe_redirect`. Datos heredados: `sanitize_text_field`/`sanitize_textarea_field`, `esc_url_raw` (quita `javascript:`), `absint`, `sanitize_key` + listas blancas de tema y visualizador, horario por el saneador del servidor, JSON con `wp_json_encode()`. Salida: avisos con `esc_html__()`/`esc_html()`/`esc_url()`. Sin SQL directo. |
| `.claude/rules/wordpress-org.md` | prefijos completos (incluidos el parámetro `radplapag_dismiss` y las acciones de nonce); textos con `__()` y el único marcador con `translators`; sin peticiones salientes. Hallazgo: K29 (aviso que no se descarta). |

Plugin Check, `composer audit`, `npm audit` y licencias: en verde en la CI del PR #37; nada de la zona.

## 2. Revisores lanzados

Los cuatro, con contexto limpio y la lista de archivos de arriba:

- **`wp-security-reviewer`**: nada explotable sin `manage_options`. Propuso el bloqueo no atómico, la migración cortada a medias, el fallo determinista que se reintenta (K30), K21 por la migración, el usuario de reserva con ID 1, la migración dentro del POST de una emisora, `upgrader_process_complete` inactivo y `radplapag_maybe_clear_migration_conflict_flag` sin capacidad.
- **`wporg-reviewer`**: K29 (rechazaría la revisión), el reintento con aviso de error en cada pantalla (K30), C11 (ya registrado), `wp_cache_flush()` de la desinstalación (descartado en 4.2), las `phpcs:ignore` sin motivo, el aviso de éxito que caduca en AJAX y «Dismiss This Notice» con mayúsculas.
- **`backcompat-reviewer`**: sin cambios de contrato ni nada por encima de PHP 7.4 / WP 6.6; meta, opciones, transients, caducidades y hooks coinciden con `SPEC.md`. Propuso K29, K30, la migración cortada y el bloqueo, la pérdida de datos con `id` repetido, la opción borrada habiendo descartado contenido, K32, el autor de reserva, el paso 3 de §3.2 que no actúa, la vuelta atrás, las listas blancas duplicadas y formatos sin fixture.
- **Code review a esfuerzo alto** (subagente general, sin `--fix`): K29, K31, K30, la migración cortada, K32, K21 por la migración, `! $counts`, el aviso de conflicto espurio por carrera, el bloqueo, y como especulativos `upgrader_process_complete`, K33, la importación diferida al despublicar, el aviso de éxito en AJAX, los títulos por defecto en el idioma del usuario, el autor de reserva y la versión futura sobrescrita.

## 3. Contraste

**`SPEC.md` §3.2 (y §3.1, §3.4):**

- Unidireccional: sí, nada escribe en `radplapag_settings`.
- Idempotente: sí en el camino feliz y en el error controlado (dos pasadas en `MigrationGoldenTest`). No ante un corte a medias o dos peticiones simultáneas (descartes, sospecha).
- Paso 1 (`plugins_loaded` 5): se cumple. Paso 2 (`admin_init` 20): se cumple; «el primer administrador» es, en el código, el de menor ID con `manage_options` entre los 20 primeros con rol `administrator`, y si no hay ninguno, el usuario 1. Paso 3 (`upgrader_process_complete`): el callback existe, pero en la actualización desde la 2.0.x–3.2.x está cargado el código anterior, que no lo engancha; la migración siempre la hace el paso 2 (K33).
- Avisos «descartables con `?radplapag_dismiss=migration_conflict`»: el descarte borra la bandera, pero la siguiente petición la vuelve a poner (K29).
- Lo que §3.2 enumera al migrar (opción borrada, `'330'`, programa compartido, franja con programa desconocido descartada, «Radio Station», `is_rerun: false`) se cumple y está en los goldens. §3.2 no dice que una franja inválida (hora o solape) **aborta toda la migración** con rollback y reintento (K30), ni que con un `id` repetido con datos distintos gana el último (golden `shared-program`). Se apunta para el cierre de la spec.
- Opciones, transients (120 s, 60 s, 120 s), meta keys escritas y hooks con prioridad y argumentos: coinciden con §3.1 y §3.4.

**Filas de `known-issues.md` de la zona:**

- **K4:** sigue, sin variantes. Fuera del contrato (ADR 0005).
- **C11:** sigue (la desinstalación deja `radplapag_settings` y los transients de la migración). Con K29 o K30 la opción heredada se queda para siempre, así que pesa más en el triage.
- **K21:** **variante nueva** por la migración (abajo).

## 4. Hallazgos confirmados

| Fila | Qué | Cómo se confirma |
|---|---|---|
| K29 | El aviso de conflicto vuelve en la petición siguiente al descarte | integración `UpgradeFlowTest::test_currently_conflict_notice_reappears_after_dismissal` |
| K30 | Un solape entre días que la 3.1/3.2 guardaba hace fallar la migración para siempre, con reintento en cada petición del admin | integración `UpgradeFlowTest::test_currently_cross_day_overlap_from_3_2_never_migrates` + reproducción 1 (que la 3.2.0 lo guardaba) |
| K31 | La migración pierde las barras invertidas | integración `UpgradeFlowTest::test_currently_migration_strips_backslashes` |
| K32 | `stations` sin ninguna emisora válida: opción borrada y aviso de éxito | integración `UpgradeFlowTest::test_currently_stations_without_any_station_report_success` |
| K33 | La página del player no se sirve hasta que un administrador abre el admin | integración `UpgradeFlowTest::test_currently_station_page_is_not_served_until_an_admin_visits` |
| K21 (variante) | La migración cambia al primer administrador y kses guarda `&amp;` si no tiene `unfiltered_html` | integración `UpgradeFlowTest::test_currently_migration_without_unfiltered_html_stores_entities` |

**Mutación de comprobación** de los seis tests, temporal y revertida (`git checkout` de los dos archivos; `git diff` limpio sobre el código): sin el `update_option()` de la bandera de conflicto, `&& false` en el `is_wp_error()` del horario del migrador, `kses_remove_filters()` tras `wp_set_current_user( $author_id )`, `wp_slash()` en el título de la emisora, `WP_Error` si no se creó ningún post y `if ( false )` en la guarda de `radplapag_run_legacy_migration_if_needed()` → los seis en rojo; revertida, verdes.

### Reproducciones

1. **K30: la 3.2.0 guardaba el solape entre días.** En el entorno de tests (`npm run env:start:latest`), sin escribir nada en el repo:
   1. `git show v3.2.0:admin/sanitize-settings.php`, líneas 34–448 (`radplapag_sanitize_settings()`), renombrada a `audit_v320_sanitize_settings()`, más un guion que fija `$_POST['_wpnonce']` con `wp_create_nonce( 'radplapag_settings_group-options' )`, crea una página y le pasa una emisora con «Late» el lunes 23:00–02:00 y «Early» el martes 01:00–03:00.
   2. `npx wp-env --config .wp-env.tests.json run cli wp eval-file - < guion.php`.
   3. Salida: el horario devuelto conserva las dos franjas (`{"monday":[…"23:00"…"02:00"],"tuesday":[…"01:00"…"03:00"]}`) y `get_settings_errors()` solo trae `radplapag_schedule_cross_day_overlap`. WordPress guarda lo que devuelve el saneador: el aviso no impide guardar.
   4. La página creada se borra al final del guion.
   - La tercera pasada de la 3.2.0 (líneas 330–420) solo llama a `add_settings_error()` y hace `break 2`; no quita la franja. La 3.1.0 no comprueba el cruce de días en el servidor (solo su JS). El JS de la 3.1/3.2 sí bloquea el envío, así que hace falta saltárselo (JS desactivado o un envío sin el formulario), pero el servidor lo aceptaba.

## 5. Descartados

- Bloqueo `radplapag_migrating` no atómico (`get_transient` + `set_transient`): dos peticiones del admin simultáneas podrían migrar dos veces. Ventana de microsegundos, no reproducida. Sospecha para el triage.
- Aviso de conflicto espurio tras una migración correcta por una petición concurrente con `alloptions` antiguo: misma carrera, no reproducida. Sospecha para el triage.
- Migración cortada a medias (fatal o `max_execution_time`): sin rollback, y si solo se crearon programas el reintento los duplica. Depende de un plugin de terceros o de límites del servidor; no reproducido sin provocarlo artificialmente. Sospecha para el triage.
- Migración dentro del POST del formulario de una emisora, que copiaría meta del formulario en las emisoras migradas: requiere un fallo transitorio previo y el envío en esa ventana; muy improbable.
- `upgrader_process_complete` no actúa en la actualización desde la 3.2.x: sin efecto propio (la migración la hace `admin_init`); su consecuencia es K33. La redacción del paso 3 de §3.2 se apunta para el cierre.
- Usuario de reserva con ID 1 (sin comprobar que exista ni que pertenezca al sitio): sin ningún administrador con rol en el sitio no se ha visto; especulativo.
- `radplapag_maybe_clear_migration_conflict_flag()` sin comprobación de capacidad: solo borra la bandera con 0 emisoras publicadas, que es la condición correcta.
- Importación diferida al despublicar todas las emisoras meses después: es lo que el aviso de conflicto propone («Remove or unpublish extra radio stations if you want to import legacy data») y está fijado (`test_conflict_flag_is_cleared_and_migration_runs_without_published_stations`).
- Un `id` de programa repetido con datos distintos pierde los de la primera aparición: fijado por el golden `shared-program`; en la 3.2 los `id` se generaban únicos (`prog_…`). Precisión de §3.2 para el cierre.
- La opción se borra aunque se hayan descartado franjas, programas sin `id` o adjuntos: decisión del ADR 0010, fijada por los goldens `corrupt` y `attachments`.
- Aviso de éxito que caduca a los 60 s si la migración corre en AJAX: no se pierde nada.
- Títulos por defecto («Radio Station», «Program») en el idioma del usuario que migra: inocuo.
- `radplapag_ensure_schema_version_option()` sobrescribe una versión futura mayor: latente, solo con una migración nueva.
- Vuelta atrás a la 3.2 y nueva actualización: el `radplapag_settings` nuevo se ignora; el ADR 0010 dice que no hay vuelta atrás.
- Listas blancas de tema y visualizador duplicadas en el migrador: hoy coinciden.
- Formatos 2.0.0 y 3.0.x sin fixture: no hay tags de esas versiones en el repositorio (sí `v2.0.1`, `v2.0.2`, `v3.1.0`, `v3.2.0`); `v2.0-branding` y `no-schedule` cubren la forma.
- `wp_set_current_user()` sin restaurar si algo lanza una excepción: la petición muere igualmente.
