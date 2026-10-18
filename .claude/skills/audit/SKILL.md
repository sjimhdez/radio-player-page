---
name: audit
description: Busca errores no detectados en una zona del plugin con herramientas estáticas y revisión con contexto limpio, y contrasta el código con SPEC.md y docs/known-issues.md. Solo registra en known-issues.md lo confirmado con un test currently o una reproducción; no corrige nada. Úsala en la fase de auditoría de la spec 0002 o cuando el usuario pida auditar una zona.
argument-hint: "<zona: horario | migración | página limpia | bloques | admin | desinstalación | player | …>"
---

# audit

Zona: `$ARGUMENTS`.

**No se corrige nada.** El resultado son filas confirmadas en `docs/known-issues.md`.

## 1. Herramientas estáticas de la zona

- PHP: `npm run lint:php` (estándar completo, sin línea base desde la spec 0002; revisa también los `phpcs:ignore` de la zona y su motivo). PHPStan con `npm run lint:phpstan` (nivel 8 con baseline, ADR 0024): cada entrada de la baseline de la zona, ¿bug o ruido?
- Player: `npm --prefix player run typecheck`, `lint`.
- Admin/bloques: ESLint de su proyecto.
- Seguridad y guidelines: lee `.claude/rules/security.md` y `wordpress-org.md` y recórrelas sobre la zona.

## 2. Revisión con contexto limpio

- `/code-review` a esfuerzo alto sobre los archivos de la zona: pídeselo al usuario o lanza un subagente que lo haga.
- Subagentes que apliquen, con la lista de archivos: `wp-security-reviewer` y `wporg-reviewer` (parte WordPress), `backcompat-reviewer` (contrato), `a11y-reviewer` (UI).

## 3. Contraste

- Con `SPEC.md`: cada punto del contrato de la zona, ¿lo hace el código?
- Con `docs/known-issues.md`: cada `C*`/`K*` de la zona, ¿sigue ocurriendo?

## 4. Confirmar o descartar

Cada hallazgo candidato:

- **Confirmado:** test `currently` que lo fija (skill `characterize`) o reproducción escrita paso a paso (para lo que no se puede automatizar). → fila en `docs/known-issues.md` con origen «auditoría» (o «guidelines», «axe»), archivo, test, gravedad propuesta y decisión del usuario pendiente.
- **No confirmado:** se descarta. Se apunta en una línea del plan de la fase («descartado: … porque …») para no volver a investigarlo.

Commit `test(NNNN): audit <zona> (N.M)` con los tests `currently` y las filas nuevas.

`npm run check` en verde; actualizar `docs/status.md`.
