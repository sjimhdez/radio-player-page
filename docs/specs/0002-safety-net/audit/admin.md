# Auditoría · zona 3, admin PHP + JS

Spec 0002, fase 4, tarea 4.4 · 2026-10-18 · código auditado: 3.4.2 (sin cambios).

**Alcance:** `admin/admin.php`, `admin/admin-strings.php`, `admin/js/station-admin.js`, `admin/js/program-admin.js`, `admin/css/admin.css`, y de `includes/radplapag-station-cpt.php` e `includes/radplapag-program-cpt.php` los meta boxes, el guardado, el saneado (`radplapag_sanitize_station_schedule()`), los avisos de validación y los datos de los selectores. El registro de los CPT, la meta y las capacidades es de la zona 1 (`core.md`).

**Resultado:** 12 hallazgos confirmados (K34–K45) y una fila `axe` nueva (AX5); variantes de AX2–AX4 en los dos escenarios nuevos de axe y un matiz de K31. Cuatro de gravedad media (K39, K41, K42, K45). Los dos huecos del ADR 0023 de esta zona quedan cerrados con e2e. 31 candidatos descartados. No se ha tocado código publicado.

## 1. Herramientas estáticas

| Herramienta | Salida |
|---|---|
| PHPCS (`vendor/bin/phpcs -q` sobre la zona) | limpio. Cuatro supresiones, todas con motivo en la línea: `UnusedFunctionParameter` en `radplapag_admin_scripts()` y en los dos filtros `user_has_cap` (firmas fijas), e `InputNotSanitized` del horario (lo sanea `radplapag_sanitize_station_schedule()`). |
| PHPStan nivel 8 (entradas de la baseline de la zona) | 32 entradas. 17 son `missingType.iterableValue` (ruido de tipos). `isset( $screen->id )` en `admin.php:25-26` → ruido: `WP_Screen::$id` siempre existe. `esc_attr( int )` (seis) → ruido: `esc_attr()` convierte a cadena. Las comprobaciones redundantes del saneador (`isset` de claves que existen, `is_array`/`is_string` siempre ciertos, `> 0` siempre cierto, `&&` siempre cierto) → ruido: el código revalida lo que ya validó. `foreach` sobre `array<WP_Post>\|false` (`get_pages()`) → ruido: `page` es jerárquico y `get_pages()` solo devuelve `false` con un tipo no jerárquico. Ninguna es un bug. |
| ESLint de la raíz (`npx eslint admin/js`) | limpio. |
| `.claude/rules/security.md` | entrada: nonce verificado antes de leer nada (`radplapag_station_meta` / `radplapag_program_meta`), `manage_options`, `DOING_AUTOSAVE`; `wp_unslash` + `esc_url_raw`/`absint`/`sanitize_key`/`sanitize_text_field`/`sanitize_textarea_field`, listas blancas de tema y visualizador, adjuntos comprobados (imagen, `audio/mpeg`), horario por el saneador del servidor. Salida: meta boxes con `esc_attr`/`esc_html`/`esc_url`/`esc_textarea`; avisos con `esc_html`; datos del JS por `wp_localize_script()`. Transients de error a 45 s. Hallazgos: K38 (entrada no escalar en el horario). |
| `.claude/rules/wordpress-org.md` | prefijos completos (global JS `radplapagAdmin`, handles, nonces, transients, clases CSS); assets solo en las pantallas de edición de los dos CPT; avisos solo en la pantalla de la emisora, con `is-dismissible`, una vez; sin peticiones salientes ni librerías de core empaquetadas; `translators` en todos los `sprintf`. Hallazgos de i18n como mejoras (descartes). |
| `.claude/rules/admin.md` | la regla «el JS nunca tiene textos visibles en inglés escritos a mano» se cumple a medias: los textos de reserva solo salen sin `radplapagAdmin`, y algunos no coinciden con la cadena traducida (descarte, para la spec 0005). |

Plugin Check, `composer audit`, `npm audit` y licencias: en verde en la CI del PR #37; nada de la zona.

## 2. Revisores lanzados

Los cuatro del plan, con contexto limpio y la lista de archivos de arriba:

