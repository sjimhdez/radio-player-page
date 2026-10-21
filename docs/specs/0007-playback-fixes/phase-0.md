# Spec 0007 · Fase 0 — Spike (R1 C1 y visualización, R2 K67, R3 K18)
Estado: en curso · Inicio: 2026-10-21 · ADRs: 0004, 0013, 0018, 0029, 0031

## Contexto
- La spec 0007 está en «propuesta», con su §0; la rama `spec/0007-playback-fixes` existe, sin push ni PR. Esta fase no toca código publicado: todo va en `spike/0007-playback/` (excluido por ESLint, `spike/**`, y fuera del zip por la lista de inclusión).
- Lo que hay hoy (lo leído): `core/audio/sources/direct.ts` pone `crossOrigin = 'anonymous'` tras `src`; `dash.ts` hace `initialize(audio, url, true)` sin tocar las fuentes de hora; `audio-controller.ts` tiene la rama `resume` (C7/K12); `use-can-visualize.tsx` decide al montar por *user agent*; `use-audio-visualizer.tsx` crea el `AudioContext` en un efecto al pasar a `playing` (fuera del gesto) y llama a `createMediaElementSource()` aunque el canvas esté oculto. Coincide con lo que dicen la spec y el ADR 0031: no hay nada falso que parar.
- `tests/e2e/media-server.mjs` ya da dos orígenes (con y sin CORS), `/live.mp3` infinito y un 404, pero no expone `Date` ni sirve un MPD dinámico; el spike lleva su servidor propio (puertos 8910–8912, para no chocar con el e2e, 8901–8902, ni con `spike/e2e`, 8900–8902) que sirve los *fixtures* de `tests/fixtures/audio/` sin copiarlos.
- `hls.js` y `dashjs` (5.2.1, con `clearDefaultUTCTimingSources()`) se sirven desde `player/node_modules/*/dist`: las mismas versiones que el player, sin instalar nada nuevo en él.
- Cómo se mide «suena» en Playwright, donde no se oye: el elemento avanza (`currentTime` sube, sin `error`) **y** o no pasa por Web Audio (la salida es la nativa) o pasa y el analizador da datos no planos (la salida es lo que ve el analizador; con un medio contaminado, ceros). En Safari real lo oye el usuario.
- Playwright WebKit en macOS no tiene HLS nativo (las e2e van por `hls.js`): el HLS nativo y el `AudioContext` suspendido de Safari/iOS solo se miden en Safari real, con una página manual.

## Objetivo
Responder R1, R2 y R3 de la spec con mediciones reproducibles y entregar en `docs/spikes/0007-phase-0.md` la propuesta de C1 y de la visualización (qué marca publica el controlador, en qué fuentes es visualizable, cuándo se crea o reanuda el `AudioContext`, cuándo sale error, si hace falta detección de analizador plano), para que el usuario la apruebe antes de la fase 1.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| R1: reintento sin `crossOrigin` (con y sin `createMediaElementSource()` previo), 404 vs sin CORS, datos del analizador con CORS por protocolo, `AudioContext` dentro/fuera del gesto | `spike/0007-playback/tests/r1-*.spec.ts` en Chromium y WebKit (macOS), resultados en el informe |
| R2: DASH en directo sin `<UTCTiming>` con `clearDefaultUTCTimingSources()` suena sin peticiones a terceros, con y sin `Date` expuesta | `spike/0007-playback/tests/r2-dash-time.spec.ts` (todas las peticiones fuera de `localhost` se registran y se abortan), Chromium y WebKit |
| R3: K18 hoy (reanudar) y con recarga del directo | `spike/0007-playback/tests/r3-resume.spec.ts` en WebKit macOS y Chromium; en Safari real, la página manual (checklist del usuario) |
| Safari real (macOS; iOS si se puede): K18, MP3 sin CORS suena con reintento, analizador con HLS nativo y MP3 con CORS, `AudioContext` fuera del gesto | Verificación manual del usuario con `manual.html`; resultado anotado en el informe (si no da tiempo, «Verificación manual pendiente» en `docs/status.md`, riesgo 7) |
| Propuesta de C1 y visualización aprobada | El usuario la aprueba al cerrar la fase |
| Nada sale a internet; el zip no cambia | Registro de peticiones de los tests del spike; `npm run check:zip` |

## Tareas

