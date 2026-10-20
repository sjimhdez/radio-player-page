# Spec 0003 · Fase 1 — Actualización agrupada
Estado: en curso · Inicio: 2026-10-20 · ADRs: 0026, 0022, 0020, 0021, 0018, 0014, 0023, 0012, 0004, 0025

## Contexto
Medido al planificar (2026-10-20):

- `npm outdated` coincide con §4.1 de la spec. Única novedad: `@babel/runtime` 8.0.7 existe, pero `@wordpress/scripts` 37 sigue en `@babel/core` ^7 y `@wordpress/babel-preset-default` 10 → los bloques suben a la **7.29.x** (última compatible), excepción del ADR 0022.
- `typescript-eslint` 8.72 pide `typescript >=4.8.4 <6.1.0` → player en TS **6.0.x** (excepción ADR 0022). `@wordpress/scripts` 37 trae ESLint ^10 y `@wordpress/eslint-plugin` 28 (peer `typescript >=5`); el TS de `now-playing` sube a lo más alto que acepte su `@typescript-eslint`.
- Afirmaciones de §4.2 comprobadas y ciertas: `baseUrl` en `player/tsconfig.app.json`; `process.env.NODE_ENV` en `src/utils/timezone.ts`; `tseslint.config()` en `player/eslint.config.js`; `build.rollupOptions` con `chunkFileNames` en `vite.config.ts`; las 6 líneas de `react-hooks` 7 existen; los bloques usan `.eslintrc.json` + `ESLINT_USE_FLAT_CONFIG=false`.
- `player/dist/` es idéntico a la `v3.4.2`. Línea base en gzip (`gzip -9c | wc -c`):

| Archivo | Bytes | gzip |
|---|---|---|
| `radio-player-page-3.4.2.min.js` | 570 930 | 178 185 |
| `…-hls.min.js` | 525 034 | 161 659 |
| `…-dash-all-min.min.js` | 857 037 | 255 283 |
| `…-bar-visualizer.min.js` | 2 234 | 1 099 |
| `…-particles-visualizer.min.js` | 1 913 | 985 |
| `…-amplitude-waterfall-visualizer.min.js` | 1 253 | 699 |
| `…-oscilloscope-visualizer.min.js` | 724 | 482 |
| `radio-player-page-3.4.2.css` | 1 012 | 570 |

## Objetivo
`player/` y los tres bloques con cada dependencia en su última versión estable (o la más alta posible, con excepción en el ADR 0022), sin cambio de comportamiento ni de nombres de assets, y la revisión visual del usuario aprobada.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A1 Todo en la última estable salvo excepciones del ADR 0022 | `npm --prefix player outdated` y `npm --prefix blocks/<b> outdated` solo listan las excepciones |
| A2 El comportamiento no cambia | `npm run check`; `npm run test:e2e` completo en `env:start:min` y `env:start:latest` (Chromium + WebKit), sin editar tests ni la línea base de axe |
| A3 Mismos archivos y nombres en los builds | `npm run check:zip` y `git status` limpio tras `build` de cada proyecto (lo que compara la CI) |
| A4 Zona congelada intacta | `git diff origin/trunk -- player/src/components/visualizers player/src/config/visualizers.ts player/src/types/visualizers.tsx player/src/hooks/use-audio-visualizer.tsx player/src/hooks/use-can-visualize.tsx` vacío |
| A5 Bundle anotado | Tabla antes/después en gzip en el cuerpo del PR #38; > +10 % en un archivo → pregunta al usuario |
| A6 Licencias y vulnerabilidades | CI: `check-licenses.mjs` y `npm audit` en verde en el PR |
| A7 Revisión visual aprobada | Manual en <http://localhost:8886> (player: pausa, reproducción, modales de horario y programas, temporizador de sueño, móvil y escritorio; los tres bloques en editor y front). En «Verificación manual pendiente» hasta que el usuario la apruebe |

## Tareas

