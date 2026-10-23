# Spec 0010 · Fase 2 — Accesibilidad del horario
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0017, 0021, 0023, 0028 (sin ADR nuevo en esta fase)

## Contexto
- La fase 1 está cerrada y no deja nada pendiente. `setRowError()`/`clearRowError()` (`admin/js/station-admin.js`) ya son el único punto de pintado del error, y ahí entran el `id` y el ARIA de K45.
- Meta box (`radplapag_render_station_schedule_meta_box()`, `includes/radplapag-station-cpt.php:445`): cada día es un `div.radplapag-schedule-day[data-day]` con un `h4` de estilo en línea (`margin: 10px 0 5px 0; font-size: 13px; font-weight: 600`). El `select` y las dos horas no tienen nombre accesible. La reemisión ya tiene uno porque su `label` la envuelve. El JS (`buildProgramRow()`) pinta las filas nuevas con la misma forma.
- **AX2 (decisión del usuario, 2026-10-23):** el `legend` sustituye al `h4`, así que en esta fase también sale el `heading-order` del meta box, que era de AX2. Las tres entradas de `heading-order` de «station meta boxes» salen de la línea base. La fila AX2 se reduce a los modales del player (0011). Entra en la spec como D11.
- **Cadenas (decisión del usuario, 2026-10-23):** `AdminScreensTest::test_admin_strings_keys` fija la lista exacta de claves (`STRING_KEYS`). En esta fase se **añaden** tres: `programLabel`, `startTimeLabel` y `endTimeLabel`. Es una excepción a §4.3 adelantada desde K76, y §4.3 se actualiza en el commit del plan.
- La línea base de axe (`tests/e2e/a11y-baseline.json`) tiene, en las tres escenas «station meta boxes» (sin errores, «added slot» y «validation errors»), las reglas `label`, `select-name` y `heading-order`, más `color-contrast` en «validation errors».
- La fixture `tests/fixtures/admin/station-meta-box.html` la escribe `AdminScreensTest::test_station_meta_box_fixture`. No lleva el envoltorio `.postbox`, así que el meta box contraído se prueba en e2e (y en Vitest, envolviendo a mano).
- Un meta box contraído (`.postbox.closed`) oculta su `.inside`, pero `getComputedStyle( row ).display` de cada fila no es `none`. La validación del cliente marca la fila y bloquea el envío, el `scrollIntoView` no tiene efecto y el error no se ve. Esto es lo que espero; la tarea 2.1 lo confirma o lo descarta.
- K20: `.radplapag-schedule-remove-cell` tiene `opacity: 0` salvo con `:hover`. AX5: `#dc3232` sobre `#fff5f5`.
- La siguiente fila libre de `docs/known-issues.md` es K89.

## Objetivo
Corregir K45, AX3, AX4, AX5 y K20 con su test de regresión y confirmar o descartar el bug del meta box contraído. Las entradas `label`, `select-name`, `heading-order` (la parte del meta box de AX2) y `color-contrast` de «station meta boxes» salen de la línea base de axe.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| Meta box contraído: se confirma (y se corrige abriendo el meta box) o se cierra como «no se reproduce» | `admin.spec.ts` (2.1 `currently` → regresión en 2.5, o test normal) |
| AX3 + AX4: `fieldset` + `legend` por día (con el aspecto del `h4`); `select`, inicio y fin con `label.screen-reader-text` (`for`/`id` = `radplapag-slot-{día}-{índice}-{campo}`), en las filas de PHP y en las del JS; los `name` no cambian | `AdminScreensTest` (markup nuevo), `station-fields.test.js` (fila añadida), `a11y.spec.ts`: sin entradas `label`, `select-name` ni `heading-order` de «station meta boxes» en `a11y-baseline.json`; capturas antes y después (riesgo 3) |
| K45: el mensaje tiene `id` `radplapag-slot-{día}-{índice}-error`; el `select` y las horas llevan `aria-invalid="true"` y `aria-describedby`, y los pierden al limpiar el error; al enviar, el foco va al primer campo con error | `station-validation.test.js` (K45 a regresión + limpieza + foco), `a11y.spec.ts` (foco tras el envío, Chromium y WebKit) |
| AX5: el mensaje de error y «Remove Time Slot» en *hover* usan `#b32d2e` | `a11y.spec.ts`: sale la entrada `color-contrast` de «validation errors», más un test del color en *hover* |
| K20: «Remove Time Slot» es visible con el foco en la fila (`:focus-within`) | `a11y.spec.ts` (K20 a regresión, Chromium y WebKit) |
| Ningún test de caracterización se edita, salvo las excepciones de §4.3 (fixture, línea base, `STRING_KEYS`) | diff de cada commit |

