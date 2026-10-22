# ADR 0039 — Las franjas heredadas no tienen `is_rerun`: K79 no es un bug

- Estado: aceptado · Fecha: 2026-10-22 · Spec: 0008 (fase 1) · Retira el punto 9 del [ADR 0037](0037-migration-contract.md)

## Contexto

El ADR 0037 (punto 9) y la D7 de la spec 0008 decidieron que la migración conservara `is_rerun` de las franjas de `radplapag_settings`, para corregir K79 («`Legacy_Plan` pone `is_rerun: false` a todas las franjas, aunque la 3.2 lo guardaba»). La tarea 1.9 lo implementó (`0dd208b`) y el usuario lo cuestionó: `is_rerun` se desarrolló después de la migración. Al comprobarlo:

- `git grep -il rerun` no encuentra nada en los tags `v3.1.0`, `v3.2.0`, `v3.3.0` ni `v3.3.1`. `is_rerun` aparece por primera vez en `v3.4.0`, cuando las emisoras ya eran CPT (la migración desde `radplapag_settings` existe desde la 3.3.0).
- Ningún formato heredado (2.0.x–3.2.x, ADR 0005) pudo guardar el campo. La única franja heredada con `is_rerun: true` es la de la fixture `tests/fixtures/legacy-settings/corrupt.json`, escrita a mano.
- La spec 0002 ya lo había anotado (fase 1, nota de la 1.5: «los formatos heredados no lo tenían»). La fila K79 de `known-issues.md` («`is_rerun: true` (3.1.x–3.2.x)») partió de esa fixture, y el ADR 0037 y la D7 la siguieron sin comprobarlo.

## Decisión

1. Se retira el punto 9 del ADR 0037. La migración **no lee** `is_rerun` de la franja heredada: todas las franjas migradas llevan `is_rerun: false` (lo pone `radplapag_sanitize_station_schedule()`), como en la 3.4.2.
2. K79 queda como «no se reproduce»: no es un bug. Sus dos tests `currently` pierden el prefijo y conservan la aserción (`test_slot_ignores_is_rerun` en `LegacyPlanTest` y `test_migrated_slot_is_never_a_rerun` en `UpgradeFlowTest`).
3. La D7 y el criterio A4 de la spec 0008 se retiran, y la tarea 1.9 se anula (`0dd208b` y `45b3ef3` se revierten). El *golden* `corrupt` no cambia: `is_rerun: true` en su fixture queda como un dato desconocido que se ignora.

## Consecuencias

- El contrato no promete nada sobre un campo que los datos reales no tienen. `SPEC.md` §3.2, la rule de datos y la spec 0008 lo dicen así.
- Una opción editada a mano con `is_rerun: true` migra como estreno. Es lo mismo que cualquier otra clave desconocida de la franja.
- Lo protegen los dos tests del punto 2 y el *golden* `corrupt`.
- Lección para el triage: una fila de `known-issues.md` sobre datos heredados se contrasta con el código del tag que los escribía, no solo con las fixtures.

## Alternativas descartadas

- **Mantener la 1.9 por si alguien editó la opción a mano:** añade al contrato una regla sobre un campo que ninguna versión escribió, sostenida por un dato falso.

Evidencia: `git grep -il rerun v3.1.0 v3.2.0 v3.3.0 v3.3.1` (vacío) y `git log -S is_rerun` (primero, `v3.4.0`); [`phase-1.md`](../specs/0008-migration-and-core-fixes/phase-1.md) de la 0008, tarea 1.9; nota de la tarea 1.5 de la [fase 1 de la 0002](../specs/0002-safety-net/phase-1.md); decisión del usuario del 2026-10-22.
