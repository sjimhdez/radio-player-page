# Spec 0010 · Fase 3 — Campos y guardado
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0017, 0021, 0028, 0045, 0047 (nuevo), 0048 (nuevo)

## Contexto
- Las fases 1 y 2 están cerradas y no dejan nada pendiente. La rama `spec/0010-admin-fixes` ya contiene `origin/trunk`, y el PR #44 sigue en borrador.
- **Guardado de la emisora** (`WP\Station_Meta_Saver::save()`): con cualquier código de error, pone el transient y no escribe **ni la URL ni la página** (`if/else`). Con ningún error, borra el transient y escribe las dos. Después escribe siempre las otras cinco metas y el horario. `Station\Field_Sanitizer` pone a 0, sin error, el fondo o el logo que no son imagen y la bienvenida que no es `audio/mpeg` (K37). Los mensajes se unen con un espacio, en el orden `stream_url_required`, `player_page_required` / `player_page_taken`.
- **Riesgo 6, comprobado:** `Data\Stations::for_page()` exige un `stream_url` no vacío, así que una emisora con página y sin URL no sirve el player (§3.3). Escribir la página aunque la URL falle no publica un player roto.
- **Selector de «Player Page»** (`radplapag_render_station_details_meta_box()`): `get_pages( publish )`, sin excluir `page_for_posts`. Las etiquetas de estado («Draft», «Pending», «Scheduled», «Private», «Trash») hoy solo existen dentro de `radplapag_get_station_programs_for_select()`.
- **K27, precisión:** WordPress solo trata `page_for_posts` como página de entradas (`is_home()`) con `show_on_front = 'page'`. La exclusión y el aviso dependen de las dos opciones.
- **Programa:** `Program\Field_Sanitizer::truncate()` usa `substr()`, con las constantes `*_MAX_BYTES`. `Program_Meta_Saver` llama a `update_post_meta()` con el valor ya sin barras. La extensión mbstring está en el PHP local, y WordPress trae `mb_substr()` en `compat.php` si falta.
- **Bienvenida:** el selector vive en `admin/js/program-admin.js:103` (`library: { type: 'audio' }`), que también se carga en la pantalla de la emisora.
- **K42 en el cliente:** `station-admin.js` valida con `new URL()` en el envío (línea 290) y al escribir (línea 64). `radio.example.com:8000/stream` y `ftp://…` pasan.
- **D9 en e2e:** el ayudante `save()` del grupo «server, without the client validation» de `admin.spec.ts` espera `&message=` en la URL de la redirección, y todos sus casos acaban con error. Con D9 esa espera ya no sirve.
- La fixture `station-meta-box.html` incluye el meta box de detalles, así que C13 la regenera.

### Tests de caracterización que cambian por diseño (amplían §4.3; se apuntan en la spec en la 3.1)
- K42 (D8): `StationMetaSaverTest::test_page_of_another_station_is_reported` (ahora la URL válida sí se escribe) y `SaveStationMetaTest::test_cli_never_reads_stream_url_so_url_and_page_are_kept` (en la CLI la página válida sí se escribe). `test_writes_order_with_field_errors_and_valid_schedule` no cambia, porque no envía página.
- K37 (D7): además de los de §4.3, `program-admin.test.js` («…audio frame…», `library: { type: 'audio' }` → `'audio/mpeg'`), que ya cita el criterio de K37.
- K5 (D10): además de `SaveProgramMetaTest::test_truncation_counts_bytes_not_characters`, su gemelo del núcleo `tests/php/unit/Program/FieldSanitizerTest.php::test_truncation_counts_bytes_not_characters`.
- D9: el ayudante `save()` del grupo «server» de `admin.spec.ts` espera la respuesta del POST y la carga, no `&message=`.

