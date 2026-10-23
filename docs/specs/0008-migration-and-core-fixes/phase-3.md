# Spec 0008 · Fase 3 — Página limpia y API
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0001, 0008, 0021, 0028, 0037, 0038, 0041; nuevo 0043 (robots y `dir` en la página limpia)

## Contexto
Lo medido al planificar:
- `radplapag_output_clean_page()` (`radio-player-page.php:233`) sale si `! is_page()`, pero no mira `is_feed()`, `is_embed()` ni `is_trackback()` (K26). Imprime `<html lang="…">` sin `dir` y ningún `<meta name="robots">` (K23).
- **RTL sin paquete de idioma (§4.3, riesgo 7):** la integración no puede capturar la página por el `exit` (ADR 0001). **Decisión:** e2e con un *mu-plugin* de los tests, `tests/e2e/mu-plugins/radplapag-e2e-text-direction.php`, montado en `.wp-env.tests.json` (`"wp-content/mu-plugins": "./tests/e2e/mu-plugins"`). En `init` fija `$GLOBALS['wp_locale']->text_direction = 'rtl'` solo si la petición trae la cabecera `X-Radplapag-Text-Direction: rtl`. Sin estado global, así que no afecta a otros tests (tampoco a PHPUnit, que no manda esa cabecera). Queda fuera del zip (`tests/`). Hace falta reiniciar el entorno de tests para montarlo.
- `blog_public` se cambia con `wpCli( 'option', 'update', 'blog_public', '0' )` dentro de un `try/finally`. Playwright corre con `workers: 1`.
- **K24:** `radplapag_get_station_for_current_page()` (`radio-player-page.php:207`) llama a `Data\Stations::for_page( …, get_queried_object_id() )` sin mirar `is_page()`. `for_page()` casa la página 0 con una emisora sin página. Ya existen `ConfigTest::test_currently_station_for_current_page_matches_a_term_with_the_page_id`, `ConfigTest::test_station_for_current_page_matches_station_without_page_when_nothing_is_queried` y `StationsTest::test_currently_for_page_zero_matches_a_station_without_page`.
- **K25:** `radplapag_map_cpt_meta_cap()` (`radio-player-page.php:63`) hace `(int) ( $args[0] ?? 0 )`. Ya existe `CptTest::test_currently_map_meta_cap_casts_a_post_object_with_a_warning`.
- **K86 (decisión del usuario, 2026-10-23: «leer antes del INSERT»):** `WP\Migration_Lock::acquire()` (`includes/src/wp/class-migration-lock.php:55`) siempre hace `INSERT IGNORE` y, si falla, `get_option()`. Cambio: primero `flush_cache()` y `get_option()`. Si el bloqueo está vigente (`Upgrade_Policy::is_lock_held()`), sale sin escribir. Si falta, `INSERT IGNORE`. Si caducó, el `UPDATE` condicional de siempre. Con el bloqueo vigente, el front paga un `SELECT` (ninguno con una caché de objetos persistente). El reintento de un visitante cada 15 min se queda: no se cambia el contrato de la 0041. Se documenta en las consecuencias del ADR 0041 y en la rule de datos, sin ADR nuevo.
- **K87:** en `radplapag_run_legacy_migration_if_needed()` (`includes/radplapag-upgrade.php:145-154`), entre `wp_set_current_user( $author_id )` y `kses_init()` no hay `try/finally`. `finally` existe en PHP 7.4. La excepción se sigue propagando, y el bloqueo se queda hasta que caduque (120 s), como una petición cortada.
- **Huecos de la revisión de la fase 2:**
  - `UpgradeFlowTest::test_migration_runs_logged_out` no comprueba kses tras la pasada con el usuario 0. El usuario 0 no tiene `unfiltered_html`, así que `title_save_pre` debe volver a tener `wp_filter_kses`.
  - Los tests de desinstalación no siembran ningún post en `inherit`.
- Ningún *golden* ni *snapshot* de la página limpia cambia: el entorno tiene `blog_public = 1` y LTR, y en ese caso la salida no cambia.

