# Bugs heredados de radio-player-page-next

> Importado el 2026-10-16 de `../radio-player-page-next` (proyecto abandonado). Era una especificación inversa de la 3.4.2 para una reconstrucción que no se hará. **De allí solo se conserva este catálogo de comportamientos dudosos y los vectores del horario.** Todo lo demás (arquitectura de la 4.0, Interactivity API, `player-core`, URL propia de la emisora…) queda descartado.
>
> Las decisiones «corregir o replicar» se tomaron para la 4.0. Aquí son **propuestas**: en la spec 0002 (red de seguridad) cada caso se confirma contra la 3.4.2 con un test `currently` y se vuelve a triagear con el usuario.

## Catálogo C1–C16

| # | Comportamiento de la 3.x | Propuesta heredada |
|---|---|---|
| C1 | `crossOrigin = 'anonymous'` siempre: un stream de otro origen sin CORS puede no sonar | Pendiente: medir |
| C2 | HLS/DASH se detectan por el sufijo exacto de la URL; con query string (`…/live.m3u8?token=x`) no se detectan | Corregir: sufijo del `pathname`, sin distinguir mayúsculas |
| C3 | `start == end`: el servidor lo acepta como 24 h, el admin lo rechaza | Corregir: válida como franja de 24 h que cruza la medianoche, en el servidor y en el admin |
| C4 | El diálogo de parrilla no marca «On Air» en la franja de ayer que cruza la medianoche y sigue sonando (los bloques y el diálogo de programas sí) | Corregir |
| C5 | `particles` indexa con `floor(i / 50 · 1024)` recortado a 127, pero hay 128 valores: casi todas las partículas leen el último | Corregir con `floor(i / 50 · data.length)`. **Toca los visualizadores** |
| C6 | «Show more» aparece aunque no haya descripción larga, y los horarios solo se ven al expandir | Corregir: «Broadcast Times» siempre visibles; «Show more» solo con descripción larga |
| C7 | Pausa + Play reanuda desde el buffer, no desde el directo | Corregir: Play recarga el directo (salvo durante la bienvenida) |
| C8 | Sin reconexión automática | Replicar (mejora futura) |
| C9 | Desplazamiento horario fijo, calculado en la petición (no sigue los cambios de horario de verano mientras la página está abierta) | Pendiente |
| C10 | Las franjas admiten programas en borrador, que luego no se muestran en ningún sitio, sin avisar | Corregir: el select solo lista publicados; un borrador ya asignado se conserva y aparece como «(Draft — hidden until published)»; el servidor sigue aceptando cualquier programa existente |
| C11 | `uninstall.php` no borra `radplapag_settings` ni los transients | Corregir (guidelines del directorio: no dejar restos) |
| C12 | El programa usa el editor de bloques y la emisora el clásico | Corregir: clásico en ambos |
| C13 | Un stream `http` en un sitio `https` no da ningún aviso | Corregir: advertencia (no error) al guardar |
| C14 | (Cambio de idioma propio de la arquitectura 4.0) | **No aplica** |
| C15 | `alt` literales sin traducir («Background», «Logo»), un `alt` roto en el avatar del programa y el canvas con `role="img"` | Corregir: `alt` traducibles o vacíos si son decorativos; canvas `aria-hidden`. **La parte del canvas toca los visualizadores** |
| C16 | Una franja que cruza la medianoche cuenta como activa en la madrugada de su propio día (`ahora >= start \|\| ahora < end`) y tapa a la del día anterior. Afecta al reproductor, a los bloques y a `radplapag_get_now_playing_for_station()` | Corregir: una franja de hoy que cruza la medianoche solo está activa si `ahora >= start`; la madrugada la cubre la evaluación del día anterior |

## Definiciones del horario (para leer los vectores)

- `minutes(HH:MM) = HH · 60 + MM`. Día de la semana con 0 = domingo … 6 = sábado.
- «Ahora» = día y minuto en la zona horaria de la emisora.
- **Franja activa hoy:** si `end > start`, `start <= ahora < end`. Si `end <= start` (cruza la medianoche, o 24 h si son iguales): `ahora >= start` (comportamiento corregido; la 3.x usa `ahora >= start || ahora < end`, C16).
- **Franja activa de ayer:** solo si `end <= start` y `ahora < end`.
- «Siguiente» se anuncia como máximo 10 minutos antes (límite incluido). El fin de una franja es exclusivo.

## Vectores del horario (semilla de `tests/fixtures/schedule-vectors.json`)

Parrilla de prueba (hora de la emisora):

| Día       | Franja      | Programa             | Rerun |
| --------- | ----------- | -------------------- | ----- |
| lunes     | 06:00–10:00 | A                    | no    |
| lunes     | 10:00–14:00 | B                    | sí    |
| lunes     | 22:00–02:00 | C (cruza medianoche) | no    |
| martes    | 02:00–04:00 | D                    | no    |
| miércoles | 00:05–01:00 | H                    | no    |
| sábado    | 23:00–23:50 | G                    | no    |
| domingo   | 23:55–00:30 | E (cruza medianoche) | no    |

| #   | Ahora         | Actual                                                       | Siguiente                         |
| --- | ------------- | ------------------------------------------------------------ | --------------------------------- |
| 1   | lunes 05:59   | —                                                            | A (1 min)                         |
| 2   | lunes 06:00   | A                                                            | —                                 |
| 3   | lunes 09:50   | A                                                            | B rerun (10 min, límite incluido) |
| 4   | lunes 09:49   | A                                                            | — (11 min)                        |
| 5   | lunes 10:00   | B rerun                                                      | —                                 |
| 6   | lunes 23:00   | C (hoy)                                                      | —                                 |
| 7   | martes 01:00  | C (de ayer)                                                  | —                                 |
| 8   | martes 01:55  | C (de ayer)                                                  | D (5 min)                         |
| 9   | martes 02:00  | D (C ya terminó: fin exclusivo)                              | —                                 |
| 10  | martes 23:58  | —                                                            | H (7 min, mañana)                 |
| 11  | sábado 23:50  | — (G terminó)                                                | —                                 |
| 12  | domingo 23:52 | —                                                            | E (3 min)                         |
| 13  | lunes 00:10   | E (de ayer, domingo) · en la 3.x salía C (C16)               | —                                 |
| 14  | lunes 00:30   | — (E terminó) · en la 3.x salía C (C16)                      | —                                 |

Vectores de validación (§5.4): solape en el mismo día; franja que cruza medianoche y choca con la primera del día siguiente (domingo → lunes incluido); límite exacto permitido (`22:00–02:00` y siguiente día `02:00`); formato `24:00` inválido; fila incompleta; programa inexistente; `start == end` válida como 24 h, y en conflicto con otra franja de su día o con una del día siguiente que empiece antes de su fin (C3). Vectores de resolución para C3: franja martes `08:00–08:00`, ahora martes 23:00 → activa (hoy); miércoles 07:59 → activa (de ayer); miércoles 08:00 → no.
