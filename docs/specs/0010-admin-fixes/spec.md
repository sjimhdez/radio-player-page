# Spec 0010 — Correcciones: admin

> Estado: **propuesta** · Fecha: 2026-10-23 · Rama: `spec/0010-admin-fixes` · Depende de: 0005, 0009
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0017, 0021, 0023, 0028, 0042, 0044 y 0045, `SPEC.md` §3.1 (transients), §3.4 (regla de los callbacks) y §3.6, `.claude/rules/admin.md`, `security.md`, `testing.md` y `php.md`, y las filas de §2 en `docs/known-issues.md`. Su columna «Decisión del usuario» es el mandato, con las precisiones de §4.1.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0010-admin-fixes/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Refactor dirigido, no reescritura** (usuario, 2026-10-23). Se descartó rehacer el editor de franjas de `admin/js/station-admin.js` como estado → render: obligaría a reescribir unos 25 tests de caracterización del DOM (`focusout` de 10 ms, filas ocultas, orden al salir de una fila) y cada fila se arregla con un cambio pequeño. El DOM sigue siendo el estado y PHP sigue pintando las filas guardadas. Primero se unifica lo repetido (§4.2) con los tests de hoy en verde y sin editarlos; después, cada fila con `fix-bug`: su test `currently` pasa a regresión en rojo y luego a verde en todas las capas que cite la fila, y la fila pasa a «corregido (spec 0010)».
5. Ningún test de caracterización se edita para que pase, salvo las excepciones de §4.3. Si cae otro, se para y se pregunta.
6. Fuera de alcance aunque estén cerca: K50 y el resto de los bloques (0013), K19 y K40 (no arreglar), K83 (player), la lógica del horario de la 0009 (el modelo no cambia).

## 1. Contexto y objetivo

El triage de la 0002 (5.7) dejó en el admin una fila alta y una veintena de medias y bajas. La más grave es K15: tras quitar una franja que no es la última y añadir otra, la nueva reutiliza los `name` de una que sigue y al guardar se pierde una franja sin aviso. Las demás son de tres clases:

- **Editor de franjas:** foco perdido al reordenar y al quitar (K39), revalidación sin la vuelta de la semana (K16), mensajes de solape mal montados (K44, K74, K75) y un `TypeError` con un POST hecho a mano (K38).
- **Accesibilidad del horario:** horas y programa sin nombre accesible (AX3, AX4), errores sin semántica ni foco (K45), contraste del error (AX5), «Remove Time Slot» invisible con el foco (K20) y, por reproducir, el meta box contraído con un error.
- **Campos y guardado:** fallos en silencio. Un stream `http` en un sitio `https` (C13), una URL sin esquema que borra también la página (K42), un adjunto rechazado que se guarda como 0 (K37), la página asignada que desaparece del selector (K36) o que es la de entradas (K27), descripciones vacías o sin barras invertidas (K5, K34), «Entrada publicada» junto a un error y dos cadenas sin uso (K76).

Al cerrar la spec, todas las filas de §2 están corregidas con su test de regresión, AX3, AX4 y AX5 salen de la línea base de axe y `SPEC.md` §3.4 y §3.6 recogen los cambios con dos ADRs.

**No objetivos:** rehacer el editor como estado → render; tocar el modelo del horario o la validación (0009); K50 (0013); el logo del programa que no es imagen (no está en K37; sigue guardándose como 0).

## 2. Criterios de aceptación

**Editor de franjas (fase 1)**

