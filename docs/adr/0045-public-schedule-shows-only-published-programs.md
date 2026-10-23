# ADR 0045 — El horario público solo muestra programas publicados

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0009 (fase 2, tarea 2.1)

## Contexto

- Cada punto de entrada público carga los programas con `radplapag_get_program_data( $id, true )` (solo `publish`), pero resuelve sobre el horario guardado tal cual: la página limpia, el bloque de horario (`radplapag_build_programs_map()` + `radplapag_get_schedule_for_station()`), la lista de programas (`radplapag_get_programs_list_for_station()`) y `radplapag_get_now_playing_for_station()`, que alimenta `now-playing`.
- **C10 (media).** La franja de un programa en borrador, en la papelera o borrado se queda: el bloque de horario la pinta con «—», `RADPLAPAG_SCHEDULE` la imprime sin su programa en `RADPLAPAG_PROGRAMS` y el player muestra «On Air:» con el nombre vacío. **Variante en «Coming up»:** `Now_Playing_Resolver` deja que esa franja se quede la ventana de 10 minutos y tapa al programa publicado que empieza después.
- **Contraseña (sospecha 5.8 de la spec 0002, fila K88).** `radplapag_get_program_data( $id, true )` acepta un programa publicado con `post_password`: su nombre y descripción salen en la página limpia y en los bloques, aunque WordPress lo protege en su propia URL.
- **K78 (baja).** `Globals_Builder::program_ids()` lee el horario crudo: un programa cuya única franja no se imprime (sin `start` o `end`, meta escrita a mano) sale en `RADPLAPAG_PROGRAMS`.
- **K17 (baja).** Sin franjas, `RADPLAPAG_SCHEDULE` sale como `[]` (array vacío de PHP), no como el objeto que describe `SPEC.md` §3.3.
- **K41 (media), en el admin.** `radplapag_get_all_programs_for_select()` solo lista `publish` y `draft`: una franja con un programa en la papelera, privado, pendiente o programado se pinta con el selector vacío y la validación del cliente bloquea el guardado de toda la emisora. C10 en el admin: el borrador se acepta sin avisar.
- Caracterizado en la spec 0002: filas C10, K17, K41 y K78 de [`known-issues.md`](../known-issues.md); K88 se abre en la tarea 2.2 de la 0009.

Decisiones D4, D5 y D8 (parte K17) de la spec 0009 (§4.1), del usuario el 2026-10-18 (K17), el 2026-10-21 (K78, C10 con gravedad media) y el 2026-10-23 (plan de la fase 2).

## Decisión

1. **Programa público.** Un programa es público si existe, es un `radplapag_program`, su estado es `publish` y su `post_password` está vacío. Un `program_id` no numérico (`'tagged id'`) es un programa que no existe.
2. **`radplapag_get_program_data( $id, true )`** rechaza también el programa con contraseña (devuelve `null`). Con `false` no cambia: el admin sigue leyendo cualquier programa.
3. **Una regla, antes de resolver (D4).** El adaptador de WordPress quita del horario las franjas cuyo programa no es público **antes** de pasarlo al núcleo, en los cinco puntos de entrada: página limpia, los tres bloques y `radplapag_get_now_playing_for_station()`. La regla vive en un solo sitio, junto a `WP\Program_Repository` (`public_programs()`), y el filtrado en el núcleo (`Schedule\Public_Slots::filter()`, que conserva los días y el orden guardado). Las firmas de las funciones `radplapag_*` no cambian.
4. **Lo que no es público no cuenta en ningún sitio público:** no se imprime en `RADPLAPAG_SCHEDULE`, su programa no está en `RADPLAPAG_PROGRAMS`, no sale en los bloques (ni con «—») y no es el programa en antena ni ocupa la ventana de «Coming up». Por si llega un dato así de otra fuente, `Now_Playing_Resolver` también ignora la franja cuyo programa no está en su mapa, y el player la cuyo `program_id` no está en `RADPLAPAG_PROGRAMS`. `Schedule_View` no cambia (pinta lo desconocido con nombre vacío; ya le llega filtrado).
5. **`RADPLAPAG_PROGRAMS` sale de las franjas impresas (K78):** los programas de `RADPLAPAG_SCHEDULE`, en el orden de su primera aparición (lunes → domingo).
6. **`RADPLAPAG_SCHEDULE` vacío es `{}` (K17, D8).** El envoltorio imprime un objeto; `Globals_Builder::schedule()` sigue devolviendo un array. El player sigue aceptando `[]` (una página en caché de antes de la actualización).
7. **Admin (D5, C10, K41).** La lista del selector del meta box y de `radplapagAdmin.programs` es la de siempre más el programa de cada franja guardada, en cualquier estado, con su estado en la etiqueta («Name (Draft)», «(Pending)», «(Scheduled)», «(Private)», «(Trash)», «(Password protected)») y si es público. Una franja de un programa no público conserva su programa seleccionado y muestra, al pintar el meta box y al elegir el programa, el aviso «This program is not published; this time slot is not shown on the site.». El aviso no bloquea el guardado y el servidor sigue aceptando la franja. Va en una función nueva (`radplapag_get_station_programs_for_select( $station_id )`); la salida de `radplapag_get_all_programs_for_select()` y los `name` del formulario no cambian. Textos en `admin/admin-strings.php`.
8. El formato guardado (`SPEC.md` §3.1) no cambia: no hay migración. Las franjas de programas no públicos se quedan en la meta y vuelven a verse en cuanto el programa se publica.

