# Spec 0005 · Fase 2 — Reglas y DOM del admin
Estado: en curso · Inicio: 2026-10-20 · ADRs: 0017, 0021, 0028

## Contexto (medido al planificar)

- `admin/js/station-admin.js` (1.069 líneas) mezcla reglas y DOM: `validateTimeFormat`, `validateTimeRange`, `timeToMinutes`, `formatOverlapMessage`, `checkOverlaps`, `checkCrossDayOverlaps`, `checkPrevDayCrossOverlaps` y `validateProgramRow` leen las filas y pintan errores. Los dos cruces entre días **pintan también la otra fila** (`showProgramError( nextRow | prevRow, … )`) antes de devolver su error; el vector `c3-start-equals-end-next-day-conflict` depende de ese orden de escrituras.
- Orden de las comprobaciones de una fila: vacía → limpia; horas sin programa → `invalid_program` (reserva «Please select a program.»); programa que no está en `radplapagAdmin.programs` → `invalid_program` (reserva «Please select a valid program.»); formato de inicio, de fin; `start == end` (C3); faltan campos → `required`; solape del mismo día (filas ocultas y sin horas fuera; nombre vacío → «Unnamed program»); siguiente día; día anterior. El caso «Please complete all time fields» de `validateTimeRange` es inalcanzable (solo se llama con inicio y fin).
- Revalidación: al salir de una fila (fila, resto del día, días vecinos **con** vuelta de semana, orden por inicio); al quitar una fila (día, vecinos **sin** vuelta: K16); al enviar (campos de emisora primero; luego todas las filas visibles en orden).
- HTML en cadenas: `newRow.innerHTML` + `buildProgramSelectHtml()` en `station-admin.js:753-942`; `.html( '<img …>' )` y `.html( '<audio …>' )` en `program-admin.js:56,119`. El nombre del programa se escapa (`<`, `>`, `"`) pero no `&`, y las traducciones (`to`, `Rerun`, `Remove Time Slot`, `Select Radio Show`) entran sin escapar: `innerHTML` decodifica sus entidades.
- **Riesgo 1 (decidido por el usuario, 2026-10-20):** se conserva el texto visible de hoy. `station-admin.js` decodifica con un helper `decodeEntities()` sobre `DOMParser` (documento inerte) aplicado a la misma cadena que hoy llega a `innerHTML` (el nombre escapado como hoy, las traducciones tal cual) y asigna su `textContent`. K21 sigue para la 0012.
- **`AdminScreensTest` (decidido por el usuario, 2026-10-20):** `test_admin_scripts_on_the_station_screen` fija `deps === ['jquery', 'media-editor']` para `radplapag-station-admin`. Con el ADR 0028 D3, esa aserción pasa a incluir `radplapag-schedule-rules` y el test comprueba el handle nuevo. Es la única edición de un test existente; desviación anotada.
- Arnés de Vitest: `tests/js/admin/support/mount-station-screen.js` importa solo `station-admin.js`; tendrá que cargar antes `schedule-rules.js`, como hace WordPress (cambio del arnés, no de aserciones). `smoke.test.js` carga cada script sin su markup en `vm`: `station-admin.js` no puede leer las reglas al cargar (solo al usarlas) y `schedule-rules.js` entra en la lista.
- Vectores: capa `admin` de `schedule-vectors.json` (11). `format-24-00` da `required` porque `<input type="time">` vacía `24:00`; el test de las reglas pasa los valores por un helper que imita ese saneado (`HH:MM` válido o `''`).
- Vitest: el root no tiene `"type": "module"`. Cómo importa el test las reglas (`createRequire` + `module.exports` en el proyecto `node`, o `window.radplapagScheduleRules` en `admin`) lo decide la 2.3 según lo que cuente la cobertura v8.
- CI: el job `root-js` corre `npm test`; pasa a `npm run test:coverage` con umbral para `admin/js/schedule-rules.js`.

## Objetivo

