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
- [ ] hecha · commit: —

### 4.2 Auditoría · zona 1, PHP del núcleo (≤ 1 h)
- Qué: skill `audit` sobre los archivos de la zona 1. Estáticas: PHPCS (y los `phpcs:ignore` de la zona con su motivo), las entradas de la baseline de PHPStan de la zona (cada una: ¿bug o ruido?), `.claude/rules/security.md` y `wordpress-org.md`. Revisión: `/code-review` a esfuerzo alto con la lista de archivos, `wp-security-reviewer`, `wporg-reviewer` y `backcompat-reviewer`. Contraste: `SPEC.md` §3 (globales, capacidades, CPT, meta) y §4 (página limpia); filas C9, C11, K7, K17 (¿variantes en otros sitios?). Candidatos ya vistos: `switch_to_blog( string )` en `uninstall.php:82`.
- Archivos: `docs/specs/0002-safety-net/audit/core.md`, `docs/known-issues.md`, tests `currently` en `tests/php/{unit,integration}/` o `tests/e2e/`.
- Test: caracterización (`characterize`): un test `currently` por hallazgo confirmado, visto fallar con una mutación temporal.
- Verificación: `npm run check && npm run test:php:integration`
- [ ] hecha · commit: —

### 4.3 Auditoría · zona 2, migración y actualización (≤ 1 h)
- Qué: lo mismo sobre `includes/migration/` y `includes/radplapag-upgrade.php`. Contraste: invariante 3 (unidireccional e idempotente; ADR 0005, 0010), bloqueo `radplapag_migrating`, avisos y descarte con nonce, `upgrader_process_complete`; filas K4 y C11. Candidato ya visto: la negación siempre falsa de `radplapag-upgrade.php:42`. Revisores: `/code-review`, `wp-security-reviewer`, `backcompat-reviewer` (`wporg-reviewer` solo si toca avisos del admin).
- Archivos: `audit/migration.md`, `docs/known-issues.md`, tests en `tests/php/integration/Migration/`.
- Test: caracterización, como en 4.2.
- Verificación: `npm run check && npm run test:php:integration`
- [ ] hecha · commit: —

### 4.4 Auditoría · zona 3, admin PHP + JS (≤ 1 h)
- Qué: lo mismo sobre `admin/` y los meta boxes y guardados. Estáticas: PHPCS, PHPStan (baseline de la zona: `esc_attr( int )`, `isset( $screen->id )`), ESLint de la raíz. Revisión: `/code-review`, `wp-security-reviewer` (nonces, capacidades, saneado, transients de error), `wporg-reviewer` (avisos, i18n, `translators`), `a11y-reviewer` con la línea base de axe. Huecos del ADR 0023 de esta zona, cerrados con e2e en `tests/e2e/a11y.spec.ts`: axe sobre una franja añadida con «Add Time Slot» y sobre el meta box con errores de validación a la vista (las violaciones que ya están en la línea base no son nuevas; una nueva se apunta con su fila `axe` y se añade a la línea base con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`, decisión del usuario apuntada aquí, ADR 0023). Contraste: filas C3, C10, C13, K5, K15, K16, K19, K20, AX2–AX4.
- Archivos: `audit/admin.md`, `docs/known-issues.md`, `tests/js/admin/`, `tests/php/integration/`, `tests/e2e/{admin,a11y}.spec.ts`, `tests/e2e/a11y-baseline.json` (solo si el usuario lo aprueba).
- Test: caracterización, como en 4.2.
- Verificación: `npm run check && npm run test:php:integration && npx playwright test tests/e2e/admin.spec.ts tests/e2e/a11y.spec.ts`
- [ ] hecha · commit: —

### 4.5 Auditoría · zona 4, bloques (≤ 1 h)
- Qué: lo mismo sobre los tres bloques y sus `includes/radplapag-*-block.php`. Estáticas: PHPCS, PHPStan (zona: `is_array`/`is_string` redundantes, `radplapag-programs-list-block.php:133`), `wp-scripts lint-js` de cada bloque. Revisión: `/code-review`, `wp-security-reviewer` (escape en `render.php`), `wporg-reviewer` (dependencias de core no empaquetadas en `build/`), `backcompat-reviewer` (markup y atributos), `a11y-reviewer`. Hueco del ADR 0023: el bloque `now-playing` sin programa según el reloj real; se cierra sembrando en `tests/e2e/fixtures/seed-e2e.php` una emisora con una franja de 24 h en cada día (`start == end`, que el servidor acepta, C3), para que siempre haya programa en antena, y pasando axe sobre ella en `a11y.spec.ts`. Contraste: C10, C16 (variante en los tres bloques), K6.
- Archivos: `audit/blocks.md`, `docs/known-issues.md`, `tests/php/integration/Blocks/`, `tests/e2e/fixtures/seed-e2e.php`, `tests/e2e/{blocks,a11y}.spec.ts`.
- Test: caracterización, como en 4.2.
- Verificación: `npm run check && npm run test:php:integration && npx playwright test tests/e2e/blocks.spec.ts tests/e2e/a11y.spec.ts`
- [ ] hecha · commit: —

### 4.6 Auditoría · zona 5, player sin visualizadores (≤ 1 h)
- Qué: skill `audit` sobre `player/src` menos el ADR 0018. Estáticas, **solo como informe** (configuración del player intacta): `tsc` con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` desde un tsconfig temporal en el scratchpad (17 errores fuera de tests y zona congelada), y ESLint con `eslint-plugin-react-hooks@7` y sus reglas estrictas desde una configuración temporal en el scratchpad (`npx`); `npm --prefix player run lint`/`typecheck` normales. Revisión: `/code-review` a esfuerzo alto, `a11y-reviewer` (línea base de axe, C15, AX1, AX2), y comprobación de «ninguna petición a terceros» (`player.md`). Huecos de `contract-map.md` cerrados con e2e: orden de detección i18n en el navegador (`SPEC.md` §4), un directo OGG que suena (`tests/fixtures/audio/tone.ogg`, ya servido) y DASH sin CORS (`currently`, fila K1/C1). Contraste: C1, C2, C4, C6–C9, C15, C16, K1, K8–K14, K18.
- Archivos: `audit/player.md`, `docs/known-issues.md`, `player/src/**/*.test.ts(x)`, `tests/e2e/{i18n,cross-origin,mp3}.spec.ts` (o uno nuevo `ogg.spec.ts`), `tests/e2e/fixtures/seed-e2e.php` (variantes OGG y DASH sin CORS si faltan), `docs/specs/0002-safety-net/contract-map.md`.
- Test: caracterización, como en 4.2 (e2e esperando a eventos, no a timeouts).
- Verificación: `npm run check:player && npx playwright test tests/e2e/i18n.spec.ts tests/e2e/cross-origin.spec.ts tests/e2e/mp3.spec.ts`
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
- **Huecos que no se puedan cerrar sin tocar código publicado:** se para y se pregunta (spec §0.4); se quedan anotados en el informe de la zona.

## Descartados
(Se rellena durante la fase: «descartado: … porque …», uno por línea.)

## Verificación de la fase
- `npm run check` en verde (incluye PHPStan).
- `npm run test:php:integration` y `npm run test:e2e` tras `npm run env:start:min` y tras `npm run env:start:latest`.
- `git diff --stat origin/trunk...HEAD` sin cambios en código publicado en esta fase.
- CI del PR #37 en verde, con el job `PHPStan`.