## Consecuencias

- Una sola regla para lo público: las cinco salidas y el player coinciden en qué franjas existen, y una franja de un borrador ya no tapa al programa siguiente.
- Un sitio que usaba un borrador para «reservar» una franja deja de verla en el bloque de horario (riesgo 3 de la spec). Es C10, decidido por el usuario; el aviso del admin lo explica y va en el changelog y en `== Upgrade Notice ==`.
- Un tercero que llama a `radplapag_get_program_data( $id, true )` recibe ahora `null` para un programa con contraseña. Va en el changelog.
- Un tercero que lee `RADPLAPAG_SCHEDULE` con `Array.isArray` ve `{}` en vez de `[]` sin franjas. Es el contrato que ya describía `SPEC.md`; va en el changelog y en `== Upgrade Notice ==`.
- El estado y la contraseña salen del mismo post que ya carga `radplapag_get_program_data()`: el filtrado no añade lecturas por franja.
- Lo protegen `PublicSlotsTest`, `NowPlayingResolverTest`, `GlobalsBuilderTest`, `BlockDataTest` (también la regresión de K88), `BlockAuditTest`, `ScheduleVectorsTest` (vectores con programas no publicados, unit e integración), `program-schedule.test.ts`, `schedule-vectors.test.ts`, `clean-page.spec.ts` (K17, K78), el snapshot `minimal.html`, `AdminScreensTest` y `station-validation.test.js`.

## Alternativas descartadas

- **Filtrar en cada vista** (`Schedule_View`, `Programs_List_View`, `Globals_Builder`, el resolutor): cinco copias de la misma regla, que es lo que dejó pasar C10 (cada punto de entrada filtraba los programas pero no las franjas).
- **Pintar la franja con «—» o «Unpublished»** en el bloque: enseña al público un hueco que el administrador no quiere publicar, y el programa en antena seguiría sin nombre.
- **Rechazar en el guardado las franjas de programas no publicados:** rompe el flujo normal de preparar un programa en borrador o mandarlo a la papelera, y deja sin poder guardar las emisoras que ya los tienen (K41).
- **Borrar las franjas al despublicar el programa:** pierde datos del administrador sin preguntar; volver a publicar debe bastar.
- **Mostrar los programas con contraseña** sin descripción: el nombre ya es contenido protegido, y no hay forma de pedir la contraseña en la página limpia ni en los bloques.
- **Cambiar `radplapag_get_all_programs_for_select()`** para incluir todos los estados: es contrato (`SPEC.md` §3.4) y un tercero puede usarla para su propio selector.

Evidencia: [`spec.md`](../specs/0009-schedule-model/spec.md), [`phase-2.md`](../specs/0009-schedule-model/phase-2.md), filas C10, K17, K41 y K78 de [`known-issues.md`](../known-issues.md).
