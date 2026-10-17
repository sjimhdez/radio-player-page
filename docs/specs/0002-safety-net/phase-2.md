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
- [x] hecha · commit: db4120b

### 2.2 Servidor de medios (≤ 1 h)
- Qué: `tests/e2e/media-server.mjs` exporta `startMediaServers({ cors, noCors })` → `{ close() }`. Dos orígenes (con y sin `Access-Control-Allow-Origin`, `OPTIONS`, `Range`), que sirven `tests/fixtures/audio/` y tres rutas especiales:
  - `/live.mp3`: infinito, estilo Icecast;
  - `/cut.mp3`: corta la conexión tras ~2 s (C8);
  - `/broken-intro.mp3`: 404.

  Cuenta las peticiones por ruta (`GET /__requests`) para C7 y C8. `global-setup` lo arranca (puertos 8901/8902) y devuelve el *teardown*. `fixtures.ts` permite esos dos orígenes y nada más.
- Archivos: `tests/e2e/media-server.mjs`, `tests/e2e/global-setup.ts`, `tests/e2e/fixtures.ts`, `tests/js/e2e/media-server.test.js`.
- Test: primero (TDD), `tests/js/e2e/media-server.test.js` en puertos libres. Comprueba las cabeceras CORS solo en un origen, que `Range` da 206, que `live.mp3` sigue mandando datos pasado el tamaño del archivo, que `cut.mp3` se cierra, el contador y que no sirve nada fuera de `audio/` (`../`).
- Verificación: `npm test -- tests/js/e2e/media-server.test.js`
- Nota: además de `{ close() }` devuelve los puertos (`cors`, `noCors`; `0` elige uno libre) y acepta `cutAfterMs` (2000 por defecto; el test usa 300). `DELETE /__requests` pone el contador a cero (para usarlo entre tests); el contador no cuenta los `OPTIONS` y `/__requests` no lleva CORS: se lee desde Node, no desde la página. Escucha sin host (doble pila): `localhost` resuelve a `::1` o a `127.0.0.1` según el cliente. Playwright compila los `import` estáticos de los `.ts` a `require()`, que rompe `import.meta` en el `.mjs`: `global-setup.ts` y `fixtures.ts` lo cargan con `import()` dinámico. Los servidores se arrancan después de sembrar, para no dejarlos abiertos si la siembra falla. Comprobado en Chromium con un spec temporal (borrado): `:8901` responde a `fetch` desde la página y `:8902` lo bloquea el CORS. El test de `live.mp3` tarda ~4 s (el ritmo es el real ×2).
- [x] hecha · commit: f91b1c7

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
- Nota: el sembrador recibe los dos orígenes de medios como argumentos (los puertos salen de `media-server.mjs`) y se ejecuta con `--user=admin`, para que el título de `E2E Minimal <>&'"` no pase por kses. Además de lo previsto:
  - siete programas `E2E Program A…H` con la parrilla de `known-issues.md`; H no tiene descripción larga, para C6 (2.12);
  - `E2E MP3` lleva logo y fondo (la imagen de `scripts/fixtures/assets/`); `E2E Minimal`, ninguno;
  - la intro rota es un adjunto `audio/mpeg` sin archivo cuyo `guid` apunta a `:8901/broken-intro.mp3` (`wp_get_attachment_url()` cae en el `guid`);
  - el borrador, la página con contraseña (`e2e`) y la entrada tienen una emisora válida asignada, así que lo único que cambia es la condición que no se intercepta;
  - la página de bloques calcula `stationIndex` de `E2E MP3` en `radplapag_get_stations()` (orden `menu_order title`; sale 8). Un test que cree emisoras (2.15) puede desplazarlo mientras existan.
  
  También fija `show_avatars = 0`: la barra de admin pide el avatar a gravatar.com y `fixtures.ts` lo bloquea. Los IDs del mapa usan nombres estables (`page-mp3`, `station-mp3`, `program-A`, `attachment-artwork`…). La lista de emisoras pasa los títulos por `wptexturize`, así que el smoke solo compara el prefijo del título con `<>&`; el título guardado está intacto (comprobado con WP-CLI). Mutación: sin el borrado inicial, la segunda ejecución da 19 filas en vez de 17 y falla. Verificado en WP 6.6.10 + PHP 7.4.33.
