# ADR 0048 — Guardado de la emisora: cada campo por separado y sin fallos en silencio

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0010 (fase 3, tarea 3.1)

## Contexto

- `WP\Station_Meta_Saver::save()` (orden de la 3.4.2): con cualquier código de error de `Station\Field_Sanitizer` pone el transient `radplapag_station_field_errors_<id>` y **no escribe ni la URL ni la página** (`if/else`); sin errores, borra el transient y escribe las dos. Después escribe siempre las otras cinco metas y el horario.
- **K42 (media).** Una URL sin esquema con puerto (`radio.example.com:8000/stream`) pasa `new URL()` y el `type="url"` del navegador, pero `esc_url_raw()` la deja en `''`: el servidor avisa «Streaming URL is required.» y, por el `if/else`, **tampoco guarda la página**. Igual al revés: una página ocupada impide guardar una URL válida.
- **K37 (baja).** `Field_Sanitizer` pone a 0, sin código de error, el fondo o el logo que no son imagen y la bienvenida que no es `audio/mpeg`: el adjunto anterior se pierde sin aviso. El selector de la bienvenida ofrece cualquier audio.
- **«Entrada publicada» con error (sospecha 5.7 de la spec 0002).** Con un transient de errores, la pantalla muestra el aviso del plugin junto al de core («Post published.» / «Post updated.»), que dice lo contrario.
- **C13 (media).** Un stream `http` en un sitio `https` se guarda sin aviso, y el navegador lo bloquea (contenido mixto).
- **K36 y K27.** El selector de «Player Page» solo lista páginas publicadas (la asignada que deja de estarlo desaparece y se pierde al guardar) e incluye la página de entradas, donde la página limpia no se sirve. WordPress solo trata `page_for_posts` como página de entradas (`is_home()`) con `show_on_front = 'page'`.
- **Riesgo 6, comprobado en el plan:** `Data\Stations::for_page()` exige un `stream_url` no vacío, así que una emisora con página y sin URL no sirve el player (§3.3). Escribir la página aunque falle la URL no publica un player roto.

Decisiones D6, D7, D8 y D9 de la spec 0010 (§4.1), del usuario el 2026-10-23, y filas C13, K27, K36, K37 y K42 de [`known-issues.md`](../known-issues.md).

## Decisión

1. **Cada campo por separado (D8, K42).** El transient de errores de campos se pone si hay algún error y se borra si no. La URL se escribe salvo con `stream_url_required`; la página, salvo con `player_page_required` o `player_page_taken`. Un campo que falla conserva su valor guardado y avisa; no impide escribir el otro. El orden de las escrituras y de los mensajes (unidos con un espacio) no cambia.
2. **Ningún adjunto a 0 en silencio (D7, K37).** `Field_Sanitizer` devuelve `null` como valor del adjunto rechazado y añade, tras los códigos de hoy y en el orden de escritura, `background_not_image`, `logo_not_image` e `intro_not_mp3`. `Station_Meta_Saver` no escribe la meta `null` (se conserva la guardada) y añade al transient un mensaje por adjunto («… the previous one was kept.»). Un `0` enviado (quitar el adjunto) se sigue escribiendo. El selector de la bienvenida solo ofrece `audio/mpeg`. El logo del programa no cambia (fuera de alcance).
3. **Sin el mensaje de core con errores (D9).** Callback nuevo `radplapag_station_redirect_without_message( $location, $post_id )` en `redirect_post_location` (10, 2), enganchado dentro de `is_admin()`. Si el post es un `radplapag_station` y existe `radplapag_station_field_errors_<id>` o `radplapag_station_schedule_errors_<id>`, devuelve `remove_query_arg( 'message', $location )`; si no, `$location` sin tocar. La emisora se sigue publicando o actualizando; solo cambia el aviso. Es contrato desde ya, por la regla de `SPEC.md` §3.4.
4. **Contenido mixto (D6, C13).** Con un sitio `https` (esquema de `home_url()`) y una URL `http`, un aviso no bloqueante junto al campo: lo pinta PHP con la URL guardada (el esquema del sitio va en `data-site-scheme` del contenedor del campo) y el JS lo actualiza al escribir. Sin transient nuevo ni clave nueva en `radplapagAdmin`.
5. **Selector de «Player Page» (K36, K27).** La página asignada que existe y no está publicada se lista con su estado entre paréntesis (las mismas etiquetas que los programas, ADR 0045), seleccionada y con el aviso «This page is not published; the player is not shown until it is.». Con `show_on_front = 'page'` y `page_for_posts > 0`, la página de entradas se excluye salvo que sea la asignada; entonces sale con el aviso «This page is the posts page; the player is not shown on it.». Con `show_on_front = 'posts'` se lista como cualquier otra.
6. No cambian las meta keys, los transients (los avisos de K37 van en el de errores de campos), los `name` del formulario ni las firmas de `radplapag_*`. El markup de los meta boxes no es contrato (§3.6).

## Consecuencias

- Un error en un campo ya no borra el trabajo de otro, y ningún adjunto ni página se pierde sin aviso. La pantalla deja de decir «Post published.» junto a un error.
- Una emisora puede quedar con página y sin URL (ya podía, con una emisora nueva publicada sin URL): el aviso lo dice y el player no se sirve sin URL (§3.3).
- Hay un callback enganchado más que un tercero puede desenganchar (`remove_filter`); entra en `SPEC.md` §3.4 y en `HooksTest`.
- Quien subía un `.ogg` como bienvenida y veía que «no se guardaba» ahora conserva el MP3 anterior y ve el aviso. Va en `== Upgrade Notice ==`.
- Tests de caracterización que cambian por diseño (§4.3 de la spec, ampliada en la 3.1): `StationMetaSaverTest::test_page_of_another_station_is_reported`, `SaveStationMetaTest::test_cli_never_reads_stream_url_so_url_and_page_are_kept`, `test_invalid_attachments_become_zero`, `test_wrong_attachments_go_to_zero`, los `currently` de K37 y el ayudante `save()` del grupo «server» de `admin.spec.ts`.
- Lo protegen `Station\FieldSanitizerTest`, `StationMetaSaverTest`, `SaveStationMetaTest`, `HooksTest`, `AdminScreensTest`, `station-fields.test.js`, `program-admin.test.js` y `admin.spec.ts`.

## Alternativas descartadas

- **Mantener el `if/else` y mejorar solo el mensaje de K42:** sigue perdiendo la página por un error en la URL; el problema es el acoplamiento, no el texto.
- **Rechazar todo el guardado con cualquier error** (no publicar): WordPress ya ha guardado el post cuando corre `save_post`; deshacerlo es frágil y pierde el resto del formulario.
- **Escribir 0 y avisar en K37:** el aviso no devuelve el adjunto anterior; conservarlo es lo que espera quien se equivocó de archivo.
- **Un transient o un parámetro de URL propio para el aviso de core:** core ya lee `message` de la URL; quitarlo con `remove_query_arg()` basta y no añade estado.
- **Pedir el esquema del sitio en `radplapagAdmin` para C13:** PHP ya pinta el campo; un atributo en el DOM evita una clave más (ADR 0047) y sirve sin JS.
- **Excluir la página de entradas siempre, aunque sea la asignada:** se perdería al guardar, el mismo fallo en silencio que K36.

Evidencia: [`spec.md`](../specs/0010-admin-fixes/spec.md) (§2, §3, §4.1 y riesgo 6), [`phase-3.md`](../specs/0010-admin-fixes/phase-3.md), filas C13, K27, K36, K37 y K42 de [`known-issues.md`](../known-issues.md).
