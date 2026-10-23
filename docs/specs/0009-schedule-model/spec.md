# Spec 0009 — Correcciones: horario y programa en antena

> Estado: **propuesta** · Fecha: 2026-10-23 · Rama: `spec/0009-schedule-model` · Depende de: 0005, 0006
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0006, 0017, 0019, 0023, 0028 y 0029, `SPEC.md` §3.1 (formato del horario), §3.3, §3.4, §3.5, §3.6 y §3.8, `.claude/rules/testing.md` y `php.md`, y las filas C3, C4, C9, C10, C16, K8, K10, K17, K41, K52 y K78 de `docs/known-issues.md`. Su columna «Decisión del usuario» es el mandato, con las precisiones de §4.1.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0009-schedule-model/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Es una spec de correcciones, pero no de parches** (usuario, 2026-10-21): el mismo modelo de «día + horas» está tres veces (PHP, player y admin) y se rehace en las tres desde un modelo común. Primero el modelo, con TDD; después cada fila con `fix-bug`. Su test `currently` pasa a test de regresión en rojo y luego a verde, en todas las capas que cite la fila, y la fila pasa a «corregido (spec 0009)». Ningún otro test de caracterización se edita para que pase; las excepciones son las de §4.3. Si cae otro test, se para y se pregunta.
5. `tests/fixtures/schedule-vectors.json` es la red: lo leen las tres capas y cada vector nuevo tiene resultado en todas las que lo leen.
6. Fuera de alcance aunque estén cerca: K16, K74 y K75 (0010), y el editor de franjas del admin (0010). Esta spec cambia la aritmética del horario del admin, no su DOM.

## 1. Contexto y objetivo

El horario se resuelve con «día de la semana + minutos del día», y cada capa lo repite a su manera: PHP (`Schedule\Time`, `Now_Playing_Resolver`, `Schedule_View`, `Programs_List_View` y `Slot_Validator`), el player (`utils/program-schedule.ts`) y el admin (`admin/js/schedule-rules.js`). De ahí salen la mayoría de los bugs:

- Una franja que cruza la medianoche cuenta como activa en la madrugada de su propio día y tapa a la del día anterior (C16, alta). Este es el origen de C4 (el modal no marca la franja de ayer), K8 (el player no mira ayer si hoy está vacío) y K52 (un programa de 24 h, o partido en la medianoche, se anuncia a sí mismo).
- El admin rechaza `start == end`, que el servidor acepta como 24 h (C3).
- Las franjas de programas no publicados se cuelan en la página limpia y en los bloques (C10, K41, programas con contraseña, K78). Sin franjas, `RADPLAPAG_SCHEDULE` sale como `[]` (K17).
- El player trabaja con un desfase fijo en la petición, que no sigue el horario de verano (C9) y redondea mal las diferencias de 45 minutos (K10).

Al cerrar la spec, las tres capas comparten un modelo: cada franja es un **intervalo en minutos de la semana** que da la vuelta al domingo. De él salen el programa actual y el siguiente, «en directo», los solapes y las 24 h, con los mismos vectores. Solo se publican las franjas de programas publicados sin contraseña, y el player sigue la zona del sitio. Todas las filas de §2 están corregidas con su test de regresión. `SPEC.md` describe el contrato nuevo con tres ADRs.

**No objetivos:** el editor de franjas, K16, K74, K75 y el resto de la 0010; los enlaces a páginas no servidas (K50, 0013); la interfaz del player (0011); C8 (no se corrige). No hay migración de datos: el formato guardado no cambia.

## 2. Criterios de aceptación

