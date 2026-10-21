# Spec 0006 · Fase 2 — Audio
Estado: cerrada (2026-10-21) · Inicio: 2026-10-21 · ADRs: 0004, 0013, 0017, 0018, 0021, 0029, 0030

## Contexto (medido al planificar)

- **El hook:** `hooks/use-audio-player.tsx` (364 líneas) guarda el estado en `useState` (`status`, `loading`, `volume`, `introLocked`) y en cinco refs (`statusRef`, `activeSourceRef`, `introConsumedRef`, `hlsRef`, `dashRef`). La única pieza que lo usa es `dashboard/index.tsx:86`, que desestructura `{ audioRef, status, loading, introLocked, play, pause, volume, handleVolumeChange }`. La firma y ese valor devuelto no cambian.
- **Caracterización:** `use-audio-player.test.tsx` tiene 46 casos, con `vi.mock('hls.js')` y `vi.mock('dashjs')`. Como `vi.mock` actúa sobre el módulo entero, también intercepta los `import()` cuando pasen al núcleo, así que el archivo no se edita salvo el `Harness` (D5). Fija los `currently` de K11, K12, K63 (×4), K64, K70 y C2 (×4). C7 y K18 se fijan en `mp3.spec.ts`, y C1 y K1 en `cross-origin.spec.ts`.
- **Lo que no fija hoy ningún test:** el montaje en `StrictMode` (los efectos se montan, se desmontan y se vuelven a montar en desarrollo, `main.tsx`) y que `audioRef` sea la misma referencia en cada render (los visualizadores dependen de ello, zona congelada). Se caracteriza en la 2.1.
- **`isIOS`:** `useIsIOS()` da `false` en el primer render y `true` después del efecto (D4, K13). El controlador lo recibe en cada `play()` y en cada cambio de volumen, nunca al crearse (§4.3).
- **Comparación al reanudar:** el hook compara `audio.src === streamUrl && status !== 'error'`, con el `status` del render, y `onCanPlay` usa `statusRef`. En el controlador las dos leen su propio estado, que se actualiza sin esperar al render. Ningún test distingue las dos fuentes.
- **Cómo se llega a la concurrencia:** mientras `loading` es verdadero, `PlayerControls` cambia los botones por el *spinner*. Desde la interfaz no se pueden mandar dos `play()` seguidos ni pausar durante la carga. Sí se puede con los manejadores de Media Session (`play`/`pause`) y con la pausa del temporizador de sueño.
  - **Sospecha 1** (dos `play()` con HLS): las dos llamadas pasan la comprobación `activeSourceRef === null` en el mismo tick y esperan a `loadHls()` después de `destroyPlayers()`. Por lectura, quedan dos `Hls` vivos.
  - **Sospecha 2** (`pause()` durante la carga de un MP3): el navegador rechaza la promesa de `play()` con `AbortError`, el `catch` pone `error` y aparece «Unable to play».
- **Decisión del usuario (2026-10-21), sospecha 2:** si se confirma, se queda como `currently` (en Vitest y en e2e) en una fila nueva, K81, y la corrección es de la 0007. Evitarla cambiaría algo visible (§0.3, §0.6). **Sospecha 1:** si se confirma, se evita aplicando D7, porque una sola instancia de `Hls` es justo lo que deja una única llamada a `play()`. Pasa a K80, «corregido (spec 0006)», con su test de regresión.
- **e2e de la sospecha 2:** Playwright no tiene acceso a la pantalla de bloqueo. Un `addInitScript` envuelve `navigator.mediaSession.setActionHandler` y guarda los manejadores en `window`; así el test llama al `pause` del sistema. `page.route` retrasa la respuesta de `/live.mp3`, que se sirve en local, para que la pausa caiga mientras carga.
- **Bundle:** la línea base es la tabla de la 1.9/1.10, medida frente a `origin/trunk` con el `gzip -9` de macOS. Hay que vigilar que `hls` y `dash` sigan siendo `isDynamicEntry` en `manifest.json` cuando sus `import()` pasen a `core/audio/sources/` (riesgo 2).

## Objetivo

Sacar la lógica del audio de `use-audio-player.tsx` y llevarla a `player/src/core/audio/` con TDD. Ahí van la detección del protocolo, las fuentes `direct`, `hls` y `dash`, una función de transición pura y un controlador que ejecuta los efectos y publica una instantánea. `useAudioPlayer()` queda como adaptador del controlador (con `useState` + `subscribe()` desde la 2.11, ADR 0030), con la misma firma y el mismo valor devuelto. El `Harness` del test pierde sus dos excepciones (D5), K70 queda corregido y las dos sospechas de §4.5 quedan respondidas.

## Criterios de aceptación

| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A1 Comportamiento sin cambios | `npm --prefix player run check`. `npm run test:e2e` en `env:start:min` y en `env:start:latest`, con `mp3`, `hls-dash`, `intro`, `cross-origin` y `visualizers` en verde. `git diff origin/trunk -- player/src/**/*.test.* tests/e2e` solo muestra: altas, el `Harness` (D5), el `currently` de K70 que pasa a regresión y el de K80 si se confirma |
| A2 Frontera del núcleo | El bloque de `src/core/**` de `eslint.config.js` cubre `core/audio/**` sin excepciones. `grep -rn "eslint-disable" player/src/core` vacío |
| A3 Cobertura | `npm --prefix player run test:coverage`: `src/core/**` ≥ 90 % de líneas y ≥ 85 % de ramas; `src/hooks/**` ≥ 85 % de líneas |
| A4 (parcial) | `grep -n "eslint-disable" player/src/hooks/use-audio-player.test.tsx player/src/hooks/use-audio-player.tsx` vacío |
| A5 Assets y bundle | `npm run check:zip`. En `manifest.json`, `hls.mjs` y `dash.all.min.js` siguen con `isDynamicEntry: true`. Tabla del gzip frente a `origin/trunk` en el «Resultado:» de la 2.12; si un archivo crece más de un 10 %, se pregunta |
| A6 Zona congelada | `git diff origin/trunk -- player/src/components/visualizers player/src/config/visualizers.ts player/src/types/visualizers.tsx player/src/hooks/use-audio-visualizer.tsx player/src/hooks/use-can-visualize.tsx` vacío |
| A7 (K70) | El `currently` de K70 pasa a regresión: en rojo antes del arreglo, verde después. La fila K70 pasa a «corregido (spec 0006)» |
| A8 Sospechas | Un test del hook (2.2) y uno del núcleo (2.10) por cada sospecha, más el e2e de la sospecha 2 en `mp3.spec.ts` (Chromium y WebKit). Filas K80 y K81 en `known-issues.md` con su estado y su decisión |