### 1.1 Subir las dependencias del player (≈ 1–2 h; se parte si algo rompe)
- Qué: todas las de §4.1 a la última (TS 6.0.x). Guías y codemods: TS 6 (quitar `baseUrl`, `"types": ["node"]` en `tsconfig.app.json`); ESLint 10 (`defineConfig()` de `eslint/config`); `react-hooks` 7 (6 `eslint-disable-next-line <regla> -- <motivo, 0006>`, sin reescribir efectos); Vite 7/8 (`build.target` explícito igual al por defecto de Vite 6, `rollupOptions` → `rolldownOptions`, ajustar `chunkFileNames` hasta reproducir los nombres de la 3.4.2); MUI 9 (`npx @mui/codemod@latest v9.0.0/preset-safe src`, guía oficial); `date-fns` 4, `i18next` 26, `react-i18next` 17 según sus guías. Rebuild de `player/dist/` y commit del resultado. Medir el bundle después.
- Si MUI, Vite o i18next rompen algo que su guía no resuelve: ese paquete a su propio commit (`build(0003): upgrade <paquete> in player (1.1)`), ADR 0026. Si una migración exige cambiar comportamiento o tocar un visualizador: **parar y preguntar**.
- Archivos: `player/package.json`, `package-lock.json`, `tsconfig.app.json`, `eslint.config.js`, `vite.config.ts`, las 4–5 líneas con `eslint-disable`, lo que pidan los codemods, `player/dist/`.
- Test: los existentes (caracterización de la 0002); no se editan.
- Verificación: `npm --prefix player run check && npm --prefix player run build && git status --short player/dist && npm run check:zip`
- Commit: `build(0003): upgrade player dependencies (1.1)`
- Resultado: todo a la última salvo `typescript` 6.0.3 (peer de `typescript-eslint`). MUI 9 no tiene `v9.0.0/preset-safe`: se pasaron `v9.0.0/system-props` y `deprecations/all` (el `@mui/codemod` 9.5.0 falla con yargs 18; se ejecutó con yargs 17 por `overrides`). Además, a mano: `DialogTitle bgcolor` → `sx` (dos modales), `coverage` en `globalIgnores`, `__dirname` → `import.meta.dirname` en `vite.config.ts` y `vitest.config.ts`. Las 6 excepciones de `react-hooks` 7 en su línea (la del test, dividida en dos: `immutability` y `refs` saltan en líneas distintas). Navegadores: ADR 0027. Bundle (gzip, `gzip -9c`), aceptado por el usuario: main 185 890 (+4,3 %), hls 178 596 (+10,5 %, viene de hls.js 1.7: su `hls.min.js` crece un 15 %), dash 236 236 (−7,5 %), bar 1 076, particles 969, amplitude 699, oscilloscope 484, CSS 675 (+105 bytes, Lightning CSS). Mismos nombres y `manifest.json` idéntico; `npm run check` y `check:zip` en verde.
- E2E (2026-10-20), dos cambios de comportamiento por las subidas, decididos por el usuario: hls.js 1.7 pasa `preferManagedMediaSource` a `false` (en Safari de escritorio, MediaSource clásico con `audio.src = blob:` en vez de MMS con `<source>`): se restaura con `new Hls({ preferManagedMediaSource: true })` y un test unitario nuevo. i18next 26 quita el anuncio de Locize: K71 queda corregido y su test `currently` pasa a regresión (`does not print…`). Después, e2e completo en verde en las dos puntas (196 pasan, 22 omitidos).
- [x] hecha · commits: 496643a, e2c2c59