- **`wp-security-reviewer`**: nada explotable sin `manage_options`. Propuso K38, K34, K35, `player_page` sin validar como página, los transients por post y no por usuario, el HTML construido a mano en `innerHTML` (endurecimiento) y que el guardado no compare `$post_id` con `post_ID`. Mencionó K37 como asunto de experiencia.
- **`wporg-reviewer`**: nada que rechazara la revisión. Propuso las traducciones metidas en `innerHTML` sin escapar, K40, la concatenación del mensaje de solape, «to» y «Rerun» sin contexto, 18 cadenas sin uso, los textos de reserva que no coinciden, los marcos de `wp.media` sin título propio, la carga redundante de assets, el *placeholder* con un dominio real y los avisos contradictorios («Entrada publicada» junto al error).
- **`a11y-reviewer`**: qué haría axe en los dos huecos (abajo), K39 (las dos variantes), K45, los errores de los campos de la emisora, los avisos del servidor, el contraste de AX5 (también en *hover*), «Remove» como enlace, el asterisco sin explicar, los bloques de imagen y audio sin grupo, `alt=""` en la vista previa, la falta de agrupación por día, «Add Time Slot» sin mover el foco y el `scrollIntoView` suave.
- **Code review a esfuerzo alto** (subagente general, sin `--fix`): la lógica de solapes del cliente equivale a la del servidor en todo lo probado salvo C3. Propuso K41, K36, K42, el meta box contraído que bloquea el envío sin mensaje, K37, K43 (y que `a < b and c > d` se guardaba como `a d`: **medido, no se reproduce**), K44, `:has()` sin soporte, K38, el horario editado que se pierde si el servidor lo rechaza, y como menores: programas sin título en las filas nuevas, el horario sin validar si fallan los campos, «Please enter a valid URL.» inalcanzable al enviar y la variante de la papelera (K35).

## 3. Contraste

**`SPEC.md` §3.6 (y §3.1):**

- Menú «RPP» con emisoras y programas: se cumple. El enlace del menú lleva a la lista; `admin.php?page=radplapag` directo no redirige (K40).
- Meta boxes con sus nonces: se cumple.
- Validación en el cliente y en el servidor, errores del servidor como avisos tras guardar: se cumple. La lógica de solapes coincide en los dos lados salvo C3. Las discrepancias nuevas vienen de los datos y del saneado, no de la lógica: K41 (programas que el cliente no lista), K36 (páginas que el cliente no lista) y K42 (URL que el cliente acepta y `esc_url_raw()` vacía).
- Páginas asignadas a otra emisora desactivadas en el selector: se cumple, salvo las de emisoras en la papelera (K35).
- Cadenas del JS en `admin-strings.php`, localizadas como `radplapagAdmin`: se cumple; 18 claves no las usa nadie (descarte).
- §3.1, «si falla [el horario], no se guarda y queda el aviso»: se cumple, y el formulario vuelve con el horario anterior (las ediciones se pierden; descarte, es el contrato).

**Filas de `known-issues.md` de la zona** (todas siguen; sus tests `currently` pasan en esta ejecución):

- **C3, C13, K5, K15, K16, K19, K20:** siguen, sin variantes nuevas.
- **C10:** sigue. K41 es otro caso (programa no listable que bloquea el guardado), no una variante: C10 trata los borradores aceptados sin aviso.
- **AX2, AX3, AX4:** siguen, y se repiten en los dos escenarios nuevos (abajo). Anotado en sus filas.
- **K31 (zona 2):** decía «el editor no lo hace»; vale para el título, no para la meta del programa (K34). Anotado en su fila.

### Huecos del ADR 0023 de esta zona

Cerrados con dos escenarios en `tests/e2e/a11y.spec.ts`, sobre los mismos contenedores que el escenario base (`#radplapag_station_details`, `#radplapag_station_schedule`):

