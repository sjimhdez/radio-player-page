# Spec 0003 · Fase 1 — Medición y capturas
Estado: en curso · Inicio: 2026-10-18 · ADRs: 0014, 0020, 0021, 0022, 0026 (nuevo)

## Contexto

- `player/dist/` es idéntico al de la etiqueta `v3.4.2` (`git diff --stat v3.4.2 -- player/dist` vacío): la línea base se toma del árbol actual.
- Medido con `zlib.gzipSync(buf, { level: 9 })` (lo que usará el script), los valores **no coinciden con los de §4.2** de la spec (que se midieron con otra herramienta): principal 178 918 (spec: 178 185), CSS 541 (570), `hls` 161 976 (161 659), `dash-all-min` 256 779 (255 283), visualizadores 427–1 060 (482–1 099). Diferencia < 1 % y sin efecto en la regla. La línea base es la que mide el script; en el commit del ADR (1.3) se corrigen las cifras de §4.2.
- `trunk` no ha avanzado desde que salió la rama (no hace falta merge).
- El error de reproducción (snackbar) solo existe en WebKit: en Chromium, K1 hace que no se muestre (`cross-origin.spec.ts`). La captura `error` en Chromium mostrará el estado actual sin aviso; es lo que hay que comparar, no se arregla (0007+).
- `withSiteLocale()` es local de `tests/e2e/i18n.spec.ts`. Para no tocar los e2e (A4/A7), las capturas llevan su propia copia mínima en `tests/visual/`.
- «Proyecto propio de Playwright que `npm run test:e2e` ignora» (§4.3): se hace con una configuración aparte (`playwright.screenshots.config.ts`, `testDir: tests/visual`) que reutiliza `globalSetup` y los servidores de medios. `playwright.config.ts` tiene `testDir: ./tests/e2e`, así que `test:e2e` no ve `tests/visual` sin tocarlo.

## Objetivo

Medir el bundle del player frente a la 3.4.2 y vigilarlo en `check` y en la CI, y tener capturas a petición del player para la revisión visual de las fases 2–4, con la referencia `3.4.2` revisada por el usuario.

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| A2 con la línea base: 0 % en todo | `npm run check:bundle` en verde con la tabla a 0 %; dentro de `npm run check` y en el job `player` de la CI |
| El script falla donde debe (crecimiento > 10 %, carga inicial, tolerancia de 1 kB < 10 kB, archivo nuevo o que falta) | `tests/js/scripts/check-player-bundle.test.js` en `npm test` |
| La línea base solo se reescribe con `--update` (y un ADR) | test del modo `--update` + ADR 0026 |
| `npm run screenshots -- 3.4.2` genera todas las pantallas en Chromium y WebKit, 1280×800 y 390×844, sin peticiones externas | ejecución manual; el test falla si falta alguna (fixture `blockExternalRequests`) |
| `npm run test:e2e` no ejecuta las capturas | `npx playwright test --list \| grep -c visual` = 0 |
| El usuario revisa la referencia `3.4.2` y confirma las pantallas | verificación manual en `docs/status.md` |
| A3/A5 sin cambios (no se toca `player/`) | `git diff origin/trunk --stat -- player/` vacío |

## Tareas

### 1.1 Script de medición del bundle, con su test (≤ 1 h)
- Qué: `scripts/check-player-bundle.mjs` (Node, sin dependencias). Exporta funciones puras (`measureDist(dir)`, `compare(baseline, current)`) y una CLI: `node scripts/check-player-bundle.mjs [distDir] [--baseline file] [--update]`. Lee `manifest.json`, mide cada `*.js|*.css` (bytes y gzip nivel 9), clave = nombre sin `radio-player-page-<versión>` (`main.js`, `main.css`, `hls.js`, `dash-all-min.js`, `bar-visualizer.js`…). Falla (exit 1) si un asset crece > 10 % en gzip (tolerancia 1 kB si su línea base < 10 kB), si la carga inicial (JS de la entrada + su CSS, del manifiesto) crece > 10 %, o si aparece o desaparece un archivo. Imprime tabla base / actual / %.
- Archivos: `scripts/check-player-bundle.mjs`, `tests/js/scripts/check-player-bundle.test.js`, `tests/js/scripts/fixtures/player-dist/` (manifest + archivos pequeños).
- Test: primero (TDD), mismo patrón que `check-php-coverage.test.js` (funciones importadas + `spawnSync` de la CLI con baseline en un temp dir): dentro, fuera por > 10 %, dentro por tolerancia de 1 kB, fuera por carga inicial, archivo nuevo, archivo que falta, `--update` escribe la línea base.
- Verificación: `npm test -- tests/js/scripts/check-player-bundle.test.js && npm run lint:js`
- [ ] hecha · commit: —

### 1.2 Línea base de la 3.4.2 y `check:bundle` en `check` y en la CI (≤ 1 h)
- Qué: generar `tests/bundle/player-baseline.json` con `--update` desde `player/dist/` (idéntico a `v3.4.2`). Script `check:bundle` en `package.json` de la raíz, añadido a `check` tras `check:player`. Paso «Bundle within budget» en el job `player` de `.github/workflows/ci.yml`, tras «Committed player/dist matches the build» (`node ../scripts/check-player-bundle.mjs`). Confirmar que `check:zip` no cambia (tests/ no va en el zip).
- Archivos: `tests/bundle/player-baseline.json`, `package.json`, `.github/workflows/ci.yml`.
- Test: el de 1.1; aquí la ejecución real.
- Verificación: `npm run check:bundle && npm run check:zip`
- [ ] hecha · commit: —