## Objetivo
Corregir C13, K42, K37, K36, K27, K5, K34, «Entrada publicada con error» y K76 con su test de regresión, con los ADRs 0047 y 0048 y `SPEC.md` §3.4 y §3.6 al día. El cierre de la spec (§6, nota de release, PR listo) va en `close-phase`.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| K42 cliente: la URL exige `http:`/`https:` con «Please enter a URL that starts with http:// or https://.» | `station-fields.test.js` (el test del esquema cambia, más uno con `host:port/path`), `admin.spec.ts` (K42 a regresión: envío bloqueado con el mensaje) |
| K42 servidor: la URL y la página se escriben cada una si es válida | `StationMetaSaverTest` (nuevo + excepción), `SaveStationMetaTest` (excepción) |
| C13: aviso no bloqueante con un stream `http` en un sitio `https`, pintado por PHP y actualizado por el JS | `AdminScreensTest` (con y sin `https`, filtro de `home_url`), `station-fields.test.js` (en vivo), `admin.spec.ts` (sin aviso en `http`) |
| K37: bienvenida solo `audio/mpeg` en el selector; un adjunto rechazado conserva su valor y avisa | `FieldSanitizerTest` (dos `currently` a regresión), `StationMetaSaverTest` y `SaveStationMetaTest` (a regresión), `program-admin.test.js` |
| K36: la página asignada no publicada se lista con su estado y un aviso | `AdminScreensTest` (K36 a regresión) |
| K27: se excluye la página de entradas, salvo la asignada (con aviso) | `AdminScreensTest` |
| K5 + K34: corte por caracteres sin UTF-8 inválido; las barras se conservan | `Program\FieldSanitizerTest`, `SaveProgramMetaTest` (los `currently` a regresión) |
| «Entrada publicada»: con un transient de errores, la redirección no lleva `message` | `SaveStationMetaTest` (callback), `HooksTest`, `admin.spec.ts` (aviso del servidor sin `#message`) |
| K76: fuera `completeTimeFields` y `startEndSame` | `AdminScreensTest::test_admin_strings_keys` |
| ADR 0047 y 0048; `SPEC.md` §3.4 (callback nuevo) y §3.6 | revisión del diff de la 3.1 |
| Ningún test de caracterización se edita fuera de §4.3 (ampliada en la 3.1) | diff de cada commit |

## Tareas

### 3.1 ADRs 0047 y 0048, `SPEC.md` y §4.3 (≤ 1 h)
- Qué:
  - `write-adr` 0047 «El contenido de `radplapagAdmin` es interno». `radplapag_get_admin_strings()` conserva su firma, pero lo que devuelve no es contrato. Fuera `completeTimeFields` y `startEndSame`.
  - `write-adr` 0048 «Guardado de la emisora: cada campo por separado y sin fallos en silencio», con D7, D8 y D9, y la precisión de K27 (`show_on_front`).
  - `SPEC.md` §3.4: fila `redirect_post_location` → `radplapag_station_redirect_without_message` (10, 2). `SPEC.md` §3.6: el guardado y que `radplapagAdmin` es interno.
  - Índice de ADRs y, en la spec, §4.3 con las excepciones del contexto.
- Archivos: `docs/adr/0047-*.md`, `docs/adr/0048-*.md`, `docs/adr/README.md`, `SPEC.md`, `docs/specs/0010-admin-fixes/spec.md`
- Test: — (documentación)
- Verificación: `npm run check`
- [x] hecha · commit: ver `git log` («docs(0010): add ADRs 0047 and 0048 (3.1)»)

### 3.2 K42 servidor: la URL y la página, cada una si es válida (≤ 1 h) — `fix-bug`
- Qué: en `Station_Meta_Saver::save()`, el transient se pone si hay errores y se borra si no. La URL se escribe sin `stream_url_required` y la página sin `player_page_required` ni `player_page_taken`. El orden de las escrituras y de los mensajes no cambia.
- Archivos: `includes/src/wp/class-station-meta-saver.php`, `tests/php/integration/Station/StationMetaSaverTest.php`, `tests/php/integration/Station/SaveStationMetaTest.php`
- Test: primero `StationMetaSaverTest::test_invalid_url_still_writes_a_valid_page (K42)` y `test_taken_page_still_writes_a_valid_url (K42)`, en rojo. Las dos excepciones del contexto pasan a afirmar el comportamiento nuevo.
- Verificación: `npm run test:php:integration -- --filter 'StationMetaSaverTest|SaveStationMetaTest'`
- Rojo (2026-10-23): 4 fallos por la razón esperada. Los dos nuevos no escriben la meta válida (falta `added_post_meta:radplapag_station_player_page` / `…_stream_url` tras el transient); `test_page_of_another_station_is_reported` conserva `old.mp3` y el de la CLI conserva la página anterior. Verde tras el arreglo: 57/57 y la integración completa, 993/993.
- Changelog: «Saving a station with an invalid stream URL now keeps the player page, and the other way round.»
- [x] hecha · commit: ver `git log` («fix(0010): write the stream URL and the page each one if valid (3.2)»)

