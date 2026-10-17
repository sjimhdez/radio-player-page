# Spec 0002 · Fase 2 — E2E y cierre del catálogo
Estado: en curso · Inicio: 2026-10-17 · ADRs: 0001, 0004, 0013, 0017, 0018, 0019, 0022 (+ nuevo: línea base de axe)

## Contexto
Lo medido al planificar (2026-10-17):

- **La rama** `spec/0002-safety-net` ya contiene `origin/trunk` (PR en borrador #37). Al empezar: `git fetch` y, si `trunk` avanzó, `git merge origin/trunk`.
- **E2E actual:** solo `tests/e2e/smoke.spec.ts`. `fixtures.ts` aborta todo lo que no sea el origen del sitio (`:8890`), `data:` o `blob:`. `global-setup.ts` activa el plugin, ejecuta `scripts/fixtures/seed.php` y guarda la URL de la página en `test-results/e2e-seed.json`. Un worker; 2 reintentos solo en CI; Chromium + WebKit. El job `E2E (…)` de la CI ya corre en las dos puntas.
- **Un solo entorno wp-env** (`.wp-env.tests.json`, `:8890`): la integración usa `wptests_` y el e2e usa `wp_`. El plugin está montado desde el repo (`"plugins": ["."]`).
- **El servidor de medios corre en el host** y el navegador también, así que `http://localhost:8901` (con CORS) y `:8902` (sin CORS) son otros orígenes, distintos de `:8890`. Las emisoras guardan esas URLs en la meta. El spike (`spike/e2e/server.mjs`) ya sirve `Range`, un MP3 infinito y HLS/DASH; se reescribe en `tests/e2e/` (no se importa).
- **Medios del spike:** el tono de 60 s pesa 940 KB. Se regeneran de 8 s (~130 KB entre todos), y el MP3 infinito lo repite en bucle.
- **`radplapag_output_clean_page()`** (`radio-player-page.php:242`) imprime `<head>` y las tres globales con `JSON_HEX_TAG|AMP|APOS|QUOT`, y termina con `exit`. El `wp_die()` salta si falta `player/dist/manifest.json` o si no tiene `src/main.tsx`. `timezoneOffset` se calcula con `getOffset(new DateTime())` en cada petición (C9).
- **`player/dist` alternativo** (§4.2): no se puede tocar `player/dist/` (invariante 8), ni renombrar el manifiesto dentro del contenedor (es el archivo del host). **Propuesta:** dos `mappings` en `.wp-env.tests.json` montan el repo como plugins extra, `radplapag-no-manifest` y `radplapag-no-main-entry`. Encima de cada uno se monta su `player/dist` desde `tests/fixtures/player-dist/<caso>/` (montaje anidado). El test desactiva el plugin real, activa la variante, pide la página y lo restaura en `finally`. Si el montaje anidado no funciona en las dos puntas: **parar y preguntar**.
- **C13:** el guardado no compara esquemas (`includes/radplapag-station-cpt.php:723-771`: solo `esc_url_raw`). El entorno de test es `http`, así que el e2e fija que un stream `http://` se guarda sin ningún aviso, y la nota lo explica.
- **i18n:** `lang` sale de `get_bloginfo( 'language' )`, y el detector sigue el orden `htmlTag → localStorage → navigator` (`player/src/config/i18n.ts:106`). El e2e cambia `WPLANG` con WP-CLI durante el test y lo restaura después. No hace falta paquete de idioma: el texto del player es suyo.
- **Editor de bloques:** para insertar bloques se usa `wp.data.dispatch( 'core/block-editor' ).insertBlocks( wp.blocks.createBlock( … ) )` en `page.evaluate`. Funciona igual en WP 6.6 y en 7.1, y evita añadir `@wordpress/e2e-test-utils-playwright`.
- **Snapshots:** Playwright añade por defecto el proyecto y la plataforma al nombre. Los snapshots HTTP (`request`, sin navegador) solo corren en `chromium`, con un `snapshotPathTemplate` sin plataforma, en `tests/e2e/snapshots/`. Se actualizan con `--update-snapshots`.
- **Dependencias:** solo `@axe-core/playwright` como dev de la raíz (§4.4, última estable, ADR 0022). No hay dependencias de runtime.
- **Lógica de soporte en JS** (`.mjs`), con test en `tests/js/e2e/*.test.js`: el proyecto `node` de Vitest ya incluye `tests/js/**`. Así los tests corren en `npm run check` sin Docker.

## Objetivo
Fijar en el navegador y por HTTP el comportamiento de la 3.4.2 que no cabe en unit/integración. Eso incluye la página limpia y sus globales, los 12 escenarios de §4.4 en Chromium y WebKit en las dos puntas, y la línea base de axe. También se cierra el catálogo (C1, C4, C6, C7, C8, C9-PHP, C13, C15, K1, K15) y se completa `contract-map.md`. No se toca código publicado.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A2: los 12 escenarios pasan en Chromium y WebKit, en las dos puntas | jobs `E2E (PHP 7.4 + WP 6.6…)` y `E2E (PHP 8.4 + latest WP…)`; en local, `npm run test:e2e` tras `env:start:min` y tras `env:start:latest` |
| Snapshot HTTP de la página limpia y de las globales (§4.2), casos no interceptados y `wp_die` | `tests/e2e/clean-page.spec.ts`; mutación: cambiar un `JSON_HEX_*` o el orden de una meta → falla (revertida) |
| A4: cada punto de `SPEC.md` §3–§4 con test | `contract-map.md` sin filas «fase 2»; revisión de `spec-conformance-reviewer` |
| A6: C1–C16 (salvo C14) y K1 confirmados o «no se reproduce»; C5 «sin confirmar» con la nota de zona congelada | `docs/known-issues.md`, columna «Test que lo fija» |
| Línea base de axe: falla con cualquier violación nueva | `tests/e2e/a11y.spec.ts` + `tests/e2e/a11y-baseline.json`; mutación: quitar una entrada de la línea base → falla; ADR nuevo |
| Ningún test sale a internet | `fixtures.ts` (solo el sitio y los dos orígenes de medios) |
| Ningún archivo publicado cambia | `git diff --stat origin/trunk -- radio-player-page.php includes admin uninstall.php blocks/*/render.php blocks/*/src blocks/*/block.json player/src player/dist blocks/*/build` vacío (salvo tests del player) |
| `npm run check` en verde | `npm run check` |

## Tareas

### 2.1 Medios de prueba (≤ 1 h)
- Qué: `scripts/fixtures/make-audio.sh` (sale de `spike/e2e/make-media.sh`). Genera `tests/fixtures/audio/`, que se commitea: `tone.mp3` y `tone.ogg` (8 s, 440 Hz, 64 kbps), `hls/` (`index.m3u8` + segmentos de 2 s), `dash/` (`manifest.mpd` + segmentos) e `intro.mp3` (2 s, 880 Hz, que se distingue del directo). README breve con el comando.
- Archivos: `scripts/fixtures/make-audio.sh`, `tests/fixtures/audio/**`, `scripts/fixtures/README.md`.
- Test: — (lo usan las 2.2 y siguientes). `npm run check:zip` confirma que no entra en el zip.
- Verificación: `bash scripts/fixtures/make-audio.sh && du -sh tests/fixtures/audio && npm run check:zip`
- Nota: mono, 44,1 kHz y 64 kbps en todo (también el AAC de HLS y DASH); salida *bit-exact* (`-fflags +bitexact`, sin metadatos), así que regenerar no ensucia el árbol (comprobado con dos ejecuciones). Pesan 240 KB, no ~130: HLS y DASH son ~90 KB cada uno. HLS sale con un último segmento de 23 ms (el retardo del codificador AAC). ESLint ignora `tests/fixtures/audio/**`: los segmentos `.ts` son MPEG-TS y los parseaba como TypeScript.
- [x] hecha · commit: —

### 2.2 Servidor de medios (≤ 1 h)
- Qué: `tests/e2e/media-server.mjs` exporta `startMediaServers({ cors, noCors })` → `{ close() }`. Dos orígenes (con y sin `Access-Control-Allow-Origin`, `OPTIONS`, `Range`), que sirven `tests/fixtures/audio/` y tres rutas especiales:
  - `/live.mp3`: infinito, estilo Icecast;
  - `/cut.mp3`: corta la conexión tras ~2 s (C8);
  - `/broken-intro.mp3`: 404.

  Cuenta las peticiones por ruta (`GET /__requests`) para C7 y C8. `global-setup` lo arranca (puertos 8901/8902) y devuelve el *teardown*. `fixtures.ts` permite esos dos orígenes y nada más.
- Archivos: `tests/e2e/media-server.mjs`, `tests/e2e/global-setup.ts`, `tests/e2e/fixtures.ts`, `tests/js/e2e/media-server.test.js`.
- Test: primero (TDD), `tests/js/e2e/media-server.test.js` en puertos libres. Comprueba las cabeceras CORS solo en un origen, que `Range` da 206, que `live.mp3` sigue mandando datos pasado el tamaño del archivo, que `cut.mp3` se cierra, el contador y que no sirve nada fuera de `audio/` (`../`).
- Verificación: `npm test -- tests/js/e2e/media-server.test.js`
- [ ] hecha · commit: —

### 2.3 Sembrador de e2e y sesión de admin (≤ 1 h)
- Qué: `tests/e2e/fixtures/seed-e2e.php` (WP-CLI), idempotente, con títulos fijos y una etiqueta propia para borrar lo de la ejecución anterior. Fija `timezone_string = Asia/Kolkata`. Crea una página + emisora por variante:
  - `E2E MP3` (`:8901/tone.mp3`, con horario de la parrilla de `known-issues.md`);
  - `E2E Live` (`/live.mp3`), `E2E Cut`, `E2E HLS`, `E2E DASH`;
  - `E2E No CORS MP3` / `HLS`;
  - `E2E Intro` / `E2E Broken Intro`;
  - una por visualizador (`oscilloscope`, `bars`, `particles`, `waterfall`);
  - `E2E Minimal` (sin imágenes, sin horario, título con `<>&'"`);
  - los casos no interceptados (página en borrador, con contraseña, sin emisora, y una entrada que no es página);
  - una página con los tres bloques.

  Imprime un JSON con las URLs y el mapa ID → nombre. `global-setup` lo guarda en `e2e-seed.json` (amplía `Seed`) y hace el login de `admin` en `playwright/.auth/admin.json` (`storageState`).
- Archivos: `tests/e2e/fixtures/seed-e2e.php`, `tests/e2e/global-setup.ts`, `tests/e2e/seed.ts`, `tests/e2e/smoke.spec.ts`.
- Test: caracterización, `smoke.spec.ts`: cada URL sembrada responde 200 y, con el `storageState`, `wp-admin/edit.php?post_type=radplapag_station` lista las emisoras. Ejecutar dos veces seguidas (idempotencia).
- Verificación: `npm run test:e2e -- smoke.spec.ts && npm run test:e2e -- smoke.spec.ts`
- [ ] hecha · commit: —

### 2.4 Normalizador de snapshots (≤ 1 h)
- Qué: `tests/e2e/support/normalize.mjs` (sale de `spike/clean-page/normalize.mjs`). Hace estos cambios:
  - el origen del sitio pasa a `{{SITE}}`, y los de medios a `{{MEDIA}}` / `{{MEDIA_NOCORS}}` (también escapados `\/` en JSON);
  - `uploads/AAAA/MM` pasa a `{{YYYY}}/{{MM}}`;
  - los IDs (`"id":"123"`, `"program_id":"123"`, `?page_id=`, `-123x` en nombres de imagen si aparece) pasan a `{{ID:<nombre>}}` con el mapa del sembrador;
  - una etiqueta por línea.

  `timezoneOffset` **no** se normaliza (`Asia/Kolkata`, sin DST: 5.5 fija C9).
- Archivos: `tests/e2e/support/normalize.mjs`, `tests/js/e2e/normalize.test.js`.
- Test: primero (TDD), `normalize.test.js`: URL plana y escapada, puertos distintos, uploads, IDs con y sin mapa (un ID sin nombre falla, para que no se cuele), idempotencia.
- Verificación: `npm test -- tests/js/e2e/normalize.test.js`
- [ ] hecha · commit: —

### 2.5 Snapshot HTTP de la página limpia y de las globales (≤ 1 h)
- Qué: `tests/e2e/clean-page.spec.ts` (`request`, solo `chromium`; `snapshotPathTemplate` sin plataforma en `playwright.config.ts`). Snapshot normalizado de `E2E MP3` (completa) y de `E2E Minimal`. Además, asserts explícitos sobre:
  - HTML sin `wp_head()`/`wp_footer()`;
  - `lang`, `<title>`, favicon, `description`, Open Graph, Twitter Card y la imagen social (logo → fondo → favicon);
  - escapes `JSON_HEX_*` (`\u003C`, `\u0026`, `\u0027`, `\u0022`);
  - `RADPLAPAG_PROGRAMS` en orden de primera aparición en el horario;
  - el horario sin días vacíos;
  - `timezoneOffset` numérico, `5.5` (C9, parte PHP: un número fijo por petición, sin la zona ni sus transiciones);
  - CSS/JS desde el manifiesto.

  El mismo snapshot vale en las dos puntas; si WP 6.6 y 7.1 difieren, se normaliza la diferencia y se apunta.
- Archivos: `tests/e2e/clean-page.spec.ts`, `tests/e2e/snapshots/*.html`, `playwright.config.ts`, `docs/known-issues.md` (C9).
- Test: caracterización. Mutación: quitar `JSON_HEX_APOS` y cambiar el orden de dos `<meta>` en `radio-player-page.php` → falla; se revierte.
- Verificación: `npm run test:e2e -- clean-page.spec.ts --project=chromium`
- [ ] hecha · commit: —

### 2.6 Casos no interceptados y `wp_die` (≤ 1 h)
- Qué: en `clean-page.spec.ts`, comprobar que el borrador (con sesión de admin), la página con contraseña, la página sin emisora y la entrada que no es página **sirven el tema**: hay `wp_head`, no hay `#root` y no hay `RADPLAPAG_CONFIG`. Para la ruta `wp_die`, añadir las dos variantes del plugin por `mappings` en `.wp-env.tests.json` (ver Contexto), con `tests/fixtures/player-dist/no-manifest/` (vacío con `.gitkeep`) y `tests/fixtures/player-dist/no-main-entry/manifest.json`. El test cambia el plugin activo con WP-CLI, comprueba el estado HTTP y el mensaje de `wp_die`, y restaura el plugin en `finally`. Se mide si la integración ve las variantes (no deberían cargarse: no están activas).
- Archivos: `tests/e2e/clean-page.spec.ts`, `.wp-env.tests.json`, `tests/fixtures/player-dist/**`, `tests/e2e/support/wp-cli.ts` (sale del `wpCli` de `global-setup`).
- Test: caracterización. Mutación: cambiar el texto del `wp_die` → falla.
- Verificación: `npm run env:start:latest && npm run test:e2e -- clean-page.spec.ts --project=chromium && npm run test:php:integration`
- Si el montaje anidado no funciona en una punta: parar y preguntar.
- [ ] hecha · commit: —

### 2.7 Escenario 1: MP3, pausa y corte (C7, C8) (≤ 1 h)
- Qué: `tests/e2e/mp3.spec.ts`, con un helper `tests/e2e/support/player.ts` que pulsa Play y espera `playing` + `currentTime > 1` (eventos, no timeouts fijos). Casos:
  - MP3 finito (`E2E MP3`) e infinito (`E2E Live`) reproducen;
  - C7: con `Live`, Pausa y luego Play. Se fija si hay una petición nueva al servidor y si `currentTime` sigue desde el buffer. Si se confirma, `currently`;
  - C8: con `E2E Cut`, el stream se corta. Se fija que no hay petición nueva (sin reconexión) y el estado que muestra la UI.
- Archivos: `tests/e2e/mp3.spec.ts`, `tests/e2e/support/player.ts`, `docs/known-issues.md` (C7, C8).
- Test: caracterización. Mutación: el helper espera `currentTime > 1000` → falla por timeout (y se revierte).
- Verificación: `npm run test:e2e -- mp3.spec.ts`
- [ ] hecha · commit: —

### 2.8 Escenario 2: HLS y DASH (≤ 1 h)
- Qué: `tests/e2e/hls-dash.spec.ts`. HLS y DASH reproducen. Se fija qué camino usa cada navegador: `audio.src` empieza por `blob:` (MSE: `hls.js`/`dashjs`) o es la URL (nativo). En WebKit de escritorio se espera `hls.js`; lo medido se apunta en la nota (riesgo 8). Los chunks de `hls.js`/`dashjs` solo se piden cuando el protocolo los necesita (con MP3, ninguno).
- Archivos: `tests/e2e/hls-dash.spec.ts`.
- Test: caracterización. Mutación: esperar el chunk de `dashjs` con HLS → falla.
- Verificación: `npm run test:e2e -- hls-dash.spec.ts`
- [ ] hecha · commit: —

### 2.9 Escenario 3: bienvenida (≤ 1 h)
- Qué: `tests/e2e/intro.spec.ts`. Con `E2E Intro`:
  - suena primero la intro (`audio.src` termina en `intro.mp3`) y después el directo;
  - la intro suena una sola vez (tras Pausa + Play no vuelve);
  - el botón de pausa no actúa (o no está) mientras suena.

  Con `E2E Broken Intro` pasa al directo sin mensaje de error.
- Archivos: `tests/e2e/intro.spec.ts`.
- Test: caracterización. Mutación: esperar la intro dos veces → falla.
- Verificación: `npm run test:e2e -- intro.spec.ts`
- [ ] hecha · commit: —

### 2.10 Escenario 4: `crossOrigin`, C1 y K1 (≤ 1 h)
- Qué: `tests/e2e/cross-origin.spec.ts`:
  - `audio.crossOrigin === 'anonymous'` con MP3 e intro (y con HLS nativo si algún navegador lo usa), y `null` con `hls.js`/`dashjs` (ADR 0004);
  - sin CORS, C1 `currently`: MP3 y HLS no avanzan;
  - K1 `currently`: en Chromium, MP3 sin CORS da `audio.error.code === 4` sin mostrar «Unable to play the stream»; en WebKit sí se muestra; con HLS sin CORS, en los dos.

  Se espera al evento `error` o al mensaje, no a un timeout.
- Archivos: `tests/e2e/cross-origin.spec.ts`, `docs/known-issues.md` (C1, K1).
- Test: caracterización. Mutación: quitar `crossOrigin` en el directo de `use-audio-player.tsx` y reconstruir → falla; revertir y reconstruir (`dist/` idéntico).
- Verificación: `npm run test:e2e -- cross-origin.spec.ts`
- [ ] hecha · commit: —

### 2.11 Escenario 5: programa actual y siguiente (≤ 1 h)
- Qué: `tests/e2e/schedule.spec.ts`, con `page.clock.install({ time })` calculado para `Asia/Kolkata` (+5:30) y la parrilla de `known-issues.md` sembrada en `E2E MP3`. Casos (vectores 2, 3, 7, 13 y una franja vacía):
  - franja normal;
  - reposición;
  - cruce de medianoche (de ayer);
  - franja vacía;
  - C16 (`currently`: lunes 00:10 muestra C);
  - «siguiente» a 10 min.

  **Informativo:** con el MP3 sonando, `clock.fastForward` hasta pasado el fin del programa. El programa mostrado cambia; `paused`, `src` y el número de peticiones no cambian.
- Archivos: `tests/e2e/schedule.spec.ts`, `tests/e2e/support/clock.ts` (día y hora de la emisora → instante UTC).
- Test: caracterización. Mutación: el helper con offset 5 en lugar de 5.5 → falla.
- Verificación: `npm run test:e2e -- schedule.spec.ts`
- [ ] hecha · commit: —

### 2.12 Escenario 6: modales (C4, C6) (≤ 1 h)
- Qué: `tests/e2e/modals.spec.ts`:
  - abrir y cerrar el modal del horario (Escape y botón);
  - días en orden, con la reposición marcada;
  - C4 `currently`: martes 01:00 (C de ayer en antena) sin «On Air» en el modal del horario, mientras el modal de programas sí lo marca;
  - modal de todos los programas: C6 `currently`, «Show more» aparece en un programa sin descripción larga y los horarios solo se ven al expandir. Si no se reproduce, se apunta así.
- Archivos: `tests/e2e/modals.spec.ts`, `tests/e2e/fixtures/seed-e2e.php` (un programa sin descripción larga, si falta), `docs/known-issues.md` (C4, C6).
- Test: caracterización. Mutación: esperar «On Air» en C4 → falla.
- Verificación: `npm run test:e2e -- modals.spec.ts`
- [ ] hecha · commit: —

### 2.13 Escenario 7: sueño (≤ 1 h)
- Qué: `tests/e2e/sleep.spec.ts`, con `page.clock`. Casos:
  - elegir la opción más corta, avanzar el reloj y comprobar que pausa y que la cuenta atrás se ve;
  - pausar a mano lo cancela: al reanudar y avanzar, sigue sonando;
  - el botón de cancelar del temporizador.
- Archivos: `tests/e2e/sleep.spec.ts`.
- Test: caracterización. Mutación: avanzar un segundo menos de lo necesario → no pausa (falla).
- Verificación: `npm run test:e2e -- sleep.spec.ts`
- [ ] hecha · commit: —

### 2.14 Escenarios 8 y 9: visualizadores e i18n (≤ 1 h)
- Qué:
  - `tests/e2e/visualizers.spec.ts`: con cada valor de `visualizer` (y uno no válido, que el PHP cambia a `oscilloscope`), la página carga y reproduce, hay un `canvas` y no hay errores en consola ni `pageerror`. No se miran píxeles (ADR 0018).
  - `tests/e2e/i18n.spec.ts`: `WPLANG=es_ES` → `lang="es-ES"` y textos en español (Play → su traducción de `es`); un locale sin traducción (`eu`) → inglés; con `localStorage` fijado, gana `lang` (orden `htmlTag` primero). Restaura `WPLANG` en `finally`.
- Archivos: `tests/e2e/visualizers.spec.ts`, `tests/e2e/i18n.spec.ts`.
- Test: caracterización. Mutación: esperar el texto en inglés con `es_ES` → falla.
- Verificación: `npm run test:e2e -- visualizers.spec.ts i18n.spec.ts`
- [ ] hecha · commit: —

### 2.15 Escenario 10 (a): admin, crear y guardar (C13) (≤ 1 h)
- Qué: `tests/e2e/admin.spec.ts` con `storageState`:
  - crear un programa con descripción;
  - crear una emisora con URL (`:8901/tone.mp3`), página, tema, visualizador y una franja;
  - tras guardar, la meta tiene la URL y la página (el camino que la integración no alcanza: `filter_input`), y el player de esa página refleja título, tema y programa;
  - la página ya asignada sale desactivada en el selector de otra emisora;
  - C13: un stream `http://` se guarda sin ningún aviso (el código no compara esquemas; el entorno es `http`).

  Limpia lo creado en `afterAll`.
- Archivos: `tests/e2e/admin.spec.ts`, `docs/known-issues.md` (C13).
- Test: caracterización. Mutación: esperar un aviso con C13 → falla.
- Verificación: `npm run test:e2e -- admin.spec.ts`
- [ ] hecha · commit: —

### 2.16 Escenario 10 (b): admin, validación, aviso tras guardar y K15 (≤ 1 h)
- Qué:
  - errores del cliente (solape, formato y fila incompleta) visibles y el envío bloqueado;
  - errores del servidor: el envío con el JS desactivado (`javaScriptEnabled: false` o quitando el `submit` del cliente) muestra el cuerpo del aviso tras guardar (transients de campos y de horario) con el texto de la 3.4.2, y la URL vacía da su error;
  - K15: quitar una fila intermedia, añadir otra y guardar → se pierde o se mezcla una franja (`currently`), con el resultado leído de la meta.
- Archivos: `tests/e2e/admin.spec.ts`, `docs/known-issues.md` (K15, filas del aviso).
- Test: caracterización. Mutación: esperar las dos franjas tras K15 → falla.
- Verificación: `npm run test:e2e -- admin.spec.ts`
- [ ] hecha · commit: —

### 2.17 Escenario 11: bloques en el frontend y en el editor (≤ 1 h)
- Qué: `tests/e2e/blocks.spec.ts`:
  - frontend: la página sembrada con los tres bloques los muestra (horario, lista de programas y programa en antena, con `page.clock` no hace falta: el PHP usa la hora real y se comprueba la estructura, no el programa);
  - editor: en una entrada nueva se insertan los tres bloques con `wp.data`, se elige la emisora en el inspector y la previsualización de `ServerSideRender` muestra contenido (y `now-playing` vacío sin programa).

  En las dos puntas.
- Archivos: `tests/e2e/blocks.spec.ts`.
- Test: caracterización. Mutación: esperar un bloque `radplapag/inexistente` → falla.
- Verificación: `npm run test:e2e -- blocks.spec.ts`
- [ ] hecha · commit: —

### 2.18 Escenario 12: accesibilidad y su línea base (≤ 1 h)
- Qué:
  - `@axe-core/playwright` (dev de la raíz, última estable);
  - `tests/e2e/a11y.spec.ts`: axe sobre la página del reproductor (parada y sonando, y con los modales abiertos), la página de bloques y los contenedores de los meta boxes de emisora y programa (`include` de sus selectores);
  - `tests/e2e/a11y-baseline.json`, con clave estable `página · regla · selector` y la escritura solo con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`. Falla con cualquier violación fuera de la línea base y avisa de las que ya no aparecen;
  - una fila `axe` por regla en `known-issues.md`; C15 se confirma o se descarta con ellas (los `alt` literales con un assert de texto, porque axe no los detecta);
  - ADR «Línea base de axe» (`write-adr`).
- Archivos: `package.json`, `package-lock.json`, `tests/e2e/a11y.spec.ts`, `tests/e2e/a11y-baseline.json`, `docs/known-issues.md`, `docs/adr/00NN-axe-baseline.md`, `docs/adr/README.md`.
- Test: caracterización. Mutación: quitar una entrada de la línea base → falla.
- Verificación: `npm run test:e2e -- a11y.spec.ts`
- [ ] hecha · commit: —

### 2.19 Cierre del catálogo y del mapa del contrato (≤ 1 h)
- Qué:
  - `contract-map.md`: cada fila «fase 2» o «parcial» pasa a su test e2e;
  - `known-issues.md`: C1, C4, C6, C7, C8, C9, C13, C15 y K1 con test `currently` o «no se reproduce». C5 sigue «sin confirmar», con la nota de zona congelada (ADR 0018);
  - estabilidad: el suite completo tres veces seguidas en local, en las dos puntas, sin reintentos (`--retries=0 --repeat-each=1`, tres ejecuciones); se apunta la duración.
- Archivos: `docs/specs/0002-safety-net/contract-map.md`, `docs/known-issues.md`, `docs/status.md`.
- Test: — (revisión de `spec-conformance-reviewer` en `close-phase`).
- Verificación: `npm run check && npm run test:e2e -- --retries=0`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- **Línea base de axe** (2.18): el criterio es «ninguna violación nueva», no «cero».
- **`player/dist` alternativo con montajes anidados** (2.6): es configuración de test, no hace falta ADR. Si no funciona, se para y se pregunta (la alternativa tocaría código publicado y necesitaría su ADR).
- **C5:** queda «sin confirmar» (zona congelada), salvo que el usuario pida un test que no toque el código.

## Verificación de la fase
- `npm run check`.
- `npm run test:e2e` tras `env:start:min` y tras `env:start:latest`, y `npm run test:php:integration` en las dos (que los `mappings` nuevos no cambian nada).
- `git diff --stat origin/trunk` sobre los archivos publicados, vacío.
- CI del PR #37 en verde.
