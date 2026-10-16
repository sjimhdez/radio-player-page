# Spec 0001 · Fase 1 — Bootstrap: herramientas e ingeniería de contexto
Estado: en curso · Inicio: 2026-10-16 · ADRs: 0008–0022 (previstos)

## Contexto
La fase 0 está cerrada (informe [`docs/spikes/0001-phase-0.md`](../../spikes/0001-phase-0.md), «Para la fase 1»; ADRs 0001–0007). Medido al planificar (2026-10-16):

- **WPCS sobre el PHP actual:** 906 violaciones en 34 sniffs; `phpcbf` arregla 773 (indentación, arrays cortos, alineación). No las arregla: Yoda (90), comentarios (~30), parámetros sin usar (11), `file_get_contents` (1), recursos no encolados (2). **PHPCompatibilityWP `7.4-`: 0.** El formateo masivo es de la 0002 (§7.4), así que esta fase no puede exigir WPCS completo (ADR 0021).
- La rama está al día con `origin/trunk`. `v3.4.2` ya tiene `scripts/build-release-zip.sh`: el zip de referencia sale del tag.
- `player/.nvmrc` = `20.19.2` y `player/package.json` usa el campo no estándar `"node": "20"`. Los bloques no tienen script de lint. La CI no compila `now-playing` (K2) ni se dispara con `push` a `trunk`.

## Objetivo
Dejar el repo listo para trabajar con specs y tests **sin cambiar ningún comportamiento del plugin**: herramientas de test y calidad con suites de humo, ingeniería de contexto (§7), `SPEC.md`, ADRs retroactivos, `docs/known-issues.md` y la CI de §9. Criterio de riesgo 7: todo funciona, no todo está completo.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| `npm run check` en verde | `npm run check` en la raíz (orquesta raíz + `player/` + cada bloque) |
| CI en verde en el PR #36 | `gh pr checks 36` |
| El zip tiene **la misma lista de archivos** que el de `v3.4.2` | `tests/zip/compare-with-v3.4.2.sh` (en `npm run check:zip` y en la CI) |
| El zip no contiene rutas de desarrollo (`CLAUDE.md`, `.claude/`, `.mcp.json`, `docs/`, `SPEC.md`, `tests/`, `spike/`, `scripts/`, `composer.*`, configs) | el mismo script, sección de rutas prohibidas |
| PHPUnit unit (sin WP) en verde en PHP 7.4 y 8.4 | `npm run test:php:unit`; job de CI con la matriz |
| PHPUnit integración en verde en PHP 7.4 + WP 6.6 y PHP 8.4 + última WP, sin tocar la BD de desarrollo | `npm run test:php:integration` con `WP_ENV_*` de cada punta; job de CI matricial |
| Vitest del player y de la raíz, y Playwright (Chromium + WebKit) en verde con sus humos | `npm --prefix player test`, `npm test`, `npm run test:e2e` |
| `player/dist/` y `blocks/*/build/` idénticos tras compilar con Node 26 | `git diff --exit-code` tras los builds (CI) |
| Una sesión nueva recibe `status.md` al arrancar | `tests/hooks/session-context.test.sh` |
| Los 4 hooks hacen lo de §7.4 | `npm run test:hooks` |
| `write-spec`, `start-phase` y `close-phase` existen y pasan una prueba en seco | checklist de 1.31, resultado apuntado en este plan |
| Ningún archivo publicado cambia | `git diff --stat origin/trunk -- radio-player-page.php includes admin blocks/*/render.php blocks/*/block.json blocks/*/src player/src player/dist blocks/*/build uninstall.php readme.txt` vacío al cerrar |

## Tareas

### 1.1 Comprobar la documentación oficial de Claude Code (≤ 1 h)
- Qué: leer en la documentación vigente (code.claude.com/docs) el formato de memoria (`CLAUDE.md`, `CLAUDE.local.md`, imports), settings (permisos, sintaxis `Bash(...)`, `Read(...)`), rules (`.claude/rules/*.md`, frontmatter `paths:`), skills (`SKILL.md`, frontmatter, `disable-model-invocation`), hooks (eventos, `matcher`, entrada JSON, salida `decision: block`/`additionalContext`, códigos de salida), subagentes (`.claude/agents/*.md`, `tools`) y `.mcp.json`. Apuntar en «Decisiones abiertas» cualquier diferencia con §7 (manda la documentación).
- Archivos: este plan (sección de notas).
- Test: —
- Verificación: notas con enlace y fecha por mecanismo.
- [x] hecha · commit: ed5abd7

