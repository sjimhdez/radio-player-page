# ADR 0041 — La migración corre sin un administrador delante

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0008 (fase 2, tarea 2.1) · Enmienda el punto 10 del [ADR 0037](0037-migration-contract.md) (la caducidad del aviso de éxito) y precisa el [ADR 0010](0010-cpt-storage-and-migration.md)

## Contexto

- **K33.** `radplapag_run_legacy_migration_if_needed()` sale si `! is_admin() || ! is_user_logged_in() || ! current_user_can( 'manage_options' )`, y solo está enganchada en `admin_init` 20 (más `init` 100 tras el *upgrader*, cuando los CPT aún no existían). Tras actualizar desde una versión anterior a la 3.3.0, las páginas de las emisoras dan 404 hasta que un administrador abre el escritorio. En un sitio que nadie administra a diario, eso pueden ser días sin player.
- **K21 en la migración.** La escritura corre como el primer administrador (`wp_set_current_user()`), y `wp_set_current_user()` dispara `set_current_user` y, con él, `kses_init()`. Si ese usuario no tiene `unfiltered_html` (multisite, o `DISALLOW_UNFILTERED_HTML`), kses guarda «Rock &amp;amp; Roll». Además, `wp_set_current_user()` no hace nada si el ID ya es el actual, así que restaurar el usuario no basta para dejar los filtros de kses de quien estaba.
- **El conflicto en el front.** La pasada llama a `radplapag_maybe_clear_migration_conflict_flag()`, que cuenta las emisoras (`wp_count_posts`) cuando la bandera está puesta. En el front sería una consulta en cada visita de un sitio con conflicto.
- **El aviso de éxito caduca a los 60 s** (ADR 0037, punto 10). Si la migración corre en una visita del front, el administrador casi nunca lo vería.
- En `init` 100 los CPT (`init` 10) y su meta (`init` 20) ya están registrados.

Decisiones D1, D2 (el front) y D9 de la spec 0008 (§4.1). La caducidad del aviso es una decisión del usuario del 2026-10-23, al planificar la fase 2.

## Decisión

1. **Enganche.** `radplapag_run_legacy_migration_if_needed()` se engancha también en **`init` con prioridad 100**, en cualquier petición: front, REST, cron, AJAX o admin. Es el mismo callback: `add_action()` descarta el duplicado que pone `radplapag_schedule_legacy_migration()` tras el *upgrader* (mismo callback y prioridad). El enganche en **`admin_init` 20 se conserva** (es contrato, `SPEC.md` §3.4). En una petición del admin no le queda trabajo: la pasada de `init` 100 ya limpia la bandera de conflicto si toca (punto 5) y migra antes de `admin_init`.
2. **Sin guarda.** La pasada ya no comprueba `is_admin()`, la sesión ni `manage_options`. Lo que decide si migra es lo de siempre: la versión, los datos heredados, la bandera, el bloqueo (ADR 0037, 0038 y 0040).
3. **Usuario.** Migra como el primer administrador (`radplapag_migration_resolve_author_user_id()`) y restaura el usuario de antes al terminar, también el 0 de un visitante anónimo. `template_redirect` y el resto de la petición ven al visitante.
4. **kses (D9).** Tras `wp_set_current_user( $author_id )` se llama a `kses_remove_filters()`. Tras restaurar el usuario, `kses_init()`, que vuelve a poner los filtros que correspondan a quien estaba. Los datos ya llegan saneados por el plan (`Migration\Legacy_Plan`).
5. **Conflicto en el front (D2).** La pasada solo llama a `radplapag_maybe_clear_migration_conflict_flag()` si `is_admin()`. Fuera del admin, con la bandera puesta (`'1'` o `'dismissed'`), sale sin contar emisoras. La bandera se sigue borrando solo desde el admin (`admin_init` 5 y la pasada del admin).
6. **Aviso de éxito sin caducidad.** `radplapag_migration_success_notice` se guarda con caducidad **0**. Se borra al pintarlo (como hoy) y al desinstalar (ADR 0042). El de error se queda en **900 s**: cada reintento lo vuelve a poner, y una petición del admin reintenta en `init` antes de `admin_notices`.
7. Lo demás del ADR 0037, el 0038 y el 0040 no cambia.

## Consecuencias

