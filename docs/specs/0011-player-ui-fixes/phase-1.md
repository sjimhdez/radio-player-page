# Spec 0011 · Fase 1 — Foco, estado y error
Estado: cerrada (2026-10-24) · Inicio: 2026-10-24 · ADRs: 0023, 0029, 0030, 0033, 0034, 0035, 0051 (nuevo)

## Contexto

- **K56/AX6/K59 van juntos:** `PlayerControls.tsx` devuelve un `CircularProgress` suelto con `loading` (desmonta el botón) y tres ramas con dos `IconButton` distintos. El `currently` de AX6/K59 (`player-a11y.spec.ts:54`) busca `getByRole('progressbar')` y comprueba que no hay región viva: en cuanto el *spinner* va dentro del botón con `aria-hidden` cae, así que K56, AX6 y K59 se corrigen en una sola tarea (1.3) para no romper un `currently` a medias.
- **Bienvenida:** `intro.spec.ts:94` usa `toBeDisabled()`, que en Playwright también acepta `aria-disabled="true"`; se comprueba en 1.3 sin editar el test. `sleep.spec.ts:143` lee el `disabled` nativo de «Sleep mode», que no cambia.
- **mp3.spec.ts** (excepción §4.6, ampliada, aprobada por el usuario el 2026-10-24): las líneas 132 y 250–254 (la 252–254 exige que no haya botón Play/Pause durante `waiting` en Chromium), y también 243–249, la rama de WebKit del mismo `currently` de C8 (de «Pause» visible a «Pause» con `aria-busy="false"`; aprobada por el usuario en el cierre, 2026-10-24). Pasan a localizar la carga por el botón «Pause» con `aria-busy="true"`: el botón estable lleva `aria-busy` mientras `loading`.
- **Línea base (ADR 0023):** el usuario aprueba (2026-10-24) las dos altas de 1.1 en los dos proyectos: `aria-progressbar-name` en `player · loading` y `heading-order` del `h5` en `player · all-programs modal expanded`. El escenario expandido va en la página con programas (la del `currently` de AX2, `urls.always`) y espera a que termine el `Collapse` (riesgo 7). En el cierre (2026-10-24) el usuario aprueba también las seis `region` de AX1 en `player · loading` (`.MuiPaper-root`, `.MuiTypography-h4`, `.css-*`, `canvas`, `h1`, `input`): los mismos nodos que en `stopped` y `playing`; salen con la maqueta de la fase 3.
- **K83:** en `audio-controller.ts`, `onAudioEvent` despacha el `error` del elemento del primer intento (con `crossOrigin`) antes de que `play()` se rechace y `createDirectSource` reintente. El arranque de la bienvenida ya hace lo mismo que se propone (`introStarting`: el `error` lo resuelve el `catch` de su `play()`). Arreglo: mientras `source.start()` del directo está pendiente, el `error` del elemento se aplaza (si `start()` se rechaza, `play-failed` ya pone `error`; si se resuelve, se descarta), y también la `pause` que Chromium dispara tras ese error (K1). `canplay` en `idle` sigue limpiando `loading` (caracterizado): la secuencia es `idle/loading → idle → playing`, **nunca `error`** (precisión de §2 aprobada por el usuario el 2026-10-24). ADR 0030 no cambia.
- **Riesgo 3:** si al devolver el foco por teclado MUI abre el *tooltip*, se acepta (decisión del usuario, 2026-10-24); los e2e solo comprueban el foco.
- **K58:** React 19 acepta `ref` como prop; `SleepMode` y `PlayerControls` reciben un `ref` al `IconButton`. `SleepMode` sigue `disabled` nativo cuando no suena, así que al llegar a cero el foco va a Play/Pausa.

## Objetivo

