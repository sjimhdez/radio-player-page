# Spec 0007 — Correcciones: reproducción

> Estado: **propuesta** · Fecha: 2026-10-21 · Rama: `spec/0007-playback-fixes` · Depende de: 0006
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0004, 0013, 0018, 0029 y 0030, `SPEC.md` §2 y §3.8 y las filas C1, C2, C7, K1, K11, K12, K13, K18, K63–K67 y K81 de `docs/known-issues.md` (su columna «Decisión del usuario» es el mandato).
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0007-playback-fixes/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Es una spec de correcciones:** cada fila se corrige con `fix-bug`. Su test `currently` (en el núcleo y en el hook o el e2e, las dos capas que cita la fila) pasa a test de regresión en rojo y luego a verde, y la fila pasa a «corregido (spec 0007)». Ningún otro test de caracterización se edita para que pase: si uno cae sin que su fila esté en esta spec, se para y se pregunta.
5. **Empieza por la fase 0 (spike).** C1 depende de lo que mida: no se escribe código de C1 hasta que el usuario apruebe el resultado.
6. **No se toca la zona congelada** (ADR 0018: `components/visualizers/**`, `config/visualizers.ts`, `types/visualizers.tsx`, `hooks/use-audio-visualizer.tsx`, `hooks/use-can-visualize.tsx`). Si C1 lo necesitara, se para y se pregunta.
7. La lógica va en `player/src/core/` (ADR 0029); los hooks y los componentes solo cambian si cambia lo que pintan.

## 1. Contexto y objetivo

La 0006 dejó el reproductor en un núcleo sin React (`core/audio`, `core/sleep`) con todas sus rarezas fijadas como `currently` en dos capas. El triage de la 0002 aprobó corregir las de la reproducción, que es lo que más nota un oyente: un stream sin CORS no suena (C1), Pausa + Play no vuelve al directo y en Safari se congela (C7, K18), los estados del audio mienten (K1, K11, K64, K81), la bienvenida puede bloquear el reproductor (K63) y `dashjs` llama a un servidor de hora de terceros (K67, que **bloquea la release**: guidelines de WordPress.org, `SPEC.md` §2).

Al cerrar la spec, todas esas filas están corregidas con su test de regresión, `SPEC.md` §3.8 describe el comportamiento nuevo con sus ADRs y la pista del player puede seguir con la 0011.

**No objetivos:** C8 (reconexión automática: replicar, mejora futura); la interfaz, i18n y la accesibilidad del player (0011: K56–K62, K68, K69, AX*); el horario (0009); los visualizadores (zona congelada; C5 no se corrige).

## 2. Criterios de aceptación

Cada fila, con `fix-bug`. «Regresión» = el `currently` que cita `known-issues.md` cambia de nombre y de aserción en ese mismo commit, en las dos capas.