Sacar las reglas del horario del admin a `admin/js/schedule-rules.js` (puro, sobre datos, TDD con los vectores) y dejar `station-admin.js` como adaptador del DOM; construir el DOM del admin sin cadenas HTML. Sin cambiar ningún texto visible, mensaje, momento de validación ni rareza (C3, K15, K16, K44, K45).

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| A1 Comportamiento sin cambios | `npm run check`; Vitest del admin (`station-validation`, `station-fields`, `program-admin`, `admin-dom` de la 2.1) sin cambios en sus aserciones; `npm run test:e2e -- admin.spec.ts a11y.spec.ts` en `env:start:min` y `env:start:latest`; `git diff trunk -- tests/js/admin tests/e2e` solo con altas, más el arnés (`mount-station-screen.js`, `smoke.test.js`); `AdminScreensTest` solo con la aserción de `deps` |
| A4 (admin) Vectores | `tests/js/admin/schedule-rules.test.js` pasa los 11 vectores `validation` (capa `admin`, con los `currently` de C3); `git diff trunk -- tests/fixtures` vacío |
| A5 (admin) Cobertura | `npm run test:coverage` con umbral ≥ 85 % de líneas para `admin/js/schedule-rules.js` en `vitest.config.mjs`; la CI (`root-js`) corre `npm run test:coverage` |
| A6 Estándares | `npm run lint:js` sin `eslint-disable` nuevos; `npm run lint:php` y `lint:phpstan` (cambio en `admin/admin.php`) |
| A7 DOM sin cadenas HTML | `grep -nE 'innerHTML\|\.html\(\|insertAdjacentHTML' admin/js` vacío; `admin-dom.test.js` (2.1) en verde antes y después |
| A9 Zip | `npm run check:zip` con `admin/js/schedule-rules.js` en `expected-additions.txt` |

## Tareas

### 2.1 Caracterización del DOM que se construye en JS (≤ 1 h)
- Qué: `tests/js/admin/admin-dom.test.js`, contra el código sin tocar. Fila nueva: `outerHTML` completo (atributos, `style`, nodos de texto con sus espacios) y texto visible, con programas cuyo nombre lleva `&`, `&amp;`, `&lt;`, `<`, `>`, `"` y `'`, y con traducciones de `to`, `Rerun`, `Remove Time Slot` y `Select Radio Show` con `&`, `&amp;` y `&rsquo;`. `program-admin.js`: `outerHTML` de la vista previa de imagen y de audio con URLs con query (`?a=1&b=2`). Confirma el riesgo 1 (se anota en «Resultado:»).
- Archivos: `tests/js/admin/admin-dom.test.js`.
- Test: caracterización (mutación: quitar el escape de `"` en `buildProgramSelectHtml` y verlo fallar; revertida).
- Verificación: `npm test -- tests/js/admin/admin-dom.test.js`
- [x] hecha · commit: (este)
- Resultado: 7 tests. Riesgo 1 confirmado: `innerHTML` decodifica las entidades de nombres y traducciones (`Tom &amp; Jerry` → «Tom & Jerry», `a &lt; b` → «a < b», `Don&rsquo;t` → «Don’t», `Pick &amp; go` → «Pick & go»); `<`, `>` y `"` de los nombres llegan como texto. Se omiten los programas sin ID o sin nombre (ID `0` se queda); el `"` del ID va escapado en `value`. Vistas previas: `?a=1&b=2` se conserva en `src` (`&amp;` al serializar). Mutaciones: la del plan (quitar el escape de `"` del **nombre**) es equivalente, no la detecta ningún test: en un nodo de texto `"` y `&quot;` dan lo mismo. Muerden: quitar el escape de `"` del ID, el de `<` del nombre, `controls` del `<audio>` y `alt` del `<img>`; revertidas. No fijado a propósito: una URL de adjunto con entidades o `"` (hoy se decodifican o rompen el atributo; con `setAttribute` en la 2.9 quedarían tal cual). WordPress no genera esas URLs (`sanitize_file_name()`), así que no es un caso real ni va a `known-issues.md`.

