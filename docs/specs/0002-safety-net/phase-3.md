# Spec 0002 · Fase 3 — Formateo masivo
Estado: en curso · Inicio: 2026-10-17 · ADRs: 0021, 0018, 0014, 0008

## Contexto
Medido al planificar (2026-10-17), con los estándares completos y sin líneas base:

- **PHPCS:** 965 violaciones en 18 archivos; `phpcbf` arregla 808 (23 sniffs). Quedan a mano: Yoda (90), `InlineComment.InvalidEndChar` (15), docblocks y file comments (`MissingShort` 6, `FileComment.Missing` 5, `MissingPackageTag`, `DuplicatePackageTag`, `LongNotCapital`), parámetros sin usar de callbacks enganchados (5 funciones), las tres de ADR 0021 (`NonEnqueued*`, `file_get_contents`) y `scripts/fixtures/seed.php` (19 globales sin prefijo, 3 `@param`, 2 `SlowDBQuery`).
- **Ensayo de `phpcbf` sobre una copia** con una comparación de tokens (sin espacios ni comentarios; `array()` ≡ `[]`, `dirname(__FILE__)` ≡ `__DIR__`, `$i++;` ≡ `++$i;`, coma final, `<?php` + espacio/salto): todo equivalente y el `T_INLINE_HTML` idéntico, **salvo `blocks/now-playing/render.php`**. Ahí `Squiz.ControlStructures.ControlSignature.NewlineAfterOpenBrace` parte `</strong><?php if ( … ) : ?> <?php esc_html_e( '(Rerun)' … ); ?><?php endif; ?></a>` en varias líneas y mete `\n\t\t\t\t\t` en el HTML de salida (líneas 59 y 61). Eso cambiaría el markup del bloque (invariante 2).
- **ESLint `admin/js`:** 1.146 problemas; `--fix` arregla 1.115 (`prettier/prettier`, `curly`, casi todos los `no-var`). Quedan 31 en `station-admin.js`, todos mecánicos: `catch ( err )` sin usar (2), variables sin usar de cálculos puros (`nextEndForOverlap`, `endMin`), `no-unused-vars-before-return` (lecturas puras antes de un `return` temprano), `var` redeclarado en bloques hermanos (`errMsg`, `dayWrapper` → `const` por bloque), `no-shadow` (4, renombrar la interna), `p.id != null` → `p.id !== null && p.id !== undefined`, `document.activeElement` → `programRow.ownerDocument.activeElement`.
- **Bloques:** 13–14 problemas `prettier/prettier` por bloque (los arregla `--fix`) y un `jsdoc/empty-tags` por bloque (`@package radio-player-page` en `src/index.js`).
- **Player:** los 8 archivos de la línea base de `.prettierignore` no pasan `prettier --check`; `src/config/visualizers.ts` se queda fuera (ADR 0018).
- Las dos funciones de capacidades (`user_has_cap`, 4 argumentos), los dos `render.php` con `$content, $block` y `radplapag_admin_scripts( $hook_suffix )` tienen la firma fijada por el hook o por el contrato de callbacks (`SPEC.md` §3.4, con nº de argumentos testeado): no se quitan parámetros, van con `// phpcs:ignore` y su motivo.

## Objetivo
Código formateado con los estándares completos y sin bloques de línea base (ADR 0021), sin cambiar el comportamiento: la red en verde antes y después y los builds idénticos (§4.6).

## Criterios de aceptación
| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A7: sin líneas base de formato | `phpcs.xml.dist`, `eslint.config.mjs`, los tres `blocks/*/.eslintrc.json` sin bloque de línea base, y `player/.prettierignore` solo con `visualizers.ts` (comentado); `npm run check` en verde |
| `phpcbf` no cambia el código PHP más allá del formato | comparación de tokens (§Contexto) sobre el commit de 3.1, sin diferencias salvo las normalizadas; snapshots de integración y HTTP sin reescribir |
| La red en verde antes y después | `npm run check`; `npm run test:php:integration` y `npm run test:e2e` con `env:start:min` y con `env:start:latest` (en `close-phase`); CI del PR #37 |
| Builds idénticos | tras 3.5 y 3.6, `git status --porcelain player/dist blocks/*/build` vacío |
| Los commits de formato no ensucian el blame | `.git-blame-ignore-revs` con los SHAs de los `style(0002)`; `git blame --ignore-revs-file .git-blame-ignore-revs` sobre un archivo formateado devuelve los commits anteriores |
| `phpcbf` activo en el hook | `tests/hooks/format-edited-file.test.sh` (un PHP mal formateado sale formateado) |

## Tareas