- [x] hecha · commit: 3b60fbe

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
- Nota: `normalize( html, { site, media, mediaNoCors, ids } )`. Los orígenes se reciben exactos (no un `localhost:\d+` genérico) y solo casan si no les sigue otro dígito (`:890` no toca `:8901`); otro puerto queda intacto. Los IDs se cambian en `"id"` y `"program_id"` (con o sin comillas) y en `?page_id=`/`&page_id=`; un ID fuera del mapa lanza un error. El `-123x` de imagen no aparece en la página limpia (las URLs son del tamaño completo) y no se normaliza. El corte de etiquetas es `><` → `>\n<`, como en el spike: no colapsa espacios, para que el snapshot vea los cambios de espacio del HTML. Probado sobre `E2E MP3` y `E2E Minimal` sembradas: no lanza y es idempotente. Para la 2.5: las imágenes salen como `station-artwork-1.jpg` porque `scripts/fixtures/seed.php` sube antes la misma imagen; el sufijo es estable mientras se siembre en ese orden. Mutación: devolver el ID sin lanzar → falla «throws on an ID missing from the map».
- [x] hecha · commit: 08b2681

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
- Nota: `snapshotPathTemplate` es global (`{testDir}/snapshots/{arg}{ext}`) y el `describe` se salta fuera de Chromium. Los snapshots `mp3.html` y `minimal.html` son idénticos en WP 6.6.10 + PHP 7.4.33 y en WP 7.1.3 + PHP 8.4: no ha hecho falta normalizar nada más. Los assets salen con la versión (`radio-player-page-3.4.2.min.js`), no con un hash, así que el snapshot cambia con cada versión; se deja así (los nombres de assets son contrato). Además de lo previsto:
  - la cadena de la imagen social: `E2E MP3` usa el mismo adjunto como logo y fondo, así que el test cambia `E2E Minimal` con WP-CLI (`site_icon`, luego fondo con la imagen de `scripts/fixtures/seed.php`, que tiene otra URL, y luego logo) y lo restaura en `finally`;
  - `wpCli` sale ya a `tests/e2e/support/wp-cli.ts` (estaba previsto en la 2.6);
  - K17 (nueva): sin franjas, `RADPLAPAG_SCHEDULE` sale como `[]` y no como objeto (`SPEC.md` §3); el player lo acepta.

  `global-setup` ejecuta `wp core update-db` y vuelve a fijar la contraseña de `admin`. Las dos puntas comparten la base de datos. Al subir a 7.1, el admin pide «Database Update Required». Al bajar a 6.6, el hash `$wp$` de WP 6.8+ no lo entiende `phpass` y el login falla («Cookies are blocked due to unexpected output», por el *Deprecated* de `crypt()`). Con el cambio, el ciclo latest → min pasa a la primera en las dos. Antes de completar el arreglo hubo un fallo del login en la primera ejecución que no se volvió a reproducir. Mutación: quitar `JSON_HEX_APOS` y cambiar el orden de `og:type` y `og:site_name` → fallan los dos snapshots y el test de escapes; revertida.
- [x] hecha · commit: 77719c8

