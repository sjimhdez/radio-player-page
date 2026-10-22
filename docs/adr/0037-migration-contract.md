# ADR 0037 — Contrato de la migración: bloqueo atómico, reintento sin duplicados, descarte de franjas y avisos

- Estado: aceptado; punto 2 enmendado por [ADR 0038](0038-migration-lock-first-take-with-insert-ignore.md) (la primera toma usa `INSERT IGNORE`, no `add_option()`) · Fecha: 2026-10-22 · Spec: 0008 (fase 1)

## Contexto

La auditoría de la 0002 ([`audit/migration.md`](../specs/0002-safety-net/audit/migration.md)) y el triage (fase 5, 5.5) dejaron en `docs/known-issues.md` varias rarezas de la migración heredada (`includes/radplapag-upgrade.php`, `Migration\Legacy_Plan`, `WP\Migration_Writer`, `Upgrade\Upgrade_Policy`):

- **Bloqueo no atómico (4.3).** El bloqueo es el transient `radplapag_migrating` (120 s): `get_transient()` y luego `set_transient()`. Dos peticiones a la vez pueden pasar las dos la comprobación. Con una caché de objetos persistente, el transient ni siquiera está en la base de datos. Tras un fallo se suelta el bloqueo, así que un fallo determinista se repite en cada petición del admin.
- **Migración cortada (4.3).** Si el proceso muere tras crear una emisora publicada, la pasada siguiente la cuenta como conflicto y nunca migra. Si muere solo con programas creados, los duplica.
- **K29.** El aviso de conflicto no se puede descartar: el descarte borra la bandera y la pasada siguiente la vuelve a poner. Bloquea la revisión de wordpress.org.
- **K30.** Un horario de la 3.2 con un solape entre días no pasa `radplapag_sanitize_station_schedule()`: la migración falla, hace *rollback* y reintenta en bucle.
- **K79.** `Legacy_Plan` pone `is_rerun: false` a todas las franjas, aunque la 3.2 lo guardaba.
- **K32.** Con 0 emisoras válidas el aviso dice que la migración fue correcta, sin decir que no había nada.

Las decisiones D2 a D7 de la spec 0008 (§4.1) las corrigen. Cambian claves y valores de `SPEC.md` §3.1 y el flujo de §3.2, y precisan el ADR 0010.

## Decisión

### Bloqueo

1. `radplapag_migrating` pasa a ser una **opción** sin autoload (`add_option( …, 'no' )`). Su valor es la marca de tiempo Unix (entero, en segundos) en que caduca.
2. **Toma atómica.** Primero `add_option()`, que solo gana una petición porque `option_name` es único. Si la opción ya existe y su valor es una hora pasada, se toma con un `UPDATE` condicional sobre el valor leído (`WHERE option_name = %s AND option_value = %s`, con `$wpdb->prepare()`). Solo gana si cambia una fila; después se borran de la caché la opción, `alloptions` y `notoptions`. Borrar y volver a añadir no vale, porque no es atómico. La excepción de PHPCS (`DirectDatabaseQuery`) va en su línea con el motivo (ADR 0021). Esa lógica la tiene el adaptador `WP\Migration_Lock`, y el predicado puro `Upgrade_Policy::is_lock_held()`.
3. **Esperas.** Mientras corre, el bloqueo dura **120 s**. Si la escritura falla, no se suelta: se retiene **900 s** (15 min) desde el fallo, para que un fallo determinista no se repita en cada petición. Al terminar bien se borra la opción.
4. El transient `radplapag_migrating` de versiones anteriores **se ignora** (no bloquea ni se lee). Caduca solo; la desinstalación lo borra (spec 0008, fase 2).
5. **Orden de la pasada:** versión, datos heredados, bandera de conflicto, tomar el bloqueo, purgar lo pendiente (punto 6), contar las emisoras publicadas (si hay conflicto, se marca la bandera y se suelta el bloqueo) y migrar. El bloqueo se toma **antes** de contar, para que la purga no compita con otra pasada.

### Reintento sin duplicados

6. Cada post que crea la migración lleva la meta interna **`_radplapag_migration_pending`** = `'1'` (`meta_input` de `wp_insert_post()`). Al terminar bien, `delete_post_meta_by_key()` la quita de todos. Tras tomar el bloqueo, los posts que aún la llevan (de una migración cortada) se borran para siempre, en cualquier estado, antes de contar las emisoras. El *rollback* de los fallos controlados se queda.

### Conflicto (K29)

7. `radplapag_migration_skipped_cpt_conflict` vale `'1'` (conflicto sin descartar) o **`'dismissed'`** (descartado). Las dos son verdaderas: con cualquiera de ellas la pasada sale sin contar emisoras. La bandera solo se pone a `'1'` si no existía. El aviso solo sale con `'1'` y lleva `is-dismissible`. El descarte (`?radplapag_dismiss=migration_conflict` con su nonce) la pone a `'dismissed'` en vez de borrarla. `radplapag_maybe_clear_migration_conflict_flag()` la sigue borrando, con cualquier valor, si hay 0 emisoras publicadas; entonces la migración vuelve a correr. `radplapag_settings` no se borra al descartar.

### Franjas (K30, K79; enmienda el ADR 0010)

