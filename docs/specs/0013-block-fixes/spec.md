# Spec 0013 — Correcciones: bloques

> Estado: **cerrada** (2026-10-24) · Fecha: 2026-10-24 · Rama: `spec/0013-block-fixes` · Depende de: 0009, 0010
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0017, 0020, 0021, 0023, 0028 y 0045, `SPEC.md` §3.3, §3.4 y §3.5, `.claude/rules/blocks.md`, `php.md`, `security.md` y `testing.md`, y las filas K6, K46–K51, K53 y K54 de `docs/known-issues.md`. Su columna «Decisión del usuario» es el mandato, con las precisiones de §4.1.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0013-block-fixes/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. Cada fila se corrige con `fix-bug`: su test `currently` pasa a test de regresión, se ve en rojo y luego en verde, y la fila pasa a «corregido (spec 0013)». El ADR 0049 (§3) se escribe **antes** de tocar el markup o los atributos: es la primera tarea de la fase 1.
5. Los tres bloques son proyectos independientes (ADR 0020): el cambio del editor se repite en cada `blocks/<bloque>/src/`, sin código compartido. `build/` se regenera; nunca se edita.
6. Ningún test de caracterización se edita para que pase, salvo las excepciones de §4.3. Si cae otro, se para y se pregunta.
7. Fuera de alcance: K52 (ya corregida en la 0009), el modelo del horario y `Schedule_View`, `Programs_List_View` y `Now_Playing_Resolver` (la 0013 no cambia qué franjas salen, solo cómo se pintan y de qué emisora), y K83 (player).

## 1. Contexto y objetivo

El triage de la 0002 (5.6) dejó en los bloques dos filas medias y siete bajas. Las medias:

- **K46:** cada bloque guarda la emisora por su **posición** en `radplapag_get_stations()`. Si se crea una emisora cuyo título va antes, o si se renombra o se despublica otra, todos los bloques guardados cambian de emisora sin avisar.
- **K53:** ningún bloque imprime encabezados. Los días, los programas y «On Air»/«Coming up» son `<header>` con aspecto de encabezado, así que un lector de pantalla no puede saltar entre ellos.

Las bajas: el editor oculta que la emisora ya no existe (K47); el aviso del editor de `now-playing` sale en cualquier respuesta REST (K48); «On Air:» se pierde sin página del reproductor (K49); hay enlaces a una página que no se sirve (K50); la descripción extendida pierde sus saltos de línea (K51); la clase del contenedor sale repetida en WP 6.6 (K6); y el *inserter* no traduce dos bloques (K54).

Al cerrar la spec, todas estas filas están corregidas con su test de regresión. `SPEC.md` §3.5 recoge los atributos nuevos (`stationId` y `headingLevel`), el markup nuevo y los datos del editor con el ADR 0049.

**No objetivos:** migrar en el servidor los bloques ya guardados (§4.1, D2); un control de nivel con la barra de herramientas de core (`HeadingLevelDropdown`); cambiar los textos, las clases o los estilos en línea fuera de lo que piden las filas.

## 2. Criterios de aceptación

**Emisora por ID y editor (fase 1)**

- **ADR 0049** aceptado y `SPEC.md` §3.5 al día (tabla de atributos, markup, datos del editor) antes de la primera corrección.
- **K46 (media):** los tres bloques tienen el atributo `stationId` (`number`, por defecto 0). Si vale más de 0, el bloque pinta la emisora publicada con ese ID; si no existe o no está publicada, pinta lo mismo que hoy con un índice fuera de rango («No radio schedule…», «No radio shows…», nada en `now-playing`) y **nunca otra emisora**. Si vale 0, usa `stationIndex` como hoy (respaldo). Tests:
  - `tests/php/unit/Data/StationsTest.php` (TDD de la resolución, D1);
  - `BlockAuditTest::test_currently_station_index_follows_the_title_order` pasa a regresión: con `stationId`, ni una emisora nueva que va antes ni despublicar otra cambian la emisora del bloque, y la emisora despublicada da el mensaje vacío;
  - `BlockRenderTest`: el registro con `stationId` y el bloque viejo sin él (respaldo).
