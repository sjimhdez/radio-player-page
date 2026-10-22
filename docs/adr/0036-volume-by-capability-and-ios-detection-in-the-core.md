# ADR 0036 — Volumen por capacidad y detección de iOS en el núcleo

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0007 (fase 3; se escribe en la tarea 3.3 y se aplica en la 3.4 y la 3.5)

## Contexto

K13 (`docs/known-issues.md`): `useIsIOS()` (`player/src/hooks/use-is-ios.tsx`) solo mira `iphone|ipad|ipod` en el `userAgent`, así que el iPadOS 13+ con Safari, que por defecto pide la web de escritorio y se anuncia como `Macintosh`, no se detecta: en iPad se ve el deslizador de volumen (que iOS ignora, el volumen es de solo lectura) y HLS va por `hls.js` en vez del nativo. Además calcula en un efecto, así que devuelve `false` en el primer render; es el único `eslint-disable` de `player/src` (`react-hooks/set-state-in-effect`).

El valor se usa para tres cosas: `VolumeControl` oculta el deslizador, el controlador del núcleo no escribe `audio.volume` (`attach()`, `setVolume()`) y `createHlsSource()` usa HLS nativo. Como el valor cambia tras el primer render, el controlador lo recibe en cada llamada (`attach(audio, { isIOS })`, `play({ …, isIOS })`, `setVolume(v, { isIOS })`) y no al crearse.

D8 y A12 de la spec pedían parchear el *hook* (calcular en el inicializador de `useState` y añadir `Macintosh` + `maxTouchPoints > 1`). Al planificar la fase 3, el usuario decidió (2026-10-22) no parchearlo sino rehacerlo: lo que importa para el volumen es si se puede cambiar, no qué dispositivo es; y la elección de HLS es del núcleo, que ya recibe el `userAgent` para Web Audio (`webAudio.userAgent`, ADR 0033).

## Decisión

1. **El volumen se decide por capacidad.** `core/audio/volume.ts` exporta `isVolumeControllable(probe)`: escribe en un elemento de sondeo un valor de `volume` distinto del actual y comprueba si se lee de vuelta (iOS lo ignora y devuelve 1). `createAudioController()` recibe `volumeProbe?: () => HTMLMediaElement` (sin él, controlable), lo evalúa una vez al crearse y publica `volumeControllable` en la instantánea, así que es correcto desde el primer render. Si es `false`, ni `attach()` ni `setVolume()` escriben `volume`. La sonda es un elemento aparte: el del reproductor no se toca. `useAudioPlayer()` inyecta `() => document.createElement('audio')`; `VolumeControl` solo pinta lo que recibe.
2. **HLS nativo en iOS, detectado en el núcleo.** `core/audio/platform.ts` exporta la función pura `isIOSDevice(userAgent, maxTouchPoints)`: `iphone|ipad|ipod` (sin distinguir mayúsculas), o `macintosh` con `maxTouchPoints > 1` (iPadOS con la web de escritorio). El controlador recibe `{ userAgent, maxTouchPoints }` al crearse, como ya recibe `webAudio.userAgent`, y pasa el resultado a `createHlsSource()`.
3. **`isIOS` sale de las firmas del controlador** (`attach()`, `play()`, `setVolume()`; API interna del núcleo, ADR 0029). `useIsIOS()` y su test se borran, y con ellos el `eslint-disable`.

Enmienda D8 y A12 de la spec 0007 y la línea «Volumen» de `SPEC.md` §3.8.

## Consecuencias

- En iPhone y en iPad (también con la web de escritorio) no se ve el deslizador y HLS va por el nativo. Cualquier otro navegador que ignore `volume` tampoco muestra el deslizador, aunque no sea iOS.
- Ya no hay un primer render con el valor equivocado: los dos datos están en el controlador antes de pintar.
- Cambian con este ADR los tests que pasan `isIOS` al controlador o al *hook* (`audio-controller.test.ts`, `use-audio-player.test.tsx`, entre ellos «reads isIOS on each play(), not when it is created»), la caracterización del volumen del `Dashboard` (`index.test.tsx`, «Dashboard volume», escrita en la tarea 3.3 por *user agent*) y `use-is-ios.test.tsx`, cuyos casos pasan a `platform.test.ts`. El *fake* de audio gana un volumen de solo lectura.
- Si un navegador futuro aplica la escritura de `volume` de forma asíncrona, la sonda lo daría por no controlable; se vigila con la verificación manual en iPhone y iPad reales (`docs/status.md`).
- Tests: `core/audio/volume.test.ts`, `core/audio/platform.test.ts`, `audio-controller.test.ts` (`volumeControllable` en la primera instantánea; iPadOS de escritorio con HLS va por el nativo) y `index.test.tsx` (sin deslizador si `volumeControllable` es `false`).

## Alternativas descartadas

- **Parchear `useIsIOS()`** (D8 original): arregla iPadOS, pero sigue decidiendo el volumen por dispositivo y deja al controlador recibiendo `isIOS` en cada llamada.
- **`canPlayType('application/vnd.apple.mpegurl')` para elegir HLS nativo:** Safari de macOS también lo devuelve, y pasaría de `hls.js` al nativo sin medirlo.
- **`hls.js` donde haya MSE, sin mirar iOS:** el iPhone con iOS 17.1+ tiene ManagedMediaSource y pasaría a `hls.js` sin medir su comportamiento con la pantalla bloqueada y en segundo plano.
- **Detectar la capacidad del volumen en el elemento del reproductor:** cambia su volumen al probar y obliga a esperar a `attach()`, así que no estaría en el primer render.

Evidencia: [`phase-3.md`](../specs/0007-playback-fixes/phase-3.md) (contexto de K13).