- **`station meta boxes · added slot`**: «Add Time Slot» en el jueves (sin franjas) y axe. Sale lo mismo que en la base (AX2, AX3, AX4) con más nodos, la fila nueva incluida. Ninguna regla nueva.
- **`station meta boxes · validation errors`**: una franja que se solapa, con su error a la vista al salir de la fila, y la URL vacía con su error tras «Publicar» (el envío se bloquea). Sale AX2–AX4 y una regla nueva: `color-contrast` del mensaje de error de la franja (AX5).
- Con un nombre de página nuevo, cada violación es una clave nueva de la línea base. **Decisión del usuario (2026-10-18): añadirlas** con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`, solo esos dos escenarios: 52 entradas, todas en Chromium y WebKit, ninguna baja. Apuntada en `phase-4.md`.
- Los avisos del servidor tras guardar quedan fuera: core los coloca fuera de los contenedores analizados, y su marcado no tiene nada que axe detecte (lo que les falta, que se lleven a los campos, no lo ve axe).
- Lo que axe no ve se fija aparte: K39 (foco) y K45 (semántica de los errores).

## 4. Hallazgos confirmados

| Fila | Qué | Cómo se confirma |
|---|---|---|
| K34 | Las barras invertidas de la meta del programa se pierden al guardar | integración `SaveProgramMetaTest::test_currently_descriptions_lose_backslashes` |
| K35 | Restaurar una emisora de la papelera deja dos emisoras publicadas en la misma página | integración `AdminScreensTest::test_currently_restoring_a_trashed_station_shares_its_page` |
| K36 | La página asignada que deja de estar publicada desaparece del selector | integración `AdminScreensTest::test_currently_details_box_drops_an_assigned_page_that_is_not_published` |
| K37 | Un audio de bienvenida que no es MP3 se descarta sin aviso | integración `SaveStationMetaTest::test_currently_non_mp3_welcome_audio_is_dropped_without_notice` |
| K38 | `trim()` de un array en el saneador del horario (`TypeError` en PHP 8) | integración `SanitizeScheduleTest::test_currently_array_time_reaches_trim` |
| K39 | El foco del teclado se pierde al pasar de una franja a otra y al quitar una franja | e2e `a11y.spec.ts` (dos tests `currently … (K39)`), Chromium y WebKit |
| K40 | `admin.php?page=radplapag` no redirige y deja la pantalla vacía | e2e `admin.spec.ts` (`currently does not redirect … (K40)`) + reproducción 1 |
| K41 | Una franja con un programa en la papelera (o privado, pendiente, programado) bloquea el guardado de la emisora | integración `AdminScreensTest::test_currently_schedule_box_empties_a_slot_whose_program_is_trashed` |
| K42 | Una URL sin esquema con puerto pasa el cliente y el servidor la da por vacía (y no guarda la página) | e2e `admin.spec.ts` (`currently reports a stream URL without a scheme as missing (K42)`), Chromium y WebKit |
| K43 | `<3` se guarda como `&lt;3` y el player lo muestra literal | integración `SaveProgramMetaTest::test_currently_less_than_is_stored_as_an_entity`; el player por lectura |
| K44 | `$$` en el nombre de un programa sale como `$` en los mensajes de solape | Vitest `station-validation.test.js` (`currently collapses \`$$\` … (K44)`) |
| K45 | Los errores de franja no tienen `role`, `aria-live`, `aria-invalid` ni `aria-describedby` | Vitest `station-validation.test.js` (`currently shows a slot error without any ARIA (K45)`) |
| AX5 | `color-contrast` del mensaje de error de la franja (≈ 4,3:1) | e2e `a11y.spec.ts` + `a11y-baseline.json` (`station meta boxes · validation errors · color-contrast · …`) |

**Mutación de comprobación**, temporal y revertida (`git checkout -- admin includes`; `git status` limpio sobre el código), en tres tandas:

1. Integración: `wp_slash()` en los dos `update_post_meta()` del programa, la papelera en los estados de `radplapag_get_player_pages_assigned_to_other_stations()`, `get_pages( 'publish,private' )`, un error de campo cuando el audio no es MP3 e `is_string()` antes del `trim()` de `start` → los cinco en rojo.
2. `if ( false && dayProgramsList )` (sin reordenar al salir de la fila), `.replace( '%s', () => … )`, el redirect enganchado a `load-toplevel_page_radplapag`, `esc_url_raw( 'http://' . … )`, la papelera en `radplapag_get_all_programs_for_select()` y `wp_strip_all_tags` en la descripción del programa → los seis en rojo (los e2e, en Chromium y WebKit).
3. El foco a «Add Time Slot» tras quitar una franja y `role="alert"` en el mensaje de la franja → los dos en rojo.

### Reproducciones

1. **K40.** En el entorno de tests (`npm run env:start:latest`), sin escribir nada en el repo: iniciar sesión con `curl` (`admin` / `password`) y pedir `GET /wp-admin/admin.php?page=radplapag`. Respuesta: 200, sin `Location`, dos *warnings* «Cannot modify header information - headers already sent by (output started at wp-admin/includes/template.php:2668) in wp-includes/pluggable.php on line 1539» (y 1542), y la pantalla del admin sin contenido tras el menú. En `index.php`, el enlace de «RPP» es `edit.php?post_type=radplapag_station`: desde el menú no se llega.

