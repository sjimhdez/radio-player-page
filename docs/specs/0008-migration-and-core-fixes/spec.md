# Spec 0008 — Correcciones: migración, actualización, núcleo PHP y desinstalación

> Estado: **propuesta** · Fecha: 2026-10-22 · Rama: `spec/0008-migration-and-core-fixes` · Depende de: 0005
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0001, 0005, 0008, 0010, 0017, 0021 y 0028, `SPEC.md` §3.1–§3.4 y §3.7, `.claude/rules/data-and-migrations.md` y `php.md`, y las filas K29, K30, K31, K32, K33, K79, C11, K7, K21, K43, K23, K24, K25 y K26 de `docs/known-issues.md`. Su columna «Decisión del usuario» es el mandato.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0008-migration-and-core-fixes/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Es una spec de correcciones:** cada fila se corrige con `fix-bug`. Su test `currently` pasa a test de regresión en rojo y luego a verde, en las dos capas que cite la fila (núcleo e integración). La fila pasa a «corregido (spec 0008)». Ningún otro test de caracterización se edita para que pase. Las únicas excepciones las nombra §4.3: los *goldens* `corrupt-times` y `corrupt`, el test del ID 0 de K24 y los tests que cambian por diseño D2, D3, D4 y D6. Si cae otro test que no es de una fila de esta spec, se para y se pregunta.
5. Esta spec **fusiona la 0008 y la 0012** de la hoja de ruta (decisión del usuario, 2026-10-22). Las dos tocan `uninstall.php` y `SPEC.md` §3.7, y la 0008 añade lo que la desinstalación tiene que borrar. No hay número 0012.
6. La lógica pura va en `includes/src/<zona>/` (ADR 0028, sin funciones de WordPress). Los adaptadores van en `includes/src/wp/`. Las funciones `radplapag_*` y los callbacks enganchados conservan su firma.

## 1. Contexto y objetivo

La 0005 dejó la migración heredada partida en un plan puro (`Migration\Legacy_Plan`), una escritura (`WP\Migration_Writer`) y una política de actualización (`Upgrade\Upgrade_Policy`). Sus rarezas quedaron fijadas como `currently`. El triage de la 0002 aprobó corregirlas, junto a las del núcleo PHP y la desinstalación:

- **Migración y actualización:**
  - El aviso de conflicto no se puede descartar (K29), lo que **bloquea la revisión de wordpress.org**.
  - Un horario de la 3.2 con un solape entre días no se migra nunca y reintenta en bucle (K30).
  - La página del player deja de servirse hasta que un administrador abre el admin (K33).
  - El bloqueo no es atómico y una migración cortada a medias duplica lo creado (auditoría 4.3).
  - Se pierden las barras invertidas (K31). (K79, la pérdida de `is_rerun`, no es un bug: los formatos heredados no lo tienen; ADR 0039.)
  - Un aviso de éxito puede ser falso (K32).
- **Desinstalación:** deja opciones, transients y entradas en la papelera (C11, K7).
- **Núcleo PHP:**
  - El player muestra entidades HTML (K21, K43).
  - La página limpia ignora «Disuadir a los motores de búsqueda» y RTL (K23, sospecha 5.6).
  - También responde en `feed/` y `embed/` (K26).
  - Dos rarezas de la API pública (K24, K25).

Al cerrar la spec, todas esas filas están corregidas con su test de regresión. `SPEC.md` §3.1, §3.2, §3.3, §3.4 y §3.7 describen el contrato nuevo con sus ADRs, y la desinstalación borra todo lo que el plugin guarda.

**No objetivos:**

- K4 (formatos 1.x: no arreglar, ADR 0005).
- El horario y el programa en antena (0009), el admin (0010) y los bloques (0013).
- La maqueta del player en RTL: solo se imprime `dir`; si se ve mal, va en otra fila.
- K76 y K83, que siguen pendientes de asignar.

## 2. Criterios de aceptación

Cada fila, con `fix-bug`. «Regresión» = el `currently` que cita `known-issues.md` cambia de nombre y de aserción en ese mismo commit, en todas las capas que cita.

