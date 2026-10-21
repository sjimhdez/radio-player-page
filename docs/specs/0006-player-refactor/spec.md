# Spec 0006 — Refactor del player

> Estado: **en curso** · Fecha: 2026-10-21 · Rama: `spec/0006-player-refactor` · Depende de: 0003
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, `.claude/rules/player.md`, `testing.md` y `visualizers.md`, y los ADRs 0004, 0006, 0013, 0017 (el método: strangler), 0018, 0021 y 0025. `SPEC.md` §3.3 (globales), §3.8 y §3.9 son lo que no puede cambiar.
2. Tres fases. Cada una empieza con `start-phase` (plan en `docs/specs/0006-player-refactor/phase-N.md`) y termina con `close-phase`. La rama `spec/0006-player-refactor` ya existe (sin push; el primer push y el PR en borrador los hace `start-phase` de la fase 1).
3. **Es un refactor: el comportamiento no cambia.** Los tests de caracterización y los `currently` no se editan, y los snapshots y la línea base de axe no se reescriben. Si un refactor rompe uno, se arregla el refactor. Los bugs de `docs/known-issues.md` se **conservan** (los corrigen la 0007, la 0009 y la 0011 sobre el código nuevo). Excepciones, decididas en el triage de la 0002 y en la sesión de diseño: K9, K14 y K70 se corrigen aquí con `fix-bug` (§4.6), y las dos líneas de test de §4.1 D5.
4. Las decisiones de §4.1 son del usuario (2026-10-21) o salen del triage. Van en el ADR 0029 (tarea 1.1) y no se reabren.
5. Los visualizadores son zona congelada (ADR 0018): ni un byte de los archivos de `SPEC.md` §3.9. Su contrato es `audioRef` (un `RefObject<HTMLAudioElement>`) y `status` (`PlayerStatus` de `src/types/player.tsx`): los dos siguen igual.
6. Si algo de esta spec resulta falso al contrastarlo con el código, o el comportamiento visible cambiaría en algún caso (§6): **para y pregunta**.

## 1. Contexto y objetivo

La lógica del player vive dentro de los hooks y de los componentes. `use-audio-player.tsx` (364 líneas) mezcla en `useCallback` y `useEffect` la detección del protocolo, la carga de `hls.js` y `dashjs`, el `crossOrigin`, la bienvenida y un estado repartido entre `useState` y cinco refs. La cuenta atrás del sueño está en `SleepMode.tsx`, con cinco efectos que se sincronizan con el padre. Media Session, el reloj por minuto (repetido en `use-program-schedule` y `use-transmission-time`) y la lectura de las globales tampoco se pueden probar sin React. Quedan seis excepciones de `react-hooks` 7 de la 0003 que remiten a esta spec.

La 0007 (reproducción) corrige C1, C2, C7, K1, K11, K12, K63, K64… y necesita una **máquina de estados del audio** que se pruebe sin React. La 0009 y la 0011 tocan el horario y la interfaz.

Al cerrar esta spec:

- el núcleo `player/src/core/` contiene la lógica sin React, MUI ni i18next, recibe el `<audio>`, el reloj, los cargadores y las APIs del navegador como parámetros, y tiene tests TDD;
- los hooks son adaptadores finos (`useSyncExternalStore` sobre el núcleo) que conservan su API, y los componentes solo pintan;
- las excepciones de `react-hooks` de la 0003 desaparecen, salvo la de `use-is-ios.tsx` (D4), y `timezone.ts` usa `import.meta.env.DEV`;
- K9, K14 y K70 están corregidos, y las dos sospechas de concurrencia del triage (§4.5) están confirmadas o descartadas.

**No objetivos:**

- Corregir otros bugs, aunque el refactor los deje a un cambio de distancia (C1, C2, C7, K1, K11, K12, K13, K63–K66, C16, K8, K52…): van en su spec. Si una corrección resulta trivial, se anota para su spec; no se hace.
- Mover `src/utils/` (ya es puro y tiene sus tests): el núcleo lo importa. Tampoco se reescriben los modales, `StreamInfo` ni `theme.ts` más allá de cambiar de dónde leen los datos.
- Los visualizadores (§0.5), la parte WordPress y las dependencias (ninguna nueva, ni de runtime ni de desarrollo).