### 2.6 Casos no interceptados y `wp_die` (≤ 1 h)
- Qué: en `clean-page.spec.ts`, comprobar que el borrador (con sesión de admin), la página con contraseña, la página sin emisora y la entrada que no es página **sirven el tema**: hay `wp_head`, no hay `#root` y no hay `RADPLAPAG_CONFIG`. Para la ruta `wp_die`, añadir las dos variantes del plugin por `mappings` en `.wp-env.tests.json` (ver Contexto), con `tests/fixtures/player-dist/no-manifest/` (vacío con `.gitkeep`) y `tests/fixtures/player-dist/no-main-entry/manifest.json`. El test cambia el plugin activo con WP-CLI, comprueba el estado HTTP y el mensaje de `wp_die`, y restaura el plugin en `finally`. Se mide si la integración ve las variantes (no deberían cargarse: no están activas).
- Archivos: `tests/e2e/clean-page.spec.ts`, `.wp-env.tests.json`, `tests/fixtures/player-dist/**`, `tests/e2e/support/wp-cli.ts` (sale del `wpCli` de `global-setup`).
- Test: caracterización. Mutación: cambiar el texto del `wp_die` → falla.
- Verificación: `npm run env:start:latest && npm run test:e2e -- clean-page.spec.ts --project=chromium && npm run test:php:integration`
- Si el montaje anidado no funciona en una punta: parar y preguntar.
- Nota: el montaje anidado funciona en las dos puntas (WP 6.6.10 + PHP 7.4.33 y WP 7.1.3 + PHP 8.4), en `cli` y en `wordpress`. Las variantes salen en `wp plugin list` como inactivas; la integración no las ve (la carga el *bootstrap* desde la ruta del repo, y `HooksTest`, que exige los callbacks exactos, sigue en verde: 347 tests en las dos). El borrador se pide con la sesión de admin (`storageState`) y el título sale en el tema. «Sirve el tema» = hay `<meta name="generator" content="WordPress…">` (`wp_head`), sin `id="root"` ni `RADPLAPAG_CONFIG`. Los dos `wp_die()` responden 500 con el mensaje en `<div class="wp-die-message">`, igual en las dos puntas. `no-main-entry/manifest.json` tiene otra entrada (`src/other.tsx`), no un JSON vacío. `wpCli` ya estaba en `tests/e2e/support/wp-cli.ts` (2.5). Sin rarezas nuevas. Mutaciones (fallan y se revierten): otro texto en el `wp_die` del manifiesto sin entrada (1 test) y quitar la condición de estado y contraseña (borrador y contraseña, 2 tests).
- [x] hecha · commit: 75c5959

### 2.7 Escenario 1: MP3, pausa y corte (C7, C8) (≤ 1 h)
- Qué: `tests/e2e/mp3.spec.ts`, con un helper `tests/e2e/support/player.ts` que pulsa Play y espera `playing` + `currentTime > 1` (eventos, no timeouts fijos). Casos:
  - MP3 finito (`E2E MP3`) e infinito (`E2E Live`) reproducen;
  - C7: con `Live`, Pausa y luego Play. Se fija si hay una petición nueva al servidor y si `currentTime` sigue desde el buffer. Si se confirma, `currently`;
  - C8: con `E2E Cut`, el stream se corta. Se fija que no hay petición nueva (sin reconexión) y el estado que muestra la UI.
- Archivos: `tests/e2e/mp3.spec.ts`, `tests/e2e/support/player.ts`, `docs/known-issues.md` (C7, C8).
- Test: caracterización. Mutación: el helper espera `currentTime > 1000` → falla por timeout (y se revierte).
- Verificación: `npm run test:e2e -- mp3.spec.ts`
- Nota: el helper exporta `startPlayback`, `waitForPlayback` (evento `playing` + `timeupdate`), `waitForAudioEvent`, `audioState` y el contador del origen con CORS (`mediaRequests`, `resetMediaRequests`). Comprobar que algo **no** pasa necesita una ventana fija (`QUIET_MS`, 3 s). Medido en WP 7.1.3 + PHP 8.4 (el lado del navegador no depende de la punta):
  - C7 confirmado en Chromium: sin petición nueva, la posición sigue desde la pausa;
  - **K18 (nueva, alta):** en WebKit, Pausa + Play del directo se congela (buffer vacío, sin petición, sin error, la UI muestra Pausa). Reproducido en todas las ejecuciones, con pausas de 0,3 y 3 s. Sin comprobar en Safari: queda en «Verificación manual pendiente»;
  - C8 confirmado: el player no recarga. Chromium reintenta solo desde su motor de medios con `Range: bytes=32768-` (el servidor no atiende `Range` en `/cut.mp3`, como un directo) y muestra el spinner; WebKit no reintenta, sigue en Pausa y lanza `stalled` antes de agotar el buffer. En ninguno hay error ni aviso.

  WebKit hace dos peticiones al empezar (`bytes=0-1` y otra sin `Range`); por eso C7 y K18 comparan el contador antes y después, no con 1. El login de `global-setup` volvió a fallar una vez (timeout en `waitForURL`, como en la 2.5) y pasó al reintentar. Mutación: el helper espera `currentTime > 1000` → timeout; revertida.