El botón de Play/Pausa no se desmonta nunca y conserva el foco; la carga se anuncia en una región `role="status"` y ninguna `progressbar` queda sin nombre; el núcleo no publica `error` durante el reintento de C1; los modales y el temporizador devuelven el foco. ADR 0051 y `SPEC.md` §3.8 al día.

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| Escenarios `player · loading` y `player · all-programs modal expanded` con sus violaciones de hoy en la línea base | `a11y.spec.ts` (nuevos), baseline regenerada en Chromium y WebKit; diff = dos altas. Resultado: las dos altas, más las `region` de AX1 en `player · loading` (seis, y la del *tooltip* de la 1.3), aprobadas por el usuario |
| ADR 0051 aceptado y §3.8 «Interfaz accesible» antes de K56 | revisión del commit 1.2 |
| K56: el foco sigue en el botón tras Play con Enter y cuando sale Pausa; mismo nodo en `idle` → `loading` → `playing`; con la bienvenida `aria-disabled` y foco conservado | `player-a11y.spec.ts` (regresión de K56); `components/dashboard/PlayerControls.test.tsx` (nuevo); `intro.spec.ts` sin cambios |
| AX6 + K59: ninguna `progressbar` sin nombre; «Connecting...» en `role="status"` montado siempre | regresión de AX6/K59 en `player-a11y.spec.ts`; `a11y.spec.ts` `player · loading` sin `aria-progressbar-name` (sale de la línea base) |
| K83: nunca `{ status: 'error', loading: false }` (ni `error`) durante el reintento de C1 | regresión en `audio-controller.test.ts` (también el `error` del elemento durante el `start()` de `hls.js` y `dashjs`, añadido en el cierre); `cross-origin.spec.ts` (C1, K1) en Chromium y WebKit |
| K57: el foco vuelve al botón que abrió el modal (Escape y «Close») | regresión de los dos `currently` de K57 + caso «Close» |
| K58: cancelar → foco en «Sleep mode»; cuenta a cero con el foco en el temporizador → Play/Pausa | regresión de K58 en `player-a11y.spec.ts` + caso nuevo de la cuenta a cero en `sleep.spec.ts` (con su `tick()`, ver 1.6) |
| `npm run check` y e2e del player en las dos puntas, Chromium y WebKit | `close-phase` |

## Tareas

### 1.1 Escenarios de axe de carga y programa expandido (≤ 1 h)
- Qué: en `a11y.spec.ts` (`a11y: player`), `loading` (stream retenido con `page.route`, como el `currently` de AX6; esperar el *spinner*) y `all-programs modal expanded` (primer «Show more», esperar el fin del `Collapse`). Regenerar la línea base con `RADPLAPAG_UPDATE_A11Y_BASELINE=1` en los dos proyectos; el diff solo añade las dos entradas aprobadas.
- Archivos: `tests/e2e/a11y.spec.ts`, `tests/e2e/a11y-baseline.json`
- Test: caracterización: `tests/e2e/a11y.spec.ts`
- Verificación: `npm run test:e2e -- tests/e2e/a11y.spec.ts -g "a11y: player"`
- Nota: `player · loading` añade también las ocho entradas `region` de AX1 que ya tienen `stopped` y `playing` (mismos nodos más el *spinner*); salen con la maqueta de la fase 3.
- [x] hecha · commit: `382920b` («test(0011): add loading and expanded program axe scenarios (1.1)»)

### 1.2 ADR 0051 y `SPEC.md` §3.8 «Interfaz accesible» (≤ 1 h)
- Qué: `write-adr` 0051 (botón estable con *spinner* dentro y `aria-busy`, `aria-disabled` en la bienvenida, región `role="status"`, foco devuelto en modales y temporizador, maqueta en flujo con *landmarks*, sin animaciones infinitas salvo los puntos y ninguna con `prefers-reduced-motion`, «Show more» solo con descripción extendida); línea «Interfaz accesible» en §3.8 con nota de que fase 3 aún no está; fila en la tabla de cambios de `SPEC.md`; índice de ADRs.
- Archivos: `docs/adr/0051-*.md`, `docs/adr/README.md`, `SPEC.md`
- Test: —
- Verificación: `npm run check`
- [x] hecha · commit: `6fa1696` («docs(0011): add ADR 0051 and the accessible interface to SPEC.md (1.2)»)

