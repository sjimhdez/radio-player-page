# Spec 0001 · Fase 0 — Spike (desechable)
Estado: en curso · Inicio: 2026-10-16 · ADRs: (salen de esta fase: R2, versión de Node, excepciones de R7)

> Al aprobarse, este plan se guarda en `docs/specs/0001-bootstrap/phase-0.md` (primer commit de la fase).

## Contexto
La 0001 deja el repo listo para trabajar con specs y tests. Antes de montar nada (fase 1) hay que demostrar que las herramientas de test funcionan con los mínimos (WP 6.6 / PHP 7.4), con la página limpia que termina en `exit` y con la reproducción real de streams. Todo el código va a `spike/`: se versiona en la rama (para poder reproducirlo, como en `podcast-player-page`), no entra en el zip (lista de inclusión de `scripts/build-release-zip.sh`) y no se reutiliza. **No se toca ningún archivo del plugin.**

Entorno local comprobado: Node 22.23.3 (nvm; también 20.19.2), PHP 8.5 + `php@7.4`/`php@8.4` en Homebrew, Composer 2.10, Docker 29.8, ffmpeg e icecast instalados. `gh` **no** está instalado.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| R1: un `WP_UnitTestCase` de humo (plugin activo, CPT `radplapag_station` registrado) pasa en PHP 7.4 + WP 6.6 y en PHP 8.4 + última WP | `npx wp-env run tests-cli … vendor/bin/phpunit` en las dos configuraciones de `spike/php/`, salida apuntada en el informe |
| R2: hay un método elegido para caracterizar `radplapag_output_clean_page()` sin cambiar su salida | prototipo en `spike/clean-page/` que produce un snapshot normalizado estable (dos ejecuciones idénticas) |
| R3: MP3 progresivo, MP3 infinito, HLS y DASH suenan en Chromium y WebKit, en macOS y en Linux (contenedor de Playwright), con y sin CORS | `npx playwright test` en `spike/e2e/` (local y en `mcr.microsoft.com/playwright`), con la matriz de resultados en el informe |
| R4: `use-audio-player` se puede testear con un `FakeAudioElement` y `hls.js`/`dashjs` simulados | `npx vitest run` en `spike/player-unit/`, con happy-dom y con jsdom |
| R5: golden master de la migración desde `radplapag_settings` reconstruidos del historial | test de integración en `spike/php/` que migra cada fixture, compara con su golden y migra dos veces (idempotencia) |
| R6: herramientas OK con la última Node; builds de `player/` y de los 3 bloques idénticos o con diferencia documentada | `diff -r` de `player/dist/` y `blocks/*/build/` tras compilar con la última Node; versión mínima de Node que funciona |
| R7: tabla de la última versión de PHPUnit, Yoast polyfills y wp-env que funciona en ambas puntas de la matriz | ejecuciones de R1 con cada candidata |
| La sesión siguiente arranca en la fase 1 | existe `docs/status.md` apuntando a la fase 1 (§0.2 de la spec: si no existe, se vuelve a la fase 0) |

## Tareas
### 0.1 Andamiaje del spike y censo de versiones (≤ 1 h)
- Qué: `spike/README.md` (cómo reproducir cada riesgo), `spike/.gitignore` (resultados, `vendor/`, `node_modules/`). Censo de la **última versión estable** (fuentes oficiales, con fecha): Node, WordPress, PHPUnit, Yoast polyfills, `@wordpress/env`, Playwright, Vitest, happy-dom, jsdom. Instalar la última Node con nvm (solo en la máquina).
- Archivos: `spike/README.md`, `spike/.gitignore`, borrador de `docs/spikes/0001-phase-0.md` (sección *Entorno*).
- Verificación: `git status` muestra solo `spike/` y `docs/`.
- [x] hecha · commit: 09077f8

### 0.2 R1 + R7 — PHPUnit + suite de WP sobre wp-env (≤ 1 h)
- Qué: `spike/php/composer.json` con `config.platform.php = 7.4`; dos configs de wp-env (`min`: PHP 7.4 + WP 6.6; `latest`: PHP 8.4 + última WP) montando el plugin; bootstrap de integración y un test de humo. Probar PHPUnit 9.6 y, si la última WP lo admite, versiones más nuevas en la punta `latest`, para ver si una sola versión vale para las dos.
- Archivos: `spike/php/{composer.json,phpunit.xml.dist,bootstrap.php,SmokeTest.php,.wp-env.*.json}`.
- Test: humo `WP_UnitTestCase`.
- Verificación: `npx wp-env start` + `npx wp-env run tests-cli --env-cwd=… vendor/bin/phpunit` en cada config.
- [x] hecha · commit: 26e8591

### 0.3 R2 — Caracterizar la página limpia (≤ 1 h)
- Qué: prototipar (a) snapshot por HTTP contra wp-env, con normalización (URLs, versiones, nonces) y fixture de emisora creado por WP-CLI; (b) costura mínima **en una copia dentro de `spike/`** (función que devuelve el HTML) con prueba de identidad byte a byte frente a (a). Recomendar una para el ADR (preferencia inicial: (a), porque no exige tocar código antes de caracterizarlo).
- Archivos: `spike/clean-page/`.
- Verificación: el script de snapshot da la misma salida dos veces seguidas; (b) idéntica a (a).
- [x] hecha · commit: 2d53af5

