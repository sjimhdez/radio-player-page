# ADR 0046 — La zona del sitio llega al player

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0009 (fase 4, tarea 4.1)

## Contexto

- PHP ya sigue el horario de verano en cada petición: `WP\Clock::now()` usa `wp_timezone()` y el núcleo resuelve con ese `$now` (`WeekTest::test_daylight_saving_time`, `SiteTimezoneTest`).
- **C9 (baja).** `Player\Globals_Builder::config()` imprime `timezoneOffset = $now->getOffset() / 3600`, el desfase de la petición, y el player lo usa fijo mientras la página está abierta. Con una zona con horario de verano, al cambiar la hora el día y la hora de la emisora, el programa en antena y el reloj se quedan una hora atrás o adelante hasta recargar. El player no puede corregirlo: le llega un número (`5.5`), no la zona.
- **K10 (baja).** `formatTimezoneDifference()` redondea a un decimal con `Math.round`: una diferencia de 45 minutos sale distinta según el signo (`5.75` → `+5.8`, `-5.75` → `-5.7`) y nunca exacta (Nepal, UTC+5:45; Chatham, UTC+12:45). Las de 30 minutos salen como `+5.5`.
- `wp_timezone()` devuelve la zona IANA de `timezone_string` si existe y, si no (desfase manual en Ajustes → Generales), un desfase `±HH:MM` construido con `gmt_offset`.
- `Intl.DateTimeFormat` con `timeZone` IANA está en todos los navegadores soportados (ADR 0027); una zona antigua o rara de la base de datos de PHP puede no existir en el `Intl` de un navegador concreto (riesgo 4 de la spec).
- Caracterizado en la spec 0002: filas C9 y K10 de [`known-issues.md`](../known-issues.md). Decisiones D6 y D8 de la spec 0009 (§4.1).

## Decisión

1. **Clave nueva `timezone` en `window.RADPLAPAG_CONFIG`**, detrás de `timezoneOffset`: la zona IANA del sitio (`"America/New_York"`, `"UTC"`) o `null` si el sitio usa un desfase manual. Sale del mismo `$now` que ya recibe `Globals_Builder::config()`: `$now->getTimezone()->getName()`, o `null` si el nombre es un desfase (empieza por `+` o `-`). Equivale a `get_option( 'timezone_string' )` (D8) sin parámetro nuevo, y la zona y el desfase no pueden discrepar.
2. **`timezoneOffset` se queda** con el mismo significado (desfase de la petición, en horas) y es la reserva: sin zona, o con una zona que el navegador no acepta, el player hace lo de siempre.
3. **Validación en `core/config/read-config.ts`:** `timezone` se resuelve a `string | undefined`. Una cadena no vacía que `new Intl.DateTimeFormat('en-US', { timeZone })` acepta es la zona; `null`, ausente, `''`, un no-string o una zona que `Intl` rechaza → `undefined`.
4. **Desfase actual con `Intl` (D6).** `getStationOffset( timezone, timezoneOffset, now? )` en `utils/timezone.ts` da el desfase **actual** de la zona en horas (de minutos enteros), con `Intl.DateTimeFormat(…).formatToParts()` y `hourCycle: 'h23'`, y cae a `timezoneOffset` sin zona o si `Intl` falla. Los llamadores (programa en antena, reloj, hooks y modales) lo calculan en cada minuto, en el tic que ya tienen, y lo pasan a las funciones de siempre (`getCurrentTimeInTimezone()`, `formatTimeInTimezone()`, `getTimezoneDifference()`), que conservan su firma. `getNowPlaying()` y `getTransmissionTime()` ganan un parámetro opcional `timezone`.
5. **Diferencia del reloj en horas y minutos exactos (K10).** `getTimezoneDifference()` resta en minutos enteros y sigue devolviendo horas. `formatTimezoneDifference()` pinta `±H` si la diferencia es de horas enteras y `±H:MM` si no, simétrica según el signo: `+6`, `-3`, `+5:30`, `-5:45`, `+12:45`. La diferencia cero sigue siendo `+0` (el reloj no se muestra en ese caso).
6. **El horario sigue siendo informativo** (invariante 4): la zona solo cambia qué se muestra, nunca la reproducción.

## Consecuencias

- Con zona IANA, el día y la hora de la emisora, el programa en antena, «Coming up», el «On Air» de los modales y el reloj siguen el horario de verano sin recargar la página. Con desfase manual no cambia nada (ese sitio no tiene horario de verano en WordPress).
- `RADPLAPAG_CONFIG` gana una clave: un tercero que la lea puede usarla; quien la ignore no nota nada. Las claves existentes no cambian (`SPEC.md` §3.3). Va en el changelog.
- La diferencia del reloj cambia de texto en las zonas de media hora (`+5.5` → `+5:30`). Va en el changelog.
- El desfase con `Intl` se calcula una vez por minuto en cada llamador, no por render: el coste es despreciable.
- Hay que vigilar que la página en caché de antes de la actualización (sin `timezone`) siga funcionando: `read-config.ts` la trata como `undefined` y se usa `timezoneOffset`.
- Lo protegen `GlobalsBuilderTest` (`test_timezone`), `SiteTimezoneTest` (integración), `clean-page.spec.ts` (C9) y los snapshots `mp3.html` y `minimal.html`; `read-config.test.ts`; `timezone.test.ts` (C9, K10 y `getStationOffset()`), `now-playing.test.ts`, `transmission-time.test.ts`, `use-program-schedule.test.tsx` y `use-transmission-time.test.tsx`; y los vectores `tz` con zona (`tz-dst-start` a `correct`, fin del DST, +5:45, −3:30 con DST) en `schedule-vectors.test.ts` y `WeekTest`.

## Alternativas descartadas

- **Cambiar `timezoneOffset` por la zona:** rompe a quien lea la clave (contrato, `SPEC.md` §3.3) y deja sin reserva al sitio con desfase manual o al navegador que no conoce la zona.
- **Imprimir la tabla de transiciones del horario de verano** (siguiente cambio y desfase nuevo) en vez de la zona: más datos en la global, calculados en PHP para una ventana fija, y una página abierta más allá de esa ventana vuelve a C9. `Intl` ya tiene las reglas.
- **Leer `get_option( 'timezone_string' )` en el envoltorio** y pasarlo como parámetro nuevo a `config()`: dos fuentes para la zona y el desfase que podrían discrepar (un filtro sobre `wp_timezone()`), y una firma más que cambiar. `$now` ya lleva la zona.
- **Reescribir el cálculo del día y la hora en el player sobre `Intl`** en cada función: cambia las firmas de `utils/timezone.ts` y todos sus tests de caracterización; calcular el desfase actual y pasarlo a las funciones de siempre da lo mismo con menos superficie.
- **Usar la zona del navegador** para el programa en antena: el horario es el de la emisora, no el del oyente.
- **Seguir pintando la diferencia con decimales** pero bien redondeados (`+5.75`): no es como se escribe una hora y no se lee de un vistazo.

Evidencia: [`spec.md`](../specs/0009-schedule-model/spec.md), [`phase-4.md`](../specs/0009-schedule-model/phase-4.md), filas C9 y K10 de [`known-issues.md`](../known-issues.md).