### 1.2 Node 26 y archivos base (≤ 1 h)
- Qué: `.nvmrc` (`26`) en la raíz, `player/` y cada bloque; `engines.node: ">=22.22.2"` en `player/package.json` (sustituye a `"node": "20"`) y en cada bloque; `.editorconfig` (tabs en PHP/JS de WP, 2 espacios en `player/` según su Prettier); `.gitignore` con `vendor/`, `coverage/`, `test-results/`, `playwright-report/`, `playwright/.auth/`, `.phpunit.result.cache`, `CLAUDE.local.md`, `.claude/settings.local.json`. Línea de Node de `README.md` (Developers) a Node 26 (ADR 0002).
- Archivos: `.nvmrc`, `player/.nvmrc`, `blocks/*/.nvmrc`, `player/package.json`, `blocks/*/package.json`, `.editorconfig`, `.gitignore`, `README.md`.
- Test: —
- Verificación: `npm --prefix player ci && npm --prefix player run build && git diff --exit-code player/dist` (Node 26); ídem en cada bloque. `package-lock.json` sin más cambio que `engines`.
- [x] hecha · commit: 3b7a9a3

### 1.3 `package.json` de la raíz y wp-env (dev + tests) (≤ 1 h)
- Qué: `package.json` raíz (privado, GPL, `engines`) solo con herramientas de la parte WordPress, versiones exactas del censo: `@wordpress/env` 11.17.0, `@playwright/test` 1.64.1, `vitest` + `@vitest/coverage-v8` 5.0.5, `@wordpress/eslint-plugin` y `eslint` (últimas). `.wp-env.json` de desarrollo (última WP, PHP 8.4, mapea el plugin) y `.wp-env.tests.json` aparte (`--config`, puertos propios, `testsEnvironment: false`) cuyo `core`/`phpVersion` se fija por `WP_ENV_CORE`/`WP_ENV_PHP_VERSION` para las dos puntas (R1). Scripts `env:start`, `env:start:min`, `env:start:latest`, `env:stop`, `env:reset`.
- Archivos: `package.json`, `package-lock.json`, `.wp-env.json`, `.wp-env.tests.json`.
- Test: —
- Verificación: `npm run env:start:min` y `npx wp-env --config .wp-env.tests.json run cli wp core version` → 6.6.x; ídem latest → 7.1.x; comprobar que la BD de tests no es la de desarrollo (una opción escrita en una no aparece en la otra).
- Resultado: desarrollo en `:8886` (el `:8888` lo usa el entorno de `podcast-player-page`), tests en `:8890`. Tests mínima: WP 6.6.10 + PHP 7.4.33; latest: WP 7.1.3 + PHP 8.4.26. Una opción escrita en tests no aparece en desarrollo.
- [x] hecha · commit: 465983d

### 1.4 Composer y PHPCS (≤ 1 h)
- Qué: `composer.json` solo `require-dev`: `phpunit/phpunit ^9.6`, `yoast/phpunit-polyfills ^4.0`, `wp-coding-standards/wpcs ^3`, `phpcompatibility/phpcompatibility-wp`, `dealerdirect/phpcodesniffer-composer-installer`; `config.platform.php = 7.4.33`. `phpcs.xml.dist`: `WordPress` + `PHPCompatibilityWP` con `testVersion 7.4-`, `minimum_wp_version 6.6`, prefijos `radplapag`/`RADPLAPAG`/`RadioPlayerPage`, text domain; excluye `vendor`, `node_modules`, `spike`, `*/build/*`, `player/`. **Las 34 sniffs que hoy fallan se excluyen una a una** en un bloque comentado «re-enable in spec 0002 after phpcbf» (ADR 0021). Scripts `lint:php`, `format:php` (no se ejecuta en esta fase).
- Archivos: `composer.json`, `composer.lock`, `phpcs.xml.dist`, `package.json`.
- Test: —
- Verificación: `composer install && npm run lint:php` (0 errores); quitar temporalmente una exclusión → falla (y se revierte).
- Resultado: la línea base no excluye sniffs enteras, sino **cada sniff solo en los archivos donde falla hoy** (39 sniffs, 965 violaciones, incluido `scripts/fixtures/seed.php`); los archivos nuevos se comprueban con WPCS completo. Mutación: sin el bloque de Yoda salen 90 errores en 13 archivos.
- [x] hecha · commit: 4850752

### 1.5 PHPUnit unit (sin WP) (≤ 1 h)
- Qué: `phpunit.xml.dist` (suite `unit`, `tests/php/unit/`), `tests/php/unit/bootstrap.php` (autoload de Composer, define `ABSPATH` falso solo si un archivo lo exige), un humo que carga un archivo puro del plugin sin WP o, si no hay ninguno cargable sin WP, un humo trivial documentado. Script `test:php:unit`.
- Archivos: `phpunit.xml.dist`, `tests/php/unit/{bootstrap.php,SmokeTest.php}`.
- Test: primero: `SmokeTest.php` (visto en rojo antes del bootstrap).
- Verificación: `npm run test:php:unit` con `php@7.4` y con PHP 8.4.
- Resultado: humo sobre `includes/data/class-radplapag-program-config.php`, que carga sin WordPress (solo necesita `ABSPATH`). Verde con PHP 8.5 local y con `php:7.4-cli`/`php:8.4-cli` en Docker: los `php@7.4`/`php@8.4` de Homebrew ya no arrancan (faltan `libffi`/`net-snmp`). En `tests/` no se aplica `WordPress.Files.FileName` (convención `*Test.php`, §5.2).
- [x] hecha · commit: 4275c24