## 2. Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | El comportamiento caracterizado no cambia | `npm --prefix player run check`; `npm run test:e2e` completo (Chromium + WebKit) en `env:start:min` y `env:start:latest`, sin editar tests (salvo D5), snapshots (`tests/e2e/snapshots/`) ni `tests/e2e/a11y-baseline.json`. Los tests de `player/src/**/*.test.ts(x)` que existen hoy siguen pasando contra los hooks y componentes refactorizados |
| A2 | El núcleo no importa React, MUI ni i18next ni lee globales del navegador | ESLint en `player/eslint.config.js` para `src/core/**`: `no-restricted-imports` (`react`, `react-dom`, `react/*`, `@mui/*`, `@emotion/*`, `i18next`, `react-i18next`, `src/hooks/*`, `src/components/*`, `src/config/i18n`) y `no-restricted-globals` (`window`, `document`, `navigator`, `localStorage`). Se ve fallar una vez con una importación temporal (mutación) |
| A3 | Cobertura | `vitest.config.ts`: `src/core/**` ≥ 90 % líneas y ≥ 85 % ramas; `src/hooks/**` ≥ 85 % líneas (los mínimos de la iniciativa, ya desde ahora); `src/utils/**` sigue ≥ 90 % |
| A4 | Sin excepciones de `react-hooks` | `grep -rn "eslint-disable" player/src` solo muestra la de `use-is-ios.tsx`, con el motivo «K13, spec 0007» (D4); `grep -rn "process.env" player/src --exclude='*.test.*'` vacío (los tests de caracterización usan `process.env.TZ` y no se editan; D5, decidido por el usuario el 2026-10-21) |
| A5 | Los nombres de los assets no cambian y el bundle está anotado | `npm run check:zip` y el paso de la CI que compara `player/dist/`; las claves de `manifest.json` de `hls.js` y `dashjs` siguen siendo `isDynamicEntry` (se cargan con `import()`). Tabla del gzip de `player/dist/*.js|css` antes y después en el PR; si un archivo crece más de un 10 %, se pregunta al usuario |
| A6 | La zona congelada no cambia | `git diff origin/trunk -- player/src/components/visualizers player/src/config/visualizers.ts player/src/types/visualizers.tsx player/src/hooks/use-audio-visualizer.tsx player/src/hooks/use-can-visualize.tsx` vacío |
| A7 | K9, K14 y K70 corregidos | Su test `currently` pasa a regresión (en rojo antes del arreglo) y la fila de `known-issues.md` a «corregido (spec 0006)» (§4.6) |
| A8 | Las sospechas de concurrencia tienen respuesta | Un test del núcleo por sospecha (§4.5). Si se confirma un fallo, fila nueva en `known-issues.md` con su decisión |
| A9 | El usuario aprueba la revisión visual | Manual, en <http://localhost:8886>: reproducción MP3, HLS y DASH, bienvenida, pausa, temporizador de sueño, Media Session (pantalla de bloqueo o la notificación del sistema), modales, reloj y volumen, en escritorio y móvil. Queda en «Verificación manual pendiente» de `docs/status.md` hasta que lo apruebe |

## 3. Cambios al contrato (`SPEC.md`)

Ninguno: las globales `window.RADPLAPAG_*`, los nombres de los assets, `manifest.json` (entrada `src/main.tsx`) y el comportamiento de §3.8 no cambian. Las tres correcciones (K9, K14, K70) no cambian nada visible: K70 deja el código como ya dicen §3.8 y el ADR 0004.

Se documenta (sin romper nada):

