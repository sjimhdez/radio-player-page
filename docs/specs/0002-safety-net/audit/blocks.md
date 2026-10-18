# Auditoría · zona 4, bloques

Spec 0002, fase 4, tarea 4.5 · 2026-10-18 · código auditado: 3.4.2 (sin cambios).

**Alcance:** los tres bloques (`blocks/{now-playing,programs-list,schedule}/{block.json,render.php,src}`), sus helpers (`includes/radplapag-{now-playing,programs-list,schedule}-block.php`) y, de `radio-player-page.php`, el registro de los bloques y los datos del editor (`radplapag_register_*_block()`, `radplapag_enqueue_*_block_editor_assets()`). `radplapag_get_stations()` y `radplapag_get_program_data()` son de la zona 1 (`core.md`), pero el orden de las emisoras se mira aquí por su efecto en `stationIndex`.

**Resultado:** 9 hallazgos confirmados (K46–K54) y una variante de C10. Dos de gravedad media (K46, K53). El hueco del ADR 0023 de esta zona queda cerrado con e2e, sin violaciones nuevas de axe (la línea base no cambia). 21 candidatos descartados. No se ha tocado código publicado.

## 1. Herramientas estáticas

| Herramienta | Salida |
|---|---|
| PHPCS (`vendor/bin/phpcs -q` sobre la zona) | limpio. Supresiones, todas con motivo en la línea: `UnusedFunctionParameter` en los dos `render_callback` (firma fija) y el `phpcs:disable`/`enable` de `NewlineAfterOpenBrace` alrededor de la plantilla de `now-playing/render.php` (desviación ya anotada de la §4.6). |
| PHPStan nivel 8 (entradas de la baseline de la zona) | 17 entradas. 12 son `missingType.iterableValue` (ruido de tipos). `is_array()`/`is_string()` siempre ciertos (`programs-list/render.php`, `radplapag-schedule-block.php`) → ruido: revalidan lo que ya viene validado. `$day_num + 1` y la resta del `usort` con `int\|string\|false` (`array_search()`) → ruido: la clave del día siempre está en la lista. `radplapag-programs-list-block.php:133` (`$slots_by_program[ $key ] ?? array()`, «offset does not exist») → ruido: la clave es `(string) (int) $id`, que PHP guarda y busca como entero, y existe siempre que el programa tiene franjas. `Offset 0 … always exists` en `radplapag_parse_time_to_minutes()` → ruido. Ninguna es un bug. |
| `wp-scripts lint-js` de cada bloque (`npm --prefix blocks/<bloque> run lint:js`) | limpio en los tres. |
| `.claude/rules/security.md` | salida: todo lo variable se escapa al imprimirse (`esc_html`, `esc_attr`, `esc_url`); `get_block_wrapper_attributes()` sale escapado de core; `alt` con `esc_attr()` que `wp_get_attachment_image()` vuelve a escapar sin doble codificación. Entrada: core tipa los atributos con `block.json` (`prepare_attributes_for_render()`, también en `/wp/v2/block-renderer`); `stationIndex` se convierte a entero con control de rango y `dayOrder` va por lista blanca. Datos: solo emisoras y programas publicados; el editor solo recibe etiquetas. Hallazgos: K50 (enlace a una página no publicada). |
| `.claude/rules/wordpress-org.md` | prefijos completos (`radplapag/*`, handles generados por core, globales JS, constante); `index.asset.php` declara `wp-*` y `react-jsx-runtime` como externas y el build no empaqueta React ni Lodash; ninguna petición saliente (el único `https://` es el `$schema` incrustado); `textdomain` en los tres `block.json`, con `wp_set_script_translations()` implícito de core. Hallazgos: K54 (título del inserter sin traducir). |
| `.claude/rules/blocks.md` | atributos y markup son contrato: K46, K49 y K53 piden un ADR para corregirse. |

Plugin Check, `composer audit`, `npm audit` y licencias: en verde en la CI del PR #37; nada de la zona.

## 2. Revisores lanzados

Los cinco del plan, con contexto limpio y la lista de archivos de arriba:

- **`wp-security-reviewer`**: nada explotable; todo bajo o informativo. Propuso K48, K50, los programas protegidos con contraseña y lo que un colaborador lee por el `block-renderer` (descartes).
- **`wporg-reviewer`**: nada que rechazara la revisión. Propuso K54 (sin confirmar en su lectura; confirmado aquí, reproducción 1), la etiqueta «Radio Station» + índice concatenada, los dos puntos de «On Air»/«Coming up» fuera de la cadena, la global `$radplapag_schedule_day_map` sin uso, la `version` 1.0.0 de los `block.json` y el `license` de los `package.json`.
- **`backcompat-reviewer`**: sin sintaxis por encima de PHP 7.4 ni APIs posteriores a WP 6.6 (`render` de `block.json` es de 6.1, apiVersion 3 de 6.3, `react-jsx-runtime` de 6.6). Propuso K46, K47, K48, el texto del aviso del editor, discrepancias de redacción de `SPEC.md` (§3.4 y §3.5), la global sin uso, los defaults en tres sitios (coinciden), `dayOrder` sin `enum` y las consultas repetidas.
- **`a11y-reviewer`**: con el markup actual, axe no encuentra nada en los tres bloques (la línea base no tiene entradas `blocks page`), y lo confirma el escenario nuevo (abajo). Propuso K53, K49, el `alt` redundante, los dos enlaces seguidos al mismo destino, `target="_blank"` sin aviso, «—» como nombre vacío, `aria-current` en la franja en antena y el contraste del aviso del editor (`opacity: 0.6`).
- **Code review a esfuerzo alto** (subagente general, sin `--fix`): día de la semana, zona horaria, cruce de medianoche y orden de franjas, correctos salvo lo ya conocido (C16, K8, C4, C10). Propuso K48, K50, K49, la variante de C10 en «Coming up», K47, K46, K51, K52 y el texto del aviso del editor, y como menores la franja de ayer al final con `current_first`, el `<figure>` vacío con el logo borrado y que la lista de programas no marque «(Rerun)».