## Tareas

### 2.1 El meta box contraído, en e2e (≤ 1 h) — caracterización
- Qué: un test en `admin.spec.ts` («client») que añade una franja que se solapa, contrae el meta box del horario con su botón (`#radplapag_station_schedule .handlediv`) y pulsa «Publicar» con `watchSubmit()`. Comprueba que el envío se bloquea, que la fila tiene el error y que el mensaje no está visible (`toBeHidden`). Si se confirma: test `currently blocks the submit without a visible message when the schedule box is collapsed (K89)` y fila K89 en `known-issues.md` (prioridad baja, «corregir: 0010 admin»). Si no se reproduce: el test queda como test normal y se anota «no se reproduce» en la spec y en el plan (2.5 se cancela). Limpieza: `afterEach` borra con `wpCli` la meta de usuario `closedpostboxes_radplapag_station`, porque WordPress guarda el estado contraído por AJAX.
- Archivos: `tests/e2e/admin.spec.ts`, `docs/known-issues.md`
- Test: caracterización (`admin.spec.ts`).
- Verificación: `npx playwright test tests/e2e/admin.spec.ts -g "collapsed"`
- Se confirma (Chromium y WebKit): el envío se bloquea, la fila tiene el error y el mensaje no se ve; el meta box sigue contraído. K89, baja. La 2.5 sigue en pie. Mutación: con `toBeVisible` el test falla (`Received: hidden`).
- [x] hecha · commit: ver `git log` («test(0010): pin the submit blocked by a collapsed schedule box (2.1)»)