- **K15 (alta):** el índice de una franja nueva es el mayor `data-program-index` del día + 1 (0 en un día vacío). `station-fields.test.js` (K15 a regresión) y `admin.spec.ts` (K15 a regresión: 08–09, 10–11 y 12–13 reemisión; quitar 10–11 y añadir 14–15 guarda 08–09, 12–13 reemisión y 14–15 sin reemisión).
- **K16:** al quitar una franja se revalidan el día anterior y el siguiente dando la vuelta a la semana, con la misma función que al salir de una fila (§4.2). `station-fields.test.js` (K16 a regresión).
- **K39:** al pasar con Tab a otra franja del mismo día, el foco sigue en el elemento que lo recibió aunque el día se reordene; al quitar una franja, va al `select` de la franja siguiente del día o, si no hay, a «Add Time Slot» de ese día. `a11y.spec.ts` (los dos `currently` de K39 a regresión, Chromium y WebKit) y un test en `station-fields.test.js`.
- **K44:** los mensajes se montan con un reemplazo por función: «Money $$ Talk» sale tal cual. `schedule-rules.test.js` y `station-validation.test.js` (K44 a regresión).
- **K74:** los solapes entre días usan la reserva «Unnamed Radio Show» (`unnamedProgram`) para un programa sin título. `schedule-rules.test.js` y `station-validation.test.js` (K74 a regresión, las cuatro escrituras).
- **K75:** el solape del mismo día ignora las filas sin programa, como los cruces entre días. `schedule-rules.test.js` y `station-validation.test.js` (K75 a regresión). Los vectores de `validation` de `schedule-vectors.json` siguen en verde en PHP y JS; si uno cambia, se para y se pregunta (el servidor no ve filas sin programa).
- **K38:** `Slot_Validator` comprueba `is_string()` antes de `trim()`; la franja con una hora que no es cadena se descarta como cualquier entrada inválida, sin *warning* ni `TypeError`. `SlotValidatorTest` y `SanitizeScheduleTest` (K38 a regresión).

**Accesibilidad del horario (fase 2)**

- **Meta box contraído (5.7):** primero un e2e en `admin.spec.ts` que contrae el meta box del horario, deja una franja con error y envía. Si el envío se bloquea sin mensaje visible (se confirma), el JS abre el meta box (`.postbox.closed`) antes de llevar el foco al error, y el test pasa a regresión. Si no se reproduce, el test se queda como test normal, se anota «no se reproduce» y no se cambia nada.
- **AX3 + AX4:** cada día es un `fieldset` con su `legend` (el nombre del día, con el mismo aspecto que el `h4` de hoy), y el `select`, las dos horas y la reemisión de cada franja tienen nombre accesible con etiquetas `screen-reader-text` («Radio Show», «Start time», «End time»), en las filas de PHP y en las que añade el JS. Los `name` no cambian. `a11y.spec.ts`: las entradas `label` y `select-name` de «station meta boxes», «added slot» y «validation errors» salen de `a11y-baseline.json`.
- **K45:** el mensaje de error de una franja tiene un `id` estable; el `select` y las horas de la fila reciben `aria-invalid="true"` y `aria-describedby` con ese `id`, y los pierden al limpiar el error. Al enviar con errores, el foco va al primer campo con error (además del `scrollIntoView` de hoy). `station-validation.test.js` (K45 a regresión) y un e2e en `a11y.spec.ts` (el foco tras el envío).
- **AX5:** el mensaje de error y «Remove Time Slot» en *hover* sobre una fila con error usan `#b32d2e`. `a11y.spec.ts`: la entrada `color-contrast` de «validation errors» sale de la línea base.
- **K20:** «Remove Time Slot» es visible y alcanzable cuando la fila tiene el foco (`:focus-within`), como la etiqueta de reemisión. `a11y.spec.ts` (K20 a regresión).

**Campos y guardado (fase 3)**

