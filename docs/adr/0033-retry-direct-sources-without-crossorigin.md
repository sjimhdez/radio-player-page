# ADR 0033 — Reintento sin `crossOrigin` en las fuentes directas y regla de la visualización

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0007 (fase 1, tarea 1.6) · Enmienda los ADRs [0004](0004-crossorigin-on-direct-sources.md) y [0013](0013-crossorigin-for-visualizers.md) (`crossOrigin`) y el [0031](0031-visualization-decided-by-the-core.md) (regla de la visualización y su consecuencia sobre WebKit)

## Contexto

Desde la 1.0.1 toda fuente asignada a `audio.src` lleva `crossOrigin = 'anonymous'` para que los visualizadores lean el audio con Web Audio (ADR 0013, 0004). El precio es C1: un stream de otro origen sin cabeceras CORS **no suena** en ningún navegador. El usuario decidió (D1 de la spec 0007) que suene siempre.

El ADR 0031 llevó la decisión «visualizador o animación estática» al núcleo y dejó al spike de la 0007 lo que faltaba medir. El spike ([informe](../spikes/0007-phase-0.md), R1) midió en Chromium, WebKit y Safari real (macOS e iOS):

- El reintento en el mismo elemento (`removeAttribute('crossorigin')` + `load()` + `play()`) suena, salvo que el elemento ya pase por `createMediaElementSource()`: entonces Chromium lo reproduce en silencio.
- Un 404 y «sin CORS» dan el mismo error (`error` 4, `play()` rechazado con `NotSupportedError`); no se distinguen. Un reintento sobre un 404 falla en 2–6 ms.
- WebKit solo da datos al analizador con un MP3 finito con longitud, que una emisora no es; con MSE no se sabe si Safari lo oye con el grafo conectado.
- Un `AudioContext` creado fuera del gesto arranca `suspended`; crearlo o reanudarlo dentro del gesto de Play basta.

El usuario aprobó la propuesta el 2026-10-22, con dos elecciones: la bienvenida no se visualiza y WebKit nunca visualiza.

## Decisión

1. **Primer intento con `crossOrigin = 'anonymous'`** en las fuentes directas (MP3/OGG, HLS nativo, bienvenida), como hasta ahora. Las rutas MSE (`hls.js`, `dashjs`) siguen sin él (ADR 0004).
2. **Un solo reintento sin `crossOrigin`** en el mismo elemento si `play()` se rechaza con un error del medio (`NotSupportedError`). Nunca con `NotAllowedError` (falta el gesto) ni `AbortError` (pausa o carga nueva), nunca en las rutas MSE (sin CORS, error claro, como hoy) y nunca si el elemento ya está unido al grafo de Web Audio: ahí sonaría en silencio, así que es un error. Vale también para la bienvenida. Si el reintento falla, error.
3. **`AudioSource.isCorsClean()`**: falso solo tras el reintento de una fuente directa; `hls.js` y `dashjs`, verdadero; HLS nativo, lo de su fuente directa. El controlador recibe el grafo (`VisualizerGraph`) y permite el reintento si `graph.isConnected()` es falso.
4. **Regla de la visualización** (`canVisualize` en la instantánea del controlador, tarea 1.7): verdadero solo con la fuente sonando (`playing`), si hay Web Audio, la fuente es el directo (la bienvenida **nunca**), el navegador no es WebKit y la fuente es limpia (`isCorsClean()`). Se recalcula en cada intento. Un solo valor gobierna visualizador y animación estática.
5. **Excepción medida de WebKit, por *user agent*:** `AppleWebKit` sin `Chrome` ni `Chromium` (Safari y todos los navegadores de iOS) nunca visualiza, también con CORS (`isWebKitBrowser()`, con su test). Es la única decisión por *user agent* que admite el ADR 0031.
6. **`AudioContext`:** se crea, o se reanuda si está `suspended`, de forma síncrona dentro de `play()` (en el gesto), nunca desde un efecto y nunca en WebKit. `createMediaElementSource()` solo la primera vez que `canVisualize` pasa a verdadero; desde entonces el elemento queda unido.

## Consecuencias

- Una emisora sin CORS con fuente directa suena en todos los navegadores, también con bienvenida, con la animación estática en lugar del visualizador. Sin CORS, HLS y DASH siguen sin sonar (las librerías piden por XHR) y muestran el error.
- Un stream caído (404) se pide dos veces. En Chromium, K1 sigue: el `pause` que sigue al segundo `error` tapa el mensaje (`currently shows no error for a broken MP3 in Chromium (K1)`); se corrige en la fase 2.
- La bienvenida rota también se pide dos veces antes de pasar al directo.
- Deja sin efecto la consecuencia del ADR 0031 «en WebKit con un stream con CORS se verá el visualizador»: en Safari se sigue viendo la animación estática, como en la 3.4.2.
- Cambio visible en Chromium: la bienvenida muestra la animación estática en vez del visualizador (tarea 1.8).
- Si aparece un navegador con datos planos con CORS (Firefox está sin medir), se añade la red de seguridad «analizador plano ~2 s → animación estática» que el spike dejó fuera.
- Tests: `player/src/core/audio/sources/direct.test.ts` y `audio-controller.test.ts` («streams without CORS (C1)», con `media.corsBlocked` del *fake*), `player/src/core/audio/web-audio.test.ts` (la excepción de WebKit) y `tests/e2e/cross-origin.spec.ts` (MP3 y bienvenida sin CORS, en Chromium y WebKit).
- Cambian en el mismo commit: `SPEC.md` §3.8, el invariante 5 de `CLAUDE.md`, la rule `player.md` y las filas C1 y K1 de `docs/known-issues.md`. `SPEC.md` §3.9 se aplica en la tarea 1.8.

## Alternativas descartadas

- **Sin `crossOrigin` siempre:** ningún visualizador en las emisoras con CORS, que hoy lo tienen.
- **Distinguir «sin CORS» de un 404 antes de reintentar** (una petición `HEAD` o `fetch` previa): otra petición en cada carga, que tampoco sabe lo que hará el elemento; el reintento cuesta lo mismo y solo en el fallo.
- **Visualizar la bienvenida:** el elemento llegaría unido al grafo al directo, y una emisora sin CORS con bienvenida daría error en Chromium.
- **Aplicar la regla general en WebKit** con la red de seguridad del analizador plano: el visualizador quedaría plano ~2 s antes de pasar a la animación estática, y con `hls.js`/`dashjs` Safari podría quedar mudo (sin medir).

Evidencia: [informe del spike de la 0007](../spikes/0007-phase-0.md) (R1 y la propuesta, puntos 7–14), plan de la [fase 1](../specs/0007-playback-fixes/phase-1.md) (tarea 1.6).