### 2.2 AX3 + AX4 en PHP: `fieldset`/`legend` y etiquetas (≤ 1 h) — `fix-bug`
- Qué: `div.radplapag-schedule-day` pasa a `fieldset.radplapag-schedule-day[data-day]` (misma clase y mismo `data-day`, así que el JS y los selectores de los tests siguen valiendo). El `h4` pasa a `legend.radplapag-schedule-day-legend`. En `admin.css`, el `fieldset` sin borde, *padding*, margen ni `min-width`, y el `legend` con el aspecto del `h4` de hoy. Antes del `select` y de cada hora va un `label.screen-reader-text` con `esc_html_e()`: «Radio Show», «Start time» y «End time». El `id` de cada campo es `radplapag-slot-{día}-{índice}-{program|start|end}`. Se regenera la fixture y la línea base de las escenas del servidor. Capturas del meta box antes y después (Playwright, Chromium) para el riesgo 3.
- Archivos: `includes/radplapag-station-cpt.php`, `admin/css/admin.css`, `tests/php/integration/Admin/AdminScreensTest.php`, `tests/fixtures/admin/station-meta-box.html` (regenerada, con su diff aquí), `tests/e2e/a11y-baseline.json`, `docs/known-issues.md` (AX2 reducida a los modales)
- Test: primero `AdminScreensTest::test_schedule_box_names_each_slot_field` (rojo: sin `fieldset`, sin `label for`).
- Verificación: `npm run test:php:integration -- --filter AdminScreensTest && RADPLAPAG_UPDATE_SNAPSHOTS=1 npm run test:php:integration -- --filter test_station_meta_box_fixture && npm test && npx playwright test tests/e2e/a11y.spec.ts -g "meta boxes"`. Las entradas `label`, `select-name` y `heading-order` de «station meta boxes» (escena del servidor) salen con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`, pasando los dos proyectos.
- Rojo: `Failed asserting that 0 is identical to 7` (ningún `fieldset` con su `legend`).
- El `id` va al final de cada etiqueta: `test_schedule_box_keeps_a_slot_whose_program_is_trashed` fija `name="…[start]" value="07:00"` seguidos y el ayudante `select()` busca `<select name=`, y no se editan.
- La variable de entorno no llega al contenedor con `npm run`: la fixture se regenera con el comando de `tests/php/integration/Support/Snapshot.php` (`npx wp-env … run cli … env … RADPLAPAG_UPDATE_SNAPSHOTS=1 vendor/bin/phpunit …`). Su diff: `div`/`h4` → `fieldset`/`legend` en los siete días y, en cada fila, los tres `label.screen-reader-text` y los `id`; nada más.
- Aspecto: un `legend` dibujado ignora su margen superior, así que el `fieldset` lleva los 10 px del `h4` (`margin: 10px 0 0`) y el `legend`, `0 0 5px`. Capturas del meta box antes y después (Chromium, 1280 px) idénticas byte a byte.
- Línea base: salen todas las entradas `heading-order`, `label` y `select-name` de las filas del servidor en las tres escenas (66). Quedan las de las filas que añade el JS («added slot»: 3; «validation errors»: 3, para la 2.3) y las dos `color-contrast` (AX5, 2.6).
- [x] hecha · commit: ver `git log` («fix(0010): name the schedule days and slot fields in the meta box (2.2)»)

### 2.3 AX3 + AX4 en el JS: las filas añadidas (≤ 1 h) — `fix-bug`
- Qué: tres cadenas nuevas en `radplapag_get_admin_strings()` (`programLabel` «Radio Show», `startTimeLabel` «Start time», `endTimeLabel` «End time»). `STRING_KEYS` las añade (excepción aprobada). `buildProgramRow()` pinta los tres `label.screen-reader-text` con `for` y los `id` de D4, con el mismo orden que PHP y `decodeEntities()`, como el resto de textos. Las filas nuevas salen de la línea base («added slot» y «validation errors»). AX3 y AX4 pasan a «corregido (spec 0010)».
- Archivos: `admin/admin-strings.php`, `admin/js/station-admin.js`, `tests/php/integration/Admin/AdminScreensTest.php` (`STRING_KEYS`), `tests/js/admin/station-fields.test.js`, `tests/e2e/a11y-baseline.json`, `docs/known-issues.md`
- Test: primero, en `station-fields.test.js`, «labels the program and the times of an added slot (AX3, AX4)» (rojo: sin `label[for]`).
- Verificación: `npm test -- tests/js/admin && npm run test:php:integration -- --filter test_admin_strings_keys && npx playwright test tests/e2e/a11y.spec.ts -g "meta boxes"` (con la reescritura de la línea base en los dos proyectos)
- Rojo: `TypeError: Cannot read properties of null (reading 'tagName')` (el `select` no tiene una etiqueta delante).
- Cayeron dos tests de caracterización que no estaban en §4.3: `admin-dom.test.js` «builds the row with the default strings» y «decodes the entities of names and translations» (spec 0005), que comparan el `outerHTML` de la fila nueva. El usuario aprobó ampliar §4.3 (2026-10-23): `rowHtml()` añade las tres etiquetas y los `id`, y `ENTITY_STRINGS` lleva entidades en las tres cadenas nuevas, así que su decodificación también queda fijada.
- Línea base: salen las seis entradas `label` y `select-name` de las filas del JS («added slot»: 3; «validation errors»: 3). En «station meta boxes» solo quedan las dos `color-contrast` (AX5, 2.6).
- [x] hecha · commit: ver `git log` («fix(0010): name the fields of an added schedule slot (2.3)»)

### 2.4 K45: `id`, `aria-invalid`, `aria-describedby` y el foco al primer error (≤ 1 h) — `fix-bug`
- Qué: `setRowError()` da al mensaje el `id` `radplapag-slot-{día}-{data-program-index}-error` y pone `aria-invalid="true"` y `aria-describedby` en el `select` y en las dos horas. `clearRowError()` los quita. En el `submit` con errores, el foco va (`focus( { preventScroll: true } )`) al primer campo con error: el `.radplapag-program-id` de la fila, o el `input`/`select` del campo de la emisora. Después, el `scrollIntoView` de hoy.
- Archivos: `admin/js/station-admin.js`, `tests/js/admin/station-validation.test.js`, `tests/e2e/a11y.spec.ts`, `docs/known-issues.md`
- Test: primero `station-validation.test.js` «ties a slot error to its fields (K45)» (sustituye al `currently`), «removes the ARIA when the error clears (K45)» y «focuses the first field with an error on submit (K45)»; `a11y.spec.ts` «moves the focus to the first slot with an error on submit (K45)».
- Verificación: `npm test -- tests/js/admin && npx playwright test tests/e2e/a11y.spec.ts -g K45`
- Rojo: «ties…» (`expected '' to be 'radplapag-slot-monday-1-error'`) y «focuses the first field…» (`activeElement` era `body`, no el `select`). «removes the ARIA…» pasaba antes del arreglo (no había ARIA que quitar); se vio en rojo con una mutación (sin `removeAttribute( 'aria-describedby' )`). El e2e, en rojo sin la llamada a `focus()` (`toHaveCount`: 0). Se añade un cuarto Vitest, «focuses the control of a station field with an error on submit (K45)», para la otra rama del foco.
- Línea base de axe: las dos entradas `color-contrast` de «validation errors» (AX5) cambian solo de selector (axe usa ahora el `id` del mensaje, `#radplapag-slot-monday-{0,3}-error`); reescritas con `RADPLAPAG_UPDATE_A11Y_BASELINE=1` en los dos proyectos, sin violaciones nuevas. Salen en la 2.6.
- Changelog: los errores del horario se anuncian con sus campos y el foco va al primer error al guardar.
- [x] hecha · commit: ver `git log` («fix(0010): tie slot errors to their fields and focus the first one (2.4)»)

