# Spec 0007 · Fase 3 — Prioridad baja: sueño e iOS, y cierre
Estado: en curso · Inicio: 2026-10-22 · ADRs: 0004, 0029, 0030, 0034 (nuevos: 0035, 0036)

## Contexto
Lo leído al planificar, contrastado con la spec, los ADR y el código. Nada es falso.
- **K66:** `createSleepTimer()` (`core/sleep/sleep-timer.ts`) resta 1 por *tick* del intervalo de 1 s. Hay `currently counts interval ticks, not elapsed time (K66)` en **tres** capas: `sleep-timer.test.ts`, `use-sleep-timer.test.tsx` y `SleepMode.test.tsx` (A11 cita dos; se corrigen las tres). El `Clock` inyectado ya tiene `now()` y el *fake* (`src/test/fake-clock.ts`) lo mueve con `advance()`; `vi.useFakeTimers()` y `page.clock` falsean `Date.now()`, así que el e2e de `sleep.spec.ts` sigue siendo determinista.
- **K65:** hoy la bienvenida está en `status: 'playing'` y `introLocked: true`, y `SleepMode` recibe `isPlaying={status === 'playing'}` (`components/dashboard/index.tsx`), así que se puede poner el temporizador durante la bienvenida y el paso al directo lo cancela. D6: deshabilitar «Sleep mode» mientras `introLocked`; `useSleepTimer()` no cambia. La regla del núcleo (`setPlaying(false)` cancela) **no cambia**: el `currently` del núcleo pasa a test normal que nombra la regla (sin rojo posible en esa capa); el rojo está en `index.test.tsx` (test nuevo) y en `sleep.spec.ts`.
- **K13:** `useIsIOS()` calcula en un efecto (único `eslint-disable` de `player/src`, `use-is-ios.tsx:19`) y solo mira `iphone|ipad|ipod`. Dos tests fijan lo actual: `currently does not detect iPadOS …` y `returns false on the first render, before the effect runs`. Se usa para tres cosas: `VolumeControl` oculta el deslizador, el controlador no escribe `audio.volume` (`attach`, `setVolume`) y `createHlsSource()` usa HLS nativo. **Decisión del usuario (2026-10-22), cambia D8 y A12:** no se parchea, se rehace. (1) El volumen se decide **por capacidad**: el núcleo prueba en un elemento de sondeo si escribir `volume` tiene efecto (iOS lo ignora y devuelve 1), y el controlador lo publica en la instantánea (`volumeControllable`). El componente solo lo pinta. (2) La elección de HLS nativo sigue siendo por iOS, pero con una función pura del núcleo (`isIOSDevice(userAgent, maxTouchPoints)`, con iPadOS) que el controlador recibe al crearse, como ya hace con `webAudio.userAgent`. (3) Va en esta fase, con un ADR (0036) que enmienda D8 y A12 en el mismo commit. `useIsIOS()` desaparece, y con él el `eslint-disable`. El `isIOS` de `play()`/`attach()`/`setVolume()` (API interna del núcleo, ADR 0029) sale de sus firmas; los tests que lo pasan cambian con el ADR. Si cae un test que no se cita aquí, se para y se pregunta.
- **Cierre:** `SPEC.md` §3.8 aún dice «con las excepciones de K1» (la fase 2 no lo quitó) y la línea del sueño no recoge K65/K66; falta la fila 0007 de §6. La spec pide un ADR nuevo para el sueño (§3, fase 3): será el 0035.