### 1.6 PHPUnit integración sobre wp-env (≤ 1 h)
- Qué: `phpunit-integration.xml.dist`, `tests/php/integration/bootstrap.php` (de `spike/php`: `WP_TESTS_DIR`, polyfills, plugin en `muplugins_loaded`), `SmokeTest` (plugin activo, `radplapag_station` y `radplapag_program` registrados). Script `test:php:integration` que corre en `tests-cli` de `.wp-env.tests.json`, nunca en el `cli` de desarrollo.
- Archivos: `phpunit-integration.xml.dist`, `tests/php/integration/{bootstrap.php,SmokeTest.php}`, `package.json`.
- Test: primero: `tests/php/integration/SmokeTest.php`.
- Verificación: `npm run test:php:integration` en las dos puntas (1.3).
- Resultado: con `testsEnvironment: false` no hay `tests-cli`. La suite corre en el `cli` de `.wp-env.tests.json` con `WORDPRESS_TABLE_PREFIX=wptests_` (lo lee `wp-tests-config.php`), así que no toca el sitio `wp_` de ese entorno, que es el que usa e2e (comprobado con una opción sonda). Verde en WP 6.6.10 + PHP 7.4.33 y en WP 7.1.3 + PHP 8.4.26.
- [x] hecha · commit: ca25d26

### 1.7 Vitest en `player/` (≤ 1 h)
- Qué: en `player/package.json`: `vitest`, `@vitest/coverage-v8`, `happy-dom`, `@testing-library/react` (+ `@testing-library/dom`) como dev; scripts `test`, `test:coverage`, `typecheck` (`tsc -b`), `check` (`typecheck` + `lint` + `test`). `player/vitest.config.ts` (happy-dom, alias `src` como `tsconfig.app.json`, `setupFiles: src/test/setup.ts`, cobertura v8 sin umbrales todavía: los pone la 0002; visualizadores excluidos). Humo: un test de `src/utils/` real. `player/tsconfig*` excluye `*.test.*` del build si hace falta para que `dist/` no cambie.
- Archivos: `player/package.json`, `player/package-lock.json`, `player/vitest.config.ts`, `player/src/test/setup.ts`, `player/src/utils/<util>.test.ts`.
- Test: primero: el humo de `utils/`.
- Verificación: `npm --prefix player run check && npm --prefix player run build && git diff --exit-code player/dist`.
- [x] hecha · commit: afd898e

### 1.8 Vitest y ESLint de la raíz (admin) (≤ 1 h)
- Qué: `vitest.config.ts` raíz (solo `tests/js/**`), humo en `tests/js/admin/`. `eslint.config.js` raíz con `@wordpress/eslint-plugin` solo sobre `admin/js/**` y `tests/js/**`; las reglas que hoy fallan en `admin/js` se desactivan una a una en un bloque «re-enable in spec 0002» (mismo ADR 0021). Scripts `test`, `lint:js`.
- Archivos: `vitest.config.ts`, `eslint.config.js`, `tests/js/admin/smoke.test.ts`, `package.json`.
- Test: primero: el humo.
- Verificación: `npm test && npm run lint:js`.
- Resultado: `eslint.config.mjs` y `vitest.config.mjs` (la raíz no es `type: module`). La configuración de Prettier de WordPress necesita el fork `wp-prettier` (alias `prettier@npm:wp-prettier`, como `@wordpress/scripts`). Línea base por archivo y regla (mutación: sin la de `station-admin.js` salen más de 1.000 errores). Humo: los dos scripts de `admin/js` se ejecutan en un `vm` sin su markup y no lanzan.
- [x] hecha · commit: 2eb257b

### 1.9 Lint de cada bloque (≤ 1 h)
- Qué: script `lint` (`wp-scripts lint-js src`) y `check` (`lint` + `build`) en cada `blocks/*/package.json`, sin compartir configuración. Si `@wordpress/scripts` 28 falla en `src` actual, se desactivan las reglas concretas en el `.eslintrc` del bloque con el mismo criterio (ADR 0021). Las actualizaciones son de la 0004.
- Archivos: `blocks/*/package.json`, si hace falta `blocks/*/.eslintrc.json`.
- Test: —
- Verificación: `for b in blocks/*/; do npm --prefix "$b" run check; done && git diff --exit-code blocks/*/build`.
- Resultado: ESLint 8 (el de `@wordpress/scripts` 28) encontraba el `eslint.config.mjs` de la raíz. Cada bloque tiene ahora su `.eslintrc.json` (`root: true`, preset de WordPress y línea base por archivo), lint con `ESLINT_USE_FLAT_CONFIG=false` y `"prettier"` en su `package.json`, así que no hereda nada de la raíz. En `now-playing`, el lock resolvía TypeScript 7.0.2 como *peer*, y eso rompía `@typescript-eslint` 6: ese lint ya fallaba en la 3.4.2. Se fija `typescript` 5.9.3 como dependencia de desarrollo (la que resuelven los otros dos bloques); el lock solo pierde TS 7 y sus binarios, y `build/` no cambia. La actualización real es de la 0004.
- [x] hecha · commit: 17c9464

