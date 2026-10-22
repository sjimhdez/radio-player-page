# Spec 0007 · Fase 1 — Prioridad alta: K67, C7 (K18, K12) y C1 con la visualización
Estado: en curso · Inicio: 2026-10-22 · ADRs: 0004, 0013, 0018, 0029, 0030, 0031 (nuevos: 0032, 0033)

## Contexto
Lo leído al planificar, contrastado con la spec y el informe del spike. No hay nada falso que obligue a parar. La rama `spec/0007-playback-fixes` y el PR #41 en borrador ya existen; `trunk` no ha avanzado.
- **K67:** `core/audio/sources/dash.ts` hace `initialize(audio, url, true)` y pasa todo `error` a `onError()`. `DashPlayer` (`sources/types.ts`) y el *fake* (`src/test/fake-streaming.ts`) no tienen `clearDefaultUTCTimingSources()`. El `currently` solo está en el e2e (`hls-dash.spec.ts`, K67). Ese e2e convierte el MPD estático del *fixture* en dinámico y contesta a Akamai con `page.route`. La cabecera `Date` no está expuesta, así que con la corrección `dashjs` emitirá el error 16: es justo el caso que hay que cubrir.
- **C7/K12:** `audio-controller.ts`, rama `resume` (`element.src === streamUrl`). Hay `currently` en el núcleo (C7, K12), en el hook (K12) y en el e2e (C7). Además, el test normal del hook `pauses and resumes the loaded source without reloading it` fija C7 y caerá. Su fila (C7) está en la spec, así que pasa a regresión en el mismo commit y se añade a la fila C7.
- **K18:** `tests/e2e/media-server.mjs`, `sendLive()`, repite `tone.mp3` entero, con su ID3 y su marco `Info`.
- **C1:** `direct.ts` asigna `src` y después `crossOrigin`, llama a `load()` y espera a `play()`. En los dos navegadores `play()` se rechaza con `NotSupportedError` cuando falta CORS (spike 0.3). El *fake* de audio rechaza por URL (`media.failing`), pero no por `crossOrigin`. El e2e `currently does not play an MP3 without CORS… (C1, K1)` también es la prueba de K1 en el MP3: K1 (fase 2) necesita otro `currently` que siga fallando con el reintento (un 404).
- **Visualización:** `use-can-visualize.tsx` decide al montar con el *user agent* (WebKit sin Chrome y sin mismo origen; con `src` vacío, en WebKit siempre da `false`). `use-audio-visualizer.tsx` crea el `AudioContext` en un efecto al pasar a `playing` y llama a `createMediaElementSource()` siempre que haya `canvasRef` (el `Dashboard` lo pasa siempre y solo oculta el canvas con `opacity`). Consumidores: `components/dashboard/index.tsx` y `StreamInfo.tsx` (`canVisualize`). `dashboard/index.test.tsx` simula los dos hooks. Los dos hooks no tienen tests y siguen fuera de la cobertura (`vitest.config.ts`).
- **Frontera del núcleo:** ESLint prohíbe `window` y `navigator` en `src/core/**`. El *user agent* y el constructor de `AudioContext` entran inyectados desde `useAudioPlayer()`.
- La rule `player.md` dice «nada de decidirlo por el *user agent*». La excepción medida de WebKit (aprobada en el spike, punto 12) la contradice: el ADR 0033 la recoge y la rule cambia en el mismo commit.
- Seed e2e: hay `nocors-mp3`, `nocors-hls`, `nocors-dash` e `intro`, pero no hay una emisora sin CORS con bienvenida. Se añade `nocors-intro` en `tests/e2e/fixtures/seed-e2e.php`.