### 3.1 `phpcbf` en la parte WordPress (≤ 1 h)
- Qué: antes, en `blocks/now-playing/render.php`, poner `// phpcs:disable Squiz.ControlStructures.ControlSignature.NewlineAfterOpenBrace -- Inline markup: a line break here would change the block's HTML output.` en el bloque PHP de antes del `<header>` y `phpcs:enable` en el de después, sin tocar el HTML. Luego `npm run format:php` (la línea base todavía está, así que se pasa `phpcbf` con el ruleset completo de una copia temporal de `phpcs.xml.dist` sin el bloque de línea base). Comparar tokens antes/después de cada archivo con el script del scratchpad.
- Archivos: los 18 PHP de §Contexto (`radio-player-page.php`, `uninstall.php`, `admin/*.php`, `blocks/*/render.php`, `includes/**`, `scripts/fixtures/seed.php`).
- Test: caracterización (ya existe: integración, snapshot HTTP de la página limpia, snapshots de bloques, e2e).
- Verificación: `npm run check && npm run test:php:integration && npx playwright test tests/e2e/clean-page.spec.ts tests/e2e/blocks.spec.ts`
- Resultado (2026-10-17):
  - El sniff también salta en la línea 99 (cabecera «Coming up» del programa siguiente), así que el `phpcs:disable` va en el bloque PHP de antes del `<div>` y el `phpcs:enable` en el bloque PHP final (`} )( $attributes );`), y cubren toda la plantilla. Los dos comentarios van dentro de bloques PHP que ya existían: el HTML no cambia.
  - `phpcbf` con el ruleset completo (copia de `phpcs.xml.dist` sin la línea base, en el scratchpad): 805 arreglos en los 18 archivos (los 808 medidos menos los 3 del sniff desactivado). Quedan 143 errores y 14 avisos para 3.2–3.3.
  - Comparación de tokens (`tokcmp.php` en el scratchpad, con las normalizaciones de §Contexto) de los 18 archivos: `tokens=same html=same` en todos. El script detecta un cambio de operador y un cambio en el HTML (mutaciones de comprobación).
  - `npm run check` en verde; integración 347/347; `clean-page.spec.ts` + `blocks.spec.ts`: 22 en verde y 18 omitidos (los casos HTTP solo corren en Chromium). Ningún snapshot reescrito.
- [x] hecha · commit: `0b7ee8d`

### 3.2 PHPCS a mano en el código publicado: Yoda, comentarios y docblocks (≤ 1 h)
- Qué: las 90 Yoda (solo invertir los operandos de `===`, `!==`, `==`, `!=`), puntuación final de los comentarios en línea, short descriptions que faltan, file comments de `admin/admin.php`, `admin/admin-strings.php`, `includes/radplapag-stations.php`, `blocks/{programs-list,schedule}/render.php`, `@package` en el file comment de `radio-player-page.php` (debajo de la cabecera, sin tocar sus campos) y quitar el `@package` duplicado de `uninstall.php`. Ningún cambio fuera de comparaciones y comentarios.
- Archivos: los del plugin publicado de §Contexto.
- Test: caracterización (la misma red).
- Verificación: `npm run check && npm run test:php:integration`
- Resultado (2026-10-17):
  - Las 90 Yoda invertidas con un script (solo `$var OP literal` → `literal OP $var`) y las dos de `( … ) % 7` a mano; el diff, revisado línea a línea, solo cambia el orden de los operandos.
  - Los file comments de `admin/admin.php`, `admin/admin-strings.php` e `includes/radplapag-stations.php` ya existían, pero detrás de `defined( 'ABSPATH' ) || exit;` (y del `require_once` en `radplapag-stations.php`): suben a la cabecera y el código va debajo, sin cambiar. Los dos `render.php` reciben un file comment nuevo; el docblock de la función se queda como estaba.
  - Con el ruleset completo quedan 38 violaciones, todas de 3.3 (`seed.php`, `UnusedFunctionParameter`, `NonEnqueued*`, `file_get_contents`).
  - `npm run check` en verde; integración 347/347; `clean-page.spec.ts` + `blocks.spec.ts`: 22 en verde y 18 omitidos. Ningún snapshot reescrito.
- [x] hecha · commit: `66d049f`