### 3.3 K42 cliente: solo `http://` o `https://` (≤ 1 h) — `fix-bug`
- Qué: cadena nueva `streamUrlScheme` en `admin-strings.php` (más `STRING_KEYS`). En el envío y al escribir, una URL válida para `new URL()` cuyo `protocol` no es `http:`/`https:` da ese mensaje y bloquea; la que no se parsea sigue con `streamUrlInvalid` (D5). El e2e `currently` de K42 pasa a esperar el envío bloqueado con el mensaje nuevo y la URL guardada intacta.
- Archivos: `admin/admin-strings.php`, `admin/js/station-admin.js`, `tests/php/integration/Admin/AdminScreensTest.php`, `tests/js/admin/station-fields.test.js`, `tests/e2e/admin.spec.ts`, `docs/known-issues.md` (K42 corregido)
- Test: primero, en `station-fields.test.js`, «rejects a URL whose scheme is not http or https (K42)» (sustituye a «accepts any URL scheme…», D5) y «rejects host:port/path without a scheme (K42)». Después, `admin.spec.ts` «blocks a stream URL without a scheme with its message (K42)».
- Verificación: `npm test -- tests/js/admin && npm run test:php:integration -- --filter test_admin_strings_keys && npx playwright test tests/e2e/admin.spec.ts -g K42`
- Rojo (2026-10-23): los dos de Vitest no bloquean el envío (`blocked` es `false`) y uno nuevo de «live clearing» («keeps the URL error on input with a URL that is not http or https») ve el error borrado al escribir `host:port/path`; `test_admin_strings_keys` falla por la clave que falta y el e2e recibe `""` en el mensaje del campo. Verde: Vitest de admin 263/263, `test_admin_strings_keys` y los 4 e2e de la URL en Chromium y WebKit.
- Changelog: «The station screen now asks for a stream URL that starts with http:// or https://.»
- [x] hecha · commit: ver `git log` («fix(0010): require http or https in the stream URL on the client (3.3)»)

### 3.4 K37: el adjunto rechazado conserva su valor y avisa (≤ 1 h) — `fix-bug`
- Qué (D7): `Station\Field_Sanitizer` devuelve `null` en el valor del adjunto rechazado y añade, tras los códigos de hoy, `background_not_image`, `logo_not_image` e `intro_not_mp3` (en el orden de escritura). Un 0 enviado (quitar) se sigue escribiendo. `Station_Meta_Saver` no escribe la meta `null` y traduce los tres mensajes:
  - «Background Image must be an image; the previous one was kept.»
  - «Logo Image must be an image; the previous one was kept.»
  - «Welcome Audio must be an MP3 file; the previous one was kept.»
- Archivos: `includes/src/station/class-field-sanitizer.php`, `includes/src/wp/class-station-meta-saver.php`, `tests/php/unit/Station/FieldSanitizerTest.php`, `tests/php/integration/Station/StationMetaSaverTest.php`, `tests/php/integration/Station/SaveStationMetaTest.php`, `docs/known-issues.md`
- Test: primero los `currently` de `FieldSanitizerTest` (dos) y de `SaveStationMetaTest` a regresión, más `test_invalid_attachments_become_zero` y `test_wrong_attachments_go_to_zero` (§4.3) con el valor anterior conservado y el mensaje. Todos en rojo.
- Verificación: `npm run test:php:unit -- --filter FieldSanitizerTest && npm run test:php:integration -- --filter 'StationMetaSaverTest|SaveStationMetaTest' && npm run lint:phpstan`
- Rojo (2026-10-23): unit, 5 fallos («Failed asserting that 0 is null»: `test_non_image_attachments_are_kept_with_an_error` y los cuatro casos de `test_non_mp3_intro_is_kept_with_an_error`); integración, 3 (`test_wrong_attachments_keep_the_stored_value_with_a_message` sin transient; `test_invalid_attachments_keep_the_stored_value` y `test_non_mp3_welcome_audio_keeps_the_previous_one_with_a_notice` con la meta a 0). `test_removed_attachments_are_written_as_zero` (un 0 enviado se escribe) es guarda y ya pasaba. Tras el arreglo cayó `FieldSanitizerTest::test_values_with_errors`, fuera de la lista: el usuario aprobó que espere `null` (anotado en §4.3). Verde: unit 27/27, integración 58/58, PHPStan sin errores.
- Changelog: «Saving a station with a background or logo that is not an image, or a welcome audio that is not an MP3, now keeps the previous one and says so.» Upgrade Notice: K37 conserva el adjunto anterior.
- [x] hecha · commit: ver `git log` («fix(0010): keep a rejected attachment and report it (3.4)»)

