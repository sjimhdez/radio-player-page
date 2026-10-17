# Auditoría · zona 1, PHP del núcleo

Spec 0002, fase 4, tarea 4.2 · 2026-10-18 · código auditado: 3.4.2 (sin cambios).

**Alcance:** `radio-player-page.php` (página limpia, globales, capacidades, carga; el registro de bloques es de la zona 4), `includes/radplapag-stations.php`, `includes/data/`, el registro de los CPT, sus capacidades y su meta en `includes/radplapag-{station,program}-cpt.php` (además `radplapag_get_program_data()`; los meta boxes y el guardado son de la zona 3) y `uninstall.php`.

**Resultado:** 8 hallazgos confirmados (K21–K28), una variante nueva de C10 y 20 candidatos descartados. Nada crítico ni alto. No se ha tocado código publicado.

## 1. Herramientas estáticas

| Herramienta | Salida |
|---|---|
| PHPCS (`vendor/bin/phpcs -q` sobre la zona) | limpio. Seis supresiones en la zona, todas en su línea y con motivo: `file_get_contents` del manifiesto local (`radio-player-page.php:297`), `NonEnqueuedStylesheet`/`NonEnqueuedScript` de la página limpia (ADR 0008, `:449`, `:454`), `UnusedFunctionParameter` en los dos `user_has_cap` (firma fija de 4 argumentos) y `InputNotSanitized` del horario (`radplapag-station-cpt.php:792`, zona 3). Todas justificadas. |
| PHPStan nivel 8 sin baseline (configuración temporal en el scratchpad) | Entradas de la zona en la baseline, una a una (las de `no value type specified` y `has no return type` son ruido de tipos, 20 en la zona): `radio-player-page.php:297` `json_decode( string\|false )` → ruido: si el manifiesto no se puede leer, `json_decode( '' )` da `null` y salta el segundo `wp_die()`. `radio-player-page.php:334` `esc_url( get_permalink() )` con `false` → inalcanzable: la página ya se ha comprobado publicada. `uninstall.php:82` `switch_to_blog( string )` → ruido: core no castea, pero `$wpdb->set_blog_id()` y `get_current_blog_id()` (`absint`) funcionan con la cadena; lo único que falla es la comparación estricta con el sitio actual, que hace un cambio completo innecesario; `UninstallMultisiteTest` pasa. Las entradas de `radplapag-station-cpt.php` (`isset`/`is_array`/`is_string` redundantes, `esc_attr( int )`) están en el saneado y los meta boxes: zona 3. |
| `.claude/rules/security.md` | entrada: la zona no lee `$_GET`/`$_POST`. Salida: todo el `<head>` escapado según el contexto (`lang` con `esc_html()` en un atributo: mismo resultado que `esc_attr()`); las tres globales con `wp_json_encode()` y las cuatro banderas `JSON_HEX_*`. Listas blancas de tema y visualizador al leer (no al guardar por `register_post_meta`: ver descartes). SQL: ninguna consulta directa. |
| `.claude/rules/wordpress-org.md` | prefijos completos; textos traducibles con su `translators`; sin peticiones a terceros desde la página limpia (ni en `player/dist`: sin `fonts.googleapis`, `gstatic`, `cdn.`, `unpkg`, `jsdelivr`, `gtag`); cabeceras de `radio-player-page.php` y `readme.txt` coherentes; sin APIs posteriores a WP 6.6 ni sintaxis posterior a PHP 7.4. Hallazgos: K23, K28. |

Plugin Check, `composer audit`, `npm audit` y licencias ya corren en la CI (spec 0001) y están en verde en el PR #37: nada de la zona.

## 2. Revisores lanzados

Los cuatro, con contexto limpio y la lista de archivos de arriba:

- **`wp-security-reviewer`**: nada crítico ni alto. Propuso que la REST expone la meta a anónimos (medido: no, ver K22), tema y visualizador sin lista blanca al guardar, el horario sin `sanitize_callback`, la firma tipada de `radplapag_map_cpt_meta_cap()` y el cast del objeto (K25), y `lang` con `esc_html()`.
- **`wporg-reviewer`**: nada que impida la revisión del directorio. Propuso K22 (como fuga de meta, que no se reproduce), K23, `dir` RTL, K28 y el `wp_cache_flush()` de la desinstalación.
- **`backcompat-reviewer`**: sin cambios de contrato ni nada que rompa PHP 7.4 / WP 6.6; las globales, el `<head>`, `wp_die`, la meta, `radplapag_get_stations()` y la desinstalación (salvo C11 y K7) cumplen `SPEC.md`. Discrepancias: K24 y que §3.3 no cita la condición «con `stream_url`» (omisión de `SPEC.md`, ver descartes).
- **Code review a esfuerzo alto** (subagente general, sin `--fix`): K21, la variante de C10 en el player, K26, el `exit` frente a otros plugins, K27, la regla de una página por emisora por REST, K22, K25, K24, el desempate del orden y `css[0]`.

## 3. Contraste

**`SPEC.md`:**

