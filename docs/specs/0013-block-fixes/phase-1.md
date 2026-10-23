# Spec 0013 · Fase 1 — Emisora por ID y editor
Estado: en curso · Inicio: 2026-10-24 · ADRs: 0017, 0020, 0021, 0023, 0028, 0045, 0049 (nuevo)

## Contexto

- La rama `spec/0013-block-fixes` está al día con `origin/trunk` (6b9bb03); sin push todavía.
- `radplapag_get_stations()` → `Station_Repository::published_rows()` ya da `id` en cada fila (`Station::row()`), así que D1 no necesita cambiar el adaptador.
- Los tres `render` leen `stationIndex` y llaman a `radplapag_get_{schedule,programs_list,now_playing}_for_station( $index )`, que con un índice fuera de rango devuelven `null` (−1 incluido).
- Los datos del editor se montan tres veces, igual, en `radio-player-page.php` (`radplapag_enqueue_*_block_editor_assets()`); hoy `{ label }`.
- K48: el aviso se decide con `REST_REQUEST`. En WP 7.1 `$GLOBALS['wp']->query_vars['rest_route']` es lo que lee `rest_api_loaded()`, así que vale en la petición HTTP real (pretty y `?rest_route=`). **`rest_do_request()` no la rellena:** los tests de integración la fijan a mano antes de la petición, como hace el enrutado real; la prueba de que vale en las dos puntas es el e2e (D5). `WP_REST_Server` solo expone `is_dispatching()` (sin ruta), así que no hay otra vía de core sin callback.
- Editor: `schedule` y `programs-list` registran con `...metadata` y `save` (K54); `now-playing` solo `{ edit }`. Los tres usan `safeIndex` para el selector y la vista previa (K47).
- e2e: `chooseStation()` y `stationIndexOf()` de `blocks.spec.ts` esperan `attributes[stationIndex]=N` y el valor del selector como índice → pasan a ID (excepción §4.3). El *fixture* no tiene un bloque sin atributos: se añade una página «E2E Blocks Legacy» con `<!-- wp:radplapag/schedule /-->`.
- Los snapshots usan `stationIndex`; en esta fase no deberían cambiar.

## Objetivo

Los tres bloques eligen la emisora por ID (`stationId`) con `stationIndex` de respaldo; el editor avisa de una emisora que ya no existe y guarda los dos atributos al elegir; el aviso de `now-playing` solo sale en la vista previa del editor; el *inserter* traduce los tres bloques. ADR 0049 y `SPEC.md` §3.5 con todo el contrato de la spec.

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| ADR 0049 aceptado y `SPEC.md` §3.5 al día antes de la primera corrección | Revisión del commit 1.1 (primer commit de código después) |
| D1: `Stations::block_index()` | `tests/php/unit/Data/StationsTest.php` |
| K46: `stationId` manda; ID ausente o no publicado → bloque vacío, nunca otra emisora; 0 → `stationIndex` | `BlockAuditTest::test_station_id_survives_title_order_and_unpublishing` (antes `test_currently_station_index_follows_the_title_order`); `BlockRenderTest` (registro con `stationId`, bloque viejo sin él) |
| Datos del editor `{ stations: [ { label, id } ] }` | `BlockRenderTest::test_editor_data` |
| K47 + D3: aviso, opción vacía, vista previa con los atributos reales; elegir guarda `stationId` y `stationIndex` | `blocks.spec.ts` (regresión de K47 + test nuevo), Chromium y WebKit |
| D2: bloque sin `stationId` → ayuda, opción vacía, sin cambios al abrir | `blocks.spec.ts` (página «E2E Blocks Legacy») |
| K48: aviso solo en `/wp/v2/block-renderer/radplapag/now-playing`; no en `content.rendered` (anónimo ni editor) | `BlockAuditTest` (K48 a regresión), `BlockRenderTest::test_now_playing_empty_in_block_renderer`, `blocks.spec.ts` (vista previa con el aviso) en WP 6.6 y última |
| K54: los tres títulos traducidos en el *inserter* | `blocks.spec.ts` + mu-plugin `gettext` de test |
| Suite | `npm run check`, integración y e2e en las dos puntas, `check:zip` (en `close-phase`) |

## Tareas

### 1.1 ADR 0049 y `SPEC.md` §3.5 (≤ 1 h)
- Qué: `write-adr` «Los bloques eligen la emisora por ID y pintan encabezados» con todo §3 de la spec (fases 1 y 2): `stationId`, datos del editor con `id`, aviso solo en el `block-renderer` (D5, detección por `query_vars['rest_route']`), `headingLevel` y `<hN>`, K49/K50/K51, D2 en el changelog y `== Upgrade Notice ==`. `SPEC.md` §3.5 (tabla, viñetas) y §6 (historial); índice `docs/adr/README.md`.
- Archivos: `docs/adr/0049-blocks-choose-station-by-id-and-print-headings.md`, `docs/adr/README.md`, `SPEC.md`.
- Test: — (docs).
- Verificación: `npm run check`
- [x] hecha · commit: ver `git log` («docs(0013): add ADR 0049 (1.1)»)

