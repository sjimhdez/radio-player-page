---
name: close-phase
description: Cierra una fase de la spec activa. Verificación completa (check, integración y e2e en las dos puntas, zip), revisores con contexto limpio, ADRs, SPEC.md, rules y CLAUDE.md al día y docs/status.md apuntando a lo siguiente. En la última fase cierra la spec y deja el PR listo. Úsala cuando todas las tareas de phase-N.md estén hechas.
argument-hint: "[N]"
---

# close-phase

Fase: `$ARGUMENTS` (si falta, la de `docs/status.md`). Spec: la activa.

## 1. Verificación completa (todo en verde; si no, se corrige antes de seguir)

1. `npm run check`.
2. `npm run env:start:min && npm run test:php:integration && npm run test:e2e`.
3. `npm run env:start:latest && npm run test:php:integration && npm run test:e2e`.
4. Builds: `npm --prefix player run build` y el `build` de cada bloque, y después `git diff --exit-code player/dist blocks/*/build`.
5. `npm run check:zip`.
6. CI del PR: `gh pr checks` en verde (tras el push de la rama).

## 2. Criterios de aceptación

Recorre la tabla del plan: cada criterio tiene un test que pasa, o una entrada en «Verificación manual pendiente» de `docs/status.md`.

## 3. Revisores (en paralelo, contexto limpio, solo lectura)

1. Genera el diff de la fase en un archivo: `git diff origin/trunk...HEAD > "$TMPDIR/phase-diff.patch"` (o desde el commit de inicio de la fase).
2. Lanza, pasándoles la ruta del diff, la spec y el plan:
   - siempre `spec-conformance-reviewer` y `backcompat-reviewer`;
   - `wp-security-reviewer` y `wporg-reviewer` si el diff toca la parte WordPress (PHP, `admin/`, `blocks/`, `readme.txt`);
   - `a11y-reviewer` si toca UI (player, render de bloques, admin).
3. Corrige lo que encuentren, o apúntalo como desviación con su motivo. Los bugs nuevos van a `docs/known-issues.md` (no se corrigen fuera de una spec de correcciones).

## 4. Conocimiento

1. **ADRs:** cada decisión de la fase tiene su ADR (`write-adr`), y el índice está al día.
2. **`SPEC.md`:** si cambió el contrato, se actualiza (con el ADR que lo justifica).
3. **Rules y `CLAUDE.md`:** revisa las de las zonas tocadas buscando instrucciones contradictorias, obsoletas o duplicadas (una instrucción vive en un solo sitio). `CLAUDE.md` < 120 líneas. Sugiere al usuario `/doctor prompt-audit` si hubo cambios grandes.
4. **`docs/known-issues.md`** al día con lo encontrado.

## 5. Cierre

1. Plan: `Estado: cerrada (AAAA-MM-DD)`, todas las tareas con su commit.
2. `docs/status.md` (< 60 líneas): apunta a la fase siguiente; lo completado no se acumula ahí.
3. Commit `chore(NNNN): close phase N` y push de la rama (`git push -u origin spec/NNNN-slug`).

## 6. Si es la última fase: cerrar la spec

1. Spec: `Estado: cerrada`. Índice de `docs/specs/README.md`: estado «cerrada».
2. `gh pr ready` para el PR de la rama. **El merge lo hace el usuario** (merge commit, sin squash, título `Spec NNNN: <título>`); puede lanzar antes `/code-review`.
3. `docs/status.md`: «Siguiente: tras el merge, sesión de diseño → `write-spec` de la spec NNNN+1» (o la que toque según la hoja de ruta).

`npm run check` en verde; actualizar `docs/status.md`.
