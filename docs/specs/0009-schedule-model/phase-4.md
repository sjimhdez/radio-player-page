# Spec 0009 · Fase 4 — Zona horaria (C9 y K10) y cierre
Estado: en curso · Inicio: 2026-10-23 · ADRs: 0046 (nuevo), 0044, 0029, 0019

## Contexto
- PHP ya sigue el horario de verano en cada petición (`WP\Clock::now()` con `wp_timezone()`; `WeekTest::test_daylight_saving_time`, `SiteTimezoneTest`). C9 es solo del player: `Globals_Builder::config()` imprime `timezoneOffset = $now->getOffset() / 3600` y el player lo usa fijo mientras la página está abierta.
- **Zona en PHP (D8):** `config()` es núcleo puro y ya recibe `$now` con `wp_timezone()`, que es `timezone_string` si existe y si no un desfase `±HH:MM`. Así que `timezone = $now->getTimezone()->getName()`, o `null` si el nombre es un desfase (empieza por `+`/`-`). Equivale a `get_option( 'timezone_string' )` (D8) sin parámetro nuevo, y la zona y el desfase salen siempre del mismo `$now`. La clave va detrás de `timezoneOffset`.
- **Player (D6):** en vez de reescribir el cálculo del día y la hora, una función nueva `getStationOffset( timezone, timezoneOffset, now? )` en `utils/timezone.ts` da el desfase **actual** de la zona en horas (de minutos enteros) con `Intl.DateTimeFormat(…).formatToParts()` (`hourCycle: 'h23'`), y cae a `timezoneOffset` sin zona o si `Intl` la rechaza. Los llamadores lo calculan en cada minuto y lo pasan a las funciones de siempre (`getCurrentTimeInTimezone()`, `formatTimeInTimezone()`, `getTimezoneDifference()`), que conservan su firma. Llamadores: `core/schedule/now-playing.ts`, `core/clock/transmission-time.ts` (ganan un parámetro opcional `timezone`), `hooks/use-program-schedule.tsx`, `hooks/use-transmission-time.tsx`, `components/dashboard/ScheduleModal.tsx` y `AllProgramsModal.tsx` (llaman a `getCurrentTimeInTimezone()` directamente).
- **`read-config.ts`:** `timezone` se resuelve a `string | undefined` (como las URLs de medios), no a `null`: el `toEqual` de «safe defaults» de `read-config.test.ts` y `use-config.test.tsx` ignora las claves `undefined`, así que no se editan. Una zona que `Intl` no acepta → `undefined` (riesgo 4).
- **K10:** `formatTimezoneDifference()` redondea a un decimal. Pasa a `±H` o `±H:MM` a partir de minutos enteros; `getTimezoneDifference()` resta en minutos enteros. `timeDifference` sigue en horas (`TimezoneClock` y los tests de `transmission-time` lo leen así).
- Medido: los únicos lectores de los vectores `tz` son `player/src/utils/schedule-vectors.test.ts` y `tests/php/unit/Schedule/WeekTest.php` (`data_tz_vectors()`, que arma el desfase con `timezoneOffset`). El seed e2e usa `Asia/Kolkata` (sin DST): en el navegador no cambia nada visible.
- **Ediciones de tests (para aprobar con el plan):**
  - `GlobalsBuilderTest::test_config_with_a_full_station` gana `'timezone' => 'UTC'` (clave nueva, ADR 0046).
  - `clean-page.spec.ts` «prints timezoneOffset as a number fixed per request (C9)» → regresión «prints the site timezone next to timezoneOffset (C9)»; snapshots `mp3.html` (§4.3) **y `minimal.html`** (también gana `"timezone":"Asia/Kolkata"`, además del `{}` ya hecho); el comentario del seed (`seed-e2e.php`) y el de `tests/e2e/support/normalize.mjs`.
  - `WeekTest::data_tz_vectors()`: usa `timezone` cuando el vector la trae (si no, el desfase de siempre). La fila `'vector tz-dst-start, correct'` de `data_daylight_saving_time()` se queda.
  - `timezone.test.ts` `formatTimezoneDifference`: las filas `[5.5, '+5.5']` y `[-9.5, '-9.5']` pasan a `'+5:30'` y `'-9:30'` (formato `±H:MM`, criterio K10 de la spec y ADR 0046).
  - Los `currently` de C9 (`timezone.test.ts`, `now-playing.test.ts`, vector `tz-dst-start`) y de K10 pasan a regresión (`fix-bug`).