### 1.10 Playwright y humo e2e (≤ 1 h)
- Qué: `playwright.config.ts` (Chromium + WebKit, `baseURL` de `.wp-env.tests.json`, trazas e informe solo si falla, reintentos solo en CI, bloqueo de peticiones a orígenes externos). `tests/e2e/global-setup.ts` que siembra con `scripts/fixtures/seed.php` (vía `wp-env run`) en un entorno reseteado. Un humo: la página de la emisora devuelve el HTML limpio y monta `#root`. El servidor de medios y los 12 escenarios son de la 0002.
- Archivos: `playwright.config.ts`, `tests/e2e/{global-setup.ts,smoke.spec.ts}`, `package.json` (`test:e2e`).
- Test: primero: `smoke.spec.ts`.
- Verificación: `npm run test:e2e` (2 navegadores en verde).
- Resultado: el `global-setup` siembra el sitio `wp_` del entorno de tests con `seed.php` (ya era idempotente) y guarda la URL en `test-results/e2e-seed.json`. Un *fixture* automático aborta cualquier petición fuera del origen de test y falla si hubo alguna. 2/2 en verde (Chromium y WebKit); con la mutación (`Pause` en vez de `Play`) falla.
- [x] hecha · commit: c55ed83

### 1.11 Test de la lista del zip (≤ 1 h)
- Qué: `tests/zip/compare-with-v3.4.2.sh`: genera el zip de `HEAD` y el de `v3.4.2` (con `git worktree` temporal y el script del tag), compara `unzip -Z1` ordenado y falla ante cualquier ruta prohibida (§9). Script `check:zip`.
- Archivos: `tests/zip/compare-with-v3.4.2.sh`, `package.json`.
- Test: primero: el script, visto en rojo metiendo temporalmente un archivo de más en la lista de `build-release-zip.sh` (se revierte).
- Verificación: `npm run check:zip`.
- Resultado: 39 archivos, la misma lista que `v3.4.2`. Mutaciones: copiar `README.md` → falla el diff; copiar `phpcs.xml.dist` → falla el diff y la comprobación de rutas prohibidas.
- [x] hecha · commit: 36149b0

### 1.12 `npm run check` orquestado (≤ 1 h)
- Qué: `check` en la raíz = `lint:php` + `test:php:unit` + `lint:js` + `test` + `test:hooks` + `npm --prefix player run check` + `check` de cada bloque + `check:zip`. Sin Docker (la integración y e2e van aparte: `test:php:integration`, `test:e2e`). `scripts/run-*.sh` se mantienen y se apunta su equivalente.
- Archivos: `package.json`.
- Verificación: `npm run check` en verde; un fallo en `player/` lo hace fallar.
- Resultado: `check` = `lint:php` → `test:php:unit` → `lint:js` → `test` → `check:player` → `check:blocks` → `check:zip` (unos 20 s, sin Docker); `test:hooks` entra en la 1.13. Un test roto en `player/` lo hace fallar. Equivalencias de `scripts/run-*.sh`: `run-eslint.sh` ≈ `npm --prefix player run lint`; `run-php-versions-check.sh` ≈ `php -l` de la CI; `run-wp-plugin-check.sh` ≈ job de Plugin Check (1.30).
- [x] hecha · commit: 2f5a1a8

### 1.13 Hook `SessionStart`: `session-context.sh` (≤ 1 h)
- Qué: inyecta `docs/status.md`, la ruta de la spec activa (leída de la línea «Spec activa»), rama, resumen de `git status` y si wp-env está arrancado (sin fallar si Docker no está). Runner `tests/hooks/run.sh` + `npm run test:hooks`.
- Archivos: `.claude/hooks/session-context.sh`, `tests/hooks/{run.sh,session-context.test.sh}`.
- Test: primero: `session-context.test.sh` (la salida contiene el contenido de `status.md`).
- Verificación: `npm run test:hooks`.
- [x] hecha · commit: 8b06651

### 1.14 Hook `PreToolUse`: `protect-generated.sh` (≤ 1 h)
- Qué: bloquea `Edit|Write` en `player/dist/**`, `blocks/*/build/**`, `vendor/**`, `node_modules/**` y dice qué comando lo regenera.
- Archivos: `.claude/hooks/protect-generated.sh`, `tests/hooks/protect-generated.test.sh`.
- Test: primero: casos bloqueados y permitidos.
- Verificación: `npm run test:hooks`.
- [x] hecha · commit: 707b60c

