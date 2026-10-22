# Spec 0007 — Correcciones: reproducción

> Estado: **propuesta** · Fecha: 2026-10-21 · Rama: `spec/0007-playback-fixes` · Depende de: 0006
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0004, 0013, 0018, 0029, 0030 y 0031, `SPEC.md` §2, §3.8 y §3.9 y las filas C1, C2, C7, K1, K11, K12, K13, K18, K63–K67 y K81 de `docs/known-issues.md` (su columna «Decisión del usuario» es el mandato).
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0007-playback-fixes/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Es una spec de correcciones:** cada fila se corrige con `fix-bug`. Su test `currently` (en el núcleo y en el hook o el e2e, las dos capas que cita la fila) pasa a test de regresión en rojo y luego a verde, y la fila pasa a «corregido (spec 0007)». Ningún otro test de caracterización se edita para que pase: si uno cae sin que su fila esté en esta spec, se para y se pregunta.
5. **Empieza por la fase 0 (spike).** C1 depende de lo que mida: no se escribe código de C1 hasta que el usuario apruebe el resultado.
6. **No se toca la zona congelada** (ADR 0018 con el alcance del 0031: `components/visualizers/**`, `config/visualizers.ts`, `types/visualizers.tsx`). `hooks/use-can-visualize.tsx` y `hooks/use-audio-visualizer.tsx` **sí** se rehacen en esta spec (ADR 0031, D9), tras caracterizarlos.
7. La lógica va en `player/src/core/` (ADR 0029); los hooks y los componentes solo cambian si cambia lo que pintan.

## 1. Contexto y objetivo

La 0006 dejó el reproductor en un núcleo sin React (`core/audio`, `core/sleep`) con todas sus rarezas fijadas como `currently` en dos capas. El triage de la 0002 aprobó corregir las de la reproducción, que es lo que más nota un oyente: un stream sin CORS no suena (C1) y la decisión de pintar el visualizador o la animación estática es incorrecta (ADR 0031), Pausa + Play no vuelve al directo (C7; el «se congela en Safari» de K18 resultó ser del *fixture* e2e, spike R3), los estados del audio mienten (K1, K11, K64, K81), la bienvenida puede bloquear el reproductor (K63) y `dashjs` llama a un servidor de hora de terceros (K67, que **bloquea la release**: guidelines de WordPress.org, `SPEC.md` §2).

Al cerrar la spec, todas esas filas están corregidas con su test de regresión, `SPEC.md` §3.8 describe el comportamiento nuevo con sus ADRs y la pista del player puede seguir con la 0011.

**No objetivos:** C8 (reconexión automática: replicar, mejora futura); la interfaz, i18n y la accesibilidad del player (0011: K56–K62, K68, K69, AX*); el horario (0009); el dibujo de los visualizadores (zona congelada; C5 no se corrige).

## 2. Criterios de aceptación

Cada fila, con `fix-bug`. «Regresión» = el `currently` que cita `known-issues.md` cambia de nombre y de aserción en ese mismo commit, en las dos capas.