### 3.3 Supresiones justificadas, `seed.php` y fuera la línea base de PHPCS (≤ 1 h)
- Qué: `// phpcs:ignore` en su línea, con el motivo, para `NonEnqueuedScript`/`NonEnqueuedStylesheet` (página limpia sin tema, ADR 0008), `file_get_contents` (`manifest.json` local) y `UnusedFunctionParameter` en los cinco callbacks de firma fija. En `scripts/fixtures/seed.php`: prefijo `radplapag_` en sus globales, los `@param` que faltan y `phpcs:ignore` de `SlowDBQuery` como en `seed-e2e.php`. Borrar el bloque de línea base de `phpcs.xml.dist`.
- Archivos: `phpcs.xml.dist`, `radio-player-page.php`, `admin/admin.php`, `blocks/{programs-list,schedule}/render.php`, `includes/radplapag-{program,station}-cpt.php`, `scripts/fixtures/seed.php`.
- Test: caracterización; `seed.php` lo ejecuta el `global-setup` del e2e.
- Verificación: `npm run lint:php && npm run check && npm run test:php:integration && npm run test:e2e`
- Resultado (2026-10-17):
  - Sin el bloque de línea base quedaban 38 violaciones en 7 archivos, las previstas. Ocho `phpcs:ignore` en su línea con el motivo: `file_get_contents` y `NonEnqueuedStylesheet`/`NonEnqueuedScript` en `radplapag_output_clean_page()` (ADR 0008), y `UnusedFunctionParameter` en `radplapag_admin_scripts()` (`admin_enqueue_scripts`, 1 arg), los dos `render_callback` y los dos filtros de `user_has_cap` (4 args).
  - `seed.php`: las 18 variables globales llevan `radplapag_` (solo fuera de las dos funciones; las locales siguen igual), `@param`/`@return` en sus dos funciones y `phpcs:ignore` de `SlowDBQuery` en `meta_key`/`meta_value` como en `seed-e2e.php`; `phpcbf` realinea las asignaciones.
  - `phpcs.xml.dist` sin la línea base: `npm run lint:php` limpio con el estándar completo.
  - `npm run check` en verde (builds sin cambios); integración 347/347; e2e completo: 148 en verde y 22 omitidos.
- [x] hecha · commit: `92d3f8a`

### 3.4 `admin/js`: `eslint --fix`, los 31 a mano y fuera su línea base (≤ 1 h)
- Qué: `npx eslint --fix admin/js` sin los bloques de línea base de `eslint.config.mjs` (se borran en este commit), luego los 31 restantes de §Contexto. Cualquiera que no sea mecánico: para y pregunta.
- Archivos: `admin/js/station-admin.js`, `admin/js/program-admin.js`, `eslint.config.mjs`.
- Test: caracterización (Vitest de la raíz sobre `tests/fixtures/admin/station-meta-box.html`, e2e del admin).
- Verificación: `npm run lint:js && npm test && npx playwright test tests/e2e/admin.spec.ts`
- Resultado (2026-10-17):
  - Sin los dos bloques de línea base, `eslint --fix` deja 28 errores en `station-admin.js` (los 31 medidos contaban aparte avisos repetidos de las mismas líneas), todos de §Contexto y mecánicos: `catch {}` sin variable (2); fuera `nextEndForOverlap`/`nextEndMin` (sin uso) y `endMin` del día anterior; `allRows` tras el `return` temprano de `checkOverlaps()` (su único llamante ya usa `dayWrapper` antes, así que no cambia nada si fuera `null`) y `startMin` justo antes del bucle del día anterior; `errMsg` y `dayWrapper` pasan a `const` en su bloque; `p.id !== null && p.id !== undefined`; las `programsList` internas pasan a `dayProgramsList` (parámetro de `sortProgramsByStartTime()` y dos locales); `programRow.ownerDocument.activeElement`.
  - `program-admin.js` solo cambia por `--fix`.
  - `npm run lint:js`: 0 errores (los 2 avisos de `tests/js/admin/program-admin.test.js` ya estaban); Vitest 115/115; `admin.spec.ts` 24/24 (Chromium y WebKit); `npm run check` en verde.
- [x] hecha · commit: `78c113f`

### 3.5 Bloques: lint `--fix`, `@package` vacío y fuera los `overrides` (≤ 1 h)
- Qué: en cada bloque, `npx wp-scripts lint-js --fix src`, `@package` sin valor en `src/index.js` (comentario; no llega al build) y `.eslintrc.json` sin `overrides`. Rebuild; el build debe salir idéntico.
- Archivos: `blocks/*/src/*.js`, `blocks/*/.eslintrc.json`.
- Test: caracterización (snapshots de render en integración, `blocks.spec.ts`).
- Verificación: `npm run check:blocks && git status --porcelain blocks/*/build` (vacío)
- Resultado (2026-10-17):
  - Los tres `.eslintrc.json` se quedan solo con `root` y `extends`. `@package` sin valor en los tres `src/index.js` (`jsdoc/empty-tags`); `lint-js --fix` arregla el resto (`prettier/prettier`: saltos de línea y comillas simples en los `import` de `now-playing`). Sin errores restantes ni cambios a mano en el código; `git diff -w` solo muestra saltos de línea, comillas y comas finales.
  - `npm run check:blocks` en verde y `git status --porcelain blocks/*/build` vacío: builds idénticos. `npm run check` en verde; `blocks.spec.ts` 4/4 (Chromium y WebKit). Los `render.php` no cambian, así que los snapshots de integración no se tocan.