- **Datos del editor:** `{ stations: [ { label, id } ] }`, en el mismo orden. `BlockRenderTest::test_editor_data` (excepción de §4.3).
- **K47:** al elegir una emisora en el selector, el editor guarda su `stationId` y también su `stationIndex` de ese momento (D3). El selector usa como valor el ID. Si `stationId` no está entre las emisoras, o si vale 0 y `stationIndex` está fuera de rango, el panel muestra un aviso: «This radio station no longer exists or is not published. Choose another one.». El selector queda en una opción vacía, así que elegir cualquier emisora dispara `onChange`. La vista previa recibe los atributos reales, sin recortarlos (fuera `safeIndex`), y muestra lo mismo que el front. `blocks.spec.ts`: el `currently` de K47 pasa a regresión (aviso, opción vacía y vista previa del bloque vacío) y un test nuevo comprueba que elegir guarda `stationId` y `stationIndex`. Chromium y WebKit.
- **Bloque sin `stationId` en el editor (D2):** el selector muestra la opción vacía y una ayuda: «Showing “%s” by its position in the list of stations. Choose a station to keep it.». Abrir la entrada no marca cambios. `blocks.spec.ts` (un bloque `<!-- wp:radplapag/schedule /-->`: ayuda visible, `stationId` sin cambiar y la entrada sin cambios).
- **K48:** el aviso de `now-playing` sin programa solo sale en la vista previa del editor, es decir, la ruta `/wp/v2/block-renderer/radplapag/now-playing` (D5). En `content.rendered` de `/wp/v2/pages/<id>` no sale, ni para anónimos ni para un editor. Tests:
  - `BlockAuditTest::test_currently_rest_content_carries_the_editor_notice` pasa a regresión;
  - `BlockRenderTest::test_now_playing_empty_in_rest_request` pasa a ser el caso del `block-renderer` (excepción de §4.3);
  - `blocks.spec.ts`: la vista previa del editor muestra el aviso.
- **K54:** `schedule` y `programs-list` registran el bloque con `registerBlockType( metadata.name, { edit: Edit } )`, como `now-playing`, sin `...metadata` ni `save`. `blocks.spec.ts`: un mu-plugin de test con un filtro `gettext` traduce el título de los tres bloques y el *inserter* muestra los tres traducidos.

**Markup y encabezados (fase 2)**

- **K53 (media):** atributo `headingLevel` (`number`, por defecto 2, de 2 a 6) en los tres bloques, con un `SelectControl` «Heading level» (H2–H6) en el panel de cada bloque. Los `<header>` pasan a `<hN>` con **las mismas clases y estilos en línea**: el del día en `schedule` (`wp-block-heading`), el del programa en `programs-list` y los de «On Air» y «Coming up» en `now-playing` (`wp-block-title`). Un valor fuera de 2–6 se pinta como 2. Tests:
  - `BlockAuditTest::test_currently_blocks_print_no_heading_elements` pasa a regresión: hay `<h2>` y ningún `<header>`; con `headingLevel` 4, `<h4>`; con 9, `<h2>`;
  - los snapshots se regeneran (§4.3);
  - `a11y.spec.ts`: «blocks page» y «blocks page with a program always on air» sin violaciones nuevas (`heading-order` incluido).
