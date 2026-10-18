# Spec 0002 · Fase 4 — Auditoría
Estado: en curso · Inicio: 2026-10-17 · ADRs: 0021, 0023, 0018, 0019, 0004, 0013 (y uno nuevo: PHPStan con baseline)

## Contexto
Medido al planificar (2026-10-17), sin tocar el repo (herramientas en el scratchpad):

- **PHPStan 2.3.1 + `szepeviktor/phpstan-wordpress` 2.0.4** (stubs WP 7.1.2), `phpVersion: 70400`, sobre el PHP publicado (`radio-player-page.php`, `uninstall.php`, `includes/`, `admin/`, `blocks/*/render.php`). Errores por nivel: L0–L3: 0 · L4: 20 · L5: 27 · L6: 77 · L7–L8: 83 · L9: 175 · L10: 311. De L4 a L8 son casi todo comprobaciones redundantes (`isset` sobre claves que siempre existen, `is_array()` sobre arrays) y `esc_attr( int )`; de L9 en adelante, ruido de `mixed` propio del código WordPress. Candidatos reales a mirar: `uninstall.php:82` (`switch_to_blog( string )`), `includes/radplapag-upgrade.php:42` (negación siempre falsa), `admin/admin.php:25-26` (`isset( $screen->id )`).
- **`tsc` del player con `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`** (tsconfig temporal que extiende `tsconfig.app.json`): 100 errores; fuera de tests y de la zona congelada, 17 (`utils/program-schedule.ts` 8, `utils/timezone.ts` 4, `use-config.tsx` 1 y un error en cada uno de `AllProgramsModal`, `ScheduleModal`, `SleepMode` y `dashboard/index`).
- `eslint-plugin-react-hooks` del player está en `^5.2`; las reglas estrictas (las del compilador de React) llegan en la 7 (última: 7.1.1). Se ejecutan con un `npx` y una configuración temporal en el scratchpad, sin tocar `player/`.
- PHPCS, Plugin Check, `composer audit`, `npm audit` y licencias ya están en la CI (0001): se revisa su salida, no se montan.
- Huecos que la fase 2 dejó para esta fase: en `contract-map.md` (orden de detección i18n en el navegador, OGG, DASH sin CORS; visualizadores fuera por ADR 0018) y en el ADR 0023 (bloque `now-playing` solo con programa en antena según el reloj real, franjas añadidas por JS, meta boxes con errores a la vista, contraste con un solo tema).

**Reparto de archivos por zona** (lo que es de dos zonas se reparte por función):

| Zona | Archivos |
|---|---|
| 1 · PHP del núcleo | `radio-player-page.php` (página limpia, globales, capacidades, carga), `includes/radplapag-stations.php`, `includes/data/`, el registro de los CPT y la meta en `includes/radplapag-{station,program}-cpt.php`, `uninstall.php` |
| 2 · Migración y actualización | `includes/migration/`, `includes/radplapag-upgrade.php` |
| 3 · Admin PHP + JS | `admin/` (PHP, `js/`, `css/`), meta boxes, guardado y saneado de `includes/radplapag-{station,program}-cpt.php` |
| 4 · Bloques | `blocks/*/{block.json,render.php,src}`, `includes/radplapag-{now-playing,programs-list,schedule}-block.php` |
| 5 · Player sin visualizadores | `player/src/` menos los archivos del ADR 0018 |

## Objetivo
Buscar lo que la red de las fases 1–2 no vio, zona a zona, con herramientas estáticas y revisión con contexto limpio, y registrar solo lo **confirmado** (test `currently` o reproducción) en `known-issues.md`. PHPStan entra en la CI con su baseline. **No se corrige nada ni se toca código publicado** (spec §0.4).

## Criterios de aceptación
| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A8: auditoría en las 5 zonas | un informe por zona en `docs/specs/0002-safety-net/audit/{core,migration,admin,blocks,player}.md` con: herramientas y su salida resumida, revisores lanzados, contraste con `SPEC.md` y con las filas de `known-issues.md` de la zona, hallazgos confirmados (→ fila) y descartados (con el motivo) |
| Cada hallazgo confirmado tiene fila y test | filas nuevas con origen `auditoría`/`guidelines`/`axe`, columna «Test que lo fija» con un test `currently` (visto fallar con una mutación) o «reproducción» paso a paso en el informe; decisión «pendiente» |
| A9: PHPStan en la CI con baseline | job `PHPStan` en `.github/workflows/ci.yml`; mutación: un error nuevo (p. ej. `esc_html( 1 )` en una copia temporal) lo hace fallar, y se revierte |
| PHPStan local | `npm run lint:phpstan` limpio con `phpstan-baseline.neon`; forma parte de `npm run check` |
| ADR de PHPStan | `docs/adr/0024-phpstan-baseline.md` (nivel elegido y por qué) y fila en `docs/adr/README.md` |
| El zip no cambia | `npm run check:zip` (los archivos de PHPStan no entran en la lista de inclusión) |
| Sin cambios en código publicado | `git diff --stat origin/trunk...HEAD` de la fase no toca `radio-player-page.php`, `includes/`, `admin/`, `blocks/*/{render.php,src}`, `player/src` (salvo tests `*.test.ts(x)`), `uninstall.php` |
| La red en verde | `npm run check`; integración y e2e en las dos puntas en `close-phase`; CI del PR #37 |

