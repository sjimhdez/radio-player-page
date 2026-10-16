---
name: write-spec
description: Escribe una spec de cambio en docs/specs/NNNN-slug/spec.md en una sesión de diseño (funcionalidad, refactor, actualización o bug no trivial) y la añade al índice. No implementa nada. Úsala cuando el usuario pida un trabajo nuevo o toque escribir la siguiente spec de la hoja de ruta.
argument-hint: "<NNNN o título del trabajo>"
---

# write-spec

Trabajo: `$ARGUMENTS` (si es un número, es la entrada de `docs/specs/README.md`).

**Esta sesión diseña; no implementa.** Otra sesión, nueva, ejecuta la spec con `start-phase`, así que todo lo que necesite tiene que estar escrito en la spec.

## 1. Leer antes de escribir

1. `docs/specs/README.md`: hoja de ruta, decisiones comunes, mínimos de cobertura y lo que ya se sabe de esta spec.
2. `SPEC.md` (contrato), los ADRs relacionados (`docs/adr/README.md`) y `docs/known-issues.md`.
3. Si es la siguiente de una iniciativa: la spec anterior, sus planes de fase (`phase-N.md`) y lo que aprendieron. Lo aprendido se incorpora a esta spec.
4. El código afectado. Cada afirmación sobre el código se comprueba (grep, lectura), no se supone.
5. Si falta información que solo tiene el usuario (alcance, prioridades, qué se acepta cambiar), pregunta antes de escribir.

## 2. Tamaño

- Spec normal: < 250 líneas, con fases de criterios verificables.
- Trabajo pequeño: **spec ligera** de una sola fase (Objetivo, Criterios, Fase 1, Riesgos). Un bug no trivial también lleva spec.
- Si el trabajo tiene riesgo técnico sin resolver, la fase 0 es un **spike** desechable en `spike/` con preguntas concretas.

## 3. Escribir

- Copia `docs/specs/_template.md` a `docs/specs/NNNN-slug/spec.md` (NNNN: el de la hoja de ruta, o el siguiente libre; slug en inglés, kebab-case).
- Rellena todas las secciones. Los criterios de aceptación se escriben **como tests** (qué test, en qué capa) o como verificación manual explícita.
- Cambios al contrato: cada uno con su ADR previsto. Si el trabajo no cambia el contrato, dilo.
- «Cómo usar este documento» para la sesión nueva: qué leer, por dónde empezar y cuándo parar a preguntar.
- Docs en español.

## 4. Registrar

1. Índice de `docs/specs/README.md`: fila con estado «propuesta», rama `spec/NNNN-slug` y dependencias; si estaba como «pendiente de escribir», se actualiza. Las notas de «Lo que se sabe de las specs pendientes» que ya están en la spec se quitan de la hoja de ruta.
2. Rama: `git switch -c spec/NNNN-slug origin/trunk` (tras `git fetch`), commit `docs(NNNN): add spec` con la spec y el índice. Sin push: el primer push y el PR los hace `start-phase`.
3. `docs/status.md`: «Spec activa» pasa a esta spec, fase 0 o 1 «por planificar», y en «Siguiente»: «sesión nueva → `start-phase`».

`npm run check` en verde; actualizar `docs/status.md`.