- **Modelo (TDD, tres capas):** cada capa tiene un módulo con las mismas operaciones: franja → intervalo de la semana, «contiene este instante», minutos hasta el próximo inicio y solape de dos franjas. Se prueban con los vectores nuevos de `model` en `schedule-vectors.json`: cruce de medianoche, domingo → lunes, `start == end` (24 h) y franja que termina a las `00:00`. Tests: `tests/php/unit/Schedule/WeekIntervalTest.php`, `player/src/utils/week-interval.test.ts` y `tests/js/admin/schedule-rules.test.js`.
- **C16:** los vectores 13, 14 y C3-4 pasan a su resultado `correct` en el núcleo PHP, la integración, los bloques (`ScheduleViewTest`, `ProgramsListViewTest`, `BlockDataTest`), `radplapag_is_slot_active()` (`ScheduleHelpersTest`, `TimeTest`), el player (`schedule-vectors.test.ts`, `program-schedule.test.ts`) y el e2e (`schedule.spec.ts`: el lunes a las 00:10 se ve E, no C).
- **C4:** el modal del horario marca «On Air» en la franja de ayer que sigue sonando (`program-schedule.test.ts` sobre `getProgramsForDay()`; `modals.spec.ts`: el martes a la 01:00, la tarjeta de C del lunes lleva «On Air»).
- **K8:** el vector C3-2 da en el player el resultado de PHP (se borra su objeto `ts`), y el sábado a la 01:00 sale el programa del viernes 22:00–02:00 (`program-schedule.test.ts`).
- **K52:** «Coming up» no anuncia la franja siguiente si es del **mismo programa que suena y empieza justo cuando acaba la actual** (24 h todos los días; lunes 22:00–00:00 + martes 00:00–02:00). Tests: `NowPlayingResolverTest`, `BlockAuditTest`, `program-schedule.test.ts` y vectores nuevos. `a11y.spec.ts` («blocks page with a program always on air») espera un solo `article` a cualquier hora, sin cambiarlo y **sin `page.clock`**: `now-playing` se pinta en el servidor, así que el reloj del navegador no fija su hora (corregido en la 1.1, decisión del usuario del 2026-10-23, ADR 0044). La ventana de las 23:55 la cubren `BlockAuditTest` (con `Support/Clock`) y el núcleo.
- **C10 + contraseña (5.8) + K78:** una franja cuyo programa no está publicado, tiene contraseña o no existe **no cuenta en ningún sitio público**. No se imprime en `RADPLAPAG_SCHEDULE`, su programa no está en `RADPLAPAG_PROGRAMS`, no sale en los bloques (ni con «—») y no la usan el programa en antena ni la ventana de «Coming up» (`radplapag_get_now_playing_for_station()`). Tests: `GlobalsBuilderTest`, `NowPlayingResolverTest`, `ScheduleViewTest`, `BlockDataTest`, `BlockAuditTest`, `clean-page.spec.ts` (K78) y un `test_currently_*` de la contraseña escrito **antes** del arreglo, en integración. En el player, una franja cuyo `program_id` no está en `RADPLAPAG_PROGRAMS` se ignora (`program-schedule.test.ts`).
- **C10 y K41 en el admin:** el servidor sigue guardando la franja (`SanitizeScheduleTest`: el borrador se acepta, ya sin `currently`). Al editar la emisora, una franja con un programa no publicado (borrador, pendiente, programado, privado, en la papelera o con contraseña) muestra el programa seleccionado con su estado y un aviso que no bloquea el guardado: «This program is not published; this time slot is not shown on the site.». El aviso sale al pintar el meta box y al elegir un programa así. Tests: `AdminScreensTest` (el test `currently` de K41 pasa a regresión) y `tests/js/admin/station-validation.test.js` (con el estado, se puede enviar).
- **C3:** el admin acepta `start == end` como 24 h. Los vectores `c3-*` de validación pasan a su `correct` en `station-validation.test.js` y `schedule-rules.test.js`, y desaparece el código `start_equals_end`.
- **Validación sobre el modelo:** `Slot_Validator` y `schedule-rules.js` calculan los solapes con el modelo y conservan los códigos, los mensajes, el orden de los errores y las escrituras de hoy. Todos sus tests que no son `currently` siguen en verde sin editarlos, y también `SanitizeScheduleTest` y los vectores de `validation`.
- **K17:** sin franjas, `RADPLAPAG_SCHEDULE` es `{}` (`GlobalsBuilderTest`, `clean-page.spec.ts`, snapshot `minimal.html`). El player sigue aceptando `[]` de una página en caché: su test pierde el `currently` y no cambia de comportamiento.
- **C9:** `RADPLAPAG_CONFIG.timezone` es el `timezone_string` del sitio (zona IANA) o `null` si el sitio usa un desfase manual. Con zona, el player calcula el día y la hora de la emisora con `Intl` en cada minuto y sigue el horario de verano. Con `null`, o con una zona que `Intl` no acepta, usa `timezoneOffset`. Tests: el vector `tz-dst-start` pasa a `correct` con `timezone: "America/New_York"`, más vectores `tz` con zona; `timezone.test.ts` y `now-playing.test.ts` (C9 a regresión); `read-config.test.ts`; `GlobalsBuilderTest` y `SiteTimezoneTest`; `clean-page.spec.ts` y el snapshot `mp3.html`.
- **K10:** la diferencia del reloj se pinta en horas y minutos exactos, simétrica: `+6`, `-3`, `+5:30`, `-5:45`, `+12:45` (`timezone.test.ts`; la diferencia se calcula en minutos enteros).
- **Contrato:** `SPEC.md` §3.1, §3.3, §3.4, §3.5, §3.6 y §3.8 actualizados con los ADRs de §3. Las filas pasan a «corregido (spec 0009)». En la hoja de ruta, la nota de la release incluye K17 y C10 en el changelog y en `== Upgrade Notice ==`.
- `npm run check`, integración y e2e en las dos puntas (WP 6.6 + PHP 7.4 y última + 8.4), cobertura de la CI y `check:zip` en verde.