### 1.3 K56 + AX6 + K59: botón estable y región de estado (≤ 1 h)
- Qué (`fix-bug`): los `currently` de K56 y de AX6/K59 pasan a regresión (rojo); `PlayerControls.test.tsx` nuevo (TDD: mismo nodo `idle` → `loading` → `playing`, nombre Play/Pause, `aria-busy`, `aria-disabled` con `disabled` y clic ignorado). `PlayerControls`: un solo `IconButton`; Play en `idle`/`paused`/`error`, Pausa en `playing` o `loading` (con `loading`, `CircularProgress size` equivalente con `aria-hidden`); `aria-busy={loading}`; `aria-disabled` en vez de `disabled`; *tooltip* sigue al nombre. `StreamInfo`: `role="status"` montado siempre con «Connecting...» si `loading && !isPlaying` (la animación `blink` se queda hasta la fase 3). mp3.spec 132 y 250–254 (excepción aprobada). Baseline: quitar `player · loading · aria-progressbar-name`. Filas K56, AX6, K59 → «corregido (spec 0011)». Fila AX2: ya no decir que el escenario de axe no expande nada (desde la 1.1, `player · all-programs modal expanded · heading-order · h5` está en la línea base; decisión del usuario, 2026-10-24).
- Archivos: `player/src/components/dashboard/PlayerControls.tsx`, `PlayerControls.test.tsx`, `StreamInfo.tsx`, `tests/e2e/player-a11y.spec.ts`, `tests/e2e/mp3.spec.ts`, `tests/e2e/a11y-baseline.json`, `docs/known-issues.md`
- Test: primero: `PlayerControls.test.tsx` + regresiones e2e
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/player-a11y.spec.ts tests/e2e/mp3.spec.ts tests/e2e/intro.spec.ts tests/e2e/a11y.spec.ts`
- Rojo: `PlayerControls.test.tsx` 4/7 en rojo (`Unable to find … "button" and name "Pause"` con `loading`; `aria-busy` y `aria-disabled` a `null`); e2e en Chromium: K56 `Expected: "BUTTON:Pause"`, `Received: "BODY"`; AX6/K59 `getByRole('status')` `Expected: 1`, `Received: 0`.
- Hecho: `a11y.spec.ts` (`player · loading`) espera a que la carga salga en el botón (`aria-busy`) en lugar de la `progressbar`, y al *tooltip* de Pausa, que ahora sigue abierto bajo el ratón. Línea base: salen `aria-progressbar-name` y las `region` del *spinner* y del `h5` de «Connecting...»; entra `player · loading · region · #_r_*_` (el *tooltip*, AX1, como en `playing`; alta aprobada por el usuario el 2026-10-24: sin esperarlo, el escenario dependía del momento). El aspecto deshabilitado del botón con la bienvenida se conserva con `color: action.disabled` sobre `[aria-disabled="true"]`; la región `status` vacía devuelve el `gap` del `Stack` (`margin-top` negativo) para que el título no se mueva. `intro.spec.ts` pasa sin cambios.
- Changelog: «Play/Pause keeps the keyboard focus while the stream loads; "Connecting..." is announced to screen readers.»
- [x] hecha · commit: `1c1bad2` («fix(0011): keep one Play/Pause button and announce loading in a status region (1.3)»)

### 1.4 K83: sin `error` durante el reintento de C1 (≤ 1 h)
- Qué (`fix-bug`): el `currently` de K83 pasa a regresión (mismos eventos: `error`, `canplay`; esperado `[{idle,true},{idle,false},{playing,false}]`), más un caso de fallo doble (404) que termina en `{error,false}` y otro con la `pause` de Chromium tras el `error`. En `audio-controller.ts`: bandera mientras `source.start()` del directo está pendiente en `playLive`; el `error` del elemento (y la `pause` que lo sigue) se aplazan y se descartan al resolverse; el rechazo ya despacha `play-failed`. Fila K83 → «corregido».
- Archivos: `player/src/core/audio/audio-controller.ts`, `audio-controller.test.ts`, `docs/known-issues.md`
- Test: primero: `audio-controller.test.ts`
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/cross-origin.spec.ts tests/e2e/mp3.spec.ts`
- Rojo: 2/3 en rojo. Sin `pause`: `toMatchObject` tras el `canplay`, `Expected: "idle"`, `Received: "error"`; con la `pause` de Chromium: la secuencia publicada lleva `{error,true}` y `{error,false}` entre `{idle,true}` y `{playing,false}`. El caso del 404 ya pasaba (fija que el fallo doble sigue en `{error,false}`).
- Hecho: banderas `liveStarting` y `errorDeferred` en el controlador; `pause()` las limpia y `playLive` solo lo hace si su generación sigue vigente. Afecta a toda fuente del directo, no solo a la directa: con `hls.js`/`dashjs` el `error` del elemento durante el `start()` también lo decide su resultado (el fatal de la librería sigue llegando por `stream-error`). e2e de `cross-origin.spec.ts` y `mp3.spec.ts` en verde en Chromium y WebKit (33 pasan, 3 omitidos por proyecto). Sin cambio visible: no hay nota de changelog.
- [x] hecha · commit: `e5c1546` («fix(0011): publish no error while the C1 retry loads (1.4)»)

### 1.5 K57: los modales devuelven el foco (≤ 1 h)
- Qué (`fix-bug`): los dos `currently` de K57 pasan a regresión (foco en el botón que abrió el modal) y se añade el cierre con «Close»; quitar `disableRestoreFocus` de los dos `Dialog`. Fila K57 → «corregido».
- Archivos: `player/src/components/dashboard/ScheduleModal.tsx`, `AllProgramsModal.tsx`, `tests/e2e/player-a11y.spec.ts`, `docs/known-issues.md`
- Test: primero: regresión e2e
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/player-a11y.spec.ts tests/e2e/modals.spec.ts`
- Rojo: los 8 casos (2 modales × Escape/«Close» × Chromium/WebKit) con `Expected: "BUTTON:Radio Schedule"` / `"BUTTON:Radio Shows"`, `Received: "BODY"`.
- Hecho: quitado `disableRestoreFocus` de los dos `Dialog`; `player-a11y.spec.ts` y `modals.spec.ts` 34/34, `a11y.spec.ts` 36/36 sin cambios en la línea base. Changelog: al cerrar los modales del horario y de programas el foco vuelve al botón que los abrió.
- [x] hecha · commit: `bd3b979` («fix(0011): give the focus back when the schedule and programs modals close (1.5)»)

