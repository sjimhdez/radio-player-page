# Spec 0005 — Refactor de PHP y admin

> Estado: **propuesta** · Fecha: 2026-10-20 · Rama: `spec/0005-php-admin-refactor` · Depende de: 0003
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, `.claude/rules/php.md`, `admin.md`, `testing.md`, `data-and-migrations.md` y `security.md`, y los ADRs 0005, 0010, 0017 (el método: strangler), 0021, 0024 y 0026. `SPEC.md` §3.1–§3.4 y §3.6 son lo que no puede cambiar.
2. Cuatro fases. Cada una empieza con `start-phase` (plan en `docs/specs/0005-php-admin-refactor/phase-N.md`) y termina con `close-phase`. La rama `spec/0005-php-admin-refactor` ya existe (sin push; el primer push y el PR en borrador los hace `start-phase` de la fase 1).
3. **Es un refactor: el comportamiento no cambia.** Los tests de caracterización y los `currently` no se editan, y los snapshots y la línea base de axe no se reescriben. Si un refactor rompe uno, se arregla el refactor. Los bugs de `docs/known-issues.md` se **conservan** tal cual (los corrigen la 0008–0013 sobre el código nuevo); la única fila que se cierra aquí es K72, que no es un bug.
4. Las decisiones de §4.1 las tomó el usuario en la sesión de diseño (2026-10-20). Van en el ADR 0028 (tarea 1.1), no se reabren.
5. Antes de mover una función, confirma que su comportamiento está fijado (`characterize`). La 0002 cubrió casi todo; si falta algo (por ejemplo, una rama que solo cubre e2e), se caracteriza primero.
6. Si algo de esta spec resulta falso al contrastarlo con el código, o el comportamiento visible cambiaría en algún caso (§6): **para y pregunta**.

## 1. Contexto y objetivo

La parte WordPress mezcla en las mismas funciones la lógica (validar y resolver el horario, sanear campos, transformar los ajustes heredados, armar las globales del player) con las llamadas a WordPress (`get_post`, `update_post_meta`, `__()`, `wp_timezone()`). Por eso casi todo se testea en integración, con Docker, y el reloj solo se controla rotando la parrilla (`Support/Clock`). En `admin/js/station-admin.js` (1.069 líneas) la validación del horario lee el DOM, y las filas nuevas se construyen con `innerHTML`.

Las specs de correcciones de WordPress (0008, 0009, 0010, 0012) arrancan al cerrar esta. La 0009 corrige C16 en PHP, en los bloques y en el player con los mismos vectores, y le hace falta **un solo** módulo de horario en PHP y otro en el admin.

Al cerrar esta spec:

