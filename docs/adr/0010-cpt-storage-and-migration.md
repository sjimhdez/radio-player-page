# ADR 0010 — Emisoras y programas como CPT, con migración desde `radplapag_settings`

- Estado: aceptado (retroactivo: rige desde la 3.3.0); enmendado por [ADR 0037](0037-migration-contract.md) (bloqueo atómico, descarte de franjas, conflicto descartable); precisado por [ADR 0041](0041-migration-runs-without-an-administrator.md) (la migración corre en `init` en cualquier petición, sin un administrador delante) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

Hasta la 3.2.x todo vivía en una opción, `radplapag_settings` (emisoras, programas y horario en un solo array). Con varias emisoras, programas compartidos, logos y bloques que leen los mismos datos, la opción única se hacía grande, frágil al guardar y difícil de consultar.

## Decisión

- Emisoras (`radplapag_station`) y programas (`radplapag_program`) pasan a ser **CPT**, con sus datos en post meta (`SPEC.md` §3.1) y capacidad `manage_options`.
- Los sitios existentes se migran **una sola vez y en un solo sentido** de `radplapag_settings` a los CPT (`includes/migration/`, controlada por `includes/radplapag-upgrade.php` y `radplapag_db_version = '330'`). Al terminar se borra la opción.
- La migración es **idempotente**, tiene bloqueo (`radplapag_migrating`), avisa del resultado y no se ejecuta si ya hay emisoras publicadas (`radplapag_migration_skipped_cpt_conflict`).

## Consecuencias

- Los bloques y el player leen los CPT; el editor del admin usa meta boxes.
- No hay vuelta atrás: volver a una versión anterior a la 3.3.0 deja el sitio sin datos visibles. Por eso cualquier cambio de esquema futuro es una migración nueva con su ADR y su test de *golden master* (`.claude/rules/data-and-migrations.md`).
- Los formatos admitidos son los de 2.0.x a 3.2.x (ADR 0005).

## Alternativas descartadas

- **Seguir con la opción única:** no escala con varias emisoras ni con los bloques.
- **Tablas propias:** más trabajo de esquema y de desinstalación, sin ventajas frente a los CPT para este volumen de datos.