| # | Fila | Criterio (test) |
|---|---|---|
| A1 | K67 | `tests/e2e/hls-dash.spec.ts`: el directo DASH sin `<UTCTiming>` suena y **no** hay ninguna petición a `time.akamai.com` (la ruta sigue interceptada para detectarla). `core/audio/sources/dash.test.ts`: la fuente quita las fuentes de hora por defecto **después** de `initialize()` (antes no sirve: spike R2), y un `error` con el código 16 (`TIME_SYNC_FAILED`) no llega a `onError()`. `grep` del *chunk* de `dashjs` en `player/dist/`: la URL de Akamai puede seguir en el código de la librería, pero no se usa (lo prueba el e2e) |
| A2 | C7, K18, K12 | `tests/e2e/mp3.spec.ts`: tras Pausa + Play hay una petición nueva a `/live.mp3` y la posición vuelve al directo (Chromium y WebKitGTK). K18 es del *fixture* (spike R3): `tests/e2e/media-server.mjs` emite en `/live.mp3` solo los marcos de audio, y el test de K18 (solo macOS) pasa a «no se congela»: el rojo es la aserción nueva con el *fixture* antiguo y el verde, el *fixture* corregido, sin tocar el player. `audio-controller.test.ts`: Play tras una pausa vuelve a cargar el directo en los tres protocolos, sin comparar `audio.src`; el `currently` de K12 pasa a test normal («recreates hls.js to return to the live edge (C7)») |
| A3 | C1 | Según el spike ([informe](../../spikes/0007-phase-0.md)). `tests/e2e/cross-origin.spec.ts`: un MP3 sin CORS **suena** en Chromium y en WebKit, también con bienvenida, y HLS/DASH (`hls.js`, `dashjs`) sin CORS muestran el error. `direct.test.ts`/`audio-controller.test.ts`: `crossOrigin === 'anonymous'` sigue siendo el primer intento (ADR 0004); si `play()` de una fuente directa se rechaza con un error del medio (`NotSupportedError`; un 404 no se distingue de «sin CORS») hay un solo reintento en el mismo elemento sin `crossOrigin`, nunca con las fuentes MSE, y ninguno si el elemento ya está unido al grafo de Web Audio (error) |
| A3b | ADR 0031 | Antes de rehacerlos, `currently` de lo actual (WebKit nunca visualiza; el grafo se conecta con el canvas oculto) con su fila en `known-issues.md`. Después: `audio-controller.test.ts` publica `canVisualize` en la instantánea, por intento y al llegar `playing`: `true` solo con el directo (la bienvenida nunca), con Web Audio, fuera de WebKit (excepción medida por *user agent*, con su test) y con una fuente MSE o directa cargada con `crossOrigin`; `false` tras el reintento sin él. El `AudioContext` se crea o se reanuda de forma síncrona en `play()` (en el gesto), nunca desde un efecto ni en WebKit; `createMediaElementSource()` solo cuando `canVisualize` pasa a `true`. E2E nuevo (Chromium y WebKit): en Chromium con CORS se ve el visualizador; sin CORS, la animación estática y el audio suena; en WebKit, la animación estática. `visualizers.spec.ts` sin editar. Los dos hooks salen de la exclusión de cobertura de `player/vitest.config.ts` y cumplen los mínimos |
| A4 | C2 | `protocol.test.ts` y `use-audio-player.test.tsx`: `.m3u8?token=x`, `.M3U8`, `.mpd?token=x`, `.MPD` y `…/live.m3u8#t` se detectan por el sufijo del `pathname`, sin distinguir mayúsculas; una URL que no se puede analizar no lanza |
| A5 | K1 | `player-machine.test.ts`: un `pause` en estado `error` no lo cambia. `cross-origin.spec.ts`: cuando un directo falla, el error se ve en Chromium y en WebKit |
| A6 | K11 | `player-machine.test.ts`/`audio-controller.test.ts`: con HLS y DASH `loading` sigue en `true` y el estado no es `playing` hasta el evento `playing` del elemento. Una pausa durante la carga se respeta: no suena al llegar `MANIFEST_PARSED` (con DASH, tampoco por el *autoplay*) |
| A7 | K81 | `audio-controller.test.ts` y `mp3.spec.ts` (Chromium y WebKit): pausar mientras carga el MP3 deja `paused`, sin error |
| A8 | K64 | `player-machine.test.ts`/`audio-controller.test.ts`: `pause()` durante el *buffering* limpia `loading` |
| A9 | K63 | Los cuatro `currently … (K63)`, en las dos capas: si el directo falla tras la bienvenida o fallan los dos, `introLocked` se libera, queda `error` y Play carga el directo; si algo externo la pausa, `introLocked` se libera, queda `paused` y Play carga el directo; si le da `error` a mitad, pasa al directo sin error (ADR 0034). El `pause` que precede a `ended` no libera nada |
| A10 | K65 | `sleep.spec.ts`: «Sleep mode» deshabilitado mientras suena la bienvenida y habilitado cuando suena el directo; el temporizador puesto en el directo no se cancela solo. `sleep-timer.test.ts`: el `currently` de K65 pasa a regresión con esa regla |
| A11 | K66 | `sleep-timer.test.ts` y `SleepMode.test.tsx`: la cuenta atrás se calcula contra una hora límite (`clock.now()`); con los *ticks* retrasados o saltados, el tiempo restante es el real y el final llega a su hora |
| A12 | K13 | Enmendado por el [ADR 0036](../../adr/0036-volume-by-capability-and-ios-detection-in-the-core.md): `core/audio/volume.test.ts`: un elemento que ignora la escritura de `volume` no es controlable, uno normal sí, y la sonda no cambia el volumen del elemento real. `audio-controller.test.ts`: `volumeControllable` en la primera instantánea y, si es `false`, ni `attach()` ni `setVolume()` escriben `volume`; con iPadOS de escritorio, HLS va por el nativo. `index.test.tsx`: sin deslizador si `volumeControllable` es `false`. `core/audio/platform.test.ts`: `iphone\|ipad\|ipod` y `Macintosh` + `maxTouchPoints > 1` son iOS; un Mac sin táctil, Android y Windows no. `grep -rn "eslint-disable" player/src` vacío y sin `use-is-ios.tsx` |
| A13 | ADR 0030 | Revisado tras K1: `useAudioPlayer()` vuelve a `useSyncExternalStore` si pasan todos los tests del hook y los e2e de `cross-origin` e `intro` en Chromium; si no, se queda y el ADR 0030 se actualiza con el motivo. `.claude/rules/player.md` lo refleja |
| A14 | Global | `npm run check` y e2e en las dos puntas (`env:start:min` y `env:start:latest`) en verde; cobertura de `src/core/**` ≥ 90 % líneas · ≥ 85 % ramas, `src/hooks/**` ≥ 85 %; tabla del gzip antes y después en el PR (más de un 10 % se pregunta) |
| A15 | Manual | **Verificado** en el spike (2026-10-22, Safari 27.0.1 en macOS e iOS 18.7): Pausa + Play de un directo MP3 no se congela y recargar vuelve al directo (K18); un MP3 sin CORS se oye con el reintento (C1). Con el player corregido, pasada en Safari de macOS al cerrar la fase 1 (2026-10-22): bien |