## Objetivo
Corregir K23 (con `dir` en RTL), K26, K24, K25, K86 y K87, cada uno con su test de regresión, y cerrar los dos huecos de test de la fase 2. `SPEC.md` §3.3 y §3.4 y el ADR 0043 quedan al día. Con esto se cierra la spec 0008.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A10 K23 + 5.6 | `clean-page.spec.ts`: con `blog_public = 0`, `<meta name="robots" content="noindex, nofollow">`; con `1`, ninguno; un filtro `wp_robots` de un *mu-plugin* no entra. Con la cabecera RTL, `<html … dir="rtl">`; sin ella, sin `dir`. Antes, sus `currently` (3.1) |
| A11 K24 | `ConfigTest`: en el archivo de una categoría con el `term_id` de una página asignada, `false`; con nada consultado (ID 0), `false`. `StationsTest`: `for_page( …, 0 )` no casa nunca |
| A12 K25 | `CptTest`: `current_user_can( 'edit_post', $post )` con un `WP_Post` de emisora, sin aviso, resuelve `manage_options`, igual que con el ID |
| A13 K26 | `clean-page.spec.ts`: `feed/`, `embed/` y `trackback/` de la página no llevan `RADPLAPAG_CONFIG`. La página sigue sirviéndose. Antes, su `currently` (3.1) |
| K86 | `UpgradeFlowTest`: con el bloqueo vigente, `acquire()` no lanza ningún `INSERT` (se cuentan con el filtro `query`) y la pasada del front sale. Los tests del bloqueo (caducado, toma doble, retención de 900 s) siguen en verde |
| K87 | `UpgradeFlowTest`: si un `save_post` lanza una excepción durante la migración, la excepción sale y el usuario y los filtros de kses vuelven a ser los de antes |
| Huecos 2 | `UpgradeFlowTest`: tras la pasada con el usuario 0, `wp_filter_kses` sigue en `title_save_pre`. `UninstallTest` y `UninstallMultisiteTest`: un post de emisora en `inherit` se borra |
| A14 | Lo verifica `close-phase`: `npm run check`, integración (también multisite) y e2e en las dos puntas, cobertura ≥ 90 %, baseline de PHPStan sin subir y `check:zip` |

## Tareas

### 3.1 Caracterizar K23, `dir` en RTL y K26 por HTTP (≤ 1 h)
- Qué:
  - El *mu-plugin* de la dirección del texto y su montaje en `.wp-env.tests.json`.
  - En `clean-page.spec.ts`, los tests `currently`:
    - «currently prints no robots meta with blog_public = 0 (K23)»;
    - «currently prints no dir on a right-to-left site»;
    - «currently serves the player on the page's feed/, embed/ and trackback/ (K26)», que fija lo de hoy.
  - Las filas K23 y K26 de `known-issues.md` apuntan a los tests.
- Archivos: `tests/e2e/mu-plugins/radplapag-e2e-text-direction.php`, `.wp-env.tests.json`, `tests/e2e/clean-page.spec.ts`, `docs/known-issues.md`.
- Test: caracterización: `tests/e2e/clean-page.spec.ts`. Cada uno se valida con una mutación temporal (`dir` y `robots` impresos a mano; `is_feed()` añadido).
- Verificación: `npm run env:start:min && npm run test:e2e -- clean-page.spec.ts`
- [ ] hecha · commit: —

### 3.2 ADR 0043: robots y `dir` en la página limpia (≤ 1 h)
- Qué:
  - `write-adr`: con `blog_public = 0`, `<meta name="robots" content="noindex, nofollow">` impreso directamente, sin `wp_robots()` ni su filtro (precisa el ADR 0008); `dir="rtl"` con `is_rtl()`.
  - En el mismo commit: `SPEC.md` §3.3, con esto y con «no intercepta feed, embed ni trackback» (K26, precisión sin ADR), e índice de ADRs.
- Archivos: `docs/adr/0043-clean-page-robots-and-direction.md`, `docs/adr/README.md`, `SPEC.md`.
- Test: — (documentación).
- Verificación: `npm run check`
- [ ] hecha · commit: —

