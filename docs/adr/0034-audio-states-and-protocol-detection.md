# ADR 0034 — Estados del audio y detección del protocolo

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0007 (fase 2; se escribe en la tarea 2.1 y se aplica en la 2.1–2.6)

## Contexto

La fase 2 de la spec 0007 corrige los estados del audio (`docs/known-issues.md` C2, K1, K11, K63, K64 y K81). Lo leído al planificar ([`phase-2.md`](../specs/0007-playback-fixes/phase-2.md)):

- **C2.** `detectProtocol()` (`player/src/core/audio/protocol.ts`) mira el sufijo de la URL entera y distingue mayúsculas: `…/live.m3u8?token=x` o `…/LIVE.MPD` se tratan como audio directo y no suenan. `SPEC.md` §3.8 decía «por la extensión de la URL», sin precisar. El núcleo no tiene `window.location` (ADR 0029), así que una URL relativa (`/live.m3u8`) no se puede resolver contra la página.
- **K11 y K81.** `live-started` pone `playing` en cuanto el controlador engancha la fuente, antes de `MANIFEST_PARSED` o del *autoplay* de `dashjs`, y el `finally` de la carga limpia `loading`. Una pausa durante la carga solo pausa el elemento: `MANIFEST_PARSED` vuelve a llamar a `audio.play()` (K11), y con el MP3 el `AbortError` del `play()` pendiente llega como error (K81). `pendingPlay` (K80, ADR 0029 D7) devolvería esa promesa vieja al Play siguiente.
- **K63.** `introLocked` y `activeSource: 'intro'` solo cambian con `live-started`. Si el directo falla tras la bienvenida, si algo externo la pausa o si le da `error` a mitad, el reproductor queda bloqueado hasta recargar. Al terminar, el navegador dispara `pause` (con `audio.ended` verdadero) antes de `ended`.

D3, D4 y D5 de la spec 0007 lo resolvían en el diseño. El usuario cambió D5 el 2026-10-22: un `error` a mitad de la bienvenida no se muestra, pasa al directo.

## Decisión

1. **Protocolo por el sufijo del `pathname` (C2).** `detectProtocol()` analiza la URL con `new URL(url, 'http://base.invalid')` (una base ficticia, para las relativas), toma el `pathname` en minúsculas y mira si termina en `.m3u8` (HLS) o `.mpd` (DASH). La *query string* y el fragmento no cuentan. Una URL que `new URL` no puede analizar es audio directo, sin lanzar.
2. **Una pausa durante la carga la cancela (D3; K11, K81).** El controlador lleva un contador de generación: `pause()` lo incrementa, suelta `pendingPlay` y, si hay una carga en curso, destruye la fuente. Lo que llegue de un intento viejo (su resolución, su rechazo con `AbortError`, los avisos de su fuente) no se despacha. `hls.ts` no llama a `play()` en un `MANIFEST_PARSED` tras `destroy()`; `dash.ts` hace `reset()`, que corta el *autoplay*. El Play siguiente recarga (ADR 0032).
3. **`playing` sale del evento del elemento (D4; K11).** `live-started` deja de tocar `status`: solo pone `activeSource: 'live'` e `introLocked: false`. `loading` sigue en `true` hasta el evento `playing` del elemento; una carga que sale bien no lo limpia en el `finally`, solo un fallo.
4. **La bienvenida no bloquea el reproductor (D5, con la decisión del usuario; K63).**
   - Si falla al arrancar, o le da `error` mientras suena, pasa al directo **sin mostrar error**, una sola vez (como si terminara; `SPEC.md` §3.8).
   - Si algo externo la pausa (`pause` con `!audio.ended`), se da por consumida, `introLocked` queda libre, el estado es `paused` y Play carga el directo.
   - El `pause` que precede a `ended` no libera nada: el `ended` pasa al directo.
   - Si falla el directo tras la bienvenida (o fallan los dos), queda `error` con `introLocked` libre y Play carga el directo.
5. **Un `pause` no pisa `error` (K1)** y **`pause()` limpia `loading` (K64)**: son correcciones del contrato existente («errores: un mensaje», «pausa»), sin decisión nueva; se citan aquí para que el ADR recoja todos los estados de la fase.

## Consecuencias

- Las emisoras con *token* en la URL (`…/live.m3u8?token=x`) o la extensión en mayúsculas suenan con `hls.js`/`dashjs`. Una URL sin extensión que sirva HLS por una *query* (`…/stream?format=.m3u8`) pasa a ser directa (antes era HLS por accidente, porque contaba la *query*; test `detects https://radio.test/stream?format=.m3u8 …`).
- La base ficticia no se pide nunca: solo sirve para analizar; la URL que carga el elemento es la original.
- Con HLS y DASH la UI muestra la carga hasta que suena de verdad, y Pausa durante la carga se respeta en todos los protocolos, sin alerta. El riesgo 5 de la spec (K80) lo vigila `keeps a single hls.js alive after a second play() while it loads (K80)`, en el núcleo y en el hook.
- Cambio visible respecto a la spec 0007 tal como se escribió: un `error` a mitad de la bienvenida ya no deja `error` con Play, pasa al directo. D5 y A9 de la spec se corrigen en este commit.
- Tests: `player/src/core/audio/protocol.test.ts` y `player/src/hooks/use-audio-player.test.tsx` («detects %s … by the suffix of its pathname (C2)», la URL que no se puede analizar); el resto, los de las tareas 2.2–2.6 del plan.

## Alternativas descartadas

- **Expresión regular sobre la URL entera** (`/\.m3u8(\?|#|$)/i`): no distingue el `pathname` de una *query* que contenga `.m3u8`, y repite a mano lo que hace `URL`.
- **Resolver contra `window.location`:** el núcleo no lee globales del navegador (ADR 0029); el resultado sería el mismo para el sufijo.
- **Mostrar el error de la bienvenida a mitad** (D5 original): quien escucha pierde el directo por un audio accesorio; el usuario prefirió el mismo trato que un fallo al arrancar.
- **Seguir esperando a `live-started` para `playing`** y solo arreglar la pausa: la UI seguiría diciendo «reproduciendo» mientras carga.

Evidencia: plan de la [fase 2](../specs/0007-playback-fixes/phase-2.md) (Contexto y tareas 2.1–2.6).