## 3. Cambios al contrato (`SPEC.md`)

Todos en §3.8, más la fila de la 0007 en §6. Ninguna global, meta, opción ni markup cambia.

| Cambio | ADR previsto | Fase |
|---|---|---|
| `crossOrigin`: primer intento con `'anonymous'`; si una fuente directa falla, un reintento sin él. Se elimina «un stream sin CORS no suena» | nuevo, enmienda 0004 y 0013 | 1 |
| §3.9: visualizador o animación estática según la fuente en curso, decidido por el núcleo; zona congelada reducida al dibujo. Del spike: la bienvenida nunca se visualiza (cambio visible en Chromium) y WebKit nunca visualiza, también con CORS (excepción por *user agent*) | **0031** (escrito en diseño) y el nuevo de C1, que lo amplía y corrige su consecuencia sobre WebKit | 1 |
| Play tras una pausa vuelve al directo (recarga) en todos los protocolos, salvo durante la bienvenida | nuevo | 1 |
| DASH: `dashjs` sin fuente de hora de terceros (usa `<UTCTiming>` del MPD o la cabecera `Date`; si no, el reloj local) | el mismo de C7, o ninguno si el plan lo justifica: cumple §2, no lo cambia | 1 |
| Protocolo por el sufijo del `pathname`, sin distinguir mayúsculas | nuevo (o el de C7 ampliado) | 2 |
| Errores: se quita la excepción de K1 | ninguno (vuelve al contrato) | 2 |
| Bienvenida: si falla, la pausan o falla el directo, el reproductor queda libre y Play carga el directo | el de la fase 2 | 2 |
| Temporizador de sueño: deshabilitado durante la bienvenida; cuenta contra una hora límite | nuevo | 3 |