- la lógica pura vive en el namespace `RadioPlayerPage\` (`includes/src/`), con tests unitarios sin WordPress y TDD, y recibe la hora y los datos como parámetros;
- las funciones `radplapag_*`, las clases `Radplapag_*` y los callbacks enganchados siguen existiendo, con la misma firma, como envoltorios finos;
- la lógica del horario del admin vive en `admin/js/schedule-rules.js`, que pasa los mismos vectores que PHP, y `station-admin.js` es un adaptador del DOM sin HTML en cadenas;
- K72 está cerrada.

**No objetivos:**

- La presentación: registro de CPT, meta y bloques, HTML de los meta boxes, menús, avisos, `blocks/*/render.php` y la plantilla de la página limpia se quedan donde están. Solo pasan a llamar al código nuevo.
- Corregir bugs, aunque el refactor los deje a un cambio de distancia (C3, C10, C16, K8, K15, K17, K21, K29–K34, K38…): van en su spec. Si una corrección resulta trivial, se anota para su spec; no se hace.
- El player (0006) y los proyectos de los bloques (`blocks/*/src`).
- Subir el nivel de PHPStan o retirar entradas de su baseline que no desaparezcan solas al mover código.

## 2. Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | El comportamiento caracterizado no cambia | `npm run check`; `npm run test:php:integration` (y `:ms`) y `npm run test:e2e` completos en `env:start:min` (WP 6.6 + PHP 7.4) y `env:start:latest`, sin editar tests, snapshots (`tests/php/integration/snapshots/`, `tests/e2e/snapshots/`) ni `tests/e2e/a11y-baseline.json` |
| A2 | El contrato PHP sigue entero | `HooksTest` (hooks, prioridades y número de argumentos) sin cambios; test nuevo `tests/php/integration/Contract/PublicApiTest.php` que comprueba por reflexión que cada función `radplapag_*` y clase `Radplapag_*` de la 3.4.2 existe con los mismos parámetros (lista fijada en la tarea 1.2, antes de mover nada) |
| A3 | La lógica pura no necesita WordPress | Todo `includes/src/` salvo `includes/src/wp/` se carga y se testea en `tests/php/unit/` (sin Docker). Test `tests/php/unit/Architecture/PureCoreTest.php`: ningún archivo puro llama a funciones de WordPress (lista de prefijos y funciones prohibidas: `get_`, `update_`, `wp_`, `__`, `esc_`, `apply_filters`…) |
| A4 | PHP y el admin pasan los mismos vectores | `tests/php/unit/Schedule/ScheduleVectorsTest.php` (resolución y validación de `tests/fixtures/schedule-vectors.json`, capa `php`) y `tests/js/admin/schedule-rules.test.js` (validación, capa `admin`), sin tocar el JSON |
| A5 | Cobertura | Código puro de `includes/src/`: ≥ 90 % de líneas (el mínimo de la iniciativa, ya desde ahora). Envoltorios y adaptadores: las zonas de `tests/coverage/php-zones.json` siguen en verde, con los archivos nuevos añadidos a su zona. `admin/js/schedule-rules.js`: ≥ 85 % de líneas en `npm run test:coverage`, que pasa a la CI |
| A6 | Estándares sin excepciones nuevas | PHPCS (WPCS 3 + PHPCompatibilityWP `7.4-`) sin supresiones nuevas en el código nuevo; PHPStan nivel 8 sin entradas nuevas en la baseline (las del código movido desaparecen o se corrigen en el mismo commit) |
| A7 | El DOM del admin no se construye con cadenas HTML | `grep -nE 'innerHTML\|\.html\(\|insertAdjacentHTML' admin/js` vacío; test de caracterización previo (fase 2) que fija el DOM y el texto visible de una fila nueva y de la vista previa de un adjunto, y que sigue pasando |
| A8 | K72 cerrada | `grep -n 'phpcs:ignore.*error_log' includes/` muestra el motivo en cada línea; fila de `known-issues.md` en «corregido (spec 0005)» |
| A9 | El zip lleva solo lo previsto | `npm run check:zip` en verde con las altas declaradas (§4.5) y nada más |

## 3. Cambios al contrato (`SPEC.md`)

Ninguno en lo que existe: meta keys, opciones, transients, globales `window.RADPLAPAG_*`, funciones `radplapag_*`, clases `Radplapag_*`, constantes, callbacks enganchados, markup, atributos de los bloques y nombres de los assets del player no cambian.

Altas (no rompen nada, pero se documentan):

- `SPEC.md` §3.4: el namespace `RadioPlayerPage\` es **interno**. Las clases pueden cambiar entre versiones; la API pública sigue siendo la de §3.4.
- `SPEC.md` §3.6: script nuevo `radplapag-schedule-rules` (`admin/js/schedule-rules.js`), dependencia de `radplapag-station-admin`, que expone `window.radplapagScheduleRules` (interno).
- ADR 0028 (tarea 1.1): las decisiones de §4.1.

## 4. Diseño

### 4.1 Decisiones (usuario, 2026-10-20)

| # | Decisión |
|---|---|
| D1 | El código nuevo vive en `includes/src/`, con nombres de archivo de WPCS: `RadioPlayerPage\Schedule\Slot_Validator` → `includes/src/schedule/class-slot-validator.php` (segmentos del namespace en minúsculas, `_` → `-`, prefijo `class-`). Lo carga un autoloader propio (`includes/src/class-autoloader.php`, `RadioPlayerPage\Autoloader::register()`), que mapea el prefijo a la carpeta como PSR-4 pero con esos nombres de archivo. Así WPCS se cumple sin excepciones y `build-release-zip.sh` no cambia (ya copia `includes/`). Composer sigue siendo solo de desarrollo. |
| D2 | Se refactoriza **la lógica, no la presentación** (§1, «No objetivos»). |
| D3 | La lógica pura del admin va en un **script clásico** nuevo, `admin/js/schedule-rules.js`, sin build y en ES2019, que expone `window.radplapagScheduleRules`. Se registra como dependencia de `station-admin.js`, y los handles existentes no cambian. Al final lleva una guarda `if ( typeof module !== 'undefined' && module.exports )` para que Vitest lo importe. Los script modules de WP 6.5 se descartan: cambiarían cómo se carga un asset existente, y `wp_localize_script()` no se aplica a módulos. |

### 4.2 Capas en PHP

- **Núcleo puro** (`includes/src/<zona>/`): clases `final` con métodos que reciben arrays, escalares y `DateTimeImmutable` y devuelven arrays u objetos de valor. Sin WordPress, sin `__()`: los errores salen como **códigos con datos** (`overlap`, `invalid_program`, `format`… los mismos de `schedule-vectors.json`). Así el adaptador produce los mismos mensajes traducidos que hoy.
- **Adaptadores de WordPress** (`includes/src/wp/`): leen posts, meta y opciones, escriben, traducen los códigos con `__()` y obtienen la hora (`new DateTimeImmutable( 'now', wp_timezone() )`). Se testean en integración.
- **Envoltorios**: cada función `radplapag_*` conserva su firma, su docblock (con un `@since` nuevo que dice que delega) y su archivo, y delega en una línea o pocas. Las clases `Radplapag_*` (`Radplapag_Station_Config`, `Radplapag_Program_Config`, `Radplapag_Migrator_Settings_To_Cpt`) conservan sus métodos públicos.
- La costura del tiempo (`$now` como parámetro) es nueva y solo existe en el núcleo. `Support/Clock` sigue valiendo para los envoltorios, porque leen la hora de WordPress.
- PHP 7.4: propiedades tipadas sí; tipos unión, `match`, `enum`, `readonly` y argumentos con nombre, no.

### 4.3 Zonas y destino

| Zona | Hoy | Núcleo (`RadioPlayerPage\…`) | Fase |
|---|---|---|---|
| Tiempo y franjas | `radplapag_parse_time_to_minutes()`, `radplapag_is_slot_active()`, `radplapag_get_schedule_day_keys_and_labels()` (claves) | `Schedule\Time`, `Schedule\Week` | 1 |
| Validación y saneado del horario | `radplapag_sanitize_station_schedule()` | `Schedule\Slot_Validator` (códigos) + adaptador que traduce y devuelve `WP_Error` como hoy | 1 |
| Programa en antena y siguiente | `radplapag_get_now_playing_for_station()` | `Schedule\Now_Playing_Resolver` (recibe la parrilla, los programas y `$now`) | 1 |
| Datos de los bloques | `radplapag_get_schedule_for_station()`, `radplapag_get_programs_list_for_station()`, `radplapag_build_programs_map()` | `Schedule\Schedule_View`, `Schedule\Programs_List_View` | 1 |
| Reglas del horario del admin | `station-admin.js` (`validateTimeFormat`, `validateTimeRange`, `timeToMinutes`, `checkOverlaps`, `checkCrossDayOverlaps`, `checkPrevDayCrossOverlaps`, `formatOverlapMessage`) | `admin/js/schedule-rules.js` (funciones puras sobre datos, no sobre filas del DOM) | 2 |
| DOM del admin | `newRow.innerHTML`, `buildProgramSelectHtml()`, `.html()` de `program-admin.js` | `createElement` / `textContent` / `setAttribute` | 2 |
| Lectura de emisoras y programas | `radplapag_get_stations()`, `radplapag_get_config()`, `radplapag_get_program_data()`, `Radplapag_*_Config`, `radplapag_get_station_for_current_page()`, `radplapag_get_player_pages_assigned_to_other_stations()` | `Data\Station`, `Data\Program` (valores, con las listas blancas de `theme_color` y `visualizer`) + `WP\Station_Repository`, `WP\Program_Repository` | 3 |
| Guardado de campos | `radplapag_save_station_meta()`, `radplapag_save_program_meta()` | `Station\Field_Sanitizer` (puro: valores y códigos de error) + adaptador (nonce, capacidades, `$_POST`, transients, `update_post_meta`) | 3 |
| Globales del player | cuerpo de `radplapag_output_clean_page()` que arma `RADPLAPAG_CONFIG`, `_PROGRAMS` y `_SCHEDULE` | `Player\Globals_Builder` (puro); la plantilla, los assets y `exit` se quedan | 3 |
| Migración | `Radplapag_Migrator_Settings_To_Cpt` | `Migration\Legacy_Plan` (puro: ajustes heredados → programas y emisoras a crear, franjas descartadas y avisos de depuración) + `WP\Migration_Writer` (inserta, revierte, `error_log()` tras `WP_DEBUG`) | 4 |
| Actualización | `includes/radplapag-upgrade.php` | `Upgrade\Upgrade_Policy` (puro: qué hacer según versión, ajustes y emisoras publicadas) + los callbacks de hoy como adaptadores | 4 |

Los nombres de las clases son orientativos: el plan de cada fase los fija. Lo que no cambia es la frontera (puro / adaptador / envoltorio) ni la fase de cada zona.

### 4.4 Tests

- **Antes de mover**, cada fase revisa que la zona está caracterizada: integración (`tests/php/integration/**`), unit (`ScheduleHelpersTest`), Vitest del admin (`station-validation`, `station-fields`, `program-admin`) y e2e (`admin.spec.ts`, `a11y.spec.ts`, `clean-page.spec.ts`). Lo que falte se caracteriza primero, con un commit propio.
- **TDD** para cada clase del núcleo y para `schedule-rules.js`: el test primero y en rojo. Los vectores compartidos se leen del JSON (`tests/fixtures/schedule-vectors.json`); los casos que el JSON no tiene van en el test. Los `currently` de la 0002 que afecten a la lógica (C3, C16, K8, K38…) se **replican** en el test unitario del núcleo como `test_currently_*` / `it( 'currently …' )`, con la fila de `known-issues.md` apuntando también a él, para que la spec de correcciones los encuentre en las dos capas.
- **Tiempo:** el núcleo recibe `DateTimeImmutable`. Los tests unitarios cubren el cruce de medianoche, el cambio de día, el horario de verano y los desfases negativo y fraccionario (+5:30) (`testing.md`).
- **Unit sin WordPress:** `tests/php/unit/bootstrap.php` registra el autoloader del plugin. Los tests unitarios no cargan archivos de `includes/` que no sean del núcleo (salvo `ScheduleHelpersTest`, que ya lo hace y sigue).
- **Cobertura del núcleo:** el informe de cobertura PHP también ejecuta la suite unit, para que el núcleo cuente lo que prueban sus tests. Cómo exactamente (segunda `testsuite` en `phpunit-integration.xml.dist` o un segundo informe con `--zones`) lo decide el plan de la fase 1. El núcleo entra en una zona nueva de `php-zones.json` con `min: 90`.
- **Admin:** `tests/js/admin/schedule-rules.test.js` importa el módulo directamente (proyecto `node`, o `admin` si necesita `window`); los tests del DOM siguen montando `station-meta-box.html`. `vitest.config` lleva el umbral del 85 % para `admin/js/schedule-rules.js`, y la CI cambia `npm test` por `npm run test:coverage` en el job de WordPress JS.

### 4.5 Zip

`npm run check:zip` exige hoy la misma lista que la `v3.4.2`, así que cualquier archivo nuevo lo rompe. Se añade `tests/zip/expected-additions.txt` (una ruta por línea, versionada): el guard acepta exactamente la lista de la `v3.4.2` más esas altas. Si falta o sobra una ruta, falla. La release mueve `REFERENCE_TAG` y vacía la lista. Va en el ADR 0028 y en la tarea 1.1, con su test en `tests/zip/`.

### 4.6 Orden de carga

`radio-player-page.php` hace `require_once` del autoloader antes que de los demás `includes/`. Los envoltorios siguen en sus archivos, y el orden de los `require_once` actuales no cambia. Un archivo de `includes/src/` empieza con `defined( 'ABSPATH' ) || exit;` y solo declara una clase.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Un commit por tarea (`refactor(0005): … (N.M)`; los tests de caracterización que falten, `test(0005): …`).

### Fase 1 — Cimientos y horario en PHP

- 1.1 ADR 0028 (D1–D3 y §4.5) + `SPEC.md` §3.4/§3.6 (altas de §3) + `php.md`/`admin.md` con la convención de nombres.
- 1.2 Inventario de la API pública de la 3.4.2 (funciones, clases y sus parámetros) en `PublicApiTest` (A2), en verde antes de mover nada.
- 1.3 Autoloader (TDD en unit), bootstrap de unit, `PureCoreTest` (A3), `expected-additions.txt` y su guard (§4.5), cobertura del núcleo (§4.4).
- 1.4 Zonas «Tiempo y franjas», «Validación y saneado», «Programa en antena» y «Datos de los bloques» (§4.3), cada una con su núcleo por TDD y su envoltorio.
- ✅ **Criterios:** A1, A2, A3, A4 (PHP), A5 (núcleo y zonas PHP), A6 y A9 para lo hecho.

### Fase 2 — Reglas y DOM del admin

- 2.1 Caracterización de lo que el refactor del DOM puede cambiar: el DOM y el texto visible de una fila nueva (con programas cuyo nombre lleve `&`, `&amp;`, `<`, `"` y comillas simples) y la vista previa de imagen y de audio de `program-admin.js`. Va en `tests/js/admin/` y no se edita después.
- 2.2 `admin/js/schedule-rules.js` por TDD con los vectores (capa `admin`) y registro del handle en `admin/admin.php` (dependencia de `radplapag-station-admin`).
- 2.3 `station-admin.js` delega la validación en `radplapagScheduleRules`; los mensajes, los momentos de validar y las rarezas (C3, K16) no cambian.
- 2.4 DOM sin cadenas HTML (A7), en `station-admin.js` y en `program-admin.js`.
- ✅ **Criterios:** A1 (Vitest del admin y e2e de `admin.spec.ts` y `a11y.spec.ts` en las dos puntas), A4 (admin), A5 (`schedule-rules.js` y CI con cobertura), A7.

### Fase 3 — Datos, guardado y globales del player

- 3.1 Lectura de emisoras y programas: valores y repositorios. `Radplapag_Station_Config` y `Radplapag_Program_Config` delegan.
- 3.2 Guardado de los campos de emisora y programa (saneado puro + adaptador). Los transients, los mensajes y el orden de las escrituras no cambian (C13, K34 y K37 se conservan).
- 3.3 `Player\Globals_Builder`. El snapshot HTTP de la página limpia (`clean-page.spec.ts`) no cambia: tampoco K17 (`[]`) ni K21 (entidades).
- ✅ **Criterios:** A1–A3, A5, A6 para lo hecho.

### Fase 4 — Migración y actualización

- 4.1 `Migration\Legacy_Plan` por TDD contra los fixtures de `tests/fixtures/legacy-settings/` y sus *goldens* (el plan en unit; la escritura, en `MigrationGoldenTest`, que no cambia). Se conservan K30, K31 y K32.
- 4.2 `WP\Migration_Writer`; `Radplapag_Migrator_Settings_To_Cpt::run()` delega. K72: motivo en cada `phpcs:ignore` (A8).
- 4.3 `Upgrade\Upgrade_Policy` y los callbacks de `radplapag-upgrade.php` como adaptadores. `UpgradeFlowTest` no cambia (K29 y K33 se conservan).
- 4.4 Cierre de la spec: `php-zones.json` con todo el código nuevo, `SPEC.md` §6 (historial), notas de la hoja de ruta para la 0008–0013 (dónde queda cada corrección en el código nuevo).
- ✅ **Criterios:** A1–A9.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Hoy `innerHTML` interpreta entidades. `programs[].name` y `strings.*` van anidados en `radplapagAdmin`, y `wp_localize_script()` solo decodifica las entidades del primer nivel. Un programa guardado por kses como `Rock &amp; Roll` (K21) se ve «Rock & Roll» en una fila añadida por JS; con `textContent` se vería «Rock &amp; Roll». Las filas que pinta PHP ya muestran «Rock &amp; Roll». Si el texto visible cambia, cambia el comportamiento | La tarea 2.1 lo fija antes. Si `textContent` no da el mismo texto, se pregunta al usuario: decodificar como hoy, o aceptar el cambio con su fila en `known-issues.md` (coherente con K21, de la 0012). No se cambia sin esa decisión | Fase 2 |
| 2 | WPCS puede exigir otro prefijo de archivo para interfaces o traits | Preferir clases `final` sin interfaces. Si hace falta una, el autoloader admite el prefijo que pida PHPCS (se comprueba en la tarea 1.3) | Fase 1 |
| 3 | Mover código cambia los mensajes o los conteos de la baseline de PHPStan | Las entradas del código movido salen en el mismo commit. Si el código nuevo da un error, se corrige: nunca se añade una entrada (ADR 0024) | Todas |
| 4 | `@since` del código nuevo: la versión de la release no está decidida | `@since 3.5.0` provisional; la spec de release lo confirma con un `grep` | Release |
| 5 | La cobertura del núcleo necesita la suite unit en el informe de integración (Xdebug en wp-env) | Lo decide el plan de la fase 1 (§4.4); si no cabe en el job actual, un paso más en la CI | Fase 1 |
| 6 | Un envoltorio cambia el orden de las escrituras o de los transients, y un tercero enganchado a `updated_post_meta` lo notaría | Los adaptadores repiten el orden de hoy; `SaveStationMetaTest` y `SaveProgramMetaTest` lo fijan; si no, se caracteriza antes | Fase 3 |
| 7 | Tentación de corregir un bug al tenerlo aislado | No se corrige: se anota en la fila de `known-issues.md` dónde queda en el código nuevo (tarea 4.4) | Todas |

## Apéndice — Referencias

- Triage de la 0002: K72 y el endurecimiento de `innerHTML` (`docs/specs/0002-safety-net/audit/admin.md` §5, `phase-5.md` 5.7).
- Mapa de funciones y hooks: `SPEC.md` §3.4; caracterización en `tests/php/integration/Admin/HooksTest.php`.
- Vectores: `tests/fixtures/schedule-vectors.json` (definiciones en `docs/known-issues.md`, «Vectores del horario»).