- **K49:** sin enlace, `now-playing` imprime también «On Air: » antes de `<strong>nombre</strong>`, como «Coming up:». `BlockAuditTest` (K49 a regresión) y el snapshot `now-playing-second-*`.
- **K50:** la URL de la página del reproductor, en `now-playing` y en la franja en antena del horario, solo se usa si la página se sirve (D6). Si no se sirve, no hay enlace y el bloque cae en la rama de K49. `BlockAuditTest` (K50 a regresión: borrador, privada, con contraseña y la página de entradas con `show_on_front = 'page'`).
- **K51:** la descripción extendida conserva sus saltos de línea con `nl2br()` dentro del mismo `<p class="wp-block-paragraph">`, en `programs-list` y en `schedule` (D7). `BlockAuditTest` (K51 a regresión, en los dos bloques).
- **K6:** ningún `render` pasa `wp-block-radplapag-<bloque>` a `get_block_wrapper_attributes()`; `now-playing` vacío solo pasa `is-empty`. La clase sale una vez en WP 6.6 y en la última WP. `BlockRenderTest::test_currently_wrapper_class_is_repeated_on_wp_6_6` pasa a regresión y los snapshots dejan de normalizar las clases repetidas (§4.3).

**Cierre**

- Las filas pasan a «corregido (spec 0013)». `SPEC.md` §3.5 y §6 quedan con el ADR 0049, y la hoja de ruta lleva la nota de la release con lo visible de esta spec.
- `npm run check`, integración y e2e en las dos puntas (WP 6.6 + PHP 7.4 y última + 8.4) en verde. También la cobertura de la CI (PHP resto, que incluye `blocks/*/render.php`, y núcleo sin bajar) y `check:zip`.

## 3. Cambios al contrato (`SPEC.md`)

| Cambio | Sección | ADR previsto | Fase |
|---|---|---|---|
| Atributo nuevo `stationId` (0 = sin fijar) en los tres bloques. Manda sobre `stationIndex`, que queda de respaldo. Un ID que no está publicado no cae en otra emisora (K46) | §3.5 | 0049 «Los bloques eligen la emisora por ID y pintan encabezados» | 1 |
| Datos del editor: `{ stations: [ { label, id } ] }` (se añade `id`) | §3.5 | 0049 | 1 |
| El aviso de `now-playing` vacío solo sale en el `block-renderer` del editor (K48) | §3.5 | 0049 | 1 |
| Atributo nuevo `headingLevel` (2–6, por defecto 2). Los `<header>` pasan a `<hN>` con las mismas clases y estilos (K53) | §3.5 | 0049 | 2 |
| Markup: «On Air: » también sin enlace (K49); sin enlace si la página no se sirve (K50); `<br />` en los saltos de la descripción extendida (K51) | §3.5 | 0049 | 2 |

