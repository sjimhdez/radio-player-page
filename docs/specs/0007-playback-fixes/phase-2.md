# Spec 0007 · Fase 2 — Prioridad media: estados del audio
Estado: en curso · Inicio: 2026-10-22 · ADRs: 0029, 0030, 0032, 0033 (nuevo: 0034)

## Contexto
Lo leído al planificar, contrastado con la spec, los ADR y el código. Nada es falso; hay dos decisiones nuevas del usuario (2026-10-22) que cambian la spec:
- **C2:** `core/audio/protocol.ts` usa `endsWith()` sobre la URL entera. Hay `currently` en el núcleo (`protocol.test.ts`) y en el hook (`use-audio-player.test.tsx`, «protocol detection (C2)»). En el núcleo no hay `window.location`: se analiza con `new URL(url, base ficticia)` para que una URL relativa (`/live.m3u8`) siga funcionando, y una que no se puede analizar da `direct`.
- **K1:** `transition()` pasa a `paused` con un `pause` en cualquier estado. Hay `currently` en la máquina, en el hook (el test de orden de renders del ADR 0030) y en el e2e (`cross-origin.spec.ts`, el MP3 con un 404). **Cae también** `mp3.spec.ts` «currently stops with a network error and no message when the stream is cut in WebKitGTK (C8)», fuera de las filas de la spec: el `pause` que sigue al `error` de red tapa hoy la alerta. **Decisión del usuario (2026-10-22):** se ajusta en el commit de K1. Sigue siendo el `currently` de C8 (no reconecta, `errorCode` 2), pero ahora con la alerta. Se apunta en la fila C8.
- **K11 (D4):** `live-started` pone `playing` y el `finally` de `startPlay()`/`advanceToLive()` despacha `load-end`, que limpia `loading` antes de `MANIFEST_PARSED` o del *autoplay* de `dashjs`. El *fake* de audio despacha `playing` dentro de `play()`, como el navegador (el evento sale antes de que se resuelva la promesa). Así, con una fuente directa el evento `playing` ya basta, y `live-started` puede dejar de tocar `status` en todos los protocolos.
- **K81 y K11 con pausa (D3):** `pause()` solo pausa el elemento. El `AbortError` del `play()` pendiente llega a `play-failed`, y `MANIFEST_PARSED` llama a `audio.play()` aunque se haya pausado. Los *fakes* de `hls.js`/`dashjs` no quitan los manejadores al destruirse: la fuente tiene que ignorar sus avisos tras `destroy()`. `pendingPlay` (K80, D7) seguiría devolviendo la promesa vieja al Play siguiente, así que la pausa tiene que soltarla (riesgo 5).
- **K64:** `user-paused` no limpia `loading`, y `canplay` solo lo limpia en `idle`/`error`.
- **K63 (D5):** `introLocked` y `activeSource: 'intro'` solo cambian con `live-started`. Ojo: al terminar, el navegador dispara `pause` antes de `ended` (con `audio.ended` verdadero). Una pausa externa se distingue por `!audio.ended`. Si no, el `ended` ya no pasaría al directo. **Decisión del usuario (2026-10-22), cambia D5:** si la bienvenida da `error` mientras suena, pasa al directo en silencio, como si terminara o fallara al arrancar (`SPEC.md` §3.8 tal como está). Solo la pausa externa deja Play, que carga el directo. El `error` que precede al rechazo del `play()` de arranque no puede lanzar un segundo `advanceToLive()`. D5 y A9 de la spec se corrigen en la 2.1, con el ADR.
- **ADR 0030 (A13):** el test de orden de renders de K1 deja de tener sentido cuando `pause` no pisa `error`. La vuelta a `useSyncExternalStore` se decide al final (2.7) con los tests del hook y los e2e de `cross-origin` e `intro` en Chromium.