### 3.3 K23 y `dir` en RTL (D12) (≤ 1 h)
- Qué:
  - `fix-bug`: imprimir `robots` si `'0' === (string) get_option( 'blog_public' )` y ` dir="rtl"` si `is_rtl()`.
  - Los dos `currently` de la 3.1 pasan a regresión: con `blog_public` a 0 y a 1, con un `wp_robots` de prueba que no entra y en RTL y LTR.
  - K23 pasa a «corregido (spec 0008)».
- Archivos: `radio-player-page.php`, `tests/e2e/clean-page.spec.ts`, `tests/e2e/mu-plugins/…` (si hace falta un filtro `wp_robots` de prueba tras otra cabecera), `docs/known-issues.md`.
- Test: primero (regresión en rojo): `tests/e2e/clean-page.spec.ts`.
- Verificación: `npm run test:e2e -- clean-page.spec.ts`
- [ ] hecha · commit: —

### 3.4 K26: no interceptar feed, embed ni trackback (D15) (≤ 1 h)
- Qué:
  - `fix-bug`: salir al principio de `radplapag_output_clean_page()` con `is_feed() || is_embed() || is_trackback()`.
  - El `currently` de la 3.1 pasa a regresión: sin `RADPLAPAG_CONFIG` en los tres, y la página sigue sirviéndose.
  - K26 pasa a «corregido».
- Archivos: `radio-player-page.php`, `tests/e2e/clean-page.spec.ts`, `docs/known-issues.md`.
- Test: primero (regresión en rojo): `tests/e2e/clean-page.spec.ts`.
- Verificación: `npm run test:e2e -- clean-page.spec.ts`
- [ ] hecha · commit: —

### 3.5 K24: la emisora de la página actual solo en una página (D13) (≤ 1 h)
- Qué:
  - `fix-bug`: `Stations::for_page()` devuelve `false` con `$page_id <= 0`, y `radplapag_get_station_for_current_page()` devuelve `false` si `! is_page()`.
  - Pasan a regresión:
    - `StationsTest::test_currently_for_page_zero_matches_a_station_without_page` → `…_for_page_zero_matches_nothing`;
    - `ConfigTest::test_currently_station_for_current_page_matches_a_term_with_the_page_id` → `…_is_false_on_a_term_with_the_page_id`;
    - `ConfigTest::test_station_for_current_page_matches_station_without_page_when_nothing_is_queried` → `…_returns_false_when_nothing_is_queried` (§4.3).
  - Se actualizan el docblock de `for_page()` (cita K24) y K24 en `known-issues.md`.
- Archivos: `includes/src/data/class-stations.php`, `radio-player-page.php`, `tests/php/unit/Data/StationsTest.php`, `tests/php/integration/Data/ConfigTest.php`, `docs/known-issues.md`.
- Test: primero (regresión en rojo), unit e integración.
- Verificación: `npm run test:php:unit -- --filter StationsTest && npm run test:php:integration -- --filter 'ConfigTest|PublicApiTest'`
- [ ] hecha · commit: —

### 3.6 K25: `map_meta_cap` con un `WP_Post` (D14) (≤ 1 h)
- Qué:
  - `fix-bug`: `$post = get_post( $args[0] ?? 0 )` y, sin post, `return $caps`. La firma no cambia.
  - `CptTest::test_currently_map_meta_cap_casts_a_post_object_with_a_warning` → `…_accepts_a_post_object`: sin aviso y `manage_options`, igual que con el ID.
  - K25 pasa a «corregido».
- Archivos: `radio-player-page.php`, `tests/php/integration/Cpt/CptTest.php`, `docs/known-issues.md`.
- Test: primero (regresión en rojo): `CptTest`.
- Verificación: `npm run test:php:integration -- --filter CptTest`
- [ ] hecha · commit: —