### 2.2 Huecos de la validación del cliente (≤ 1 h)
- Qué: `npm run test:coverage` sobre `station-admin.js` y caracterizar lo que la extracción puede cambiar y no esté fijado, en `tests/js/admin/station-validation.test.js` (solo altas): mensajes de reserva en inglés de cada código sin `strings` (formato, `start == end`, `required`, programa sin elegir, solape, «Unnamed program», etiqueta de día), filas ocultas fuera de los solapes del mismo día y de los días vecinos, índice de exclusión con filas ocultas, nombre vacío en el cruce entre días, y el orden de escrituras del cruce (la otra fila marcada antes que la propia). Lo inalcanzable se anota, no se testea.
- Archivos: `tests/js/admin/station-validation.test.js`.
- Test: caracterización (una mutación por caso nuevo, revertida).
- Verificación: `npm run test:coverage`
- [x] hecha · commit: (este)
- Resultado: 22 tests nuevos (26 → 48 en el archivo; 128 → 150 en la raíz), solo altas. Reservas en inglés de `format` (inicio y fin con segundos: `<input type="time">` guarda `08:00:30`, y es lo único que llega a esa rama), `start == end`, `required`, programa sin elegir, solape del mismo día, los dos sentidos del cruce entre días (lunes → martes y domingo → lunes: en el envío escribe la última la comprobación del día posterior, así que hace falta cada sentido para ver las cuatro escrituras), «Unnamed program» y etiquetas de día (inglés y traducidas). Filas ocultas fuera de los tres solapes; índice de exclusión contado sobre todas las filas, ocultas incluidas; filas vecinas sin programa fuera de los cruces; orden de escrituras del cruce con un `MutationObserver` (`tuesday, monday, monday, tuesday`). Dos rarezas nuevas fijadas con `currently`: K74 (nombre vacío en el cruce, sin la reserva del mismo día) y K75 (el solape del mismo día cuenta las filas sin programa y las nombra «Select Radio Show»). Mutaciones (27 en dos rondas, todas revertidas; `station-admin.js` sin cambios): cada reserva (las cuatro de solape del cruce por separado), las etiquetas de día, `unnamedProgram`, quitar cada filtro de filas ocultas y de filas sin programa, el índice sobre las filas visibles, quitar cada escritura de la otra fila, reserva de nombre en los cuatro nombres del cruce y saltar las filas sin programa en el mismo día: todas fallan. Al principio sobrevivieron la reserva propia del cruce con el día anterior y la reserva del nombre en `checkCrossDayOverlaps` (el envío sobrescribe esas escrituras), lo que llevó a probar los dos sentidos. Inalcanzable, anotado y sin test: «Please complete all time fields» y las comprobaciones de formato dentro de `validateTimeRange` (ya se validaron antes); en `checkOverlaps` y en los cruces, inicio, fin o programa vacíos en la fila propia (`required` va antes); las guardas de campos, contenedor, `data-day` y día vecino ausentes (el markup de PHP los trae siempre); `dayLabels[ dayKey ] || dayKey`; la opción elegida ausente (`selectedIndex` -1: el select siempre tiene el placeholder).

### 2.3 `schedule-rules.js`: horas, días y una franja (≤ 1 h)
- Qué: script clásico ES2019 que expone `window.radplapagScheduleRules` y termina con la guarda `module.exports` (ADR 0028 D3). Datos: `schedule = { day: [ { programId, name, start, end, hidden } ] }` (índice = posición en el DOM). `DAYS`, `nextDay()`/`prevDay()` (con vuelta), `isValidTime()`, `timeToMinutes()` (mismas reglas laxas) y `checkSlot( schedule, day, index, programIds )` → lista ordenada de escrituras `[ { day, index, error|null } ]`, con errores `{ code, reason?, other? }` y los códigos de los vectores (`invalid_program` con `reason: 'missing'|'unknown'`, `format`, `start_equals_end`, `required`, `overlap`, `cross_midnight_overlap`). Se quita el caso inalcanzable de «complete time fields». `test_currently` de C3.
- Archivos: `admin/js/schedule-rules.js`, `tests/js/admin/schedule-rules.test.js`, `tests/zip/expected-additions.txt`.
- Test: primero (TDD): `schedule-rules.test.js`.
- Verificación: `npm test -- tests/js/admin/schedule-rules.test.js && npm run lint:js && npm run check:zip`
- [x] hecha · commit: (este)
- Resultado: 52 tests (150 → 202 en la raíz), vistos en rojo (módulo ausente) antes de escribir el script. El test importa el script con `import rules from '…/schedule-rules.js'` en el proyecto `admin` (happy-dom): Vite interpreta la guarda `module.exports` y la cobertura v8 lo cuenta (100 % de líneas, 98,6 % de ramas, solo este test); no hace falta `createRequire`. Un test comprueba que `window.radplapagScheduleRules` es el mismo objeto. Errores: `invalid_program` (`reason: 'missing'|'unknown'`), `format`, `start_equals_end`, `required` y, en los solapes, `other: { day, name, start, end }` de la franja con la que choca; el nombre llega tal cual (vacío incluido): la reserva «Unnamed program» del mismo día (y su ausencia en el cruce, K74) es cosa de `message()` en la 2.4. `currently` replicados: C3 (`start == end`) y K75 (el solape del mismo día cuenta las filas sin programa con el nombre del placeholder); su fila en `known-issues.md` se actualiza en la 2.4, con K44. Mutaciones (10, revertidas): quitar la exclusión por índice, cada filtro de ocultas y de filas incompletas, el filtro de cruce del día anterior, `>` → `>=` en el cruce, el índice de la otra fila, el orden siguiente/anterior, el umbral de longitud de `timeToMinutes` y las 24 h del mismo día: todas fallan.

