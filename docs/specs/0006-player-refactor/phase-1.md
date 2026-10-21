# Spec 0006 · Fase 1 — Cimientos, globales y tiempo
Estado: cerrada (2026-10-21) · Inicio: 2026-10-21 · ADRs: 0004, 0006, 0013, 0017, 0018, 0021, 0025, 0029 (nuevo)

## Contexto (medido al planificar)

- **Globales:** `hooks/use-config.tsx` valida dentro de un `useMemo([])` con listas blancas (8 temas, 4 visualizadores) y un offset numérico entre −12 y 14 (si no, 0). `programs` tiene que ser un array y `schedule` un objeto: `[]` pasa, y eso es K17 con su `currently`. Lo fijan los 6 bloques `it`/`it.each` de `use-config.test.tsx`, entre ellos «reads the globals once per mount».
- **Reloj por minuto:** `use-program-schedule` y `use-transmission-time` repiten el mismo `setTimeout(60000 - now % 60000)` seguido de `setInterval(60000)`, con delay 0 si se monta en un minuto exacto. Los tests fijan: un solo temporizador vivo (`getTimerCount() === 1`), ningún temporizador sin horario (`=== 0`), 0 al desmontar, y la primera señal a los 0 ms en un minuto exacto.
- **`useSyncExternalStore`:** `getSnapshot` tiene que devolver la misma referencia mientras no haya señal. Por eso el núcleo guarda el valor calculado en caché y solo lo recalcula en cada señal; el temporizador arranca en el primer `subscribe` y se para en el último `unsubscribe` (StrictMode, riesgo 1). Hoy el primer render da `{null, null}` y `''`, y el efecto los corrige. Con el store, el valor ya está en el primer render. Ningún test lo distingue: todos leen después del efecto. Si un e2e lo notara, se para y se pregunta.
- **Reloj inyectable sin tocar `src/utils/`:** `getCurrentTimeInTimezone()` y `formatTimeInTimezone()` leen `new Date()`. Con D3, `utils/` no cambia de firma. El núcleo recibe el reloj donde hay temporizadores (`minute-ticker`: `now`, `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, con los globales por defecto). Los cálculos (`now-playing`, `transmission-time`) se prueban con `vi.useFakeTimers()` + `setSystemTime`, como permite §4.4.
- **`process.env`:** el código publicado solo lo usa en `utils/timezone.ts`, cuatro veces (`NODE_ENV`). Los tests de caracterización usan `process.env.TZ` (`timezone.test.ts`, `use-transmission-time.test.tsx`) y no se editan. **Decisión del usuario (2026-10-21):** A4 pasa a `grep -rn "process.env" player/src --exclude='*.test.*'` vacío, y `"types": ["node"]` se queda en `tsconfig.app.json` porque lo necesitan esos tests. Se corrige la spec (A4 y D5) en el commit de la 1.1 y se anota en «Desviaciones» de `docs/status.md`.
- **`import.meta.env.DEV` en Vitest:** vale `true` en modo `test`. Desde la 1.7, los tests que pasan `NaN` a `getCurrentTimeInTimezone` escriben su `console.warn` por la salida (solo ruido, sin fallo). «warns … only in development» pasa a `vi.stubEnv('DEV', true)` (D5) y sigue comprobando lo mismo.
- **K9:** `formatTimeInTimezone(NaN)` da `'NaN:NaN:NaN'` porque no lanza. **Reserva elegida:** la suya, la hora local del navegador (la rama del `catch`). La fila dice «su reserva no actúa», y esto la hace actuar. Ningún otro test cambia: los offsets finitos siguen por la rama principal.
- **Cobertura actual:** hooks 96,5 % de líneas, utils 98,1 % de líneas y 96,9 % de ramas. Subir el mínimo de hooks a 85 % ya pasa. `src/core/**` sin archivos: la 1.2 comprueba si Vitest acepta un umbral sobre un glob vacío y, si no, el umbral entra con el primer módulo (1.3).
- **Excepciones de `react-hooks` en esta fase:** solo la de `use-program-schedule.tsx:55`. Las de `use-transmission-time` no existen (usa `setState` dentro de una función). Las de `SleepMode`, `dashboard/index.tsx` y el `Harness` son de las fases 2 y 3, y la de `use-is-ios` se queda (D4).
- **Bundle (`player/dist/`):** principal `radio-player-page-3.4.2.min.js`, `.css`, `-hls`, `-dash-all-min` y cuatro visualizadores. La línea base del gzip se toma en la 1.2.

## Objetivo

Montar los cimientos del núcleo `player/src/core/`: ADR 0029, frontera en ESLint, umbrales de cobertura y línea base del bundle. Mover a él la lectura de las globales, el reloj por minuto, el programa en antena y la hora de la emisora con TDD, dejar `useConfig`, `useProgramSchedule` y `useTransmissionTime` como adaptadores con la misma API, pasar `timezone.ts` a `import.meta.env.DEV` y corregir K9.

## Criterios de aceptación

| Criterio | Cómo se verifica (test o checklist manual) |
|---|---|
| A1 Comportamiento sin cambios | `npm --prefix player run check`; `npm run test:e2e` en `env:start:min` y `env:start:latest`; `git diff origin/trunk -- player/src/**/*.test.* tests/e2e` solo con las altas de `src/core/**` y la línea de D5 en `timezone.test.ts` (más el test de K9, que pasa a regresión) |
| A2 Núcleo sin React, MUI ni i18next | Bloque de `player/eslint.config.js` para `src/core/**` (`no-restricted-imports` + `no-restricted-globals`); se ve fallar con una importación temporal de `react` y un `window` (mutación, se revierte) |
| A3 Cobertura (núcleo y hooks de la fase) | `vitest.config.ts`: `src/core/**` ≥ 90 % líneas · ≥ 85 % ramas; `src/hooks/**` ≥ 85 % líneas; `src/utils/**` ≥ 90 % líneas (`npm --prefix player run test:coverage`) |
| A4 (parcial) | `grep -rn "process.env" player/src --exclude='*.test.*'` vacío; `grep -rn "eslint-disable" player/src/hooks/use-program-schedule.tsx` vacío |
| A5 Assets y bundle | `npm run check:zip`; `manifest.json`: `hls` y `dash` siguen siendo `isDynamicEntry`; tabla del gzip antes y después en el «Resultado:» de la 1.2 y la 1.9 (más de un 10 % → se pregunta) |
| A6 Zona congelada | `git diff origin/trunk -- player/src/components/visualizers player/src/config/visualizers.ts player/src/types/visualizers.tsx player/src/hooks/use-audio-visualizer.tsx player/src/hooks/use-can-visualize.tsx` vacío |
| A7 (K9) | `timezone.test.ts`: el `currently` pasa a regresión (en rojo antes del arreglo) y la fila K9 pasa a «corregido (spec 0006)» |

## Tareas

### 1.1 ADR 0029, reglas y contrato (≤ 1 h)
- Qué: ADR 0029 «Núcleo del player en `src/core/` sin React» (D1–D7 de §4.1: inyección de dependencias, transición pura + controlador + `useSyncExternalStore`, `utils/` se queda, D4, D5 con la corrección de A4, K9/K14/K70, serialización de `play()`). Índice de ADRs. `.claude/rules/player.md`: estructura de `src/core/<zona>/`, frontera de A2 y cómo se inyectan las dependencias (la «Frontera con WordPress» pasa a nombrar `core/config/`). `SPEC.md` §3.8 «Configuración» (§3 de la spec). Spec: A4 y D5 con la decisión de 2026-10-21; estado «en curso».
- Archivos: `docs/adr/0029-player-core-without-react.md`, `docs/adr/README.md`, `.claude/rules/player.md`, `SPEC.md`, `docs/specs/0006-player-refactor/spec.md`.
- Test: — (documentación).
- Verificación: `grep -n '0029' docs/adr/README.md && grep -n 'src/core/config' SPEC.md .claude/rules/player.md`
- Resultado: ADR 0029 aceptado (D1–D7, frontera de A2, adaptadores, `src/core/` interno, umbrales de A3) y en el índice. `SPEC.md` §3.8 «Configuración» nombra `src/core/config/` y lo marca interno; el historial (§6) lo actualiza la 3.4. `player.md`: «Frontera con WordPress» nombra `src/core/config/`, y la sección del refactor pasa a «Núcleo, hooks y componentes» (estructura, frontera, inyección, estado, hooks). Spec: A4 con `--exclude='*.test.*'` y D5 con `"types": ["node"]` que se queda; el estado ya era «en curso». `npm run check` en verde.
- [x] hecha · commit: 33cd672

### 1.2 Frontera, umbrales y línea base del bundle (≤ 1 h)
- Qué: en `player/eslint.config.js`, un bloque `files: ['src/core/**/*.ts']` con `no-restricted-imports` (paths `react`, `react-dom`, `i18next`, `react-i18next`, `src/config/i18n`; patterns `react/*`, `react-dom/*`, `@mui/*`, `@emotion/*`, `src/hooks/*`, `src/components/*`) y `no-restricted-globals` (`window`, `document`, `navigator`, `localStorage`), cada uno con su mensaje. Mutación: un `src/core/_probe.ts` temporal con `import 'react'` y `window` hace fallar `npm --prefix player run lint`, y después se borra. En `vitest.config.ts`, los umbrales de A3 (si el glob vacío falla, el de `src/core/**` entra en la 1.3; se anota). Tabla del gzip de `player/dist/*.{js,css}` (`gzip -9c <f> | wc -c`) en el «Resultado:».
- Archivos: `player/eslint.config.js`, `player/vitest.config.ts`.
- Test: mutación temporal (ESLint).
- Verificación: `npm --prefix player run check`
- Resultado: bloque de `src/core/**/*.ts` (`{ts,tsx}` desde la 1.10) en `player/eslint.config.js` con `no-restricted-imports` (5 paths, 3 grupos de patterns) y `no-restricted-globals` (4), cada uno con su mensaje. Mutación: un `src/core/_probe.ts` con `react`, `@mui/material/Box`, `src/config/i18n`, `src/hooks/use-config`, `window`, `document`, `navigator` y `localStorage` da 9 errores y `lint` sale con 1; borrado, sale con 0. Umbrales de A3 en `vitest.config.ts` (`src/core/**` 90 % líneas · 85 % ramas, `src/hooks/**` 85 %, `src/utils/**` 90 %). Vitest 5 acepta el glob vacío de `src/core/**` (pasa sin archivos), así que el umbral entra ya: con un `src/core/_probe.ts` sin test, `test:coverage` falla («Coverage for lines (0%) does not meet "src/core/**" threshold»); borrado, pasa. `dist/` no cambia. `npm run check` en verde. Línea base del gzip (`gzip -9c <f> | wc -c`, bytes):

  | Archivo (`radio-player-page-3.4.2…`) | Tamaño | gzip -9 |
  |---|---:|---:|
  | `.min.js` | 604 804 | 186 438 |
  | `.css` | 1 316 | 675 |
  | `-hls.min.js` | 583 903 | 178 596 |
  | `-dash-all-min.min.js` | 824 688 | 236 288 |
  | `-amplitude-waterfall-visualizer.min.js` | 1 228 | 699 |
  | `-bar-visualizer.min.js` | 2 179 | 1 076 |
  | `-oscilloscope-visualizer.min.js` | 713 | 484 |
  | `-particles-visualizer.min.js` | 1 890 | 969 |
- [x] hecha · commit: a99950a

### 1.3 `core/config` y `useConfig()` (≤ 1 h)
- Qué: `src/core/config/read-config.ts` con `readConfig({ config, programs, schedule }: RawGlobals): ResolvedConfig`, puro: las listas blancas, el rango del offset, `programs` como array y `schedule` como objeto (K17 tal cual), y los mismos valores por defecto. Primero los tests (en rojo): los casos de `use-config.test.tsx` contra la función, más `it('currently keeps an empty array as the schedule')` replicado (la fila K17 apunta también al test nuevo). `useConfig()` queda como `useMemo(() => readConfig({ config: window.RADPLAPAG_CONFIG, programs: window.RADPLAPAG_PROGRAMS, schedule: window.RADPLAPAG_SCHEDULE }), [])`.
- Archivos: `player/src/core/config/read-config.ts`, `read-config.test.ts`, `player/src/hooks/use-config.tsx`, `docs/known-issues.md` (K17), `player/dist/`.
- Test: primero (TDD): `src/core/config/read-config.test.ts`; caracterización: `src/hooks/use-config.test.tsx` sin cambios.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- Resultado: `src/core/config/read-config.ts` exporta `readConfig()` (puro) y el tipo `RawGlobals`; las listas blancas y los valores por defecto se mueven tal cual desde el hook. `read-config.test.ts` (en rojo primero: el módulo no existía) replica los casos de `use-config.test.tsx` contra la función, con el `currently` de K17, más «returns a new object on every call»; «reads the globals once per mount» se queda solo en el hook (es del `useMemo`). `useConfig()` es `useMemo(() => readConfig({ … window.RADPLAPAG_* }), [])`; `use-config.test.tsx` sin cambios. Fila K17: nombra `core/config/read-config.ts` y apunta a los dos tests del player. `dist/`: solo `.min.js` cambia (604 804 → 604 796 B; gzip 186 438 → 186 437). `npm run check` en verde.
- [x] hecha · commit: 57c30ea

### 1.4 `core/clock/minute-ticker` (≤ 1 h)
- Qué: `createMinuteTicker(clock = defaultClock)` → `start(onTick): stop`. El primer `setTimeout` va a `60000 - now() % 60000` (0 en un minuto exacto), después `setInterval(60000)`, con un solo temporizador vivo; `stop` es idempotente. Encima, `createMinuteStore(compute, clock)` → `{ subscribe, getSnapshot }`: el valor se calcula sin temporizador en el primer `getSnapshot` y se guarda, se recalcula en cada señal y avisa a los suscriptores; el ticker arranca con el primer suscriptor y para con el último (StrictMode: suscribir, desuscribir y volver a suscribir deja un único temporizador). Tests con un reloj *fake* inyectado: el minuto exacto, la alineación, un temporizador vivo, sin temporizadores tras desuscribir, la doble suscripción y la referencia estable entre señales.
- Archivos: `player/src/core/clock/minute-ticker.ts`, `minute-ticker.test.ts`.
- Test: primero (TDD): `src/core/clock/minute-ticker.test.ts`.
- Verificación: `npm --prefix player run check`
- Resultado: `src/core/clock/minute-ticker.ts` exporta `Clock`, `TimerHandle`, `defaultClock` (busca cada global en cada llamada, para que `vi.useFakeTimers()` de los hooks siga actuando), `createMinuteTicker(clock)` → `{ start(onTick): stop }` y `createMinuteStore(compute, clock)` → `{ subscribe, getSnapshot }`. `minute-ticker.test.ts` (en rojo primero: el módulo no existía) usa un reloj *fake* local que solo avanza con `advance()`: 12 casos (minuto exacto, alineación, un temporizador vivo, 0 tras `stop` antes y después de la primera señal, `stop` idempotente, los globales por defecto con `vi.useFakeTimers()`, primer valor sin temporizador, referencia estable entre señales, aviso a todos los suscriptores, arranque y parada con el primero y el último, StrictMode y sin aviso tras desuscribir). Mutaciones (revertidas): sin el delay 0, sin parar con el último suscriptor y sin limpiar el `timeout` disparado fallan 2, 2 y 1 casos. Cobertura de `src/core/clock/` 100 %. Si el store pasa un rato sin suscriptores, el valor guardado no se recalcula hasta la siguiente señal; no solo en el doble montaje de StrictMode: también si el render y el commit caen a ambos lados de :00 (lo vio la revisión del cierre; lo corrige la 1.10). `dist/` no cambia (nada lo importa aún). `npm run check` en verde.
- [x] hecha · commit: 6a5068f

### 1.5 `core/schedule/now-playing` y `useProgramSchedule()` (≤ 1 h)
- Qué: `getNowPlaying(schedule, programs, timezoneOffset): { active, incoming }` sobre `getCurrentTimeInTimezone`, `findActiveProgram` y `findIncomingProgram`. Sin `schedule` da `{ active: null, incoming: null }`. Tests con `setSystemTime`: el minuto exacto, el cruce de medianoche, el horario de verano (el offset servido se mantiene, C9) y los offsets −6 y +5:30. Los vectores de `tests/fixtures/schedule-vectors.json` van si no duplican `utils/schedule-vectors.test.ts`; si los duplican, se anota. El hook queda así: sin horario devuelve una constante `{null, null}` sin store (0 temporizadores); con horario, `useMemo` crea `createMinuteStore(() => getNowPlaying(...))` con las dependencias de hoy (`schedule`, `programs`, `timezoneOffset`) y `useSyncExternalStore` lo lee. Sale el `eslint-disable`.
- Archivos: `player/src/core/schedule/now-playing.ts`, `now-playing.test.ts`, `player/src/hooks/use-program-schedule.tsx`, `player/dist/`.
- Test: primero (TDD): `src/core/schedule/now-playing.test.ts`; caracterización: `src/hooks/use-program-schedule.test.tsx` sin cambios.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- Resultado: `src/core/schedule/now-playing.ts` exporta `NowPlaying` y `getNowPlaying(schedule, programs, timezoneOffset)`, que encadena `getCurrentTimeInTimezone`, `findActiveProgram` y `findIncomingProgram` (sin horario, `{ active: null, incoming: null }` sin leer la hora). `now-playing.test.ts` (en rojo primero: el módulo no existía) con `setSystemTime`: 9 casos (programa activo y siguiente, sin horario, sin nada en antena, el cambio en el minuto exacto, el cruce de medianoche, −6, +5:30, el cambio de día con el offset y el `currently` del horario de verano, C9). Los vectores de `schedule-vectors.json` no se repiten: duplicarían `utils/schedule-vectors.test.ts`, que ya los pasa por las tres funciones que `getNowPlaying` encadena (se anota en la cabecera del test). El hook: sin horario usa un store constante `{null, null}` que no arranca temporizador; con horario, `useMemo([schedule, programs, timezoneOffset])` crea `createMinuteStore(() => getNowPlaying(…))` y lo lee `useSyncExternalStore`. `ProgramScheduleResult` pasa a alias de `NowPlaying` (misma forma). Sale el `eslint-disable`; `use-program-schedule.test.tsx` sin cambios. Fila C9: apunta también al test nuevo. Cobertura de `now-playing.ts` y del hook, 100 %. `dist/`: solo `.min.js` cambia (604 796 → 605 102 B; gzip 186 437 → 186 618). `npm run check` en verde.
- [x] hecha · commit: 222c60b

### 1.6 `core/clock/transmission-time` y `useTransmissionTime()` (≤ 1 h)
- Qué: `getTransmissionTime(timezoneOffset): TransmissionTime` (`HH:MM` de la emisora y del navegador, la diferencia y `hasDifference` con el umbral 0,01), sobre `utils/timezone.ts`. Tests con varias `TZ` (Madrid, Ciudad de México, UTC, Kolkata), +5:30, −6, el cruce de medianoche y el horario de verano. El hook: `createMinuteStore(() => getTransmissionTime(offset))` en `useMemo([offset])` + `useSyncExternalStore`, sin `useState` ni refs. El tipo `TransmissionTime` se mueve al núcleo y el hook lo reexporta.
- Archivos: `player/src/core/clock/transmission-time.ts`, `transmission-time.test.ts`, `player/src/hooks/use-transmission-time.tsx`, `player/dist/`.
- Test: primero (TDD): `src/core/clock/transmission-time.test.ts`; caracterización: `src/hooks/use-transmission-time.test.tsx` sin cambios.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- Resultado: `src/core/clock/transmission-time.ts` exporta `TransmissionTime` (movido tal cual desde el hook) y `getTransmissionTime(timezoneOffset)`, que lee el offset del navegador una vez y encadena `getTimezoneDifference` y `formatTimeInTimezone(…, false)`; el umbral 0,01 pasa a la constante `DIFFERENCE_THRESHOLD`. `transmission-time.test.ts` (en rojo primero: el módulo no existía) con `setSystemTime` y `TZ` por caso: 7 casos (Madrid con −6, Ciudad de México sin diferencia, +5:30 de la emisora en UTC, Kolkata como navegador, el cruce de medianoche, el horario de verano del navegador en Madrid con el offset fijo de la emisora y el umbral 0,01). El hook: `useMemo([timezoneOffset])` crea `createMinuteStore(() => getTransmissionTime(timezoneOffset))` y lo lee `useSyncExternalStore`; salen los `useState`, los refs y los temporizadores propios, y reexporta el tipo (`TimezoneClock.tsx` lo sigue importando del hook). `use-transmission-time.test.tsx` sin cambios. Cobertura de `transmission-time.ts` y del hook, 100 %. `dist/`: solo `.min.js` cambia (605 102 → 604 679 B; gzip -9 de esta máquina 186 587 → 186 515). `npm --prefix player run check` en verde.
- [x] hecha · commit: 6ce6f42

### 1.7 `timezone.ts` con `import.meta.env.DEV` (≤ 1 h)
- Qué: las cuatro `process.env.NODE_ENV === 'development'` pasan a `import.meta.env.DEV`. En `timezone.test.ts`, solo la línea `vi.stubEnv('NODE_ENV', 'development')` → `vi.stubEnv('DEV', true)` (D5). `"types": ["node"]` se queda (lo usan los tests: `process.env.TZ`). Se comprueba en el bundle que la rama de desarrollo desaparece (`grep -c "Radio Player\] Invalid timezone" player/dist/*.min.js` → 0, igual que hoy).
- Archivos: `player/src/utils/timezone.ts`, `player/src/utils/timezone.test.ts` (una línea), `player/dist/`.
- Test: caracterización existente (`timezone.test.ts`); se ve fallar con `stubEnv('DEV', false)` (mutación, se revierte).
- Verificación: `npm --prefix player run check && npm --prefix player run build && ! grep -rn "process.env" player/src --exclude='*.test.*'`
- Resultado: las cuatro condiciones de `timezone.ts` pasan a `import.meta.env.DEV`; en `timezone.test.ts` solo cambia la línea del `stubEnv` («warns … only in development»). Mutación `stubEnv('DEV', false)`: el test cae en rojo (`toHaveBeenCalledOnce`), revertida. `grep -rn "process.env" player/src --exclude='*.test.*'` vacío; `grep -c "Radio Player\] Invalid timezone" player/dist/*.min.js` → 0 en todos. `dist/` sin cambios: el build de producción reduce las dos formas a `false` y la salida es idéntica byte a byte. `npm --prefix player run check` en verde.
- [x] hecha · commit: c071aa0

### 1.8 K9: `formatTimeInTimezone` con un offset no finito (≤ 1 h)
- Qué: con `fix-bug`. El `currently formats NaN for an invalid offset` pasa a regresión: `formatTimeInTimezone(NaN)` (y `Infinity`) da la hora local del navegador, en rojo primero. Arreglo mínimo: `if (!Number.isFinite(timezoneOffset))` va a la reserva de hora local (se extrae la rama del `catch` a una función local para no duplicarla). Fila K9 → «corregido (spec 0006)». Commit `fix(0006): … (1.8)`.
- Archivos: `player/src/utils/timezone.ts`, `timezone.test.ts`, `docs/known-issues.md`, `player/dist/`.
- Test: regresión en rojo primero: `src/utils/timezone.test.ts`.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- Resultado: el `currently` pasa a `falls back to the browser local time for a non-finite offset` (TZ `Asia/Kolkata`: `NaN`, `Infinity` sin segundos y `-Infinity`). En rojo primero por la razón esperada: `expected 'NaN:NaN:NaN' to be '04:35:09'`. Arreglo: guarda `!Number.isFinite(timezoneOffset)` al principio de `formatTimeInTimezone()` y la rama del `catch` extraída a `formatBrowserLocalTime(includeSeconds)` (local, sin exportar), que usan las dos reservas. Sin nota de changelog: inalcanzable desde la página (`readConfig()` solo deja pasar offsets entre −12 y 14). Fila K9 → «corregido». `dist/`: solo `.min.js` cambia (604 679 → 604 755 B; gzip -9 186 515 → 186 519). `npm --prefix player run check` y `npm run check` en verde.
- [x] hecha · commit: d283ad3

### 1.9 Verificación de la fase (≤ 1 h)
- Qué: `npm run check`; `npm run test:e2e` en `env:start:min` y en `env:start:latest`; A6 (`git diff` de la zona congelada vacío); `manifest.json` (`isDynamicEntry` de `hls` y `dash`); tabla del gzip después, comparada con la de la 1.2. Sin commit si no cambia nada (se anota en el cierre).
- Archivos: —
- Test: —
- Verificación: `npm run check && npm run check:zip && npm run test:e2e`
- Resultado: `npm run check` en verde (incluye `check:zip`: 62 archivos, la lista de `v3.4.2` más las altas declaradas). E2E en las dos puntas: `env:start:min` (WP 6.6 + PHP 7.4) 199 pasan · 25 omitidos (8,9 min); `env:start:latest` 199 pasan · 25 omitidos (9,4 min). Los omitidos son los `test.skip` condicionales de siempre. A6: el `git diff origin/trunk` de la zona congelada está vacío. `manifest.json`: `hls.mjs` y `dash.all.min.js` siguen con `isDynamicEntry: true`. El build no cambia nada, así que no hay commit. Gzip (bytes, `gzip -9` de macOS para todo; la línea base de la 1.2 se tomó con otra implementación y no es comparable, así que se mide frente a `origin/trunk` con la misma herramienta): solo cambia el `.min.js`, de 604 804 → 604 755 B y 186 407 → 186 519 B en gzip (+112 B, +0,06 %, por debajo del 10 %). El resto, igual:

  | Archivo (`radio-player-page-3.4.2…`) | Tamaño | gzip -9 | Δ gzip frente a `trunk` |
  |---|---:|---:|---:|
  | `.min.js` | 604 755 | 186 519 | +112 |
  | `.css` | 1 316 | 647 | 0 |
  | `-hls.min.js` | 583 903 | 178 561 | 0 |
  | `-dash-all-min.min.js` | 824 688 | 236 244 | 0 |
  | `-amplitude-waterfall-visualizer.min.js` | 1 228 | 637 | 0 |
  | `-bar-visualizer.min.js` | 2 179 | 1 030 | 0 |
  | `-oscilloscope-visualizer.min.js` | 713 | 429 | 0 |
  | `-particles-visualizer.min.js` | 1 890 | 917 | 0 |
- [x] hecha · commit: — (sin cambios; el resultado entra en el commit del cierre)

### 1.10 Valor al día cuando llega el primer suscriptor (≤ 1 h)
- Qué: lo encontraron en el cierre `spec-conformance-reviewer` y `backcompat-reviewer`. `createMinuteStore` guardaba el valor del primer `getSnapshot()` (render) y alineaba el ticker en `subscribe()` (commit): si el cambio de minuto caía en medio, o el store pasaba un rato sin suscriptores, `useProgramSchedule` y `useTransmissionTime` mostraban el minuto anterior hasta 60 s. Antes el efecto calculaba en el commit y no pasaba. Arreglo: el snapshot guarda su minuto, y al arrancar el ticker se recalcula y se avisa si es de otro minuto. Además, la frontera de ESLint pasa a `src/core/**/*.{ts,tsx}` (A2 habla de `src/core/**`). Decidido por el usuario (2026-10-21).
- Archivos: `player/src/core/clock/minute-ticker.ts`, `player/src/core/clock/minute-ticker.test.ts`, `player/eslint.config.js`, `player/dist/`.
- Test: `minute-ticker.test.ts`: «recomputes when the first subscriber arrives in a later minute than the snapshot» (render a :59.999, commit a :00.001) y «recomputes when it is subscribed again after a minute without subscribers», en rojo primero (`expected { minute: …859999 } to deeply equal { minute: …860001 }`); «keeps the first snapshot when the first subscriber arrives in the same minute» fija que no se recalcula sin necesidad.
- Verificación: `npm run check`; e2e en las dos puntas; mutación de ESLint con un `src/core/_probe.tsx`.
- Resultado: `npm run check` en verde; integración (839 tests) y e2e en las dos puntas (199 pasan · 25 omitidos en cada una). Mutación: `_probe.tsx` con `react` y `window` da 2 errores y `eslint` sale con 1; borrado. Gzip del `.min.js` (misma herramienta que la 1.9): 604 815 B, 186 554 B (+35 B frente a la 1.9; +147 B, +0,08 %, frente a `trunk`). El resto, igual.
- [x] hecha · commit: 890efee

## Decisiones abiertas → ADR

- Ninguna nueva: D1–D7 van al ADR 0029 (1.1), con la corrección de A4/D5 decidida por el usuario el 2026-10-21.
- Confirmado en la 1.2: Vitest acepta el umbral de `src/core/**` sin archivos; entra en la 1.2. Decisión del plan, sin ADR.