- Cualquier otro test de caracterización que caiga: se para y se pregunta.

## Objetivo
El player sigue la zona horaria del sitio (y su horario de verano) mientras la página está abierta, con `timezoneOffset` como reserva, y pinta la diferencia del reloj en horas y minutos exactos. Con esto se cierra la spec 0009.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| `RADPLAPAG_CONFIG.timezone` es la zona IANA del sitio o `null` con desfase manual; `timezoneOffset` se queda | `GlobalsBuilderTest` (`test_timezone`), `SiteTimezoneTest` (integración: `timezone_string` → zona; `gmt_offset` → `null`), `clean-page.spec.ts` (C9) y snapshot `mp3.html` |
| `read-config.ts` acepta una zona válida y descarta lo demás (no string, vacía, zona que `Intl` rechaza) | `read-config.test.ts` (TDD) |
| C9: con zona, día, hora y reloj siguen el DST en cada minuto; sin zona o con una inválida, `timezoneOffset` | vector `tz-dst-start` a `correct` con `timezone: "America/New_York"` y vectores `tz` nuevos con zona (fin del DST, +5:45, −3:30 con DST) en `schedule-vectors.test.ts` y `WeekTest`; `timezone.test.ts` y `now-playing.test.ts` (C9 a regresión); `transmission-time.test.ts`; `use-program-schedule.test.tsx` y `use-transmission-time.test.tsx` |
| K10: `+6`, `-3`, `+5:30`, `-5:45`, `+12:45`, simétrica | `timezone.test.ts` (K10 a regresión) |
| Contrato: ADR 0046; `SPEC.md` §3.3 y §3.8; C9 y K10 → «corregido (spec 0009)» | revisión en `close-phase` |
| Cobertura: TS puro ≥ 90 % líneas; núcleo PHP ≥ 90 % | `npm run check` |
| Cierre de la spec: `SPEC.md` §6, hoja de ruta (nota de la release con K10 y la 0010 partiendo del modelo), PR listo; verificación completa en las dos puntas | `close-phase` (última fase) |

## Tareas

### 4.1 ADR 0046 y `SPEC.md` (≤ 1 h)
- Qué: `write-adr` 0046 «La zona del sitio llega al player»: clave `timezone` (IANA o `null`, derivada del `$now` de `wp_timezone()`), `timezoneOffset` como reserva, desfase actual con `Intl` en cada minuto, validación en `read-config.ts`, diferencia del reloj en `±H:MM` (K10). `SPEC.md` §3.3 (fila de `RADPLAPAG_CONFIG`) y §3.8 (programa actual y reloj según la zona). Índice `docs/adr/README.md`.
- Archivos: `docs/adr/0046-site-timezone-reaches-the-player.md`, `docs/adr/README.md`, `SPEC.md`
- Test: — (documentación)
- Verificación: `npm run check`
- [x] hecha · commit: ver `git log` («docs(0009): add ADR 0046 on the site timezone reaching the player (4.1)»)

