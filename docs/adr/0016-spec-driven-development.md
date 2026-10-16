# ADR 0016 — Desarrollo dirigido por specs, por fases y con ingeniería de contexto

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

El plugin (3.4.2, publicado) se desarrolló sin tests ni documentación de decisiones. La iniciativa «base de calidad» va a tocar casi todo (dependencias, refactor, correcciones) y la ejecuta en buena parte Claude Code, en sesiones que no recuerdan las anteriores. Hace falta que el conocimiento y el estado vivan en el repositorio, no en la conversación. El método se toma de `../podcast-player-page` (solo el método, no su arquitectura).

## Decisión

- **`SPEC.md`** describe el producto actual (contrato e invariantes). Cada cambio es una **spec de cambio** en `docs/specs/NNNN-slug/spec.md`, pequeña (< 250 líneas) y escrita justo a tiempo: la siguiente se escribe cuando se cierra la anterior.
- Una spec se escribe en una **sesión de diseño** (`write-spec`) y se ejecuta en una **sesión nueva**. Cada fase empieza con `start-phase` (plan `phase-N.md` aprobado en plan mode) y termina con `close-phase`. Tareas de ≤ 1 h, un commit por tarea.
- La continuidad la dan `docs/status.md` (se inyecta al iniciar la sesión) y el plan de la fase.
- **Ingeniería de contexto** con los mecanismos oficiales de Claude Code: `CLAUDE.md` (< 120 líneas), rules por ruta, skills, hooks (que garantizan lo que las instrucciones solo aconsejan) y subagentes revisores de solo lectura. Cada instrucción vive en un único sitio.
- Las decisiones van a ADRs (este formato). Si una contradice `SPEC.md` o la spec activa, se actualizan en el mismo commit.

## Consecuencias

- Más documentos que mantener; `close-phase` revisa rules y `CLAUDE.md` buscando contradicciones.
- Cualquier sesión puede retomar el trabajo leyendo `status.md`, la spec y el plan.
- Una tarea pequeña también lleva spec (ligera, de una fase).

## Alternativas descartadas

- **Issues de GitHub como única planificación:** el estado quedaría fuera del repositorio y de lo que la sesión recibe al arrancar.
- **Una spec grande para toda la iniciativa:** se queda obsoleta antes de ejecutarse; las specs justo a tiempo incorporan lo aprendido.
