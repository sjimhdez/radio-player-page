# Estado
Spec activa: 0001 — Bootstrap: spike, herramientas e ingeniería de contexto · Fase: 1 — Bootstrap: herramientas e ingeniería de contexto · Plan: docs/specs/0001-bootstrap/phase-1.md (por escribir) · Actualizado: 2026-10-16

## En curso
- Nada. La fase 0 (spike) está cerrada: informe en `docs/spikes/0001-phase-0.md` y ADRs 0001–0007 en `docs/adr/`.

## Siguiente (máx. 5)
1. Sesión nueva → plan mode → `docs/specs/0001-bootstrap/phase-1.md` con el formato de la spec (§7.8), partiendo de «Para la fase 1» del informe del spike.
2. Antes de crear `.claude/`: comprobar en la documentación oficial de Claude Code el formato de memoria, settings, rules, skills, hooks, subagentes y MCP (§7.1).
3. Sembrar `docs/known-issues.md` con C1–C16 y los candidatos K1–K3 del spike.

## Bloqueos / preguntas para el humano
- Ninguno. PR en borrador: #36, contra `trunk`. `main` y `trunk` están protegidas con rulesets idénticos (ADR 0007). Cuando la fase 1 cambie los nombres de los jobs de la CI, el usuario tiene que actualizar los checks obligatorios de los dos rulesets (hoy: `PHP Syntax (PHP 7.4)`, `PHP Syntax (PHP 8.4)`, `Player (lint, build, dist check)` y `WordPress blocks`), y la CI debe dispararse también con `push` a `trunk` (§9).

## Verificación manual pendiente
- Ninguna.

## Desviaciones de la spec (→ ADR)
- §6: rama de integración `trunk`; `main` = lo publicado (ADR 0007).
- §4.2: la migración cubre los formatos 2.0.x–3.2.x, no «cualquier versión anterior a la 3.3.0» (ADR 0005).
- §4.8 / decisión 5: `crossOrigin` solo en las fuentes directas (ADR 0004).
