# ADR 0040 — Renovación del bloqueo de la migración y segunda comprobación tras tomarlo

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0008 (fase 1, tarea 1.12) · Enmienda los puntos 3 y 5 del [ADR 0037](0037-migration-contract.md)

## Contexto

Al cerrar la fase 1, `backcompat-reviewer` señaló dos huecos del contrato del ADR 0037:

- **El bloqueo caduca mientras la migración corre.** Dura 120 s desde la toma y no se renueva. Si una migración tarda más (sitio grande, base de datos lenta), otra petición toma el bloqueo caducado y `Migration_Writer::purge_pending()` borra los posts que la primera aún está creando. La primera termina «bien» con franjas que apuntan a programas borrados, y su `release()` borra el bloqueo de la segunda. En la 3.4.2 ese caso solo duplicaba; con la purga se pierden datos.
- **No se vuelve a comprobar nada tras tomar el bloqueo.** Una petición que pasó las comprobaciones mientras otra migraba toma el bloqueo cuando la otra lo suelta. Como ya hay emisoras publicadas, marca un conflicto falso (`'1'`); si la opción heredada ya no está, deja el aviso de error y retiene el bloqueo 900 s.

Decisión del usuario (2026-10-22): corregirlo en la fase 1, como tarea 1.12.

## Decisión

1. **Segunda comprobación.** Tras tomar el bloqueo se vuelven a leer la versión (`Upgrade_Policy::is_current()`) y los datos heredados (`radplapag_legacy_has_migratable_stations()`). La toma borra de la caché `alloptions` y `notoptions` (ADR 0038), así que la lectura viene de la base de datos. Si ya no hay nada que migrar, se suelta el bloqueo y se sale sin avisos.
2. **Renovación.** `WP\Migration_Lock::renew( $now, $ttl )` extiende el bloqueo con un `UPDATE` condicional sobre el valor que guardó esta petición (gana con 1 fila). Si la renovación no movería la hora, solo comprueba que el valor guardado sigue siendo el suyo (MySQL cuenta 0 filas cuando el valor no cambia). La petición recuerda su valor en memoria; `Migration_Lock::is_held()` dice si tiene el bloqueo.
3. **El escritor renueva antes de cada post** (programas y emisoras), hasta `now + 120 s` (`Migration_Lock::TTL`). La espera de 120 s pasa a contar desde la última renovación, no desde la toma. Solo renueva si esta petición tiene el bloqueo: `Radplapag_Migrator_Settings_To_Cpt::run()` llamado fuera del flujo escribe sin él, como antes.
4. **Bloqueo perdido.** Si la renovación falla, el escritor deshace lo que creó y devuelve un `WP_Error` con el código `radplapag_migration_lock_lost`. El flujo sale sin tocar el bloqueo (es de la otra petición) y sin avisos.
5. Lo demás del ADR 0037 y del 0038 no cambia.

## Consecuencias

- Una migración lenta conserva el bloqueo mientras cada post tarde menos de 120 s. Solo se pierde si una sola escritura pasa de 120 s, y entonces la petición que lo perdió para en la escritura siguiente.
- Ventana residual: el post que se está escribiendo cuando otra petición toma el bloqueo puede quedar creado después de su purga. Lo borra el *rollback* de esta petición; si esta muere antes, queda con la meta pendiente y la siguiente purga lo borra.
- Una consulta más por post durante la migración (una sola vez por sitio).
- Lo protegen tres tests de `UpgradeFlowTest`: la renovación solo mientras se tiene el bloqueo, la segunda comprobación (sin conflicto falso ni avisos) y el bloqueo perdido (sin posts, sin avisos y con el bloqueo de la otra petición intacto).
- `SPEC.md` §3.2 recoge la segunda comprobación y la renovación.

## Alternativas descartadas

- **Subir la espera (p. ej. 900 s) sin renovar:** solo mueve el límite, y una petición muerta bloquea la migración más tiempo.
- **Renovar con `update_option()`:** pisa el bloqueo si otra petición ya lo tomó.
- **Que la purga respete los posts recientes:** no evita que dos peticiones migren a la vez.

Evidencia: informe de `backcompat-reviewer` del cierre de la fase 1; [`phase-1.md`](../specs/0008-migration-and-core-fixes/phase-1.md), tarea 1.12; decisión del usuario del 2026-10-22.
