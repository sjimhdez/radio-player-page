# Spec 0013 · Fase 2 — Markup y encabezados
Estado: en curso · Inicio: 2026-10-24 · ADRs: 0017, 0020, 0021, 0023, 0028, 0045, 0049

## Contexto

- Fase 1 cerrada sin pendientes: K46, K47, K48 y K54 corregidas. ADR 0049 y `SPEC.md` §3.5 y §6 ya describen todo el contrato de la fase 2; §3.5 lleva una nota en cursiva («…hasta su cierre el código aún no los cumple») que se quita al final.
- **K6:** los tres `render` pasan `wp-block-radplapag-<bloque>` a `get_block_wrapper_attributes()` (`blocks/schedule/render.php:32`, `programs-list/render.php:32`, `now-playing/render.php:44,57`). `BlockRenderTest::render()` normaliza las clases repetidas con `unique_wrapper_classes()`, así que los snapshots ya tienen la clase una vez: **quitar la normalización no debería cambiar ningún snapshot**. El test `currently` solo se ve en rojo en WP 6.6 (`env:start:min`).
- **K53:** los `<header>` están en `schedule/render.php:74` (`wp-block-heading`, día), `programs-list/render.php:61` (`wp-block-title`, programa) y `now-playing/render.php:59,104` (`wp-block-title`, «On Air» y «Coming up»). `now-playing` es plantilla PHP inline (ojo con los espacios: el snapshot los fija). `blocks.spec.ts:64` localiza el programa con `locator( 'header', … )` → pasa a `.wp-block-title` (consecuencia directa del ADR 0049, punto 7; se pide su aprobación con este plan, §4.3 no lo listaba).
- **K50:** el enlace se calcula dos veces igual (`includes/radplapag-now-playing-block.php:48–55`, `includes/radplapag-schedule-block.php:156–163`) con `get_permalink()` sin mirar el estado. El criterio de la página limpia (`radio-player-page.php:255–261`): tipo `page`, `publish`, `post_password_required()`; K27 (`includes/radplapag-station-cpt.php:345–346`): `show_on_front = 'page'` y `page_for_posts`. `Player_Page` usa `'' === post_password` (D6), como `radplapag-program-cpt.php:219`.
- **K49:** sin enlace, `now-playing/render.php:64` solo imprime `<strong>nombre</strong>`. Afecta a los snapshots `now-playing-second-{logo,nologo}.html` (emisora «Second» sin página).
- **K51:** `esc_html( $ext_desc )` en `programs-list/render.php:81` y `schedule/render.php:111`. El *fixture* de los snapshots no tiene saltos (`'News & music'`): sin cambio de snapshot.
- Clases nuevas de `includes/src/` las carga `RadioPlayerPage\Autoloader`; cada una va en `tests/zip/expected-additions.txt`.
- e2e: el tema imprime el `h1` del título de la página antes de los bloques, así que `h2` por defecto no debería disparar `heading-order` (riesgo 2). La línea base tiene 1 entrada de las páginas de bloques.

## Objetivo

