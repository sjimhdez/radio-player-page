# Estado
Spec activa: 0002 — Red de seguridad, auditoría y triage · Fase: 1 en curso · Plan: [docs/specs/0002-safety-net/phase-1.md](specs/0002-safety-net/phase-1.md) · Actualizado: 2026-10-16

## En curso
- Spec 0002, fase 1: caracterización unit e integración (22 tareas, ninguna hecha). PR en borrador contra `trunk`.

## Siguiente (máx. 5)
1. Tarea 1.1: arnés de integración (`is_admin()` al cargar el plugin, `Clock` de §4.3, `Snapshot`). Si el reloj no es fiable en las dos puntas, parar y preguntar.
2. Tareas 1.2–1.13: PHP (horario, migración, config, programa en antena, bloques, CPT, admin, desinstalación), en orden.
3. Tareas 1.14–1.19: Vitest (utils y hooks del player, admin JS, locales).
4. Tareas 1.20–1.22: cobertura en la CI y `contract-map.md`; después `close-phase`.
5. Si no se ha hecho: el usuario actualiza los checks obligatorios de los rulesets de `main` y `trunk` (ver «Bloqueos»).

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