### 2.4 `schedule-rules.js`: envío, vectores y mensajes (≤ 1 h)
- Qué: `checkSchedule( schedule, programIds )` → `{ writes, first }` con la semántica del envío (filas visibles de lunes a domingo, en orden); `message( error, strings )` con los textos y reservas de hoy (etiquetas de día, «Unnamed program», `.replace( '%s', … )` tal cual: `currently` de K44). Los 11 vectores `validation` capa `admin` (estado final de las escrituras: primer error y primera fila con error), con `24:00` pasado por el helper del `<input type="time">`. C3 y K44 apuntan también a este test en `known-issues.md`.
- Archivos: `admin/js/schedule-rules.js`, `tests/js/admin/schedule-rules.test.js`, `docs/known-issues.md`.
- Test: primero (TDD): `schedule-rules.test.js`.
- Verificación: `npm test -- tests/js/admin/schedule-rules.test.js && npm run lint:js`
- [x] hecha · commit: (este)
- Resultado: 41 tests nuevos (52 → 93 en el archivo; 202 → 243 en la raíz), vistos en rojo (funciones ausentes) antes de escribirlas. `checkSchedule()` recorre los días en el orden de `DAYS` (no en el de las claves), salta las ocultas, concatena las escrituras de cada `checkSlot()` y da como `first` la primera franja cuya **propia** comprobación falla (la otra fila de un cruce no cuenta, como `firstErrorElement` hoy). Los 11 vectores `admin` pasan por `checkSchedule()` con los tiempos saneados como el `<input type="time">` (`24:00` → `''`) y se comprueba el estado final tras aplicar las escrituras en orden (incluido `c3-start-equals-end-next-day-conflict`). `message()`: reservas en inglés y traducidas de cada código (las dos de `invalid_program` comparten `pleaseSelectProgram`), etiquetas de día, «Unnamed program» solo en el solape del mismo día, y `currently` de K74 y K44 (`.replace( '%s', … )` tal cual; solo el primer `%s`). Cobertura del archivo: 100 % de líneas, 99 % de ramas. `known-issues.md`: C3, K44, K74 y K75 apuntan también a este test. Mutaciones (8, revertidas): no saltar las ocultas, recorrer `Object.keys( schedule )`, sustituir `first` en cada fallo, reserva de nombre en el cruce (K74), invertir `missing`/`unknown`, reemplazo con función (K44), quitar la etiqueta traducida: fallan. Sobrevive, equivalente: leer la primera escritura en lugar de la última para decidir `first` (una comprobación devuelve su escritura sola o dos errores).

