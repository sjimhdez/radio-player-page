# Estado
Spec activa: 0002 — Red de seguridad, auditoría y triage · Fase: 1 en curso · Plan: [docs/specs/0002-safety-net/phase-1.md](specs/0002-safety-net/phase-1.md) · Actualizado: 2026-10-16

## En curso
- Spec 0002, fase 1: caracterización unit e integración (22 tareas, 1.1 hecha). PR en borrador #37 contra `trunk`.

## Siguiente (máx. 5)
1. Tarea 1.2: fixtures del horario (`schedule-vectors.json`) y unit de los helpers puros.
2. Tareas 1.3–1.13: PHP (horario, migración, config, programa en antena, bloques, CPT, admin, desinstalación), en orden.
3. Tareas 1.14–1.19: Vitest (utils y hooks del player, admin JS, locales).
4. Tareas 1.20–1.22: cobertura en la CI y `contract-map.md`; después `close-phase`.

## Bloqueos / preguntas para el humano
- Ninguno.

## Verificación manual pendiente
- Ninguna.

## Desviaciones de la spec (→ ADR)
Spec 0002:
- §5 fase 1: `filter_input()` devuelve `null` en CLI. El guardado correcto de URL y página, el aviso tras guardar y C13 se cubren con e2e en la fase 2 (decisión del usuario, 2026-10-16).
- §4.5: la cobertura de PHP por función se lee de `--coverage-xml`; el clover de PHPUnit 9.6 no da funciones globales.
- §5 fase 1: C9 solo en TS. La parte PHP (offset por petición) va con el snapshot de la página limpia en la fase 2.

Spec 0001:
- §6: rama de integración `trunk`; `main` = lo publicado (ADR 0007).
- §4.2: la migración cubre los formatos 2.0.x–3.2.x, no «cualquier versión anterior a la 3.3.0» (ADR 0005).
- §4.8 / decisión 5: `crossOrigin` solo en las fuentes directas (ADR 0004).
- §4.1: los avisos de migración son transients, no opciones (corrección del inventario, sin cambio de contrato; `SPEC.md` §3.1).
- §7.4: no se deniega `git push *` (incompatible con permitir `git push -u origin spec/*`); se deniegan los push a `main`/`trunk`, `--force` y `--delete`.
- §2.2 / §6: `write-spec` ya crea la rama `spec/NNNN-slug` y commitea la spec; `start-phase` hace el primer push y el PR.
- §7.3–§7.4: estándares con línea base por archivo hasta la 0002 (ADR 0021).
- §6: `gh pr merge` ya no está denegado; Claude fusiona solo si el usuario lo pide, con confirmación (nota en el ADR 0007).