## Objetivo
Corregir K67, C7 (con K12 y el *fixture* de K18) y C1, y hacer que la decisión visualizador / animación estática la tome el núcleo según la fuente (ADR 0031 y la propuesta aprobada del spike, puntos 1–14). Cada fila sale con su test de regresión en las dos capas y con sus ADRs y `SPEC.md` §3.8–3.9 al día.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A1 (K67) | `dash.test.ts`: `clearDefaultUTCTimingSources()` después de `initialize()`; el error 16 no llega a `onError()` y los demás sí. `hls-dash.spec.ts`: el directo DASH suena, no se pide nada a `time.akamai.com` (la ruta sigue interceptada para detectarlo) y no sale ninguna alerta |
| A2 (C7, K18, K12) | `audio-controller.test.ts` y `use-audio-player.test.tsx`: Play tras una pausa recarga el directo en MP3, HLS y DASH. `mp3.spec.ts`: petición nueva a `/live.mp3` y posición de vuelta al directo (Chromium y WebKit). El test de K18 pasa a «does not freeze» (rojo con el *fixture* antiguo, verde con el nuevo) |
| A3 (C1) | `direct.test.ts` y `audio-controller.test.ts`: primero con `crossOrigin`; ante el rechazo de `play()` por un error del medio, un solo reintento sin el atributo; ninguno en MSE ni con el elemento ya unido al grafo (error). `cross-origin.spec.ts`: un MP3 sin CORS suena (Chromium y WebKit), también con bienvenida; HLS y DASH sin CORS muestran el error |
| A3b (ADR 0031) | Antes: `currently` de los dos hooks (fila K82). Después: `canVisualize` en la instantánea, con sus reglas y con el `AudioContext` creado en `play()`; e2e `visualization.spec.ts` (Chromium con CORS: visualizador; sin CORS: animación estática y suena; con bienvenida: animación estática; WebKit: animación estática). `visualizers.spec.ts` sin editar. Los hooks salen de la exclusión de cobertura y cumplen los mínimos |
| ADRs y contrato | ADR 0032 (C7 y la consecuencia de K67) y ADR 0033 (C1 y la regla de visualización; enmienda 0004, 0013 y 0031). `SPEC.md` §3.8 y §3.9, `CLAUDE.md` (invariante 5), rules `player.md` y `visualizers.md` |
| A15 | Anotado en `docs/status.md`: pasada en Safari con el player corregido al cerrar la fase (verificación manual) |
| Global | `npm run check` en verde en cada tarea. Al cerrar: e2e de `mp3`, `hls-dash`, `intro`, `media-session`, `sleep`, `cross-origin`, `visualizers` y `visualization` en las dos puntas (riesgo 4) |

## Tareas

### 1.1 K67: `dashjs` sin fuente de hora de terceros (≤ 1 h)
- Qué (`fix-bug`): `DashPlayer` gana `clearDefaultUTCTimingSources()`, y `on()` recibe el evento con `error.code`. `dash.ts` limpia las fuentes de hora **justo después** de `initialize()` y no pasa a `onError()` el error con código 16. El *fake* de `dashjs` añade el método y deja enviar el evento con su código. En el e2e, `currently asks time.akamai.com…` pasa a «plays a live DASH stream without UTCTiming and asks no third party for the time (K67)»: suena (`waitForPlayback`), sin alerta, y la lista de peticiones a Akamai queda vacía tras la reproducción. JSDoc de `dash.ts`; fila K67 → «corregido (spec 0007)».
- Si el MPD reescrito del e2e no suena como directo con el reloj local, se lleva a `media-server.mjs` el `/live.mpd` dinámico del spike (`spike/0007-playback/server.mjs`), y se anota en «Resultado».
- Archivos: `player/src/core/audio/sources/{dash.ts,types.ts,dash.test.ts}`, `player/src/test/fake-streaming.ts`, `tests/e2e/hls-dash.spec.ts`, `docs/known-issues.md`.
- Test: regresión primero (rojo): `dash.test.ts` (orden de las llamadas y error 16) y `hls-dash.spec.ts`.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/hls-dash.spec.ts`
- Resultado: rojo primero: `dash.test.ts` con 2 fallos (no se llama a `clearDefaultUTCTimingSources()`; el error 16 llega a `onError()`) y el e2e en Chromium y WebKit con tres peticiones a `https://time.akamai.com/?iso&ms`. Arreglo en `dash.ts` (constante `TIME_SYNC_FAILED = 16`, el código de `dashjs`); `DashPlayer` gana `clearDefaultUTCTimingSources()` y el evento `DashErrorEvent` (`error.code`, como `MediaPlayerErrorEvent` de `dashjs`). El MPD reescrito del e2e suena como directo con el reloj local en los dos navegadores: no hace falta el `/live.mpd` del spike. Fuera de la lista de archivos: el `vi.mock('dashjs')` de `hooks/use-audio-player.test.tsx` gana el método (si no, la fuente lanza), y los tests `sets error on a dashjs error` del controlador y del hook pasan un evento con código 17 (`FRAGMENT_LOADER_LOADING_FAILURE`); su aserción no cambia. Verde: player `check` (530 tests), `hls-dash.spec.ts` 8/8 y `npm run check`.
- Changelog: un directo DASH sin `<UTCTiming>` ya no pide la hora a `time.akamai.com`.
- [x] hecha · commit: 5d6677f