Los tres bloques pintan encabezados reales `<hN>` (nivel configurable, por defecto 2) con las mismas clases y estilos; «On Air: » sale también sin enlace; solo se enlaza la página del reproductor si se sirve; la descripción extendida conserva sus saltos de línea; la clase del contenedor sale una vez en WP 6.6. Cierre de la spec: `SPEC.md` sin la nota provisional y la nota de la release en la hoja de ruta.

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| K6: la clase del contenedor sale una vez en WP 6.6 y en la última; `now-playing` vacío solo pasa `is-empty` | `BlockRenderTest::test_wrapper_class_appears_once` (antes `test_currently_wrapper_class_is_repeated_on_wp_6_6`), en las dos puntas; snapshots sin la normalización |
| K53: `headingLevel` (2–6, por defecto 2) en los tres `block.json`; `<hN>` con las mismas clases y estilos; fuera de rango → 2 | `BlockAuditTest::test_blocks_print_heading_elements` (antes `test_currently_blocks_print_no_heading_elements`): `<h2>` y ningún `<header>`, 4 → `<h4>`, 9 → `<h2>`; `BlockRenderTest::registered_blocks()` con `headingLevel`; snapshots regenerados (diff en el commit) |
| K53: `SelectControl` «Heading level» (H2–H6) en el panel de los tres bloques | `blocks.spec.ts` (nuevo): elegir H4 guarda `headingLevel: 4` y la vista previa pinta `<h4>`, por bloque, Chromium y WebKit |
| K53: sin violaciones nuevas de axe | `a11y.spec.ts` «blocks page» y «blocks page with a program always on air» (`heading-order` incluido), Chromium y WebKit; capturas antes/después del front (riesgo 1), no se commitean |
| D6: `Player_Page::url()` vacía si la página no se sirve | `tests/php/integration/Blocks/PlayerPageTest.php` (TDD) |
| K50: sin enlace a una página que no se sirve, en `now-playing` y en la franja en antena del horario | `BlockAuditTest::test_does_not_link_to_a_player_page_that_is_not_served` (antes `test_currently_links_…`): borrador, privada, con contraseña y la de entradas con `show_on_front = 'page'` |
| K49: «On Air: » también sin enlace | `BlockAuditTest::test_now_playing_without_player_page_keeps_the_on_air_label`; snapshots `now-playing-second-*` |
| K51: saltos con `nl2br()` en el mismo `<p class="wp-block-paragraph">`, en los dos bloques | `BlockAuditTest::test_extended_description_keeps_its_line_breaks` (programs-list y schedule) |
| Cierre: filas «corregido (spec 0013)», `SPEC.md` §3.5 sin la nota provisional, nota de la release en la hoja de ruta | Revisión del commit 2.8 |
| Suite | `npm run check`, integración y e2e en las dos puntas, cobertura de la CI, `check:zip` (en `close-phase`) |

## Tareas

### 2.1 K6: la clase del contenedor una sola vez (≤ 1 h)
- Qué: `fix-bug`. `test_currently_wrapper_class_is_repeated_on_wp_6_6` → `test_wrapper_class_appears_once` (1 en las dos puntas), en rojo en WP 6.6. Arreglo: `get_block_wrapper_attributes()` sin argumentos en `schedule` y `programs-list`, `array( 'class' => 'is-empty' )` en `now-playing` vacío y sin argumentos en `now-playing` con programa. Se quita `unique_wrapper_classes()` y `render()` usa el HTML tal cual (excepción §4.3); se actualiza el docblock de la clase de test. Los snapshots se corren: no deben cambiar (si cambian, se para). K6 → corregido.
- Archivos: `blocks/*/render.php`, `tests/php/integration/Blocks/BlockRenderTest.php`, `docs/known-issues.md`.
- Test: regresión (`fix-bug`).
- Verificación: `npm run test:php:integration -- --filter BlockRenderTest` con `env:start:min` y con `env:start:latest`
- [ ] hecha · commit: —

### 2.2 K53: `headingLevel` y `<hN>` en el render (≤ 1 h)
- Qué: `fix-bug`. Antes de tocar nada, capturas del front de «E2E Blocks» y «E2E Blocks Always On Air» (Chromium, a `test-results/`). `test_currently_blocks_print_no_heading_elements` → `test_blocks_print_heading_elements` (`<h2>` y ningún `<header>`; `headingLevel` 4 → `<h4>`; 9 → `<h2>`; también 1 → `<h2>`), en rojo. `block.json` de los tres con `headingLevel` (`number`, 2). En cada `render`: `$level = (int) ( $attributes['headingLevel'] ?? 2 ); $level = ( $level >= 2 && $level <= 6 ) ? $level : 2;` y `'h' . $level` en la etiqueta de apertura y cierre, con las mismas clases y estilos (en `now-playing`, `<h<?php echo (int) $level; ?> …>` conservando los espacios de la plantilla). `registered_blocks()` con `headingLevel` (excepción §4.3). Snapshots regenerados con `RADPLAPAG_UPDATE_SNAPSHOTS=1`; el diff solo cambia `<header`/`</header>` → `<h2`/`</h2>` (se revisa con `git diff --stat` y `git diff`). `blocks.spec.ts:64`: `locator( 'header', … )` → `locator( '.wp-block-title', … )`. K53 sigue abierta hasta 2.3.
- Archivos: `blocks/*/block.json`, `blocks/*/render.php`, `blocks/*/build/` (hook), `tests/php/integration/Blocks/{BlockAuditTest,BlockRenderTest}.php`, `tests/php/integration/snapshots/blocks/*.html`, `tests/e2e/blocks.spec.ts`.
- Test: regresión (`fix-bug`) + snapshots.
- Verificación: `npm run test:php:integration -- --filter 'Block(Audit|Render)Test'`
- [ ] hecha · commit: —