### 0.1 Andamiaje del spike (≤ 1 h)
- Qué: `spike/0007-playback/` con `package.json` (`@playwright/test` 1.64.1, como la raíz), `playwright.config.ts` (Chromium + WebKit, `webServer` = `server.mjs`), `server.mjs` (página :8910, medios con CORS :8911 y sin CORS :8912; `/live.mp3` infinito, `/404.mp3`, `/live.mpd` dinámico generado sin `<UTCTiming>`, `?exposeDate=1` añade `Access-Control-Expose-Headers: Date`; `/vendor/` sirve `hls.js` y `dashjs` de `player/node_modules`), `harness.html` + `harness.js` (un `<audio>` y funciones en `window` para cada medición: cargar fuente directa con/sin `crossOrigin`, reintento `removeAttribute` + `load()`, conectar analizador, leer RMS del analizador, `hls.js`, `dashjs`), `README.md` y fila en `spike/README.md`.
- Archivos: `spike/0007-playback/**`, `spike/README.md`.
- Test: humo `tests/smoke.spec.ts` (la página carga y un MP3 con CORS avanza).
- Verificación: `cd spike/0007-playback && npm install && npx playwright test tests/smoke.spec.ts && cd ../.. && npm run check:zip`
- Resultado: `spike/0007-playback/` con servidor (página :8910, medios :8911/:8912; `/live.mp3`, `/404.mp3`, `/live.mpd` dinámico sin `<UTCTiming>` que repite los segmentos del fixture con `tfdt` reescrito, `?exposeDate=1`, `/__requests`), `harness.html`/`harness.js` (`window.spike`: fuente directa con/sin `crossOrigin` y orden, `retryWithoutCors`, `reload`, analizador y RMS, `AudioContext`, `hls.js`, `dashjs` con/sin fuentes de hora, sonda `fetch`, gesto real con `armGesture` + `#gesture`) y `tests/helpers.ts` (aborta y registra lo que sale de `localhost`). Humo verde en Chromium y WebKit; cordura: `/live.mp3`, 404 (`error` 4 en los dos), `hls.js` y DASH en directo avanzan en los dos navegadores. `check:zip` y `npm run check` en verde.
- Nota: con `clearDefaultUTCTimingSources()` antes de `initialize()`, `dashjs` pidió igualmente `https://time.akamai.com/?iso&ms` (Chromium y WebKit, prueba de cordura del servidor): lo mide la 0.2.
- [x] hecha · commit: (este)

### 0.2 R2 — `dashjs` sin fuente de hora de terceros (≤ 1 h)
- Qué: directo DASH sin `<UTCTiming>` con y sin `clearDefaultUTCTimingSources()`, con y sin `Date` expuesta: ¿avanza?, ¿qué peticiones fuera de `localhost` hay (control: sin la llamada, la de Akamai)?, distancia al borde en vivo (`player.getCurrentLiveLatency()`), avisos de `dashjs`.
- Archivos: `spike/0007-playback/tests/r2-dash-time.spec.ts`.
- Test: el propio spec del spike.
- Verificación: `cd spike/0007-playback && npx playwright test tests/r2-dash-time.spec.ts`
- Resultado (20/20 en Chromium y WebKit; el servidor da ahora 404 a los segmentos aún no completos y el *harness* acepta `clearTimeSources: 'before' | 'after'`):
  - **D7 tal como está escrita no basta.** La primera llamada a `initialize()` ejecuta `restoreDefaultUTCTimingSources()` (`MediaPlayer.js`, dentro de `if (!mediaPlayerInitialized)`): con `clearDefaultUTCTimingSources()` **antes**, `dashjs` pide igualmente `https://time.akamai.com/?iso&ms` (dos veces con la `Date` oculta y una con ella expuesta). **Después** de `initialize()` (llamada síncrona; las fuentes se leen al llegar el MPD), ninguna petición fuera de `localhost`. `updateSettings({ streaming: { utcSynchronization: { enabled: false } } })` tampoco sale.
  - Todos los casos suenan (`playing` y +3 s en ~3,3 s); `dashjs` avisa de `NO_UTC_TIMING_ELEMENT` (`conformanceViolation`) en todos.
  - **Error 16.** Sin ninguna fuente de hora (limpieza tras `initialize()` y `Date` oculta) `dashjs` emite dos veces `error` con el código 16 (`TIME_SYNC_FAILED`, no fatal; a los ~70 ms y a los ~2 s) y sigue sonando con el reloj del dispositivo. `dash.ts` pasa todo `error` a `onError()`: con la corrección a secas, el reproductor marcaría error en un directo que suena. Con la `Date` expuesta, o con la sincronización desactivada, no hay error. Hoy en producción no se ve porque Akamai responde.
  - Distancia al borde real (reloj de Node), con el mismo reloj en cliente y servidor: ~6,1–6,3 s en todos (el `suggestedPresentationDelay` es de 6 s); con la `Date` expuesta, +0,6–0,8 s (la cabecera tiene resolución de 1 s).
  - Riesgo 3, con el reloj del cliente desfasado y la `Date` oculta: con −20 s arranca a 26 s del borde (`getCurrentLiveLatency()` dice 6 s: miente con el mismo reloj); con +20 s espera ~16 s a que los segmentos existan (11 peticiones del MPD, ningún 404) y arranca a 3,8 s del borde. Con la `Date` expuesta, la desviación se corrige (6,2–7,3 s, arranque normal). Con la sincronización desactivada, el comportamiento es igual que con la `Date` oculta.
  - Propuesta para la 0.6: `clearDefaultUTCTimingSources()` **después** de `initialize()`, conservando `useManifestDateHeaderTimeSource` (corrige el reloj si la emisora expone la `Date`), e ignorar en `dash.ts` el error 16 (o solo los errores no fatales). Cambia D7 y A1 de la spec (el test de `dash.test.ts` comprueba el orden contrario).