### 1.3 ADR 0026 — Presupuesto del bundle del player (≤ 1 h)
- Qué: `write-adr`: medición (zlib nivel 9, claves sin versión), línea base = 3.4.2, regla acumulada del +10 % (y 1 kB bajo 10 kB, carga inicial, archivos nuevos/faltantes), la línea base solo se mueve con `--update` y un ADR. Índice de ADRs; spec §3 y §4.2 (cifras corregidas a las de zlib, enlace al ADR).
- Archivos: `docs/adr/0026-player-bundle-budget.md`, `docs/adr/README.md`, `docs/specs/0003-player-dependencies/spec.md`.
- Test: — (documento); la regla la fija el test de 1.1.
- Verificación: `npm run check:bundle`
- [ ] hecha · commit: —

### 1.4 Configuración de capturas y `npm run screenshots` (≤ 1 h)
- Qué: `playwright.screenshots.config.ts` (`testDir: tests/visual`, mismo `baseURL`, `globalSetup`, `workers: 1`, `reducedMotion: 'reduce'`, proyectos `chromium-desktop` 1280×800, `chromium-mobile` 390×844, `webkit-desktop`, `webkit-mobile`; `outputDir` en `test-results/screenshots-run`). `scripts/run-screenshots.mjs <etiqueta>`: valida la etiqueta (`[A-Za-z0-9._-]+`), la pasa en `RADPLAPAG_SCREENSHOTS_LABEL` y lanza `playwright test -c playwright.screenshots.config.ts`. Script `screenshots` en `package.json`. Un primer test (la página mínima) para probar la tubería; salida en `test-results/screenshots/<etiqueta>/<proyecto>/<pantalla>.png`.
- Archivos: `playwright.screenshots.config.ts`, `scripts/run-screenshots.mjs`, `tests/visual/player-screens.spec.ts`, `tests/visual/support/screens.ts` (ruta de salida y `capture()`), `package.json`.
- Test: — (herramienta manual); comprobación de que `test:e2e` no la lista.
- Verificación: `npm run screenshots -- smoke && ls test-results/screenshots/smoke/*/ && npx playwright test --list | grep -c visual` (último: 0)
- [ ] hecha · commit: —

### 1.5 Pantallas del player (≤ 1 h)
- Qué: el resto de pantallas de §4.3, reutilizando `tests/e2e/fixtures.ts` (`test`, bloqueo de peticiones externas), `seed.ts`, `support/clock.ts` (`stationInstant`) y `support/player.ts` (`startPlayback`): MP3 en pausa y reproduciendo con programa en antena y siguiente (hora congelada con `page.clock`); modal de horario; modal de todos los programas; menú y cuenta atrás del temporizador de sueño; error de reproducción (`nocors-mp3`; en Chromium sin aviso, K1); idioma `es_ES` (copia mínima de `withSiteLocale` en `tests/visual/support/`). Sin visualizadores. Durante la reproducción se pausa el reloj antes de capturar para que la hora mostrada sea fija.
- Archivos: `tests/visual/player-screens.spec.ts`, `tests/visual/support/locale.ts`.
- Test: — (herramienta manual); dos ejecuciones seguidas dan las mismas imágenes (comprobación de determinismo con `cmp`, riesgo 8).
- Verificación: `npm run screenshots -- check-a && npm run screenshots -- check-b && for f in test-results/screenshots/check-a/*/*.png; do cmp -s "$f" "${f/check-a/check-b}" || echo "DIFF $f"; done`
- [ ] hecha · commit: —

### 1.6 Página de comparación (≤ 1 h)
- Qué: `scripts/run-screenshots.mjs --compare <ref> <etiqueta>` escribe `test-results/screenshots/compare-<ref>-<etiqueta>.html`: por proyecto y pantalla, las dos imágenes lado a lado (rutas relativas, sin dependencias) y marca las que difieren en bytes o faltan. Lógica pura (emparejar listas de archivos) con test en `tests/js/scripts/run-screenshots.test.js`.
- Archivos: `scripts/run-screenshots.mjs`, `tests/js/scripts/run-screenshots.test.js`.
- Test: primero (TDD): emparejado, falta en un lado, etiqueta inválida.
- Verificación: `npm test -- tests/js/scripts/run-screenshots.test.js && npm run screenshots -- --compare check-a check-b`
- [ ] hecha · commit: —

### 1.7 Referencia `3.4.2` y revisión del usuario
- Qué: `npm run screenshots -- 3.4.2` (sobre `env:start:latest`, en esta máquina: la misma para el antes y el después) y la página de comparación consigo misma para revisarla. El usuario confirma que las pantallas son las que quiere comparar; si pide otras, se añaden aquí. Anotar en «Verificación manual pendiente» de `docs/status.md` hasta su aprobación.
- Archivos: `docs/status.md`, este plan («Resultado:»).
- Test: verificación manual.
- Verificación: `npm run screenshots -- 3.4.2 && ls test-results/screenshots/3.4.2/*/ | wc -l`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- ADR 0026 — presupuesto del bundle (tarea 1.3).
- Configuración aparte en lugar de un proyecto dentro de `playwright.config.ts`: es la forma de que `test:e2e` lo ignore sin filtros; no es una decisión de arquitectura y no lleva ADR.