### 2.3 K53: control «Heading level» en el editor de los tres bloques (≤ 1 h)
- Qué: en el panel de cada bloque, `SelectControl` «Heading level» con opciones H2–H6 (valores `'2'`…`'6'`), valor `String( headingLevel )` (fuera de 2–6 se muestra 2, como el front), `onChange` → `setAttributes( { headingLevel: parseInt( value, 10 ) } )`, y `headingLevel` en los atributos de `ServerSideRender`. Repetido en cada `src/` (ADR 0020). e2e nuevo en `blocks.spec.ts`, por bloque: insertar, elegir «H4», el atributo vale 4 y la petición de la vista previa lleva `headingLevel=4` (en `schedule` y `programs-list` la vista previa contiene `h4`; `now-playing` depende del reloj, basta la petición, como el D3 de la 1.7). Se espera la primera vista previa antes de elegir (el *flaky* de la 1.7). Luego `a11y.spec.ts` (los dos tests de páginas de bloques) y capturas después; si axe da algo nuevo (`heading-order`), **se para y se pregunta** antes de tocar la línea base. K53 → corregido.
- Archivos: `blocks/schedule/src/index.js`, `blocks/programs-list/src/index.js`, `blocks/now-playing/src/edit.js`, `blocks/*/build/` (hook), `tests/e2e/blocks.spec.ts`, `docs/known-issues.md`.
- Test: e2e nuevo (visto en rojo antes del control).
- Verificación: `npm --prefix blocks/schedule run check && npm --prefix blocks/programs-list run check && npm --prefix blocks/now-playing run check && npm run test:e2e -- blocks.spec.ts a11y.spec.ts`
- [ ] hecha · commit: —

### 2.4 D6: `Player_Page::url()` (≤ 1 h)
- Qué: TDD del adaptador `RadioPlayerPage\WP\Player_Page::url( int $page_id ): string`: `get_permalink()` si la entrada existe, es de tipo `page`, está en `publish`, `'' === post_password` y no es `page_for_posts` con `show_on_front = 'page'`; si no, `''`. Casos: publicada; 0 y un ID inexistente; borrador, privada, pendiente; con contraseña; la de entradas con `show_on_front = 'page'` (y la misma página con `posts`, que sí se sirve); una entrada que no es `page`. Va en `expected-additions.txt`.
- Archivos: `includes/src/wp/class-player-page.php`, `tests/php/integration/Blocks/PlayerPageTest.php`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `PlayerPageTest.php`.
- Verificación: `npm run test:php:integration -- --filter PlayerPageTest && npm run check:zip`
- [ ] hecha · commit: —