### 1.2 K18: el `/live.mp3` del e2e emite solo los marcos de audio (≤ 1 h)
- Qué (`fix-bug`, del *fixture*): primero, `currently freezes…` pasa a «does not freeze the live MP3 after Pause and Play in Safari's WebKit (K18)», en rojo con el *fixture* actual (solo macOS). Después, `sendLive()` quita el ID3 y el marco `Info` de `tone.mp3` y repite solo los marcos, como `spike/0007-playback/server.mjs`. Así queda en verde sin tocar el player. Comentario de cabecera de `media-server.mjs`. Fila K18 → «no es del player (*fixture*); corregido el *fixture* (spec 0007)».
- Archivos: `tests/e2e/media-server.mjs`, `tests/e2e/mp3.spec.ts`, `docs/known-issues.md`.
- Test: regresión primero (rojo con el *fixture* antiguo): `mp3.spec.ts`.
- Verificación: `npm run test:e2e -- tests/e2e/mp3.spec.ts tests/e2e/intro.spec.ts tests/e2e/media-session.spec.ts`
- Resultado: rojo primero en el WebKit de macOS: con el *fixture* antiguo, `waitForPlayback( paused + 1 )` agota los 30 s (la posición se para). El test nuevo espera a que la posición pase de la pausa + 1 s, deja `QUIET_MS` y comprueba que sigue avanzando (> pausa + 2 s), sin pausa, error ni alerta; ya no fija `buffered` ni el número de peticiones (eso es de C7, 1.3). Arreglo: `mp3Frames()` en `media-server.mjs`, como el del spike pero sin operadores de bits (`no-bitwise`); su salida es idéntica byte a byte a la del spike (64 365 bytes, empieza en `ff fb`). Verde: las tres suites, 26 pasan y 4 saltados por plataforma. El `skip` del test de C7 en el WebKit de macOS («freezes instead (K18)») queda obsoleto; lo quita la 1.3, como dice su plan.
- Changelog: nada (solo el *fixture* e2e).
- [x] hecha · commit: a1eb7ae

### 1.3 C7 y K12: Play tras una pausa vuelve al directo, y ADR 0032 (≤ 1 h)
- Qué (`fix-bug`): sale la rama `resume` de `startPlay()`. Si el directo está cargado y suena (`status === 'playing'` y el elemento no está en pausa), `play()` no hace nada. En cualquier otro caso (pausa, error o cambio de emisora) se llama a `playLive()`, que recarga. La bienvenida no cambia. Regresiones, en el mismo commit:
  - núcleo: `currently resumes… (C7)` → «reloads the live stream on play() after a pause (C7)», en MP3, HLS y DASH;
  - núcleo y hook: `currently recreates hls.js when resuming after a pause` → «recreates hls.js to return to the live edge (C7)»;
  - hook: `pauses and resumes the loaded source without reloading it` → «reloads the live stream on play() after a pause (C7)»;
  - e2e: `currently resumes the live MP3… (C7)` → «reloads the live MP3 after Pause and Play (C7)», con petición nueva y `currentTime` cerca de 0, en todos los navegadores (sin el `skip` de K18).
