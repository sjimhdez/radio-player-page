# Spec 0006 · Fase 2 — Audio
Estado: en curso · Inicio: 2026-10-21 · ADRs: 0004, 0013, 0017, 0018, 0021, 0029

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

Sacar la lógica del audio de `use-audio-player.tsx` y llevarla a `player/src/core/audio/` con TDD. Ahí van la detección del protocolo, las fuentes `direct`, `hls` y `dash`, una función de transición pura y un controlador que ejecuta los efectos y publica una instantánea. `useAudioPlayer()` queda como adaptador con `useSyncExternalStore`, con la misma firma y el mismo valor devuelto. El `Harness` del test pierde sus dos excepciones (D5), K70 queda corregido y las dos sospechas de §4.5 quedan respondidas.

## Criterios de aceptación

| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A1 Comportamiento sin cambios | `npm --prefix player run check`. `npm run test:e2e` en `env:start:min` y en `env:start:latest`, con `mp3`, `hls-dash`, `intro`, `cross-origin` y `visualizers` en verde. `git diff origin/trunk -- player/src/**/*.test.* tests/e2e` solo muestra: altas, el `Harness` (D5), el `currently` de K70 que pasa a regresión y el de K80 si se confirma |
| A2 Frontera del núcleo | El bloque de `src/core/**` de `eslint.config.js` cubre `core/audio/**` sin excepciones. `grep -rn "eslint-disable" player/src/core` vacío |
| A3 Cobertura | `npm --prefix player run test:coverage`: `src/core/**` ≥ 90 % de líneas y ≥ 85 % de ramas; `src/hooks/**` ≥ 85 % de líneas |
| A4 (parcial) | `grep -n "eslint-disable" player/src/hooks/use-audio-player.test.tsx player/src/hooks/use-audio-player.tsx` vacío |
| A5 Assets y bundle | `npm run check:zip`. En `manifest.json`, `hls.mjs` y `dash.all.min.js` siguen con `isDynamicEntry: true`. Tabla del gzip frente a `origin/trunk` en el «Resultado:» de la 2.11; si un archivo crece más de un 10 %, se pregunta |
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
- Archivos: `player/src/hooks/use-audio-player.test.tsx`.
- Test: caracterización. Cada caso se ve fallar con una mutación temporal del hook (por ejemplo, quitar el `removeEventListener` o crear el ref en cada render) que se revierte.
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

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
- [ ] hecha · commit: —

### 2.3 `core/audio/protocol` y la fuente `direct` (≤ 1 h)
- Qué:
  - `detectProtocol(url): 'hls' | 'dash' | 'direct'` con `endsWith('.m3u8' / '.mpd')`. Conserva C2 con `it('currently …')` en los cuatro casos de hoy, y la fila C2 apunta también a este test.
  - `sources/direct.ts`: `src`, después `crossOrigin = 'anonymous'`, después `load()` y después `await play()`. Mismo orden que hoy. `destroy()` no hace nada.
  - Interfaz común `AudioSource` (`start(audio, url, callbacks): Promise<void>`, `destroy()`), con `onError` y `onPlayRejected` como *callbacks*.
- Archivos: `player/src/core/audio/protocol.ts`, `protocol.test.ts`, `player/src/core/audio/sources/types.ts`, `direct.ts`, `direct.test.ts`.
- Test: primero (TDD), en rojo porque los módulos no existen. Usan `installFakeAudio()` de `src/test/fake-audio.ts`.
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

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
- [ ] hecha · commit: —

### 2.5 `core/audio/player-machine`: la transición pura (≤ 1 h)
- Qué:
  - `transition(state, event): state`. El estado es `{ status, loading, introLocked, activeSource: null | 'intro' | 'live', introConsumed, volume }`.
  - Los eventos que llegan del controlador: `load-start`/`load-end`, `intro-started`, `live-started`, `play-failed`, `resumed`, `user-paused`, los del `<audio>` (`playing`, `pause`, `error`, `canplay`, `waiting`), `stream-error` y `volume-changed`.
  - Devuelve la misma referencia si nada cambia, para que `getSnapshot()` sea estable.
  - Los `currently` replicados: K1 (`pause` después de `error` deja `paused`), K63 (el bloqueo sigue tras un fallo, una pausa externa o un `error` en la bienvenida), K64 (`canplay` en `paused` no limpia `loading`) y K11 (`live-started` con HLS antes del manifiesto deja `playing`). La fila de cada uno apunta también al test nuevo.