## Objetivo
Corregir C2, K1, K64, K11, K81 y K63, cada fila con su regresión en las dos capas que cita `known-issues.md`. Revisar el ADR 0030 (A13) y dejar `SPEC.md` §3.8 y el ADR 0034 al día.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A4 (C2) | `protocol.test.ts` y `use-audio-player.test.tsx`: `.m3u8?token=x`, `.M3U8`, `.mpd?token=x`, `.MPD` y `…/live.m3u8#t` por el sufijo del `pathname`, sin distinguir mayúsculas. Una URL relativa sigue detectándose y una que no se puede analizar da `direct` sin lanzar |
| A5 (K1) | `player-machine.test.ts`: un `pause` en `error` no lo cambia. `use-audio-player.test.tsx`: el error de un MP3 roto se pinta y sigue tras el `pause`. `cross-origin.spec.ts`: el MP3 con un 404 muestra el error en Chromium y en WebKit. `mp3.spec.ts` (C8, WebKitGTK) ajustado con la alerta |
| A6 (K11) | `player-machine.test.ts`, `audio-controller.test.ts` y `use-audio-player.test.tsx`: con HLS y DASH, `loading` en `true` y sin `playing` hasta el evento `playing`. Una pausa durante la carga se respeta: sin `play()` en `MANIFEST_PARSED` y `reset()` de `dashjs` |
| A7 (K81) | `audio-controller.test.ts`, `use-audio-player.test.tsx` y `mp3.spec.ts` (Chromium y WebKit): pausar mientras carga el MP3 deja `paused`, sin error ni alerta |
| A8 (K64) | `player-machine.test.ts`, `audio-controller.test.ts` y `use-audio-player.test.tsx`: `pause()` durante el *buffering* limpia `loading` |
| A9 (K63) | Los cuatro `currently … (K63)` en la máquina, el controlador y el hook. Si falla el directo tras la bienvenida, o fallan los dos: `introLocked` libre, `error` y Play carga el directo. Pausa externa: `introLocked` libre, `paused` y Play carga el directo. `error` a mitad: pasa al directo sin error. El `pause` que precede a `ended` no libera nada (el directo sigue) |
| A13 (ADR 0030) | `useSyncExternalStore` si pasan todos los tests del hook y los e2e de `cross-origin` e `intro` en Chromium; si no, se queda y el ADR 0030 recoge el motivo. La rule `player.md` lo refleja |
| Riesgo 5 | `keeps a single hls.js alive after a second play() while it loads (K80)` sigue en verde, en el núcleo y en el hook |
| ADR y contrato | ADR 0034 (C2, D3, D4 y D5 con la decisión nueva). `SPEC.md` §3.8 (protocolo, pausa durante la carga, bienvenida), spec D5/A9, filas de `known-issues.md` → «corregido (spec 0007)», JSDoc que cita «fixed in spec 0007» |
| Global | `npm run check` en cada tarea; cobertura de `src/core/**` ≥ 90 % líneas · ≥ 85 % ramas y de `src/hooks/**` ≥ 85 %. Al cerrar: e2e de `mp3`, `hls-dash`, `intro`, `media-session`, `sleep`, `cross-origin`, `visualizers` y `visualization` en las dos puntas |

## Tareas