## 3. Cambios al contrato (`SPEC.md`)

| Cambio | Sección | ADR previsto | Fase |
|---|---|---|---|
| Semántica del horario: una franja es el intervalo `[inicio, inicio + duración)` de la semana. `end > start`: dura `end - start`; `end < start`: cruza la medianoche; `start == end`: 24 h. Solo está activa desde su inicio, y en su día propio no lo está antes de él (C16). `radplapag_is_slot_active()` conserva su firma; su rama del día propio deja de dar `true` antes del inicio. «Coming up» omite el mismo programa contiguo (K52). Con franjas solapadas (meta escrita a mano), suena la que empezó más tarde | §3.1, §3.4, §3.8 | 0044 «Modelo del horario: intervalos de la semana» | 1 |
| Solo programas publicados y sin contraseña en lo público (C10, 5.8, K78): `RADPLAPAG_SCHEDULE`, `RADPLAPAG_PROGRAMS`, los tres bloques y `radplapag_get_now_playing_for_station()`. `radplapag_get_program_data( $id, true )` también rechaza los programas con contraseña. Sin franjas, `RADPLAPAG_SCHEDULE` es `{}` (K17). En el admin, aviso de programa no publicado sin bloquear el guardado | §3.3, §3.4, §3.5, §3.6 | 0045 «El horario público solo muestra programas publicados» | 2 |
| Clave nueva `timezone` (IANA o `null`) en `RADPLAPAG_CONFIG`; `timezoneOffset` se queda y es la reserva (C9). La diferencia del reloj, en `±H:MM` (K10) | §3.3, §3.8 | 0046 «La zona del sitio llega al player» | 4 |

No cambia el formato guardado (§3.1), ninguna meta, opción ni transient, ni el markup ni los atributos de los bloques: una franja de un programa no publicado deja de pintarse, pero las que se pintan llevan el mismo markup.

## 4. Diseño

### 4.1 Decisiones

| # | Decisión | Origen |
|---|---|---|
| D1 | El modelo, en cada capa: minuto de la semana `w = día × 1440 + minuto` (lunes = 0, domingo = 6; `0 ≤ w < 10080`). Franja → `{ start: w_inicio, duration }` con `duration = (end - start + 1440) % 1440 \|\| 1440`. Está activa en `t` si `(t - start + 10080) % 10080 < duration`. Minutos hasta el inicio: `(start - t + 10080) % 10080` | usuario, 2026-10-21 y 2026-10-23 |
| D2 | El modelo cubre la resolución **y la validación**: dos franjas se solapan si sus intervalos se cortan (con la vuelta de la semana). Cuando las dos franjas son del mismo día el código es `overlap`, y si son de días distintos, `cross_midnight_overlap`. Qué filas se comparan, en qué orden y qué se escribe no cambia (eso es la 0010) | usuario, 2026-10-23 |
| D3 | Programa actual: la franja activa que empezó más tarde (a igualdad, la primera en el orden guardado). Siguiente: la de menor espera con `0 < espera ≤ 10`, salvo la del mismo programa que empieza justo al acabar la actual (K52); a igualdad, la primera | diseño + usuario (K52) |
| D4 | Los datos que ve el modelo ya vienen filtrados. El adaptador de WordPress quita las franjas de programas no publicados, con contraseña o inexistentes **antes** de resolver, con la misma regla en los cinco puntos de entrada: página limpia, los tres bloques y `radplapag_get_now_playing_for_station()`. La regla vive en un solo sitio, junto a `WP\Program_Repository` | C10, 5.8 |
| D5 | Admin (C10/K41): la lista de programas del meta box y de `radplapagAdmin.programs` incluye además el programa de cada franja guardada, con su estado, aunque no sea `publish`/`draft`. Así la franja conserva su programa y se puede guardar. Los `name` del formulario no cambian. La salida de `radplapag_get_all_programs_for_select()` no cambia; lo nuevo va aparte. Textos nuevos en `admin/admin-strings.php` | K41 |
| D6 | Player: el modelo en `player/src/utils/week-interval.ts` (TS puro, junto a `program-schedule.ts`, como dice el D3 de la 0006). La hora de la emisora en `utils/timezone.ts`: con `timezone`, `Intl.DateTimeFormat` (`formatToParts`, `hourCycle: 'h23'`, `weekday`); sin ella, el desfase. `core/schedule/now-playing.ts` y `core/clock/transmission-time.ts` pasan la zona; la diferencia del reloj se calcula en minutos enteros | C9, K10 |
| D7 | PHP: `Schedule\Week_Interval` (núcleo) sustituye la aritmética de `Time` y `Week`. `Time::to_minutes()` y `Week` se quedan si los usa algo más. `radplapag_is_slot_active()` y `radplapag_parse_time_to_minutes()` siguen delegando y conservan su firma | ADR 0028 |
| D8 | `RADPLAPAG_SCHEDULE` vacío: el envoltorio imprime un objeto (`(object) array()` o equivalente); `Globals_Builder::schedule()` sigue devolviendo un array. La zona: `get_option( 'timezone_string' )`, `null` si está vacía | K17, C9 |

