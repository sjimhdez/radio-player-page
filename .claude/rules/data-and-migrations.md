---
paths:
  - "includes/**"
  - "uninstall.php"
---

# Datos y migraciones

El contrato completo está en `SPEC.md` (datos, migración y desinstalación). Esta rule dice cómo se trabaja con él.

## Nunca se renombra nada

- CPT `radplapag_station` / `radplapag_program`, sus meta keys (`radplapag_station_*`, `radplapag_program_*`), las opciones (`radplapag_settings`, `radplapag_db_version`, `radplapag_migration_skipped_cpt_conflict`) y los transients (`radplapag_station_schedule_errors_*`, `radplapag_station_field_errors_*`, `radplapag_migrating`, `radplapag_migration_success_notice`, `radplapag_migration_error_notice`) son contrato: hay sitios en producción con esos datos.
- El formato del horario (`{ monday: [{ program_id, start: "HH:MM", end: "HH:MM", is_rerun? }], … }`) también, incluidas las franjas que cruzan la medianoche.

## Cambiar el esquema

1. ADR con el motivo y las alternativas (`write-adr`).
2. Migración nueva, sin tocar las anteriores: se ejecuta una vez, la controla `radplapag_db_version` y es **idempotente** (ejecutarla dos veces no cambia nada).
3. Test de integración con fixtures del formato anterior que compara el resultado con un *golden* y migra dos veces.
4. `SPEC.md` actualizado en el mismo commit.

## La migración heredada (`includes/migration/`, `radplapag-upgrade.php`)

- Unidireccional: de `radplapag_settings` a los CPT; nunca al revés (ADR 0010).
- Cubre los formatos de 2.0.x a 3.2.x; los de 1.x quedan fuera del contrato (ADR 0005; K4 en `docs/known-issues.md`).
- Tiene bloqueo (`radplapag_migrating`), avisos de éxito y error, y detecta conflictos con CPT ya existentes (`radplapag_migration_skipped_cpt_conflict`).
- Los fixtures de los formatos reales están en `spike/php/fixtures/legacy-settings/`; la spec 0002 los mueve a `tests/fixtures/`.

## Desinstalación

`uninstall.php` borra los posts de los dos CPT, también en multisite (cada sitio). Desactivar el plugin no borra nada. Si se añade una opción o un transient, se añade también a la desinstalación y a su test.