Los números los asigna `write-adr` (siguiente libre: 0032). Un ADR puede agrupar los cambios de una fase.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | C1 (spike aprobado): **que suene siempre**. Primer intento con `crossOrigin`; si una fuente directa falla, un solo reintento sin él en el mismo elemento (no se distingue un 404). Sin CORS, el audio no pasa por Web Audio y se ve la animación estática (D9). La bienvenida no se visualiza, así que el elemento solo se une al grafo con un directo limpio; si aun así está unido y falla, error claro, sin reintento | usuario, 2026-10-21 y 2026-10-22 (spike); enmendado por el ADR 0031 |
| D2 | C7: Play tras una pausa recarga el directo en todos los protocolos; ya no se compara `audio.src` con la URL (K12). K18 no lo arregla esto: es del *fixture* e2e (spike R3), que se corrige | triage 0002; spike |
| D3 | Una pausa durante la carga **cancela la carga**: el controlador invalida el intento en curso (un contador de generación), ignora el `AbortError` y los avisos de una fuente vieja, y destruye la fuente. Resuelve K11 (la pausa se respeta), K81 y, con C7, el siguiente Play recarga | diseño |
| D4 | El estado `playing` del directo sale del evento `playing` del elemento, no de `live-started` (K11); `loading` hasta entonces | diseño |
| D5 | K63: si la bienvenida falla al arrancar o le da `error` mientras suena, pasa al directo sin error (como si terminara). Si la pausan desde fuera, se da por consumida, se libera `introLocked` y Play carga el directo. Si falla el directo tras ella, queda `error` con Play habilitado | triage 0002; usuario, 2026-10-22 (el `error` a mitad pasa al directo, ADR 0034) |
| D6 | K65: «Sleep mode» deshabilitado mientras `introLocked`; `useSleepTimer()` no cambia de firma | usuario, 2026-10-21 (en `known-issues.md`) |
| D7 | K67: `clearDefaultUTCTimingSources()` en la instancia de `dashjs`, **justo después** de `initialize()` (la primera `initialize()` restaura las fuentes por defecto; spike R2). Se conserva `useManifestDateHeaderTimeSource` (por defecto `true`). `dash.ts` ignora el error no fatal 16 (`TIME_SYNC_FAILED`) que da `dashjs` sin fuente de hora. `DashPlayer` en `sources/types.ts` y el *fake* de `src/test/fake-streaming.ts` lo añaden | diseño; spike R2 |
| D8 | K13, enmendado por el [ADR 0036](../../adr/0036-volume-by-capability-and-ios-detection-in-the-core.md) (usuario, 2026-10-22): el volumen se decide por capacidad (el núcleo sondea si `volume` se puede escribir y publica `volumeControllable`); la elección de HLS nativo sigue siendo por iOS, con `isIOSDevice(userAgent, maxTouchPoints)` en el núcleo (`iphone\|ipad\|ipod` o `Macintosh` + `maxTouchPoints > 1`), que el controlador recibe al crearse. `useIsIOS()` desaparece. ~~`useIsIOS()` calcula en el inicializador de `useState`~~ | triage 0002 · ADR 0036 |
| D9 | Visualización (ADR 0031): el controlador decide por la fuente en curso si se puede visualizar y lo publica en la instantánea; `createMediaElementSource()` solo con una fuente visualizable; el cableado de Web Audio va al núcleo con el `AudioContext` inyectado; un solo valor gobierna visualizador y animación estática. `useCanVisualize()` desaparece o queda como adaptador; `useAudioVisualizer()` queda como bucle de dibujo. `VisualizerFn` conserva firma y ruta importable por `config/visualizers.ts`. Del spike: la marca es `canVisualize`; la bienvenida nunca se visualiza y WebKit nunca visualiza (excepción medida por *user agent*); el `AudioContext` se crea o se reanuda en `play()`, dentro del gesto | usuario, 2026-10-21 y 2026-10-22 (spike) |

### 4.2 Dónde va cada corrección

