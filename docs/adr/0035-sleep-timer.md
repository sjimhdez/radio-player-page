# ADR 0035 — Temporizador de sueño

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0007 (fase 3; se escribe en la tarea 3.1 y se aplica en la 3.1 y la 3.2)

## Contexto

La fase 3 de la spec 0007 corrige dos rarezas del temporizador de sueño (`docs/known-issues.md` K65 y K66). Lo leído al planificar ([`phase-3.md`](../specs/0007-playback-fixes/phase-3.md)):

- **K66.** `createSleepTimer()` (`player/src/core/sleep/sleep-timer.ts`, spec 0006) resta un segundo por cada *tick* de un intervalo de 1 s, pase el tiempo que pase. Si los temporizadores se retrasan o se suspenden (pestaña en segundo plano, pantalla bloqueada), la cuenta atrás se alarga sin límite y la pausa llega tarde. El `Clock` inyectado ya tiene `now()`.
- **K65.** Durante la bienvenida el estado es `playing` con `introLocked`, así que se puede poner el temporizador; al terminar la bienvenida el navegador dispara `pause` antes de `ended`, el estado pasa por `paused` y la regla «cualquier pausa cancela» (`setPlaying(false)`) lo borra sin avisar. D6 de la spec (usuario, 2026-10-21): «Sleep mode» deshabilitado mientras suena la bienvenida.

`SPEC.md` §3.8 solo decía «30, 60 o 120 minutos con cuenta atrás; al llegar a cero pausa; se cancela si se pausa a mano».

## Decisión

1. **La cuenta atrás va contra una hora límite (K66).** `start(seconds)` guarda `deadline = clock.now() + seconds * 1000`. Cada *tick* calcula los segundos que quedan con `Math.round((deadline - clock.now()) / 1000)` (al segundo más cercano: la deriva del intervalo ni salta ni repite un segundo) y, si son ≤ 0, llama a `onEnd` una vez y vuelve a `null`. Cuando vuelve el primer suscriptor, la instantánea se pone al día con la hora límite (y, si ya pasó, termina). El intervalo de 1 s sigue siendo solo el ritmo de refresco; la referencia de `getSnapshot()` es estable entre *ticks* y el intervalo se para sin suscriptores, como antes.
2. **«Sleep mode» deshabilitado durante la bienvenida (K65, D6; se aplica en la tarea 3.2).** `Dashboard` pasa a `SleepMode` `isPlaying = status === 'playing' && !introLocked`. La regla del núcleo no cambia: cualquier `setPlaying(false)` cancela. Como el temporizador no se puede poner durante la bienvenida, su paso al directo nunca encuentra uno activo.

## Consecuencias

- Con la página suspendida, el primer *tick* al volver muestra el tiempo real que queda o pausa si ya se pasó la hora. Que iOS con la pantalla bloqueada no dispare ningún *tick* hasta desbloquear sigue siendo posible: la pausa llega entonces en el primer *tick*, no antes (verificación manual pendiente en `docs/status.md`).
- Cambiar la hora del sistema durante la cuenta atrás la adelanta o la retrasa (se usa `Date.now()`, no un reloj monótono); se acepta, el temporizador es de minutos.
- `vi.useFakeTimers()` y `page.clock` falsean `Date.now()`, así que los tests de cuenta atrás y `tests/e2e/sleep.spec.ts` siguen siendo deterministas sin cambios.
- Tests: `player/src/core/sleep/sleep-timer.test.ts` («counts against a deadline when the ticks are held back (K66)», «ends on the first tick past the deadline (K66)», «catches up with the deadline when the first subscriber comes back (K66)»), `player/src/hooks/use-sleep-timer.test.tsx` y `player/src/components/dashboard/SleepMode.test.tsx` (el primero de esos nombres). Los de K65, en la tarea 3.2.

## Alternativas descartadas

- **Un `setTimeout` hasta la hora límite** en vez del intervalo: sigue sujeto a la suspensión y no da la cuenta atrás visible.
- **`performance.now()`** (monótono): el `Clock` del núcleo expone `now()` con `Date.now()` y los *fakes* de los tests lo mueven; cambiarlo no aporta para un temporizador de minutos.
- **Que el paso de la bienvenida al directo no cuente como pausa** (en el núcleo o en la máquina de estados): obliga a distinguir ese `pause` del de quien escucha en otra capa; deshabilitar el botón lo evita y es lo que pidió el usuario.