## Tareas

### 4.1 PHPStan con baseline, en local (≤ 1 h)
- Qué: `composer require --dev phpstan/phpstan szepeviktor/phpstan-wordpress phpstan/extension-installer` (solo desarrollo; no son dependencias de runtime y no van al zip). `phpstan.neon.dist`: nivel **8**, `phpVersion: 70400`, los paths del PHP publicado (no `tests/`, `scripts/` ni `spike/`), `includes: phpstan-baseline.neon`. Generar la baseline (83 entradas medidas). Script `lint:phpstan` en `package.json` y añadirlo a `check` detrás de `lint:php`. Comprobar que `scripts/build-release-zip.sh` no recoge los archivos nuevos.
- Archivos: `composer.json`, `composer.lock`, `phpstan.neon.dist`, `phpstan-baseline.neon`, `package.json`.
- Test: mutación de comprobación: un `esc_html( 1 );` temporal en un PHP publicado hace fallar `lint:phpstan`; se revierte.
- Verificación: `npm run lint:phpstan && npm run check:zip && npm run check`
- Resultado (2026-10-17):
  - `phpstan/phpstan` 2.3.1, `szepeviktor/phpstan-wordpress` 2.0.4 (stubs WP 7.1.2) y `phpstan/extension-installer` 1.4.3 en `require-dev`, con `allow-plugins` para el instalador. `phpstan.neon.dist`: nivel 8, `phpVersion: 70400`, `radio-player-page.php`, `uninstall.php`, `includes/`, `admin/` y los tres `blocks/*/render.php`. Baseline: 83 errores en 75 entradas, como se midió.
  - `lint:phpstan` lleva `--memory-limit=1G`: sin la caché de resultados, los workers se caen con el límite de 128M de PHP (lo destapó la mutación). Va en `check` detrás de `lint:php`.
  - Mutación: `esc_html( 1 );` al final de `uninstall.php` → `lint:phpstan` sale con 1 (`uninstall.php:95`, `argument.type`); revertida, vuelve a «No errors» con la caché limpia.
  - `npm run check:zip`: 39 archivos, la misma lista que `v3.4.2` (la lista de inclusión no recoge `phpstan*.neon*`). `npm run check` en verde.
- [x] hecha · commit: `e50ad63`

### 4.2 Auditoría · zona 1, PHP del núcleo (≤ 1 h)
- Qué: skill `audit` sobre los archivos de la zona 1. Estáticas: PHPCS (y los `phpcs:ignore` de la zona con su motivo), las entradas de la baseline de PHPStan de la zona (cada una: ¿bug o ruido?), `.claude/rules/security.md` y `wordpress-org.md`. Revisión: `/code-review` a esfuerzo alto con la lista de archivos, `wp-security-reviewer`, `wporg-reviewer` y `backcompat-reviewer`. Contraste: `SPEC.md` §3 (globales, capacidades, CPT, meta) y §4 (página limpia); filas C9, C11, K7, K17 (¿variantes en otros sitios?). Candidatos ya vistos: `switch_to_blog( string )` en `uninstall.php:82`.
- Archivos: `docs/specs/0002-safety-net/audit/core.md`, `docs/known-issues.md`, tests `currently` en `tests/php/{unit,integration}/` o `tests/e2e/`.
- Test: caracterización (`characterize`): un test `currently` por hallazgo confirmado, visto fallar con una mutación temporal.
- Verificación: `npm run check && npm run test:php:integration`
- Resultado (2026-10-18):
  - Informe en [`audit/core.md`](audit/core.md). PHPCS limpio (seis supresiones, todas justificadas); de las entradas de la baseline de PHPStan de la zona, ninguna es un bug (`switch_to_blog( string )` funciona). Revisores: `wp-security-reviewer`, `wporg-reviewer`, `backcompat-reviewer` y un code review a esfuerzo alto en un subagente.
  - Confirmados: K21–K28 (K21, K22, K24 y K25 con un test `currently` de integración; K23, K26, K27 y K28 con reproducción en el informe) y una variante de C10 en el player (reproducción). 20 descartados, abajo y en el informe.
  - Mutación: `is_page()` en `radplapag_get_station_for_current_page()`, `instanceof WP_Post` en `radplapag_map_cpt_meta_cap()`, `html_entity_decode()` del título y `show_in_rest => false` en el CPT de emisora → los cuatro tests en rojo; revertida.