- ADR 0032 (`write-adr`): Play tras una pausa recarga el directo (C7, absorbe K12). Recoge también K67 sin cambio de contrato: cumple §2 y apunta la consecuencia medida del reloj del cliente (riesgo 3). `SPEC.md` §3.8 lo describe. Comentarios de `audio-controller.ts` y del encabezado de sus tests. Filas C7 y K12 → «corregido (spec 0007)».
- Archivos: `player/src/core/audio/audio-controller.ts` (+ test), `player/src/hooks/use-audio-player.test.tsx`, `tests/e2e/mp3.spec.ts`, `docs/adr/0032-*.md`, `docs/adr/README.md`, `SPEC.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo) en el núcleo, el hook y el e2e.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/mp3.spec.ts tests/e2e/hls-dash.spec.ts tests/e2e/media-session.spec.ts tests/e2e/sleep.spec.ts tests/e2e/intro.spec.ts`
- Resultado: rojo primero: el MP3 en el núcleo y el hook (`media.load` 1 vez, se esperaban 2) y el e2e en Chromium (1 petición a `/live.mp3`, se esperaban 2) y WebKit (2, se esperaban 3). HLS y DASH ya recargaban por K12 (el `blob:` no coincide con la URL): sus tests pasan a fijarlo como comportamiento buscado (más «recreates dashjs to return to the live edge after a pause (C7)», nuevo en el núcleo). Arreglo: fuera la rama `resume`; el controlador guarda `liveUrl` (la URL cargada) y `play()` no hace nada solo si ese directo suena (`activeSource === 'live'`, misma URL, `playing` y el elemento sin pausa). El WebKit de Playwright hace dos peticiones por carga: el e2e comprueba que hay peticiones nuevas, no una exacta, y que la posición vuelve por debajo de la de la pausa. Fuera de la lista de archivos (riesgo 4, consecuencia directa de C7 y cubierto por el ADR 0032): `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» fijaba la reanudación (un solo `loadstart live` y la espera a `play` por K18); ahora espera dos `loadstart live` y a `playing`. El comentario del test del controlador «starts a new play() once the previous one has settled» ya no cita K12. Verde: player `check` (531 tests) y las cinco suites e2e en Chromium y WebKit.
- Changelog: Play tras una pausa vuelve al directo, en todos los formatos (antes, con MP3/OGG seguía desde el buffer, por detrás del directo).
- [x] hecha · commit: 40ab3f8

### 1.4 Caracterización de `useCanVisualize()` y `useAudioVisualizer()` (≤ 1 h)
- Qué (`characterize`, sin tocar los hooks):
  - Nuevo *fake* `src/test/fake-web-audio.ts` (`AudioContext` con `state`, `resume()`, `createAnalyser()`, `createMediaElementSource()` y registro de llamadas).
  - `use-can-visualize.test.tsx`: `currently` decide al montar, con `src` vacío (WebKit → `false`; Chrome, Edge y Firefox → `true`) y no cambia al cargar la fuente.
  - `use-audio-visualizer.test.tsx`: `currently` crea el `AudioContext` en el efecto al pasar a `playing` (fuera del gesto); conecta `createMediaElementSource()` una sola vez aunque el canvas esté oculto (`canVisualize` falso); dibuja con el tipo de datos pedido y cancela el bucle al pausar.
  - e2e nuevo `tests/e2e/visualization.spec.ts`: `currently` muestra el canvas (`opacity` 1) en Chromium también durante la bienvenida, y en WebKit nunca, aunque haya CORS (animación estática visible).
  - Fila nueva **K82** en `known-issues.md` (la decisión por *user agent* al montar y el grafo conectado con el canvas oculto), con la decisión «corregir: 0007 (ADR 0031)». Mutación de comprobación en cada test nuevo. Los hooks siguen excluidos de la cobertura hasta la 1.8.
- Archivos: `player/src/test/fake-web-audio.ts`, `player/src/hooks/use-can-visualize.test.tsx`, `player/src/hooks/use-audio-visualizer.test.tsx`, `tests/e2e/visualization.spec.ts`, `docs/known-issues.md`.
- Test: caracterización.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/visualization.spec.ts`
- Resultado: 24 tests nuevos en los hooks (player `check`: 555) y 2 e2e (el de la bienvenida se salta en WebKit, que nunca visualiza). happy-dom no da contexto 2D: el test de `useAudioVisualizer()` espía `getContext()` y controla `requestAnimationFrame()`. El canvas oculto se fija en el hook con `opacity` 0: el hook no recibe `canVisualize` y el panel le pasa siempre su canvas. En el e2e, la animación estática se lee por la altura de su `Collapse`: plegado mide 0 px, pero sus puntos conservan caja y `visibility: visible`, y `toBeVisible()` no los distingue. Mutaciones (revertidas): efecto sin dependencias, sin la condición de mismo origen, `createMediaElementSource()` sin la guarda, `frequency` → `time`, `status !== 'playing'` → `=== 'idle'` y `fftSize` 512 fallan en Vitest; `canVisualize` falso en Chromium y verdadero en WebKit fallan en el e2e (con el player reconstruido; `dist/` vuelve a quedar igual). Quitar `Edg` de la expresión no cambia nada: el *user agent* de Edge lleva `Chrome`.
- [x] hecha · commit: 5e75c10