### 2.1 C2: protocolo por el sufijo del `pathname`, y ADR 0034 (≤ 1 h)
- Qué (`fix-bug` + `write-adr`): `detectProtocol()` analiza la URL con `new URL(url, 'http://base.invalid')`, toma `pathname` en minúsculas y mira el sufijo. Si `new URL` lanza, devuelve `direct`. Los dos `currently` (núcleo y hook) pasan a regresión («detects %s by the suffix of its pathname (C2)»), más `…/live.m3u8#t`, una relativa y una que no se puede analizar. ADR 0034 «Estados del audio y protocolo»: C2, D3, D4 y D5 con la decisión del usuario sobre el error a mitad; se aplican en la 2.2–2.6. Spec D5 y A9 al día. `SPEC.md` §3.8 (protocolo). JSDoc, rule `player.md` (Reproducción: «por la extensión del `pathname`»), fila C2.
- Archivos: `player/src/core/audio/{protocol.ts,protocol.test.ts}`, `player/src/hooks/use-audio-player.test.tsx`, `docs/adr/0034-*.md`, `docs/adr/README.md`, `SPEC.md`, `docs/specs/0007-playback-fixes/spec.md`, `.claude/rules/player.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo): `protocol.test.ts` y `use-audio-player.test.tsx`.
- Verificación: `npm --prefix player run check`
- Resultado: los dos `currently` de C2 pasan a regresión (núcleo: 7 casos + la URL que no se puede analizar; hook: 3 de HLS, 2 de DASH y la URL que no se puede analizar). Rojo antes del arreglo: 14 (`expected 'direct' to be 'hls'`/`'dash'`; `…/stream?format=.m3u8` y `http://[/live.m3u8` daban `hls`; en el hook, ninguna instancia de `Hls`/`dashjs`). `npm run check` en verde. Cambio de comportamiento apuntado en el ADR 0034: `…/stream?format=.m3u8` pasa a ser directo (antes HLS por accidente).
- Changelog: las URL de HLS y DASH con *query string* (por ejemplo, un *token*), con fragmento o con la extensión en mayúsculas se reconocen y suenan; antes se trataban como audio directo y no sonaban.
- [x] hecha · commit: b20892c

### 2.2 K1: un `pause` no pisa `error` (≤ 1 h)
- Qué (`fix-bug`): en `transition()`, `pause` con `status: 'error'` devuelve el mismo estado (`user-paused` no cambia). Regresión en las tres capas:
  - máquina: `currently lets a pause after an error overwrite the error (K1)` → «keeps the error when a pause follows it (K1)»;
  - hook: `does not render the error … (K1)` → «renders the error of a failing MP3 and keeps it after the pause (K1)»;
  - e2e: `currently shows no error for a broken MP3 in Chromium (K1)` → «shows the error for a broken MP3 (K1)». Chromium: `error`, `error`, `pause` y la alerta. WebKit no cambia.