## 3. Contraste

**`SPEC.md` §3.5:**

- Bloques dinámicos, apiVersion 3, `supports` compartidos: se cumple.
- Atributos y defaults de la tabla: se cumplen; coinciden en `block.json`, en el render y en el editor de cada bloque.
- `stationIndex` es la posición en `radplapag_get_stations()`: se cumple, y de ahí sale K46 (la posición cambia sin que nadie toque el bloque) y K47 (el editor la disimula).
- «Los datos del editor son `{ stations: [ etiquetas ] }`»: el código da `{ stations: [ { label } ] }`, ya fijado en `BlockRenderTest::test_editor_data`. Es redacción de `SPEC.md` (se apunta para el cierre).
- «`now-playing` no imprime nada en el front si no hay programa en antena»: se cumple en el front; en cualquier respuesta REST imprime el aviso del editor (K48).
- Markup preservado y fijado con snapshots: se cumple; K49 y K53 son rarezas de ese markup.

**`SPEC.md` §3.4:** `radplapag_get_now_playing_for_station()` se cumple (ventana de 10 minutos, `null` con índice inválido). `radplapag_get_schedule_for_station()` y `radplapag_get_programs_list_for_station()` no están en la tabla, aunque son públicas (redacción, para el cierre).

**Filas de `known-issues.md` de la zona** (todas siguen; sus tests `currently` pasan en esta ejecución):

- **C10:** sigue, con una variante nueva en «Coming up» (anotada en su fila).
- **C16:** sigue en los tres bloques; una franja de 24 h que no empieza a medianoche (`08:00`–`08:00`) es el mismo caso (`end <= start`), sin fila aparte.
- **K6:** sigue en WP 6.6.

### Hueco del ADR 0023 de esta zona

Cerrado con un escenario nuevo en `tests/e2e/a11y.spec.ts`, `blocks page · always on air`. `tests/e2e/fixtures/seed-e2e.php` siembra la emisora «E2E Always On Air» con una franja `00:00`–`00:00` del programa A cada día (el servidor la acepta, C3) y una página con los tres bloques para ella (`blocks-always-on`). El test comprueba antes de pasar axe que `now-playing` tiene su `article` y que el horario y la lista de programas tienen una franja `is-live`, así que esas ramas se analizan siempre, sea cual sea la hora del servidor.

Resultado, en Chromium y WebKit: **ninguna violación**, así que la línea base no cambia y no hace falta la decisión del usuario. Lo que axe no ve se fija aparte: K53 (encabezados) y K49 («On Air»).

## 4. Hallazgos confirmados

| Fila | Qué | Cómo se confirma |
|---|---|---|
| K46 | `stationIndex` posicional: crear, renombrar o despublicar una emisora cambia la de los bloques guardados | integración `BlockAuditTest::test_currently_station_index_follows_the_title_order` |
| K47 | El editor recorta el índice fuera de rango solo para el selector y la vista previa | e2e `blocks.spec.ts` (`currently previews the last station for an out-of-range station index (K47)`), Chromium y WebKit |
| K48 | El aviso del editor de `now-playing` sale en cualquier respuesta REST | integración `BlockAuditTest::test_currently_rest_content_carries_the_editor_notice` (proceso aparte) |
| K49 | Sin página del reproductor, `now-playing` pierde «On Air» | integración `BlockAuditTest::test_currently_now_playing_without_player_page_drops_the_on_air_label` |
| K50 | El enlace a la página del reproductor no comprueba que siga publicada | integración `BlockAuditTest::test_currently_links_to_a_player_page_that_is_no_longer_published` |
| K51 | Los saltos de línea de la descripción extendida se pierden en los bloques | integración `BlockAuditTest::test_currently_extended_description_line_breaks_stay_in_one_paragraph` |
| K52 | Un programa de 24 h se anuncia a sí mismo en «Coming up» | integración `BlockAuditTest::test_currently_24_hour_slot_is_coming_up_while_on_air` |
| K53 | Ningún bloque imprime encabezados (`<header>` con estilo de encabezado) | integración `BlockAuditTest::test_currently_blocks_print_no_heading_elements` |
| K54 | Título y descripción del inserter sin traducir en `schedule` y `programs-list` | reproducción 1 |
| C10 (variante) | Un borrador dentro de la ventana de «Coming up» tapa al programa publicado siguiente | integración `BlockAuditTest::test_currently_draft_program_slot_hides_the_next_upcoming_program` |

