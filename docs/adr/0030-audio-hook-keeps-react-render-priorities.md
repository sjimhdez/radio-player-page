# ADR 0030 — `useAudioPlayer()` lee el controlador con `useState` y una suscripción, no con `useSyncExternalStore`

- Estado: aceptado · Fecha: 2026-10-21 · Spec: 0006 (fase 2) · Enmienda D2 del [ADR 0029](0029-player-core-without-react.md) solo para `useAudioPlayer()`

## Contexto
En la 2.8, `useAudioPlayer()` pasó a ser un adaptador del controlador del audio con `useSyncExternalStore` (ADR 0029, D2). En la 2.9 se midió una regresión: en Chromium fallan dos e2e de caracterización porque la alerta «Unable to play the stream» aparece un instante. Son `cross-origin.spec.ts` (`currently does not play an MP3 without CORS, with no error shown in Chromium (C1, K1)`) e `intro.spec.ts` (`falls through to the live stream without an error when the welcome audio is broken`). Con el `dist/` de la 2.7 pasan.

Medido con una sonda en Chromium (2.11). Con el MP3 sin CORS, el elemento dispara `error` y rechaza `play()` en una tarea, y `pause` en otra posterior (K1). Con la bienvenida rota, `error` y el rechazo llegan en una tarea, y el directo empieza después. La alerta se pinta entre las dos tareas.

La causa es la prioridad con la que React pinta:

- **Hasta la 2.7** (`useState`): un `setState` lanzado desde un evento nativo `error` tiene prioridad *default* y se pinta en una tarea del *scheduler*. El `pause` de Chromium llega antes que esa tarea, tiene prioridad discreta y se agrupa con ella, así que nunca se pinta `error`.
- **Con `useSyncExternalStore`**: toda actualización de la tienda es síncrona y se pinta en la microtarea siguiente al `error`, antes del `pause`.

Mientras K1 siga abierto (la 0007 lo corrige), el orden de los renders del audio es parte del comportamiento visible.

Se probaron dos arreglos del adaptador:

1. Conservar `useSyncExternalStore` y aplazar el aviso al suscriptor a una tarea `MessageChannel`, como el *scheduler*. Los e2e pasan, pero fallan 16 casos de caracterización de `use-audio-player.test.tsx`, que leen el estado justo después de `act()` y no se editan.
2. `useState` con una suscripción en un efecto. Los e2e pasan, y los 136 casos de hooks y componentes también.

## Decisión
- `useAudioPlayer()` guarda la instantánea del controlador en un `useState` (inicializado con `getSnapshot()`). Se suscribe en un `useEffect` con `controller.subscribe()`, y el `setState` va en el *callback* de la suscripción, nunca en el cuerpo del efecto. Así React vuelve a elegir la prioridad según el evento que causa el cambio, como hasta la 2.7.
- El resto de D2 no cambia: la transición pura, el controlador, `subscribe()`/`getSnapshot()`, la instantánea inmutable y la misma referencia mientras no cambie nada. Los demás hooks del núcleo (`config`, `clock`, `schedule` y los de la fase 3) siguen con `useSyncExternalStore`.
- La 0007 lo revisa al corregir K1. Si `pause` ya no pisa `error`, el orden de los renders deja de ser visible y el hook puede volver a `useSyncExternalStore`.

## Consecuencias
- Vuelve el render intermedio de `useState` + efecto: el primer render lee `getSnapshot()` y la suscripción empieza tras el commit. No se pierde ningún aviso, porque el controlador solo cambia con `play()`, `pause()`, `setVolume()` o los eventos del `<audio>`, y todos llegan después de los efectos (`attach` no publica nada).
- Lo protegen el test de regresión `does not render the error of a failing MP3 before the pause that follows it (K1)` de `use-audio-player.test.tsx` y los dos e2e de arriba en Chromium. El test está en rojo con `useSyncExternalStore` y en verde con el hook de la 2.7 y con el de este ADR.
- `react-hooks` no pide excepción: `set-state-in-effect` solo marca el `setState` síncrono en el cuerpo del efecto.
- La regla de `.claude/rules/player.md` y la spec 0006 (D2 y riesgo 1) nombran esta excepción.

## Alternativas descartadas
- **`useSyncExternalStore` con el aviso aplazado a una tarea (`MessageChannel` o `setTimeout`):** rompe 16 casos de caracterización (los tests no se editan) y copia el *scheduler* de React a mano. En la sonda, un `setTimeout` lanzado tras `error` corre antes que `pause`, así que tampoco sirve.
- **Aplazar en el controlador los avisos de los eventos del `<audio>`:** mete en el núcleo un detalle de React y retrasa todos los cambios, también los de los clics.
- **Que `pause` no pise `error` (corregir K1):** cambia algo visible y es de la 0007 (D7, decisión del usuario).
- **Aceptar el destello y editar los dos e2e:** son de caracterización y no se editan para que pasen.

Evidencia: [`phase-2.md`](../specs/0006-player-refactor/phase-2.md), tareas 2.9 (la regresión) y 2.11 (la sonda y las dos variantes).