- `SPEC.md` §3.8: «Configuración» pasa a decir que la validación de las globales vive en `src/core/config/` y que `use-config.tsx` las lee y las expone (el núcleo no lee `window`, A2). `src/core/` es **interno**.
- `.claude/rules/player.md`: la estructura del núcleo, la frontera de A2 y cómo se inyectan las dependencias.
- ADR 0029 (tarea 1.1): las decisiones de §4.1.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | El núcleo vive en `player/src/core/<zona>/`, en TypeScript sin React, MUI ni i18next. Recibe lo que no es suyo como parámetro: el `HTMLAudioElement`, `navigator.mediaSession`, el *user agent*, el reloj (`now()`, `setTimeout`/`setInterval`), los cargadores de `hls.js` y `dashjs` y los textos ya traducidos. Así se prueba con *fakes* y sin `vi.mock` de módulos. Las importaciones dinámicas (`import('hls.js')`, `import('dashjs')`) viven en el núcleo, como cargadores por defecto, para que sigan siendo *chunks* aparte | diseño |
| D2 | Estado: una **función de transición pura** (`(estado, evento) → estado`) por máquina, y un **controlador** por zona que ejecuta los efectos (asignar `src`, `play()`, crear `Hls`…) y publica una instantánea inmutable con `subscribe()`/`getSnapshot()`. Los hooks la leen con `useSyncExternalStore` (salvo `useAudioPlayer()`, con `useState` + `subscribe()`: ADR 0030). Sin librerías de estado (XState y similares serían una dependencia de runtime → ADR) | diseño |
| D3 | `src/utils/` se queda donde está, con sus tests; el núcleo lo importa. La 0009 corrige el horario en `src/utils/program-schedule.ts` | diseño |
| D4 | `useIsIOS()` sigue devolviendo `false` en el primer render (lo fija un test; K13 es de la 0007). Su `eslint-disable` de `set-state-in-effect` se queda con el motivo «K13, spec 0007»; la 0007 lo quita al calcular el valor en el primer render | usuario, 2026-10-21 |
| D5 | Se aprueba editar **solo** estas líneas de tests de caracterización, sin cambiar ninguna aserción: el `Harness` de `use-audio-player.test.tsx` (las dos excepciones `immutability`/`refs`: el resultado del hook se expone sin mutar props) y `vi.stubEnv('NODE_ENV', 'development')` → `vi.stubEnv('DEV', true)` en `timezone.test.ts`, al pasar `timezone.ts` a `import.meta.env.DEV` (Vite ya sustituía `process.env.NODE_ENV` en el build). El `NodeJS.Timeout` de `SleepMode.tsx` pasa a `ReturnType<typeof setInterval>`. `"types": ["node"]` se queda en `tsconfig.app.json`: lo necesitan `utils/timezone.test.ts` y `hooks/use-transmission-time.test.tsx` (`process.env.TZ`), que no se editan | usuario, 2026-10-21 (corregido al planificar la fase 1, ADR 0029) |
| D6 | K9, K14 y K70 se corrigen en esta spec, con `fix-bug` | triage de la 0002 (5.3) |
| D7 | El controlador del audio serializa `play()`/`pause()` (§4.5); si eso cambiara algo visible, para y pregunta, y la corrección pasa a la 0007 | triage de la 0002 (5.3) |

### 4.2 Zonas y destino