### 2.5 El meta box contraído se abre con el error (≤ 30 min) — `fix-bug` (solo si 2.1 lo confirma)
- Qué: antes de llevar el foco, si el primer error está en un `.postbox.closed`, se le quita `closed` y su `.handlediv` pasa a `aria-expanded="true"`. Vale para los dos meta boxes.
- Archivos: `admin/js/station-admin.js`, `tests/e2e/admin.spec.ts`, `tests/js/admin/station-validation.test.js`, `docs/known-issues.md`
- Test: primero el `currently` de 2.1 a regresión (mensaje visible y foco en el `select`) y un Vitest que envuelve el contenedor en `.postbox.closed`.
- Verificación: `npm test -- tests/js/admin && npx playwright test tests/e2e/admin.spec.ts -g "collapsed"`
- [ ] hecha · commit: —

### 2.6 AX5: `#b32d2e` en el error y en «Remove Time Slot» en *hover* (≤ 30 min) — `fix-bug`
- Qué: en `admin.css`, `.radplapag-program-error-message` y `.radplapag-remove-program:hover` pasan a `#b32d2e`. Los bordes siguen en `#dc3232`, porque como contraste de no texto pasan.
- Archivos: `admin/css/admin.css`, `tests/e2e/a11y.spec.ts`, `tests/e2e/a11y-baseline.json`, `docs/known-issues.md`
- Test: primero `a11y.spec.ts` «uses the darker red for "Remove Time Slot" on hover over a row with an error (AX5)» (`toHaveCSS( 'color', 'rgb(179, 45, 46)' )`). La entrada `color-contrast` de «validation errors» sale de la línea base.
- Verificación: `npx playwright test tests/e2e/a11y.spec.ts -g "meta boxes"`
- [ ] hecha · commit: —

### 2.7 K20: «Remove Time Slot» visible con el foco (≤ 30 min) — `fix-bug`
- Qué: `.radplapag-program-row:focus-within .radplapag-schedule-remove-cell { opacity: 1; pointer-events: auto; }`, como la etiqueta de reemisión.
- Archivos: `admin/css/admin.css`, `tests/e2e/a11y.spec.ts`, `docs/known-issues.md`
- Test: primero el `currently` de K20 a «shows "Remove Time Slot" when it has the keyboard focus (K20)» (`opacity` `1`).
- Verificación: `npx playwright test tests/e2e/a11y.spec.ts -g K20`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
Ninguna. AX2 (la parte del meta box) y la excepción de `STRING_KEYS` las decidió el usuario y van a la spec como D11 y en §4.3. Si el `fieldset` cambia el aspecto del día de forma visible en las capturas, se para y se pregunta.

## Verificación de la fase
`npm run check` antes de cada commit. En `close-phase`: integración y e2e en las dos puntas (`env:start:min` y `env:start:latest`), `check:zip` y `a11y-reviewer`.