### 2.5 K50: sin enlace a una página que no se sirve (≤ 1 h)
- Qué: `fix-bug`. `test_currently_links_to_a_player_page_that_is_no_longer_published` → `test_does_not_link_to_a_player_page_that_is_not_served`, con un caso por estado (borrador, privada, con contraseña, la de entradas con `show_on_front = 'page'`): ni `now-playing` ni `schedule` llevan `href`; en rojo. Arreglo: `radplapag_get_now_playing_for_station()` y `radplapag_get_schedule_for_station()` calculan `station_page_url` con `Player_Page::url( (int) ( $station['player_page'] ?? 0 ) )` (firma y claves iguales; `@since 3.5.0` en su docblock: delega en `Player_Page`). K50 → corregido.
- Archivos: `includes/radplapag-now-playing-block.php`, `includes/radplapag-schedule-block.php`, `tests/php/integration/Blocks/BlockAuditTest.php`, `docs/known-issues.md`.
- Test: regresión (`fix-bug`).
- Verificación: `npm run test:php:integration -- --filter 'BlockAuditTest|BlockRenderTest|BlockDataTest'`
- [ ] hecha · commit: —

### 2.6 K49: «On Air: » también sin enlace (≤ 1 h)
- Qué: `fix-bug`. `test_currently_now_playing_without_player_page_drops_the_on_air_label` → `test_now_playing_without_player_page_keeps_the_on_air_label` (`On Air: <strong>Show</strong>` en los dos), en rojo. Arreglo en la rama sin enlace de `now-playing/render.php`: `esc_html_e( 'On Air', … ); ': '` antes de `<strong>`, igual que dentro del enlace. Snapshots `now-playing-second-{logo,nologo}.html` regenerados (el diff solo añade «On Air: »). Con 2.5, una página que no se sirve cae aquí (se añade la aserción a la regresión de K50). K49 → corregido.
- Archivos: `blocks/now-playing/render.php`, `tests/php/integration/Blocks/BlockAuditTest.php`, `tests/php/integration/snapshots/blocks/now-playing-second-*.html`, `docs/known-issues.md`.
- Test: regresión (`fix-bug`) + snapshots.
- Verificación: `npm run test:php:integration -- --filter 'Block(Audit|Render)Test'`
- [ ] hecha · commit: —

### 2.7 K51: saltos de línea de la descripción extendida (≤ 1 h)
- Qué: `fix-bug`. `test_currently_extended_description_line_breaks_stay_in_one_paragraph` → `test_extended_description_keeps_its_line_breaks`: en `programs-list` y en `schedule` (con `showExtendedDescription`), un solo `<p class="wp-block-paragraph">` con `Line one<br />\n<br />\nLine two` y el texto escapado (un `&` sale `&amp;`); en rojo. Arreglo: `nl2br( esc_html( … ) )` en los dos `render`. Snapshots: no deben cambiar (el *fixture* no tiene saltos). K51 → corregido.
- Archivos: `blocks/programs-list/render.php`, `blocks/schedule/render.php`, `tests/php/integration/Blocks/BlockAuditTest.php`, `docs/known-issues.md`.
- Test: regresión (`fix-bug`).
- Verificación: `npm run test:php:integration -- --filter 'Block(Audit|Render)Test'`
- [ ] hecha · commit: —

### 2.8 Cierre de la spec: `SPEC.md` y nota de la release (≤ 1 h)
- Qué: `SPEC.md` §3.5 sin la nota en cursiva provisional (la fila de §6 ya está). Hoja de ruta (`docs/specs/README.md`, «Release»): viñeta «changelog y `== Upgrade Notice ==` de la 0013» con las líneas de changelog apuntadas en las tareas de las fases 1 y 2 (K46 con D2, K47, K48, K53 con `headingLevel`, K49, K50, K51 y K54) y, en `== Upgrade Notice ==`, los encabezados reales (pueden cambiar el aspecto si el tema estilaba `header` o `h2`) y que los bloques viejos pasan a ID al elegir la emisora. Se comprueba que las nueve filas están en «corregido (spec 0013)».
- Archivos: `SPEC.md`, `docs/specs/README.md`, `docs/known-issues.md` (si falta algo).
- Test: — (docs).
- Verificación: `npm run check`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- Ninguna prevista: todo el contrato está en el ADR 0049. Si axe marca `heading-order` (riesgo 2) o un snapshot cambia más de lo previsto, se para y se pregunta.
- Edición de `blocks.spec.ts:64` (`header` → `.wp-block-title`): consecuencia del ADR 0049 (punto 7), aprobada con este plan.