### 1.15 Hook `PostToolUse`: `format-edited-file.sh` (≤ 1 h)
- Qué: solo el archivo editado. `player/**/*.{ts,tsx}`: ESLint `--fix` + Prettier de `player/`. `admin/js`, `tests/js`, `blocks/*/src`: ESLint `--fix` de su proyecto. `.php`: `php -l` (devuelve el error); `phpcbf` queda desactivado hasta la 0002 (comentario y bandera).
- Archivos: `.claude/hooks/format-edited-file.sh`, `tests/hooks/format-edited-file.test.sh`.
- Test: primero: PHP con error de sintaxis → bloquea; TS mal formateado → formateado; PHP antiguo → sin cambios.
- Verificación: `npm run test:hooks`.
- Resultado: `player/` tenía `.prettierrc` pero no Prettier instalado. Se instala (3.9.10, exacto) y entra `format:check` en su `check`; 8 archivos que no cumplen (5 de `src/` y 3 configs) van a una línea base en `player/.prettierignore` (ADR 0021), así que el hook no reformatea entero un archivo antiguo. Los errores que `--fix` no arregla vuelven a Claude como `decision: block`.
- [x] hecha · commit: 9d6a6cb

### 1.16 Hook `Stop`: `verify-before-stop.sh` (≤ 1 h)
- Qué: si hay cambios: build del player si cambió `player/src`, build de cada bloque cuyo `src` cambió, `tsc` y tests unitarios de las zonas tocadas (PHP unit, Vitest raíz, Vitest player). Fallo → `decision: block` con el resumen. Tope de iteraciones (`stop_hook_active` + contador).
- Archivos: `.claude/hooks/verify-before-stop.sh`, `tests/hooks/verify-before-stop.test.sh`.
- Test: primero: sin cambios → pasa; test roto → block; `stop_hook_active` → no bloquea en bucle.
- Verificación: `npm run test:hooks`.
- Resultado: el tope es de 3 paradas bloqueadas seguidas por sesión (contador en `$TMPDIR`, se reinicia cuando todo pasa); por encima está el tope de 8 de Claude Code. También pasa `php -l` a cada PHP cambiado y los tests de hooks si cambian. Sobre el árbol real: unos 7 s.
- [x] hecha · commit: 3359b9e

### 1.17 `.claude/settings.json` y `.mcp.json` (≤ 1 h)
- Qué: hooks de 1.13–1.16 y permisos de §7.4 + §6 (permitir `git checkout -b spec/*`, `git push -u origin spec/*`, `gh pr create --draft --base trunk`, `gh pr view|checks|ready`; denegar `git push` a `main`/`trunk`, `--force*`, `gh pr merge`, `git tag`, `svn`, `npm publish`, leer `.env*`). `.mcp.json` con Playwright MCP.
- Archivos: `.claude/settings.json`, `.mcp.json`.
- Verificación: JSON válido contra el esquema; sesión nueva (`claude -p` breve) recibe el contexto del `SessionStart`.
- Resultado: `settings.json` es válido contra el esquema de SchemaStore. `git push` se deniega a `main`/`trunk` (también `refspec:main`), con `--force`/`-f` y con `--delete`; se permite `git push -u origin spec/*`; el resto pregunta (nota de 1.1). Una sesión nueva (`claude -p`) recibe el contexto de `SessionStart`. Playwright MCP fijado a 0.0.83 con `--isolated`.
- [x] hecha · commit: 9ff1cf4

### 1.18 `CLAUDE.md` (≤ 1 h)
- Qué: lo de §7.2 y nada más (< 120 líneas): qué es y dónde está la verdad, comandos, mapa, invariantes verificables, flujo, qué no hacer.
- Archivos: `CLAUDE.md`.
- Verificación: `wc -l CLAUDE.md` < 120; cada invariante apunta a su ADR o test.
- [x] hecha · commit: c584b17

### 1.19 Rules (1/2): `wordpress-org`, `php`, `security`, `data-and-migrations`, `blocks` (≤ 1 h)
- Qué: tabla §7.3, 20–60 líneas cada una, `paths:` en el frontmatter, enlaces a fuentes oficiales; sin repetir lo que está en `CLAUDE.md`.
- Archivos: `.claude/rules/{wordpress-org,php,security,data-and-migrations,blocks}.md`.
- Verificación: `wc -l` en rango; frontmatter según 1.1.
- [x] hecha · commit: 53470da

### 1.20 Rules (2/2): `admin`, `player`, `visualizers`, `testing` (≤ 1 h)
- Qué: ídem; `testing.md` recoge §5 y los mínimos de cobertura de la hoja de ruta.
- Archivos: `.claude/rules/{admin,player,visualizers,testing}.md`.
- Verificación: ídem 1.19.
- [x] hecha · commit: 5c8e69c