### 2.5 Registro del handle `radplapag-schedule-rules` (≤ 1 h)
- Qué: `admin/admin.php` registra `radplapag-schedule-rules` (`js/schedule-rules.js`, sin deps, `'3.4.2'`, footer) y lo añade a los deps de `radplapag-station-admin`. `AdminScreensTest`: la aserción de `deps` de station-admin incluye el handle (ADR 0028 D3, decisión del usuario) y se comprueba el handle nuevo. El arnés de Vitest carga las reglas antes que `station-admin.js`; `smoke.test.js` añade el script. `SPEC.md` §3.6 quita «alta prevista».
- Archivos: `admin/admin.php`, `tests/php/integration/Admin/AdminScreensTest.php`, `tests/js/admin/support/mount-station-screen.js`, `tests/js/admin/smoke.test.js`, `SPEC.md`.
- Test: caracterización: `AdminScreensTest` (aserción ampliada), e2e `admin.spec.ts`.
- Verificación: `npm run lint:php && npm run lint:phpstan && npm run test:php:integration -- --filter AdminScreens && npm test`
- [ ] hecha · commit: —

### 2.6 `station-admin.js` delega la validación (≤ 1 h)
- Qué: un `readSchedule()` lee las filas (valores, texto de la opción elegida, `display: none`); `validateProgramRow()` y el envío llaman a `checkSlot()`/`checkSchedule()` y aplican las escrituras con `showProgramError()`/`clearProgramError()` y `message()`. Se borran las funciones movidas. Los momentos de validar, la revalidación (K16), el orden por inicio, K15 y K45 no cambian. Las reglas se leen de `window.radplapagScheduleRules` al usarlas (no al cargar).
- Archivos: `admin/js/station-admin.js`.
- Test: caracterización: `station-validation`, `station-fields`, `admin-dom`, `smoke` (sin cambios).
- Verificación: `npm test && npm run lint:js`
- [ ] hecha · commit: —

### 2.7 Cobertura del admin en la CI (≤ 1 h)
- Qué: `vitest.config.mjs` con umbral de líneas ≥ 85 % para `admin/js/schedule-rules.js`; el job `root-js` de `ci.yml` corre `npm run test:coverage`. Cifras en «Resultado:».
- Archivos: `vitest.config.mjs`, `.github/workflows/ci.yml`.
- Test: — (mutación: subir el umbral a 101 y verlo fallar; revertida).
- Verificación: `npm run test:coverage`
- [ ] hecha · commit: —

### 2.8 Fila nueva sin cadenas HTML (≤ 1 h)
- Qué: `buildProgramSelectHtml()` y `newRow.innerHTML` pasan a `createElement`/`setAttribute`/`textContent`, en el mismo orden de atributos y con los mismos nodos de texto. `decodeEntities()` (`DOMParser`, riesgo 1) sobre el nombre escapado como hoy y sobre las traducciones.
- Archivos: `admin/js/station-admin.js`.
- Test: caracterización: `admin-dom.test.js` (2.1), `station-fields.test.js`.
- Verificación: `npm test && npm run lint:js && grep -nE 'innerHTML|insertAdjacentHTML' admin/js/station-admin.js; test $? -eq 1`
- [ ] hecha · commit: —

### 2.9 Vistas previas de `program-admin.js` sin cadenas HTML (≤ 1 h)
- Qué: `<img>` (`src`, luego `alt=""`) y `<audio>` (`controls`, luego `src`) con `createElement`, metidos con `.empty().append()`. Cierra A7 en `admin/js`; `admin.md` quita la nota «Mientras no exista ese refactor» y describe el adaptador.
- Archivos: `admin/js/program-admin.js`, `.claude/rules/admin.md`.
- Test: caracterización: `program-admin.test.js`, `admin-dom.test.js`.
- Verificación: `npm test && npm run lint:js && grep -nE 'innerHTML|\.html\(|insertAdjacentHTML' admin/js; test $? -eq 1`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- Ninguna nueva: el riesgo 1 (decodificar como hoy) y la aserción de `AdminScreensTest` (ADR 0028 D3) los decidió el usuario al planificar; van como desviaciones en `docs/status.md`.
- Si `module.exports` no se puede importar con cobertura v8, el test lee `window.radplapagScheduleRules` en el proyecto `admin`; la guarda se queda (D3).

## Verificación de la fase (en `close-phase`)

`npm run check`, `npm run test:coverage`, integración y `:ms` y e2e completos en `env:start:min` y `env:start:latest`, `check:zip`; revisores con UI en el diff (incluido `a11y-reviewer`).
