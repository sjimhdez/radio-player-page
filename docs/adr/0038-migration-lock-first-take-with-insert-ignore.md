# ADR 0038 — Primera toma del bloqueo de la migración con `INSERT IGNORE`

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0008 (fase 1) · Enmienda el punto 2 del [ADR 0037](0037-migration-contract.md)

## Contexto

El ADR 0037 (punto 2) toma el bloqueo `radplapag_migrating` primero con `add_option()`, «atómico porque `option_name` es único». Al empezar la tarea 1.4 se comprobó que no lo es:

- `add_option()` mira la caché (`notoptions`) o hace un `get_option()` y, si la opción no existe, escribe con `INSERT … ON DUPLICATE KEY UPDATE` (`wp-includes/option.php`, WP 6.6 y posteriores).
- Si dos peticiones pasan la comprobación a la vez, la segunda **sobrescribe** la fila de la primera. MySQL devuelve 2 filas afectadas, `add_option()` lo toma como éxito y **ganan las dos**. Solo pierde la segunda si escribe exactamente el mismo valor (0 filas), es decir, si cae en el mismo segundo.
- Con una caché de objetos persistente que diga que la opción no existe, ni siquiera hace falta que las peticiones coincidan en el tiempo.

## Decisión

1. La primera toma usa `$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} ( option_name, option_value, autoload ) VALUES ( %s, %s, 'off' )", … ) )`. Gana solo si inserta **1 fila**; con la opción ya en la tabla, `INSERT IGNORE` no escribe nada (0 filas).
2. `autoload` = `'off'`, el valor sin autoload de WP 6.6 (el mínimo del plugin).
3. Tras cualquier intento (`INSERT IGNORE` o el `UPDATE` condicional del ADR 0037), se borran de la caché la opción, `alloptions` y `notoptions`. La excepción de PHPCS (`DirectDatabaseQuery`) va en la línea de cada consulta, con el motivo (ADR 0021).
4. El resto del ADR 0037 no cambia: la opción guarda la hora en que caduca, un bloqueo caducado se toma con el `UPDATE … WHERE option_name = %s AND option_value = %s` (gana con 1 fila), 120 s mientras corre y 900 s tras un fallo, y el transient heredado se ignora. Lo hace el adaptador `WP\Migration_Lock`.

## Consecuencias

- La toma la decide siempre la base de datos, por la clave única de `option_name`: con la opción ausente gana un solo `INSERT IGNORE`, y con la opción caducada, un solo `UPDATE`.
- Las dos escrituras del bloqueo son SQL directo y no disparan `add_option` ni `added_option`. El test de orden de escrituras de `UpgradeFlowTest` (D4) ve la opción por la consulta, no por esos hooks.
- Lo protege un test de `UpgradeFlowTest`: con la opción en la tabla pero la caché diciendo que no existe (`notoptions`), la toma pierde y el valor guardado no cambia. Con `add_option()`, ese test gana y sobrescribe.
- `INSERT IGNORE` también ignora otros errores (por ejemplo, un valor demasiado largo). Aquí el valor es un entero corto y la tabla es la de core, así que lo único que puede ignorar es la clave duplicada.
- Si `wporg-reviewer` objeta el SQL directo, se pregunta al usuario (riesgo 3 de la spec, igual que el `UPDATE`).

## Alternativas descartadas

- **`add_option()` (ADR 0037):** el `ON DUPLICATE KEY UPDATE` deja ganar a dos peticiones.
- **`add_option()` y releer el valor:** sigue habiendo carrera. Si una petición relee antes de que la otra sobrescriba, las dos creen haber ganado, y en el mismo segundo los valores coinciden.
- **`INSERT` sin `IGNORE`:** con la clave duplicada, `$wpdb` imprime el error de la base de datos (con `WP_DEBUG`) en una situación que es normal.
- **`GET_LOCK()` de MySQL:** descartado en el ADR 0037.

Evidencia: `wp-includes/option.php` (`add_option()`); [`phase-1.md`](../specs/0008-migration-and-core-fixes/phase-1.md), tarea 1.4; decisión del usuario del 2026-10-22.