### 4.2 Dónde va cada corrección

| Fila | PHP | Player | Admin |
|---|---|---|---|
| C16, K52 | `Schedule\Week_Interval`, `Now_Playing_Resolver`, `Schedule_View`, `Programs_List_View`, `Time` (`radplapag_is_slot_active()`) | `utils/week-interval.ts`, `utils/program-schedule.ts` | — |
| C4, K8 | — | `utils/program-schedule.ts` (`getProgramsForDay()`, `findActiveProgram()`) | — |
| C10, 5.8, K78, K41 | `WP\Program_Repository`, `Player\Globals_Builder::program_ids()`, los envoltorios de `radio-player-page.php` y `includes/radplapag-*-block.php`, el meta box de `includes/radplapag-station-cpt.php` | `utils/program-schedule.ts` (ignora lo que no está en `programs`) | `admin/js/station-admin.js` (aviso), `admin/admin-strings.php` |
| C3 | (ya acepta 24 h) | — | `admin/js/schedule-rules.js` |
| D2 | `Schedule\Slot_Validator` | — | `admin/js/schedule-rules.js` |
| K17, C9 | `Player\Globals_Builder::config()`, `radio-player-page.php` | `core/config/read-config.ts`, `types/global.ts`, `utils/timezone.ts`, `core/schedule/now-playing.ts`, `core/clock/transmission-time.ts` | — |
| K10 | — | `utils/timezone.ts` (`formatTimezoneDifference()`) | — |

### 4.3 Tests

- **Vectores:** `schedule-vectors.json` gana una sección `model` (operaciones del modelo) y vectores de resolución para K52 (24 h, partido en la medianoche), domingo → lunes y franjas de programas no publicados (`programs` marcará el estado). Los `tz` ganan el campo `timezone`. Los vectores `currently` pasan a su `correct` y pierden `currently`, `issue` y `correct`; el `_doc` se actualiza.
- **Excepciones a «no editar caracterización»** (por diseño, con su ADR): los snapshots `tests/e2e/snapshots/mp3.html` (clave `timezone`) y `minimal.html` (`{}`); los snapshots de integración de los bloques en los que desaparece una franja de un borrador (solo con `RADPLAPAG_UPDATE_SNAPSHOTS=1` y el diff en el plan); `HooksTest` no cambia. Aprobadas por el usuario el 2026-10-23 (fase 1, D3): `player/src/utils/program-schedule.test.ts` «picks the earliest start when slots overlap» pasa a esperar la franja que empezó más tarde, y `tests/php/unit/Schedule/NowPlayingResolverTest.php` `test_unknown_program_today_falls_back_to_yesterday` espera `null` en la fase 1 (gana la franja de hoy, cuyo programa no se conoce) y `'1'` en la fase 2 (C10 ignora los desconocidos). Cualquier otro test de caracterización que caiga: se para y se pregunta.
- **Tiempo:** PHP con `DateTimeImmutable` inyectado (núcleo) y `Support/Clock` (integración); para C9, `Support/Clock` también fija `timezone_string`. Player con `vi.useFakeTimers()` y varias `TZ`; e2e con `page.clock`. Casos obligatorios: cruce de medianoche, domingo → lunes, cambio de horario de verano (inicio y fin), desfase negativo y fraccionario (+5:30, +5:45).
- La cobertura no baja: núcleo PHP ≥ 90 %, TS puro ≥ 90 % líneas, JS de admin ≥ 85 %.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. Sin spike: no hay riesgo técnico sin resolver (`Intl` con zona IANA está en todos los navegadores soportados, ADR 0027).