### 4.2 `timezone` en `RADPLAPAG_CONFIG` (PHP + e2e, `fix-bug` C9, parte PHP) (≤ 1 h)
- Qué: rojo primero: `GlobalsBuilderTest::test_timezone` (proveedor: `UTC`, `Asia/Kolkata`, `America/New_York` → la zona; `-03:30`, `+00:00` → `null`), `test_config_with_a_full_station` con la clave, `SiteTimezoneTest` (zona y `null`) y la regresión de `clean-page.spec.ts`. Después `Globals_Builder::config()` (clave, docblock y `@return`). Snapshots `mp3.html` y `minimal.html` regenerados; comentarios de `seed-e2e.php` y `normalize.mjs`.
- Archivos: `includes/src/player/class-globals-builder.php`, `tests/php/unit/Player/GlobalsBuilderTest.php`, `tests/php/integration/Schedule/SiteTimezoneTest.php`, `tests/e2e/clean-page.spec.ts`, `tests/e2e/snapshots/{mp3,minimal}.html`, `tests/e2e/fixtures/seed-e2e.php`, `tests/e2e/support/normalize.mjs`
- Test: primero (regresión): los de arriba
- Verificación: `npm run test:php:unit -- --filter GlobalsBuilder && npm run test:php:integration -- --filter SiteTimezone && npm run lint:phpstan && npx playwright test tests/e2e/clean-page.spec.ts`
- Rojo visto: `GlobalsBuilderTest` (`Undefined array key "timezone"` en los 5 casos de `test_timezone`; a `test_config_with_a_full_station` le falta `'timezone' => 'UTC'`), `SiteTimezoneTest` (`Undefined array key "timezone"` en los dos tests nuevos) y `clean-page.spec.ts` C9 (el `toContain` de `"timezoneOffset":5.5,"timezone":"Asia\/Kolkata"}`). La fila C9 de `known-issues.md` se queda abierta hasta la 4.5 (parte del player).
- [x] hecha · commit: ver `git log` («fix(0009): print the site timezone in RADPLAPAG_CONFIG (4.2)»)

### 4.3 `read-config.ts`: `timezone` (≤ 1 h)
- Qué: TDD en `read-config.test.ts`: zona válida → la zona; `null`, ausente, `''`, número, `'Not/AZone'` → `undefined`. `PluginConfig.timezone?: string | null` y `ResolvedConfig.timezone?: string` en `types/global.ts`. La validación con `try { new Intl.DateTimeFormat('en-US', { timeZone }) }`.
- Archivos: `player/src/core/config/read-config.ts`, `player/src/core/config/read-config.test.ts`, `player/src/types/global.ts`
- Test: primero (TDD): `read-config.test.ts`
- Verificación: `npm --prefix player run check`
- Rojo visto: las tres zonas válidas (`UTC`, `Asia/Kolkata`, `America/New_York`) daban `undefined`; los casos rechazados ya pasaban.
- [x] hecha · commit: ver `git log` («feat(0009): read the site timezone in readConfig (4.3)»)

### 4.4 C9 en el núcleo del player (`fix-bug`) (≤ 1 h)
- Qué: rojo primero: `timezone.test.ts` C9 → «follows daylight saving time with the site zone» (`getStationOffset('America/New_York', -5)` a las 08:30Z da −4; `04:30`) más casos de `getStationOffset()` (sin zona, zona inválida, +5:45, −3:30, `TZ` del navegador distinta, inicio y fin del DST); `now-playing.test.ts` C9 → `getNowPlaying(schedule, PROGRAMS, -5, 'America/New_York')` da «News»; vector `tz-dst-start` a `correct` (sin `currently`/`issue`/`correct`, con `timezone`) y vectores nuevos `tz-zone-dst-end`, `tz-zone-kathmandu`, `tz-zone-st-johns-dst`; `_doc` de `tz`. `schedule-vectors.test.ts` y `WeekTest::data_tz_vectors()` leen `timezone`. Después: `getStationOffset()` en `utils/timezone.ts` (docblocks de lo que decía «handles DST automatically») y `getNowPlaying(…, timezone?)`.
- Archivos: `player/src/utils/timezone.ts`, `player/src/utils/timezone.test.ts`, `player/src/core/schedule/now-playing.ts`, `player/src/core/schedule/now-playing.test.ts`, `player/src/utils/schedule-vectors.test.ts`, `tests/fixtures/schedule-vectors.json`, `tests/php/unit/Schedule/WeekTest.php`
- Test: regresión (`fix-bug`)
- Verificación: `npm --prefix player run check && npm run test:php:unit -- --filter WeekTest`
- Rojo visto: `getStationOffset is not a function` en `timezone.test.ts` (C9 y los casos nuevos) y en los 7 vectores `tz` de `schedule-vectors.test.ts`; `now-playing.test.ts` C9 daba «Morning Show» en vez de «News». `WeekTest` ya pasaba con la zona (C9 es solo del player en PHP). La fila C9 de `known-issues.md` se queda abierta hasta la 4.5 (reloj, hooks y modales).
- [x] hecha · commit: ver `git log` («fix(0009): follow the site zone in the player schedule core (4.4)»)