- La primera petición tras actualizar ya ve el player, sea quien sea quien la haga (A7). En una red, cada sitio migra en su primera petición.
- **Esa primera petición tarda más** (crea los posts). Es una sola vez por sitio y hoy la paga el administrador. Se mide en la tarea 2.2 con el *fixture* `multi-station`; si pasa de unos segundos, se pregunta (riesgo 1 de la spec).
- En el front, las peticiones concurrentes son lo normal. Las cubre el bloqueo atómico con su renovación (ADR 0037, 0038 y 0040), que ya está.
- Mientras el usuario está cambiado, otros callbacks que se disparen dentro de la escritura (`save_post`, `wp_insert_post`) ven al primer administrador, como ya pasaba en el admin. Fuera de la pasada, el usuario y los filtros de kses son los de quien estaba (riesgo 2 de la spec). Lo protege `UpgradeFlowTest`: el usuario 0 sigue siendo el 0 y `has_filter( 'title_save_pre', 'wp_filter_kses' )` vuelve a lo de antes, con y sin `unfiltered_html`.
- Un sitio con conflicto no paga ninguna consulta extra en el front: `get_option()` de la bandera es autoload. Sin bandera y sin versión `'330'`, cada pasada del front toma el bloqueo y cuenta emisoras, pero solo hasta que migra o marca el conflicto (una petición). **Excepción, K86:** con una migración que falla, cada petición lee el bloqueo (un `get_option()` sin autoload) mientras dura su retención de 900 s, sin escribir nada (corregido en la fase 3 de la 0008: antes intentaba un `INSERT IGNORE`), y al caducar un visitante repite la migración.
- El aviso de éxito puede esperar semanas a que entre un administrador, y entonces sale una vez. Con caducidad 0, WordPress guarda el transient con autoload: es una fila pequeña hasta que se pinta.
- Los 3 tests de `UpgradeFlowTest` que fijaban que no migra fuera del admin, sin sesión o sin `manage_options` pasan a fijar que sí migra, con el usuario restaurado (spec 0008, §4.3). `test_currently_station_page_is_not_served_until_an_admin_visits` pasa a regresión de K33. En la caracterización `test_upgrader_ignores_other_runs` sale `assertFalse( has_action( 'init', … ) )`: con el enganche fijo en `init` 100 ya no distingue nada; se queda `assert_not_migrated()`.
- Quien desenganchaba `admin_init` 20 para retrasar la migración, o llamaba al callback desde el front o sin `manage_options`, ya no la frena: ahora corre en `init` 100 o en esa llamada. Para retrasarla habría que desenganchar también `init` 100.
- **Vuelta atrás a la 3.4.2:** sin efecto; una vez migrado, la 3.4.2 lee los mismos CPT. El transient de éxito sin caducidad lo pinta y lo borra igual.

## Alternativas descartadas

- **Seguir solo en el admin:** es K33.
- **Un callback nuevo para el front:** dos callbacks con la misma lógica, y uno más en el contrato de §3.4 sin ganar nada.
- **Migrar en `wp_loaded` o `template_redirect`:** `template_redirect` solo pasa en el front (REST y cron no migrarían) y llega después de que WordPress resuelva la consulta, así que la primera visita a la página de la emisora seguiría dando 404. `init` 100 es lo primero en lo que los CPT y la meta ya existen.
- **Programarla con WP-Cron:** depende del tráfico y de que el cron funcione en el alojamiento; la primera visita seguiría sin player.
- **Restaurar kses solo con `wp_set_current_user( $prev_user )`:** no hace nada si el ID ya es el actual (un administrador que dispara la migración), y dejaría la petición sin kses.
- **Dejar el aviso de éxito en 60 s, o subirlo a unos días:** con 60 s casi nadie lo vería; con una caducidad larga, en un sitio poco administrado se perdería igual. El de éxito no se repite, así que no hay nada que acotar.

Evidencia: [`docs/specs/0008-migration-and-core-fixes/spec.md`](../specs/0008-migration-and-core-fixes/spec.md) §4.1 (D1, D2, D9) y §6 (riesgos 1 y 2), [`phase-2.md`](../specs/0008-migration-and-core-fixes/phase-2.md); filas K33 y K21 de [`docs/known-issues.md`](../known-issues.md).