- [x] hecha · commit: 2c56f87

### 2.8 Escenario 2: HLS y DASH (≤ 1 h)
- Qué: `tests/e2e/hls-dash.spec.ts`. HLS y DASH reproducen. Se fija qué camino usa cada navegador: `audio.src` empieza por `blob:` (MSE: `hls.js`/`dashjs`) o es la URL (nativo). En WebKit de escritorio se espera `hls.js`; lo medido se apunta en la nota (riesgo 8). Los chunks de `hls.js`/`dashjs` solo se piden cuando el protocolo los necesita (con MP3, ninguno).
- Archivos: `tests/e2e/hls-dash.spec.ts`.
- Test: caracterización. Mutación: esperar el chunk de `dashjs` con HLS → falla.
- Verificación: `npm run test:e2e -- hls-dash.spec.ts`
- Nota: medido en WP 7.1.3 + PHP 8.4 (el lado del navegador no depende de la punta). Riesgo 8: ningún navegador usa HLS nativo; el WebKit de escritorio no es iOS para el player y va por `hls.js`, como Chromium. DASH va por `dashjs` en los dos. Lo que cambia es cómo se engancha `hls.js`: en WebKit hay `ManagedMediaSource` y `hls.js` mete el `blob:` en un `<source>` hijo, así que `audio.src` queda **vacío** y el `blob:` solo está en `currentSrc`. Por eso el test lee `src`, `currentSrc` y los `<source>`, no solo `audio.src` (cuenta para la 2.10: el `crossOrigin` de la ruta MSE se mira en el elemento, no en `src`). `dashjs` en WebKit sí asigna el `blob:` a `audio.src`. Chunks: con HLS solo `-hls.min.js`, con DASH solo `-dash-all-min.min.js`, con MP3 ninguno. Sin rarezas nuevas. Mutación: esperar el chunk de `dashjs` con HLS → falla en los dos navegadores; revertida.
- [x] hecha · commit: bf93788

### 2.9 Escenario 3: bienvenida (≤ 1 h)
- Qué: `tests/e2e/intro.spec.ts`. Con `E2E Intro`:
  - suena primero la intro (`audio.src` termina en `intro.mp3`) y después el directo;
  - la intro suena una sola vez (tras Pausa + Play no vuelve);
  - el botón de pausa no actúa (o no está) mientras suena.

  Con `E2E Broken Intro` pasa al directo sin mensaje de error.
- Archivos: `tests/e2e/intro.spec.ts`.
- Test: caracterización. Mutación: esperar la intro dos veces → falla.
- Verificación: `npm run test:e2e -- intro.spec.ts`
- Nota: medido en WP 7.1.3 + PHP 8.4 (el lado del navegador no depende de la punta). Igual en Chromium y WebKit, sin rarezas nuevas. La intro es un adjunto subido al sitio (`:8890/wp-content/uploads/…/intro.mp3`), no del servidor de medios. Mientras suena, el botón muestra Pausa **deshabilitado** (`introLocked`); al acabar pasa a `live.mp3` y se habilita. El test anota `loadstart` y `ended` con `audio.src` en fase de captura en `window`, porque el `ended` del player cambia `src` al directo antes que un listener en el elemento; secuencia: intro carga, intro termina, directo carga, y Pausa + Play no añade nada. Tras Pausa + Play espera el evento `play`, no la reproducción (en WebKit el directo se congela, K18). Con la intro rota (404) la secuencia es `broken-intro` → `live` y un `MutationObserver` confirma que no aparece ningún `role="alert"` en ningún momento. Mutación: esperar la intro dos veces → falla en los dos navegadores; revertida. `--repeat-each 3` en verde.
- [x] hecha · commit: 9a75736