| # | Fila | Criterio (test) |
|---|---|---|
| A1 | K67 | `tests/e2e/hls-dash.spec.ts`: el directo DASH sin `<UTCTiming>` suena y **no** hay ninguna petición a `time.akamai.com` (la ruta sigue interceptada para detectarla). `core/audio/sources/dash.test.ts`: la fuente quita las fuentes de hora por defecto antes de `initialize()`. `grep` del *chunk* de `dashjs` en `player/dist/`: la URL de Akamai puede seguir en el código de la librería, pero no se usa (lo prueba el e2e) |
| A2 | C7, K18, K12 | `tests/e2e/mp3.spec.ts`: tras Pausa + Play hay una petición nueva a `/live.mp3` y la posición vuelve al directo (Chromium y WebKitGTK); el test de K18 (solo macOS) pasa a «no se congela». `audio-controller.test.ts`: Play tras una pausa vuelve a cargar el directo en los tres protocolos, sin comparar `audio.src`; el `currently` de K12 pasa a test normal («recreates hls.js to return to the live edge (C7)») |
| A3 | C1 | Según el spike (§5, fase 0). Mínimo: `tests/e2e/cross-origin.spec.ts`, un MP3 sin CORS **suena** en Chromium y en WebKit con y sin visualizador, y HLS/DASH (`hls.js`, `dashjs`) sin CORS muestran el error. `direct.test.ts`/`audio-controller.test.ts`: el reintento quita `crossOrigin`, ocurre una sola vez y solo en las fuentes directas; `crossOrigin === 'anonymous'` sigue siendo el primer intento (ADR 0004) |
| A4 | C2 | `protocol.test.ts` y `use-audio-player.test.tsx`: `.m3u8?token=x`, `.M3U8`, `.mpd?token=x`, `.MPD` y `…/live.m3u8#t` se detectan por el sufijo del `pathname`, sin distinguir mayúsculas; una URL que no se puede analizar no lanza |
| A5 | K1 | `player-machine.test.ts`: un `pause` en estado `error` no lo cambia. `cross-origin.spec.ts`: cuando un directo falla, el error se ve en Chromium y en WebKit |
| A6 | K11 | `player-machine.test.ts`/`audio-controller.test.ts`: con HLS y DASH `loading` sigue en `true` y el estado no es `playing` hasta el evento `playing` del elemento. Una pausa durante la carga se respeta: no suena al llegar `MANIFEST_PARSED` (con DASH, tampoco por el *autoplay*) |
| A7 | K81 | `audio-controller.test.ts` y `mp3.spec.ts` (Chromium y WebKit): pausar mientras carga el MP3 deja `paused`, sin error |
| A8 | K64 | `player-machine.test.ts`/`audio-controller.test.ts`: `pause()` durante el *buffering* limpia `loading` |
| A9 | K63 | Los cuatro `currently … (K63)`, en las dos capas: si el directo falla tras la bienvenida, fallan los dos, algo externo la pausa o le da error, `introLocked` se libera y Play carga el directo |
| A10 | K65 | `sleep.spec.ts`: «Sleep mode» deshabilitado mientras suena la bienvenida y habilitado cuando suena el directo; el temporizador puesto en el directo no se cancela solo. `sleep-timer.test.ts`: el `currently` de K65 pasa a regresión con esa regla |
| A11 | K66 | `sleep-timer.test.ts` y `SleepMode.test.tsx`: la cuenta atrás se calcula contra una hora límite (`clock.now()`); con los *ticks* retrasados o saltados, el tiempo restante es el real y el final llega a su hora |
| A12 | K13 | `use-is-ios.test.tsx`: `Macintosh` + `maxTouchPoints > 1` es iOS, y el valor es correcto en el primer render. `grep -rn "eslint-disable" player/src` vacío |
| A13 | ADR 0030 | Revisado tras K1: `useAudioPlayer()` vuelve a `useSyncExternalStore` si pasan todos los tests del hook y los e2e de `cross-origin` e `intro` en Chromium; si no, se queda y el ADR 0030 se actualiza con el motivo. `.claude/rules/player.md` lo refleja |
| A14 | Global | `npm run check` y e2e en las dos puntas (`env:start:min` y `env:start:latest`) en verde; cobertura de `src/core/**` ≥ 90 % líneas · ≥ 85 % ramas, `src/hooks/**` ≥ 85 %; tabla del gzip antes y después en el PR (más de un 10 % se pregunta) |
| A15 | Manual | El usuario, en Safari real (macOS y, si puede, iOS): Pausa + Play de un directo MP3 vuelve al directo y no se congela (K18); un MP3 sin CORS suena (C1). Va en «Verificación manual pendiente» de `docs/status.md` hasta que lo confirme |

## 3. Cambios al contrato (`SPEC.md`)

Todos en §3.8, más la fila de la 0007 en §6. Ninguna global, meta, opción ni markup cambia.