8. Tras crear los programas, las franjas de cada emisora se aceptan **de una en una**, de lunes a domingo y en su orden dentro del día. Una franja se descarta si, sumada a las ya aceptadas, no pasa `Schedule\Slot_Validator::validate()` (formato, horas, solape en el día o entre días). **Gana la anterior.** Lo hace la clase pura `Migration\Slot_Filter`. El resto de la emisora migra, cada descarte va al log y el aviso de éxito lo nombra. Lo que queda sigue pasando por `radplapag_sanitize_station_schedule()` como red. Una franja de un programa desconocido se sigue descartando solo con el log.
9. `is_rerun` se conserva: `true` solo si la franja heredada trae `true` estricto, y `false` en cualquier otro caso.

### Avisos (K32)

10. `radplapag_migration_success_notice` guarda un **resumen**: `{ stations: int, dropped: list<{ station, day, start, end, program }> }`. El adaptador `WP\Migration_Notice` lo traduce con `__()`/`_n()` y lo escapa. Con `stations === 0`, el aviso dice que no se encontró ninguna emisora que migrar y que se borró la opción antigua (la opción se borra y la versión pasa a `'330'` igual, como dice el ADR 0010). Un `'1'` de una versión anterior se sigue leyendo como éxito y pinta el texto de antes. Caducidad: 60 s, como hoy.
11. `radplapag_migration_error_notice` pasa a durar **900 s**, lo mismo que la espera tras un fallo.

`Radplapag_Migrator_Settings_To_Cpt::run()` devuelve el resumen del punto 10 o un `WP_Error`. La clase es interna (`SPEC.md` §3.4 no la lista).

## Consecuencias

- Una sola petición migra, también con caché de objetos persistente: la opción vive en la tabla `options` y la toma la decide la base de datos. Lo protegen los tests de `UpgradeFlowTest` del bloqueo vigente, caducado y cambiado entre la lectura y la toma (A3), sin procesos en paralelo.
- Una migración cortada se reintenta desde cero, sin duplicados y sin falsos conflictos (A3). La purga borra para siempre: solo afecta a posts con la meta interna, que nadie más escribe.
- Tras un fallo, el administrador ve el error durante 15 min y la migración no se reintenta en ese tiempo. Si el fallo era pasajero, migra en la primera petición tras la espera.
- `'dismissed'` deja `radplapag_settings` para siempre en un sitio con conflicto (riesgo 4 de la spec). Es lo que elige quien descarta. La desinstalación la borra (fase 2).
- Una migración de la 3.2 con solapes entre días ya no se bloquea. A cambio se pierde una franja, y el aviso la nombra para que se pueda rehacer a mano (A2).
- Los 8 *goldens* que migran cambian en una sola clave, `transients.radplapag_migration_success_notice`. Los *goldens* `corrupt-times` y `corrupt` cambian por K30 y K79 (spec 0008, §4.3).
- La rule de datos dice que una opción nueva va también a la desinstalación. La opción `radplapag_migrating` y la meta pendiente entran en `uninstall.php` en la fase 2 (D11). Hasta entonces, la opción solo puede quedar si un fallo deja el bloqueo retenido, y la meta si una migración se corta. Las dos son residuos internos.
- `Slot_Filter` depende solo de la API pública de `Slot_Validator`. Si la 0009 rehace el validador, los vectores de `SlotFilterTest` lo protegen.
- Si `wporg-reviewer` objeta el `UPDATE` directo, se pregunta al usuario (riesgo 3 de la spec).

## Alternativas descartadas

- **Seguir con el transient:** no es atómico y, con una caché de objetos persistente, no llega a la base de datos.
- **`GET_LOCK()` de MySQL:** es por conexión, no sobrevive a la petición y no está garantizado en todos los alojamientos (algunos proxies o réplicas lo bloquean).
- **Tomar un bloqueo caducado con `delete_option()` + `add_option()`:** entre las dos llamadas otra petición puede borrar el bloqueo que acaba de tomar la primera.
- **Soltar el bloqueo tras un fallo (como hoy):** un fallo determinista se repite en cada petición. Con la migración en el front de la fase 2, se repetiría en cada visita.
- **Descartar toda la emisora con un solape (o no migrar):** pierde más datos que descartar la franja y deja el sitio sin player. Es justo lo que pasa hoy con K30.
- **Tratar la semana como circular (el domingo antes que el lunes siguiente):** con el domingo 23:00–02:00 y el lunes 01:00–03:00 se quedaría el domingo, pero la regla dependería de dónde empieza la semana. «Gana la anterior, de lunes a domingo» es más simple de explicar y es la que eligió el usuario (D3).
- **Borrar la bandera al descartar y recordar el descarte en una opción nueva:** añade una clave al contrato sin ganar nada sobre un valor más en la que ya existe.

Evidencia: [`docs/specs/0008-migration-and-core-fixes/spec.md`](../specs/0008-migration-and-core-fixes/spec.md) §3 y §4.1 (D2–D7), [`phase-1.md`](../specs/0008-migration-and-core-fixes/phase-1.md); filas K29, K30, K31, K32 y K79 de [`docs/known-issues.md`](../known-issues.md).
