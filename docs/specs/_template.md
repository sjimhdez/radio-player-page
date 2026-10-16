# Spec NNNN — <Título>

> Estado: **propuesta** · Fecha: AAAA-MM-DD · Rama: `spec/NNNN-slug` · Depende de: NNNN
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

<!--
Plantilla de write-spec. < 250 líneas. Una spec ligera (trabajo pequeño) se queda en
§0, §1, §2, §5 (una sola fase) y §6. Borra estos comentarios al escribirla.
-->

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs que cita y las secciones de `SPEC.md` que toca.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/NNNN-slug/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. <Lo específico de esta spec: por dónde empezar, qué no tocar, qué preguntar.>

## 1. Contexto y objetivo

<El problema, por qué ahora, y lo que queda resuelto al cerrar la spec. 5–10 líneas.>

**No objetivos:** <lo que explícitamente queda fuera, y en qué spec va si va en alguna>.

## 2. Criterios de aceptación

<Cada criterio, verificable: qué test (capa y archivo previsto) o qué verificación manual.>

- …

## 3. Cambios al contrato (`SPEC.md`)

<Cada cambio de meta keys, opciones, globales JS, funciones `radplapag_*`, markup o atributos de bloques, assets o comportamiento visible, con su ADR previsto. Si no cambia nada: «Ninguno: el comportamiento caracterizado no cambia».>

## 4. Diseño

<Cómo se va a hacer: módulos, archivos, estrategia de tests (caracterización / TDD), datos y fixtures. Solo lo que la sesión de ejecución no puede deducir del código.>

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`.

### Fase 0 — Spike (solo si hay riesgo técnico sin resolver)

| Riesgo | Pregunta que responde |
|---|---|
| R1 | … |

- **Resultado:** informe en `docs/spikes/NNNN-phase-0.md` y los ADRs que salgan.
- ✅ **Criterio:** cada riesgo tiene una respuesta demostrada o una alternativa aprobada por el usuario.

### Fase 1 — <nombre>

- <Qué se hace.>
- ✅ **Criterios:** <tests que tienen que pasar>.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | … | … | Fase N |

## Apéndice — Referencias

- …