### 0.4 R3 — Servidor de streams y Playwright (≤ 1 h)
- Qué: servidor Node local con dos orígenes (con y sin `Access-Control-Allow-Origin`) que sirve MP3 progresivo, MP3 infinito (bucle por chunks), HLS y DASH generados con ffmpeg a partir de `scripts/fixtures/assets/intro.mp3`. Página de pruebas que carga el **`player/dist` real** con `window.RADPLAPAG_*` simulados (sin WP). Tests: pulsar play → `currentTime` avanza, `paused === false`, sin `error`. Chromium y WebKit; flags de autoplay. Medir C1 (sin CORS + `crossOrigin='anonymous'`).
- Archivos: `spike/e2e/{package.json,server.mjs,harness.html,playwright.config.ts,streams.spec.ts}`.
- Verificación: `npx playwright test` en macOS y en `docker run mcr.microsoft.com/playwright:<versión>`.
- [x] hecha · commit: 7c588db

### 0.5 R4 — Vitest sobre `use-audio-player` (≤ 1 h)
- Qué: proyecto en `spike/player-unit/` con alias a `player/src` (sin tocar `player/package.json`), `FakeAudioElement` y `vi.mock('hls.js')`/`vi.mock('dashjs')` para los `import()` dinámicos. 3–4 tests: MP3 asigna `src` con `crossOrigin`, HLS no‑iOS crea `Hls`, DASH inicializa con autoplay, iOS usa HLS nativo. Ejecutar con happy-dom y con jsdom y elegir.
- Archivos: `spike/player-unit/{package.json,vitest.config.ts,fake-audio.ts,use-audio-player.test.tsx}`.
- Verificación: `npx vitest run --environment happy-dom` y `--environment jsdom`.
- [x] hecha · commit: 3300a35

### 0.6 R5 — Golden master de la migración (≤ 1 h)
- Qué: reconstruir del historial de git (`git log -S radplapag_settings`; 1.0.1 → 3.2.x) las formas reales de `radplapag_settings` por versión; fixtures JSON; test de integración que fija la opción, ejecuta el migrador (`includes/migration/class-radplapag-migrator-settings-to-cpt.php` vía `includes/radplapag-upgrade.php`), vuelca posts + meta normalizados y compara con el golden; segunda pasada sin cambios.
- Archivos: `spike/php/fixtures/legacy-settings/*.json`, `spike/php/MigrationGoldenTest.php`.
- Verificación: el test pasa en la config `min` de 0.2.
- [x] hecha · commit: —

### 0.7 R6 — Node: builds idénticos y versión mínima (≤ 1 h)
- Qué: con la última Node, `npm ci && npm run build` en `player/` y en `blocks/{schedule,programs-list,now-playing}` (en un worktree temporal, para no ensuciar el árbol), `diff -r` contra lo commiteado; repetir con 20 y 22 para la mínima. Comprobar wp-env, Vitest y Playwright de 0.2–0.5 con la última Node (ojo: el workaround de `test.yml` por el bug de wp-env en Node 24.16+).
- Archivos: solo el informe.
- Verificación: salida de `diff -r` apuntada en el informe.
- [ ] hecha · commit: —

### 0.8 Cierre de la fase (≤ 1 h)
- Qué: informe completo `docs/spikes/0001-phase-0.md` (resumen por riesgo con evidencia); ADRs en `docs/adr/` con su `README.md` índice (como mínimo: método de R2, versión de Node, excepciones de R7); actualizar la spec y la hoja de ruta si algo cambia; `docs/status.md` mínimo (formato §7.7) apuntando a la fase 1; marcar este plan como cerrado. Corregir de paso las erratas de la spec (abajo). Commit `chore(0001): close phase 0`.
- Verificación: cada riesgo del informe tiene ✅ demostrado o alternativa aprobada por el usuario.
- [ ] hecha · commit: —

Commits: `<type>(0001): <description> (0.N)`, sin push.

## Hallazgos de la lectura (para el informe / known-issues, no se arreglan aquí)
- `.github/workflows/test.yml` compila y verifica solo `schedule` y `programs-list`: **`now-playing` no se comprueba en la CI** (candidato `K*`; la CI se rehace en la fase 1).
- `README.md` dice «12 languages» pero hay 14 locales (faltan `cs` y `hr` en la lista); también dice Node 20.x.
- Erratas de la spec: §7.6 `backcompat-reviewer` habla del «contrato de §5» (es §4); el enlace del Apéndice A a `inherited-bugs.md` es relativo a la carpeta equivocada.

## Pendiente del usuario (no bloquea el spike)
- Push de `spec/0001-bootstrap`, protección de `main` en GitHub y PR en borrador (o instalar `gh` para que lo abra yo).

## Decisiones abiertas → ADR
- R2: (a) HTTP o (b) costura.
- Node: versión de desarrollo y mínima.
- R7: versiones fijadas por debajo de la última.
- R4: happy-dom o jsdom.