### 3.7 K86: leer el bloqueo antes de intentar tomarlo (≤ 1 h)
- Qué:
  - `fix-bug`: `Migration_Lock::acquire()` empieza con `flush_cache()` y `get_option()`. Si el bloqueo sigue vigente, sale sin escribir; si falta, `INSERT IGNORE`; si caducó, el `UPDATE` condicional (sin cambios).
  - Test nuevo en `UpgradeFlowTest`: con el bloqueo retenido (900 s tras un fallo), una pasada del front no lanza ningún `INSERT` (filtro `query`).
  - Se actualizan el docblock de la clase y del método, las consecuencias del ADR 0041 (la excepción K86), la línea de K86 en `.claude/rules/data-and-migrations.md` y K86 en `known-issues.md`.
- Archivos: `includes/src/wp/class-migration-lock.php`, `tests/php/integration/Migration/UpgradeFlowTest.php`, `docs/adr/0041-…md`, `.claude/rules/data-and-migrations.md`, `docs/known-issues.md`.
- Test: primero (en rojo): `UpgradeFlowTest`.
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|MigrationGoldenTest'`
- [ ] hecha · commit: —

### 3.8 K87: restaurar el usuario y kses también si la migración lanza (≤ 1 h)
- Qué:
  - `fix-bug`: `try { … run() } finally { wp_set_current_user( $prev_user ); kses_init(); }`.
  - Test nuevo: un `save_post_radplapag_program` que lanza una `RuntimeException`. Comprueba que la excepción sale y que el usuario y `has_filter( 'title_save_pre', 'wp_filter_kses' )` son los de antes, con un visitante (usuario 0).
  - Se actualiza K87 en `known-issues.md`.
- Archivos: `includes/radplapag-upgrade.php`, `tests/php/integration/Migration/UpgradeFlowTest.php`, `docs/known-issues.md`.
- Test: primero (en rojo): `UpgradeFlowTest`.
- Verificación: `npm run test:php:integration -- --filter UpgradeFlowTest`
- [ ] hecha · commit: —

### 3.9 Huecos de test de la fase 2: kses con el usuario 0 y un post en `inherit` (≤ 1 h)
- Qué:
  - En `test_migration_runs_logged_out`, comprobar que `wp_filter_kses` sigue en `title_save_pre` después de la pasada.
  - En los tests de K7 de `UninstallTest` y `UninstallMultisiteTest`, sembrar una emisora en `inherit` y comprobar que se borra.
  - Son tests nuevos sobre lo ya corregido; si alguno sale en rojo, se para y se pregunta. Commit `test(0008): … (3.9)`.
- Archivos: `tests/php/integration/Migration/UpgradeFlowTest.php`, `tests/php/integration/Uninstall/UninstallTest.php`, `tests/php/integration/Uninstall/UninstallMultisiteTest.php`.
- Test: nuevo (debe pasar ya).
- Verificación: `npm run test:php:integration -- --filter 'UpgradeFlowTest|Uninstall' && npm run test:php:integration:ms -- --filter Uninstall`
- [ ] hecha · commit: —

Cierre (`close-phase`, última fase de la spec):
- `SPEC.md` §6 (historial), `known-issues.md`, la hoja de ruta sin las notas de la 0008 y `status.md` → la 0009.
- Revisores sobre el diff completo de la spec: `spec-conformance-reviewer`, `backcompat-reviewer`, `wp-security-reviewer` y `wporg-reviewer`. La lista se confirma con el usuario antes de lanzarlos.

## Decisiones abiertas → ADR
- ADR 0043 (3.2): robots y `dir` en la página limpia.
- K86 sin ADR nuevo: corrige la excepción que el ADR 0041 ya anunciaba para esta fase; se actualizan sus consecuencias.
- Si el *mu-plugin* no se carga en el entorno de wp-env (montaje en `wp-content/mu-plugins`), se para y se pregunta (riesgo 7 de la spec).

## Verificación de la fase
`npm run check`; `npm run test:php:integration` y `npm run test:php:integration:ms` con `env:start:min` y `env:start:latest`; `caffeinate -dims npm run test:e2e` en las dos puntas; `npm run check:zip`.