### Fase 1 — Modelo y programa en antena (C16 alta; C4, K8 y K52)

- ADR 0044 primero (con `SPEC.md` §3.1, §3.4 y §3.8).
- El modelo con TDD en las tres capas (vectores `model`). En el admin, solo las funciones del modelo, sin usarlas todavía.
- PHP: `Now_Playing_Resolver`, `Schedule_View`, `Programs_List_View` y `Time::is_slot_active()` sobre el modelo (C16, K52). Player: `program-schedule.ts` sobre el modelo (C16, C4, K8, K52). Los e2e de C16 y C4 con `page.clock`; el de `a11y.spec.ts` sin él (§2, K52).
- ✅ **Criterios:** los de modelo, C16, C4, K8 y K52 de §2.

### Fase 2 — Programas no publicados (C10 y K41 media; contraseña, K78 y K17)

- Test `currently` de la contraseña (5.8) antes de tocar nada. ADR 0045 (con `SPEC.md` §3.3–§3.6).
- La regla de D4 y sus cinco puntos de entrada, `Globals_Builder::program_ids()` sobre las franjas impresas (K78), `{}` (K17) y, en el player, las franjas sin programa se ignoran.
- Admin: D5 y el aviso (render y JS).
- ✅ **Criterios:** los de C10 + contraseña + K78, C10 y K41 en el admin, y K17 de §2.

### Fase 3 — Validación sobre el modelo (C3)

- `Slot_Validator` y `schedule-rules.js` calculan los solapes con el modelo (D2), con los tests actuales como red. Después C3 en el admin.
- ✅ **Criterios:** los de validación sobre el modelo y C3 de §2.

### Fase 4 — Zona horaria (C9 y K10) y cierre

- ADR 0046 (con `SPEC.md` §3.3 y §3.8). `timezone` en el servidor, `read-config.ts` y la hora de la emisora con `Intl` (D6). K10.
- Cierre de la spec: `SPEC.md` §6 (historial), hoja de ruta (la nota de la release y la 0010, que parte de este modelo), PR listo.
- ✅ **Criterios:** los de C9, K10 y contrato de §2, y la verificación completa.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Reescribir la validación cambia sin querer un mensaje o el orden de los errores (el admin compone escrituras de varias filas) | Fase propia; los tests de `SlotValidatorTest`, `SanitizeScheduleTest`, `station-validation.test.js` y `schedule-rules.test.js` no se tocan; una diferencia se para y se pregunta | Fase 3 |
| 2 | Un tercero que llama a `radplapag_is_slot_active()` ve el cambio de C16 | Es la corrección aprobada; va en el ADR 0044 y en el changelog | Fase 1 |
| 3 | Un sitio con programas en borrador a propósito (para «reservar» una franja) deja de ver la franja en el bloque | Es C10 (decisión del usuario, 5.2); el aviso del admin lo explica y va en `== Upgrade Notice ==` | Fase 2 |
| 4 | La zona IANA de WordPress no existe en el `Intl` de un navegador viejo | `read-config.ts` la prueba con `try` y cae a `timezoneOffset`, con su test | Fase 4 |
| 5 | Los e2e que dependen de la hora (K52) | `page.clock` en los del player; `now-playing` se pinta en el servidor, así que el de `a11y.spec.ts` no puede fijarla: tras K52 espera un solo `article` a cualquier hora, y las 23:55 las cubren `BlockAuditTest` y el núcleo | Fase 1 |
| 6 | Las franjas solapadas de una meta escrita a mano (D3) cambian de ganador respecto a la 3.4.2 | Fuera del contrato (el guardado las rechaza); un test fija la regla nueva | Fase 1 |

## Apéndice — Referencias

- Filas: C3, C4, C9, C10, C16, K8, K10, K17, K41, K52, K78 y la sospecha 5.8 (`docs/specs/0002-safety-net/phase-5.md`) en `docs/known-issues.md`.
- Vectores: `tests/fixtures/schedule-vectors.json` (spec 0002, §4.1). Reloj de integración: `tests/php/integration/Support/Clock.php`.
- Código: `includes/src/schedule/`, `includes/src/player/class-globals-builder.php`, `includes/src/wp/class-program-repository.php`, `includes/radplapag-*-block.php`, `includes/radplapag-station-cpt.php`, `radio-player-page.php`, `player/src/utils/`, `player/src/core/{schedule,clock,config}/`, `admin/js/schedule-rules.js`, `admin/js/station-admin.js`, `admin/admin-strings.php`.
- Spec 0006, D3 (el horario del player sigue en `utils/`); spec 0005 (`includes/src/`, ADR 0028).