### 1.21 Skills del ciclo: `write-spec`, `start-phase`, `close-phase`, `write-adr` + plantilla (≤ 1 h)
- Qué: §7.5; `docs/specs/_template.md` para `write-spec`; `docs/adr/_template.md` si 1.1 no lo impide. Todas terminan con «`npm run check` en verde; actualizar `docs/status.md`».
- Archivos: `.claude/skills/{write-spec,start-phase,close-phase,write-adr}/SKILL.md`, `docs/specs/_template.md`.
- Verificación: frontmatter según 1.1; las skills aparecen en una sesión nueva.
- Resultado: la plantilla del ADR vive solo en `write-adr` (no hay `docs/adr/_template.md`, para no duplicarla). Matiz sobre §2.2/§6: como la spec se escribe en una sesión y se ejecuta en otra, `write-spec` ya crea la rama `spec/NNNN-slug` desde `origin/trunk` y commitea ahí la spec; `start-phase` la reutiliza (o la crea si no existe) y hace el primer push y el PR en borrador. Los revisores reciben el diff en un archivo, porque no llevan `Bash` (nota de 1.1).
- [x] hecha · commit: 567bce1

### 1.22 Skills de trabajo: `characterize`, `fix-bug`, `audit`, `upgrade-dependency`, `release` (≤ 1 h)
- Qué: §7.5; `release` con `disable-model-invocation: true`.
- Archivos: `.claude/skills/{characterize,fix-bug,audit,upgrade-dependency,release}/SKILL.md`.
- Verificación: ídem 1.21.
- [x] hecha · commit: 4ef439e

### 1.23 Subagentes revisores (≤ 1 h)
- Qué: §7.6, solo lectura (`tools` sin edición): `spec-conformance-reviewer`, `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer`, `a11y-reviewer`.
- Archivos: `.claude/agents/*.md`.
- Verificación: frontmatter según 1.1; aparecen en una sesión nueva.
- [x] hecha · commit: 7a07622

### 1.24 `SPEC.md` (1/2): datos, migración, PHP, bloques, admin, desinstalación (≤ 1 h)
- Qué: §4.1–§4.7 y §4.10 **verificados contra el código de la 3.4.2** (grep de cada meta key, opción, transient, función, hook y atributo); lo que falte o difiera se completa y, si contradice la spec, se para y se pregunta (§0.5). Más §2 (metodología, resumida y enlazando), §3 (dos mundos) e invariantes.
- Archivos: `SPEC.md`.
- Verificación: cada clave de `SPEC.md` aparece con `grep` en el código (lista en el commit).
- Resultado: correcciones al inventario de §4 de la spec, verificadas en el código: `radplapag_migration_success_notice` y `radplapag_migration_error_notice` son **transients** (60 s y 120 s), no opciones; `uninstall.php` también borra las opciones `radplapag_db_version` y `radplapag_migration_skipped_cpt_conflict`; la migración también se dispara en `upgrader_process_complete`; `RADPLAPAG_PROGRAMS` lleva además `description` y `extendedDescription`. Se añaden a `SPEC.md`: tabla de callbacks enganchados con prioridades, atributos de los bloques con sus valores por defecto, listas blancas de tema y visualizador y caducidad de los transients. Cada identificador `radplapag_*` de `SPEC.md` aparece en el código (`git grep`).
- [x] hecha · commit: 3043459

### 1.25 `SPEC.md` (2/2): página del reproductor, globales y reproductor (≤ 1 h)
- Qué: §4.3, §4.8, §4.9 verificados contra `radio-player-page.php`, `includes/` y `player/src` (claves reales de `RADPLAPAG_CONFIG`, forma de `RADPLAPAG_PROGRAMS`/`SCHEDULE`, 14 locales, detección de idioma).
- Archivos: `SPEC.md`.
- Verificación: ídem 1.24.
- Resultado: verificado contra `radio-player-page.php` y `player/src`. Lo nuevo frente a §4.3/§4.8 de la spec: la página solo se intercepta si está publicada, sin contraseña y asignada; cabecera con meta de Open Graph y Twitter; `RADPLAPAG_PROGRAMS` en orden de primera aparición; el protocolo se detecta con `endsWith('.m3u8' | '.mpd')` (una URL con *query string* va como audio directo; queda para caracterizar en la 0002); sueño de 30/60/120 min.
- [x] hecha · commit: 8d623b3

### 1.26 ADRs retroactivos de producto (≤ 1 h)
- Qué: 0008 páginas limpias sin tema · 0009 React + MUI + Vite en el player · 0010 migración a CPT en la 3.3.0 · 0011 prefijos · 0012 requisitos mínimos WP 6.6 / PHP 7.4 · 0013 `crossOrigin` anónimo para los visualizadores (origen; lo matiza 0004) · 0014 build commiteado · 0015 publicación por SVN. Índice al día.
- Archivos: `docs/adr/0008…0015-*.md`, `docs/adr/README.md`.
- Verificación: índice = archivos (`ls docs/adr | wc -l`).
- [x] hecha · commit: bd51c94