**Mutación de comprobación**, temporal y revertida (`git checkout -- blocks includes`; `git status` limpio sobre el código), en dos tandas:

1. Integración: `orderby => 'ID'` en `radplapag_get_stations()`, «On Air:» en la rama sin enlace, `get_post_status() === 'publish'` antes del permalink en los dos helpers, `upcoming` solo con una entrada construida, `upcoming` nulo si es el mismo programa que `current`, `nl2br()` en la descripción extendida, `<h2>` en los días del horario y el aviso solo con `block-renderer` en `REQUEST_URI` → los ocho en rojo.
2. `safeIndex = stationIndex` en `blocks/schedule/src/index.js` y `npm --prefix blocks/schedule run build` → el e2e de K47 en rojo (la vista previa pide `stationIndex=999`); revertidos el fuente y el build.

### Reproducciones

1. **K54.** En el entorno de tests (`npm run env:start:latest`), sin escribir nada en el repo: un mu-plugin temporal en el contenedor (`wp-content/mu-plugins/zz-audit-i18n.php`) con filtros `gettext` y `gettext_with_context` que anteponen «XX » a las cadenas del dominio `radio-player-page` que empiezan por «RPP:». Con la sesión de `admin`, abrir `/wp-admin/post-new.php` y leer `wp.blocks.getBlockType( 'radplapag/<bloque>' ).title`: `now-playing` da «XX RPP: Now Playing»; `schedule` y `programs-list` dan «RPP: Weekly Schedule» y «RPP: Radio Shows List», sin el prefijo (igual las descripciones). Causa, en `wp-includes/js/dist/blocks.js`: `processBlockType()` construye el tipo con `...bootstrappedBlockType, ...blockSettings`, y los dos bloques pasan `...metadata` en `blockSettings`. Mu-plugin borrado al terminar.

## 5. Descartados

- Programas publicados con contraseña que se muestran en los bloques: la contraseña la pone un administrador y el CPT no es público; expectativa dudosa.
- Un colaborador lee por `/wp/v2/block-renderer` el horario de todas las emisoras publicadas: son los mismos datos que publican la página y los bloques; sin borradores ni `stream_url`.
- `alt` con `esc_attr()` que `wp_get_attachment_image()` vuelve a escapar: `esc_attr()` no codifica dos veces; sobra, sin efecto.
- El aviso del editor dice «or starting soon» y el render no muestra un «Coming up» sin programa en antena: es el contrato (§3.5); sospecha de texto para el triage. Con índice inválido dice lo mismo: inocuo.
- «Radio Station» + índice por concatenación y los dos puntos de «On Air»/«Coming up» y el « - » fuera de la cadena traducible: mejoras de i18n sin bug visible con las traducciones actuales, como en la zona 3; para la spec 0005.
- `alt` redundante con el título, dos enlaces seguidos al mismo destino en `now-playing`, `target="_blank"` sin aviso, «—» como nombre vacío y sin `aria-current` en la franja en antena: mejoras de a11y sin incumplimiento medido de AA (`target="_blank"` es G201 y 3.2.5 es AAA); tocan el markup (ADR).
- Contraste del aviso del editor (`opacity: 0.6`): solo en el editor, depende del tema, no medido.
- `$radplapag_schedule_day_map` sin uso: inocua y con prefijo; un tercero podría leerla.
- `"version": "1.0.0"` en los `block.json` y `package.json` sin `license`: informativo; core usa la versión de `index.asset.php` y los `package.json` no van al zip.
- `dayOrder` sin `enum`: el render y el editor normalizan a `current_first`.
- Defaults en tres sitios (`block.json`, render, editor): coinciden en los tres bloques.
- Consultas repetidas de `radplapag_get_config()` en el editor y en cada render: rendimiento, sin efecto visible.
- `SPEC.md` §3.5 (`[ etiquetas ]` frente a `[ { label } ]`) y §3.4 sin `radplapag_get_schedule_for_station()` ni `radplapag_get_programs_list_for_station()`: redacción de `SPEC.md`, para el cierre.
- `TypeError` si un tercero pasa `null` como `$day_order`: firma tipada de una función que nadie llama así.
- `now-playing` sin `save` en `registerBlockType()`: core usa `save: () => null` por defecto, y el e2e del editor pasa en WP 6.6.
- Con `current_first`, la franja de ayer que sigue en antena sale al final de la lista: la lista empieza por hoy, como dice el atributo.
- `<figure>` vacío si se borra el adjunto del logo: `wp_get_attachment_image()` devuelve `''`; cosmético y artificial.
- La lista de programas no marca «(Rerun)»: igual que el player.
- Un programa no publicado «en antena» que tape a otro: con franjas que no se solapan no puede pasar (el bucle sigue con el día anterior).
- `now-playing` desfasado con caché de página: es el diseño de un bloque renderizado en el servidor.
- Las entradas de PHPStan de la zona: ruido (§1).