Las funciones `radplapag_get_*_for_station( $station_index, … )` conservan su firma y su semántica: el render traduce `stationId` a índice antes de llamarlas (D1). No cambian las meta keys, las opciones, los transients, los nombres de los bloques, los `data-*` ni los handles. K6 y K54 no cambian el contrato: la clase ya debía salir una vez, y el título traducido es el del `block.json`.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | Resolución en el núcleo puro: `RadioPlayerPage\Data\Stations::block_index( array $rows, int $station_id, int $station_index ): int`. Con `$station_id > 0` devuelve el índice de la fila con ese `id`, o `-1` si no está. Con 0 devuelve `$station_index`. Cada `render` lo llama con `radplapag_get_stations()` y pasa el índice a la función `radplapag_get_*_for_station()` de siempre, que con `-1` devuelve `null`. La lectura de las emisoras solo se repite cuando `stationId > 0` | K46 |
| D2 | Un bloque guardado sin `stationId` pasa a ID solo cuando el usuario elige una emisora. El editor no lo fija al abrir (no marca cambios) y el servidor no migra el contenido. El riesgo de K46 sigue en esos bloques hasta que se editen: va en el changelog y en `== Upgrade Notice ==` | usuario, 2026-10-24 |
| D3 | Al elegir, `setAttributes( { stationId, stationIndex } )`, con el índice de ese momento. Así, con un *downgrade* a la 3.4.2 el bloque sigue en su emisora mientras no cambie el orden | K46 |
| D4 | K53: etiqueta real `<hN>`, no `role="heading"`. ARIA in HTML solo permite en `<header>` los roles `group`, `none` y `presentation`, y axe corre aquí con todas sus reglas (`expectNoNewViolations`), así que `aria-allowed-role` lo marcaría. Nivel con el atributo `headingLevel` (por defecto 2), con un `SelectControl` y no `HeadingLevelDropdown`, por WP 6.6 | usuario, 2026-10-24 |
| D5 | K48: el `render` sabe que es la vista previa por la ruta REST en curso. Primera opción, sin callback nuevo: `$GLOBALS['wp']->query_vars['rest_route']` empieza por `/wp/v2/block-renderer/radplapag/now-playing`. La primera tarea de la fase 1 comprueba que eso vale en WP 6.6 y en la última (e2e de la vista previa). Si no vale, un callback con nombre en `rest_request_before_callbacks` guarda la ruta. Ese callback va en §3.4 y en el ADR 0049, y se pregunta antes | K48 |
| D6 | K50: la página «se sirve» con el mismo criterio que la página limpia (§3.3): `publish` y sin `post_password`, y, con `show_on_front = 'page'`, que no sea `page_for_posts`, porque allí `is_page()` es falso (K27 de la 0010). Un solo adaptador, `RadioPlayerPage\WP\Player_Page::url( int $page_id ): string` (vacía si no se sirve). Lo usan `radplapag_get_now_playing_for_station()` y `radplapag_get_schedule_for_station()`, que hoy repiten el cálculo | K50 |
| D7 | K51: `nl2br( esc_html( … ) )` en el mismo `<p>`. `wpautop()` partiría el texto en varios `<p>` sin la clase `wp-block-paragraph`. La descripción corta no tiene saltos (`sanitize_text_field`) | K51 |
| D8 | El editor de cada bloque añade sus cadenas nuevas con `__()` (aviso, ayuda con `/* translators: */`, opción vacía «Select a radio station», «Heading level»). Sin lógica extraída a tests de JS: el comportamiento del editor lo cubre el e2e en Chromium y WebKit | — |

### 4.2 Archivos

- Núcleo: `includes/src/data/class-stations.php` (D1). Adaptador nuevo `includes/src/wp/class-player-page.php` (D6), que va también en `tests/zip/expected-additions.txt`.
- Envoltorios y render: `includes/radplapag-{schedule,now-playing}-block.php` (D6), `blocks/*/render.php` (D1, K53, K49, K51, K6, K48) y `radio-player-page.php` (datos del editor con `id`).
- Bloques: `blocks/*/block.json` (`stationId`, `headingLevel`), `blocks/*/src/` (selector, aviso, ayuda, nivel, K54) y `build/` regenerado.
- Docs: `SPEC.md` §3.5 y §6, `docs/adr/0049-…`, `docs/known-issues.md`. `README.md` solo si documenta los atributos o los datos del editor; hoy no lo hace.

### 4.3 Tests

- **Excepciones a «no editar caracterización»** (por diseño, con el ADR 0049 o con su fila):
  - los snapshots de `tests/php/integration/snapshots/blocks/` se regeneran con `RADPLAPAG_UPDATE_SNAPSHOTS=1`: en la fase 1, si cambia algo (no debería: los bloques del *fixture* usan `stationIndex`); en la fase 2, con K53, K49 y K6. El plan de la fase muestra el diff;
  - `BlockRenderTest`: `test_editor_data` (con `id`) y `test_now_playing_empty_in_rest_request` (K48). Se quita la normalización de las clases repetidas (K6). `registered_blocks()` añade `stationId` y `headingLevel`;
  - `blocks.spec.ts`: «the three blocks are inserted and preview the chosen station», si comprueba el valor del selector como índice (pasa a ID).
- Los `currently` de `BlockAuditTest` (K46, K48, K49, K50, K51, K53) y de `BlockRenderTest` (K6) pasan a regresión con `fix-bug`.
- El *fixture* de e2e (`tests/e2e/fixtures/seed-e2e.php`) añade una página con un bloque guardado sin `stationId` para D2, si no la hay ya.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Sin spike: el único riesgo técnico, la detección de D5, tiene una alternativa conocida y se comprueba en la primera tarea.