- Archivos: `player/src/core/audio/player-machine.ts`, `player-machine.test.ts`, `docs/known-issues.md` (columna «Test» de K1, K11, K63 y K64).
- Test: primero (TDD): `player-machine.test.ts`.
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

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
- [ ] hecha · commit: —

### 2.7 `audio-controller`: bienvenida, HLS/DASH y `currently` (≤ 1 h)
- Qué:
  - La bienvenida: `src` + `crossOrigin` + `play()`. `ended` pasa al directo. Si falla, pasa al directo sin aviso. No se puede pausar y `play()` no hace nada mientras suena. Suena una sola vez por controlador.
  - HLS y DASH a través de las fuentes de la 2.4.
  - Los `currently` del controlador: K11 (`playing` antes de `MANIFEST_PARSED`, y una pausa durante la carga no cuenta), K12 (reanudar recrea `Hls`), K63 (los cuatro casos), K64 y K70 (de momento `anonymous`). La fila de cada uno apunta también al test nuevo.
- Archivos: `player/src/core/audio/audio-controller.ts`, `audio-controller.test.ts`, `docs/known-issues.md`.
- Test: primero (TDD), ampliando `audio-controller.test.ts`.
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

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
- [ ] hecha · commit: —

### 2.9 K70: las rutas MSE dejan `crossOrigin` en `null` (≤ 1 h)
- Qué: con `fix-bug`. El `currently keeps crossOrigin anonymous on the hls.js path after the welcome audio (K70)` del hook y su réplica del controlador pasan a regresión: `crossOrigin` es `null`. Se añade el caso DASH, que hoy solo está «por lectura». Los tres en rojo primero. Arreglo mínimo: `sources/hls.ts` (rama `hls.js`) y `sources/dash.ts` hacen `audio.crossOrigin = null` antes de engancharse (ADR 0004). Fila K70 → «corregido (spec 0006)». Se mira que `cross-origin.spec.ts` (`leaves crossOrigin unset on the MSE path`) siga en verde.
- Archivos: `player/src/core/audio/sources/hls.ts`, `dash.ts`, sus tests, `audio-controller.test.ts`, `player/src/hooks/use-audio-player.test.tsx` (el `currently` de K70), `docs/known-issues.md`, `player/dist/`.
- Test: regresión en rojo primero.
- Verificación: `npm --prefix player run check && npm --prefix player run build && npx playwright test tests/e2e/cross-origin.spec.ts tests/e2e/intro.spec.ts`
- [ ] hecha · commit: —

### 2.10 Las sospechas en el núcleo (D7) (≤ 1 h)
- Qué:
  - Sospecha 1, en el test del controlador: un cargador diferido que se resuelve después del segundo `play()`. Se cuentan las `Hls` vivas y las enganchadas.
    - Si se confirmó en la 2.2: con `fix-bug`, el `currently` del hook pasa a regresión (una instancia viva, la misma que dejaría una única llamada) y el controlador serializa: un `play()` en curso devuelve la misma promesa al segundo. Si el resultado visible no coincide con el de una única llamada, se para y se pregunta (D7). K80 → «corregido (spec 0006)».
    - Si no se confirmó, el test fija lo correcto.
  - Sospecha 2: el `currently` replicado en el controlador (`play()` rechaza con `AbortError` después de `pause()`, y queda `error`). K81 apunta también a él y queda para la 0007.
- Archivos: `player/src/core/audio/audio-controller.ts`, `audio-controller.test.ts`, `player/src/hooks/use-audio-player.test.tsx` (solo el `currently` de K80, si pasa a regresión), `docs/known-issues.md`, `player/dist/`.
- Test: primero (TDD) en el núcleo y regresión en rojo en el hook.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- [ ] hecha · commit: —

### 2.11 Verificación de la fase (≤ 1 h)
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
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- Ninguna nueva: D1–D7 están en el ADR 0029. La sospecha 2 queda como `currently` para la 0007 (decisión del usuario, 2026-10-21, §0.3). Va en «Desviaciones» de `docs/status.md` solo si el resultado medido obliga a otra cosa.
- Si evitar la sospecha 1 cambia algo visible, se para y se pregunta (D7) antes de la 2.10.