## Tareas

### 2.1 Caracterización de lo que falta en la zona del audio (≤ 1 h)
- Qué: casos nuevos en `use-audio-player.test.tsx`, solo altas: un `describe('lifecycle (spec 0006, 2.1)')` contra el hook de hoy.
  - Montado en `<StrictMode>`: un MP3 hace un solo `load()` y un solo `play()`, `playing`/`pause` cambian el estado una sola vez y, al desmontar, `hls.js` se destruye una sola vez.
  - `audioRef` es la misma referencia en cada render.
  - El volumen cambiado sigue aplicado al `<audio>` después de otro render.
  - Fuera del hook, se revisa la lista de §4.4 (`intro`, `cross-origin`, `hls-dash`, `visualizers`). Si falta algo, se añade aquí con el mismo commit.
- Archivos: `player/src/hooks/use-audio-player.test.tsx`, `tests/e2e/mp3.spec.ts` (el *slider* de volumen, por la revisión de §4.4).
- Test: caracterización. Cada caso se ve fallar con una mutación temporal del hook (por ejemplo, quitar el `removeEventListener` o crear el ref en cada render) que se revierte.
- Verificación: `npm --prefix player run check`
- Resultado: 8 casos en `describe('lifecycle (spec 0006, 2.1)')`, con un `mountStrict()` local (el `Harness` no cambia). En `StrictMode`: un MP3 hace un `load()` y un `play()` y la pausa da `paused`; `playing`/`pause` del `<audio>` dan su estado; con bienvenida, un `ended` carga el directo una sola vez (un único manejador tras montar, desmontar y volver a montar); `hls.js` se crea, se engancha y se destruye una sola vez al desmontar; el volumen cambiado se aplica. Sin `StrictMode`: `audioRef` es la misma referencia tras `play()`, `pause()`, un cambio de volumen y un cambio de `streamUrl`, y el volumen sigue en el `<audio>` y en el estado tras otro render y tras `play()`. Mutaciones (revertidas): sin `removeEventListener('ended')` → 3 `load()` en vez de 2; `audioRef` como objeto nuevo en cada render → 6 casos en rojo (el de `audioRef` en `StrictMode` se reforzó: sin comprobar el `load()`, el `play()` memoizado salía antes con un ref sin enganchar y el caso pasaba); el efecto con `audio.volume = 1` → 2; sin `destroyPlayers()` al desmontar → 1. Fuera del hook (§4.4): `intro`, `cross-origin`, `hls-dash` y `visualizers` cubren la zona, pero ningún test movía el *slider* de volumen en un navegador. Nuevo en `mp3.spec.ts`: `applies the volume slider to the audio element, before and after Play` (Chromium y WebKit, en verde). Mutación: el `onChange` del *slider* reenvía el volumen actual → rojo en los dos (`aria-valuenow` 1); `dist/` reconstruido y restaurado idéntico. Sin rarezas nuevas. `npm run check` en verde.
- [x] hecha · commit: `339795e`

### 2.2 Las dos sospechas de §4.5 contra el hook de hoy (≤ 1 h)
- Qué:
  - `media.fail(name = 'NotSupportedError')` en `src/test/fake-audio.ts`, para poder rechazar con `AbortError`. Los usos de hoy no cambian.
  - Sospecha 1, en Vitest: dos `play()` en el mismo tick con HLS. Se cuentan las instancias de `Hls` creadas, las destruidas y las enganchadas al `<audio>`.
  - Sospecha 2, en Vitest: con `media.hold`, `play()`, después `pause()` y después `media.fail('AbortError')`. Se lee el estado y `loading`.
  - Sospecha 2, en e2e (`mp3.spec.ts`, Chromium y WebKit): un `addInitScript` captura los manejadores de Media Session, `page.route` retrasa `/live.mp3`, se pulsa Play y se llama al `pause` capturado. Se mira si sale «Unable to play».
  - Cada caso confirmado se nombra `it('currently …')`. Si una sospecha no se reproduce, su test fija el comportamiento correcto y la fila dice «no se reproduce».
  - Filas nuevas: K80 (sospecha 1) y K81 (sospecha 2), con su gravedad. K81 lleva la decisión «corregir: 0007 reproducción (decisión del usuario, 2026-10-21)». K80 dice «se evita en la 0006 (D7), tarea 2.10».