### 3.5 K37: el selector de la bienvenida solo ofrece MP3 (≤ 30 min) — `fix-bug`
- Qué: `library: { type: 'audio/mpeg' }` en `program-admin.js`. K37 pasa a «corregido (spec 0010)».
- Archivos: `admin/js/program-admin.js`, `tests/js/admin/program-admin.test.js`, `docs/known-issues.md`
- Test: primero la aserción de las opciones del marco de audio (excepción de la 3.1), en rojo.
- Verificación: `npm test -- tests/js/admin/program-admin.test.js`
- Rojo (2026-10-23): «opens its own MP3-only audio frame and fills the preview (K37)» recibe `library: { type: 'audio' }` en lugar de `'audio/mpeg'`. Verde: Vitest de admin 263/263.
- Changelog: «The welcome audio picker now lists only MP3 files.»
- [x] hecha · commit: ver `git log` («fix(0010): offer only MP3 files in the welcome audio picker (3.5)»)

### 3.6 C13: aviso de contenido mixto (≤ 1 h) — `fix-bug`
- Qué (D6):
  - En PHP, el `p[data-field="stream_url"]` lleva `data-site-scheme` (esquema de `home_url()`) y, tras el error, `span#radplapag_station_stream_url_notice.radplapag-field-notice` con el texto (`esc_html_e()`). Se ve con un sitio `https` y la URL guardada `http`; si no, lleva `hidden`. Cuando se ve, el `input` lleva `aria-describedby` con su `id`.
  - El JS lo recalcula en `input` (lee `data-site-scheme` y `new URL().protocol`) y quita o pone `hidden` y `aria-describedby`. Sin clave nueva en `radplapagAdmin`: el texto ya está en el DOM.
  - CSS del aviso: el color de aviso de WP, sin bloquear.
  - Se regenera la fixture (diff: el atributo y el `span` oculto).
- Archivos: `includes/radplapag-station-cpt.php`, `admin/js/station-admin.js`, `admin/css/admin.css`, `tests/php/integration/Admin/AdminScreensTest.php`, `tests/fixtures/admin/station-meta-box.html`, `tests/js/admin/station-fields.test.js`, `tests/e2e/admin.spec.ts`, `docs/known-issues.md`
- Test: primero `AdminScreensTest::test_details_box_warns_about_an_http_stream_on_an_https_site (C13)` (filtro de `home_url`) y `…_does_not_warn_on_an_http_site`. Después, en `station-fields.test.js`, «shows the mixed content notice while typing an http URL on an https site (C13)» y «hides it for https or on an http site». En el e2e de C13, la aserción del `span` oculto, con un comentario: el entorno es `http`.
- Verificación: `npm run test:php:integration -- --filter AdminScreensTest && npm test -- tests/js/admin && npx playwright test tests/e2e/admin.spec.ts -g C13` (fixture con el comando de `Support/Snapshot.php`)
- Rojo (2026-10-23): los 4 casos de `AdminScreensTest` sin `data-site-scheme`; en Vitest, «shows the mixed content notice…» recibe `{ shown: false, described: false }`. Los cuatro «hides it for…» pasaban ya (guardas); una mutación (`notice.hidden = false`) los tumba. Diff de la fixture: `data-site-scheme="http"` y el `span` oculto. Verde: `AdminScreensTest`, Vitest de admin 269/269 y el grupo «create and save» de `admin.spec.ts` en Chromium y WebKit (con `-g C13` solo, el test agota los 30 s: depende del programa que crea el anterior del grupo en serie, así que se pasa con `-g "create and save"`).
- Changelog: «The station screen now warns when an http:// stream would not play on an https:// site.»
- [x] hecha · commit: ver `git log` («fix(0010): warn about an http stream on an https site (3.6)»)