### 2.10 Escenario 4: `crossOrigin`, C1 y K1 (≤ 1 h)
- Qué: `tests/e2e/cross-origin.spec.ts`:
  - `audio.crossOrigin === 'anonymous'` con MP3 e intro (y con HLS nativo si algún navegador lo usa), y `null` con `hls.js`/`dashjs` (ADR 0004);
  - sin CORS, C1 `currently`: MP3 y HLS no avanzan;
  - K1 `currently`: en Chromium, MP3 sin CORS da `audio.error.code === 4` sin mostrar «Unable to play the stream»; en WebKit sí se muestra; con HLS sin CORS, en los dos.

  Se espera al evento `error` o al mensaje, no a un timeout.
- Archivos: `tests/e2e/cross-origin.spec.ts`, `docs/known-issues.md` (C1, K1).
- Test: caracterización. Mutación: quitar `crossOrigin` en el directo de `use-audio-player.tsx` y reconstruir → falla; revertir y reconstruir (`dist/` idéntico).
- Verificación: `npm run test:e2e -- cross-origin.spec.ts`
- Nota: medido en WP 7.1.3 + PHP 8.4 (el lado del navegador no depende de la punta). `crossOrigin` es `'anonymous'` con el MP3, con la intro y con el directo que la sigue, y `null` con `hls.js` y `dashjs`, en los dos navegadores. Ninguno usa HLS nativo (ver 2.8), así que esa rama solo la cubren los tests unitarios del player. Sin CORS, la petición llega al servidor (lo cuenta `/__requests` del origen sin CORS, para lo que `mediaRequests()` y `resetMediaRequests()` aceptan ahora el origen) y lo que falla es CORS. MP3: `error` con código 4, `currentTime` 0 y buffer vacío. En Chromium llega `pause` justo después de `error`, y el `onPause` del player cambia el estado `error` por `paused`. Esa es la causa de K1: no hay aviso y queda el botón Play (un `MutationObserver` confirma que el aviso no aparece en ningún momento). En WebKit no llega `pause` (el elemento sigue con `paused` falso), el estado se queda en `error` y sale el aviso. HLS: `hls.js` pide la playlist, CORS la bloquea, `hls.js` da un error fatal, el elemento no recibe ningún `error` y sale el aviso en los dos navegadores; no se pide ningún segmento. Se espera al evento `error` (MP3) o al aviso (HLS). Mutación: quitar `crossOrigin` en el directo MP3 y reconstruir → fallan el MP3 directo y el MP3 sin CORS (suena y no llega el `error`) en los dos navegadores. El test de la intro sigue en verde porque `crossOrigin` se queda puesto desde la intro. Revertida y reconstruida, `dist/` idéntico. `--repeat-each 3` en verde. El login del global-setup superó dos veces el tiempo de espera (`waitForURL`) y pasó al reintentar.
- [x] hecha · commit: 6fe0e32

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
- Nota: `stationInstant()` pasa día y hora de la emisora a un instante UTC de una semana de referencia (lunes 2024-01-01). Casos: vector 2 (A), vector 5 (B con «(Rerun)»), vector 7 (C de ayer), jueves 12:00 sin programa ni «Next», vector 13 (`currently`: C, C16) y vector 3 («Next: B (Rerun) (in 10 minutes) 10:00-14:00»). Informativo: lunes 09:50 con el MP3 sonando, `clock.fastForward('10:00')` → se muestra B y desaparece «Next»; `paused`, `src` y `/__requests` no cambian. Con la mutación del plan (offset 5) solo fallaba el vector 3, porque el resto de horas cae en mitad de su franja y media hora no cambia el programa. Por eso el test fija `timezoneId: 'UTC'` en el navegador, para que se vea el reloj de la emisora (`TimezoneClock`, que solo aparece si la zona del navegador es distinta), y `openAt()` comprueba que marca la hora pedida con «+5.5». Con eso la mutación hace fallar los 14 tests (7 por navegador). Revertida. `--repeat-each 3` en verde.
- [x] hecha · commit: `6ea31e1`

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