| # | Fila | Criterio (test) |
|---|---|---|
| A1 | K29 | `UpgradeFlowTest`: tras «Dismiss This Notice», la bandera vale `'dismissed'`. En las peticiones siguientes, `radplapag_run_legacy_migration_if_needed()` no la devuelve a `'1'` y el aviso no sale. Al despublicar todas las emisoras, la bandera se borra y la migración corre (el test existente `test_conflict_flag_is_cleared_and_migration_runs_without_published_stations` sigue en verde). El aviso lleva `is-dismissible`. `UpgradePolicyTest`: los predicados nuevos o cambiados (D2) |
| A2 | K30 | `UpgradeFlowTest`: el horario de la 3.2 con el lunes 23:00–02:00 y el martes 01:00–03:00 migra. Se conserva la franja del lunes, se descarta la del martes, se migran todas las emisoras y sale el aviso que nombra la franja descartada. `LegacyPlanTest` (o la clase pura que diga el plan): el filtrado voraz de D3, con vectores de solape en el mismo día, entre días, del domingo al lunes y de hora malformada. Fixture nuevo `tests/fixtures/legacy-settings/v3.2-cross-day-overlap.json` con su *golden*. El *golden* `corrupt-times` cambia (§4.3) |
| A3 | 4.3 | `UpgradeFlowTest`: con el bloqueo puesto, otra pasada no migra. Un bloqueo caducado se puede tomar y dos tomas simultáneas no ganan las dos (D4). Si la escritura falla, no se reintenta antes de que caduque la espera (sin bucle). Si una migración se corta tras crear posts (se simula con posts marcados con la meta de D5 y el bloqueo caducado), el reintento los borra antes de crear y no queda nada duplicado. El transient heredado `radplapag_migrating` se ignora |
| A4 | K79 | **Retirado** (ADR 0039): K79 no es un bug. `LegacyPlanTest` y `UpgradeFlowTest` fijan que la franja migra con `is_rerun: false`; el *golden* `corrupt` no cambia por K79 (sí por D6) |
| A5 | K31 | `UpgradeFlowTest`: «AC\DC», `\o/` y `C:\x` se migran intactos (título, nombre y meta) |
| A6 | K32 | `UpgradeFlowTest`: `stations: ['x']` borra la opción y fija `'330'` (ADR 0010). El aviso dice que no se migró ninguna emisora, no «were migrated» |
| A7 | K33 + K21 (migración) | `UpgradeFlowTest`: con el usuario 0 y una petición del front, la migración corre en `init` y la página del player se sirve en esa misma petición (`radplapag_get_station_for_current_page()` devuelve la emisora). Al terminar, el usuario actual es el de antes. Con un primer administrador sin `unfiltered_html`, los títulos migrados no llevan `&amp;`. La migración en `admin_init` sigue funcionando |
| A8 | K21, K43 | `GlobalsBuilderTest`: `siteTitle` y `name`, `description` y `extendedDescription` de `RADPLAPAG_PROGRAMS` salen decodificados (`Rock &amp; Roll` → `Rock & Roll`, `I &lt;3 jazz` → `I <3 jazz`). `ConfigTest`: la API PHP (§3.4) **no** cambia: `radplapag_get_stations()` sigue devolviendo el título guardado. `clean-page.spec.ts`: el `h1` dice «Rock & Roll» y el JSON impreso sigue escapado con las banderas `JSON_HEX_*` |
| A9 | C11, K7 | `UninstallTest` y `UninstallMultisiteTest` (en cada sitio): no queda ninguna de las opciones de §3.1 (incluidas las nuevas), ni los transients de §3.1 (también el heredado `radplapag_migrating` y los de errores por emisora), ni posts de los dos CPT en ningún estado (`trash` y `auto-draft` incluidos), ni su meta |
| A10 | K23 + 5.6 | `clean-page.spec.ts`: con `blog_public = 0`, `<meta name="robots" content="noindex, nofollow">`; con `1`, ninguno; nunca pasa por el filtro `wp_robots`. Con la dirección RTL simulada (§4.3), `<html … dir="rtl">`; en LTR, sin `dir`. Antes de corregir, sus `currently` (hoy solo hay reproducción en `audit/core.md`) |
| A11 | K24 | `ConfigTest` y `StationsTest`: en el archivo de una categoría cuyo `term_id` coincide con una página asignada, `radplapag_get_station_for_current_page()` devuelve `false`. Con nada consultado (ID 0), también `false` (§4.3) |
| A12 | K25 | `CptTest`: `current_user_can( 'edit_post', $post )` con un `WP_Post` de emisora no da aviso y resuelve `manage_options`, igual que con el ID |
| A13 | K26 | `clean-page.spec.ts`: `/<página>/feed/`, `/<página>/embed/` y `/<página>/trackback/` no sirven el player (`RADPLAPAG_CONFIG` ausente; WordPress responde lo suyo). La página sigue sirviéndose. Antes, su `currently` |
| A14 | Global | `npm run check`, integración y e2e en las dos puntas (`env:start:min` y `env:start:latest`) en verde. Cobertura del núcleo PHP (`includes/src/**` sin `wp/`) ≥ 90 %. PHP crítico (migración y actualización) ≥ 90 %. `uninstall.php` cubierto por la integración. La baseline de PHPStan no sube. `npm run check:zip` con las altas nuevas de `includes/src/` |