| Cambio | ADR previsto | Fase |
|---|---|---|
| `crossOrigin`: primer intento con `'anonymous'`; si una fuente directa falla, un reintento sin él (y lo que decida el spike sobre el visualizador). Se elimina «un stream sin CORS no suena» | nuevo, enmienda 0004 y 0013 | 1 |
| Play tras una pausa vuelve al directo (recarga) en todos los protocolos, salvo durante la bienvenida | nuevo | 1 |
| DASH: `dashjs` sin fuente de hora de terceros (usa `<UTCTiming>` del MPD o la cabecera `Date`; si no, el reloj local) | el mismo de C7, o ninguno si el plan lo justifica: cumple §2, no lo cambia | 1 |
| Protocolo por el sufijo del `pathname`, sin distinguir mayúsculas | nuevo (o el de C7 ampliado) | 2 |
| Errores: se quita la excepción de K1 | ninguno (vuelve al contrato) | 2 |
| Bienvenida: si falla, la pausan o falla el directo, el reproductor queda libre y Play carga el directo | el de la fase 2 | 2 |
| Temporizador de sueño: deshabilitado durante la bienvenida; cuenta contra una hora límite | nuevo | 3 |

Los números los asigna `write-adr` (siguiente libre: 0031). Un ADR puede agrupar los cambios de una fase.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | C1 se decide tras un spike (fase 0). Objetivo: **que suene siempre**. Sin CORS, el `Dashboard` no conecta el visualizador (pasa `canvasRef = null` a `useAudioVisualizer()`, sin tocar la zona congelada). Si el elemento ya pasó por Web Audio (por ejemplo, la bienvenida con visualizador) y el reintento quedaría en silencio, error claro. El usuario aprueba el resultado | usuario, 2026-10-21 |
| D2 | C7: Play tras una pausa recarga el directo en todos los protocolos; ya no se compara `audio.src` con la URL (K12). Arregla K18 si el spike lo confirma | triage 0002 |
| D3 | Una pausa durante la carga **cancela la carga**: el controlador invalida el intento en curso (un contador de generación), ignora el `AbortError` y los avisos de una fuente vieja, y destruye la fuente. Resuelve K11 (la pausa se respeta), K81 y, con C7, el siguiente Play recarga | diseño |
| D4 | El estado `playing` del directo sale del evento `playing` del elemento, no de `live-started` (K11); `loading` hasta entonces | diseño |
| D5 | K63: si la bienvenida falla, la pausan desde fuera o le da error, se da por consumida y se libera `introLocked`; Play carga el directo. Si falla el directo tras ella, queda `error` con Play habilitado | triage 0002 |
| D6 | K65: «Sleep mode» deshabilitado mientras `introLocked`; `useSleepTimer()` no cambia de firma | usuario, 2026-10-21 (en `known-issues.md`) |
| D7 | K67: `clearDefaultUTCTimingSources()` en la instancia de `dashjs`, antes de `initialize()` (`dashjs` 5.2.1; por defecto `defaultTimingSource` es `https://time.akamai.com/?iso&ms` y `useManifestDateHeaderTimeSource` es `true`). `DashPlayer` en `sources/types.ts` y el *fake* de `src/test/fake-streaming.ts` lo añaden | diseño, comprobado en `node_modules/dashjs` |
| D8 | K13: `useIsIOS()` calcula en el inicializador de `useState` (sin efecto ni `eslint-disable`) con `iphone\|ipad\|ipod` o `Macintosh` + `navigator.maxTouchPoints > 1`. El comentario de `audio-controller.ts` sobre `isIOS` se actualiza | triage 0002 |

### 4.2 Dónde va cada corrección

| Fila | Núcleo | Adaptador o componente |
|---|---|---|
| K67 | `core/audio/sources/dash.ts` | — |
| C7, K18, K12 | `core/audio/audio-controller.ts` (fuera la rama `resume`) | — |
| C1 | `core/audio/sources/direct.ts` (reintento) y `audio-controller.ts` (marca en la instantánea, nombre según el spike) | `hooks/use-audio-player.tsx` la expone; `components/dashboard/index.tsx` decide el visualizador |
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
| R1 (C1) | En Chromium y WebKit, con una fuente directa de otro origen sin CORS: ¿el reintento sin `crossOrigin` (mismo elemento, `removeAttribute` + `load()`) suena? ¿Y si antes se llamó a `createMediaElementSource()` sobre el elemento (visualizador activo; bienvenida con visualizador)? ¿Basta con no conectar el visualizador para que suene? ¿Cómo distingue el controlador «sin CORS» de un 404 (los dos dan `error` 4), o se reintenta siempre una vez? |
| R2 (K67) | Con `clearDefaultUTCTimingSources()`, un directo DASH sin `<UTCTiming>` ¿suena, sin pedir nada a terceros, con y sin la cabecera `Date` expuesta por CORS? |
| R3 (K18, C7) | En Safari real (macOS; iOS si el usuario puede): ¿se congela Pausa + Play hoy, y recargar el directo lo evita? Lo prueba el usuario con una página del spike y anota el resultado |

