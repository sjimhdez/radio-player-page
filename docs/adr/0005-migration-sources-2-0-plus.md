# ADR 0005 — La migración admite los formatos de la 2.0 en adelante

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 0, R5) · Afecta a: spec 0001 §4.2

## Contexto

La spec decía que la migración de `radplapag_settings` a los CPT debe «funcionar desde cualquier versión anterior a la 3.3.0». El golden master del spike muestra que no es así:

- **1.0.x–1.1.x** guardaban una opción plana (`{ stream_url, player_page }`), sin `stations`.
- El migrador de la 3.3.0 solo lee `stations`.
- El conversor de la 1.2.0 (`radplapag_migrate_old_settings()`) desapareció en la 3.3.0.
- Resultado: un sitio que salte desde la 1.x directamente a la 3.3+ no se migra. `radplapag_db_version` pasa a `'330'` en el primer `plugins_loaded` y la opción queda huérfana.

El usuario confirma que **no quedan sitios anteriores a la 2.0**.

## Decisión

- El contrato de la migración cubre los formatos de **2.0.x a 3.2.x**:
  - 2.0: `stations[]` con imagen, logo, tema y visualizador;
  - 3.1: con `programs` y `schedule`;
  - 3.2: con descripciones.
- Los formatos 1.x quedan **fuera del contrato**: no se tratan como bug ni se corrigen.

## Consecuencias

- La migración sigue siendo idempotente y unidireccional.
- Los golden masters de la 0002 usan fixtures de 2.0, 3.1 y 3.2, y no hace falta un test `currently` para 1.x.
- Si apareciera un sitio con 1.x, la salida es actualizar primero a cualquier 1.2–3.2.

## Alternativas descartadas

- **Registrarlo como K1 y corregirlo en una spec de correcciones:** no compensa, porque no quedan usuarios con ese formato.
- **Mantener «cualquier versión anterior a la 3.3.0»:** el contrato seguiría siendo falso.

Evidencia: [`docs/spikes/0001-phase-0.md`](../spikes/0001-phase-0.md), sección R5.