### 1.2 Subir las dependencias de los tres bloques (≈ 1 h)
- Qué: `@wordpress/scripts` 37, `@babel/runtime` 7.29.x, TS de `now-playing` lo más alto que acepte el lint. Sustituir `.eslintrc.json` por `eslint.config.mjs` propio de cada bloque (guía de `@wordpress/scripts`, recomendado de `@wordpress/eslint-plugin`), quitar `ESLINT_USE_FLAT_CONFIG=false` del script `lint`, comprobar que no lee el `eslint.config.mjs` de la raíz (ADR 0020). Actualizar `.claude/rules/blocks.md` (ESLint 10, flat config). Si `@babel/runtime` aparece en `build/`, pasar a `dependencies`. Rebuild y commit de `blocks/*/build/` (los nombres no cambian). Un commit para los tres, o uno por bloque si alguno da guerra.
- Archivos: `blocks/{now-playing,programs-list,schedule}/{package.json,package-lock.json,eslint.config.mjs,.eslintrc.json(borrar),build/}`, `.claude/rules/blocks.md`, y cualquier ruta de `.eslintrc.json` en hooks/CI (`grep -rn eslintrc .claude .github scripts`).
- Test: e2e de bloques en WP 6.6 (`tests/e2e/blocks.spec.ts`) y snapshots de render en integración.
- Verificación: `for b in now-playing programs-list schedule; do npm --prefix blocks/$b run check || exit 1; done && git status --short blocks/*/build && npm run check:zip`
- Commit: `build(0003): upgrade block dependencies (1.2)`
- Resultado: los tres en `@wordpress/scripts` 37.0.0 y `@babel/runtime` 7.29.10; TS 6.0.3 en `now-playing` (fijado, peer de `typescript-eslint` 8.72; en los otros dos lo resuelve npm por el mismo peer). Lockfiles regenerados: el árbol de la 28 chocaba con los peer opcionales de la 37 (`vitest`/`@types/node`). `eslint.config.mjs` propio en cada bloque con el recomendado de `@wordpress/eslint-plugin` 28 más el `ignore` de `@wordpress/*` que traía la 20 (`import/no-unresolved` e `import/internal-regex`; la 28 ya no lo trae y fallaban los imports de los externals). `wp-prettier` 3.9 reindenta dos líneas por bloque y `jsdoc/reject-function-type` pide un tipo concreto en `edit.js` (solo el comentario). `@babel/runtime` no aparece en `build/`: sigue en `devDependencies`. El hook `format-edited-file.sh` deja de pasar `ESLINT_USE_FLAT_CONFIG=false`. `build/`: mismas dependencias en `index.asset.php` (ahora en varias líneas) y otro `version`; cambia el runtime de webpack. `npm run check`, `check:zip` y `blocks.spec.ts` en WP 6.6 (Chromium + WebKit) en verde. Integración: 20 snapshots de `BlockRenderTest` (`schedule` y `programs-list` con orden `natural`) fallan, **igual sin esta tarea**: el test depende del día real de la semana (falla los lunes y martes): K73, se corrige en la 0013 (decisión del usuario).
- [x] hecha · commit: 61f6f43

### 1.2b Snapshots de `BlockRenderTest` independientes del día de la semana (K73) (≈ 30–45 min)
- Qué: los 20 snapshots con orden `natural` (4 de `schedule`, 16 de `programs-list`) fallan los lunes y martes (hora del sitio). `Clock::run( 'wednesday', … )` rota los días para que «hoy» sea el miércoles del vector, pero `natural` ordena por los días reales. Arreglar **solo el test**: que el orden `natural` esperado no dependa de la rotación (p. ej. comparar el orden tras desrotar, o un «ahora» falso inyectable en `Clock` para reproducirlo cualquier día). Debe seguir comprobando que `natural` va de lunes a domingo. Aprobado por el usuario (2026-10-20) como desviación de la 0003: es un fallo del test, no del producto.
- Prohibido: cambiar los snapshots (`tests/php/integration/snapshots/blocks/`), `render.php` o `includes/`.
- Archivos: `tests/php/integration/Blocks/BlockRenderTest.php` y, si hace falta, `tests/php/integration/Support/Clock.php`; `docs/known-issues.md` (K73 → corregido, spec 0003).
- Test: rojo primero. Hacerlo **un lunes o un martes** (el próximo: 2026-10-26), o con el «ahora» falso de `Clock` si se añade: `npm run test:php:integration -- --filter BlockRenderTest` falla con los 20 antes del arreglo y pasa después. Un miércoles pasa con o sin arreglo y no prueba nada.
- Verificación: `npm run check && npm run test:php:integration` en `env:start:min` y `env:start:latest`, y `git diff --stat tests/php/integration/snapshots` vacío.
- Commit: `test(0003): make block render snapshots independent of the weekday (1.2b)`
- Resultado: «ahora» falso sin tocar el plugin: `Clock::set()`/`run()` aceptan `$exact_day`. El desfase puede abarcar varios días (hasta ±96 h; PHP 7.4 y 8.x aceptan hasta ±99:59, y `wp_timezone_string()` lo imprime bien), así que el día local es el pedido y la rotación es la identidad. `BlockRenderTest` lo usa y deja de rotar y desrotar: el sitio está en un miércoles real, así que `natural` comprueba de verdad lunes → domingo y `current_first` el miércoles primero. Los demás usos de `Clock` no cambian. Test nuevo en `SupportTest` (`test_clock_exact_day_sets_requested_local_day`, los 6 destinos). Rojo el martes 2026-10-20 (20 fallos en WP 6.6). Mutación (modo exacto desactivado): 26 fallos. Después, `npm run check` y la integración completa (378 tests) en verde en `env:start:min` y en `env:start:latest`, y los snapshots sin cambios.
- [x] hecha · commit: 72d090d