- **K42:** el cliente exige `http://` o `https://` en la URL del stream con un mensaje propio («Please enter a URL that starts with http:// or https://.», cadena nueva en `admin-strings.php`). En el servidor, la URL y la página se escriben **cada una si es válida**: una que falla conserva su valor guardado y avisa, y no impide escribir la otra (ADR 0048). `station-fields.test.js`, `StationMetaSaverTest`, `SaveStationMetaTest` y `admin.spec.ts` (K42 a regresión).
- **C13:** si el sitio es `https` (esquema de `home_url()`) y la URL del stream es `http`, un aviso no bloqueante junto al campo: «This stream uses http:// and this site uses https://; browsers block it, so it will not play.». Lo pinta PHP al cargar el meta box con la URL guardada (se ve tras guardar) y el JS lo actualiza al escribir. Sin transient nuevo. `AdminScreensTest` (render con y sin `https`), `station-fields.test.js` (en vivo) y `admin.spec.ts` (el test de C13 pasa a esperar el aviso en un sitio `https` simulado o, si el entorno no lo permite, sin aviso en `http`, más el de integración).
- **K37:** el selector del audio de bienvenida solo ofrece `audio/mpeg`. Si el guardado rechaza un adjunto (fondo o logo que no es imagen, bienvenida que no es `audio/mpeg`), **conserva el valor guardado** de esa meta y lo avisa en el transient de errores de campos, con un mensaje por adjunto. Nunca 0 en silencio (ADR 0048). `FieldSanitizerTest` (los dos `currently` a regresión), `SaveStationMetaTest` (`currently` a regresión) y `program-admin.test.js` (el tipo del selector).
- **K36:** el selector de «Player Page» lista la página asignada aunque no esté publicada, con su estado entre paréntesis (como los programas, ADR 0045) y un aviso: «This page is not published; the player is not shown until it is.». `AdminScreensTest` (K36 a regresión).
- **K27:** el selector excluye la página de entradas (`page_for_posts`) salvo que sea la asignada; entonces sale con el aviso «This page is the posts page; the player is not shown on it.». `AdminScreensTest`.
- **K5 + K34:** la descripción y la extendida del programa se cortan por caracteres (`mb_substr`, 256 y 512) y nunca dejan UTF-8 inválido; las barras invertidas se conservan (`wp_slash()` antes de `update_post_meta()`). `Program\FieldSanitizerTest` y `SaveProgramMetaTest` (los `currently` de K5 y K34 a regresión).
- **«Entrada publicada» con error (5.7):** si el guardado de la emisora deja un transient de errores (campos u horario), la redirección quita el mensaje de core («Post published.» / «Post updated.»); la emisora se sigue publicando (§3.1, §3.6). Callback nuevo enganchado a `redirect_post_location` (ADR 0048). `SaveStationMetaTest` o un test de integración nuevo, `HooksTest` y `admin.spec.ts` (el aviso del servidor sin el de core).
- **K76:** `completeTimeFields` y `startEndSame` salen de `radplapag_get_admin_strings()`; el ADR 0047 declara interno el contenido de `radplapagAdmin`. `AdminScreensTest::test_admin_strings_keys` (excepción de §4.3).

**Cierre**

- Las filas pasan a «corregido (spec 0010)» (o «no se reproduce» la del meta box contraído); `SPEC.md` §3.4, §3.6 y §6 con los ADRs de §3; en la hoja de ruta, la nota de la release con lo visible de esta spec.
- `npm run check`, integración y e2e en las dos puntas (WP 6.6 + PHP 7.4 y última + 8.4), cobertura de la CI (JS de admin ≥ 85 %, PHP crítico y núcleo sin bajar) y `check:zip` en verde.

## 3. Cambios al contrato (`SPEC.md`)

| Cambio | Sección | ADR previsto | Fase |
|---|---|---|---|
| El contenido de `radplapagAdmin` (claves de `strings`, `programs`, `assignedPlayerPages`) es interno, como `window.radplapagScheduleRules`. Se quitan `completeTimeFields` y `startEndSame`, y entran las cadenas nuevas. `radplapag_get_admin_strings()` conserva su firma; lo que devuelve no es contrato (K76) | §3.6 | 0047 «El contenido de `radplapagAdmin` es interno» | 3 |
| Guardado de la emisora: la URL y la página se escriben cada una si es válida (K42); un adjunto rechazado conserva el valor guardado y avisa en `radplapag_station_field_errors_<id>` (K37); con errores, la redirección no lleva el mensaje de core, con un callback nuevo en `redirect_post_location` (5.7) | §3.4, §3.6 | 0048 «Guardado de la emisora: cada campo por separado y sin fallos en silencio» | 3 |

No cambian las meta keys, las opciones, los transients (los avisos de K37 van en el de errores de campos, que ya existe), los `name` del formulario, los handles ni el formato del horario. El markup de los meta boxes no es contrato (§3.6 solo fija los `name`): AX3, AX4 y K45 añaden elementos y atributos sin quitar las clases que usa el JS.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | Refactor dirigido de `station-admin.js` (§0.4 y §4.2). Sin build y en ES2019 (`admin.md`) | usuario, 2026-10-23 |
| D2 | K15: `nextIndex( dayWrapper )` = mayor `data-program-index` de las filas del día + 1. PHP ya pinta `data-program-index` con el índice guardado (`test_schedule_box_sorts_slots_by_start_keeping_indexes`) | K15 |
| D3 | K39: tras reordenar, si el elemento activo estaba en el día, se le devuelve el foco (`focus( { preventScroll: true } )`). Al quitar: el `select` de la fila que ocupaba el lugar siguiente, o «Add Time Slot» del día | K39 |
| D4 | AX3/AX4: `fieldset` + `legend` por día y `label.screen-reader-text` con `for`/`id` por campo; `id` = `radplapag-slot-{día}-{índice}-{campo}` (único tras K15). El mensaje de error de K45, `radplapag-slot-{día}-{índice}-error`. Las cadenas, en PHP con `esc_html_e()` y en el JS desde `radplapagAdmin.strings` | AX3, AX4, K45 |
| D5 | K42 en el cliente: `new URL()` y además `protocol` `http:` o `https:`; el test «accepts any URL scheme `new URL()` parses» cambia por diseño (§4.3) | K42 |
| D6 | C13: el esquema del sitio sale de `home_url()`. PHP lo deja en un atributo `data-site-scheme` del contenedor del campo, que el JS lee; sin clave nueva en `radplapagAdmin` | usuario, 2026-10-23 |
| D7 | K37: `Station\Field_Sanitizer` devuelve un código de error por adjunto rechazado (`background_not_image`, `logo_not_image`, `intro_not_mp3`) y el valor `null` para «no escribir»; `Station_Meta_Saver` no escribe esa meta y añade el mensaje al transient. Un `0` enviado (quitar el adjunto) se sigue escribiendo | usuario, 2026-10-23 |
| D8 | K42 en el servidor: con `stream_url_required`, no se escribe la URL; con `player_page_required` o la página ocupada, no se escribe la página; el resto igual. El orden de los mensajes del transient no cambia | K42 |
| D9 | «Entrada publicada»: `radplapag_station_redirect_without_message( $location, $post_id )` en `redirect_post_location` (10, 2). Si el post es una emisora y hay transient de errores de campos u horario, `remove_query_arg( 'message', $location )` | 5.7 |
| D10 | K5: `mb_substr` (WordPress trae su reserva si falta mbstring). Los límites siguen siendo 256 y 512, ahora en caracteres | K5 |

### 4.2 Qué se unifica en `station-admin.js` (antes de las correcciones, sin cambiar comportamiento)

- Una función `revalidateDay( scheduleWrapper, day, options )` (el día) y una `revalidateAround( scheduleWrapper, day, options )` (sus vecinos, con la vuelta de la semana). La usan la salida de una fila y el borrado; las dos copias de hoy (`revalidateAdjacentDays()` y el bloque del borrado, que no da la vuelta) desaparecen. El borrado conserva su comportamiento de hoy hasta K16 (sin la vuelta), así que este paso deja la diferencia en un parámetro que K16 quita.
- `nextIndex( dayWrapper )` (comportamiento de hoy hasta K15).
- `setRowError( row, message )` / `clearRowError( row )` como único punto de pintado del error (donde entran el `id` y el ARIA de K45).
- La lista de días, una sola vez (hoy hay tres: `dayMap`, `prevDayMap` y el array del borrado).

### 4.3 Tests

- **Excepciones a «no editar caracterización»** (por diseño, con su ADR o su fila):
  - `tests/fixtures/admin/station-meta-box.html`: se regenera con `RADPLAPAG_UPDATE_SNAPSHOTS=1` en las fases 2 y 3 (AX3, AX4, K36, K27, C13), con el diff en el plan;
  - `tests/e2e/a11y-baseline.json`: salen las entradas de AX3, AX4 y AX5 (fase 2);
  - `station-fields.test.js` «accepts any URL scheme `new URL()` parses» (K42, D5);
  - `SaveStationMetaTest::test_invalid_attachments_become_zero` y `StationMetaSaverTest::test_wrong_attachments_go_to_zero` (K37, D7); `SaveStationMetaTest::test_writes_order_with_field_errors_and_valid_schedule` y los que fijen «con un error de campo no se escribe ni la URL ni la página» (K42, D8). El plan los lista;
  - `SaveProgramMetaTest::test_truncation_counts_bytes_not_characters` (K5, D10);
  - `AdminScreensTest::test_admin_strings_keys` (K76) y `HooksTest` (el callback de D9).
- Fase 1 empieza por §4.2 con los tests de hoy como red; cada paso, en verde sin editarlos.
- Los adaptadores se prueban con happy-dom sobre la fixture real (`mount-station-screen.js`); el foco, la visibilidad con `:focus-within` y el contraste solo con e2e (Chromium y WebKit).
- C13 en e2e: el entorno es `http`. Si no se puede simular `https` sin tocar el entorno, el e2e comprueba que no hay aviso en `http` y el caso `https` lo cubren `AdminScreensTest` (filtro de `home_url`) y Vitest.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Sin spike: no hay riesgo técnico sin resolver.

### Fase 1 — Editor de franjas (K15 alta; K16, K39, K44, K74, K75 y K38)

- §4.2 primero, sin cambiar comportamiento. Después K15, K16 y K39 en `station-admin.js`; K44, K74 y K75 en `schedule-rules.js`; K38 en `Slot_Validator`.
- ✅ **Criterios:** los del editor de franjas de §2.

### Fase 2 — Accesibilidad del horario (K45, AX3, AX4, AX5, K20 y el meta box contraído)

- Primera tarea: el e2e del meta box contraído (se confirma o se cierra). Después AX3 + AX4 (PHP y JS, D4), K45, AX5 y K20. La fixture y la línea base se actualizan aquí.
- ✅ **Criterios:** los de accesibilidad del horario de §2; `a11y-reviewer` en `close-phase`.

### Fase 3 — Campos y guardado (C13, K42, K37, K36, K27, K5, K34, «Entrada publicada» y K76)

- ADRs 0047 y 0048 primero (con `SPEC.md` §3.4 y §3.6). Después K42 y K37 (núcleo + saver), C13, K36 y K27 (meta box de detalles), K5 y K34 (programa), D9 y K76.
- Cierre de la spec: `SPEC.md` §6, la nota de la release en la hoja de ruta (changelog: K15, K42, K37, C13, «Entrada publicada»; `== Upgrade Notice ==`: K37 conserva el adjunto anterior), PR listo.
- ✅ **Criterios:** los de campos y guardado y de cierre de §2; `wp-security-reviewer` y `wporg-reviewer` en `close-phase`.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Unificar la revalidación cambia sin querer qué filas se marcan (el orden de las escrituras importa) | §4.2 sin cambio de comportamiento, con los ~110 tests del DOM sin editar; K16 va en su propio commit | Fase 1 |
| 2 | Devolver el foco tras reordenar con Tab se comporta distinto en WebKit (Safari no enfoca enlaces con Tab por defecto) | Los e2e de K39 ya corren en Chromium y WebKit; si WebKit difiere, se para y se pregunta | Fase 1 |
| 3 | `fieldset`/`legend` cambia el aspecto del día | CSS para conservar el del `h4`; captura antes y después en el plan | Fase 2 |
| 4 | K75 cambia un vector de `validation` compartido con PHP | El servidor descarta las filas sin programa antes de comparar; si un vector cambia, se para y se pregunta | Fase 1 |
| 5 | Un tercero lee `radplapagAdmin.strings.startEndSame` | Nada en wordpress.org lo documenta; va en el ADR 0047 y en el changelog | Fase 3 |
| 6 | K42: escribir la página con la URL inválida deja una emisora con página y sin URL | Ya podía pasar (una emisora nueva queda publicada sin URL); el aviso lo dice y el player no se sirve sin URL (§3.3) — se comprueba en el plan | Fase 3 |

## Apéndice — Referencias

- Filas: K15, K16, K39, K44, K74, K75, K38, K45, AX3, AX4, AX5, K20, C13, K42, K37, K36, K27, K5, K34 y K76 de `docs/known-issues.md`; las sospechas de 5.7 en `docs/specs/0002-safety-net/phase-5.md` (línea de «Entrada publicada»).
- Código: `admin/js/station-admin.js`, `admin/js/schedule-rules.js`, `admin/js/program-admin.js`, `admin/css/admin.css`, `admin/admin-strings.php`, `admin/admin.php`, `includes/radplapag-station-cpt.php`, `includes/radplapag-program-cpt.php`, `includes/src/station/class-field-sanitizer.php`, `includes/src/wp/class-station-meta-saver.php`, `includes/src/program/class-field-sanitizer.php`, `includes/src/wp/class-program-meta-saver.php`, `includes/src/schedule/class-slot-validator.php`.
- Tests: `tests/js/admin/` (con `support/mount-station-screen.js` y la fixture `tests/fixtures/admin/station-meta-box.html`), `tests/php/{unit,integration}/{Station,Program,Schedule,Admin,Cpt}/`, `tests/e2e/admin.spec.ts`, `tests/e2e/a11y.spec.ts` y `a11y-baseline.json`.