| Zona | Hoy | Núcleo (`src/core/…`) | Adaptador | Fase |
|---|---|---|---|---|
| Globales | `hooks/use-config.tsx` (listas blancas, offset −12…14, `programs`/`schedule`) | `config/read-config.ts`: `readConfig(globals)` puro | `useConfig()` con `useMemo` (una lectura por montaje, como hoy) | 1 |
| Reloj por minuto | el `setTimeout` + `setInterval` alineado al minuto, repetido en `use-program-schedule` y `use-transmission-time` | `clock/minute-ticker.ts` (reloj inyectable) | los dos hooks, sin `setState` en el efecto | 1 |
| Programa en antena | cálculo en `use-program-schedule` | `schedule/now-playing.ts`: `{ active, incoming }` para un instante y un offset, sobre `utils/program-schedule.ts` | `useProgramSchedule()` | 1 |
| Hora de la emisora | cálculo en `use-transmission-time` | `clock/transmission-time.ts`, sobre `utils/timezone.ts` | `useTransmissionTime()` | 1 |
| Protocolo | `endsWith('.m3u8' / '.mpd')` | `audio/protocol.ts` (conserva C2) | — | 2 |
| Fuentes | ramas de `playLiveStream()` | `audio/sources/{direct,hls,dash}.ts`: cada una prepara el `<audio>` (con su `crossOrigin`: K70), arranca y se destruye | — | 2 |
| Estado del audio | `useState` + `statusRef`, `activeSourceRef`, `introConsumedRef`, `introLocked`, `loading` | `audio/player-machine.ts` (transición pura) + `audio/audio-controller.ts` (efectos, eventos del `<audio>`, bienvenida, volumen) | `useAudioPlayer()`, misma firma y mismo valor devuelto | 2 |
| Media Session | `hooks/use-media-session.tsx` | `media-session/media-session.ts`: metadatos, *artwork* (K14) y manejadores sobre un `MediaSession` inyectado | `useMediaSession()`, misma firma | 3 |
| Sueño | cuenta atrás y sincronización en `SleepMode.tsx` + `sleepTimerSeconds` en `dashboard/index.tsx` | `sleep/sleep-timer.ts` (conserva K65 y K66) | hook nuevo `use-sleep-timer.tsx`; `SleepMode` y `SleepTimer` solo pintan | 3 |
| Error visible | `setOpenError` en un efecto de `dashboard/index.tsx` | — (derivado: `status === 'error' && !loading`) | `Dashboard` | 3 |

Los nombres de archivos y funciones son orientativos: el plan de cada fase los fija. Lo que no cambia es la frontera (núcleo / hook / componente) ni la fase de cada zona.

### 4.3 El controlador del audio

- Reproduce **exactamente** el comportamiento que fijan los 46 tests de `use-audio-player.test.tsx`, incluidas las rarezas: K11 (`playing` antes de `MANIFEST_PARSED`, la pausa durante la carga no cuenta), K12 (reanudar recrea `hls.js`), K63 (bloqueo en la bienvenida), K64 (`loading` tras pausar en *buffering*), K1 (`pause` tras `error` pisa el estado), C2 y C7. Cada una se replica en el test del núcleo como `it('currently …')`, y su fila de `known-issues.md` apunta también a él, para que la 0007 la encuentre en las dos capas.
- `isIOS` se lee en el momento de `play()`, no al crear el controlador (hoy cambia de `false` a `true` tras el primer render).
- Un cambio de `streamUrl` no recarga nada hasta el siguiente `play()`, como hoy. El volumen se aplica al `<audio>` al engancharlo, salvo en iOS.
- `attach(audio)` / `detach()` son idempotentes: `StrictMode` monta, desmonta y vuelve a montar los efectos en desarrollo (`main.tsx`).
- El *fake* de `src/test/fake-audio.ts` vale para los tests del núcleo; los cargadores se inyectan como funciones que devuelven *fakes* de `Hls` y `MediaPlayer`.

### 4.4 Tests

- **Antes de mover**, cada fase revisa que su zona está fijada: Vitest del player (`hooks/*.test.tsx`, `SleepMode.test.tsx`, `utils/*.test.ts`, `config/locales.test.ts`) y e2e (`mp3`, `hls-dash`, `intro`, `cross-origin`, `sleep`, `modals`, `schedule`, `i18n`, `player-a11y`, `a11y`, `clean-page`, `smoke`). Lo que falte (por ejemplo, Media Session en el navegador, o el *snackbar* de error en un componente) se caracteriza primero, con un commit propio.
- **TDD** para cada módulo del núcleo: el test primero y en rojo, en `src/core/**/*.test.ts` junto al módulo. Los vectores del horario se leen de `tests/fixtures/schedule-vectors.json`, como en `utils/schedule-vectors.test.ts`.
- **Tiempo:** reloj inyectado o `vi.useFakeTimers()`, con `TZ=UTC` (ya lo fija el script). Casos obligatorios: el minuto exacto, el cruce de medianoche, el horario de verano y los desfases negativo y fraccionario (+5:30).
- **Hooks:** sus tests de hoy son la caracterización y no cambian (salvo D5). Si un hook nuevo (`use-sleep-timer`) necesita tests propios, van en `src/hooks/`.