- Ajuste aprobado (decisión del usuario, 2026-10-22): `mp3.spec.ts` C8 WebKitGTK pasa a «currently stops with a network error and the play error, without reconnecting, when the stream is cut in WebKitGTK (C8)». Solo cambia la aserción de la alerta y el comentario «as in K1». Fila C8 al día.
- JSDoc de `transition()` sin K1. Filas K1 y C8.
- Archivos: `player/src/core/audio/{player-machine.ts,player-machine.test.ts}`, `player/src/hooks/use-audio-player.test.tsx`, `tests/e2e/{cross-origin.spec.ts,mp3.spec.ts}`, `docs/known-issues.md`.
- Test: regresión primero (rojo): máquina, hook y `cross-origin.spec.ts` en Chromium.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/cross-origin.spec.ts tests/e2e/mp3.spec.ts tests/e2e/intro.spec.ts`
- Resultado: rojo antes del arreglo en la máquina (`expected { status: 'paused', … } to be { status: 'error', … }`), en el hook (`expected … to match object { status: 'error', loading: false }`; hizo falta esperar una tarea real tras el `pause`, porque con solo microtareas React aún no había pintado y el test pasaba con el código viejo) y en `cross-origin.spec.ts` en Chromium (sin `role="alert"`; WebKit en verde). Tras el arreglo, `npm --prefix player run check` (623 tests) y los tres e2e en verde (37 pasan, 3 se saltan). El C8 de WebKitGTK se salta en macOS: su ajuste se verifica en la CI de Linux.
- Changelog: en Chromium, un MP3 que no se puede cargar (por ejemplo, un 404) muestra «Unable to play the stream» en lugar de quedarse en silencio con el botón Play.
- [x] hecha · commit: a091597

### 2.3 K64: `pause()` limpia `loading` (≤ 1 h)
- Qué (`fix-bug`): `user-paused` pone `status: 'paused'` y `loading: false`, salvo con la bienvenida. Los tres `currently keeps loading after a pause while buffering (K64)` pasan a «clears loading on a pause while buffering (K64)». JSDoc y fila K64.
- Archivos: `player/src/core/audio/{player-machine.ts,player-machine.test.ts,audio-controller.test.ts}`, `player/src/hooks/use-audio-player.test.tsx`, `docs/known-issues.md`.
- Test: regresión primero (rojo) en las tres.
- Verificación: `npm --prefix player run check`
- Resultado: rojo antes del arreglo en las tres capas (máquina: `expected { status: 'paused', loading: true, … } to match object { status: 'paused', loading: false }`; controlador y hook: `loading` en `true`). Tras el arreglo, `npm --prefix player run check` (623 tests) y `npm run check` en verde.
- Changelog: pausar mientras el directo se queda cargando (por ejemplo, desde la pantalla de bloqueo o con el temporizador de sueño) muestra el botón Play en lugar de dejar el indicador de carga para siempre.
- [x] hecha · commit: 2f57320

### 2.4 K11 (D4): `playing` sale del evento del elemento (≤ 1 h)
- Qué (`fix-bug`): `live-started` ya no pone `status` (solo `activeSource: 'live'` e `introLocked: false`). `playing` llega del evento del elemento, que ya limpia `loading`. Con una carga que sale bien, el controlador deja de limpiar `loading` en el `finally`. `load-end` solo se despacha tras un fallo, y los errores (`play-failed`, `stream-error`, `error`) limpian `loading`. Con el MP3 no cambia nada visible: el evento `playing` llega antes de que se resuelva `play()`. `resumed` de la bienvenida: se quita si el evento `playing` lo cubre. Regresión:
  - núcleo: `currently reports playing before MANIFEST_PARSED` (controlador) y `currently reports playing on live-started before the HLS manifest is parsed (K11)` (máquina) → «keeps loading until the element plays (K11)», con HLS y con DASH;
  - hook: el mismo `currently` del hook.
- Si cae un test que no es de K11 (por ejemplo, uno que espera `playing` tras `live-started` sin evento), se para y se pregunta.
- Archivos: `player/src/core/audio/{player-machine.ts,player-machine.test.ts,audio-controller.ts,audio-controller.test.ts}`, `player/src/hooks/use-audio-player.test.tsx`.
- Test: regresión primero (rojo).
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/hls-dash.spec.ts tests/e2e/mp3.spec.ts tests/e2e/intro.spec.ts`
- Ajuste aprobado (decisión del usuario, 2026-10-22): el arreglo rompía diez tests que no son el `currently` de K11 y que esperaban `playing` en cuanto engancha la librería, sin el evento del elemento. En la máquina, `switches to the live stream and unlocks with live-started` ya no espera `status: 'playing'`, el *fixture* `liveState` añade el evento `playing` y `currently reports playing on live-started after a pause pressed while it loads (K11)` pasa ya aquí a «respects a pause pressed while it loads (K11)». En el controlador y el hook, `sets error on a fatal hls.js error only` espera `idle` tras el aviso no fatal, `uses dashjs with autoplay and without crossOrigin` pierde la aserción de `playing` (la cubre el test nuevo de DASH) y `keeps a single hls.js alive after a second play() while it loads (K80)` dispara `MANIFEST_PARSED` antes de su aserción final.
- `resumed` se queda: `reports playing when the intro play() resolves, without waiting for the playing event` (spec 0006) fija que la bienvenida no depende del evento, así que el evento no lo cubre. Sí se quita el `finally` de la bienvenida: tras un fallo de la bienvenida limpiaba `loading` antes de que sonara HLS. Regresión nueva en el controlador: «keeps loading until HLS plays when it fails (K11)».
- Resultado: rojo antes del arreglo en las tres capas (`expected { status: 'playing', … } to match object { status: 'idle', loading: true }`), y en el caso de la bienvenida que falla. Tras el arreglo, `npm --prefix player run check` (625 tests) y los tres e2e en verde (27 pasan, 3 se saltan).
- Changelog: con HLS y DASH, el botón muestra el indicador de carga hasta que el directo suena de verdad, en lugar de mostrar Pausa mientras aún carga.
- [x] hecha · commit: 5f4d157