### 1.3 Excepciones en el ADR 0022 (≈ 15 min)
- Qué: anotar TS 6.0.x en el player (peer de `typescript-eslint`, se revisa cuando admita la 7, riesgo 6), `@babel/runtime` 7.x en los bloques (`@wordpress/scripts` 37 sigue en Babel 7), y el estado nuevo del TS de `now-playing` (quitar o actualizar su excepción). Más las que hayan salido de 1.1/1.2.
- Archivos: `docs/adr/0022-latest-stable-versions.md`.
- Verificación: `npm --prefix player outdated; for b in now-playing programs-list schedule; do npm --prefix blocks/$b outdated; done` (solo listan lo del ADR)
- Commit: `docs(0003): record dependency exceptions in ADR 0022 (1.3)`
- Resultado: dos excepciones nuevas y una que se sustituye. TS 6.0.x en `player/` y `now-playing` (sustituye a la 5.9.3 de la 0001; `typescript-eslint` 8.72 pide `<6.1.0`; en `programs-list` y `schedule` la resuelve npm por el mismo *peer*). `@babel/runtime` 7.29.x en los bloques (`@wordpress/scripts` 37 sigue en Babel 7). La regla del ADR pasa a cubrir también las fijadas por un *peer*, no solo por la matriz de mínimos. De 1.1 y 1.2 no salió ninguna más (sin `overrides`). `outdated` lista solo eso: `typescript` 7.0.2 en el player y `now-playing`, `@babel/runtime` 8.0.7 en los tres bloques.
- [x] hecha · commit: 124fb5a

### 1.4 Verificación completa y tabla del bundle (≈ 1 h; solo cambia `player/package.json`)
- Antes: fijar con versión exacta las 12 `devDependencies` de `player/package.json` (hoy con `^`/`~`, ya en la 3.4.2), como pide el ADR 0022. Se fija la versión que ya resuelve el lockfile, así que solo cambian los rangos de `package.json` y la raíz del `package-lock.json`, no el árbol (`npm --prefix player ci` igual que antes). Las `dependencies` de runtime no (el ADR solo habla de las de desarrollo). Commit propio: `build(0003): pin player dev dependencies to exact versions (1.4)`. Decidido por el usuario (2026-10-20).
- Qué: `npm run check`; integración y e2e completos en las dos puntas; A4; tabla del bundle antes/después en el cuerpo del PR #38 (`gh pr edit 38 --body …`); añadir A7 a «Verificación manual pendiente» de `docs/status.md`. Si un e2e falla: se arregla la causa en el commit del proyecto afectado (nuevo commit `fix`/`build` con su número de tarea), nunca el test.
- Verificación: `npm run check && npm run env:start:min && npm run test:php:integration && npm run test:e2e && npm run env:start:latest && npm run test:php:integration && npm run test:e2e` y el `git diff` de A4 vacío.
- Commit: `docs(0003): record verification and pending visual review (1.4)` (status + marcas del plan)
- [ ] hecha · commit: —

### 1.5 Ajustes de la revisión visual (solo si hacen falta)
- Qué: el usuario revisa en <http://localhost:8886> (`npm run env:start`). Diferencias por MUI 9 → compensar en `player/src/config/theme.ts` si no cambia nada visible respecto a la 3.4.2; si el cambio se queda, ADR aprobado por el usuario.
- Verificación: `npm --prefix player run check && npm --prefix player run build` y nueva aprobación del usuario.
- Commit: `fix(0003): restore 3.4.2 look after MUI 9 (1.5)` (si aplica)
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- ~~Si MUI 9 exige un `build.target` más alto que el de Vite 6 → preguntar y ADR~~ → ADR 0027 (2026-10-20): target de Vite 6 explícito; soporte efectivo el de MUI 9 (Safari 17+). Aceptado por el usuario.
- Si el build de `@wordpress/scripts` 37 no funciona en WP 6.6 → fijar la versión más alta que funcione, excepción en el ADR 0022 (riesgo 5).
- Si el bundle crece > 10 % → primero imports por ruta en `VolumeControl.tsx`, `StreamInfo.tsx`, `AllProgramsModal.tsx`, `ScheduleModal.tsx` (riesgo 3); si no basta, preguntar.
