# ADR 0049 — Los bloques eligen la emisora por ID y pintan encabezados

- Estado: aceptado · Fecha: 2026-10-24 · Spec: 0013 (fases 1 y 2; tarea 1.1)

## Contexto

- **K46 (media).** Los tres bloques (`schedule`, `programs-list`, `now-playing`) guardan la emisora en `stationIndex`, su posición en `radplapag_get_stations()`, ordenada por `menu_order` y título. El CPT de emisora no soporta `page-attributes`, así que el orden es, en la práctica, el del título: crear una emisora cuyo título va antes, renombrar una o despublicarla cambia **en silencio** la emisora de todos los bloques guardados. Es el contrato de `SPEC.md` §3.5 («`stationIndex` es la posición…»), así que corregirlo pide este ADR.
- **K47.** El editor recorta un `stationIndex` fuera de rango (`safeIndex`) solo para el selector y la vista previa: muestra la última emisora mientras el front pinta el bloque vacío, y elegir la emisora que ya sale seleccionada no dispara `onChange`.
- **K48.** El aviso de `now-playing` sin programa («Now Playing: nothing to show…») se decide con `REST_REQUEST`, que está definida en cualquier petición REST: el `content.rendered` de `/wp/v2/pages/<id>` lo lleva, también para anónimos, aunque el front no imprime nada (§3.5).
- **K53 (media).** Ningún bloque imprime encabezados: los días del horario, el nombre de cada programa y «On Air»/«Coming up» son `<header>` con aspecto de encabezado. Un lector de pantalla no puede saltar entre ellos (WCAG 1.3.1, 2.4.6). ARIA in HTML solo permite en `<header>` los roles `group`, `none` y `presentation`, y la suite de axe corre con todas sus reglas (`aria-allowed-role`).
- **K49, K50, K51.** Sin página del reproductor, `now-playing` pierde «On Air:» (solo existía dentro del enlace). El enlace a la página del reproductor no mira si la página se sirve (borrador, privada, con contraseña o la de entradas). Los saltos de línea de la descripción extendida se pintan como espacios.
- El markup y los atributos de los bloques son contrato (`SPEC.md` §3.5, invariante 2 de `CLAUDE.md`): los temas pueden depender de ellos.

Decisiones D1–D8 de la spec 0013 (§4.1), D2 y D4 del usuario el 2026-10-24, y filas K46–K51 y K53 de [`known-issues.md`](../known-issues.md).

## Decisión

1. **`stationId` (K46, D1).** Los tres bloques ganan el atributo `stationId` (`number`, por defecto 0 = sin fijar). Con `stationId > 0`, el bloque pinta la emisora **publicada** con ese ID; si no existe o no está publicada, pinta lo mismo que con un índice fuera de rango («No radio schedule…», «No radio shows…», nada en `now-playing`) y **nunca otra emisora**. Con 0, usa `stationIndex` como hasta ahora (respaldo). La resolución vive en el núcleo puro, `RadioPlayerPage\Data\Stations::block_index( array $rows, int $station_id, int $station_index ): int` (índice de la fila con ese `id`, `-1` si no está; con 0, `$station_index`). Cada `render` la llama con `radplapag_get_stations()` solo cuando `stationId > 0` y pasa el índice a la función `radplapag_get_*_for_station()` de siempre. Esas funciones conservan su firma y su semántica.
2. **Sin migración (D2).** Un bloque guardado sin `stationId` pasa a ID solo cuando el usuario elige una emisora en el editor. Ni el editor lo fija al abrir (abrir no marca cambios) ni el servidor migra el contenido.
3. **Al elegir, los dos atributos (D3).** El selector usa el ID como valor; elegir hace `setAttributes( { stationId, stationIndex } )` con el índice de ese momento, para que con un *downgrade* a la 3.4.2 el bloque siga en su emisora mientras no cambie el orden.
4. **Datos del editor.** `radplapagScheduleBlock`, `radplapagProgramsListBlock` y `radplapagNowPlayingBlock` pasan a `{ stations: [ { label, id } ] }`, en el mismo orden que `radplapag_get_stations()` (se añade `id`, entero).
5. **Editor (K47, D2, D8).** Si `stationId` no está entre las emisoras, o vale 0 y `stationIndex` está fuera de rango, el panel avisa «This radio station no longer exists or is not published. Choose another one.» y el selector queda en una opción vacía («Select a radio station»). Con `stationId` 0 e índice válido, opción vacía y la ayuda «Showing “%s” by its position in the list of stations. Choose a station to keep it.». La vista previa recibe los atributos reales, sin recortar, y muestra lo mismo que el front. El editor no es contrato más allá de los atributos que guarda.
6. **Aviso de `now-playing` solo en la vista previa (K48, D5).** El aviso sale solo si `REST_REQUEST` y la ruta REST en curso, `$GLOBALS['wp']->query_vars['rest_route']`, empieza por `/wp/v2/block-renderer/radplapag/now-playing`. En cualquier otra respuesta (`content.rendered` incluido, anónimo o editor) el bloque vacío no imprime nada, como en el front. Sin callback nuevo. Si en una de las dos puntas (WP 6.6 y la última) la ruta no llega a `query_vars`, se pregunta al usuario y este ADR se amplía con un callback con nombre en `rest_request_before_callbacks` (§3.4).
7. **Encabezados reales (K53, D4).** Atributo `headingLevel` (`number`, por defecto 2, de 2 a 6) en los tres bloques, con un `SelectControl` «Heading level» (H2–H6) en el panel; no `HeadingLevelDropdown` (WP 6.6). Los `<header>` pasan a `<hN>` **con las mismas clases y estilos en línea**: el del día en `schedule` (`wp-block-heading`), el del programa en `programs-list` y los de «On Air» y «Coming up» en `now-playing` (`wp-block-title`). Un valor fuera de 2–6 se pinta como 2. No `role="heading"` sobre `<header>`.
8. **«On Air: » sin enlace (K49).** Sin enlace, `now-playing` imprime «On Air: » antes de `<strong>nombre</strong>`, como ya hace «Coming up:».
9. **Enlace solo a una página que se sirve (K50, D6).** La URL de la página del reproductor, en `now-playing` y en la franja en antena del horario, solo se usa si la página se sirve con el criterio de la página limpia (§3.3): `publish`, sin `post_password` y, con `show_on_front = 'page'`, distinta de `page_for_posts`. Un solo adaptador interno, `RadioPlayerPage\WP\Player_Page::url( int $page_id ): string` (vacía si no se sirve). Sin URL, no hay enlace y se aplica el punto 8.
10. **Saltos de línea (K51, D7).** La descripción extendida sale con `nl2br( esc_html( … ) )` dentro del mismo `<p class="wp-block-paragraph">`, en `programs-list` y en `schedule`. No `wpautop()`.
11. **No cambian** las meta keys, las opciones, los transients, los nombres de los bloques, los atributos existentes y sus valores por defecto, los `data-*`, los handles ni los nombres de los datos del editor. K6 (clase repetida del contenedor en WP 6.6) y K54 (títulos sin traducir en el *inserter*) se corrigen sin cambio de contrato.
12. **Release.** El changelog recoge K46 con D2 (los bloques viejos siguen por posición hasta que se elige la emisora), K47, K53 con `headingLevel`, K49, K50, K51 y K54. `== Upgrade Notice ==` avisa de los encabezados reales (pueden cambiar el aspecto si el tema estilaba `header` o tiene estilos propios de `h2`) y de que los bloques viejos pasan a ID al elegir la emisora.

