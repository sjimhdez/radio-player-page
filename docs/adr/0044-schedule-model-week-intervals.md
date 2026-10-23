# ADR 0044 — Modelo del horario: intervalos de la semana

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0009 (fase 1, tarea 1.1)

## Contexto

- El horario se resuelve con «día de la semana + minutos del día», y cada capa lo repite a su manera: PHP (`Schedule\Time`, `Now_Playing_Resolver`, `Schedule_View`, `Programs_List_View`, `Slot_Validator`), el player (`player/src/utils/program-schedule.ts`) y el admin (`admin/js/schedule-rules.js`). Las tres versiones no coinciden y tienen fallos.
- **C16 (alta).** Una franja que cruza la medianoche cuenta como activa en la madrugada de su propio día (`ahora >= start || ahora < end`) y tapa a la del día anterior: con «domingo 23:00–01:00 (E)» y «lunes 23:00–01:00 (C)», el lunes a las 00:10 sale C y no E (vector 13). Afecta al player, a los tres bloques, a `radplapag_get_now_playing_for_station()` y a `radplapag_is_slot_active()`.
- De C16 salen **C4** (el modal del horario no marca «On Air» en la franja de ayer), **K8** (el player no mira ayer si hoy no tiene franjas) y **K52** (un programa de 24 h, o partido en la medianoche, se anuncia a sí mismo en «Coming up»; hace fallar `a11y.spec.ts` de 23:50 a 23:59 hora del sitio).
- Con franjas solapadas (solo en una meta escrita a mano: el guardado las rechaza), cada capa elige distinto: PHP la primera activa del orden guardado; el player, la de inicio más temprano.
- Caracterizado en la spec 0002: filas C4, C16, K8 y K52 de [`known-issues.md`](../known-issues.md) y los vectores de [`schedule-vectors.json`](../../tests/fixtures/schedule-vectors.json).

Decisiones D1 y D3 de la spec 0009 (§4.1), del usuario el 2026-10-21 y el 2026-10-23.

## Decisión

1. **Modelo común (D1).** En las tres capas (`Schedule\Week_Interval` en PHP, `player/src/utils/week-interval.ts` y `radplapagScheduleRules` en el admin), con las mismas operaciones y los vectores `model` de `schedule-vectors.json`:
   - Minuto de la semana `w = día × 1440 + minuto`, con lunes = 0 y domingo = 6 (`0 ≤ w < 10080`).
   - Una franja es el intervalo `[w_inicio, w_inicio + duración)`, que da la vuelta al domingo, con `duración = (end - start + 1440) % 1440 || 1440`: `end > start` dura `end - start`; `end < start` cruza la medianoche; `start == end` dura 24 h.
   - Está activa en `t` si `(t - w_inicio + 10080) % 10080 < duración`. Minutos hasta su inicio: `(w_inicio - t + 10080) % 10080`. Dos franjas se solapan si sus intervalos se cortan, con la vuelta de la semana.
   - En particular, una franja **no** está activa en su propio día antes de su inicio (C16).
2. **Programa en antena (D3).** Es la franja activa que empezó más tarde (menor tiempo desde su inicio); a igualdad (mismo inicio, luego el mismo día), la primera en el orden guardado del día. Igual en PHP y en el player.
3. **«Coming up» (D3, K52).** La franja de menor espera con `0 < espera ≤ RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES` (10), a igualdad la primera en el orden guardado del día, **salvo** la del mismo programa que suena y que empieza justo cuando acaba la actual (24 h todos los días; lunes 22:00–00:00 + martes 00:00–02:00). En PHP basta `start` (una franja sin `end` cuenta, como hoy).
4. **`radplapag_is_slot_active( $start, $end, $current_minutes, $is_prev_day_crossing = false )`** conserva su firma y delega en el modelo. Con `$is_prev_day_crossing = false` y `end <= start`, devuelve `true` solo con `$current_minutes >= start` (antes también con `$current_minutes < end`). La rama del día anterior y las franjas que no cruzan la medianoche no cambian.
5. El formato guardado (`SPEC.md` §3.1) no cambia: no hay migración de datos.

## Consecuencias

- Un solo modelo, probado con los mismos vectores en las tres capas: PHP y player dan el mismo programa actual y siguiente, también ayer con hoy vacío (K8), el domingo → lunes y las 24 h.
- Un tercero que llama a `radplapag_is_slot_active()` con una franja que cruza la medianoche, en su propio día y antes de su inicio, recibe ahora `false` (riesgo 2 de la spec). Es la corrección aprobada; va en el changelog de la release.
- Con franjas solapadas escritas a mano, el ganador puede cambiar respecto a la 3.4.2 (riesgo 6). Fuera del contrato; lo fijan los tests de D3 en `NowPlayingResolverTest` y `program-schedule.test.ts`.
- `now-playing` deja de pintar dos `article` en la ventana de K52: `a11y.spec.ts` («blocks page with a program always on air») deja de depender de la hora sin cambiarlo. La ventana de las 23:55 la cubren `BlockAuditTest` (con `Support/Clock`) y el núcleo; el e2e no puede fijar la hora con `page.clock`, porque `now-playing` se pinta en el servidor.
- La validación del admin y de `Slot_Validator` pasa al modelo en la fase 3 de la spec 0009 (D2), conservando códigos, mensajes y orden de los errores.
- Lo protegen `WeekIntervalTest.php`, `week-interval.test.ts`, `schedule-rules.test.js` (bloque `model`), los tests de regresión de C16, C4, K8 y K52 y los vectores 13, 14, C3-2, C3-4 y los nuevos de K52.

## Alternativas descartadas

- **Parchear cada capa** (la condición de `Time::is_slot_active()` y de `isProgramActive()` por separado): arregla C16 pero deja tres aritméticas que ya divergían (K8, D3) y que la fase 3 tendría que volver a tocar para la validación (D2).
- **Dejar que el primer activo del orden guardado gane con solapes** (lo que hace PHP): en una meta escrita a mano tapa el programa que acaba de empezar con el que lleva horas; el más reciente es lo que el oyente espera oír.
- **Cambiar la firma de `radplapag_is_slot_active()`** para que reciba minutos de la semana: es contrato (`SPEC.md` §3.4); el modelo vive en el namespace interno.
- **Anunciar igualmente el mismo programa contiguo** y ocultarlo en la vista: el dato de `radplapag_get_now_playing_for_station()` seguiría siendo falso para los terceros.

Evidencia: [`spec.md`](../specs/0009-schedule-model/spec.md), [`phase-1.md`](../specs/0009-schedule-model/phase-1.md), filas C4, C16, K8 y K52 de [`known-issues.md`](../known-issues.md).