- [x] hecha · commit: `882ffa6`

### 3.6 Player: `prettier --write` y `.prettierignore` solo con la zona congelada (≤ 1 h)
- Qué: quitar de `player/.prettierignore` los siete archivos que no son visualizadores; dejar `src/config/visualizers.ts` con un comentario («Frozen zone (ADR 0018): not reformatted»). `npm --prefix player run format`. Rebuild; `dist/` idéntico.
- Archivos: `player/.prettierignore`, `player/src/hooks/use-program-schedule.tsx`, `player/src/types/global.ts`, `player/src/utils/{program-schedule,timezone}.ts`, `player/{eslint.config.js,tsconfig.json,vite.config.ts}`.
- Test: caracterización (Vitest del player con cobertura).
- Verificación: `npm run check:player && npm --prefix player run build && git status --porcelain player/dist` (vacío)
- Resultado (2026-10-17):
  - `.prettierignore` se queda con las entradas de siempre (`node_modules`, `dist`, …) y `src/config/visualizers.ts` bajo el comentario de la zona congelada. `prettier --write` reescribe justo los siete archivos previstos; `git diff -w` solo muestra saltos de línea, puntos y coma (en `global.ts`) y comas finales. `visualizers.ts` no cambia.
  - `npm run check:player` en verde (tsc, ESLint, Prettier, Vitest 253/253 con cobertura); `npm --prefix player run build` y `git status --porcelain player/dist` vacío: `dist/` idéntico. `npm run check` en verde.
- [x] hecha · commit: `f2edaa4`

### 3.7 `phpcbf` en el hook de formato (≤ 1 h)
- Qué: test primero en `tests/hooks/format-edited-file.test.sh`: el caso «leaves a valid legacy PHP file untouched» pasa a «formats PHP with phpcbf» (un PHP mal sangrado en `$SCRATCH` sale con tabs y `array()`), en rojo; luego `PHPCBF_ENABLED=true` y el comentario de cabecera al día.
- Archivos: `.claude/hooks/format-edited-file.sh`, `tests/hooks/format-edited-file.test.sh`.
- Test: primero (TDD): `tests/hooks/format-edited-file.test.sh`.
- Verificación: `npm run test:hooks`
- [ ] hecha · commit: —

### 3.8 `.git-blame-ignore-revs` y rules al día (≤ 1 h)
- Qué: `.git-blame-ignore-revs` con los SHAs completos de 3.1–3.6, cada uno con su línea de comentario; nota de uso (`git config blame.ignoreRevsFile .git-blame-ignore-revs`) en el propio archivo. Quitar de `.claude/rules/{php,admin,player}.md` la mención a la línea base «hasta la 0002» (queda: estándar completo; en el player, `visualizers.ts` fuera de Prettier por ADR 0018). Comprobar que el zip no cambia.
- Archivos: `.git-blame-ignore-revs`, `.claude/rules/php.md`, `.claude/rules/admin.md`, `.claude/rules/player.md`.
- Test: checklist manual: `git blame --ignore-revs-file .git-blame-ignore-revs admin/js/station-admin.js` no muestra commits de 3.4.
- Verificación: `npm run check:zip && git blame --ignore-revs-file .git-blame-ignore-revs -- admin/js/station-admin.js | grep -c "$(git log -1 --format=%h --grep='(3.4)')"` (0)
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- **Supresiones en línea en lugar de cambiar código** (`now-playing/render.php` y los cinco callbacks de firma fija): cumplen el ADR 0021 (sin línea base, cada excepción en su línea con su motivo) y el invariante 2; no hace falta ADR. Se apuntan como desviación de §4.6, que solo preveía tres `phpcs:ignore`.
- **Commits a mano separados de los automáticos** (3.2–3.4): §4.6 pide uno por proyecto; la parte WordPress va en tres (`phpcbf`, a mano, supresiones) para que el de `phpcbf` se pueda comparar por tokens. Desviación menor, en `docs/status.md`.

## Verificación de la fase
- `npm run check` en verde.
- `npm run test:php:integration` y `npm run test:e2e` tras `npm run env:start:min` y tras `npm run env:start:latest`.
- `git diff --stat origin/trunk -- player/dist blocks/*/build`: sin cambios en esta fase.
- CI del PR #37 en verde.
