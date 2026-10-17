# Bugs y rarezas conocidos

> Una fila por hallazgo (spec 0001 §5.2; `.claude/rules/testing.md`). Los bugs **no se corrigen al encontrarlos**: se fijan con un test `currently`, el usuario decide y se corrigen en una spec de correcciones con `fix-bug`.
>
> Sembrado el 2026-10-16 con el catálogo C1–C16 de `radio-player-page-next` (proyecto abandonado; sus «propuestas» eran para una 4.0 que no se hará) y con los candidatos `K*` del spike ([informe](spikes/0001-phase-0.md)). En la spec 0002 cada fila se **confirma contra la 3.4.2** con su test `currently`, o se marca «no se reproduce», y el usuario la triagea.

**Columnas:** origen = catálogo · spike · caracterización · auditoría · axe · guidelines. Estado = sin confirmar · confirmado · no se reproduce · corregido (versión). Decisión del usuario = corregir (spec de correcciones) · otra spec · no arreglar · pendiente.

## Catálogo

| ID | Origen | Descripción (3.4.2) | Archivo | Test que lo fija | Gravedad | Estado | Decisión del usuario |
|---|---|---|---|---|---|---|---|
| C1 | catálogo · spike R3 | Con `crossOrigin = 'anonymous'`, un stream de otro origen **sin CORS no suena**; con HLS/DASH lo bloquea igualmente el XHR. Medido: ningún protocolo suena sin CORS (Chromium y WebKit). Es el precio de los visualizadores (ADR 0013). | `player/src/hooks/use-audio-player.tsx` | — (0002) | alta | confirmado (spike) | pendiente |
| C2 | catálogo | HLS/DASH se detectan con `endsWith('.m3u8' / '.mpd')` sobre la URL entera: con *query string* (`…/live.m3u8?token=x`) o en mayúsculas no se detectan y se tratan como audio directo. Propuesta heredada: sufijo del `pathname`, sin distinguir mayúsculas. | `player/src/hooks/use-audio-player.tsx` | — (0002) | media | sin confirmar | pendiente |
| C3 | catálogo | `start == end`: el servidor lo acepta (24 h), el admin lo rechaza. Propuesta: válida como 24 h en los dos. | `includes/radplapag-station-cpt.php`, `admin/js/station-admin.js` | `tests/php/integration/Schedule/SanitizeScheduleTest.php` (`test_currently_accepts_start_equals_end`, vectores `c3-*`); admin JS en la 1.17 | baja | confirmado (servidor) | pendiente |
| C4 | catálogo | El modal del horario no marca «On Air» en la franja de ayer que cruza la medianoche y sigue sonando (los bloques y el modal de programas sí). | `player/src/components/dashboard/ScheduleModal.tsx` | — (0002) | baja | sin confirmar | pendiente |
| C5 | catálogo | Visualizador `particles`: indexa con `floor(i / 50 · 1024)` recortado a 127 sobre 128 valores; casi todas las partículas leen el último. **Zona congelada** (ADR 0018): solo con ADR. | `player/src/components/visualizers/**` | — | baja | sin confirmar | pendiente |
| C6 | catálogo | «Show more» aparece aunque no haya descripción larga, y los horarios del programa solo se ven al expandir. | `player/src/components/dashboard/AllProgramsModal.tsx` | — (0002) | baja | sin confirmar | pendiente |
| C7 | catálogo | Pausa + Play reanuda desde el buffer, no desde el directo. Propuesta: Play recarga el directo (salvo durante la bienvenida). | `player/src/hooks/use-audio-player.tsx` | — (0002) | media | sin confirmar | pendiente |
| C8 | catálogo | Sin reconexión automática si el stream se corta. Propuesta heredada: replicar (mejora futura). | `player/src/hooks/use-audio-player.tsx` | — (0002) | media | sin confirmar | replicar: no se corrige, mejora futura (spec 0001 §5.2) |
| C9 | catálogo | `timezoneOffset` se calcula en la petición: no sigue un cambio de horario de verano mientras la página está abierta. | `radio-player-page.php`, `player/src/utils/timezone.ts` | — (0002) | baja | sin confirmar | pendiente |
| C10 | catálogo | Las franjas admiten programas en borrador, sin avisar. El programa en antena y la lista de programas los ocultan; el bloque de horario deja la franja con el nombre vacío (imprime «—»). | `includes/radplapag-station-cpt.php`, `admin/js/station-admin.js`, `includes/radplapag-schedule-block.php` | `tests/php/integration/Schedule/SanitizeScheduleTest.php` (`test_currently_accepts_draft_program`); `tests/php/integration/Schedule/BlockDataTest.php` (`test_currently_draft_program_slot_stays_with_empty_name`) | baja | confirmado (servidor y bloque de horario) | pendiente |
| C11 | catálogo | `uninstall.php` no borra `radplapag_settings` ni los transients (`radplapag_migrating`, los dos avisos de migración y los errores de campos y horario por emisora) (guidelines: no dejar restos). Igual en cada sitio de una red. | `uninstall.php` | `tests/php/integration/Uninstall/UninstallTest.php` (`test_currently_keeps_the_legacy_settings_and_the_transients`); `tests/php/integration/Uninstall/UninstallMultisiteTest.php` (`test_currently_keeps_the_legacy_settings_and_the_transients_on_a_subsite`) | media | confirmado | pendiente |
| C12 | catálogo | El programa usa el editor de bloques y la emisora el clásico. **No se reproduce:** los dos CPT solo soportan `title`, así que `use_block_editor_for_post_type()` ya da `false` para el programa sin pasar por el filtro; la emisora lo fuerza además con `radplapag_station_use_classic_editor()`. Comprobado en WP 6.6 y 7.1. | `includes/radplapag-program-cpt.php` | `tests/php/integration/Cpt/CptTest.php` (`test_both_types_use_the_classic_editor`) | — | no se reproduce | — |
| C13 | catálogo | Un stream `http` en un sitio `https` (contenido mixto, no suena) no da ningún aviso al guardar. | `includes/radplapag-station-cpt.php` | — (0002) | media | sin confirmar | pendiente |
| C14 | catálogo | Cambio de idioma propio de la arquitectura 4.0. | — | — | — | **no aplica** | — |
| C15 | catálogo | `alt` literales sin traducir («Background», «Logo»), un `alt` roto en el avatar del programa y el canvas con `role="img"`. La parte del canvas es **zona congelada**. | `player/src/components/**` | — (0002, axe) | media | sin confirmar | pendiente |
| C16 | catálogo | Una franja que cruza la medianoche cuenta como activa en la madrugada de su propio día (`ahora >= start \|\| ahora < end`) y tapa a la del día anterior. Afecta al player, a los bloques y a `radplapag_get_now_playing_for_station()`. Vectores 13 y 14. | `player/src/utils/program-schedule.ts`, `includes/radplapag-now-playing-block.php`, `includes/radplapag-*-block.php` | `tests/php/unit/ScheduleHelpersTest.php` (`radplapag_is_slot_active()`); `tests/php/integration/Schedule/ScheduleVectorsTest.php` (`test_currently_midnight_slot_is_active_early_on_its_own_day`, programa en antena); `tests/php/integration/Schedule/BlockDataTest.php` (`test_currently_midnight_slot_is_live_early_on_its_own_day`, bloques: en el vector 13 hay dos franjas «en directo»); vectores 13, 14 y C3-4 de `tests/fixtures/schedule-vectors.json` | media | confirmado (helper PHP, programa en antena y bloques) | pendiente |
| K1 | spike R3 | En Chromium, un MP3 sin CORS falla (`audio.error = 4`, `paused`) **sin mostrar** «Unable to play the stream». En WebKit sí se muestra; en HLS/DASH, en los dos. | `player/src/hooks/use-audio-player.tsx` | — (0002) | media | confirmado (spike) | pendiente |
| K2 | lectura de la CI | La CI de la 3.4.2 solo compilaba y verificaba `schedule` y `programs-list`: el build de `now-playing` no se comprobaba. | `.github/workflows/test.yml` | job `Block (now-playing)` de `ci.yml` | baja | corregido (spec 0001, fase 1) | — (tooling, no producto) |
| K3 | lectura del README | `README.md` dice «12 languages» (hay 14 locales: faltan `cs` y `hr`). La línea de Node ya se corrigió en la 0001 (ADR 0002). | `README.md` | — | baja | confirmado | pendiente |
| K4 | spike R5 | Un sitio que salte de la 1.0.x–1.1.x a la 3.3+ pierde su emisora en silencio: la opción plana no tiene `stations`, `radplapag_db_version` pasa a `'330'` y `radplapag_settings` queda huérfana, sin aviso. | `includes/radplapag-upgrade.php` | `tests/php/integration/Migration/UpgradeFlowTest.php` (`test_currently_flat_1x_settings_are_orphaned_without_notice`) | alta (sin usuarios afectados) | confirmado | no arreglar: formatos 1.x fuera del contrato (ADR 0005) |
| K5 | caracterización | `radplapag_save_program_meta()` corta la descripción a 256 bytes y la extendida a 512 con `substr()`: si el corte cae dentro de un carácter multibyte (`str_repeat( 'a', 255 ) . 'é'`), queda medio carácter, el saneador registrado (`sanitize_text_field()` / `sanitize_textarea_field()`) ve UTF-8 inválido y el campo **se guarda vacío**, sin aviso. Con texto multibyte el límite real son 256 bytes, no caracteres. | `includes/radplapag-program-cpt.php` | `tests/php/integration/Cpt/SaveProgramMetaTest.php` (`test_currently_description_cut_inside_a_character_is_saved_empty`) | media | confirmado | pendiente |
| K6 | caracterización | Los tres bloques pasan a `get_block_wrapper_attributes()` la clase `wp-block-radplapag-<bloque>`, que WordPress ya añade: en WP 6.6 sale **dos veces** en el contenedor (`class="wp-block-radplapag-schedule wp-block-radplapag-schedule"`); en la última WP (7.1) sale una. Cosmético; los snapshots comparan el contenedor sin clases repetidas para valer en las dos puntas. | `blocks/*/render.php` | `tests/php/integration/Blocks/BlockRenderTest.php` (`test_currently_wrapper_class_is_repeated_on_wp_6_6`) | baja | confirmado (WP 6.6) | pendiente |
| K7 | caracterización | La desinstalación busca las emisoras y los programas con `post_status => 'any'`, que excluye los estados fuera de búsqueda: las entradas **en la papelera** y los `auto-draft` quedan en la base de datos con su meta (guidelines: no dejar restos). | `uninstall.php` | `tests/php/integration/Uninstall/UninstallTest.php` (`test_currently_keeps_trashed_and_auto_draft_posts`) | media | confirmado | pendiente |

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
