---
name: start-phase
description: Empieza una fase de la spec activa. Lee la spec, los ADRs y el plan anterior; en la primera fase prepara la rama spec/NNNN-slug y el PR en borrador contra trunk; en plan mode escribe docs/specs/NNNN-slug/phase-N.md con tareas de ≤ 1 h. Úsala al arrancar cualquier fase, en una sesión nueva.
argument-hint: "[N]"
---

# start-phase

Fase: `$ARGUMENTS` (si falta, la siguiente según `docs/status.md`).

## 1. Leer

1. `docs/status.md` (manda), la spec activa (`docs/specs/NNNN-slug/spec.md`) entera y su «Cómo usar este documento».
2. **Precondición:** la spec está en estado «propuesta» o «en curso», escrita con `write-spec` (con su §0). Si es un «borrador» o falta «Cómo usar este documento», **para**: hace falta una sesión de diseño con `write-spec`.
3. Los ADRs que cita y los de su zona (`docs/adr/README.md`); `SPEC.md` en las secciones que toca; `docs/known-issues.md` si la fase corrige o caracteriza.
4. El plan de la fase anterior (`phase-<N-1>.md`), si existe: lo pendiente pasa a esta fase o queda como desviación con su motivo.
5. Si algo de la spec es falso al contrastarlo con el código, o contradice un ADR: **para y pregunta**. Si se confirma el cambio, `write-adr` y la spec se actualiza en el mismo commit.

## 2. Plan (en plan mode)

Entra en plan mode (herramienta `EnterPlanMode`; si el usuario ya la activó, sigue). Explora el código de la fase y presenta el plan con `ExitPlanMode`. Tras la aprobación, el plan se guarda en `docs/specs/NNNN-slug/phase-N.md` con este formato:

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

## 3. Rama y commit del plan (tras la aprobación)

1. `git fetch origin`. Si existe `spec/NNNN-slug` (la creó `write-spec`), `git switch spec/NNNN-slug`; si no, `git switch -c spec/NNNN-slug origin/trunk`.
2. Si `trunk` avanzó desde que salió la rama, `git merge origin/trunk` (sin rebase). En las fases siguientes de una spec larga, igual al empezar.
3. Escribe `phase-N.md` y actualiza `docs/status.md` (fase, enlace al plan, «En curso» y «Siguiente», máx. 5). Commit `docs(NNNN): add phase N plan` con los dos.

## 4. Push y PR (en la primera fase)

1. `git push -u origin spec/NNNN-slug`.
2. Si la rama no tiene PR: `gh pr create --draft --base trunk --title "Spec NNNN: <título>" --body "<una línea con el enlace a la spec y al plan>"`. **Nunca** sin `--base trunk` (la rama por defecto es `main`, que es lo publicado; ADR 0007).

`npm run check` en verde; actualizar `docs/status.md`.