- [x] hecha · commit: `a3db593`

### 4.3 Auditoría · zona 2, migración y actualización (≤ 1 h)
- Qué: lo mismo sobre `includes/migration/` y `includes/radplapag-upgrade.php`. Contraste: invariante 3 (unidireccional e idempotente; ADR 0005, 0010), bloqueo `radplapag_migrating`, avisos y descarte con nonce, `upgrader_process_complete`; filas K4 y C11. Candidato ya visto: la negación siempre falsa de `radplapag-upgrade.php:42`. Revisores: `/code-review`, `wp-security-reviewer`, `backcompat-reviewer` (`wporg-reviewer` solo si toca avisos del admin).
- Archivos: `audit/migration.md`, `docs/known-issues.md`, tests en `tests/php/integration/Migration/`.
- Test: caracterización, como en 4.2.
- Verificación: `npm run check && npm run test:php:integration`
- Resultado (2026-10-18):
  - Informe en [`audit/migration.md`](audit/migration.md). PHPCS limpio, pero las dos `phpcs:ignore` de `error_log` del migrador no llevan motivo (ADR 0021; para el triage, porque toca código publicado). De la baseline de PHPStan de la zona, ninguna entrada es un bug (`! $counts` es inocuo). Revisores: `wp-security-reviewer`, `wporg-reviewer`, `backcompat-reviewer` y un code review a esfuerzo alto en un subagente.
  - Confirmados, todos con un test `currently` de integración en `UpgradeFlowTest`: K29 (el aviso de conflicto no se descarta), K30 (un solape entre días que la 3.2.0 guardaba bloquea la migración para siempre; reproducción con el saneador de la `v3.2.0` en el informe), K31 (barras invertidas perdidas), K32 (`stations` sin emisoras válidas da «éxito»), K33 (la página del player no se sirve hasta que un administrador abre el admin) y una variante de K21 (kses en la migración). 17 descartados, abajo y en el informe.
  - Mutación: seis cambios temporales en `radplapag-upgrade.php` y el migrador → los seis tests en rojo; revertida.
- [x] hecha · commit: `350a891`