### 1.6 K58: foco al cancelar o terminar el temporizador (≤ 1 h)
- Qué (`fix-bug`): el `currently` de K58 pasa a regresión (foco en «Sleep mode») y caso nuevo con `page.clock`: con el foco en «Cancel sleep mode», la cuenta llega a cero y el foco va a Play. `Dashboard` guarda `ref` a «Sleep mode» y a Play/Pausa (`ref` como prop, React 19); `onCancel` enfoca «Sleep mode»; al terminar (envolviendo el `onEnd` de `useSleepTimer`), si `document.activeElement` estaba dentro de `SleepTimer`, enfoca Play/Pausa. Fila K58 → «corregido».
- Archivos: `player/src/components/dashboard/index.tsx`, `SleepMode.tsx`, `SleepTimer.tsx`, `PlayerControls.tsx`, `tests/e2e/player-a11y.spec.ts`, `docs/known-issues.md`
- Test: primero: regresión e2e (+ `SleepMode.test.tsx` si el `ref` se expone)
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/player-a11y.spec.ts tests/e2e/sleep.spec.ts`
- Rojo: los 4 casos (cancelar y llegar a cero × Chromium/WebKit): el foco en `body` (`Received: "BODY"` / `Received: null`).
- Hecho: `ref` como prop en `PlayerControls`, `SleepMode` y `SleepTimer`; `Dashboard` enfoca «Sleep mode» al cancelar y, si el foco estaba en `SleepTimer` al terminar la cuenta, Play/Pausa. El caso de la cuenta a cero va en `sleep.spec.ts`, no en `player-a11y.spec.ts`, para reutilizar `tick()` y su *timeout* (1800 *ticks*). Sin `SleepMode.test.tsx`: el `ref` se cubre con el e2e. `player-a11y.spec.ts` y `sleep.spec.ts` 32/32. Changelog: al cancelar el temporizador de sueño, o al acabar con el foco en él, el foco ya no se pierde.
- [x] hecha · commit: `865f257` («fix(0011): keep the focus when the sleep timer is cancelled or runs out (1.6)»)

## Decisiones abiertas → ADR
- ADR 0051 (1.2). Ninguna otra: K83 no cambia el ADR 0030.

## Para el cierre de la fase
- [x] Hecho en el cierre. `.claude/rules/player.md` (excepción de `useAudioPlayer()`) y la revisión del ADR 0030 dan como motivo de `useState` el `error` intermedio de C1, que la 1.4 eliminó. Reescribir el motivo: el original (K83) se corrigió en la 0011; `useState` + `subscribe()` se mantiene por decisión del usuario, y volver a `useSyncExternalStore` necesitaría su propia medición (decisión del usuario, 2026-10-24).

## Cierre (2026-10-24)
- Verificación: `npm run check` en verde; integración y e2e en WP 6.6 + PHP 7.4 (PHPUnit 1029 OK; e2e 275 pasan, 33 omitidos) y en la última WP + PHP 8.4 (PHPUnit 1029 OK; e2e 275 pasan, 33 omitidos); builds sin diff; zip OK.
- Revisor: `spec-conformance-reviewer` (elección del usuario). Arreglado en el cierre: aprobaciones de la línea base y de `mp3.spec.ts` apuntadas; tests de K83 con `hls.js` y `dashjs` (el aplazamiento cubre toda fuente del directo, decisión del usuario; mutación: en rojo sin él); regresiones de K83 fuera del `describe` de los `currently`; §2 y §4.2 de la spec al día; motivo del ADR 0030 revisado.
- Changelog (para la nota de release de la 0011, fase 3): 1.3, 1.5 y 1.6 (ver sus «Changelog»).