- [x] hecha · commit: (este)

### 0.3 R1a — MP3 sin CORS: reintento y Web Audio (≤ 1 h)
- Qué: en Chromium y WebKit, `/live.mp3` del origen sin CORS: (a) con `crossOrigin` falla (control C1); (b) reintento en el mismo elemento sin `crossOrigin` suena; (c) igual tras `createMediaElementSource()` sobre el elemento (bienvenida con visualizador): ¿avanza?, ¿analizador plano? (= silencio); (d) sin conectar Web Audio, suena; (e) 404 con y sin CORS frente a «sin CORS»: `MediaError.code`/`message`, tiempo hasta el error, y si una sonda `fetch` lo distingue. Mismo caso con el archivo finito `/tone.mp3`.
- Archivos: `spike/0007-playback/tests/r1-no-cors.spec.ts`.
- Test: el propio spec del spike.
- Verificación: `cd spike/0007-playback && npx playwright test tests/r1-no-cors.spec.ts`
- [ ] hecha · commit: —

### 0.4 R1b — Con CORS: datos del analizador y `AudioContext` (≤ 1 h)
- Qué: con CORS, ¿datos reales en el analizador con MP3 directo, `hls.js` y `dashjs` (Chromium y WebKit)? `AudioContext` creado fuera del gesto (como hoy, tras `playing`) frente a dentro del clic de Play, con y sin `--autoplay-policy=user-gesture-required` en Chromium: `state`, si `resume()` fuera del gesto lo arranca, si el audio desviado queda mudo (analizador plano con `currentTime` avanzando). Cuánto tarda el analizador en dar datos (base para una red de seguridad de «analizador plano N s»).
- Archivos: `spike/0007-playback/tests/r1-visualize.spec.ts`.
- Test: el propio spec del spike.
- Verificación: `cd spike/0007-playback && npx playwright test tests/r1-visualize.spec.ts`
- [ ] hecha · commit: —

### 0.5 R3 — K18: reanudar frente a recargar, y la página manual de Safari (≤ 1 h)
- Qué: `/live.mp3` con CORS, Pausa + Play reanudando (hoy) y recargando (`src` de nuevo + `load()` + `play()`): peticiones nuevas, `currentTime`, `buffered`, si se congela (WebKit macOS y Chromium). `manual.html`: página con botones y lecturas en vivo (estado, `currentTime`, RMS del analizador, `AudioContext.state`) y la checklist de Safari real: K18 reanudar/recargar, MP3 sin CORS con reintento (¿se oye?), MP3 con CORS y HLS nativo (`/hls/index.m3u8` en `audio.src`) con visualizador (¿se oye y se mueve?), `AudioContext` fuera del gesto. Instrucciones en el README para abrirla en macOS (`localhost:8910`) y en iOS (IP de la red local).
- Archivos: `spike/0007-playback/tests/r3-resume.spec.ts`, `spike/0007-playback/manual.html`, `README.md`.
- Test: el propio spec del spike.
- Verificación: `cd spike/0007-playback && npx playwright test tests/r3-resume.spec.ts && npx playwright test` (todo el spike, dos navegadores)
- [ ] hecha · commit: —
- **Bloqueo humano:** el usuario corre `manual.html` en Safari real y me da los resultados (o se aplaza a «Verificación manual pendiente», riesgo 7).

### 0.6 Informe y propuesta (≤ 1 h)
- Qué: `docs/spikes/0007-phase-0.md` (resumen por riesgo con evidencia, entorno y versiones, tablas de lo medido, propuesta de C1 y de la visualización para la fase 1: nombre de la marca en la instantánea, regla de visualizable por fuente, momento del `AudioContext`, cuándo error, reintento siempre una vez o solo si se distingue del 404, red de seguridad sí/no). Si lo medido cambia la spec (D1, D7, A1, A3, A3b, riesgos 1–3), la spec corregida en el mismo commit; `docs/status.md` al día.
- Archivos: `docs/spikes/0007-phase-0.md`, `docs/specs/0007-playback-fixes/spec.md` (si cambia), `docs/status.md`.
- Test: — (documento; las cifras salen de 0.2–0.5).
- Verificación: `npm run check`
- [ ] hecha · commit: —
- **Aprobación del usuario** de la propuesta antes de `close-phase` y de la fase 1.

## Decisiones abiertas → ADR
- C1 (reintento sin `crossOrigin`; enmienda 0004 y 0013) y la regla de visualización concreta (amplía el 0031): se escriben en la fase 1 con lo aprobado aquí, no en esta fase.
- Si el spike muestra que K67 se resuelve sin cambio de contrato, la fase 1 lo justifica sin ADR (spec §3).