### 1.2 K48: aviso solo en la vista previa del editor (D5) (≤ 1 h)
- Qué: `fix-bug`. Primero comprueba D5. `test_currently_rest_content_carries_the_editor_notice` → regresión (con `query_vars['rest_route'] = '/wp/v2/pages/<id>'`, anónimo y editor: sin aviso), en rojo. `test_now_playing_empty_in_rest_request` → `test_now_playing_empty_in_block_renderer` (ruta del `block-renderer` fijada: con aviso; excepción §4.3). Arreglo en `blocks/now-playing/render.php`: `REST_REQUEST` **y** la ruta empieza por `/wp/v2/block-renderer/radplapag/now-playing`. Se corre el e2e de la vista previa (`blocks.spec.ts`, el test que ya comprueba «Now Playing: nothing to show») en WP 6.6 y en la última. **Si no vale en una punta: se para y se pregunta** (alternativa de D5 con callback en `rest_request_before_callbacks`, ampliando el ADR 0049). K48 → «corregido (spec 0013)».
- Archivos: `blocks/now-playing/render.php`, `tests/php/integration/Blocks/{BlockAuditTest,BlockRenderTest}.php`, `docs/known-issues.md`.
- Test: regresión (`fix-bug`).
- Verificación: `npm run test:php:integration -- --filter 'rest_content|block_renderer'` y `npm run test:e2e -- blocks.spec.ts` con `env:start:min` y con `env:start:latest`
- Rojo: `test_rest_content_has_no_editor_notice` falla en `view` (anónimo): `content.rendered` trae el `<div class="wp-block-radplapag-now-playing is-empty">…Now Playing: nothing to show…</div>` en lugar de `''`.
- D5 comprobada: `blocks.spec.ts` (6/6, Chromium y WebKit, con la vista previa que muestra «Now Playing: nothing to show») en WP 7.1.3 y en WP 6.6.10 + PHP 7.4; integración en verde en las dos. Sin callback.
- Changelog: el aviso del editor de `now-playing` vacío ya no sale en el `content.rendered` de la API REST.
- [x] hecha · commit: ver `git log` («fix(0013): show the now playing notice only in the block renderer (1.2)»)

### 1.3 D1: `Stations::block_index()` (≤ 1 h)
- Qué: TDD en el núcleo puro. `block_index( array $rows, int $station_id, int $station_index ): int`: con ID > 0, índice de la fila con ese `id` (comparado con `(int)`), o −1; con 0 (o negativo), `$station_index`. Casos: ID presente en otra posición, ausente, 0 con índice, filas sin `id` o no arrays.
- Archivos: `includes/src/data/class-stations.php`, `tests/php/unit/Data/StationsTest.php`.
- Test: primero (TDD): `StationsTest.php`.
- Verificación: `npm run test:php:unit -- --filter StationsTest`
- Rojo: los cuatro tests nuevos (`test_block_index_*`) fallan con «Call to undefined method Stations::block_index()».
- [x] hecha · commit: ver `git log` («feat(0013): add Stations::block_index() (1.3)»)

### 1.4 K46: `stationId` en los tres bloques (≤ 1 h)
- Qué: `fix-bug`. `test_currently_station_index_follows_the_title_order` → regresión con `stationId`: una emisora nueva que va antes y despublicar otra no mueven el bloque; la emisora despublicada da «No radio shows…» (en rojo). `block.json` de los tres con `stationId` (`number`, 0). En cada `render`: `$index = $station_id > 0 ? Stations::block_index( radplapag_get_stations(), $station_id, $station_index ) : $station_index` y la función de siempre. `BlockRenderTest`: `registered_blocks()` con `stationId`; casos de render con `stationId` (los tres bloques, incluido uno no publicado) y el bloque viejo sin él. Builds regenerados (hook). Snapshots: se corren; si cambian, se para. K46 → corregido.
- Archivos: `blocks/*/block.json`, `blocks/*/render.php`, `tests/php/integration/Blocks/{BlockAuditTest,BlockRenderTest}.php`, `docs/known-issues.md`.
- Test: regresión (`fix-bug`) + nuevos en `BlockRenderTest`.
- Verificación: `npm run test:php:integration -- --filter 'Block(Audit|Render)Test'`
- Rojo: `test_station_id_survives_title_order_and_unpublishing` falla al crear «Alpha»: el bloque con `stationId` de «Beta» pinta «Alpha show». Los dos tests nuevos de `BlockRenderTest` se vieron fallar con el arreglo de `schedule` revertido. Snapshots sin cambios.
- Changelog: los tres bloques guardan la emisora por su ID: crear, renombrar o despublicar otra emisora ya no cambia la de un bloque guardado; una emisora despublicada deja el bloque vacío. Los bloques guardados antes siguen por su posición hasta que se elige la emisora en el editor (D2).
- [x] hecha · commit: ver `git log` («fix(0013): choose the block station by ID (1.4)»)