- **Resultado:** informe en `docs/spikes/0007-phase-0.md` con lo medido, la propuesta de C1 (qué hace el `Dashboard`, qué marca expone el controlador, cuándo sale error) y, si cambia algo de esta spec, la spec corregida en el mismo commit.
- ✅ **Criterio:** cada riesgo tiene respuesta demostrada; **el usuario aprueba** la propuesta de C1 antes de la fase 1.

### Fase 1 — Prioridad alta: K67, C7 (K18, K12) y C1

- K67 primero (bloquea la release). Después C7, que cambia la reanudación de la que dependen C1 y la fase 2. Después C1, según el spike, con su ADR.
- ✅ **Criterios:** A1, A2, A3; ADRs de C1 y C7 con `SPEC.md` §3.8; A15 anotado en `docs/status.md`.

### Fase 2 — Prioridad media: estados del audio

- C2; K1 y la revisión del ADR 0030 (A13); K64; D3 y D4 (K11, K81); K63.
- ✅ **Criterios:** A4–A9, A13.

### Fase 3 — Prioridad baja: sueño e iOS, y cierre

- K65, K66 y K13. Cierre de la spec: `SPEC.md` §3.8 y §6, notas de la hoja de ruta para la 0011 (los estados del audio que pinta), `known-issues.md` al día.
- ✅ **Criterios:** A10–A12, A14.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | C1 sin una salida que suene con visualizador sin tocar la zona congelada | Spike R1; si no la hay, se para y el usuario elige (error claro con visualizador, o ADR que descongela) | Fase 0 |
| 2 | El reintento de C1 duplica la petición a un stream caído (404) | Un solo reintento; el spike mide si se puede distinguir | Fase 0 |
| 3 | Sin fuente de hora, el directo DASH arranca lejos del borde | Spike R2; la cabecera `Date` es la reserva de `dashjs` | Fase 0 |
| 4 | C7 recarga el directo y un e2e o la Media Session dependían de la reanudación | Todos los e2e de `mp3`, `hls-dash`, `intro`, `media-session` y `sleep` en las dos puntas; si un test de caracterización cae fuera de las filas de la spec, se para | Fase 1 |
| 5 | D3 (cancelar la carga al pausar) cambia la serialización de `play()` (K80, ADR 0029 D7) | El test de K80 (una sola instancia de `Hls`) sigue en verde; si no, se para | Fase 2 |
| 6 | Volver a `useSyncExternalStore` reabre el destello de la 2.9 de la 0006 | A13: solo si todos los tests del hook y los dos e2e de Chromium pasan | Fase 2 |
| 7 | K18 no se puede verificar en Safari real a tiempo | Queda en «Verificación manual pendiente» y en la checklist de la release | Fase 1 |
| 8 | `sleep.spec.ts` es lento y frágil en WebKit de la CI (0006, 3.12) | No subir sus tiempos más allá del límite del archivo; si hace falta, se pregunta | Fase 3 |

## Apéndice — Referencias

- `docs/known-issues.md`: filas C1, C2, C7, K1, K11, K12, K13, K18, K63, K64, K65, K66, K67, K81 (y C8, que no se corrige).
- ADR 0004, 0013 (`crossOrigin`), 0018 (zona congelada), 0029 (núcleo), 0030 (orden de los renders de K1).
- Spec 0006: [`spec.md`](../0006-player-refactor/spec.md) §4.3 y §4.5, y sus planes de fase (sospechas K80 y K81, la sonda de la 2.11).
- `dashjs` 5.2.1: `streaming.utcSynchronization` y `MediaPlayer.clearDefaultUTCTimingSources()`.
- Web Audio API: un `MediaElementAudioSourceNode` sobre un medio de otro origen sin CORS produce silencio.
