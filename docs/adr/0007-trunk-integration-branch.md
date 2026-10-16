# ADR 0007 — Rama de integración `trunk`; `main` = lo publicado

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 · Sustituye: el flujo de ramas original de la spec 0001 §6 (solo `main`) · Afecta a: decisión 3 de la hoja de ruta

## Contexto

La spec 0001 proponía un único `main` que podía ir por delante de lo publicado: lo publicado lo marcaban los tags `vX.Y.Z`. El usuario prefiere que **`main` refleje siempre la última versión publicada en wordpress.org**, y que el trabajo de la iniciativa (que no se publica hasta la spec de release) se integre en otra rama.

## Decisión

- **Dos ramas largas:**
  - **`trunk`**: rama de integración. Sale de `main` (3.4.2) y siempre está en verde. Recibe todos los PRs de las specs.
  - **`main`**: lo publicado. Solo recibe PRs de release (`trunk` → `main`) y de hotfix. Cada merge publicado lleva su tag `vX.Y.Z`.
- **Las ramas cortas no cambian:** `spec/NNNN-slug` sale de `trunk` y vuelve a `trunk` por PR, con merge commit (sin squash). El merge lo decide siempre el usuario: lo hace él o, si lo pide, Claude con `gh pr merge` (con confirmación; ver la nota de 2026-10-16 al final).
- **Release:** la spec de release se fusiona en `trunk`. Después, un PR `trunk` → `main` titulado `Release vX.Y.Z`, con merge commit, y el tag en ese merge.
- **Hotfix:** `hotfix/X.Y.Z` sale de `main`, entra en `main` por PR y se le pone el tag. Después, un PR `main` → `trunk` lleva el arreglo a la integración.
- `main` sigue siendo la rama por defecto en GitHub, de modo que quien visita el repositorio ve lo publicado. Por eso los PRs de spec se abren siempre con `--base trunk`.
- Las dos ramas están protegidas con el mismo ruleset: PR obligatorio, CI en verde con la rama al día, sin force push, sin borrado y solo merge commit.

## Consecuencias

- `main` y el tag más reciente coinciden siempre.
- Hay dos rulesets que mantener: cuando la CI cambie los nombres de sus jobs, se actualizan los dos.
- Cada release y cada hotfix suponen un PR más.
- `git log --first-parent trunk` muestra una línea por spec, y `git log --first-parent main` una línea por versión.
- Al ser `main` la rama por defecto, un PR abierto sin `--base` apuntaría a `main`. Las skills (`start-phase`, `release`) y los permisos de Claude lo tienen en cuenta.
- La CI se dispara con `push` a `main` y a `trunk`, y con `pull_request`.

## Alternativas descartadas

- **Solo `main`, con los tags para lo publicado** (la propuesta original de la spec): tiene menos ceremonia, pero `main` iría por delante de lo publicado durante toda la iniciativa.
- **`trunk` como rama por defecto en GitHub:** los PRs apuntarían solos a `trunk`, pero quien visita el repositorio vería código sin publicar.
- **GitFlow completo** (ramas `release/*` y `feature/*` además de `develop`): sobra para un solo desarrollador que publica por SVN.

**Nota (2026-10-16, cierre de la spec 0001):** a petición del usuario, `gh pr merge` deja de estar denegado en `.claude/settings.json`. No está en `allow`, así que Claude Code pide confirmación en cada merge. Claude solo fusiona cuando el usuario lo pide. Siguen denegados el push directo a `main`/`trunk`, `git tag` y `svn`.