### 2.5 K81 y K11 con pausa (D3): una pausa durante la carga la cancela (≤ 1 h)
- Qué (`fix-bug`): el controlador lleva un contador de generación. `pause()` lo incrementa, suelta `pendingPlay` (el Play siguiente empieza de cero) y, si hay una carga en curso (`loading`), destruye la fuente. Al resolverse o rechazarse un intento viejo, y con los `onError`/`onPlayRejected` de su fuente, no se despacha nada: el `AbortError` queda ignorado. `hls.ts` no llama a `play()` en un `MANIFEST_PARSED` tras `destroy()`. `dash.ts` hace `reset()` (corta el *autoplay*). El `finally` de un intento viejo no borra el `pendingPlay` de otro. Regresión:
  - K81: los dos `currently reports an error when a pause interrupts the loading MP3 (K81)` (núcleo y hook) → «stays paused, without an error, when a pause interrupts the loading MP3 (K81)». E2E `mp3.spec.ts` → «stays paused without an error when the system pauses the loading MP3 (K81)» (Chromium y WebKit);
  - K11 con pausa: los dos `currently … after a pause pressed while it loads (K11)` que quedan (controlador y hook; el de la máquina se hizo en la 2.4) → «respects a pause pressed while HLS loads (K11)», más el caso de DASH (`reset()`, sin `playing`);
  - riesgo 5: K80 en verde. Test nuevo: «reloads on play() after a pause that cancelled the load» (una sola instancia viva).