## Objetivo
Corregir K66, K65 y K13 con su regresión en las capas que cita `known-issues.md`, escribir el ADR 0035 y dejar el contrato y la hoja de ruta listos para cerrar la spec (A14 en `close-phase`).

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A11 (K66) | `sleep-timer.test.ts`, `use-sleep-timer.test.tsx` y `SleepMode.test.tsx`: con los *ticks* retenidos 29 min, el siguiente muestra el tiempo real (59 s, no 1799); con el reloj pasado de la hora límite, el siguiente *tick* llama a `onEnd` una vez. Los tests existentes de cuenta atrás siguen en verde sin editarlos |
| A10 (K65) | `index.test.tsx`: «Sleep mode» deshabilitado con `status: 'playing'` e `introLocked: true`. `sleep.spec.ts` (Chromium y WebKit): deshabilitado mientras suena la bienvenida, habilitado cuando suena el directo, y el temporizador puesto en el directo sigue. `sleep-timer.test.ts`: el `currently` de K65 pasa a test con la regla |
| A12 (K13, enmendado por el ADR 0036) | `core/audio/volume.test.ts`: un elemento que ignora la escritura de `volume` no es controlable; uno normal sí, y la sonda no cambia el volumen del elemento real. `audio-controller.test.ts`: `volumeControllable` está en la primera instantánea (correcto en el primer render) y, si es `false`, ni `attach()` ni `setVolume()` escriben `volume`. `VolumeControl`/`index.test.tsx`: sin deslizador si `volumeControllable` es `false`. `core/audio/platform.test.ts`: `iphone\|ipad\|ipod` y `Macintosh` + `maxTouchPoints > 1` son iOS; un Mac sin táctil, Android y Windows no. `audio-controller.test.ts`: con iPadOS de escritorio, HLS va por el nativo. `grep -rn "eslint-disable" player/src` vacío y sin `use-is-ios.tsx`. Manual: en iPhone y iPad reales, sin deslizador y con HLS nativo (se añade a «Verificación manual pendiente») |
| ADR y contrato | ADR 0035 (sueño: hora límite y deshabilitado durante la bienvenida). `SPEC.md` §3.8 (sueño, errores sin K1) y §6 (fila 0007, ADR 0031–0036). Filas K65, K66, K13 → «corregido (spec 0007)». Rule `player.md` sin la excepción de `use-is-ios.tsx`. Hoja de ruta: notas de la 0011 |
| A14 (global) | `npm run check` en cada tarea; en `close-phase`: e2e en las dos puntas, cobertura `src/core/**` ≥ 90 % líneas · ≥ 85 % ramas y `src/hooks/**` ≥ 85 %, tabla del gzip frente a `origin/trunk` en el PR (> 10 % se pregunta) |
| Riesgo 8 | `sleep.spec.ts` no sube su `timeout` (3 min) |

## Tareas

### 3.1 K66: la cuenta atrás contra una hora límite, y ADR 0035 (≤ 1 h)
- Qué (`fix-bug` + `write-adr`): `start(seconds)` guarda `deadline = clock.now() + seconds * 1000`; cada *tick* recalcula `remainingSeconds = Math.round((deadline - clock.now()) / 1000)` (redondeo al segundo más cercano: la deriva del intervalo ni pierde ni añade un *tick*), y si es ≤ 0 llama a `onEnd` y vuelve a `null`. Al volver el primer suscriptor (`startInterval`) se recalcula también. El intervalo, la referencia estable de `getSnapshot()` entre *ticks* y la parada sin suscriptores no cambian. Regresión en las tres capas: `currently counts interval ticks, not elapsed time (K66)` → «counts against a deadline when the ticks are held back (K66)» (espera 60), más en el núcleo «ends on the first tick past the deadline (K66)». ADR 0035 «Temporizador de sueño» (hora límite, K66; deshabilitado durante la bienvenida, K65, que aplica la 3.2). `SPEC.md` §3.8 (sueño). JSDoc de `sleep-timer.ts` y `use-sleep-timer.tsx`; fila K66.
- Archivos: `player/src/core/sleep/{sleep-timer.ts,sleep-timer.test.ts}`, `player/src/hooks/{use-sleep-timer.tsx,use-sleep-timer.test.tsx}`, `player/src/components/dashboard/SleepMode.test.tsx`, `docs/adr/0035-*.md`, `docs/adr/README.md`, `SPEC.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo) en las tres capas.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/sleep.spec.ts`
- Rojo (antes del arreglo): las tres capas `expected 1799 to be 59`; «ends on the first tick past the deadline» `expected 1799 to be null`; «catches up … comes back» `expected 1800 to be 1200`. El test espera **59**, no 60: 29 min retenidos más el *tick* de 1 s dejan 30:00 − 29:01. Se añade «catches up with the deadline when the first subscriber comes back (K66)» para el recálculo al volver el primer suscriptor.
- Changelog: el temporizador de sueño pausa a su hora aunque el navegador retrase los temporizadores (pestaña en segundo plano).
- [x] hecha · commit: `a50f418`

### 3.2 K65: «Sleep mode» deshabilitado durante la bienvenida (≤ 1 h)
- Qué (`fix-bug`): en `Dashboard`, `SleepMode` recibe `isPlaying={status === 'playing' && !introLocked}`; `useSleepTimer()` sigue con `status === 'playing'`. Regresión:
  - componente: test nuevo en `index.test.tsx`, «disables sleep mode while the welcome audio plays (K65)»;
  - e2e: `currently cancels the timer when the welcome audio hands over to the live stream (K65)` → «disables sleep mode during the welcome audio and keeps the timer set on the live stream (K65)»: deshabilitado con la bienvenida sonando; habilitado con el directo; se pone y sigue (sin `page.clock`, solo comprueba que el botón de cancelar sigue tras unos segundos);
  - núcleo: el `currently` → «cancels on any setPlaying(false); sleep mode is off during the welcome audio, so its handover never finds a timer (K65)» (sin cambio de aserciones: la regla del núcleo no cambia).