### 1.27 ADRs de la iniciativa (≤ 1 h)
- Qué: 0016 metodología por specs · 0017 caracterización antes que refactor · 0018 visualizadores congelados · 0019 dos mundos (WordPress.org / React) · 0020 proyectos JS sin unificar · 0021 estándares de código sobre código heredado: exclusiones por sniff/regla hasta el formateo de la 0002 · 0022 última versión de todo (con las excepciones ya conocidas: ADR 0003). (El de ramas ya es 0007.)
- Archivos: `docs/adr/0016…0022-*.md`, `docs/adr/README.md`.
- Verificación: ídem 1.26.
- [x] hecha · commit: a1bdc82

### 1.28 `docs/known-issues.md` (≤ 1 h)
- Qué: tabla §5.2 con C1–C16 de `docs/inherited-bugs.md` (estado «sin confirmar»; C14 «no aplica», C8 «se replica», C1/C9 pendientes según §5.2) y K1–K3 del spike (K2: «resuelto por la CI de la fase 1» si 1.29 lo cubre). Los vectores del horario de `inherited-bugs.md` pasan a `known-issues.md` (los usa la 0002). Se borra `inherited-bugs.md` y se actualizan los enlaces (spec, hoja de ruta, 0002).
- Archivos: `docs/known-issues.md`, `docs/inherited-bugs.md` (borrado), referencias.
- Verificación: `grep -rn inherited-bugs docs/ SPEC.md CLAUDE.md .claude/` vacío salvo histórico.
- Resultado: 20 filas (C1–C16, K1–K4). K4 es el candidato del spike sobre la migración de 1.x, ya decidido por el ADR 0005 («no arreglar»). C1 y K1 quedan «confirmado (spike)»; C8, «replicar» (§5.2); C14, «no aplica». Las definiciones y los vectores del horario pasan tal cual a `known-issues.md`. Quedan menciones históricas a `inherited-bugs.md` en la spec (§0, árbol de §2.3 y fase 1) y en `phase-0.md`.
- [ ] hecha · commit: —

### 1.29 CI (1/2): PHP (≤ 1 h)
- Qué: reescribir `.github/workflows/` (Node 26, `actions/*` en su última versión mayor): disparadores `push` a `main` y `trunk` + `pull_request`; sintaxis PHP 7.4/8.4; PHPCS; PHPUnit unit (7.4/8.4, sin Docker); PHPUnit integración (matriz R1 con wp-env); `composer audit`.
- Archivos: `.github/workflows/ci.yml` (sustituye a `test.yml`).
- Verificación: push de la rama (lo hace el usuario o Claude tras 1.17) → `gh pr checks 36`.
- [ ] hecha · commit: —

### 1.30 CI (2/2): JS, e2e, hooks, zip y Plugin Check (≤ 1 h)
- Qué: un job por proyecto JS (raíz; `player/` con `npm ci` → `tsc` → ESLint → Vitest → build → `git diff --exit-code`; cada uno de los **3** bloques), licencias GPL-compatibles de las dependencias empaquetadas (`player/` y bloques, script propio sobre `package-lock.json`, `--omit=dev`), `npm audit --omit=dev`, Playwright (Chromium + WebKit, artefactos si falla), tests de hooks, `check:zip`, Plugin Check sobre el zip (probar sin el workaround de Node ≥ 24.16, como dejó pendiente R6; si falla, se mantiene).
- Archivos: `.github/workflows/ci.yml`, `scripts/check-licenses.mjs`.
- Verificación: `gh pr checks 36` en verde. **Después, el usuario actualiza los checks obligatorios de los rulesets de `main` y `trunk`** con los nombres nuevos (se le dan en `status.md`).
- [ ] hecha · commit: —

### 1.31 Prueba en seco de `write-spec`, `start-phase` y `close-phase` (≤ 1 h)
- Qué: `write-spec` sobre una spec ficticia en el scratchpad (no se commitea); `start-phase` en modo lectura sobre la 0002 (comprobar que encuentra spec, ADRs y plan anterior y propone rama/PR correctos sin ejecutarlos); `close-phase` recorriendo su checklist sobre esta fase. Apuntar el resultado aquí y ajustar las skills si algo falla.
- Archivos: este plan; skills si hace falta.
- Verificación: checklist apuntada.
- [ ] hecha · commit: —

### Cierre
`close-phase` (ya existe): revisores, `SPEC.md`, rules, `CLAUDE.md`, `status.md`, spec 0001 «cerrada» en el índice, PR #36 listo para que el usuario lo fusione en `trunk`, recordatorio de `write-spec` para la 0002 en una sesión de diseño. Commit `chore(0001): close phase 1`.