- §3.1 (CPT, capacidades, meta, listas blancas): se cumple. Las capacidades propias solo se conceden con `manage_options`; `map_meta_cap` resuelve las cuatro *meta caps* con `manage_options` (salvo con un objeto, K25).
- §3.3 (página limpia): se cumplen las condiciones de interceptación, el `<head>`, los `wp_die()`, los nombres de los assets y la forma de las tres globales (`RADPLAPAG_PROGRAMS` en orden de primera aparición porque el saneador y la migración guardan lunes → domingo). Además intercepta `feed/` y `embed/` (K26) y no la página de entradas (K27); §3.3 no cita que la emisora necesita `stream_url` (fijado en `ConfigTest::test_station_for_current_page_ignores_station_without_url`).
- §3.4 (API y callbacks de la zona): hooks, prioridades y número de argumentos coinciden. `radplapag_get_station_for_current_page()` no se limita a páginas (K24).
- §3.7 (desinstalación): se cumple, con C11 y K7.

**Filas de `known-issues.md` de la zona:**

- **C9:** sigue (`timezoneOffset` por petición, `radio-player-page.php:356-358`). Sin variantes: el offset fraccionario y negativo sale bien de `wp_timezone()`.
- **C10:** sigue, con una **variante nueva** en la página limpia (reproducción 5): la franja de un programa en borrador, en la papelera o borrado se queda en `RADPLAPAG_SCHEDULE` y el player muestra «On Air:» sin nombre. Fila C10 actualizada.
- **C11:** sigue. Sin variantes: el plugin no escribe meta fuera de sus CPT, ni user meta, ni `site_option`, ni roles.
- **K7:** sigue. Sin variantes.
- **K17:** sigue. Variante buscada (otras salidas `[]` en vez de `{}`): `RADPLAPAG_PROGRAMS` es una lista por contrato; `RADPLAPAG_CONFIG` siempre tiene claves. Ninguna.

## 4. Hallazgos confirmados

| Fila | Qué | Cómo se confirma |
|---|---|---|
| K21 | Títulos guardados por kses con `&amp;`: el player muestra la entidad | integración `ConfigTest::test_currently_titles_saved_through_kses_keep_their_entities` + reproducción 1 |
| K22 | La REST lista a anónimos las emisoras y los programas publicados (sin meta) | integración `CptTest::test_currently_rest_lists_published_posts_to_anonymous_visitors` |
| K23 | La página limpia ignora `blog_public = 0` (sin `robots`) | reproducción 2 |
| K24 | `radplapag_get_station_for_current_page()` acierta con el ID de un término | integración `ConfigTest::test_currently_station_for_current_page_matches_a_term_with_the_page_id` |
| K25 | `radplapag_map_cpt_meta_cap()` con un `WP_Post`: aviso de PHP y sin mapeo | integración `CptTest::test_currently_map_meta_cap_casts_a_post_object_with_a_warning` |
| K26 | `feed/` y `embed/` de la página sirven el player | reproducción 3 |
| K27 | Una página asignada que es la página de entradas nunca sirve el player | reproducción 4 |
| K28 | `readme.txt` dice «RPP → Stations»; el submenú es «Radio Stations» | reproducción 6 |
| C10 (variante) | Franja de un programa no publicado: «On Air:» vacío en el player | reproducción 5 |

**Mutación de comprobación** de los cuatro tests nuevos, temporal y revertida (`git checkout` de los tres archivos; `git diff` limpio sobre el código): `is_page() ? get_queried_object_id() : -1` en `radplapag_get_station_for_current_page()`, `$args[0] instanceof WP_Post ? $args[0]->ID : …` en `radplapag_map_cpt_meta_cap()`, `html_entity_decode()` del título en `Radplapag_Station_Config::to_array()` y `show_in_rest => false` en el CPT de emisora → los cuatro en rojo (3 fallos y 1 error); revertida, verdes.

### Reproducciones