## 3. Cambios al contrato (`SPEC.md`)

| Cambio | Sección | ADR previsto | Fase |
|---|---|---|---|
| `radplapag_migrating` pasa de transient a **opción** (sin autoload; valor: la hora en que caduca), tomada con un `INSERT IGNORE` (ADR 0038). El transient heredado se ignora y se borra al desinstalar | §3.1 | nuevo (migración) | 1 |
| Meta interna `_radplapag_migration_pending` en los posts que crea una migración en curso; se borra al terminar | §3.1 | el mismo | 1 |
| `radplapag_migration_skipped_cpt_conflict` puede valer `'dismissed'` (sigue siendo verdadero) | §3.1, §3.2 | el mismo | 1 |
| `radplapag_migration_success_notice` guarda el resumen (emisoras migradas y franjas descartadas); `'1'` se sigue leyendo como éxito. El de error cambia de caducidad si lo pide la espera de D4 | §3.1 | el mismo | 1 |
| Una franja que no valida se descarta (la posterior), el resto migra, el aviso la nombra y no hay reintento en bucle. Con 0 emisoras, el aviso lo dice | §3.2 | el mismo, enmienda el ADR 0010 | 1 |
| La migración corre en `init` (prioridad 100) en cualquier petición, no solo en `admin_init` con `manage_options`, y sin el kses del usuario cambiado. Callback nuevo enganchado (o el mismo en un segundo hook, según el ADR) | §3.2 paso 2, §3.4 | nuevo (K33) | 2 |
| La desinstalación borra todas las opciones y transients de §3.1 y los posts en cualquier estado, en cada sitio | §3.7 | nuevo (desinstalación) | 2 |
| La página limpia imprime `<meta name="robots" content="noindex, nofollow">` según `blog_public` (sin `wp_robots`) y `dir="rtl"` con `is_rtl()` | §3.3 | nuevo, precisa el ADR 0008 | 3 |
| La página limpia no intercepta feed, embed ni trackback | §3.3 | ninguno: precisión de «solo intercepta una página» | 3 |
| K21/K43: valores decodificados en las globales; K24/K25: la API se comporta como dice §3.4 | §3.3, §3.4 | ninguno (valores, no claves; triage) | 2, 3 |

