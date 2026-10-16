# Estado
Spec activa: 0002 — Red de seguridad, auditoría y triage · Fase: 1 por planificar · Plan: — (lo escribe `start-phase` en docs/specs/0002-safety-net/phase-1.md) · Actualizado: 2026-10-16

## En curso
- Nada. La 0001 está cerrada y fusionada en `trunk` (PR #36). La spec 0002 está escrita (rama `spec/0002-safety-net`, commit local, sin push).

## Siguiente (máx. 5)
1. Sesión nueva → `start-phase` de la 0002, fase 1 (caracterización unit e integración). Hace el primer push y abre el PR en borrador contra `trunk`.
2. Si no se ha hecho: el usuario actualiza los checks obligatorios de los rulesets de `main` y `trunk` (ver «Bloqueos»).

## Bloqueos / preguntas para el humano
- **Checks obligatorios de los rulesets.** Los antiguos (`PHP Syntax (PHP 7.4)`, `PHP Syntax (PHP 8.4)`, `Player (lint, build, dist check)`, `WordPress blocks`) ya no existen, salvo los dos de sintaxis. Los jobs de `.github/workflows/ci.yml` son:
  - `PHP Syntax (PHP 7.4)` · `PHP Syntax (PHP 8.4)` · `PHPCS (WPCS + PHPCompatibilityWP)`
  - `PHPUnit unit (PHP 7.4)` · `PHPUnit unit (PHP 8.4)`
  - `PHPUnit integration (PHP 7.4 + WP 6.6)` · `PHPUnit integration (PHP 8.4 + latest WP)`
  - `WordPress JS (root lint + Vitest)` · `Player (typecheck, lint, format, Vitest, build, dist check)`
  - `Block (schedule)` · `Block (programs-list)` · `Block (now-playing)`
  - `Licenses and npm audit (bundled dependencies)` · `Claude Code hook tests`
  - `E2E (PHP 7.4 + WP 6.6, Chromium + WebKit)` · `E2E (PHP 8.4 + latest WP, Chromium + WebKit)`
  - `Release zip (file list and development paths)` · `Plugin Check (release zip)`
- Los `php@7.4`/`php@8.4` de Homebrew ya no arrancan (faltan `libffi` y `net-snmp`). En local, la matriz de PHP se prueba con `docker run php:<v>-cli` o con wp-env. Arreglarlo es opcional (`brew reinstall php@7.4 php@8.4`).

## Verificación manual pendiente
- Ninguna.

## Desviaciones de la spec (→ ADR)
- §6: rama de integración `trunk`; `main` = lo publicado (ADR 0007).
- §4.2: la migración cubre los formatos 2.0.x–3.2.x, no «cualquier versión anterior a la 3.3.0» (ADR 0005).
- §4.8 / decisión 5: `crossOrigin` solo en las fuentes directas (ADR 0004).
- §4.1: los avisos de migración son transients, no opciones (corrección del inventario, sin cambio de contrato; `SPEC.md` §3.1).
- §7.4: no se deniega `git push *` (incompatible con permitir `git push -u origin spec/*`); se deniegan los push a `main`/`trunk`, `--force` y `--delete`.
- §2.2 / §6: `write-spec` ya crea la rama `spec/NNNN-slug` y commitea la spec; `start-phase` hace el primer push y el PR.
- §7.3–§7.4: estándares con línea base por archivo hasta la 0002 (ADR 0021).
- §6: `gh pr merge` ya no está denegado; Claude fusiona solo si el usuario lo pide, con confirmación (nota en el ADR 0007).