En el entorno de tests (`npm run env:start:latest`, <http://localhost:8890>, sitio `wp_` sembrado por e2e). Cada una deja el entorno como estaba.

1. **K21 en el player.**
   1. Con `wp eval-file`, crear una página publicada `audit-entities` y una emisora publicada asignada a ella, con un stream local.
   2. Como un administrador sin `unfiltered_html` (`map_meta_cap` → `do_not_allow` para `unfiltered_html`, y `wp_set_current_user()`), `wp_update_post()` con el título `Rock & Roll`. Se guarda `Rock &amp; Roll`.
   3. `curl http://localhost:8890/audit-entities/`: `<title>Rock &amp; Roll</title>` (se ve «Rock & Roll») y `"siteTitle":"Rock &amp; Roll"`.
   4. Abrir la página en Chromium (Playwright): el `h1` dice `Rock &amp; Roll`, la pestaña `Rock & Roll`.
   5. Borrar la emisora y la página (`wp post delete … --force`).
2. **K23.**
   1. `wp option update blog_public 0`.
   2. `curl http://localhost:8890/` → `<meta name='robots' content='noindex, nofollow' />`.
   3. `curl http://localhost:8890/e2e-minimal/` → ningún `<meta name="robots">`.
   4. `wp option update blog_public 1`.
3. **K26.**
   1. `curl -w '%{http_code} %{content_type}' http://localhost:8890/e2e-minimal/feed/` → `200 application/rss+xml; charset=UTF-8` y el cuerpo es el HTML del player (`RADPLAPAG_CONFIG`).
   2. Lo mismo con `embed/` → `200 text/html` con el player completo, no la plantilla de embed.
4. **K27.**
   1. `wp option update show_on_front page` y `wp option update page_for_posts <ID de page-minimal>` (antes: `posts` y `0`).
   2. `curl -L http://localhost:8890/e2e-minimal/` → sin `RADPLAPAG_CONFIG`: sale el blog del tema.
   3. `wp option update page_for_posts 0` y `wp option update show_on_front posts` → vuelve el player.
5. **Variante de C10.**
   1. Crear un programa en borrador, una página `audit-draft` y una emisora publicada asignada a ella, con una franja `00:00–00:00` (24 h) del programa cada día.
   2. `curl http://localhost:8890/audit-draft/` → `RADPLAPAG_PROGRAMS = [];` y `RADPLAPAG_SCHEDULE` con la franja (`program_id` del borrador).
   3. En Chromium, el texto de la página es «Audit Draft Station · On Air: · 100% · Broadcast Timezone …»: la etiqueta sin nombre.
   4. Borrar los tres posts. Un programa en la papelera o borrado sigue el mismo camino (`radplapag_get_program_data( $id, true )` da `null`).
6. **K28.** En el admin (`admin` / `password`), el menú «RPP» tiene los submenús «Radio Stations» y «Radio Shows» (`all_items` de los CPT, `CptTest::test_post_type_labels` para los nombres); `readme.txt` (paso 3 de Installation y la primera pregunta del FAQ) dice «RPP → Stations».

## 5. Descartados

- La REST expone la meta (`stream_url`, `player_page`, IDs) a anónimos: **no se reproduce**; los CPT solo soportan `title`, así que la respuesta no lleva `meta` (medido con `curl` y fijado en K22).
- La regla de una página por emisora se salta por REST: no; la meta no se puede escribir por REST por lo mismo (sin `custom-fields`).
- Tema y visualizador se guardan sin lista blanca por `register_post_meta`, y el horario sin `sanitize_callback`: solo alcanzable con código que ya escribe meta (no por REST ni por el admin, que sí filtra); al leer se aplican las listas blancas. Ya fijado en `CptTest` (`test_station_key_sanitizers`, `test_station_schedule_is_not_sanitized`).
- Claves de día sin lista blanca, `program_id` raros y orden de `RADPLAPAG_PROGRAMS` dependiente del JSON guardado: solo con meta escrita por terceros; el saneador y la migración guardan lunes → domingo.
- `TypeError` por la firma tipada de `radplapag_map_cpt_meta_cap()` si otro filtro devuelve algo que no es un array: core siempre pasa arrays; especulativo.
- `lang` con `esc_html()` en vez de `esc_attr()`: misma salida.
- `<html>` sin `dir` en sitios RTL: no se puede reproducir sin un paquete de idioma RTL (los tests no salen a internet). Sospecha para el triage.
- `radplapag_get_program_data()` devuelve borradores por defecto (`$require_published = false`): sin fallo actual; todos los llamadores públicos pasan `true`.
- Medios de un post privado o en la papelera salen con su URL: los archivos de uploads son públicos igualmente.
- Desinstalación en multisite: el sitio principal se procesa dos veces (idempotente) y `wp_cache_flush()` se llama antes del bucle y vacía toda la caché; contrato de §3.7, sin efecto en los datos.
- `switch_to_blog( string )` (PHPStan): funciona, ver §1.
- `json_decode()` de un manifiesto ilegible y `esc_url( false )` (PHPStan): ver §1.
- `user_has_cap` no concede `edit_published_*` ni `edit_private_*`: sin efecto mientras `map_meta_cap` resuelva con `manage_options`.
- El `exit` en `template_redirect` (prioridad 10) se salta los callbacks de otros plugins enganchados después (modo mantenimiento, acceso restringido): consecuencia del diseño del ADR 0008 y depende del plugin de terceros; no se reproduce sin un plugin de prueba. Sospecha para el triage.
- Desempate del orden de `radplapag_get_stations()` (mismo `menu_order` y título): MySQL no lo garantiza, pero no se ha visto inestable; confianza baja.
- Solo se carga `css[0]` de la entrada del manifiesto: latente, el build actual tiene un único CSS.
- Una emisora titulada «0» toma el nombre del sitio (`! empty()`): caso artificial.
- §3.3 no cita la condición «con `stream_url`»: omisión de redacción de `SPEC.md`, no del código; ya fijada con un test. Se apunta para el cierre de la spec.
- La cabecera `Tags:` del archivo principal, que WordPress no lee: inocua.
- El índice de emisora sin `sprintf` ni `translators` en los datos del editor de los bloques (`radio-player-page.php:114`, `:150`, `:184`): fuera de la zona, pasa a la auditoría de bloques (4.5).
