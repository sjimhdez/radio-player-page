---
name: start-phase
description: Empieza una fase de la spec activa. Lee la spec, los ADRs y el plan anterior; en la primera fase prepara la rama spec/NNNN-slug y el PR en borrador contra trunk; en plan mode escribe docs/specs/NNNN-slug/phase-N.md con tareas de ≤ 1 h. Úsala al arrancar cualquier fase, en una sesión nueva.
argument-hint: "[N]"
---

# start-phase

Fase: `$ARGUMENTS` (si falta, la siguiente según `docs/status.md`).

## 1. Leer

1. `docs/status.md` (manda), la spec activa (`docs/specs/NNNN-slug/spec.md`) entera y su «Cómo usar este documento».
2. Los ADRs que cita y los de su zona (`docs/adr/README.md`); `SPEC.md` en las secciones que toca; `docs/known-issues.md` si la fase corrige o caracteriza.
3. El plan de la fase anterior (`phase-<N-1>.md`): lo pendiente pasa a esta fase o queda como desviación con su motivo.
4. Si algo de la spec es falso al contrastarlo con el código, o contradice un ADR: **para y pregunta**. Si se confirma el cambio, `write-adr` y la spec se actualiza en el mismo commit.

## 2. Rama y PR (solo en la primera fase)

1. `git fetch origin`. Si no existe `spec/NNNN-slug`, créala desde `origin/trunk`; si existe (la creó `write-spec`), cámbiate a ella.
2. Si `trunk` avanzó desde que salió la rama, fusiónalo en ella (`git merge origin/trunk`, sin rebase).
3. `git push -u origin spec/NNNN-slug` y `gh pr create --draft --base trunk --title "Spec NNNN: <título>"` con un cuerpo que enlace la spec. **Nunca** sin `--base trunk` (la rama por defecto es `main`, que es lo publicado; ADR 0007).
4. En fases posteriores de una spec larga, fusiona `origin/trunk` en la rama al empezar.

## 3. Plan (en plan mode)

Entra en plan mode. Explora el código de la fase. Cuando el usuario apruebe, escribe `docs/specs/NNNN-slug/phase-N.md`:

```md
# Spec NNNN · Fase N — <nombre>
Estado: en curso · Inicio: AAAA-MM-DD · ADRs: …

## Contexto        (lo medido al planificar que da forma al plan; opcional)
## Objetivo
## Criterios de aceptación
| Criterio | Cómo se verifica (test o checklist manual) |
## Tareas
### N.1 <título> (≤ 1 h)
- Qué: …
- Archivos: …
- Test: <primero (TDD) | caracterización>: <archivo>
- Verificación: `<comando exacto>`
- [ ] hecha · commit: —
## Decisiones abiertas → ADR
```

- Tareas de **≤ 1 h**, en orden de dependencia, **un commit cada una**: `<type>(NNNN): <description> (N.M)`.
- Cada tarea tiene un comando de verificación que se ejecuta tal cual.
- Cada criterio de aceptación tiene su test, o una entrada de verificación manual.
- Código existente: la tarea de caracterización va antes que la que lo toca.
- Al terminar una tarea se marca `[x]` con su commit (en el commit de la tarea siguiente o en el de cierre), y se añade «Resultado:» si lo que se hizo difiere del plan o se midió algo.

## 4. Registrar

`docs/status.md`: fase, enlace al plan, «En curso» y «Siguiente» (máx. 5). Commit `docs(NNNN): add phase N plan`.

`npm run check` en verde; actualizar `docs/status.md`.
