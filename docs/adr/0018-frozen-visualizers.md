# ADR 0018 — Visualizadores congelados

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1) · Alcance reducido por el [ADR 0031](0031-visualization-decided-by-the-core.md): `use-can-visualize.tsx` y `use-audio-visualizer.tsx` salen de la zona. Contrato con el reproductor enmendado por el [ADR 0033](0033-retry-direct-sources-without-crossorigin.md) (spec 0007): `use-can-visualize.tsx` ya no existe y el dibujo usa el analizador del controlador (`getAnalyser()`) en lugar de `audioRef`, con `canVisualize` de la instantánea

## Contexto

Los cuatro visualizadores son código de canvas y Web Audio difícil de testear de forma útil, con poco riesgo de regresión si no se tocan. El usuario quiere conservarlos en el producto, pero no invertir en ellos durante la iniciativa (hoja de ruta, decisión 5).

## Decisión

- Siguen en el producto y quedan **fuera del refactor y de los mínimos de cobertura**: `player/src/components/visualizers/**`, `player/src/config/visualizers.ts`, `player/src/types/visualizers.tsx`, `player/src/hooks/use-audio-visualizer.tsx`, `player/src/hooks/use-can-visualize.tsx`.
- **No se editan sin un ADR.** Si una actualización de dependencias obliga, el cambio es el mínimo y lleva su ADR.
- Su contrato con el reproductor (`audioRef` compartido y `crossOrigin` en las fuentes directas, ADR 0004 y 0013) sí se preserva y se testea, con un smoke e2e por visualizador.
- Sus bugs (C5 y la parte del canvas de C15) solo se corrigen si el usuario lo aprueba, con un ADR.

## Consecuencias

- La rule `.claude/rules/visualizers.md` se carga al tocar esas rutas y recuerda la regla; la cobertura los excluye (`player/vitest.config.ts`).
- El refactor del player (spec 0006) los rodea: el núcleo nuevo expone el mismo `<audio>`.

## Alternativas descartadas

- **Quitarlos:** el usuario los quiere en el producto.
- **Incluirlos en el refactor:** coste alto y poco valor para la iniciativa.