### 4.5 C9 en el reloj, los hooks y los modales (≤ 1 h)
- Qué: rojo primero: `transmission-time.test.ts` «follows the station daylight saving time with its zone» (`getTransmissionTime(-5, 'America/New_York')`: hora y diferencia con −4); `use-program-schedule.test.tsx` y `use-transmission-time.test.tsx` con `timezone` en la global. Después `getTransmissionTime(timezoneOffset, timezone?)` (calcula `getStationOffset()` una vez por minuto), los dos hooks (pasan `timezone`, también en las dependencias del `useMemo`) y `ScheduleModal`/`AllProgramsModal` (`getCurrentTimeInTimezone(getStationOffset(config.timezone, config.timezoneOffset))`). `known-issues.md` C9 → «corregido (spec 0009)».
- Archivos: `player/src/core/clock/transmission-time.ts` (+ test), `player/src/hooks/use-program-schedule.tsx` (+ test), `player/src/hooks/use-transmission-time.tsx` (+ test), `player/src/components/dashboard/ScheduleModal.tsx`, `player/src/components/dashboard/AllProgramsModal.tsx`, `docs/known-issues.md`
- Test: primero (regresión)
- Verificación: `npm --prefix player run check && npx playwright test tests/e2e/modals.spec.ts tests/e2e/schedule.spec.ts`
- Rojo visto: los tres tests C9 usaban el desfase servido (−5): `transmission-time` daba `03:30`, `use-transmission-time` `02:00` tras el cambio y `use-program-schedule` «Morning Show» en vez de «News». Los modales no tienen test unitario; los cubren `modals.spec.ts` y `schedule.spec.ts` (26/26, con el seed en `Asia/Kolkata`).
- [x] hecha · commit: ver `git log` («fix(0009): follow the site zone in the player clock, hooks and modals (4.5)»)

### 4.6 K10: diferencia del reloj en `±H:MM` (`fix-bug`) (≤ 1 h)
- Qué: rojo primero: `timezone.test.ts` K10 → «formats 45-minute differences exactly and symmetrically» (`5.75` → `+5:45`, `-5.75` → `-5:45`, `12.75` → `+12:45`) y las filas `5.5`/`-9.5` → `+5:30`/`-9:30` (ver «Contexto»); `getTimezoneDifference()` en minutos enteros (caso con ruido de coma flotante). Después `formatTimezoneDifference()` y `getTimezoneDifference()`. `known-issues.md` K10 → corregido; nota de la release en `docs/specs/README.md` (K10).
- Archivos: `player/src/utils/timezone.ts`, `player/src/utils/timezone.test.ts`, `docs/known-issues.md`, `docs/specs/README.md`
- Test: regresión (`fix-bug`)
- Verificación: `npm --prefix player run check && npm run check`
- Rojo visto: `formatTimezoneDifference` daba `+5.5`, `-9.5` y `+5.8` (45 minutos); `getTimezoneDifference(0.1 + 0.2, 0)` daba `0.30000000000000004`. Nota para el changelog: el reloj pinta `+5:30` donde antes `+5.5` (ya en la nota de la release de `docs/specs/README.md`). Caracterización editada con aprobación del usuario (2026-10-23): `transmission-time.test.ts` «ignores differences under the 0.01 h threshold» espera `timeDifference: 0` (antes `0.005`) con un desfase de 18 s, porque la diferencia va en minutos enteros. También aprobado: el ayudante `openAt()` de `tests/e2e/schedule.spec.ts` espera `+5:30` en vez de `+5.5` (el cambio visible de K10).
- [x] hecha · commit: ver `git log` («fix(0009): format the clock difference in hours and minutes (4.6)»)

## Decisiones abiertas → ADR
- La de esta fase es el ADR 0046 (4.1). Sin otras.
