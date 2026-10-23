# ADR 0042 — La desinstalación borra todo lo que guarda el plugin

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0008 (fase 2, tarea 2.5)

## Contexto

- **C11.** `uninstall.php` solo borra `radplapag_db_version` y `radplapag_migration_skipped_cpt_conflict`. Quedan `radplapag_settings` (en un sitio con conflicto, para siempre: riesgo 4 de la spec), la opción `radplapag_migrating` (ADR 0037), el transient heredado `radplapag_migrating`, los dos avisos de la migración (el de éxito ya no caduca desde el ADR 0041) y los transients de errores de cada emisora. Igual en cada sitio de una red.
- **K7.** Busca los posts con `'post_status' => 'any'`, que excluye los estados con `exclude_from_search`: las emisoras y los programas **en la papelera** y los `auto-draft` quedan en la base de datos con su meta.
- Las guidelines de WordPress.org piden no dejar restos al desinstalar.
- `uninstall.php` no carga el plugin: ni el autoloader ni `includes/src/`. Las funciones `radplapag_uninstall_*` son contrato, como toda función `radplapag_*` (`SPEC.md`, invariante 2 de `CLAUDE.md`).
- Los transients de errores llevan el ID de la emisora en el nombre (`radplapag_station_schedule_errors_<id>`, `radplapag_station_field_errors_<id>`). Con una caché de objetos persistente no están en `wp_options`.

Decisión D11 de la spec 0008 (§4.1).

## Decisión

En cada sitio (el actual y, en multisite, cada sitio de la red con `switch_to_blog()`), `uninstall.php` borra:

1. **Las 4 opciones** de `SPEC.md` §3.1: `radplapag_settings`, `radplapag_db_version`, `radplapag_migration_skipped_cpt_conflict` y `radplapag_migrating`.
2. **Los 3 transients globales:** `radplapag_migrating` (el heredado), `radplapag_migration_success_notice` y `radplapag_migration_error_notice`, con `delete_transient()`.
3. **Los transients de errores de cada emisora**, con `delete_transient()` por su ID (`radplapag_station_schedule_errors_<id>` y `radplapag_station_field_errors_<id>`), para cada emisora en cualquier estado y **antes** de borrar su post.
4. **Los posts de los dos CPT en todos los estados registrados** (`'post_status' => array_keys( get_post_stati() )`: `trash`, `auto-draft` e `inherit` incluidos), con `wp_delete_post( $id, true )`, que borra su meta.
5. **La meta interna** con `delete_post_meta_by_key( '_radplapag_migration_pending' )`, por si quedara en algún post que no sea de los dos CPT.

Después vacía la caché de objetos (`wp_cache_flush()`), como hoy. Sigue sin cargar el plugin. Las funciones `radplapag_uninstall_delete_stations()`, `radplapag_uninstall_delete_programs()` y `radplapag_uninstall_plugin()` conservan su firma; lo nuevo va en una función `radplapag_uninstall_*` más (tarea 2.7). Desactivar el plugin sigue sin borrar nada.

**Regla:** toda opción, transient o meta que se añada a `SPEC.md` §3.1 se añade también a la desinstalación y a `UninstallTest` y `UninstallMultisiteTest` en el mismo cambio.

## Consecuencias

- Desinstalar deja la base de datos sin nada del plugin, en cada sitio de una red (A9). Se acaba el `radplapag_settings` perpetuo de un sitio con conflicto descartado.
- Borrar `radplapag_settings` es irreversible: quien desinstale y vuelva a instalar no recupera el formato de antes de la 3.3.0. Es lo que pide desinstalar; desactivar no lo toca.
- Los transients por emisora se borran por nombre, así que funciona también con una caché de objetos persistente. Uno huérfano (de una emisora ya borrada antes de desinstalar) caduca solo a los 45 s.
- En una red grande la desinstalación hace una pasada por sitio, como hoy; solo añade unas pocas llamadas por sitio y dos por emisora.
- Lo protegen `UninstallTest` y `UninstallMultisiteTest`: siembran todas las opciones, los transients (el heredado y los de una emisora en la papelera incluidos), posts en la papelera y `auto-draft`, y la meta pendiente, y comprueban que no queda nada (tareas 2.6 y 2.7).

## Alternativas descartadas

- **Borrar con SQL (`DELETE … WHERE option_name LIKE '%radplapag_%'`):** no llega a los transients de una caché de objetos persistente, puede llevarse opciones de otro plugin con un nombre parecido y Plugin Check pide justificar el SQL directo.
- **Seguir con `'post_status' => 'any'`:** es K7.
- **Listar los estados a mano (`publish`, `draft`, `trash`, `auto-draft`…):** deja fuera los que registre otro plugin; `get_post_stati()` los trae todos.
- **Cargar el plugin para reutilizar sus constantes y clases:** ejecutaría sus enganches durante la desinstalación y ata `uninstall.php` al autoloader; los nombres son contrato y no cambian (`SPEC.md` §3.1).
- **Dejar `radplapag_settings` como copia de seguridad:** contradice las guidelines y, tras migrar, ya no se lee.

Evidencia: [`docs/specs/0008-migration-and-core-fixes/spec.md`](../specs/0008-migration-and-core-fixes/spec.md) §4.1 (D11) y A9, [`phase-2.md`](../specs/0008-migration-and-core-fixes/phase-2.md) (tareas 2.6 y 2.7); filas C11 y K7 de [`docs/known-issues.md`](../known-issues.md).