`write-adr` asigna los números (el siguiente libre es el 0037). Un ADR puede agrupar los cambios de una fase. `.claude/rules/data-and-migrations.md` se actualiza con los nombres nuevos.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | **K33:** la migración corre en `init` con prioridad 100 (los CPT y la meta ya están registrados), en cualquier petición: front, REST, cron o admin. Corre como el primer administrador, con el usuario restaurado al terminar. La primera visita tras actualizar ya ve el player. El enganche en `admin_init` 20 se conserva (es contrato), pero `init` ya habrá migrado antes. En una red, cada sitio migra en su primera petición | usuario, 2026-10-22 |
| D2 | **K29:** descartar pone la bandera a `'dismissed'`. Ni la migración ni el conflicto la vuelven a `'1'`, y el aviso solo sale con `'1'`. `radplapag_maybe_clear_migration_conflict_flag()` la sigue borrando con 0 emisoras publicadas (con cualquier valor), y entonces la migración vuelve a correr. Con la bandera puesta, la pasada de D1 en el front sale sin contar emisoras (sin una consulta en cada visita). El aviso lleva `is-dismissible` | usuario, 2026-10-22 |
| D3 | **K30:** tras crear los programas, las franjas de cada emisora se añaden una a una, de lunes a domingo y en su orden dentro del día. Se descarta la que haría fallar la validación de `Schedule\Slot_Validator` (formato, horas, solape en el día o entre días). Gana la anterior: con el lunes 23:00–02:00 y el martes 01:00–03:00 se queda la del lunes, y con el domingo 23:00–02:00 y el lunes 01:00–03:00 se queda la del lunes. Es una función pura del núcleo (en `Migration\`, sobre `Slot_Validator`), con los nombres de los programas creados. El escritor sigue pasando lo que queda por `radplapag_sanitize_station_schedule()` como red. Las franjas de un programa desconocido siguen descartándose solo con el log | usuario, 2026-10-22 |
| D4 | **Bloqueo (4.3):** la opción `radplapag_migrating` guarda la hora en que caduca y se toma con un `INSERT IGNORE` que gana con 1 fila, atómico porque `option_name` es único (ADR 0038: `add_option()` hace `ON DUPLICATE KEY UPDATE` y pueden ganar dos peticiones). Un bloqueo caducado se toma con una actualización condicional (compara y cambia sobre el valor leído, con `$wpdb->prepare()`); no vale borrar y añadir. Si la escritura falla, el bloqueo se queda hasta una espera más larga, para que un fallo determinista no se repita en cada petición. Propuesta: 120 s mientras corre y 15 min tras un fallo; el ADR fija los valores y el aviso de error dura lo mismo. Al terminar bien, se borra | triage 0002 (5.5); diseño |
| D5 | **Reintento sin duplicados (4.3):** cada post que crea la migración lleva `_radplapag_migration_pending` (`meta_input` de `wp_insert_post()`). Al terminar bien, `delete_post_meta_by_key()`. Al tomar el bloqueo, si quedan posts con esa meta (una migración cortada), se borran antes de empezar. El *rollback* de hoy se queda para los fallos controlados | diseño |
| D6 | **K32:** el aviso de éxito pasa a ser un resumen en el transient (emisoras migradas y franjas descartadas con emisora, día, horas y programa). Con 0 emisoras, el texto lo dice y la opción se borra igual (ADR 0010). El adaptador traduce el resumen con `__()`. El `'1'` de una versión anterior se pinta como hoy | triage 0002; diseño |
| D7 | ~~**K79:** `Legacy_Plan` conserva `is_rerun`~~ **Retirada** (ADR 0039, usuario, 2026-10-22): los formatos heredados nunca tuvieron `is_rerun` (llega en la 3.4.0); la migración no lo lee | usuario, 2026-10-22 |
| D8 | **K31:** `wp_slash()` en los datos que el escritor pasa a `wp_insert_post()` y `update_post_meta()` | triage 0002 |
| D9 | **K21 (migración):** la escritura corre sin los filtros de kses del usuario cambiado (`kses_remove_filters()` y, al restaurar el usuario, lo que corresponda a quien estaba). Los datos ya llegan saneados por el plan (`sanitize_text_field`, etc.) | triage 0002 |
| D10 | **K21, K43:** `Player\Globals_Builder` decodifica las entidades (`html_entity_decode( …, ENT_QUOTES \| ENT_HTML5, 'UTF-8' )`, PHP puro) de `siteTitle` y de `name`, `description` y `extendedDescription`. Lo guardado y la API de §3.4 no cambian. El `<title>` y las `meta` usan el valor decodificado y siguen escapando con `esc_html()`/`esc_attr()` | triage 0002 |
| D11 | **C11, K7:** `uninstall.php` borra, en cada sitio, las opciones de §3.1 (también `radplapag_settings` y `radplapag_migrating`), los transients globales (también el heredado `radplapag_migrating`) y los de errores de cada emisora (por su ID, antes de borrar el post), y busca los posts con todos los estados registrados (`trash`, `auto-draft` e `inherit` incluidos). Sigue sin cargar el plugin: no usa el autoloader ni `includes/src/` | triage 0002 |
| D12 | **K23 + 5.6:** `<meta name="robots" content="noindex, nofollow">` impreso directamente si `'0' === (string) get_option( 'blog_public' )`, sin `wp_robots()` ni su filtro (ADR 0008: no entran los plugins de SEO). `dir="rtl"` en `<html>` si `is_rtl()` | triage 0002 |
| D13 | **K24:** `radplapag_get_station_for_current_page()` devuelve `false` si `! is_page()`. `Data\Stations::for_page()` no casa nunca la página 0 | triage 0002 |
| D14 | **K25:** `radplapag_map_cpt_meta_cap()` resuelve el post con `get_post( $args[0] ?? 0 )`, que acepta un objeto o un ID; la firma no cambia | triage 0002 |
| D15 | **K26:** `radplapag_output_clean_page()` sale sin hacer nada con `is_feed()`, `is_embed()` o `is_trackback()` | triage 0002 |

### 4.2 Dónde va cada corrección

| Fila | Núcleo | Adaptador o envoltorio |
|---|---|---|
| K29 | `Upgrade\Upgrade_Policy` | `includes/radplapag-upgrade.php` (descarte, aviso, pasada) |
| K30 (D3) | `Migration\` (clase o método nuevo, sobre `Schedule\Slot_Validator`) | `WP\Migration_Writer` |
| 4.3 (D4, D5) | `Upgrade\Upgrade_Policy` (caducidad, si hace falta) | `includes/radplapag-upgrade.php` y `WP\Migration_Writer`, o un adaptador nuevo `WP\Migration_Lock` si el plan lo prefiere |
| K31 | — | `WP\Migration_Writer` |
| K32 (D6) | `Migration\Legacy_Plan` / resumen | `WP\Migration_Writer`, `radplapag_migration_admin_notices()` |
| K33, K21 migración | `Upgrade\Upgrade_Policy` | `includes/radplapag-upgrade.php` (enganche en `init`, guarda y kses) |
| K21, K43 | `Player\Globals_Builder` | — |
| C11, K7 | — | `uninstall.php` |
| K23, 5.6, K26 | — | `radplapag_output_clean_page()` (`radio-player-page.php`) |
| K24 | `Data\Stations::for_page()` | `radplapag_get_station_for_current_page()` |
| K25 | — | `radplapag_map_cpt_meta_cap()` |

Cada clase nueva de `includes/src/` va en `tests/zip/expected-additions.txt` en el mismo commit. Los docblocks y comentarios que citan las filas («K30 in docs/known-issues.md», etc.) se actualizan al corregirlas.

### 4.3 Tests

- **Antes de corregir**, cada fase comprueba que sus filas tienen su `currently` en las capas que cita `known-issues.md`. Lo que falte se caracteriza primero, con su commit: K23 y K26 (hoy solo hay reproducción) en `clean-page.spec.ts`, y el bloqueo de 4.3 en `UpgradeFlowTest`.
- **Goldens que cambian a propósito:**
  - `corrupt-times`: con D3 se descarta la franja malformada y migran las dos emisoras (antes, *rollback* total).
  - Con D6, `transients.radplapag_migration_success_notice` en los 8 *goldens* que migran, más `corrupt-times` y el nuevo `v3.2-cross-day-overlap`, que migran desde K30 (10 en total; solo esa clave, con `dropped` en los dos de K30).

  Se regeneran con `RADPLAPAG_UPDATE_SNAPSHOTS=1` **en el commit de su fila** y el diff se revisa en el plan. Los demás *goldens* no cambian; si cambia otro, se para.
- **Tests de caracterización que cambian por diseño** (decisión del usuario, 2026-10-22, al planificar la fase 1). Pasan a regresión en el commit de su tarea, con la aserción nueva:
  - D2: `test_dismiss_with_valid_nonce_deletes_flag_and_redirects`, `test_conflict_notice_links_to_nonced_dismiss_url`.
  - D3: `test_skipped_slots_of_stations_after_a_failing_one_are_not_logged`.
  - D4: `test_migration_does_not_run_while_locked`, `test_migration_lock_expires_in_120_seconds`, `test_failed_migration_rolls_back_and_records_error`, `test_failed_migration_is_retried_on_next_request`, `test_migration_writes_programs_then_stations_then_options`. En `test_currently_cross_day_overlap_from_3_2_never_migrates` (K30) solo se caduca la espera entre las dos pasadas, sin cambiar las aserciones (decisión del usuario, 2026-10-22, en la 1.5); en la 1.7 pasa a regresión.
  - D6: `test_successful_migration_records_outcome_and_releases_lock`, `test_conflict_flag_is_cleared_and_migration_runs_without_published_stations`.
- **K24:** `ConfigTest::test_station_for_current_page_matches_station_without_page_when_nothing_is_queried` no tiene el prefijo `currently`, pero la fila K24 lo cita. Pasa a regresión («… returns false when nothing is queried») junto al `currently` del núcleo.
- **RTL sin paquete de idioma** (no se sale a internet): en integración, con `$GLOBALS['wp_locale']->text_direction = 'rtl'` y la salida de la página capturada. Si el `exit` lo impide (ADR 0001), en e2e con un *mu-plugin* de los tests, fuera del zip, que fija la dirección por una cabecera o una opción del entorno. Lo decide el plan de la fase 3.
- La migración se prueba en integración (`UpgradeFlowTest`, `MigrationGoldenTest` con dos pasadas). La concurrencia del bloqueo se prueba con el estado de la base de datos (bloqueo puesto, caducado, valor cambiado entre la lectura y la toma), no con procesos en paralelo.
- `uninstall.php` se prueba como hoy (`UninstallTest` y `UninstallMultisiteTest`), sembrando cada opción, transient y estado.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Un commit por fila (`fix(0008): … (N.M)`). No hay spike: no hay riesgo técnico sin resolver que no se pueda medir con los tests de integración.

### Fase 1 — Migración (prioridad alta; K31 y K32 van junto a K30)

- Orden:
  1. K29.
  2. El bloqueo atómico y el reintento sin duplicados (D4, D5), que K30 necesita para no reintentar en bucle.
  3. K30 con su aviso (D3, D6).
  4. K31 y K32 (K79 se retiró: ADR 0039).

  Un ADR de la migración con `SPEC.md` §3.1 y §3.2 y la rule de datos.
- ✅ **Criterios:** A1–A6.

### Fase 2 — Actualización, entidades y desinstalación (prioridad media)

- Orden:
  1. K33 con la variante de K21 en la migración (D1, D9), con su ADR (§3.2 y §3.4). Va después del bloqueo de la fase 1: en el front, las peticiones concurrentes son lo normal.
  2. K21 y K43 en las globales (D10).
  3. C11 y K7 (D11), con el inventario completo de §3.1 ya cerrado y su ADR (§3.7).
- ✅ **Criterios:** A7–A9.

### Fase 3 — Página limpia y API (prioridad baja) y cierre

- Orden:
  1. K23 y `dir` RTL (D12), con su ADR (§3.3).
  2. K26, K24 y K25.
- Cierre de la spec:
  - `SPEC.md` §3 y §6, y `known-issues.md` al día.
  - La hoja de ruta, sin las notas de esta spec.
  - En `status.md`, lo siguiente de la pista de WordPress: la 0009.
- ✅ **Criterios:** A10–A14.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Migrar en el front alarga la primera petición tras actualizar (crear decenas de posts) | Es una sola vez por sitio y hoy la paga el administrador. Se mide con el *fixture* `multi-station` en el plan; si pasa de unos segundos, se pregunta | Fase 2 |
| 2 | Cambiar de usuario en `init` del front afecta al resto de la petición (caché de capacidades, kses, `current_user`) | Restaurar el usuario y kses al terminar, con su test (A7); `template_redirect` ve al visitante | Fase 2 |
| 3 | La toma de un bloqueo caducado con SQL directo: PHPCS (`DirectDatabaseQuery`) y la caché de opciones | `$wpdb->prepare()`, `wp_cache_delete()` de la opción y `alloptions`, y la excepción en su línea con el motivo (ADR 0021). Si `wporg-reviewer` lo objeta, se pregunta | Fase 1 |
| 4 | `'dismissed'` deja la opción heredada para siempre en un sitio con conflicto | Es lo que decide el aviso («dismiss»). La desinstalación la borra (C11). No se borra al descartar: la migración es unidireccional, pero no destructiva sin ella (ADR 0010) | Fase 1 |
| 5 | La 0009 rehace `Slot_Validator` (modelo en minutos de la semana) y D3 depende de él | D3 solo usa su API pública (`validate()`); los vectores de A2 la protegen al rehacerlo | Fase 1 |
| 6 | Decodificar entidades cambia un título guardado a propósito con `&amp;` por un `unfiltered_html` | Es lo que ya muestran la pestaña y los bloques (`esc_html()` no codifica dos veces). Se acepta (triage) | Fase 2 |
| 7 | La prueba de RTL sin paquete de idioma | §4.3; si ninguna vía funciona, se para y se pregunta | Fase 3 |

## Apéndice — Referencias

- `docs/known-issues.md`: K29, K30, K31, K32, K33, K79, C11, K7, K21, K43, K23, K24, K25, K26 (y K4, que no se corrige).
- Auditoría de la 0002: [`audit/migration.md`](../0002-safety-net/audit/migration.md) (K29–K33, el bloqueo y la migración cortada, §5) y [`audit/core.md`](../0002-safety-net/audit/core.md) (K21, K23, K24, K26, RTL). Triage: [`phase-5.md`](../0002-safety-net/phase-5.md) (5.5 y 5.6).
- Spec 0005: la partición en `Legacy_Plan`, `Migration_Writer` y `Upgrade_Policy` (ADR 0028).
- ADR 0005 (formatos 2.0+), 0008 (página limpia sin `wp_head()`), 0010 (CPT y migración unidireccional).
