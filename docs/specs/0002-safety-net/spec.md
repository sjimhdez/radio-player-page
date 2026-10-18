# Spec 0002 — Red de seguridad, auditoría y triage

> Estado: **cerrada** (2026-10-18, PR #37) · Fecha: 2026-10-16 · Rama: `spec/0002-safety-net` · Depende de: 0001
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, `.claude/rules/testing.md`, `docs/known-issues.md`, el informe del spike (`docs/spikes/0001-phase-0.md`, sobre todo R2–R5) y los ADRs 0001, 0004, 0005, 0006, 0017, 0018 y 0021.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0002-safety-net/phase-N.md`, aprobado en plan mode) y termina con `close-phase`. La fase 1 hace el primer push y abre el PR en borrador contra `trunk`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Esta spec no cambia el comportamiento del plugin.** Las fases 1, 2, 4 y 5 no tocan código publicado (`radio-player-page.php`, `includes/`, `admin/`, `blocks/*/{render.php,src}`, `player/src`, `uninstall.php`); la fase 3 solo lo reformatea. Si un test no se puede escribir sin tocar el código, para y pregunta (§4.3).
5. El orden es por riesgo: primero lo que fija datos de usuarios (horario, migración), al final el admin. Lo raro se fija con un test `currently` y una fila en `known-issues.md`; **nunca se corrige aquí**.
6. El spike (`spike/`) es desechable: se copian ideas y fixtures, no se importa nada de allí.

## 1. Contexto y objetivo

La 3.4.2 se publicó sin tests. La 0001 montó las herramientas (PHPUnit sobre wp-env en las dos puntas, Vitest en `player/` y en la raíz, Playwright, CI, líneas base de estándares) con solo tests de humo. Antes de actualizar dependencias (0003, 0004) o refactorizar (0005, 0006) hace falta una red que demuestre que nada visible cambia.

Al cerrar esta spec: el comportamiento de la 3.4.2 está fijado con tests en todas las capas y la CI lo exige con mínimos de cobertura; el catálogo heredado está confirmado o descartado; el código está formateado y sin líneas base de formato; la auditoría ha buscado lo que nadie había visto, y el usuario ha decidido qué se corrige y en qué spec.

**No objetivos:** corregir bugs (specs 0007+); actualizar dependencias (0003, 0004); refactorizar o extraer lógica (0005, 0006); tocar los visualizadores (ADR 0018); activar en la CI las opciones estrictas de `tsc` (decide la 0006).

## 2. Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | Mínimos de cobertura de la columna «al cerrar la 0002» | CI: umbrales de Vitest en `player/vitest.config.ts` y script de PHP sobre el informe `--coverage-xml` (§4.5; desviación de la fase 1, el clover no da funciones globales); falla si baja |
| A2 | Los 12 escenarios de §4.4 pasan en Chromium y WebKit, en las dos puntas de la matriz | jobs `E2E (…)` de la CI |
| A3 | Integración en verde con PHP 7.4 + WP 6.6 y PHP 8.4 + última WP | jobs `PHPUnit integration (…)` |
| A4 | Cada punto de `SPEC.md` §3 y §4 tiene al menos un test | tabla de trazabilidad `docs/specs/0002-safety-net/contract-map.md` (punto → test), revisada por `spec-conformance-reviewer` |
| A5 | PHP y TS pasan los mismos vectores del horario | `tests/fixtures/schedule-vectors.json` leído por un test PHP de integración y uno de Vitest en `player/`; un vector nuevo sin resultado en los dos lenguajes falla |
| A6 | C1–C16 (salvo C14, que no aplica) y K1 confirmados (con su test `currently` en la columna «Test que lo fija») o «no se reproduce» | revisión de `known-issues.md` en el cierre de la fase 2 |
| A7 | Sin líneas base de formato (ADR 0021) | `phpcs.xml.dist`, `eslint.config.mjs`, `.eslintrc.json` de los bloques y `player/.prettierignore` sin bloque de línea base (salvo §4.6); `npm run check` en verde |
| A8 | Auditoría hecha en las 5 zonas de §5 (fase 4) | un informe por zona en `docs/specs/0002-safety-net/audit/`; hallazgos confirmados en `known-issues.md` |
| A9 | PHPStan en la CI con su baseline; nada nuevo puede empeorarla | job `PHPStan` de la CI; mutación: un error nuevo lo hace fallar |
| A10 | El usuario ha triageado todas las filas de `known-issues.md` | columna «Decisión del usuario» sin «pendiente»; hoja de ruta con las specs de correcciones |
| A11 | Paridad de claves entre los 14 locales | Vitest en `player/` (`en-US` es la referencia) |

## 3. Cambios al contrato (`SPEC.md`)

Ninguno: el comportamiento caracterizado no cambia. `SPEC.md` solo cambia si un test demuestra que su redacción no es exacta (como pasó en la 0001 con `crossOrigin`), con su ADR.

ADRs previstos (de proceso, no de contrato):

- **PHPStan con baseline** (fase 4): amplía el ADR 0021 a una herramienta nueva; nivel elegido y por qué.
- **Línea base de axe** (fase 2): el criterio es «ninguna violación nueva», no «cero».
- Solo si hiciera falta: una costura en el código publicado para un test (§4.3).

## 4. Diseño

### 4.1 Fixtures (`tests/fixtures/`)

- `legacy-settings/`: los JSON de `spike/php/fixtures/legacy-settings/` de la 2.0 en adelante (`v2.0-branding`, `v3.1-schedule`, `v3.2-descriptions`) más formas nuevas: varias emisoras, sin horario, datos corruptos (tipos erróneos, días desconocidos, horas mal formadas), programa compartido entre emisoras, conflicto con CPT publicados y **adjuntos reales** (`logo_id`/`background_id` creados antes y normalizados como `{{ATTACHMENT:<nombre>}}`). `v1.1-flat` se conserva solo para fijar K4.
- `schedule-vectors.json`: la parrilla y los vectores 1–14 de `known-issues.md`, los de validación y los de C3. Cada vector guarda el resultado **de la 3.4.2**; los que difieren del correcto (13, 14, C3) llevan `"currently": true` y el ID de la fila. Formato: `{ grid, resolution: [ { now: { day, time }, current, upcoming } ], validation: [ { schedule, valid, error? } ] }`, ampliado en la fase 1 con parrillas con nombre (`grids`), resultados de validación por capa (`php`/`admin`) y un objeto `ts` donde el player difiere de PHP (desviación apuntada en `docs/status.md`). Añade casos de `timezoneOffset` negativo y fraccionario (+5:30) y de horario de verano.
- `audio/`: los medios del spike (`spike/e2e/make-media.sh`) regenerados más cortos y **commiteados** (pocos KB; la CI no necesita ffmpeg): tono MP3 y OGG, HLS (`.m3u8` + segmentos), DASH (`.mpd` + segmentos) y una intro corta. El script generador se mueve a `scripts/fixtures/make-audio.sh`.

### 4.2 Capas y zonas

| Zona (orden de riesgo) | Capa | Notas |
|---|---|---|
| Horario: `radplapag_sanitize_station_schedule()` y validación de campos en `radplapag_save_station_meta()` | integración | vectores de validación; transients de error (§3.1) |
| Migración y actualización (`includes/migration/`, `radplapag-upgrade.php`) | integración | golden master como el del spike (`MigrationGoldenTest`), dos pasadas, IDs normalizados; bloqueo, avisos, descarte con nonce, `upgrader_process_complete` y K4 |
| Config y lectura (`radplapag-stations.php`, `includes/data/`, `radplapag_get_station_for_current_page()`) | integración | orden, valores cerrados, emisoras no publicadas |
| Programa en antena y horario de bloques (`radplapag_get_now_playing_for_station()`, `radplapag_get_schedule_for_station()`, `radplapag_get_programs_list_for_station()`, helpers puros) | unit (helpers puros, si el archivo carga sin WP) + integración | vectores de resolución, reloj según §4.3 |
| Página limpia (`radplapag_output_clean_page()`) | e2e (`request`), ADR 0001 | snapshot HTTP normalizado: origen, `AAAA/MM`, IDs → nombres; zona horaria del fixture sin DST (`Asia/Kolkata`) y DST en integración; casos no interceptados (borrador, contraseña, sin emisora, no página → tema); ruta `wp_die` con un `player/dist` alternativo montado solo en el entorno de test |
| Globales `window.RADPLAPAG_*` | e2e (`request`) + integración donde se pueda | forma, escapes `JSON_HEX_*`, orden de primera aparición de `RADPLAPAG_PROGRAMS` |
| Render de bloques (`blocks/*/render.php`) | integración | snapshot del HTML normalizado con cada combinación de atributos; `now-playing` vacío sin programa |
| CPT, capacidades, meta registrada, editor clásico, guardado y nonces | integración | callbacks de `SPEC.md` §3.4 con hook, prioridad y nº de argumentos |
| Desinstalación (`uninstall.php`) | integración | sitio simple y multisite (si wp-env lo permite; si no, se apunta) |
| `player/src/utils/**` | Vitest | vectores + `TZ` variadas; `vi.useFakeTimers()` |
| Hooks del player (sin visualizadores) | Vitest + Testing Library | *FakeAudioElement* y `vi.mock` de `hls.js`/`dashjs` como en el spike R4; `use-config` con globales válidas e inválidas |
| Admin (`admin/js/*.js`) | Vitest (happy-dom) + e2e | el script se carga sobre el HTML real del meta box: un test de integración guarda su render en `tests/fixtures/admin/station-meta-box.html` y los tests de Vitest lo leen (una sola fuente). Vectores de validación en el cliente |

Un test por comportamiento observable (salidas, efectos, HTML normalizado), no por estructura interna (riesgo 3).

### 4.3 El reloj del servidor

El PHP lee la hora con `new DateTime( 'now', wp_timezone() )` (`radplapag-now-playing-block.php:58`, `radplapag-programs-list-block.php:44`, `radplapag-schedule-block.php:168`): no hay costura y el plugin no expone filtros (`SPEC.md` §3.4), así que **no se añade ninguno**. Técnica sin tocar el código: el test calcula la hora UTC real, **rota la parrilla** para que el día del vector caiga en el día de hoy y fija `gmt_offset` (con `timezone_string` vacío) para que el minuto local sea el del vector. Si el minuto cambia durante el test, se repite una vez. Si la técnica no es fiable en las dos puntas, para y pregunta: la alternativa es una costura privada mínima con su ADR.

### 4.4 E2E

- **Servidor de medios** (`tests/e2e/media-server.mjs`, lo arranca `global-setup`): dos orígenes locales, con y sin `Access-Control-Allow-Origin` (como `spike/e2e/server.mjs`), que sirven `tests/fixtures/audio/` y un **MP3 infinito** estilo Icecast. El *fixture* de `tests/e2e/fixtures.ts` amplía su lista de orígenes permitidos solo a esos dos.
- **Siembra:** `scripts/fixtures/seed.php` (ya borra la ejecución anterior) sigue siendo la emisora completa. Las variantes de los escenarios (HLS, DASH, sin CORS, intro rota, cada visualizador, sin horario) las crea un sembrador propio de e2e, `tests/e2e/fixtures/seed-e2e.php`, idempotente y con títulos fijos, en el mismo `global-setup`. Admin: `storageState` con `admin`/`password`.
- **Escenarios** (cada uno, un archivo `tests/e2e/*.spec.ts`):
  1. **MP3:** Play reproduce y `currentTime` avanza (finito e infinito).
  2. **HLS** (`hls.js` en Chromium; en WebKit lo que use de verdad, y se apunta) y **DASH** reproducen.
  3. **Intro:** suena una vez y pasa al directo; no se puede pausar mientras suena; si falla, pasa al directo sin error.
  4. **`crossOrigin`:** `crossorigin="anonymous"` en cada fuente asignada a `audio.src` (MP3, intro; HLS nativo si el navegador lo usa) y ausente en las rutas MSE (ADR 0004). Sin CORS: C1 y K1 como `currently`, esperando al error y no al timeout.
  5. **Programa actual y siguiente** con `page.clock`: franja normal, cruce de medianoche, reposición, franja vacía y C16; **la reproducción no cambia cuando termina un programa**.
  6. **Modales** del horario y de todos los programas (C4, C6 como `currently`).
  7. **Sueño:** con el reloj adelantado, pausa; pausar a mano lo cancela.
  8. **Visualizadores (smoke):** con cada valor de `visualizer`, carga y reproduce sin errores en consola. No se miran sus píxeles.
  9. **i18n:** `lang="es"` → español; un locale sin traducción → inglés.
  10. **Admin:** crear programa y emisora con horario; errores de validación visibles (cliente y servidor); página ya asignada desactivada; el reproductor refleja lo guardado.
  11. **Bloques** en el frontend y en el editor (insertar y previsualizar), en las dos puntas.
  12. **Accesibilidad:** `@axe-core/playwright` (dev de la raíz) sobre la página del reproductor, los bloques y los meta boxes del plugin (solo sus contenedores, no el admin de core). Las violaciones actuales se guardan en `tests/e2e/a11y-baseline.json` y en `known-issues.md` (origen `axe`); el test falla con cualquier violación que no esté en la línea base.

### 4.5 Cobertura en la CI

- **Player:** `coverage.thresholds` por glob en `player/vitest.config.ts` (`src/utils/**` ≥ 90 % líneas; `src/hooks/**` sin visualizadores ≥ 70 %), y `test:coverage` en su `check` y en la CI.
- **PHP:** Xdebug en el entorno de tests (`wp-env start --xdebug=coverage`), solo en la punta PHP 8.4 + última WP; clover de unit + integración (fusionados con `phpcov` si los dos aportan). **Fase 1:** se lee `--coverage-xml` (el clover de PHPUnit 9.6 no da funciones globales) y solo de la integración (el unit aporta una línea; sin `phpcov`). Las zonas se declaran en `tests/coverage/php-zones.json` (crítico: las funciones de la primera fila de §4.2, migración, actualización, programa en antena y config; resto: lo demás de `includes/`, `admin/*.php`, `blocks/*/render.php`, `uninstall.php`). Un script (`scripts/check-php-coverage.mjs`) lee el clover y aplica 80 % / 60 %. Comprobar en la fase 1 que el clover de PHPUnit 9.6 da cobertura por función global; si no, la zona crítica se mide por archivo y se apunta.
- Mutación: bajar un umbral por encima de lo medido hace fallar la CI.

### 4.6 Formateo masivo (fase 3)

- Un commit por proyecto, `style(0002): …`: `phpcbf` en la parte WordPress, `eslint --fix` en `admin/js`, `prettier --write` en `player/`, el formateo de cada bloque. Cada SHA va a `.git-blame-ignore-revs`.
- Se borran los bloques de línea base del ADR 0021. Las tres entradas que no son de formato (`NonEnqueuedScript`, `NonEnqueuedStylesheet`, `file_get_contents`) pasan a `// phpcs:ignore` en su línea con la justificación. Lo que `--fix` no arregla (Yoda, comentarios, `no-var`, parámetros sin usar, `jsdoc/empty-tags`) se arregla a mano **solo si es mecánico y sin cambio de comportamiento**; si no, para y pregunta.
- `player/src/config/visualizers.ts` es zona congelada (ADR 0018): se queda en `player/.prettierignore`, con un comentario que lo explique.
- La red (unit, integración, e2e en las dos puntas) en verde antes y después. `player/dist/` y `blocks/*/build/` se regeneran y deben salir idénticos; si no, el diff se explica en el plan.
- `PHPCBF_ENABLED=true` en `.claude/hooks/format-edited-file.sh`, con su test en `tests/hooks/`.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`.

### Fase 1 — Caracterización unit e integración

- Fixtures de §4.1 (`legacy-settings/`, `schedule-vectors.json`).
- `characterize` sobre las zonas de §4.2 que no son e2e, en ese orden, con el reloj de §4.3.
- Paridad de claves de los locales (A11).
- Cobertura en la CI (§4.5), con los umbrales de la 0002.
- Las filas del catálogo de estas capas (C2, C3, C9, C10, C11, C12, C13, C16 en PHP/TS) quedan con su test `currently` o «no se reproduce». **Hecho:** C13 y la parte PHP de C9 pasan a la fase 2 (`filter_input()` en CLI y snapshot de la página limpia; decisión del usuario, 2026-10-16).
- ✅ **Criterios:** A1, A3, A5, A11; parte PHP/TS de A4 y A6.

### Fase 2 — E2E y cierre del catálogo

- `tests/fixtures/audio/`, servidor de medios, sembrador de e2e y `storageState` (§4.4).
- Snapshot HTTP de la página limpia y de las globales (§4.2).
- Los 12 escenarios. Línea base de axe y su ADR.
- Las filas restantes (C1, C4, C6, C7, C8, C15, K1) confirmadas; C5 queda «sin confirmar» con la nota de zona congelada, salvo que el usuario pida un test que no toque el código.
- `contract-map.md` completo.
- ✅ **Criterios:** A2, A4, A6.

### Fase 3 — Formateo masivo

- §4.6.
- ✅ **Criterios:** A7; la red en verde antes y después; builds idénticos.

### Fase 4 — Auditoría

Skill `audit`, una tarea por zona: (1) PHP del núcleo, (2) migración y actualización, (3) admin PHP + JS, (4) bloques, (5) player sin visualizadores.

- **Herramientas estáticas:** PHPStan (con `szepeviktor/phpstan-wordpress`, `phpVersion` 7.4) al nivel más alto que se pueda sostener, con `phpstan-baseline.neon`; en `player/`, `tsc --noEmit` con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` y las reglas estrictas de `eslint-plugin-react-hooks`, **solo como informe** (sin cambiar la configuración del player). PHPCS, Plugin Check, `composer audit`, `npm audit` y licencias ya están en la CI desde la 0001: se revisa su salida.
- **Revisión con contexto limpio:** `/code-review` a esfuerzo alto por zona; `wp-security-reviewer` y `wporg-reviewer` sobre la parte WordPress; `a11y-reviewer` con la línea base de axe.
- **Contraste:** cada zona contra `SPEC.md` y contra las filas de `known-issues.md` (variantes del mismo fallo en otro archivo, p. ej. C16 en los tres bloques).
- Cada hallazgo **confirmado** (test `currently` o reproducción) entra en `known-issues.md` con origen `auditoría`, `axe` o `guidelines`; los no confirmados se quedan en el informe de la zona.
- Al final, PHPStan entra en la CI con su baseline (ADR).
- ✅ **Criterios:** A8, A9.

### Fase 5 — Triage con el usuario

- Se recorre `known-issues.md` fila a fila **con el usuario** (la sesión no decide por él). Cada fila sale con: corregir (en qué spec de correcciones y con qué prioridad), otra spec o no arreglar.
- La hoja de ruta (`docs/specs/README.md`) se actualiza: specs 0007+ agrupadas por zona, con sus filas.
- ✅ **Criterios:** A10.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Los tests de caracterización fijan detalles irrelevantes y frenan el refactor | Comportamiento observable, HTML normalizado; nada de estructura interna | Fases 1–2 |
| 2 | El reloj del servidor no se puede fijar sin costura | §4.3; si falla, pregunta y ADR | Fase 1 |
| 3 | E2E de audio inestable (autoplay, tiempos) | El spike midió 40/40 sin flags; se espera a eventos, no a timeouts; reintentos solo en CI | Fase 2 |
| 4 | El formateo esconde cambios de lógica | Commits aislados por proyecto, red en verde antes y después, builds idénticos, `.git-blame-ignore-revs` | Fase 3 |
| 5 | La auditoría produce más hallazgos de los que se pueden corregir | Solo entra lo confirmado; decide el triage | Fases 4–5 |
| 6 | La cobertura de PHP por función no sale del clover | Medir por archivo y apuntarlo (§4.5) | Fase 1 |
| 7 | Multisite en wp-env para `uninstall.php` | Si no se puede, integración de sitio simple y verificación manual apuntada | Fase 1 |
| 8 | WebKit de Playwright no usa HLS nativo como Safari | Se fija lo que hace; la verificación en iOS real es de la spec de release | Fase 2 |

## Apéndice — Referencias

- Spike: `docs/spikes/0001-phase-0.md` (R2 snapshot HTTP, R3 streams y CORS, R4 Vitest del hook, R5 golden master).
- Montaje de la 0001: `docs/specs/0001-bootstrap/phase-1.md` (líneas base, CI, hooks).
- Catálogo y vectores: `docs/known-issues.md`.