### 4.4 Auditoría · zona 3, admin PHP + JS (≤ 1 h)
- Qué: lo mismo sobre `admin/` y los meta boxes y guardados. Estáticas: PHPCS, PHPStan (baseline de la zona: `esc_attr( int )`, `isset( $screen->id )`), ESLint de la raíz. Revisión: `/code-review`, `wp-security-reviewer` (nonces, capacidades, saneado, transients de error), `wporg-reviewer` (avisos, i18n, `translators`), `a11y-reviewer` con la línea base de axe. Huecos del ADR 0023 de esta zona, cerrados con e2e en `tests/e2e/a11y.spec.ts`: axe sobre una franja añadida con «Add Time Slot» y sobre el meta box con errores de validación a la vista (las violaciones que ya están en la línea base no son nuevas; una nueva se apunta con su fila `axe` y se añade a la línea base con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`, decisión del usuario apuntada aquí, ADR 0023). Contraste: filas C3, C10, C13, K5, K15, K16, K19, K20, AX2–AX4.
- Archivos: `audit/admin.md`, `docs/known-issues.md`, `tests/js/admin/`, `tests/php/integration/`, `tests/e2e/{admin,a11y}.spec.ts`, `tests/e2e/a11y-baseline.json` (solo si el usuario lo aprueba).
- Test: caracterización, como en 4.2.
- Verificación: `npm run check && npm run test:php:integration && npx playwright test tests/e2e/admin.spec.ts tests/e2e/a11y.spec.ts`
- Resultado (2026-10-18):
  - Informe en [`audit/admin.md`](audit/admin.md). PHPCS y ESLint limpios (cuatro supresiones, todas con motivo); de las 32 entradas de la baseline de PHPStan de la zona, ninguna es un bug. Revisores: `wp-security-reviewer`, `wporg-reviewer`, `a11y-reviewer` y un code review a esfuerzo alto en un subagente.
  - Confirmados: K34–K45 y AX5. K34, K35, K36, K37, K38 y K41 con un test `currently` de integración; K39, K40 y K42 con e2e (Chromium y WebKit; K40 también con reproducción); K43 con integración (el player por lectura); K44 y K45 con Vitest. Medias: K39 (foco), K41 (programa en la papelera bloquea el guardado), K42 (URL sin esquema), K45 (errores sin ARIA). Variantes anotadas en AX2–AX4 y un matiz de K31. 31 descartados, abajo y en el informe.
  - Huecos del ADR 0023 cerrados en `a11y.spec.ts`: axe tras «Add Time Slot» y con errores de validación a la vista. Solo sale una regla nueva, `color-contrast` (AX5); lo demás es AX2–AX4. Línea base: 52 entradas nuevas con la decisión del usuario (abajo).
  - Mutación: tres tandas de cambios temporales en `admin/` e `includes/` (detalle en el informe) → los 13 tests nuevos en rojo; revertida.
  - Verificación: `npm run check` en verde; integración completa en verde en las dos puntas (364 tests; el de K38 tiene una rama para PHP 7.4, *warning*, y otra para PHP 8, `TypeError`); `admin.spec.ts` y `a11y.spec.ts` en verde en Chromium y WebKit (54 tests).
- [x] hecha · commit: `de7550c`

### 4.5 Auditoría · zona 4, bloques (≤ 1 h)
- Qué: lo mismo sobre los tres bloques y sus `includes/radplapag-*-block.php`. Estáticas: PHPCS, PHPStan (zona: `is_array`/`is_string` redundantes, `radplapag-programs-list-block.php:133`), `wp-scripts lint-js` de cada bloque. Revisión: `/code-review`, `wp-security-reviewer` (escape en `render.php`), `wporg-reviewer` (dependencias de core no empaquetadas en `build/`), `backcompat-reviewer` (markup y atributos), `a11y-reviewer`. Hueco del ADR 0023: el bloque `now-playing` sin programa según el reloj real; se cierra sembrando en `tests/e2e/fixtures/seed-e2e.php` una emisora con una franja de 24 h en cada día (`start == end`, que el servidor acepta, C3), para que siempre haya programa en antena, y pasando axe sobre ella en `a11y.spec.ts`. Contraste: C10, C16 (variante en los tres bloques), K6.
- Archivos: `audit/blocks.md`, `docs/known-issues.md`, `tests/php/integration/Blocks/`, `tests/e2e/fixtures/seed-e2e.php`, `tests/e2e/{blocks,a11y}.spec.ts`.
- Test: caracterización, como en 4.2.
- Verificación: `npm run check && npm run test:php:integration && npx playwright test tests/e2e/blocks.spec.ts tests/e2e/a11y.spec.ts`
- Resultado (2026-10-18):
  - Informe en [`audit/blocks.md`](audit/blocks.md). PHPCS y `lint-js` de los tres bloques limpios (supresiones con motivo); de las 17 entradas de la baseline de PHPStan de la zona, ninguna es un bug (`radplapag-programs-list-block.php:133` tampoco). Revisores: `wp-security-reviewer`, `wporg-reviewer`, `backcompat-reviewer`, `a11y-reviewer` y un code review a esfuerzo alto en un subagente.
  - Confirmados: K46–K54 y una variante de C10 en «Coming up». K46, K48–K53 y la variante con un test `currently` de integración (`BlockAuditTest`); K47 con e2e (Chromium y WebKit); K54 con reproducción (mu-plugin temporal en el contenedor, borrado). Medias: K46 (`stationIndex` posicional) y K53 (sin encabezados). 21 descartados, abajo y en el informe.
  - Hueco del ADR 0023 cerrado: `seed-e2e.php` siembra «E2E Always On Air» (franja `00:00`–`00:00` cada día) y su página de bloques; `a11y.spec.ts` pasa axe sobre ella tras comprobar que `now-playing` y las franjas `is-live` se pintan. Sin violaciones: la línea base no cambia.
  - Mutación: ocho cambios temporales en `includes/` y `blocks/*/render.php`, y `safeIndex = stationIndex` en `blocks/schedule/src` con su build → los nueve tests en rojo; revertida.
  - Estabilizado el escenario `station with an added slot` de la 4.4: en WebKit fallaba a veces con `color-contrast` de «Remove Time Slot» porque el puntero se queda sobre la fila nueva y axe medía el *hover* a mitad de la transición. El test aparta el puntero y espera a `opacity: 0` antes de axe; la línea base no cambia.
  - Verificación: `npm run check` en verde; integración completa en verde en la punta última (372 tests); `blocks.spec.ts` y `a11y.spec.ts` en verde en Chromium y WebKit (34 tests, tres pasadas). La punta mínima queda para `close-phase`.
- [x] hecha · commit: `94e0079`

### 4.6 Auditoría · zona 5, player sin visualizadores (≤ 1 h)
- Qué: skill `audit` sobre `player/src` menos el ADR 0018. Estáticas, **solo como informe** (configuración del player intacta): `tsc` con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` desde un tsconfig temporal en el scratchpad (17 errores fuera de tests y zona congelada), y ESLint con `eslint-plugin-react-hooks@7` y sus reglas estrictas desde una configuración temporal en el scratchpad (`npx`); `npm --prefix player run lint`/`typecheck` normales. Revisión: `/code-review` a esfuerzo alto, `a11y-reviewer` (línea base de axe, C15, AX1, AX2), y comprobación de «ninguna petición a terceros» (`player.md`). Huecos de `contract-map.md` cerrados con e2e: orden de detección i18n en el navegador (`SPEC.md` §4), un directo OGG que suena (`tests/fixtures/audio/tone.ogg`, ya servido) y DASH sin CORS (`currently`, fila K1/C1). Contraste: C1, C2, C4, C6–C9, C15, C16, K1, K8–K14, K18.
- Archivos: `audit/player.md`, `docs/known-issues.md`, `player/src/**/*.test.ts(x)`, `tests/e2e/{i18n,cross-origin,mp3}.spec.ts` (o uno nuevo `ogg.spec.ts`), `tests/e2e/fixtures/seed-e2e.php` (variantes OGG y DASH sin CORS si faltan), `docs/specs/0002-safety-net/contract-map.md`.
- Test: caracterización, como en 4.2 (e2e esperando a eventos, no a timeouts).
- Verificación: `npm run check:player && npx playwright test tests/e2e/i18n.spec.ts tests/e2e/cross-origin.spec.ts tests/e2e/mp3.spec.ts`
  - Resultado (2026-10-18): 17 filas nuevas (K55–K71) y AX6, variantes de K1, K11, K52 y AX2; informe en [`audit/player.md`](audit/player.md). Huecos de `contract-map.md` cerrados (variantes `ogg` y `nocors-dash` del seed). `tsc` estricto: 12 errores en la zona, no 17 (los otros son tests y zona congelada), todos ruido.
  - Archivo nuevo fuera de la lista: `tests/e2e/player-a11y.spec.ts` (lo que axe no ve del player, aparte de los escenarios de la línea base); también se tocan `hls-dash.spec.ts` (K67), `sleep.spec.ts` (K65) y `player/src/components/dashboard/SleepMode.test.tsx` (K66).
  - `smoke.spec.ts` contaba 17 emisoras «E2E»: la 4.5 añadió `always` sin actualizarlo (en rojo desde `94e0079`, no estaba en su verificación) y aquí se añaden `ogg` y `nocors-dash`; pasa a 20.
  - Mutación: Vitest en una copia del player en el scratchpad → los 17 casos `currently` nuevos en rojo. La de los e2e (mutar `player/src` y regenerar `dist/`) la bloqueó el clasificador de permisos; **el usuario la aprueba** (2026-10-18): 13 mutaciones en `player/src` con su build → los 16 e2e nuevos en rojo en los dos navegadores; revertida, `player/dist/` idéntico a HEAD y los 32 en verde.
  - Verificación: `npm run check` en verde; `i18n`, `cross-origin`, `mp3`, `player-a11y`, `hls-dash`, `a11y` y `smoke` en verde en Chromium y WebKit, y el caso K65 de `sleep.spec.ts`.
- [ ] hecha · commit: —

### 4.7 PHPStan en la CI y su ADR (≤ 1 h)
- Qué: job `PHPStan` en `ci.yml` (PHP 8.4, `composer install`, `npm run lint:phpstan`). Si la auditoría dejó entradas de la baseline que ahora son filas de `known-issues.md`, la baseline no cambia (se corrigen en una spec de correcciones). ADR 0024 con el nivel 8 (el salto a 9 duplica los errores por `mixed`, sin hallazgos nuevos), la regla «la baseline solo baja; una entrada nueva solo con la decisión del usuario en el plan», y `phpstan analyse --generate-baseline` solo al corregir. Actualizar `.claude/rules/php.md` (comando y regla), `CLAUDE.md` (tabla de comandos: `check` incluye PHPStan), spec §4/§5 si hace falta y `contract-map.md` (huecos cerrados).
- Archivos: `.github/workflows/ci.yml`, `docs/adr/0024-phpstan-baseline.md`, `docs/adr/README.md`, `.claude/rules/php.md`, `CLAUDE.md`.
- Test: mutación en la CI no se puede sin un commit; se hace en local (`esc_html( 1 )` → `lint:phpstan` falla) y se apunta; la CI del PR muestra el job en verde.
- Verificación: `npm run lint:phpstan && npm run check` y el job `PHPStan` del PR #37 en verde (`gh pr checks 37`)
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- **Nivel de PHPStan:** 8 con baseline (83 entradas). → ADR 0024 en 4.7.
- **Entradas nuevas en la línea base de axe** al cerrar los huecos (4.4–4.6): solo con la decisión del usuario, apuntada en esta sección (ADR 0023).
  - 4.6 (2026-10-18): la línea base no cambia. Lo nuevo de axe (AX6 en el estado de carga y `heading-order` con un programa expandido) sale en estados que `a11y.spec.ts` no recorre y se fija en `player-a11y.spec.ts` con `withRules()`, sin tocar la línea base.
  - 4.5 (2026-10-18): el escenario `blocks page · always on air` no da violaciones; la línea base no cambia y no hace falta decisión.
  - 4.4 (2026-10-18): **el usuario aprueba** añadir las violaciones de `station meta boxes · added slot` y `station meta boxes · validation errors` con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`: 52 entradas (AX2–AX4 con el nombre de página nuevo y AX5), en Chromium y WebKit, sin bajas.
- **Huecos que no se puedan cerrar sin tocar código publicado:** se para y se pregunta (spec §0.4); se quedan anotados en el informe de la zona.

## Descartados
(Se rellena durante la fase: «descartado: … porque …», uno por línea.)

Zona 1 (4.2; detalle en [`audit/core.md`](audit/core.md) §5):
- descartado: la REST expone la meta de emisoras y programas a anónimos, porque los CPT no soportan `custom-fields` y la respuesta no lleva `meta` (medido; lo que sí sale es K22).
- descartado: saltarse por REST la regla de una página por emisora, porque la meta no se escribe por REST (sin `custom-fields`).
- descartado: tema, visualizador y horario sin lista blanca ni saneador al guardar por `register_post_meta`, porque solo se alcanza con código que ya escribe meta y al leer se filtra (fijado en `CptTest`).
- descartado: claves de día, `program_id` raros y orden de `RADPLAPAG_PROGRAMS` según el JSON, porque solo pasan con meta escrita por terceros.
- descartado: `TypeError` por la firma tipada de `radplapag_map_cpt_meta_cap()`, porque core siempre pasa arrays.
- descartado: `lang` con `esc_html()`, porque da la misma salida que `esc_attr()`.
- descartado (sospecha para el triage): `<html>` sin `dir` en sitios RTL, porque no se reproduce sin un paquete de idioma RTL.
- descartado: `radplapag_get_program_data()` devuelve borradores por defecto, porque todos los llamadores públicos pasan `true`.
- descartado: medios de posts privados con su URL en la página, porque los uploads son públicos.
- descartado: sitio principal dos veces y `wp_cache_flush()` en la desinstalación multisite, porque es idempotente y el vaciado es contrato (§3.7).
- descartado: `switch_to_blog( string )`, `json_decode()` de un manifiesto ilegible y `esc_url( false )` de PHPStan, porque funcionan o son inalcanzables.
- descartado: `user_has_cap` sin `edit_published_*`/`edit_private_*`, porque `map_meta_cap` resuelve con `manage_options`.
- descartado (sospecha para el triage): el `exit` en `template_redirect` se salta otros plugins enganchados después, porque es el diseño del ADR 0008 y depende del plugin de terceros.
- descartado: desempate del orden de `radplapag_get_stations()`, porque no se ha visto inestable.
- descartado: solo `css[0]` del manifiesto, porque el build tiene un único CSS.
- descartado: emisora titulada «0» toma el nombre del sitio, porque es artificial.
- descartado: §3.3 no cita la condición «con `stream_url`», porque es redacción de `SPEC.md` y ya está fijada con un test (se apunta para el cierre).
- descartado: la cabecera `Tags:` del archivo principal, porque es inocua.
- descartado (pasa a 4.5): el índice de emisora sin `sprintf` ni `translators` en los datos del editor de los bloques, porque es de la zona 4.

Zona 2 (4.3; detalle en [`audit/migration.md`](audit/migration.md) §5):
- descartado (sospecha para el triage): el bloqueo `radplapag_migrating` no es atómico y dos peticiones simultáneas podrían migrar dos veces, porque la ventana es de microsegundos y no se ha reproducido.
- descartado (sospecha para el triage): aviso de conflicto espurio por una petición concurrente con `alloptions` antiguo, porque es la misma carrera.
- descartado (sospecha para el triage): migración cortada por un fatal o un timeout, sin rollback y con programas duplicados en el reintento, porque depende de terceros o de límites del servidor.
- descartado: migración dentro del POST de una emisora que copia su meta, porque necesita un fallo transitorio previo y esa ventana exacta.
- descartado: `upgrader_process_complete` no actúa desde la 3.2.x, porque su consecuencia es K33 (redacción del paso 3 de §3.2 para el cierre).
- descartado: autor de reserva con ID 1, porque no se ha visto un sitio sin administradores con rol.
- descartado: `radplapag_maybe_clear_migration_conflict_flag()` sin capacidad, porque solo borra la bandera en la condición correcta.
- descartado: importación diferida al despublicar todas las emisoras, porque es lo que propone el aviso y está fijado.
- descartado: `id` de programa repetido con datos distintos, porque lo fija el golden `shared-program` (precisión de §3.2 para el cierre).
- descartado: la opción se borra habiendo descartado contenido, porque es el ADR 0010 y lo fijan los goldens.
- descartado: aviso de éxito que caduca en AJAX, porque no se pierde nada.
- descartado: títulos por defecto en el idioma del usuario, porque es inocuo.
- descartado: versión futura sobrescrita por `radplapag_ensure_schema_version_option()`, porque es latente.
- descartado: vuelta atrás a la 3.2, porque el ADR 0010 dice que no hay vuelta atrás.
- descartado: listas blancas duplicadas en el migrador, porque hoy coinciden.
- descartado: formatos 2.0.0 y 3.0.x sin fixture, porque no hay tags de esas versiones.
- descartado: `wp_set_current_user()` sin restaurar ante una excepción, porque la petición muere.

Zona 3 (4.4; detalle en [`audit/admin.md`](audit/admin.md) §5):
- descartado: `player_page` sin validar como página (POST a mano, `absint()` de un array), porque solo lo hace un administrador con su nonce.
- descartado: transients de error por post y no por usuario, porque son dos administradores en 45 s, sin datos sensibles.
- descartado (para la spec 0005): HTML a mano en `innerHTML` (traducciones, `&`, URL del adjunto), porque no hay vía de ataque con WordPress tal cual.
- descartado: el guardado no compara `$post_id` con `post_ID`, porque no hay ningún caso en core.
- descartado (sospecha para el triage): «Entrada publicada» junto al error y la emisora publicada sin URL, porque es el contrato (§3.1, §3.6).
- descartado: el horario editado se pierde si el servidor lo rechaza, porque es el contrato (§3.1) y solo pasa sin JS o por una carrera.
- descartado (sospecha para el triage): meta box contraído con un error que bloquea el envío sin mensaje, porque no se ha reproducido.
- descartado: `:has()` sin soporte, porque los navegadores de WP 6.6 lo soportan.
- descartado: programas sin título fuera de las filas nuevas, porque es artificial.
- descartado: el horario no se valida si fallan los campos, porque está fijado y sale en el siguiente envío.
- descartado: «Please enter a valid URL.» inalcanzable al enviar, porque es el patrón de K19 e inocuo.
- descartado: `a < b and c > d` → `a d`, porque medido no se reproduce.
- descartado: variante táctil de K20, porque no se ha probado en táctil.
- descartado (para la spec 0005): mejoras de i18n (concatenación, «to»/«Rerun» sin contexto, 18 cadenas sin uso, textos de reserva), porque no hay bug visible.
- descartado: marcos de `wp.media` sin título propio, porque salen los de core, traducidos.
- descartado: assets encolados dos veces y versión a mano, porque no tiene efecto y la versión la sube `release`.
- descartado: *placeholder* con `my.station.com`, porque es inocuo.
- descartado (para la spec 0005): errores de los campos de la emisora sin `aria-invalid`, porque sí se anuncian (región viva).
- descartado: avisos del servidor que no llevan el error al campo, porque es experiencia, no un incumplimiento medido.
- descartado: contraste de «Remove» en *hover* sobre una fila con error, porque es AX5 (anotado en su fila).
- descartado (para la spec 0005): «Remove Time Slot» como enlace con nombre repetido, asterisco sin explicar, bloques de imagen y audio sin grupo, sin `fieldset` por día, «Add Time Slot» sin mover el foco, porque son mejoras sin incumplimiento medido (el `fieldset`, con AX3/AX4).
- descartado: `alt=""` en la vista previa, porque es discutible.
- descartado: `scrollIntoView` suave, porque 2.3.3 es AAA.
- descartado: clave de la línea base sensible al DOM, porque es el diseño del ADR 0023.
- descartado: las entradas de PHPStan de la zona, porque son ruido.
- descartado: `pleaseSelectProgram` con dos sentidos, porque es inocuo.

Zona 4 (4.5; detalle en [`audit/blocks.md`](audit/blocks.md) §5):
- descartado: programas publicados con contraseña visibles en los bloques, porque la contraseña la pone un administrador y el CPT no es público.
- descartado: un colaborador lee por `block-renderer` el horario de todas las emisoras publicadas, porque son los mismos datos que ya se publican.
- descartado: `esc_attr()` del `alt` antes de `wp_get_attachment_image()`, porque no codifica dos veces.
- descartado (sospecha para el triage): el aviso del editor dice «or starting soon» y no se muestra un «Coming up» sin programa en antena, porque es el contrato (§3.5).
- descartado (para la spec 0005): «Radio Station» + índice concatenado (el pendiente de la zona 1) y los dos puntos y el « - » fuera de las cadenas, porque no hay bug visible.
- descartado: `alt` redundante, dos enlaces al mismo destino, `target="_blank"` sin aviso, «—» y sin `aria-current`, porque son mejoras sin incumplimiento medido de AA y tocan el markup.
- descartado: contraste del aviso del editor (`opacity: 0.6`), porque solo sale en el editor, depende del tema y no se ha medido.
- descartado: `$radplapag_schedule_day_map` sin uso, porque es inocua y un tercero podría leerla.
- descartado: `version` 1.0.0 de los `block.json` y `package.json` sin `license`, porque es informativo.
- descartado: `dayOrder` sin `enum`, porque el render y el editor normalizan.
- descartado: defaults en tres sitios, porque coinciden.
- descartado: consultas repetidas de `radplapag_get_config()`, porque es rendimiento sin efecto visible.
- descartado: §3.5 (`[ etiquetas ]`) y §3.4 sin las funciones del horario y la lista, porque es redacción de `SPEC.md` (para el cierre).
- descartado: `TypeError` con `$day_order` nulo, porque nadie la llama así.
- descartado: `now-playing` sin `save`, porque core lo pone por defecto y el e2e pasa en WP 6.6.
- descartado: la franja de ayer al final con `current_first`, porque la lista empieza por hoy.
- descartado: `<figure>` vacío con el logo borrado, porque es cosmético y artificial.
- descartado: la lista de programas no marca «(Rerun)», porque el player tampoco.
- descartado: un programa no publicado en antena que tape a otro, porque sin solapes no puede pasar.
- descartado: `now-playing` desfasado con caché de página, porque es el diseño de un bloque dinámico.
- descartado: las entradas de PHPStan de la zona, porque son ruido.

Zona 5 (4.6; detalle en [`audit/player.md`](audit/player.md) §5):
- descartado: contraste de «On Air» a mitad del parpadeo, porque axe no da violación con la animación parada al 50 %.
- descartado: `color-contrast` de «Connecting...» en WebKit durante la carga, porque es su parpadeo (K60).
- descartado: botón del temporizador sin `aria-haspopup`/`aria-expanded`, porque el menú se anuncia y funciona con teclado.
- descartado (para el triage o la spec 0005): `aria-valuetext` del volumen, anuncios de la cuenta atrás y del programa, nombre de los diálogos con «Close», `alt` redundantes, tarjetas sin lista ni encabezado, «Show more» genérico, «Back to today» sin foco, botones deshabilitados sin explicación y diferencia horaria sin unidad, porque son mejoras sin incumplimiento AA medido.
- descartado: `prefers-reduced-motion` fuera del parpadeo, porque 2.3.3 es AAA.
- descartado: foco visible que depende de `index.css`, porque hoy se ve.
- descartado: contraste de los temas y objetivos táctiles, porque pasan.
- descartado: canvas con nombre también parado, porque es C15 (canvas) y zona congelada.
- descartado: horarios del modal de programas desde el domingo, porque ya está fijado y no hay contrato de orden.
- descartado (sospecha para el triage): dos `play()` concurrentes con HLS dejan vivo el primer `Hls`, porque no se ha podido fijar ni ver en e2e.
- descartado (sospecha): `pause()` durante la carga de un MP3 da «Unable to play», porque no se ha medido en navegador.
- descartado (prueba manual): `play()` fuera del gesto con `hls.js` en Safari, temporizador con la pantalla bloqueada en iOS y `100vh` en Safari de iOS, porque necesitan un dispositivo o el Safari real.
- descartado: Media Session que se reinicia en cada cambio de estado, porque no tiene efecto visible medido.
- descartado: desmontaje durante el `import()`, porque el dashboard nunca se desmonta.
- descartado (para la spec 0006): `use-config` sin validar la forma de programas y horario y sin ErrorBoundary, porque PHP siempre emite la forma del contrato.
- descartado (para la spec 0005): `:` fuera de `t()` y decimales con punto, porque no hay bug visible con las traducciones actuales.
- descartado: `timezoneOffset` limitado a −12…14, porque cubre todas las zonas reales.
- descartado: errores de `tsc` estricto, `set-state-in-effect` y avisos de `player/coverage/`, porque son ruido.

## Verificación de la fase
- `npm run check` en verde (incluye PHPStan).
- `npm run test:php:integration` y `npm run test:e2e` tras `npm run env:start:min` y tras `npm run env:start:latest`.
- `git diff --stat origin/trunk...HEAD` sin cambios en código publicado en esta fase.
- CI del PR #37 en verde, con el job `PHPStan`.