## Consecuencias

- Un bloque con `stationId` ya no cambia de emisora por crear, renombrar o despublicar otra; si su emisora desaparece, el bloque sale vacío y el editor lo dice, en vez de enseñar otra.
- Los bloques guardados antes siguen expuestos a K46 hasta que alguien elija su emisora (D2). La ayuda del selector lo dice y va en el changelog. Es el precio de no reescribir contenido de los usuarios.
- `stationIndex` se sigue escribiendo: un *downgrade* conserva la emisora mientras el orden no cambie.
- Los encabezados reales pueden cambiar el aspecto en temas que estilan `header.wp-block-heading`, `header.wp-block-title` o `h2` (riesgo 1 de la spec); se conservan clases y `font-size` en línea y va en `== Upgrade Notice ==`. axe (`heading-order`) puede marcar el nivel según la página: el nivel es configurable.
- `RADPLAPAG_*` del player no cambia: los bloques no tocan sus globales.
- Lo protegen `tests/php/unit/Data/StationsTest.php`, `BlockAuditTest` (los `currently` de K46, K48, K49, K50, K51 y K53 pasan a regresión), `BlockRenderTest` (registro, datos del editor, `block-renderer`, K6), los snapshots de `tests/php/integration/snapshots/blocks/`, `blocks.spec.ts` (K47, D2, D3, K48, K54) y `a11y.spec.ts`.
- Tests de caracterización que cambian por diseño: los de §4.3 de la spec (snapshots, `test_editor_data`, `test_now_playing_empty_in_rest_request`, `registered_blocks()` y el selector por ID en «the three blocks are inserted and preview the chosen station»).

## Alternativas descartadas

- **Migrar en el servidor los bloques guardados a `stationId`:** reescribe `post_content` de los usuarios (revisiones, bloques sincronizados, plantillas), sin forma segura de saber que el índice guardado aún apunta a la emisora que se quería.
- **Fijar `stationId` al abrir el bloque en el editor:** marca cambios sin que el usuario toque nada y fija la emisora que hoy sale, que puede ser ya la equivocada.
- **Solo `stationId`, sin escribir `stationIndex`:** un *downgrade* a la 3.4.2 pondría todos los bloques nuevos en la primera emisora.
- **Caer en la primera emisora cuando el ID no existe:** repite K46 de otra forma; mejor vacío y avisado.
- **Detectar la vista previa con el contexto `edit` o con la capacidad del usuario:** un editor que lee `content.rendered` también lo cumple y vería un aviso que el front no imprime.
- **Callback en `rest_request_before_callbacks` como primera opción:** añade un callback enganchado al contrato (§3.4) cuando `query_vars` ya da la ruta; queda de reserva (punto 6).
- **`role="heading"` + `aria-level` sobre `<header>`:** no es un rol permitido en `<header>` (`aria-allowed-role` de axe) y el HTML ya tiene la etiqueta.
- **`HeadingLevelDropdown` de core (barra de herramientas):** descartado por la compatibilidad con WP 6.6 (D4); un `SelectControl` en el panel vale en las dos puntas.
- **`wpautop()` para K51:** parte el texto en varios `<p>` sin la clase `wp-block-paragraph` y cambia más markup del necesario.

Evidencia: [`spec.md`](../specs/0013-block-fixes/spec.md) (§2, §3, §4.1 y §6), [`phase-1.md`](../specs/0013-block-fixes/phase-1.md), filas K46–K51 y K53 de [`known-issues.md`](../known-issues.md).