### 1.5 Grafo de Web Audio y excepción de WebKit en el núcleo (≤ 1 h)
- Qué (TDD, lógica nueva sin uso todavía): `core/audio/web-audio.ts` con:
  - `isWebKitBrowser(userAgent)`: WebKit sin Chrome, Chromium, Edge ni Opera, más todo navegador de iOS (`iPhone|iPad|iPod`, también CriOS, FxiOS y EdgiOS). Tabla de *user agents* en el test.
  - `createVisualizerGraph({ createContext?, userAgent })`: `supported` (hay constructor y no es WebKit); `prepare()`, síncrono (crea el contexto, o llama a `resume()` si está `suspended`; nada si no está soportado); `connect(audio)` (`createMediaElementSource()` una sola vez, analizador con `fftSize` 256, a `destination`); `isConnected()`; `getAnalyser()`.
- Archivos: `player/src/core/audio/web-audio.ts`, `player/src/core/audio/web-audio.test.ts`.
- Test: primero (TDD): `web-audio.test.ts`, con `fake-web-audio.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: 29 tests nuevos (player `check`: 584), rojo con el módulo sin crear. `isWebKitBrowser()` queda en `AppleWebKit` sin `Chrome` ni `Chromium`: la cláusula de iOS y los tokens `Edg`/`OPR` del plan son código muerto (las mutaciones sobrevivían). Ningún navegador de iOS lleva `Chrome` (CriOS, FxiOS y EdgiOS tampoco) y Edge y Opera de escritorio llevan `Chrome`; la tabla del test cubre los casos de iOS. Un contexto que no se puede crear o un `createMediaElementSource()` que lanza dejan el grafo sin conectar sin cortar la reproducción; un `resume()` rechazado se captura. `connect()` antes de `prepare()` no hace nada (nunca crea el contexto fuera del gesto). Mutaciones (revertidas): sin `Chromium`, sin `AppleWebKit`, `fftSize` 512, `connect()` sin la guarda, `resume()` nunca, sin el `catch` y sin el `return` tras crear fallan en Vitest.
- [x] hecha · commit: —

### 1.6 C1: un reintento sin `crossOrigin` en las fuentes directas, y ADR 0033 (≤ 1 h)
- Qué (`fix-bug`):
  - `createDirectSource({ retryWithoutCors })`: si `play()` se rechaza con un error del medio (`NotSupportedError`; nunca `NotAllowedError` ni `AbortError`), `removeAttribute('crossorigin')` + `load()` + `play()`, una sola vez. `AudioSource` gana `isCorsClean()` (directa: falso tras el reintento; `hls.js` y `dashjs`: verdadero; HLS nativo: lo que diga la directa).
  - El controlador lo permite si el elemento no está unido al grafo (`graph.isConnected()`); si lo está, error claro (D1). También vale para la bienvenida, que nunca se visualiza.
  - El *fake* de audio añade `media.corsBlocked` (rechaza mientras `crossOrigin === 'anonymous'`).
  - e2e: `currently does not play an MP3 without CORS… (C1, K1)` → «plays an MP3 without CORS by retrying without crossOrigin (C1)», en Chromium y WebKit, más el caso con bienvenida (seed nuevo `nocors-intro`). Los de HLS y DASH quitan el `currently` («does not play … without CORS and shows the error (C1)»).
  - K1 conserva su `currently` en el MP3 con un 404 (los dos intentos fallan): «currently shows no error for a broken MP3 in Chromium (K1)».
  - ADR 0033 (`write-adr`; enmienda 0004, 0013 y 0031): el reintento, la regla de `canVisualize` (spike, puntos 10–13), la excepción medida de WebKit por *user agent*, el `AudioContext` en `play()` y la bienvenida sin visualizar. Deja sin efecto la consecuencia del 0031 «en WebKit con CORS se verá el visualizador».
  - En el mismo commit: `SPEC.md` §3.8 (`crossOrigin`), `CLAUDE.md` (invariante 5: «en el primer intento»), rule `player.md` (Reproducción, y la excepción del *user agent*) y filas C1 y K1 al día.
- Archivos: `player/src/core/audio/sources/{direct.ts,types.ts,hls.ts,dash.ts}` (+ tests), `audio-controller.ts` (+ test), `player/src/test/fake-audio.ts`, `player/src/hooks/use-audio-player.test.tsx`, `tests/e2e/cross-origin.spec.ts`, `tests/e2e/fixtures/seed-e2e.php`, `docs/adr/0033-*.md`, `docs/adr/README.md`, `SPEC.md`, `CLAUDE.md`, `.claude/rules/player.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo): `direct.test.ts`, `audio-controller.test.ts`, `cross-origin.spec.ts`.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/cross-origin.spec.ts tests/e2e/intro.spec.ts tests/e2e/mp3.spec.ts`
- [ ] hecha · commit: —

### 1.7 `canVisualize` en la instantánea del controlador (≤ 1 h)
- Qué (TDD; corrige la parte del núcleo de K82):
  - `PlayerState.canVisualize` (inicial `false`), con eventos puros en `player-machine.ts`. Vuelve a `false` en cada intento. Pasa a `true` con el `playing` del elemento solo si se cumplen todas las condiciones: `graph.supported`, la fuente activa es `live` y `source.isCorsClean()`.
  - `createAudioController({ loaders, webAudio })` recibe `createContext` y `userAgent`. `play()` llama a `graph.prepare()` de forma síncrona, antes de `startPlay()` (dentro del gesto). `graph.connect(audio)` se llama la primera vez que `canVisualize` pasa a `true`. `getAnalyser()` va en la API.
  - `useAudioPlayer()` inyecta `window.AudioContext` (si existe) y `navigator.userAgent`, y devuelve `canVisualize` y `getAnalyser`.
  - Tests: la bienvenida nunca se visualiza; tras el reintento, `false`; WebKit nunca crea el contexto; contexto `suspended` → `resume()` en `play()`; nunca se crea fuera de `play()`; MSE y directa con CORS → `true`.
- Archivos: `player/src/core/audio/{player-machine.ts,audio-controller.ts}` (+ tests), `player/src/hooks/use-audio-player.tsx` (+ test).
- Test: primero (TDD).
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

### 1.8 Hooks rehechos y un solo valor en el `Dashboard` (≤ 1 h)
- Qué (`fix-bug` de K82, capa de hooks y e2e):
  - `useAudioVisualizer(getAnalyser, canvasRef, active, width, height, visualizerFn, dataType)` queda solo como bucle de dibujo: sin `AudioContext` ni conexión, `active = status === 'playing' && canVisualize`. `VisualizerFn` sigue en `hooks/use-audio-visualizer.tsx`, con la misma firma.
  - `use-can-visualize.tsx` se elimina. El `Dashboard` y `StreamInfo` usan el `canVisualize` de `useAudioPlayer()`.
  - Los `currently` de la 1.4 pasan a regresión: los de `use-can-visualize.test.tsx` se trasladan a `use-audio-player.test.tsx` (la decisión ya no es del hook), y en `visualization.spec.ts`, Chromium con CORS → visualizador, sin CORS → animación estática y el audio avanza, con bienvenida → animación estática, y WebKit → animación estática.
  - `dashboard/index.test.tsx` cambia las simulaciones de los hooks, no sus aserciones.
  - Los dos hooks salen de la exclusión de `vitest.config.ts` (y del comentario).
  - `SPEC.md` §3.9 (línea 184 y el contrato con el reproductor), rule `visualizers.md` y fila K82 → «corregido (spec 0007)».
- Archivos: `player/src/hooks/{use-audio-visualizer.tsx,use-can-visualize.tsx}` (+ tests), `player/src/components/dashboard/{index.tsx,index.test.tsx}`, `player/vitest.config.ts`, `tests/e2e/visualization.spec.ts`, `SPEC.md`, `.claude/rules/visualizers.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo) en los hooks y el e2e.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/visualization.spec.ts tests/e2e/visualizers.spec.ts tests/e2e/cross-origin.spec.ts`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- ADR 0032 (1.3): C7, y K67 sin cambio de contrato con la consecuencia del reloj del cliente.
- ADR 0033 (1.6): C1 y la regla de visualización (enmienda 0004, 0013 y 0031); `SPEC.md` §3.9 se aplica en la 1.8.
- La bienvenida también se reintenta sin `crossOrigin` (1.6): es una fuente directa y nunca se visualiza. Lo recoge el ADR 0033.

## Verificación de la fase
`npm run check` en cada tarea. Al cerrar (`close-phase`): e2e completos con `env:start:min` y `env:start:latest`, `npm run check:zip`, el *chunk* de `dashjs` en `player/dist/` (la URL de Akamai puede seguir en el código, pero no se usa) y la pasada de Safari (A15) anotada en `docs/status.md`.