### 3.7 K36: la página asignada no publicada sigue en el selector (≤ 1 h) — `fix-bug`
- Qué:
  - Las etiquetas de estado salen a `RadioPlayerPage\WP\Post_Status_Label::of( string $status )` (`includes/src/wp/class-post-status-label.php`, en `expected-additions.txt`). `radplapag_get_station_programs_for_select()` la usa, sin cambiar su salida.
  - En el meta box de detalles, si la página asignada existe, es `page` y no está en la lista, se añade con «Título (Estado)» (`'%1$s (%2$s)'`, la misma cadena) y queda seleccionada. Bajo el `select` va `span.radplapag-field-notice`: «This page is not published; the player is not shown until it is.».
- Archivos: `includes/src/wp/class-post-status-label.php`, `includes/radplapag-program-cpt.php`, `includes/radplapag-station-cpt.php`, `tests/zip/expected-additions.txt`, `tests/php/integration/Admin/AdminScreensTest.php`, `docs/known-issues.md`
- Test: primero el `currently` de K36 a «lists an assigned page that is not published, with its status and a notice (K36)», en rojo. `test_station_programs_for_select` sigue en verde.
- Verificación: `npm run test:php:integration -- --filter AdminScreensTest && npm run check:zip`
- Rojo (2026-10-23): «…lists_an_assigned_page_that_is_not_published_with_its_status_and_a_notice» sin opción seleccionada (`array()` en lugar de `['4']`). El de la página publicada (una sola opción, sin aviso) es guarda y ya pasaba. Diff de la fixture: solo espacio en blanco tras el `select` y el `p` (los `if` nuevos). El JS de errores reescribe `aria-describedby` del `select`, así que el aviso va sin enlace ARIA, como dice el plan. El servidor no filtra la página por estado: reenviarla la conserva. `get_pages()` se normaliza a array (lo pide `wp_list_pluck()`), y la entrada `foreach.nonIterable` de `radplapag-station-cpt.php` sale de la baseline. Verde: `AdminScreensTest` 39/39, integración completa 999/999, Vitest de admin 269/269, `check:zip` y `npm run check`.
- Changelog: «The Player Page select keeps a page that is no longer published, with its status and a notice.»
- [x] hecha · commit: ver `git log` («fix(0010): keep an unpublished player page in the select (3.7)»)

### 3.8 K27: fuera la página de entradas (≤ 45 min) — `fix-bug`
- Qué: con `show_on_front = 'page'` y `page_for_posts > 0`, el selector la excluye, salvo que sea la asignada. Entonces sale con el aviso «This page is the posts page; the player is not shown on it.».
- Archivos: `includes/radplapag-station-cpt.php`, `tests/php/integration/Admin/AdminScreensTest.php`, `docs/known-issues.md`
- Test: primero `test_details_box_leaves_out_the_posts_page (K27)` y `test_details_box_warns_when_the_assigned_page_is_the_posts_page (K27)`, en rojo. Más uno con `show_on_front = 'posts'` (se lista y no avisa).
- Verificación: `npm run test:php:integration -- --filter AdminScreensTest`
- Rojo (2026-10-23): «…leaves_out_the_posts_page» (la página de entradas sale en el `select`) y «…warns_when_the_assigned_page_is_the_posts_page» (sin aviso). El de `show_on_front = 'posts'` es guarda y ya pasaba. La página asignada que es la de entradas ya estaba en la lista (publicada): solo se añade el aviso, sin enlace ARIA, como el de K36. Diff de la fixture: solo espacio en blanco tras el `select` (el `if` nuevo). Verde: `AdminScreensTest` 42/42, integración completa 1002/1002 y `npm run check`.
- Changelog: «The Player Page select leaves out the posts page, and warns if a station already uses it.»
- [x] hecha · commit: ver `git log` («fix(0010): leave the posts page out of the player page select (3.8)»)

