# ADR 0032 — Play tras una pausa recarga el directo; `dashjs` sin fuente de hora de terceros

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0007 (fase 1, tareas 1.1 y 1.3)

## Contexto

**C7 y K12.** Desde la 3.4.2, Play tras una pausa «reanuda» si `audio.src` coincide con la URL del stream y no hubo error (rama `resume` de `startPlay()` en `player/src/core/audio/audio-controller.ts`, heredada del hook de la 3.4.2). Con un MP3 infinito no hay petición nueva: la conexión sigue llenando el buffer y la posición sigue desde donde se pausó, cada vez más lejos del directo (medido en Chromium y WebKitGTK, `docs/known-issues.md` C7). Con `hls.js` y `dashjs`, `audio.src` es un `blob:` y la comparación nunca coincide, así que cada reanudación destruye y recrea el reproductor y vuelve al borde en vivo, pero por accidente (K12). El mismo botón hacía cosas distintas según el protocolo. K18 («se congela en Safari») resultó ser del *fixture* e2e (spike de la 0007, R3) y se corrigió allí (tarea 1.2).

**K67.** Con un directo DASH sin `<UTCTiming>`, `dashjs` pedía la hora a `https://time.akamai.com/?iso&ms`: una petición a un tercero con la IP del oyente, contra `SPEC.md` §2 y las guidelines de WordPress.org. La tarea 1.1 la quitó (`clearDefaultUTCTimingSources()` justo después de `initialize()`; el error no fatal 16, `TIME_SYNC_FAILED`, no llega al reproductor). No cambia el contrato, lo cumple; pero tiene una consecuencia medida que hay que dejar escrita (spec 0007, riesgo 3).

## Decisión

1. **Play tras una pausa recarga el directo** en todos los protocolos (MP3/OGG, HLS nativo, `hls.js`, `dashjs`): el controlador destruye la fuente y la vuelve a crear con la URL, como en la primera reproducción. Ya no se compara `audio.src` con la URL (K12): el controlador guarda la URL del directo que cargó.
2. Si ese mismo directo ya suena (`status === 'playing'` y el elemento no está en pausa), `play()` no hace nada. Tras una pausa, un error o un cambio de emisora, recarga.
3. La bienvenida no cambia: no se puede pausar y, si algo externo la pausa, sigue como hoy (K63, fase 2).
4. **K67:** sin fuente de hora por defecto en `dashjs`. Se conserva `useManifestDateHeaderTimeSource`: si la emisora expone la cabecera `Date` por CORS, corrige el reloj; si no, `dashjs` usa el reloj del cliente.

## Consecuencias

- Pausa + Play vuelve siempre al directo, que es lo que espera quien escucha una radio. Se pierde la «pausa en diferido» que daba el buffer del MP3 (nunca fue contrato y crecía sin límite mientras la conexión seguía abierta).
- Cada Play tras una pausa abre una conexión nueva al stream (en WebKit, dos peticiones por carga) y repite la espera inicial del buffer. Con un MP3 tipo Icecast es lo normal al pulsar Play.
- El Play de la Media Session usa el mismo `play()`, así que también recarga; los e2e de Media Session, del temporizador de sueño y de la bienvenida siguen en verde. El e2e de la bienvenida (`intro.spec.ts`) fijaba la reanudación: ahora espera dos `loadstart live`.
- **K67, reloj del cliente:** con el reloj bien, el directo DASH arranca a unos 6 s del borde, como con Akamai. Con el reloj desfasado y sin `Date` expuesta, el desfase pasa al arranque (medido: −20 s → 26 s del borde). Se acepta: la alternativa es pedir la hora a un tercero.
- Lo protegen: `audio-controller.test.ts` y `use-audio-player.test.tsx` («reloads the live stream on play() after a pause (C7)», «recreates hls.js to return to the live edge (C7)», «recreates dashjs to return to the live edge after a pause (C7)»), `tests/e2e/mp3.spec.ts` («reloads the live MP3 after Pause and Play (C7)», Chromium y WebKit), y para K67 `dash.test.ts` y `hls-dash.spec.ts`.
- `SPEC.md` §3.8 describe los dos comportamientos.

## Alternativas descartadas

- **Reanudar y saltar al final del buffer (`currentTime = buffered.end`):** WebKitGTK no informa de rangos en `buffered` con un directo, y con un MP3 infinito el buffer no es el directo, solo lo descargado.
- **Reanudar si la pausa fue corta y recargar si fue larga:** un umbral arbitrario y dos comportamientos que probar, para ahorrar una reconexión.
- **Mantener K12 tal cual en HLS y DASH:** recargaba por un accidente de la comparación con un `blob:`; ahora es la misma regla para todos.
- **K67 con una fuente de hora propia (un endpoint del sitio):** añade una petición al servidor de WordPress en cada directo DASH para corregir un caso (reloj desfasado y sin `Date`) que solo mueve el arranque unos segundos.

Evidencia: `docs/specs/0007-playback-fixes/phase-1.md` (tareas 1.1 y 1.3), informe del spike `docs/spikes/0007-phase-0.md` (R2 y R3).