- JSDoc de `use-sleep-timer.tsx` y `SleepMode.tsx`; fila K65.
- Archivos: `player/src/components/dashboard/{index.tsx,index.test.tsx,SleepMode.tsx}`, `player/src/core/sleep/sleep-timer.test.ts`, `player/src/hooks/use-sleep-timer.tsx`, `tests/e2e/sleep.spec.ts`, `docs/known-issues.md`.
- Test: regresión primero (rojo): `index.test.tsx` y `sleep.spec.ts` con el `dist/` anterior.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/sleep.spec.ts tests/e2e/intro.spec.ts`
- Rojo (antes del arreglo): `index.test.tsx` `expected false to be true`; `sleep.spec.ts` (Chromium y WebKit) `{ intro: true, disabled: false }`. El e2e lee el botón y la fuente del audio en un solo `evaluate`: un `toBeDisabled()` con reintentos pasaba con el `dist/` anterior, porque el relevo al directo pasa por `paused` dentro de sus 5 s. El temporizador del directo se pone sin `setShortestTimer()` (con reloj real, `30:00` puede pasar a `29:59` antes de la aserción).
- Changelog: «Sleep mode» no se puede activar mientras suena el audio de bienvenida; antes, el paso al directo cancelaba el temporizador sin avisar.
- [x] hecha · commit: `262540c`

### 3.3 ADR 0036 y caracterización del volumen en iOS (≤ 1 h)
- Qué (`write-adr` + `characterize`): ADR 0036 «Volumen por capacidad y detección de iOS en el núcleo». Recoge (1) y (2) del contexto, las alternativas descartadas (`canPlayType` para HLS cambia Safari de macOS; `hls.js` donde haya MSE pasa el iPhone a ManagedMediaSource sin medir) y la consecuencia de que `isIOS` salga de las firmas del controlador. Enmienda D8 y A12 de la spec en el mismo commit; `SPEC.md` §3.8 («Volumen»: oculto donde el sistema no deja cambiarlo; HLS nativo en iOS, también en iPadOS). Antes de tocar nada se comprueba que lo que se va a cambiar está fijado: si `VolumeControl` no tiene test de «oculto en iOS» o el `Dashboard` no lo cubre, se añade como caracterización contra el código actual.
- Archivos: `docs/adr/0036-*.md`, `docs/adr/README.md`, `docs/specs/0007-playback-fixes/spec.md`, `SPEC.md`, `player/src/components/dashboard/*.test.tsx` (si falta la caracterización).
- Test: caracterización (si falta), validada con una mutación temporal.
- Verificación: `npm --prefix player run check`
- [x] hecha · commit: `9b685a1`

### 3.4 K13 (1/2): el volumen se decide por capacidad (≤ 1 h)
- Qué (`fix-bug`, TDD en el núcleo): `core/audio/volume.ts` con `isVolumeControllable(probe: HTMLMediaElement): boolean` (escribe un valor distinto en la sonda y comprueba si se lee de vuelta). `createAudioController()` recibe `volumeProbe?: () => HTMLMediaElement` (sin él, controlable), calcula `volumeControllable` al crearse y lo publica en la instantánea. `attach()` y `setVolume()` dejan de recibir `isIOS` y miran `volumeControllable`. `useAudioPlayer()` inyecta `() => document.createElement('audio')` y expone `volumeControllable`. `Dashboard` lo pasa a `VolumeControl`, que deja de llamar a `useIsIOS()`. El *fake* de audio (`src/test/fake-audio.ts`) gana un modo de volumen de solo lectura. Tests que cambian con el ADR: los de `attach`/`setVolume` con `{ isIOS: true }` (controlador y hook) pasan a la sonda de solo lectura.
- Archivos: `player/src/core/audio/{volume.ts,volume.test.ts,audio-controller.ts,audio-controller.test.ts}`, `player/src/test/fake-audio.ts`, `player/src/hooks/{use-audio-player.tsx,use-audio-player.test.tsx}`, `player/src/components/dashboard/{VolumeControl.tsx,index.tsx,index.test.tsx}`.
- Test: primero (TDD) en `volume.test.ts` y el controlador; regresión en el componente.
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/mp3.spec.ts tests/e2e/player-a11y.spec.ts`
- Rojo (antes del arreglo): `volume.test.ts` no encuentra `src/core/audio/volume`; controlador `volumeControllable` `undefined` y `attach()` sin opciones lanza al desestructurar `isIOS`; *hook* `expected undefined to be true|false`; `index.test.tsx` sin deslizador con *user agent* de iPhone y con deslizador con `volumeControllable: false`. `volumeControllable: true` entra en `initialPlayerState` (el test de la máquina lo recoge): sin sonda, el controlador conserva la referencia de `initialPlayerState`. Hasta la 3.5, `useIsIOS()` solo alimenta `play()` (HLS).
- Changelog: el deslizador de volumen se oculta en cualquier dispositivo donde el sistema no deja cambiar el volumen (también el iPad con la web de escritorio).
- [x] hecha · commit: —

### 3.5 K13 (2/2): iOS para HLS en el núcleo; fuera `useIsIOS()` (≤ 1 h)
- Qué (`fix-bug`): `core/audio/platform.ts` con `isIOSDevice(userAgent, maxTouchPoints)` (`iphone|ipad|ipod`, o `macintosh` con `maxTouchPoints > 1`). `createAudioController()` recibe `platform: { userAgent, maxTouchPoints }` (o lo une a `webAudio.userAgent` si queda más limpio), calcula `isIOS` al crearse y se lo pasa a `createHlsSource()`. `play()` deja de recibir `isIOS`. Se borran `use-is-ios.tsx` y su test: sus casos (y la regresión de K13, «detects iPadOS that reports a desktop user agent (K13)») pasan a `platform.test.ts`, y el de «el primer render» queda cubierto por la creación del controlador. Tests que cambian con el ADR: `reads isIOS on each play(), not when it is created` (controlador) pasa a «takes the platform when it is created», y los `play({ …, isIOS })`. Comentario de `audio-controller.ts` sobre K13, JSDoc de `hls.ts`, rule `player.md` (fuera la «única excepción de `react-hooks`»; «Volumen» por capacidad), fila K13.
- Archivos: `player/src/core/audio/{platform.ts,platform.test.ts,audio-controller.ts,audio-controller.test.ts,sources/hls.ts}`, `player/src/hooks/{use-audio-player.tsx,use-audio-player.test.tsx,use-is-ios.tsx,use-is-ios.test.tsx}`, `.claude/rules/player.md`, `docs/known-issues.md`.
- Test: regresión primero (rojo): iPadOS de escritorio con HLS va por el nativo (controlador).
- Verificación: `npm --prefix player run check && ! grep -rn "eslint-disable" player/src && npm run test:e2e -- tests/e2e/hls-dash.spec.ts`
- [ ] hecha · commit: —

### 3.6 Contrato y hoja de ruta al cierre de la spec (≤ 1 h)
- Qué (`docs`): `SPEC.md` §3.8 «Errores» sin la excepción de K1 (vuelve al contrato, sin ADR) y §6 con la fila 0007 (crossOrigin con reintento, visualización por el núcleo, Play recarga el directo, DASH sin hora de terceros, protocolo por el `pathname`, estados del audio, bienvenida y sueño; ADR 0031–0036). `docs/specs/README.md`: notas de la 0011 con los estados del audio que pinta (`status`, `loading`, `introLocked`, `canVisualize`; el error visible = `error` y sin `loading`; «Sleep mode» deshabilitado durante la bienvenida) y K83 pendiente de asignar. `docs/known-issues.md`: repaso de todas las filas de la spec en «corregido (spec 0007)».
- Archivos: `SPEC.md`, `docs/specs/README.md`, `docs/known-issues.md`.
- Test: — (documentación).
- Verificación: `npm run check`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR
- ADR 0035 (3.1): temporizador de sueño (hora límite; deshabilitado durante la bienvenida).
- ADR 0036 (3.3): volumen por capacidad y detección de iOS en el núcleo (enmienda D8 y A12; decisión del usuario, 2026-10-22).
- K83 sigue «pendiente»: queda en «Bloqueos» de `docs/status.md` para que el usuario lo asigne (no es de esta spec).

## Verificación de la fase
`npm run check` en cada tarea. Al cerrar (`close-phase`, última fase: cierra la spec y deja el PR #41 listo): e2e completos con `env:start:min` y `env:start:latest` (con `caffeinate -dims`), `npm run check:zip`, cobertura del núcleo y de los hooks, tabla del gzip frente a `origin/trunk`, `git diff --exit-code player/dist blocks/*/build`, `gh pr checks`.
