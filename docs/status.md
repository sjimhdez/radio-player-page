# Estado
Spec activa: 0001 — Bootstrap: spike, herramientas e ingeniería de contexto · Fase: 1 — Bootstrap: herramientas e ingeniería de contexto · Plan: docs/specs/0001-bootstrap/phase-1.md · Actualizado: 2026-10-16

## En curso
- Fase 1: plan aprobado (`phase-1.md`, tareas 1.1–1.31). Siguiente tarea: 1.1 (documentación oficial de Claude Code).

## Siguiente (máx. 5)
1. 1.1 Comprobar en la documentación oficial de Claude Code el formato de memoria, settings, rules, skills, hooks, subagentes y MCP (§7.1).
2. 1.2–1.12 Herramientas (Node 26, raíz, wp-env, Composer/PHPCS, PHPUnit, Vitest, Playwright, zip, `npm run check`).
3. 1.13–1.23 Ingeniería de contexto (hooks con tests, settings, `CLAUDE.md`, rules, skills, subagentes).
4. 1.24–1.28 `SPEC.md`, ADRs 0008–0022 y `docs/known-issues.md`.
5. 1.29–1.31 CI y prueba en seco de las skills; después `close-phase`.

## Bloqueos / preguntas para el humano
- Ninguno. PR en borrador: #36, contra `trunk`. `main` y `trunk` están protegidas con rulesets idénticos (ADR 0007). Cuando la fase 1 cambie los nombres de los jobs de la CI, el usuario tiene que actualizar los checks obligatorios de los dos rulesets (hoy: `PHP Syntax (PHP 7.4)`, `PHP Syntax (PHP 8.4)`, `Player (lint, build, dist check)` y `WordPress blocks`), y la CI debe dispararse también con `push` a `trunk` (§9).

## Verificación manual pendiente
- Ninguna.

## Desviaciones de la spec (→ ADR)
- §6: rama de integración `trunk`; `main` = lo publicado (ADR 0007).
- §4.2: la migración cubre los formatos 2.0.x–3.2.x, no «cualquier versión anterior a la 3.3.0» (ADR 0005).
- §4.8 / decisión 5: `crossOrigin` solo en las fuentes directas (ADR 0004).