### 3.9 K5 + K34: descripciones del programa (≤ 45 min) — `fix-bug`
- Qué: `truncate()` con `mb_strlen`/`mb_substr` (`'UTF-8'`). Las constantes pasan a `*_MAX_CHARS` (la clase es interna). `Program_Meta_Saver` hace `wp_slash()` de las dos descripciones antes de `update_post_meta()`.
- Archivos: `includes/src/program/class-field-sanitizer.php`, `includes/src/wp/class-program-meta-saver.php`, `tests/php/unit/Program/FieldSanitizerTest.php`, `tests/php/integration/Cpt/SaveProgramMetaTest.php`, `docs/known-issues.md`
- Test: primero los `currently` de K5 (unit e integración) y de K34 a regresión, y los dos `test_truncation_counts_bytes_not_characters` a «…counts_characters» (200 «é» → 200), en rojo.
- Verificación: `npm run test:php:unit -- --filter FieldSanitizerTest && npm run test:php:integration -- --filter SaveProgramMetaTest`
- Rojo (2026-10-23): unit «…counts_characters» (200 «é» → 128) y «…cut_never_splits_a_character» (queda `\xC3`); integración «…counts_characters», «…with_a_character_at_the_limit_is_saved» (se guarda vacío) y «…keep_backslashes» («ACDC o/»). Los `currently` de K5 pasan a regresión con «éé» en el límite, para que el corte caiga entre caracteres. `mb_*` sin comprobar la extensión: WordPress trae su reserva (D10). Verde: `FieldSanitizerTest` 27/27, `SaveProgramMetaTest` 16/16 y `npm run check`.
- Changelog: «Program descriptions are now limited by characters, so text with accents is no longer saved empty, and they keep their backslashes.»
- [x] hecha · commit: ver `git log` («fix(0010): cut program descriptions by characters and keep backslashes (3.9)»)

### 3.10 «Entrada publicada» con error: la redirección sin `message` (≤ 1 h) — `fix-bug`
- Qué (D9): `radplapag_station_redirect_without_message( $location, $post_id )`, en `includes/radplapag-station-cpt.php`, enganchada a `redirect_post_location` (10, 2) dentro de `is_admin()`. Si el post es una emisora y existe alguno de los dos transients de errores, devuelve `remove_query_arg( 'message', $location )`; si no, `$location` tal cual. `HooksTest::EXPECTED` añade la fila. El ayudante `save()` del grupo «server» espera el POST y la carga (excepción de la 3.1), y comprueba que no hay `#message`.
- Archivos: `includes/radplapag-station-cpt.php`, `tests/php/integration/Station/SaveStationMetaTest.php`, `tests/php/integration/Admin/HooksTest.php`, `tests/e2e/admin.spec.ts`, `docs/known-issues.md` (fila nueva corregida o nota de 5.7)
- Test: primero `SaveStationMetaTest::test_redirect_drops_core_message_with_field_errors`, `…_with_schedule_errors`, `…_keeps_it_without_errors` y `…_ignores_other_post_types`, más `HooksTest`, en rojo. Después, e2e: «shows the server notice without core's "Post published."».
- Verificación: `npm run test:php:integration -- --filter 'SaveStationMetaTest|HooksTest' && npx playwright test tests/e2e/admin.spec.ts -g server`
- [ ] hecha · commit: —

### 3.11 K76: fuera las dos cadenas sin uso (≤ 30 min) — `fix-bug`
- Qué: se quitan `completeTimeFields` y `startEndSame` de `radplapag_get_admin_strings()` y de `STRING_KEYS` (§4.3). Antes, `grep` confirma que no se usan en `admin/js` ni en `tests/js`.
- Archivos: `admin/admin-strings.php`, `tests/php/integration/Admin/AdminScreensTest.php`, `docs/known-issues.md`
- Test: primero `STRING_KEYS` sin las dos claves, en rojo.
- Verificación: `grep -rn "completeTimeFields\|startEndSame" admin includes tests/js; npm run test:php:integration -- --filter test_admin_strings_keys && npm test`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
Las de la fase van en 0047 y 0048 (3.1). Si un test de caracterización que no está en la lista del contexto cae, se para y se pregunta.

## Verificación de la fase
`npm run check` antes de cada commit. En `close-phase`, que también cierra la spec:
- integración y e2e en las dos puntas (`env:start:min` y `env:start:latest`);
- cobertura (JS de admin ≥ 85 %; PHP crítico y núcleo, sin bajar);
- `check:zip`;
- `wp-security-reviewer` y `wporg-reviewer` (el usuario elige);
- `SPEC.md` §6, la nota de release en la hoja de ruta y el PR #44 listo.