## 5. Descartados

- `player_page` sin validar como página publicada (un POST hecho a mano guarda cualquier ID; `absint()` de un array da 1): solo con el nonce de un administrador; el selector solo ofrece páginas publicadas.
- Transients de error por post y no por usuario: dos administradores con la misma emisora en 45 s; mismo nivel de privilegio y sin datos sensibles.
- HTML construido a mano en `innerHTML` (traducciones sin escapar, `&` sin escapar en el nombre del programa, URL del adjunto en `.html()`): sin vía de ataque con WordPress tal cual. Endurecimiento para la spec 0005 (refactor del admin).
- El guardado no compara `$post_id` con `post_ID`: no hay ningún caso en core.
- «Entrada publicada» junto al aviso de error, y la emisora publicada aunque fallen los campos: es el contrato (§3.1, §3.6); sospecha de experiencia para el triage.
- El horario editado se pierde si el servidor lo rechaza: es el contrato (§3.1) y solo se alcanza sin JavaScript o con un programa borrado entre cargar y guardar.
- Meta box contraído con un error dentro: el envío se bloquearía sin mensaje visible. No reproducido; sospecha de experiencia para el triage.
- `:has()` sin soporte invalida la regla de «Rerun»: los navegadores que soporta WP 6.6, incluido el Firefox ESR actual, tienen `:has()`.
- Las filas añadidas por JS omiten los programas sin título y las de PHP no: un programa sin título es artificial.
- Si fallan los campos de la emisora, el horario no se valida en ese envío: fijado (`does not validate the schedule while a station field is invalid`); los errores salen en el siguiente.
- «Please enter a valid URL.» no se alcanza al enviar (la validación nativa de `type="url"` va antes): mismo patrón que K19, inocuo.
- `a < b and c > d` se guarda como `a d`: medido, no se reproduce (se guarda tal cual).
- Variante táctil de K20 («Rerun» y «Remove» dependen de `:hover`): no probado en táctil.
- i18n: mensaje de solape por concatenación, «to» y «Rerun» sin contexto, 18 cadenas sin uso, textos de reserva que no coinciden: mejoras para la spec 0005, sin bug visible con las traducciones actuales.
- Marcos de `wp.media` sin título propio: salen los textos de core, ya traducidos.
- Carga redundante de assets y versión `'3.4.2'` escrita a mano: sin efecto doble; la versión la sube la skill `release`.
- *Placeholder* `https://my.station.com:8000/stream`: inocuo.
- Errores de los campos de la emisora sin `aria-invalid` ni `aria-describedby`, texto genérico y `role="alert"` con `aria-live="polite"`: sí se anuncian (región viva); mejora para la spec 0005, junto a K45.
- Los avisos del servidor no llevan el error al campo: experiencia, no incumplimiento medido.
- Contraste de «Remove Time Slot» en *hover* sobre una fila con error: es AX5 (anotado en su fila); axe no analiza el *hover*.
- «Remove Time Slot» es un `<a href="#">` con el mismo nombre en todas las franjas: mejora (4.1.2/2.4.6) para la spec 0005.
- Asterisco de obligatorio sin explicar ni `aria-required`: mejora para la spec 0005.
- Bloques de imagen y audio sin grupo y con botones del mismo nombre: mejora para la spec 0005.
- Vista previa con `alt=""`: discutible (la imagen es decorativa en el formulario).
- Sin agrupación por día (`fieldset`): se hará con AX3/AX4.
- «Add Time Slot» no mueve el foco a la fila nueva: mejora; 2.4.3 se cumple.
- `scrollIntoView` suave sin `prefers-reduced-motion`: 2.3.3 es AAA.
- Clave de la línea base de axe sensible al DOM (los selectores cambian al añadir filas): es el diseño del ADR 0023; los dos escenarios llevan su propio nombre de página.
- `isset( $screen->id )`, `esc_attr( int )`, `foreach` sobre `get_pages()` y las comprobaciones redundantes del saneador (PHPStan): ruido.
- Registro de los CPT, meta y capacidades: zona 1 (`core.md`).
- Cadena `pleaseSelectProgram` usada para «elige» y «programa no válido»: inocuo, el usuario corrige igual.