## Decisiones abiertas → ADR
- **Estándares sobre código heredado (ADR 0021):** WPCS completo y PHPCompatibilityWP en `phpcs.xml.dist`, pero las 34 sniffs que hoy fallan (y las reglas ESLint que fallen en `admin/js` y en los bloques) se excluyen explícitamente hasta el formateo masivo de la 0002, que las reactiva. PHPCompatibilityWP ya está a 0 y se exige desde ya. Alternativa descartada: formatear ahora (cambia 34 archivos antes de la red de seguridad).
- **Cobertura:** en esta fase solo se genera el informe; los umbrales de la hoja de ruta los pone la CI de la 0002 (con PCOV/Xdebug en wp-env), que es cuando hay tests.
- **Plugin Check sobre el zip** en lugar de sobre el árbol con exclusiones: evita mantener la lista de directorios de desarrollo en dos sitios.
- Diferencias con §7: ver «Notas de 1.1».


## Notas de 1.1 — documentación oficial de Claude Code (consultada el 2026-10-16)
Fuentes: [memory](https://code.claude.com/docs/en/memory), [settings](https://code.claude.com/docs/en/settings), [permissions](https://code.claude.com/docs/en/permissions), [hooks](https://code.claude.com/docs/en/hooks), [skills](https://code.claude.com/docs/en/skills), [sub-agents](https://code.claude.com/docs/en/sub-agents), [mcp](https://code.claude.com/docs/en/mcp).

| Mecanismo | Formato vigente | ¿Coincide con §7? |
|---|---|---|
| `CLAUDE.md` / `CLAUDE.local.md` | Raíz del proyecto; `CLAUDE.local.md` se carga después y va en `.gitignore`. Imports con `@ruta` (no dentro de backticks). Objetivo oficial: < 200 líneas. | Sí. §7.2 pide < 120: más estricto, se mantiene. Las rutas del repo en `CLAUDE.md` van entre backticks para que no se importen. |
| Rules | `.claude/rules/**/*.md`; frontmatter `paths:` (lista YAML o cadena con comas) con globs; sin `paths` se cargan siempre. | Sí. |
| Settings | `.claude/settings.json` (versionado) y `.claude/settings.local.json` (personal, en `.gitignore`). JSON estricto. `$schema`: `https://json.schemastore.org/claude-code-settings.json`. | Sí. |
| Permisos | Orden **deny → ask → allow**; un `allow` no puede hacer excepción a un `deny`. `Bash(cmd *)`: el espacio cuenta y el `*` final también casa el comando sin argumentos. Los comandos compuestos se evalúan por subcomando, y un deny aplica si casa cualquiera. `Read(./.env)`, `Read(**/.env.*)` con sintaxis gitignore. | **No del todo:** §7.4 deniega `git push *`, pero §6 permite `git push -u origin spec/*`. Con deny primero, las dos cosas son incompatibles. Se aplica §6 (más específico): se deniegan `git push` a `main`/`trunk` y `--force`/`-f`/`--force-with-lease`, y se permite `git push -u origin spec/*`. El resto de `git push` pregunta. |
| Hooks | `"${CLAUDE_PROJECT_DIR}"/.claude/hooks/x.sh`; entrada JSON por stdin. `SessionStart`: stdout en texto plano (o `hookSpecificOutput.additionalContext`) entra en el contexto; `source` ∈ `startup`, `resume`, `clear`, `compact`, `fork`. `PreToolUse`: exit 2 + stderr bloquea (o `permissionDecision: "deny"`). `PostToolUse`: `tool_input.file_path`; para devolver errores, exit 2 o `{"decision":"block","reason":…}`. `Stop`: `stop_hook_active` y `{"decision":"block","reason":…}`; Claude Code ya limita a 8 continuaciones seguidas. Timeout por defecto: 600 s. Sobre stdout solo puede salir el JSON. | Sí. `SessionStart` sin `matcher`: se reinyecta `status.md` también tras `compact` y `clear`. El tope propio del hook `Stop` se apoya en `stop_hook_active`. |
| Skills | `.claude/skills/<nombre>/SKILL.md`; frontmatter opcional: `name`, `description`, `when_to_use`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `paths`, `context`… < 500 líneas. Se invocan con `/nombre`. | Sí. |
| Subagentes | `.claude/agents/<nombre>.md`; obligatorios `name` y `description`; `tools` (cadena con comas o lista), `disallowedTools`, `model`. La documentación avisa de que `Bash` permite modificar archivos: un agente estrictamente de solo lectura no lo lleva. | Sí, con un matiz: los revisores llevan `tools: Read, Grep, Glob`. La skill que los invoca (`close-phase`, `audit`) les pasa el diff ya generado en un archivo temporal. |
| MCP | `.mcp.json` en la raíz: `{"mcpServers": {"<nombre>": {"type": "stdio", "command": …, "args": […]}}}`. Los servidores del proyecto piden aprobación en una sesión interactiva. | Sí. |