- Archivos: `player/src/test/fake-audio.ts`, `player/src/hooks/use-audio-player.test.tsx`, `tests/e2e/mp3.spec.ts` (y `tests/e2e/support/player.ts` si hace falta un *helper*), `docs/known-issues.md`.
- Test: caracterización. Se ven fallar con una mutación temporal: en la sospecha 1, un guardia de «ya cargando» en el hook; en la sospecha 2, que el `catch` ignore `AbortError`. Las dos se revierten.
- Verificación: `npm --prefix player run check && npx playwright test tests/e2e/mp3.spec.ts`
- Resultado: las dos sospechas se confirman. `media.fail(name)` rechaza con el nombre dado (`NotSupportedError` por defecto). **K80:** el segundo `play()` no puede lanzarse en el mismo tick: con Vitest 5.0.5, mientras hay un `import()` de un módulo con `vi.mock` en vuelo, el siguiente resuelve al módulo real (con `hls.js` real, `isSupported()` da `false` en happy-dom y el segundo va por el nativo). Se reproduce la misma ventana de forma determinista: el `isSupported()` del *fake* lanza el segundo `play()` cuando el primero ya tiene `hls.js` y aún no ha creado su instancia. Hay dos `Hls`, los dos enganchados al `<audio>`, y al desmontar solo se destruye el segundo. La 2.10 no tiene el problema (cargador inyectado). **K81:** en Vitest, `pause()` y después `AbortError` dejan `error` y `loading` falso. En el e2e, Chromium y WebKit rechazan el `play()` pendiente con `AbortError` y sale «Unable to play the stream. Try again later.» con el botón Play. El `addInitScript` envuelve `MediaSession.prototype.setActionHandler`, no la instancia: WebKit ignora una propiedad propia en `navigator.mediaSession`. Mutaciones (revertidas): un guardia de «ya cargando» en `playLiveStream()` → K80 en rojo (y `reloads the stream on play() after an error`, porque el guardia no se limpiaba al fallar); el `catch` ignorando `AbortError` → K81 en rojo en Vitest y en el e2e de los dos navegadores (`dist/` reconstruido y restaurado idéntico). Filas K80 (baja; se evita en la 2.10) y K81 (media; 0007). `npm run check` en verde.
- [x] hecha · commit: `97c6a37`

### 2.3 `core/audio/protocol` y la fuente `direct` (≤ 1 h)
- Qué:
  - `detectProtocol(url): 'hls' | 'dash' | 'direct'` con `endsWith('.m3u8' / '.mpd')`. Conserva C2 con `it('currently …')` en los cuatro casos de hoy, y la fila C2 apunta también a este test.
  - `sources/direct.ts`: `src`, después `crossOrigin = 'anonymous'`, después `load()` y después `await play()`. Mismo orden que hoy. `destroy()` no hace nada.
  - Interfaz común `AudioSource` (`start(audio, url, callbacks): Promise<void>`, `destroy()`), con `onError` y `onPlayRejected` como *callbacks*.