| Fila | Núcleo | Adaptador o componente |
|---|---|---|
| K67 | `core/audio/sources/dash.ts` | — |
| C7, K12 | `core/audio/audio-controller.ts` (fuera la rama `resume`) | — |
| K18 | — (*fixture*: `tests/e2e/media-server.mjs`) | — |
| C1 | `core/audio/sources/direct.ts` (reintento) y `audio-controller.ts` (marca `canVisualize` en la instantánea) | `hooks/use-audio-player.tsx` la expone |
| ADR 0031 | `audio-controller.ts` (visualizable por fuente) y el cableado de Web Audio en `core/audio/` (archivo según el plan) | `hooks/use-audio-visualizer.tsx` y `hooks/use-can-visualize.tsx` (rehechos), `components/dashboard/index.tsx` y `StreamInfo.tsx` (un solo valor) |
| C2 | `core/audio/protocol.ts` | — |
| K1, K64, K11 | `core/audio/player-machine.ts` | — |
| K81, K11 (pausa), K63 | `audio-controller.ts` (D3, D5) y `player-machine.ts` | — |
| K65 | — | `components/dashboard/index.tsx` (`isPlaying` de `SleepMode`) |
| K66 | `core/sleep/sleep-timer.ts` (`clock.now()`) | — |
| K13 | — | `hooks/use-is-ios.tsx` |

Comentarios y JSDoc de `player-machine.ts`, `audio-controller.ts`, `protocol.ts`, `sleep-timer.ts` y `use-sleep-timer.tsx` que citan las filas como «fixed in spec 0007» se actualizan al corregirlas.

### 4.3 Tests

- **Antes de corregir**, cada fase comprueba que sus filas tienen el `currently` en las dos capas que cita `known-issues.md`; lo que falte se caracteriza primero, con su commit.
- Los e2e no hacen peticiones a internet: la de Akamai se intercepta (como hoy en `hls-dash.spec.ts`) y el MP3 sin CORS usa el servidor de *fixtures* de otro origen de `cross-origin.spec.ts`.
- El reloj del sueño se inyecta (`Clock` de `core/clock/minute-ticker.ts`, que ya tiene `now()`).
- Media Session (`media-session.spec.ts`) y los visualizadores (`visualizers.spec.ts`) siguen en verde sin editarlos: son la red de C7, D3 y C1.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Un commit por fila (`fix(0007): … (N.M)`).

### Fase 0 — Spike

Desechable, en `spike/0007-playback/` (con su `README.md`, fila en `spike/README.md`; fuera del zip). Usa el entorno de tests o una página estática con *fixtures* locales; nada sale a internet.

| Riesgo | Pregunta que responde |
|---|---|
| R1 (C1) | En Chromium y WebKit, con una fuente directa de otro origen sin CORS: ¿el reintento sin `crossOrigin` (mismo elemento, `removeAttribute` + `load()`) suena? ¿Y si antes se llamó a `createMediaElementSource()` sobre el elemento (visualizador activo; bienvenida con visualizador)? ¿Basta con no conectar el visualizador para que suene? ¿Cómo distingue el controlador «sin CORS» de un 404 (los dos dan `error` 4), o se reintenta siempre una vez? Y para el ADR 0031: con un stream **con** CORS, ¿hay datos reales en el analizador en Chromium, WebKit y Safari real, con MP3, HLS nativo (Safari, iOS si se puede), `hls.js` y `dashjs`? ¿El `AudioContext` creado fuera del gesto arranca suspendido y deja el audio mudo, y basta con crearlo o reanudarlo en el gesto de Play? ¿Hace falta detectar en tiempo real un analizador plano? |
| R2 (K67) | Con `clearDefaultUTCTimingSources()`, un directo DASH sin `<UTCTiming>` ¿suena, sin pedir nada a terceros, con y sin la cabecera `Date` expuesta por CORS? |
| R3 (K18, C7) | En Safari real (macOS; iOS si el usuario puede): ¿se congela Pausa + Play hoy, y recargar el directo lo evita? Lo prueba el usuario con una página del spike y anota el resultado |

- **Resultado:** informe en `docs/spikes/0007-phase-0.md` con lo medido, la propuesta de C1 y de la visualización (qué marca expone el controlador, en qué fuentes es visualizable, cuándo se crea el `AudioContext`, cuándo sale error) y, si cambia algo de esta spec, la spec corregida en el mismo commit.
- ✅ **Criterio:** cada riesgo tiene respuesta demostrada; **el usuario aprueba** la propuesta de C1 antes de la fase 1.

