---
paths:
  - "includes/**"
  - "uninstall.php"
---

# Datos y migraciones

El contrato completo está en `SPEC.md` (datos, migración y desinstalación). Esta rule dice cómo se trabaja con él.

## Nunca se renombra nada

- CPT `radplapag_station` / `radplapag_program`, sus meta keys (`radplapag_station_*`, `radplapag_program_*`), las opciones (`radplapag_settings`, `radplapag_db_version`, `radplapag_migration_skipped_cpt_conflict`, `radplapag_migrating`), la meta interna `_radplapag_migration_pending` y los transients (`radplapag_station_schedule_errors_*`, `radplapag_station_field_errors_*`, `radplapag_migration_success_notice`, `radplapag_migration_error_notice` y el heredado `radplapag_migrating`, que ya no se usa) son contrato: hay sitios en producción con esos datos.
- El formato del horario (`{ monday: [{ program_id, start: "HH:MM", end: "HH:MM", is_rerun? }], … }`) también, incluidas las franjas que cruzan la medianoche.

## Cambiar el esquema

1. ADR con el motivo y las alternativas (`write-adr`).
2. Migración nueva, sin tocar las anteriores: se ejecuta una vez, la controla `radplapag_db_version` y es **idempotente** (ejecutarla dos veces no cambia nada).
3. Test de integración con fixtures del formato anterior que compara el resultado con un *golden* y migra dos veces.
4. `SPEC.md` actualizado en el mismo commit.

## La migración heredada (`includes/migration/`, `radplapag-upgrade.php`)

Desde la 0005, el plan es `Migration\Legacy_Plan`, la escritura `WP\Migration_Writer` y las decisiones de la actualización `Upgrade\Upgrade_Policy`; el migrador y los callbacks de `radplapag-upgrade.php` son envoltorios.

- Unidireccional: de `radplapag_settings` a los CPT; nunca al revés (ADR 0010).
- Cubre los formatos de 2.0.x a 3.2.x; los de 1.x quedan fuera del contrato (ADR 0005; K4 en `docs/known-issues.md`).
- Contrato en el ADR 0037:
  - Bloqueo atómico: la opción `radplapag_migrating` guarda cuándo caduca. Se toma antes de contar las emisoras. Dura 120 s desde la toma o la última renovación (el escritor la renueva antes de cada post; si la pierde, deshace y sale sin avisos) y se retiene 900 s tras un fallo. Tras tomarla se vuelven a comprobar la versión y los datos heredados (ADR 0040). El transient heredado se ignora.
  - Los posts creados llevan `_radplapag_migration_pending` hasta terminar bien. Al reintentar, los que la llevan se borran.
  - La bandera de conflicto vale `'1'` o `'dismissed'`. El aviso solo sale con `'1'`.
  - Las franjas que no validan se descartan una a una (gana la anterior). `is_rerun` no se lee: los formatos heredados no lo tienen y toda franja migra con `false` (ADR 0039).
  - El aviso de éxito es un resumen; `'1'` se sigue leyendo. No caduca: se borra al pintarlo (ADR 0041).
- Corre en `init` 100 en cualquier petición (y en `admin_init` 20), sin guarda de admin ni de capacidad (ADR 0041):
  - Como el primer administrador, sin kses (`kses_remove_filters()`); al terminar restaura el usuario y llama a `kses_init()`. Cualquier cambio en la pasada debe dejar el usuario y los filtros como estaban, también si sale antes.
  - Un sitio ya migrado o con conflicto no paga ninguna consulta en el front: con la bandera puesta la pasada sale sin contar emisoras, y la limpieza de la bandera solo se hace en el admin. Con una migración fallida sí la paga, en `Migration_Lock::acquire()` (K86).
- Los fixtures de los formatos reales están en `tests/fixtures/legacy-settings/` y sus *goldens* en `golden/` (`MigrationGoldenTest`); `v1.1-flat` solo fija K4.

## Desinstalación

`uninstall.php` borra todo lo de `SPEC.md` §3.1 en cada sitio, también en multisite (ADR 0042): las opciones, los transients globales (también el heredado), los de errores de cada emisora (por su ID, antes de borrar el post), los posts de los dos CPT en todos los estados (`get_post_stati()`) con su meta, y `_radplapag_migration_pending`. No carga el plugin: ni el autoloader ni `includes/src/`. Desactivar el plugin no borra nada.

Si se añade una opción, un transient o una meta, en el mismo cambio se añade a §3.1, a la desinstalación y a `UninstallTest` y `UninstallMultisiteTest`.