- Archivos: `player/src/core/audio/protocol.ts`, `protocol.test.ts`, `player/src/core/audio/sources/types.ts`, `direct.ts`, `direct.test.ts`.
- Test: primero (TDD), en rojo porque los módulos no existen. Usan `installFakeAudio()` de `src/test/fake-audio.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: `detectProtocol()` con 5 casos normales y los 4 `currently` de C2, y la fila C2 apunta también a `protocol.test.ts`. `createDirectSource()` con 4 casos: el orden `src` → `crossOrigin` → `load()` → `play()` (registrado con *setters* propios en la instancia), que `start()` espera a `play()`, que un rechazo se propaga sin pasar por los *callbacks* y que `destroy()` no toca el `<audio>`. Los tests usan `new Audio()`, porque `document` está vetado en `src/core/**`. Rojo primero (módulos inexistentes). Mutaciones (revertidas): `crossOrigin` antes de `src` → 1 en rojo; `void audio.play()` en vez de `await` → 2; `.mpd` sin distinguir mayúsculas ni *query* → 2. `npm run check` en verde.
- [x] hecha · commit: `ee58964`

### 2.4 Fuentes `hls` y `dash` con cargadores inyectados (≤ 1 h)
- Qué:
  - `sources/hls.ts`: `createHlsSource({ loadHls = defaultLoadHls, isIOS })`. Si `isIOS`, va por `direct`. Si no, `isSupported()` decide entre `new Hls({ preferManagedMediaSource: true })` + `loadSource` + `attachMedia` y la reserva nativa por `direct`. `MANIFEST_PARSED` llama a `play()`, y si rechaza se avisa con `onPlayRejected`. `ERROR` con `fatal` avisa con `onError`. `destroy()` llama a `hls.destroy()`.
  - `sources/dash.ts`: `MediaPlayer().create()` + `initialize(audio, url, true)`, y `on('error')` avisa con `onError`. `destroy()` llama a `reset()`.
  - El `crossOrigin` se deja como hoy: K70 se corrige en la 2.9.
  - Los `import('hls.js')` e `import('dashjs')` por defecto viven en estos módulos.
  - Los *fakes* de `Hls` y `MediaPlayer` van en `src/test/fake-streaming.ts`, sin `vi.mock`.
  - Se mira `manifest.json` tras un build de prueba (riesgo 2). Todavía no lo importa nada, así que `dist/` no cambia.
- Archivos: `player/src/core/audio/sources/hls.ts`, `hls.test.ts`, `dash.ts`, `dash.test.ts`, `player/src/test/fake-streaming.ts`.
- Test: primero (TDD): `hls.test.ts` y `dash.test.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: `createHlsSource()` con 11 casos y `createDashSource()` con 5. Los cargadores por defecto se exportan (`loadHlsModule()`, `loadDashModule()`) y un caso de cada uno comprueba que resuelven al módulo real, sin crear nada (DASH real saldría a la red). Los tipos de las librerías (`HlsClass`, `HlsInstance`, `DashMediaPlayer`, `DashPlayer`) van en `sources/types.ts` con sintaxis de método: los parámetros de un método son bivariantes, y así el `on()` genérico de `hls.js` y `dashjs` es asignable sin `as`. K70 queda fijado en las dos fuentes con `it('currently …')`, y la fila K70 apunta también a ellos. `fake-streaming.ts` da `createFakeHls()` y `createFakeDash()` por test, sin estado global ni `vi.mock`. Rojo primero (módulos inexistentes). Mutaciones (revertidas), cada una con 1 caso en rojo: sin `data.fatal`; el rechazo de `play()` tragado; `preferManagedMediaSource: false`; iOS ignorado; sin `hls = null` tras `destroy()`; DASH sin *autoplay*; sin `player = null` tras `reset()`. Build de prueba a una carpeta temporal: `hls.mjs` y `dash.all.min.js` siguen con `isDynamicEntry: true` y el resultado es idéntico a `dist/`. `npm run check` en verde.
- [x] hecha · commit: `96e9cbe`

### 2.5 `core/audio/player-machine`: la transición pura (≤ 1 h)
- Qué:
  - `transition(state, event): state`. El estado es `{ status, loading, introLocked, activeSource: null | 'intro' | 'live', introConsumed, volume }`.
  - Los eventos que llegan del controlador: `load-start`/`load-end`, `intro-started`, `live-started`, `play-failed`, `resumed`, `user-paused`, los del `<audio>` (`playing`, `pause`, `error`, `canplay`, `waiting`), `stream-error` y `volume-changed`.
  - Devuelve la misma referencia si nada cambia, para que `getSnapshot()` sea estable.
  - Los `currently` replicados: K1 (`pause` después de `error` deja `paused`), K63 (el bloqueo sigue tras un fallo, una pausa externa o un `error` en la bienvenida), K64 (`canplay` en `paused` no limpia `loading`) y K11 (`live-started` con HLS antes del manifiesto deja `playing`). La fila de cada uno apunta también al test nuevo.
- Archivos: `player/src/core/audio/player-machine.ts`, `player-machine.test.ts`, `docs/known-issues.md` (columna «Test» de K1, K11, K63 y K64).
- Test: primero (TDD): `player-machine.test.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: `transition()` e `initialPlayerState` con 32 casos (16 de la transición normal, 7 de «misma referencia» y 9 `currently`: K1, K11 ×2, K63 ×4 con los mismos nombres que en el hook, y K64). Un *helper* `patch()` devuelve el mismo objeto si ningún campo cambia. Se añade un evento a la lista del plan, `intro-finished`, que marca `introConsumed` (lo que hoy hace `advanceToLive()` antes de cargar el directo); `ended` no es un evento de la máquina, porque solo dispara el paso al directo en el controlador. Como en el hook, `user-paused` no hace nada en la bienvenida, y `play-failed`, `stream-error` y `error` dan `error`. Rojo primero (módulo inexistente). Mutaciones (revertidas): `canplay` limpia siempre → K64 en rojo; `pause` respeta `error` → K1 en rojo; `live-started` sin `playing` → los dos K11 en rojo; `error` libera el bloqueo → tres K63 en rojo; `patch()` sin comparar → los 7 de misma referencia en rojo. Las filas K1, K11, K63 y K64 apuntan también a `player-machine.test.ts`.
- [x] hecha · commit: `6135601`

### 2.6 `core/audio/audio-controller`: directo, eventos y volumen (≤ 1 h)
- Qué:
  - `createAudioController({ loaders })` → `{ subscribe, getSnapshot, attach(audio, { isIOS }), detach(), dispose(), play({ streamUrl, introUrl, isIOS }), pause(), setVolume(v, { isIOS }) }`.
  - `attach` y `detach` son idempotentes. Al engancharse se aplica el volumen, salvo en iOS, y se escuchan los siete eventos de hoy. `dispose()` destruye la fuente.
  - Primer `play()` sin bienvenida, reanudación sin recargar (`audio.src === streamUrl` y estado distinto de `error`), recarga tras un error y tras un cambio de `streamUrl`, y la fuente anterior destruida en el siguiente `play()`.
  - `isIOS` se lee en cada llamada, nunca al crear el controlador.
  - Un test engancha dos veces seguidas (StrictMode, riesgo 1).
- Archivos: `player/src/core/audio/audio-controller.ts`, `audio-controller.test.ts`.
- Test: primero (TDD): `audio-controller.test.ts`, con `installFakeAudio()` y `fake-streaming.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: `createAudioController()` con 26 casos (instantánea y suscripción, `attach`/`detach`, directo, fuentes y volumen). La elección de la fuente por protocolo ya está aquí (`detectProtocol()` + las fuentes de la 2.4), porque «la fuente anterior destruida en el siguiente `play()`» y `dispose()` solo se observan con `hls`/`dash`: se prueban con los *fakes* (HLS → MP3 destruye el `Hls`; `dispose()` resetea DASH una vez). Lo que hacen HLS y DASH al reproducir, sus errores y sus `currently` (K11, K12) siguen en la 2.7, y `introUrl` se acepta pero aún no se usa. Los siete *listeners* del hook son seis tipos de evento: los dos de `playing` son un único evento de la máquina; `ended` se escucha y de momento no hace nada (bienvenida, 2.7). Un único manejador compartido: el DOM no duplica el mismo *listener*, y `attach()` hace `detach()` del elemento anterior. La reanudación compara `audio.src === streamUrl` con el estado del controlador, no con el del render. Rojo primero (módulo inexistente). Mutaciones (revertidas): `attach()` sin `detach()` → 1 en rojo (mover a otro elemento); un manejador nuevo en cada `attach()` → 4 (los dos de `StrictMode`, *detach* y mover); volumen aplicado en iOS al enganchar → 1; reanudar ignorando `error` → 1; sin destruir la fuente anterior → 1; `setVolume()` sin mirar iOS → 1. Cobertura del archivo: 96,6 % de líneas (sin cubrir, los *callbacks* de error de HLS/DASH, que son de la 2.7). `npm --prefix player run check` en verde.
- [x] hecha · commit: `1cb42bf`

### 2.7 `audio-controller`: bienvenida, HLS/DASH y `currently` (≤ 1 h)
- Qué:
  - La bienvenida: `src` + `crossOrigin` + `play()`. `ended` pasa al directo. Si falla, pasa al directo sin aviso. No se puede pausar y `play()` no hace nada mientras suena. Suena una sola vez por controlador.
  - HLS y DASH a través de las fuentes de la 2.4.
  - Los `currently` del controlador: K11 (`playing` antes de `MANIFEST_PARSED`, y una pausa durante la carga no cuenta), K12 (reanudar recrea `Hls`), K63 (los cuatro casos), K64 y K70 (de momento `anonymous`). La fila de cada uno apunta también al test nuevo.
- Archivos: `player/src/core/audio/audio-controller.ts`, `audio-controller.test.ts`, `docs/known-issues.md`.
- Test: primero (TDD), ampliando `audio-controller.test.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: 27 casos nuevos en `audio-controller.test.ts` (53 en total): HLS (6), DASH (2), bienvenida (12) y los siete `currently` (K11 ×2 contando el de HLS, K12, K63 ×4, K64, K70). Rojo primero: los 11 de la bienvenida y de K63/K70; los de HLS/DASH ya pasaban porque la 2.6 conectó las fuentes, y se validan con mutaciones. Cuando acaba la bienvenida, el directo se carga con las opciones del `play()` que la arrancó (el hook usaba las del último render; con una URL por emisora no cambian). Mutaciones (revertidas): sin `stream-error` → 2 en rojo; `onPlayRejected` vacío → 1; `ended` sin mirar la fuente activa → 1 (tras reforzar `ignores ended on the live stream` con bienvenida); `play()` sin el retorno de la bienvenida → 3; el fallo de la bienvenida sin pasar al directo → 1; sin `resumed` → 1 (con un caso nuevo que no deja llegar `playing`); sin `intro-finished` → 2. Cobertura del archivo: 100 % de líneas y ramas, 90 % de funciones (los dos *callbacks* vacíos de la bienvenida, que la fuente directa nunca llama). `npm --prefix player run check` en verde.
- [x] hecha · commit: `f777fa8`

### 2.8 `useAudioPlayer()` como adaptador y el `Harness` sin excepciones (≤ 1 h)
- Qué:
  - El hook crea el controlador una vez por montaje (`useState(() => createAudioController())`) y lo lee con `useSyncExternalStore`.
  - Un `useEffect([controller, isIOS])` hace `attach(audioRef.current, { isIOS })` y, al limpiar, `detach()`. Otro, al desmontar, llama a `dispose()`.
  - `play`, `pause` y `handleVolumeChange` son `useCallback` que pasan `streamUrl`, `introUrl` e `isIOS` del render. Sin `useState` ni refs de estado.
  - `Harness` (D5): el resultado se expone por un *callback* o un efecto, sin mutar props, y sin las dos líneas `eslint-disable`. No cambia ninguna aserción.
  - Si un test de caracterización falla por el orden de los renders, se arregla el adaptador. Si no se puede conservar, se para y se pregunta (riesgo 1).
  - Se regenera `dist/` y se mira `manifest.json`.
- Archivos: `player/src/hooks/use-audio-player.tsx`, `player/src/hooks/use-audio-player.test.tsx` (solo el `Harness`), `player/dist/`.
- Test: caracterización: `use-audio-player.test.tsx` (46 casos de hoy + los de la 2.1 y la 2.2) sin cambios en las aserciones.
- Verificación: `npm --prefix player run check && npm --prefix player run build && ! grep -n "eslint-disable" player/src/hooks/use-audio-player.test.tsx`
- Resultado: el hook queda en 79 líneas (364 antes): `useState(() => createAudioController())`, `useSyncExternalStore`, un efecto `attach`/`detach` por `[controller, isIOS]`, otro con `dispose()` al desmontar y tres `useCallback`; sin `useState` de estado ni refs salvo `audioRef`. Los 56 casos de `use-audio-player.test.tsx` pasan a la primera, sin tocar aserciones. `Harness`: el resultado sale por un `onResult` llamado en un efecto tras cada render (`expose(api)` en `mount` y `mountStrict`), y `audioRef` se desestructura como en `dashboard/index.tsx`, lo que quita el falso positivo de `react-hooks/refs`; sin `eslint-disable`. `manifest.json`: solo cambia el orden de `dynamicImports` del entry; `hls` y `dash` siguen `isDynamicEntry`. Gzip del entry (`gzip -9`): 186 407 B en `origin/trunk`, 186 554 antes, 187 008 después (+0,3 % frente a `trunk`). Verificación en verde.
- [x] hecha · commit: `8868b97`

### 2.9 K70: las rutas MSE dejan `crossOrigin` en `null` (≤ 1 h)
- Qué: con `fix-bug`. El `currently keeps crossOrigin anonymous on the hls.js path after the welcome audio (K70)` del hook y su réplica del controlador pasan a regresión: `crossOrigin` es `null`. Se añade el caso DASH, que hoy solo está «por lectura». Los tres en rojo primero. Arreglo mínimo: `sources/hls.ts` (rama `hls.js`) y `sources/dash.ts` hacen `audio.crossOrigin = null` antes de engancharse (ADR 0004). Fila K70 → «corregido (spec 0006)». Se mira que `cross-origin.spec.ts` (`leaves crossOrigin unset on the MSE path`) siga en verde.
- Archivos: `player/src/core/audio/sources/hls.ts`, `dash.ts`, sus tests, `audio-controller.test.ts`, `player/src/hooks/use-audio-player.test.tsx` (el `currently` de K70), `docs/known-issues.md`, `player/dist/`.
- Test: regresión en rojo primero.
- Verificación: `npm --prefix player run check && npm --prefix player run build && npx playwright test tests/e2e/cross-origin.spec.ts tests/e2e/intro.spec.ts`
- Resultado: seis casos de regresión, los seis en rojo primero con `expected 'anonymous' to be null`: los dos `currently` de las fuentes (`hls.test.ts`, `dash.test.ts`), el del hook y su réplica del controlador (HLS tras la bienvenida), y el caso DASH tras la bienvenida, nuevo en el hook y en el controlador. En el controlador los dos salen del bloque `currently` y pasan a `welcome audio (intro)`. Desviación del plan: el arreglo es `audio.removeAttribute('crossorigin')`, no `audio.crossOrigin = null`. En un navegador es lo mismo (`crossOrigin` es un atributo reflejado anulable y asignarle `null` lo quita), pero happy-dom guarda la cadena `"null"`, un valor inválido que se lee como `'anonymous'`, y el test no podría pasar. Mutaciones (revertidas): sin la línea en `hls.ts` → 3 en rojo; sin ella en `dash.ts` → 3 en rojo. `npm --prefix player run check` y el build en verde. E2E (Chromium + WebKit): `leaves crossOrigin unset on the MSE path` en verde; 16 pasan y 2 fallan en Chromium (`currently does not play an MP3 without CORS, with no error shown in Chromium (C1, K1)` y `falls through to the live stream without an error when the welcome audio is broken`): sale la alerta «Unable to play the stream». Fallan igual con el `dist/` de HEAD (2.8) y pasan con el de la 2.7 (`f777fa8`): es una regresión de la 2.8, no de esta tarea (rutas MP3 directas). Hipótesis: con `useSyncExternalStore` el estado intermedio `error` llega a pintarse antes del `pause` de K1, y el *snackbar* lo ve; con `useState` se juntaban en un render. Pendiente de decisión del usuario.
- [x] hecha · commit: `c72ffd6`

### 2.10 Las sospechas en el núcleo (D7) (≤ 1 h)
- Qué:
  - Sospecha 1, en el test del controlador: un cargador diferido que se resuelve después del segundo `play()`. Se cuentan las `Hls` vivas y las enganchadas.
    - Si se confirmó en la 2.2: con `fix-bug`, el `currently` del hook pasa a regresión (una instancia viva, la misma que dejaría una única llamada) y el controlador serializa: un `play()` en curso devuelve la misma promesa al segundo. Si el resultado visible no coincide con el de una única llamada, se para y se pregunta (D7). K80 → «corregido (spec 0006)».
    - Si no se confirmó, el test fija lo correcto.
  - Sospecha 2: el `currently` replicado en el controlador (`play()` rechaza con `AbortError` después de `pause()`, y queda `error`). K81 apunta también a él y queda para la 0007.
- Archivos: `player/src/core/audio/audio-controller.ts`, `audio-controller.test.ts`, `player/src/hooks/use-audio-player.test.tsx` (solo el `currently` de K80, si pasa a regresión), `docs/known-issues.md`, `player/dist/`.
- Test: primero (TDD) en el núcleo y regresión en rojo en el hook.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- Resultado: K80 se corrige con `fix-bug`. En `audio-controller.test.ts`, `describe('concurrency (spec 0006, 2.10)')` con 3 casos: `keeps a single hls.js alive after a second play() while it loads (K80)` (cargador diferido que se resuelve tras el segundo `play()`: la misma promesa, un `loadHls()`, una `Hls` enganchada una vez, `playing` y un `destroy()` al `dispose()`); `starts a new play() once the previous one has settled` (la serialización no toca K12: tras pausar, el siguiente `play()` recrea `hls.js`); y el `currently` de K81 replicado (`pause()` y después `AbortError` dejan `error` y `loading` falso). Rojo primero: `expected "vi.fn()" to be called 1 times, but got 2 times` (dos `loadHls()`). En el hook, el `currently` de K80 pasa a regresión con el mismo nombre sin `currently` (una instancia, enganchada una vez, `playing`, un `destroy()` al desmontar); con el controlador de la 2.9 da `expected [ FakeHls, FakeHls ] to have a length of 1 but got 2`. Arreglo: `play()` guarda la promesa en curso (`pendingPlay`) y la devuelve hasta que se resuelve; el cuerpo de antes pasa a `startPlay()` sin cambios. Sin `??=` (`build.target` ES2020). El resultado visible es el de una única llamada (D7); K11, K12 y K81 siguen igual. La serialización vale para cualquier protocolo y conserva las opciones de la primera llamada (el caso del MP3 se añade en la 2.13). Filas K80 → «corregido (spec 0006)» y K81 apunta también al test del núcleo. `npm run check` en verde y `dist/` reconstruido. E2E de la zona (`hls-dash`, `mp3`, `intro`, Chromium y WebKit): 25 en verde y 1 en rojo, el de `intro.spec.ts` de la regresión de la 2.8 (Bloqueos), que ya fallaba antes. Sin nota de changelog: K80 no se veía (la `Hls` sobrante solo duplicaba la carga).
- [x] hecha · commit: `ca67aca`

### 2.11 Regresión de la 2.8: el orden de los renders del audio (ADR 0030) (≤ 1 h)
- Origen: tarea nueva, decidida por el usuario el 2026-10-21 tras la 2.10. En la 2.9 se midió que, desde la 2.8, en Chromium fallan dos e2e: `cross-origin.spec.ts` (`currently does not play an MP3 without CORS, with no error shown in Chromium (C1, K1)`) e `intro.spec.ts` (`falls through to the live stream without an error when the welcome audio is broken`).
- Qué:
  - Una sonda temporal en Chromium mide el orden de `error`, el rechazo de `play()`, `pause` y la alerta frente a microtareas y tareas.
  - El ADR 0030 enmienda D2 para `useAudioPlayer()`. La rule `player.md` y la spec (D2 y riesgo 1) lo nombran.
  - Un test de regresión en el hook: un `error` (con el rechazo de `play()`) seguido de un `pause` tras las microtareas no llega a pintar `error`. Rojo con `useSyncExternalStore`, verde con el hook de la 2.7 (`f777fa8`).
  - El arreglo: `useState(controller.getSnapshot)` y un `useEffect` con `controller.subscribe()`, con el `setState` en el *callback*.
- Archivos: `docs/adr/0030-audio-hook-keeps-react-render-priorities.md`, `docs/adr/0029-player-core-without-react.md` (línea de estado), `docs/adr/README.md`, `.claude/rules/player.md`, `docs/specs/0006-player-refactor/spec.md`, `player/src/hooks/use-audio-player.tsx`, `player/src/hooks/use-audio-player.test.tsx`, `player/dist/`.
- Test: regresión primero, en rojo.
- Verificación: `npm --prefix player run check && npm --prefix player run build && npx playwright test tests/e2e/cross-origin.spec.ts tests/e2e/intro.spec.ts`
- Resultado: la sonda (un `spec` temporal en `tests/e2e`, borrado) confirma la hipótesis de la 2.9. MP3 sin CORS en Chromium: `error`, el rechazo de `play()` (`NotSupportedError`) y la alerta en la misma tarea; `pause` en una tarea posterior, después incluso de un `setTimeout` lanzado tras `error`. Bienvenida rota: `error` y el rechazo en una tarea y el `loadstart` del directo en otra. Hasta la 2.7, el `setState` desde `error` tenía prioridad *default* (tarea del *scheduler*) y se agrupaba con el `pause`; `useSyncExternalStore` lo pinta en la microtarea siguiente. Variantes probadas y revertidas: `useSyncExternalStore` con el aviso aplazado a un `MessageChannel` → los dos e2e en verde, pero 16 casos de caracterización del hook en rojo; `useState` + `subscribe()` → todo en verde. Esta última queda en el ADR 0030, en un commit propio. Test nuevo en `use-audio-player.test.tsx`, `describe('render order (spec 0006, 2.11)')`: `does not render the error of a failing MP3 before the pause that follows it (K1)`, fuera de `act()` (`IS_REACT_ACT_ENVIRONMENT = false` en el caso), con las microtareas en lugar del fin de la tarea. Rojo primero: `expected [ 'idle', 'error', 'error', 'paused' ] to not include 'error'`; en verde con el hook de `f777fa8` (2.7). Arreglo: `useState(controller.getSnapshot)` y `useEffect(() => controller.subscribe(() => setSnapshot(controller.getSnapshot())), [controller])`; sin `eslint-disable`. 137 casos de hooks y componentes en verde y ninguna aserción tocada. `npm run check` en verde y `dist/` reconstruido. E2E de la zona (`cross-origin`, `intro`, `mp3`, `hls-dash`, `visualizers`; Chromium y WebKit): 50 en verde, con los dos de la regresión. Por el camino, al restaurar `dist/` tras las variantes, un `rm -rf` borró sus archivos (el hook protegía el directorio); se restauraron con `git checkout -- player/dist`.
- [x] hecha · commit: `cd34a41` + `05f49b1`

### 2.12 Verificación de la fase (≤ 1 h)
- Qué:
  - `npm run check`.
  - `npm run test:e2e` en `env:start:min` y en `env:start:latest`.
  - A2 (`grep` de `eslint-disable` en `src/core`), A4 parcial y A6 (`git diff` de la zona congelada).
  - `manifest.json` (`isDynamicEntry` de `hls` y `dash`).
  - Tabla del gzip frente a `origin/trunk`, con el `gzip -9` de macOS.
  - Sin commit si no cambia nada; se anota en el cierre.
- Archivos: —
- Test: —
- Verificación: `npm run check && npm run check:zip && npm run test:e2e`
- Resultado: `npm run check` en verde (PHPUnit unit 430, Vitest de la raíz 245, Vitest del player 472; `check:zip`: 62 archivos, la lista de `v3.4.2` más las altas declaradas). E2E en las dos puntas: `env:start:min` (WP 6.6 + PHP 7.4) 203 pasan · 25 omitidos (8,6 min); `env:start:latest` 203 pasan · 25 omitidos (9,2 min). Los omitidos son los `test.skip` condicionales de siempre (p. ej., los casos HTTP de `clean-page.spec.ts` solo en Chromium); `mp3`, `hls-dash`, `intro`, `cross-origin` y `visualizers`, en verde en Chromium y WebKit. A1: el `git diff origin/trunk` de los tests solo muestra altas, el `Harness` (D5), el `currently` de K70 que pasa a regresión y el `isSupported()` del *fake* de `hls.js` para K80 (2.2), que es la preparación del caso de K80 que A1 admite («el de K80 si se confirma») y no toca ninguna aserción; el resto (`utils/timezone.test.ts`) es de la fase 1 (K9 y `import.meta.env.DEV`). A2 y A4: el `grep` de `eslint-disable` está vacío. A3: `src/core/**` 100 % de líneas y 100 % de ramas; `src/hooks/**` 100 % de líneas y 88,9 % de ramas. A6: el `git diff origin/trunk` de la zona congelada está vacío. A5: en `manifest.json`, `hls.mjs` y `dash.all.min.js` siguen con `isDynamicEntry: true`. El build no cambia nada, así que no hay commit. Gzip (bytes, `/usr/bin/gzip -9`, Apple gzip 487.0.1, frente a `origin/trunk` con la misma herramienta): solo cambia el `.min.js`, de 604 804 → 606 126 B y 186 438 → 187 091 B en gzip (+653 B, +0,35 %, por debajo del 10 %). Las cifras de `trunk` no coinciden con las de la 1.9 (p. ej., 186 407 → 186 438 B), aunque es el mismo binario: la salida de esta máquina ha cambiado desde entonces, así que solo se compara dentro de una misma medición.

  | Archivo (`radio-player-page-3.4.2…`) | Tamaño | gzip -9 | Δ gzip frente a `trunk` |
  |---|---:|---:|---:|
  | `.min.js` | 606 126 | 187 091 | +653 |
  | `.css` | 1 316 | 675 | 0 |
  | `-hls.min.js` | 583 903 | 178 596 | 0 |
  | `-dash-all-min.min.js` | 824 688 | 236 288 | 0 |
  | `-amplitude-waterfall-visualizer.min.js` | 1 228 | 699 | 0 |
  | `-bar-visualizer.min.js` | 2 179 | 1 076 | 0 |
  | `-oscilloscope-visualizer.min.js` | 713 | 484 | 0 |
  | `-particles-visualizer.min.js` | 1 890 | 969 | 0 |
- [x] hecha · commit: — (sin cambios en el código; se anota en el cierre, `chore(0006): close phase 2`)

### 2.13 Hallazgos de la revisión del cierre (≤ 1 h)
- Origen: `spec-conformance-reviewer` en `close-phase`.
- Qué:
  - C7 replicado en el núcleo como `currently` (§4.3 lo pide y el plan lo dejaba solo en `mp3.spec.ts`): el caso que ya lo fijaba en `audio-controller.test.ts` se renombra, y la fila C7 apunta a él.
  - Un caso del controlador para dos `play()` de un MP3 mientras el primero está pendiente (la serialización de la 2.10 no es solo de HLS).
- Archivos: `player/src/core/audio/audio-controller.test.ts`, `docs/known-issues.md`.
- Test: el caso del MP3 se ve en rojo con una mutación temporal (sin `pendingPlay`: `expected Promise{…} to be Promise{…}`) y se revierte.
- Verificación: `npm --prefix player run check`
- Resultado: `currently resumes the loaded live stream from the buffer after a pause (C7)` (antes `pauses and resumes the loaded source without reloading it`, sin cambiar sus aserciones) y `loads the MP3 once after a second play() while the first is pending` (la misma promesa, un `load()`, un `play()` del elemento, el `src` de la primera llamada y `playing`). Sin cambios en el código ni en `dist/`.
- [x] hecha · commit: `d9ab43e`

### 2.14 El e2e del volumen en el WebKit de la CI (≤ 1 h)
- Origen: la CI del PR tras el cierre (run `39618952678`). Es la primera vez que corre el e2e de la 2.1 (el último push era anterior a la fase). En las dos puntas, en WebKit y con sus reintentos, falla `mp3.spec.ts` (`applies the volume slider to the audio element, before and after Play`): `Expected: 0.01`, `Received: 0.009999999776482582`, tras Play.
- Qué: medir si es el refactor o el navegador, y ajustar la aserción. Edición de un test de caracterización aprobada por el usuario (2026-10-21).
- Archivos: `tests/e2e/mp3.spec.ts`.
- Test: el caso en el WebKit de Linux, el de la CI (imagen `mcr.microsoft.com/playwright:v1.64.1-noble` contra el entorno de tests).
- Verificación: el caso en el WebKit de Linux, y `npx playwright test tests/e2e/mp3.spec.ts -g "volume slider"` en macOS.
- Resultado: es el navegador. En el WebKit de Linux falla igual con el `player/dist` de `origin/trunk` (el hook de la 3.4.2), y también con el de `HEAD`. WebKitGTK lee el volumen de GStreamer como `float32` en cuanto suena. En macOS no se ve, porque WebKit no lo redondea. La aserción tras Play pasa a `toBeCloseTo(0.01, 5)`, con su motivo en un comentario. La de antes de Play y el `aria-valuenow` no cambian. Verde en el WebKit de Linux y en macOS (Chromium y WebKit).
- [x] hecha · commit: `0a12849`

## Decisiones abiertas → ADR

- Ninguna nueva: D1–D7 están en el ADR 0029. La sospecha 2 queda como `currently` para la 0007 (decisión del usuario, 2026-10-21, §0.3). Va en «Desviaciones» de `docs/status.md` solo si el resultado medido obliga a otra cosa.
- Si evitar la sospecha 1 cambia algo visible, se para y se pregunta (D7) antes de la 2.10.

## Cierre

- Revisores (lista aprobada por el usuario, 2026-10-21): `spec-conformance-reviewer` y `backcompat-reviewer`. Sin `wp-security-reviewer` ni `wporg-reviewer` (la fase no toca la parte WordPress) ni `a11y-reviewer` (no toca componentes ni markup).
- `spec-conformance-reviewer`: sin bloqueantes. Corregido: C7 en el núcleo y el `play()` doble de un MP3 (2.13); los commits del plan; la §5 de la spec (2.4, `useState` + `subscribe()`); la cuenta del ADR 0030 (137); el test de K1 del hook en su fila; la nota de A1 sobre el *fake* de `hls.js` (2.12). La numeración del plan frente a la §5, en «Desviaciones».
- `backcompat-reviewer`: nada roto (globales, nombres de *assets* y *chunks* dinámicos, firma y valor de `useAudioPlayer()`, orden de estados, `crossOrigin`). Tres diferencias inalcanzables, sin cambios: al terminar la bienvenida, el directo arranca con el `streamUrl`/`isIOS` de la llamada a `play()`, no con los del último render (solo difieren si cambian durante la bienvenida, y no cambian: la URL es fija por página e `isIOS` ya está resuelto antes del primer toque); la comparación al reanudar lee el estado del controlador (ya en el Contexto); `play` conserva su identidad entre renders, así que `useMediaSession` vuelve a registrar sus *handlers* menos veces.
- CI del PR: tras `chore(0006): close phase 2`, falló el e2e del volumen en WebKitGTK; se corrige en la 2.14 (el refactor no es la causa).