### Fase 1 — Prioridad alta: K67, C7 (K18, K12) y C1

- K67 primero (bloquea la release). Después C7, que cambia la reanudación de la que dependen C1 y la fase 2. Después C1 y la visualización (D9), según el spike, con su ADR: primero la caracterización de los dos hooks, después C1 y por último la decisión de la visualización.
- ✅ **Criterios:** A1, A2, A3, A3b; ADRs de C1 y C7 con `SPEC.md` §3.8; A15 anotado en `docs/status.md`.

### Fase 2 — Prioridad media: estados del audio

- C2; K1 y la revisión del ADR 0030 (A13); K64; D3 y D4 (K11, K81); K63.
- ✅ **Criterios:** A4–A9, A13.

### Fase 3 — Prioridad baja: sueño e iOS, y cierre

- K65, K66 y K13. Cierre de la spec: `SPEC.md` §3.8 y §6, notas de la hoja de ruta para la 0011 (los estados del audio que pinta), `known-issues.md` al día.
- ✅ **Criterios:** A10–A12, A14.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | C1 sin una salida que suene si el elemento ya pasó por Web Audio | Resuelto en el spike: la bienvenida no se visualiza y el grafo solo se conecta con un directo limpio; si aun así pasa, error claro (D1) | Fase 0 ✅ |
| 1b | En WebKit sale el visualizador donde hoy nunca salía, o da datos planos con CORS | Medido: WebKit da ceros en directos y HLS nativo (también en Safari real) y en MSE (solo medido en el WebKit de Playwright). WebKit nunca visualiza (excepción medida, A3b); en Safari no cambia lo que se ve | Fase 0 ✅ |
| 2 | El reintento de C1 duplica la petición a un stream caído (404) | Medido: no se distingue; un solo reintento, que falla en 2–6 ms | Fase 0 ✅ |
| 3 | Sin fuente de hora, el directo DASH arranca lejos del borde | Medido: con el reloj del cliente bien, a ~6 s (como con Akamai); desfasado, la `Date` expuesta lo corrige; sin ella, el desfase pasa al arranque (−20 s → 26 s del borde). Consecuencia que recoge el ADR de la fase 1 | Fase 0 ✅ |
| 4 | C7 recarga el directo y un e2e o la Media Session dependían de la reanudación | Todos los e2e de `mp3`, `hls-dash`, `intro`, `media-session` y `sleep` en las dos puntas; si un test de caracterización cae fuera de las filas de la spec, se para | Fase 1 |
| 5 | D3 (cancelar la carga al pausar) cambia la serialización de `play()` (K80, ADR 0029 D7) | El test de K80 (una sola instancia de `Hls`) sigue en verde; si no, se para | Fase 2 |
| 6 | Volver a `useSyncExternalStore` reabre el destello de la 2.9 de la 0006 | A13: solo si todos los tests del hook y los dos e2e de Chromium pasan | Fase 2 |
| 7 | K18 no se puede verificar en Safari real a tiempo | Verificado en Safari macOS e iOS (A15) | Fase 0 ✅ |
| 8 | `sleep.spec.ts` es lento y frágil en WebKit de la CI (0006, 3.12) | No subir sus tiempos más allá del límite del archivo; si hace falta, se pregunta | Fase 3 |

## Apéndice — Referencias

- `docs/known-issues.md`: filas C1, C2, C7, K1, K11, K12, K13, K18, K63, K64, K65, K66, K67, K81 (y C8, que no se corrige).
- ADR 0004, 0013 (`crossOrigin`), 0018 (zona congelada) y 0031 (visualización por el núcleo; reduce la zona), 0029 (núcleo), 0030 (orden de los renders de K1).
- Spec 0006: [`spec.md`](../0006-player-refactor/spec.md) §4.3 y §4.5, y sus planes de fase (sospechas K80 y K81, la sonda de la 2.11).
- `dashjs` 5.2.1: `streaming.utcSynchronization` y `MediaPlayer.clearDefaultUTCTimingSources()`.
- Web Audio API: un `MediaElementAudioSourceNode` sobre un medio de otro origen sin CORS produce silencio.