### 4.5 Sospechas de concurrencia (triage 0002, 5.3)

| Sospecha | Cómo se responde |
|---|---|
| Dos `play()` concurrentes con HLS dejan vivo el primer `Hls` (los dos esperan a `loadHls()` después de `destroyPlayers()`) | Test del núcleo con un cargador diferido que se resuelve después del segundo `play()`: cuenta las instancias vivas y las enganchadas al `<audio>` |
| `pause()` durante la carga de un MP3 da «Unable to play» (`play()` rechaza con `AbortError`) | Test del núcleo con un `play()` que rechaza con `AbortError` tras `pause()`; y un e2e en `mp3.spec.ts` que lo mide en Chromium y WebKit |

Si se confirma: fila nueva en `known-issues.md` (K80, K81) con el test que la fija, y el controlador la evita **solo si el resultado visible coincide con el de una única llamada** (D7). Si no, `currently` y la fila pasa a la 0007. Si no se reproduce, la fila queda «no se reproduce» y la hoja de ruta lo dice.

### 4.6 Correcciones (D6)

| Fila | Test `currently` que pasa a regresión | Corrección |
|---|---|---|
| K9 | `utils/timezone.test.ts` (`currently formats NaN for an invalid offset`) | `formatTimeInTimezone()` trata un offset no finito como inválido y usa su reserva, como `getCurrentTimeInTimezone()`. La reserva concreta la elige el plan de la fase 1, de modo que ningún otro test cambie |
| K14 | `hooks/use-media-session.test.tsx` (`currently reports … as image/png`) | La extensión sale del `pathname` de la URL, sin *query string* ni fragmento |
| K70 | `hooks/use-audio-player.test.tsx` (`currently keeps crossOrigin anonymous on the hls.js path after the welcome audio (K70)`) | La fuente de `hls.js` y la de `dashjs` dejan `crossOrigin` en `null` al engancharse (ADR 0004) |

Cada una con `fix-bug`: el test pasa a regresión en rojo, el arreglo mínimo, verde, y la fila a «corregido (spec 0006)». Commit `fix(0006): … (N.M)`.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Un commit por tarea (`refactor(0006): … (N.M)`; tests de caracterización que falten, `test(0006): …`; correcciones, `fix(0006): …`). `player/dist/` se regenera y se commitea en cada tarea que cambie código del player.

### Fase 1 — Cimientos, globales y tiempo

- 1.1 ADR 0029 (D1–D7) + `.claude/rules/player.md` (estructura del núcleo y frontera) + `SPEC.md` §3.8 (§3).
- 1.2 Frontera del núcleo en ESLint (A2, con su mutación) y umbrales de `vitest.config.ts` (A3). Tabla del gzip de `player/dist/` como línea base (A5).
- 1.3 `core/config` y `useConfig()`.
- 1.4 `core/clock` y `core/schedule`; `use-program-schedule` y `use-transmission-time` como adaptadores (sale su excepción de `set-state-in-effect`).
- 1.5 `timezone.ts` con `import.meta.env.DEV` y su test (D5); K9 (§4.6).
- ✅ **Criterios:** A1, A2, A3 (núcleo y hooks de la fase), A5, A6 y A7 (K9) para lo hecho.

### Fase 2 — Audio