- JSDoc de `play()`/`pause()`; filas K81 y K11.
- Archivos: `player/src/core/audio/{audio-controller.ts,audio-controller.test.ts,player-machine.test.ts}`, `player/src/core/audio/sources/{hls.ts,hls.test.ts,dash.ts,dash.test.ts}`, `player/src/hooks/use-audio-player.test.tsx`, `tests/e2e/mp3.spec.ts`, `docs/known-issues.md`.
- Test: regresión primero (rojo) en el núcleo, el hook y el e2e (con el `dist/` anterior).
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/mp3.spec.ts tests/e2e/hls-dash.spec.ts tests/e2e/media-session.spec.ts tests/e2e/sleep.spec.ts`
- Hecho: `pause()` sube la generación, suelta `pendingPlay` y, con `loading`, destruye la fuente; `playLive()` y el `catch` de `startPlay()` no despachan nada de una generación vieja, y el `finally` de un intento solo borra su propio `pendingPlay`. `hls.ts` y `dash.ts` no crean nada si se destruyen mientras cargan la librería e ignoran sus avisos tras `destroy()` (tests nuevos en `hls.test.ts` y `dash.test.ts`). El caso de DASH con pausa, también en el hook.
- Ajuste aprobado (decisión del usuario, 2026-10-22): `destroys the previous source on the next play()` (controlador) pausaba HLS mientras cargaba y esperaba que la pausa no lo destruyera, lo contrario de D3. Ahora dispara `MANIFEST_PARSED` antes del `pause()`: con el directo sonando, la pausa no destruye y el Play siguiente sí.
- Resultado: rojo antes del arreglo en el núcleo (8: el controlador seguía en `error`, no destruía `hls.js` ni hacía `reset()`, devolvía la promesa vieja; las fuentes llamaban a `play()`/`onError` tras `destroy()` y creaban la instancia tras destruirse), en el hook (3: `expected 'error' to be 'paused'`, sin `destroy`/`reset`) y en `mp3.spec.ts` con el `dist/` anterior (Chromium y WebKit: la alerta seguía). Tras el arreglo, `npm --prefix player run check` (632 tests) y los cuatro e2e en verde (39 pasan, 3 se saltan). K80 sigue en verde en el núcleo y en el hook.
- Changelog: pausar mientras el directo carga (desde la pantalla de bloqueo, los auriculares o el temporizador de sueño) deja el botón Play sin mostrar «Unable to play the stream», y con HLS o DASH el directo ya no empieza a sonar tras la pausa.
- [x] hecha · commit: 486d84f

### 2.6 K63 (D5): la bienvenida no bloquea el reproductor (≤ 1 h)
- Qué (`fix-bug`): `intro-finished` pone `introConsumed: true`, `introLocked: false` y `activeSource: null`, así que Play pasa por la carga del directo. En el controlador:
  - `pause` del elemento con la bienvenida y `!audio.ended` (pausa externa): `paused` y la da por consumida;
  - `error` del elemento con la bienvenida ya sonando: `advanceToLive()` en silencio, sin `error`. El `error` del arranque lo sigue llevando el `catch` de `startPlay()`, sin un segundo `advanceToLive()`;
  - el `pause` previo a `ended` no libera nada.
- Regresión: los cuatro `currently … (K63)` en la máquina, el controlador y el hook, con los nombres de A9 («releases the welcome audio when …»). Más «does not release the welcome audio on the pause before its end» (con `audio.ended` verdadero) y «errors in the welcome audio fall through to the live stream once».
- `SPEC.md` §3.8 (bienvenida: pausada desde fuera, Play carga el directo). JSDoc de `advanceToLive()` y fila K63.
- Archivos: `player/src/core/audio/{player-machine.ts,player-machine.test.ts,audio-controller.ts,audio-controller.test.ts}`, `player/src/hooks/use-audio-player.test.tsx`, `SPEC.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo).
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/intro.spec.ts tests/e2e/cross-origin.spec.ts tests/e2e/sleep.spec.ts`
- Hecho: `intro-finished` pone `introConsumed`, `introLocked: false` y `activeSource: null`. En el controlador, un `pause` del elemento con la bienvenida y `!audio.ended` despacha `intro-finished` antes del `pause`; un `error` con la bienvenida ya sonando llama a `advanceToLive()` sin despachar `error`, y mientras arranca (`introStarting`) lo ignora, porque lo lleva el `catch` de `startPlay()`. Si una pausa externa la libera mientras arranca, el `catch` no pasa al directo y limpia `loading`.
- Consecuencia del arreglo: con la bienvenida liberada, `pause()` y `play()` ya no se bloquean durante la carga del directo que la sigue. `advanceToLive()` respeta la generación (D3) y, tras `ended` o un `error`, corre como `play()` pendiente (`track()`, K80), así que un Play en ese momento no carga dos veces. Tests nuevos: «cancels the live stream that follows the welcome audio on pause() (K63)» y «keeps a single load of the live stream that follows the welcome audio on play() (K63)», más «releases the welcome audio when something else pauses it while it starts (K63)».
- Test que cambia con D5 (ADR 0034): `marks the welcome audio as consumed with intro-finished` (máquina) fijaba `activeSource: 'intro'` e `introLocked: true`. Pasa a «marks the welcome audio as consumed and releases it with intro-finished (K63)».
- Resultado: rojo antes del arreglo en la máquina (4: `introLocked: true`, `activeSource: 'intro'`), el controlador (6, la pausa durante el arranque agotaba el tiempo) y el hook (4: `expected true to be false`; el `error` a mitad dejaba `audio.src` en la bienvenida). Los guardas (`!audio.ended`, `introStarting`, `track()`) pasaban con el bloqueo viejo y se validaron con una mutación temporal cada uno. Tras el arreglo, `npm --prefix player run check` (637 tests) en verde. E2E: `intro` y `sleep` en verde. En `cross-origin.spec.ts` fallaban los cuatro «does not play HLS/DASH without CORS and shows the error (C1)», también con el `dist/` de la 2.5: no venían de K63, sino de la 2.4 (ver «2.4b»). Tras la 2.4b, los tres e2e en verde.
- Changelog: si la bienvenida se interrumpe (una llamada, unos auriculares que se desconectan) o falla el directo que la sigue, Play vuelve a funcionar sin recargar la página; un fallo a mitad de la bienvenida pasa al directo.
- [x] hecha · commit: eff0cbd

### 2.4b Regresión de la 2.4: `stream-error` limpia `loading` (añadida en la 2.6)
- Origen: al verificar la 2.6, `cross-origin.spec.ts` «does not play HLS/DASH without CORS and shows the error (C1)» fallaba en Chromium y WebKit (sin alerta, «Connecting...»), también con el `dist/` de la 2.5. La 2.4 quitó el `finally` de la carga: el error fatal de `hls.js`/`dashjs` llega después de que `start()` se resuelva, y `stream-error` no limpiaba `loading`, así que la alerta (`error` y sin `loading`) no salía. La verificación de la 2.4 y la 2.5 no incluía `cross-origin.spec.ts`. **Decisión del usuario (2026-10-22):** se corrige en un commit aparte.
- Qué (`fix-bug`): `stream-error` pone `status: 'error'` y `loading: false`. El `error` del elemento no lo limpia: con el reintento de C1 la alerta parpadearía.
- Tests nuevos: «clears loading on stream-error» (máquina), «clears loading on a fatal hls.js error while it loads» (controlador y hook) y «clears loading on a dashjs error while it loads» (controlador).
- Resultado: rojo antes del arreglo (4: `loading` en `true`). Tras el arreglo, `npm --prefix player run check` (641 tests) y los e2e de `cross-origin`, `hls-dash` e `intro` en verde (30 pasan).
- Changelog: sin nota propia (la regresión no llegó a publicarse).
- [x] hecha · commit: 70fcaf1

### 2.7 A13: revisión del ADR 0030 (≤ 1 h)
- Qué: `useAudioPlayer()` vuelve a `useSyncExternalStore(controller.subscribe, controller.getSnapshot)`. Se queda si pasan todos los tests del hook y los e2e de `cross-origin` e `intro` en Chromium (con el player reconstruido). Si es así, el ADR 0030 pasa a «sustituido» (por una nota en el 0034 o su propia sección). Si no, se revierte y el ADR 0030 se actualiza con el motivo medido. En los dos casos: JSDoc del hook, rule `player.md` (excepción de `useAudioPlayer()`) y spec 0006 si la cita.
- Archivos: `player/src/hooks/use-audio-player.tsx`, `docs/adr/0030-*.md` (y `0034`, `README.md`), `.claude/rules/player.md`.
- Test: los existentes (no se editan); la mutación es el propio cambio.
- Verificación: `npm --prefix player run check && npm run test:e2e -- --project=chromium tests/e2e/cross-origin.spec.ts tests/e2e/intro.spec.ts` (el nombre del proyecto, según `playwright.config.ts`)
- Resultado: con `useSyncExternalStore`, `npm --prefix player run check` en verde (641 tests), pero en Chromium fallan dos e2e de C1 de `cross-origin.spec.ts`: `plays an MP3 without CORS by retrying without crossOrigin (C1)` y `plays the welcome audio and the live stream without CORS (C1)` (sale la alerta «Unable to play the stream», tres veces en el segundo). Con el `dist/` de HEAD (`useState`) los dos pasan. La causa ya no es K1, sino el reintento del ADR 0033: el `error` del primer intento y el `canplay` del reintento dejan `status: 'error'` con `loading: false` hasta `playing`, y `useSyncExternalStore` lo pinta. Se revierte el hook. El ADR 0030 se queda, con la sección «Revisión en la 0007» (el motivo medido y lo que haría falta para volver). Al día: el JSDoc del hook, la rule `player.md`, el índice de ADRs. La spec 0006 no cambia (cita el ADR 0030, sin plazo). `intro.spec.ts` en verde.
- [x] hecha · commit: —

## Decisiones abiertas → ADR
- ADR 0034 (2.1): C2, D3, D4 y D5, este con la decisión del usuario sobre el error a mitad de la bienvenida (cambia D5 y A9 de la spec en el mismo commit).
- ADR 0030 (2.7): actualizado (se queda por el reintento de C1).
- Ajuste del `currently` de C8 en WebKitGTK por K1: aprobado por el usuario (2026-10-22), sin ADR.

## Verificación de la fase
`npm run check` en cada tarea. Al cerrar (`close-phase`): e2e completos con `env:start:min` y `env:start:latest` (las pasadas largas con `caffeinate -dims`), `npm run check:zip`, cobertura del núcleo y de los hooks.