### Fase 1 — Emisora por ID y editor (K46 media; K47, K48 y K54)

- ADR 0049 y `SPEC.md` §3.5 primero, con todo el contrato de §3 (los cambios de la fase 2 incluidos). Después: la comprobación de D5, D1 con TDD, `stationId` en los tres `block.json` y los `render`, los datos del editor, el editor de los tres bloques (K47, D2, D3), K48 y K54.
- ✅ **Criterios:** los de «Emisora por ID y editor» de §2.

### Fase 2 — Markup y encabezados (K53 media; K49, K50, K51 y K6)

- K53 (atributo, control y render), K49 y K50 juntas (D6), K51 y K6. Los snapshots y la línea base de axe se comprueban en cada paso.
- Cierre de la spec: `SPEC.md` §6, la nota de la release en la hoja de ruta (changelog: K46 con D2, K47, K53 con `headingLevel`, K49, K50, K51 y K54; `== Upgrade Notice ==`: los encabezados reales, que pueden cambiar el aspecto si un tema estilaba `header`, y los bloques viejos que pasan a ID al elegir la emisora) y el PR listo.
- ✅ **Criterios:** los de «Markup y encabezados» y de cierre de §2. En `close-phase`, el usuario elige los revisores. Los que encajan: `backcompat-reviewer` (markup y atributos), `a11y-reviewer` (K53), `wp-security-reviewer` y `wporg-reviewer` (render y REST).

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Un tema estila `header.wp-block-title` o `header.wp-block-heading` y cambia el aspecto con `<hN>`. También los estilos del tema para `h2` (márgenes, fuente) | Se conservan las clases y el `font-size` en línea; capturas antes y después del front de e2e en el plan. Va en `== Upgrade Notice ==` (ADR 0049) | Fase 2 |
| 2 | `heading-order` de axe marca el `h2` de los bloques según lo que haya alrededor en la página del e2e | El valor por defecto (2) va bajo el `h1` del título. Si axe marca algo, se para y se pregunta antes de tocar la línea base | Fase 2 |
| 3 | D5 no vale en una de las dos puntas (la ruta REST no llega a `query_vars`) | Alternativa de D5 (callback en `rest_request_before_callbacks`), con la pregunta al usuario y el ADR 0049 ampliado | Fase 1 |
| 4 | Los bloques nuevos que nadie toca se quedan en `stationIndex` (D2) y siguen expuestos a K46 | La ayuda del selector lo dice. Va en el changelog | Fase 1 |
| 5 | El *flaky* conocido de la vista previa del editor en `blocks.spec.ts` (status, «Verificación manual pendiente») | Si vuelve, se mira su traza antes de culpar al cambio | Fases 1 y 2 |

## Apéndice — Referencias

- Filas: K6, K46, K47, K48, K49, K50, K51, K53 y K54 de `docs/known-issues.md`; el informe `docs/specs/0002-safety-net/audit/blocks.md` (K54, reproducción).
- Código: `blocks/{schedule,programs-list,now-playing}/` (`block.json`, `render.php`, `src/`), `includes/radplapag-{schedule,programs-list,now-playing}-block.php`, `includes/radplapag-stations.php`, `includes/src/data/class-stations.php`, `includes/src/wp/class-station-repository.php` y `radio-player-page.php` (registro y datos del editor).
- Tests: `tests/php/integration/Blocks/{BlockRenderTest,BlockAuditTest}.php`, `tests/php/integration/snapshots/blocks/`, `tests/php/unit/Data/`, `tests/e2e/blocks.spec.ts`, `tests/e2e/a11y.spec.ts` y `a11y-baseline.json`, `tests/e2e/mu-plugins/` y `tests/e2e/fixtures/seed-e2e.php`.
