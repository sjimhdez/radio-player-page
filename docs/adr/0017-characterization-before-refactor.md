# ADR 0017 — Caracterización antes de tocar, TDD para lo nuevo y strangler fig

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

No hay tests y hay sitios en producción. Refactorizar o actualizar dependencias sin red de seguridad puede cambiar el comportamiento sin que nadie lo note. Además, parte del comportamiento actual es raro o erróneo, y corregirlo es una decisión del usuario, no un efecto secundario.

## Decisión

- **Caracterización** (Feathers): antes de tocar un archivo existente se fija su comportamiento actual con tests escritos contra el código **sin modificarlo** (skill `characterize`). Lo raro se fija tal cual con tests `currently` y se registra en `docs/known-issues.md`.
- Un test de caracterización **no se edita para que pase**: si un refactor lo rompe, se arregla el refactor. Solo cambia con un ADR o con la aprobación del usuario.
- **TDD** para la lógica nueva o extraída; **test de regresión en rojo** antes de cada corrección (skill `fix-bug`). Los bugs solo se corrigen en specs de correcciones, tras el triage.
- **Strangler fig:** el código nuevo crece al lado del antiguo (namespace `RadioPlayerPage\`, `player/src/core/`), y lo antiguo pasa a delegar en él; las funciones `radplapag_*` quedan como envoltorios. Nunca una reescritura de golpe.
- En un refactor, el criterio de aceptación base es que el comportamiento caracterizado no cambia.

## Consecuencias

- La spec 0002 (red de seguridad) va antes de cualquier refactor o actualización con riesgo.
- Los mínimos de cobertura de la hoja de ruta los hace cumplir la CI desde la 0002.
- Una costura mínima para poder testear se justifica en el plan de la fase.

## Alternativas descartadas

- **Reescribir con tests nuevos (como la rama abandonada `radio-player-page-next`):** cambia comportamiento sin saberlo y no deja una red sobre el código que está en producción.
- **Corregir los bugs al encontrarlos:** mezcla correcciones con caracterización y quita al usuario la decisión.