- 2.1 Caracterización de lo que falte en la zona del audio (§4.4) y las dos sospechas de §4.5 contra el hook de hoy.
- 2.2 `core/audio/protocol` y las fuentes (`direct`, `hls`, `dash`) por TDD.
- 2.3 `core/audio/player-machine` (transición pura) por TDD, con los `currently` de §4.3 replicados.
- 2.4 `core/audio/audio-controller` por TDD; `useAudioPlayer()` como adaptador con `useState` + `subscribe()` (ADR 0030); el `Harness` del test sin sus excepciones (D5).
- 2.5 K70 (§4.6) y la decisión de cada sospecha (§4.5).
- ✅ **Criterios:** A1 (Vitest y e2e `mp3`, `hls-dash`, `intro`, `cross-origin`, `visualizers` en las dos puntas), A2, A3, A5, A6, A7 (K70), A8.

### Fase 3 — Media Session, sueño y dashboard

- 3.1 `core/media-session` y `useMediaSession()`; K14 (§4.6).
- 3.2 `core/sleep` y `use-sleep-timer`; `SleepMode`, `SleepTimer` y `Dashboard` solo pintan (salen las excepciones de `SleepMode.tsx` y `dashboard/index.tsx`). K65 y K66 se conservan (`sleep.spec.ts`, `SleepMode.test.tsx`).
- 3.3 El error visible derivado en `Dashboard` (§4.2).
- 3.4 Cierre de la spec: A4, tabla del bundle en el PR, A9 en «Verificación manual pendiente», `SPEC.md` §6 (historial), y las notas de la hoja de ruta para la 0007, la 0009 y la 0011 (dónde queda cada corrección en el núcleo), con la columna de archivo de `known-issues.md` al día.
- ✅ **Criterios:** A1–A9.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | `useSyncExternalStore` cambia cuándo se ve un estado (sin el render intermedio de `useState` + efecto) y un test de caracterización lo nota, o en `StrictMode` se enganchan dos veces los eventos del `<audio>` | §4.3: `attach`/`detach` idempotentes y un test del núcleo que engancha dos veces. Si un test de caracterización falla por el orden de los renders, se arregla el adaptador, nunca el test. Si no se puede conservar, para y pregunta. Ocurrió con el audio (K1): ADR 0030, tarea 2.11 | Fases 1–2 |
| 2 | Mover `import('hls.js')` y `import('dashjs')` a otro módulo cambia los *chunks* o los mete en el principal | A5 (`check:zip`, `manifest.json`, `git diff player/dist` en la CI). Se mira el `manifest.json` tras la 2.2 | Fase 2 |
| 3 | La pausa de la bienvenida (`pause` antes de `ended`) y el temporizador de sueño (K65) dependen del orden de los eventos del `<audio>` | El controlador publica los mismos estados en el mismo orden; `sleep.spec.ts` (K65) en las dos puntas lo fija | Fases 2–3 |
| 4 | Serializar `play()`/`pause()` (D7) toca K11, que debe conservarse | §4.5: solo se evita lo que una única llamada no haría. El `currently` de K11 manda | Fase 2 |
| 5 | Media Session no tiene e2e: solo la cubre Vitest | 3.1 caracteriza en e2e lo que Playwright deje ver (`navigator.mediaSession.metadata` y `playbackState`); la pantalla de bloqueo, en A9 | Fase 3 |
| 6 | El bundle principal crece al añadir el núcleo | A5: tabla en el PR; más de un 10 % se pregunta | Todas |
| 7 | Tentación de corregir un bug al tenerlo aislado | No se corrige: se anota en la fila de `known-issues.md` dónde queda en el núcleo (tarea 3.4) | Todas |

## Apéndice — Referencias

- Triage de la 0002: K9, K14, K70 y las sospechas (`docs/specs/0002-safety-net/phase-5.md`, 5.3; `audit/player.md` §4–§5).
- Excepciones de `react-hooks` 7: spec 0003 §4.2 y la tarea 1.1 de su `phase-1.md`.
- Método de un refactor por capas con envoltorios: spec 0005 (PHP), sobre todo §4.4 y sus desviaciones en `docs/deviations.md`.