### 1.5 Datos del editor con `id` (≤ 1 h)
- Qué: los tres `radplapag_enqueue_*_block_editor_assets()` añaden `'id' => (int) $station['id']`. `test_editor_data` con `id` (excepción §4.3), en rojo primero.
- Archivos: `radio-player-page.php`, `tests/php/integration/Blocks/BlockRenderTest.php`.
- Test: primero: `test_editor_data`.
- Verificación: `npm run test:php:integration -- --filter test_editor_data`
- Rojo: `test_editor_data` falla en `schedule`: los datos son `{"label":"Main"}…` sin `id`.
- [x] hecha · commit: ver `git log` («feat(0013): add the station ID to the block editor data (1.5)»)

### 1.6 Editor de `schedule`: selector por ID, aviso y ayuda (K47, D2, D3) (≤ 1 h)
- Qué: `fix-bug` de K47. Selector con valor = ID; opción vacía «Select a radio station» cuando el bloque no resuelve un ID de la lista; `onChange` → `setAttributes( { stationId, stationIndex } )` (índice de ese momento). `Notice` «This radio station no longer exists or is not published. Choose another one.» si `stationId` no está, o si vale 0 y `stationIndex` está fuera de rango. Ayuda (`/* translators: */`) «Showing “%s” by its position in the list of stations. Choose a station to keep it.» con `stationId` 0 e índice válido. Vista previa con los atributos reales (fuera `safeIndex`). Sin `setAttributes` al montar. e2e: `stationIndexOf` → lectura de atributos; `chooseStation` espera `attributes[stationId]=<id>` y comprueba los dos atributos (excepción §4.3: valor del selector como ID); K47 `currently` → regresión (aviso, opción vacía, preview con `stationIndex=999`, bloque vacío); test nuevo de D3; test de D2 con la página nueva «E2E Blocks Legacy» (`<!-- wp:radplapag/schedule /-->`: ayuda visible, `stationId` 0, `isEditedPostDirty()` falso). K47 queda abierta hasta 1.7.
- Archivos: `blocks/schedule/src/index.js`, `tests/e2e/blocks.spec.ts`, `tests/e2e/fixtures/seed-e2e.php`.
- Test: regresión (`fix-bug`) + e2e nuevos.
- Verificación: `npm --prefix blocks/schedule run check && npm run test:e2e -- blocks.spec.ts`
- Rojo: los dos K47 (`warns and previews the empty block for …`) fallan en la URL de la vista previa (`stationIndex=23` en lugar de 999; `stationId=0` en lugar de 999999); D3 y D2 no encuentran el aviso ni la ayuda; «the three blocks…» agota los 30 s esperando `attributes[stationId]=<id>`. En verde: `blocks.spec.ts` 12/12, Chromium y WebKit, WP 6.6.10. `chooseStation` usa `BY_ID` (solo `schedule`) mientras `programs-list` y `now-playing` eligen por posición; la 1.7 lo amplía. Con la lista de emisoras vacía no sale el aviso (ya lo dice la opción «No Radio Stations configured»).
- Changelog: el editor de `schedule` avisa cuando la emisora del bloque ya no existe o no está publicada, previsualiza lo mismo que el front y deja elegir otra; un bloque guardado antes muestra qué emisora usa por su posición.
- [x] hecha · commit: ver `git log` («fix(0013): pick the schedule block station by ID in the editor (1.6)»)

### 1.7 Editor de `programs-list` y `now-playing` (K47) (≤ 1 h)
- Qué: el mismo cambio de 1.6 repetido en cada bloque (ADR 0020, sin código compartido). El e2e de D3 se parametriza a los tres bloques (`chooseStation` ya los recorre en «the three blocks are inserted…»). K47 → corregido.
- Archivos: `blocks/programs-list/src/index.js`, `blocks/now-playing/src/edit.js`, `tests/e2e/blocks.spec.ts`, `docs/known-issues.md`.
- Test: e2e (los de 1.6 extendidos).
- Verificación: `npm --prefix blocks/programs-list run check && npm --prefix blocks/now-playing run check && npm run test:e2e -- blocks.spec.ts`
- [ ] hecha · commit: —

### 1.8 K54: registro solo con `{ edit }` (≤ 1 h)
- Qué: `fix-bug`. Primero el e2e en rojo: un filtro `gettext` en el mu-plugin de test (detrás de la cabecera `X-Radplapag-E2e-Translate: 1`, como los otros interruptores) traduce los tres títulos del `block.json` y el *inserter* los muestra traducidos (hoy fallan `schedule` y `programs-list`). Luego `registerBlockType( metadata.name, { edit: Edit } )` en los dos. K54 → corregido.
- Archivos: `blocks/{schedule,programs-list}/src/index.js`, `tests/e2e/mu-plugins/radplapag-e2e.php`, `tests/e2e/blocks.spec.ts`, `docs/known-issues.md`.
- Test: regresión (e2e).
- Verificación: `npm --prefix blocks/schedule run check && npm --prefix blocks/programs-list run check && npm run test:e2e -- blocks.spec.ts`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- D5 en las dos puntas (1.2): si `query_vars['rest_route']` no vale, se pregunta antes de usar el callback y se amplía el ADR 0049.
- La cabecera nueva del mu-plugin (1.8) es solo de test (no va en el zip): sin ADR.

