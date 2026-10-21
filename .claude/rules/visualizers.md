---
paths:
  - "player/src/components/visualizers/**"
  - "player/src/config/visualizers.ts"
  - "player/src/types/visualizers.tsx"
---

# Visualizadores: zona congelada

Los cuatro visualizadores (osciloscopio, barras, cascada y partículas) siguen en el producto, pero **quedan fuera del refactor y de los mínimos de cobertura** (ADR 0018; hoja de ruta, decisión 5). La zona es el dibujo y el catálogo: `components/visualizers/**`, `config/visualizers.ts` y `types/visualizers.tsx`. `use-can-visualize.tsx` y `use-audio-visualizer.tsx` salieron de ella (ADR 0031) y los rehace la 0007; `VisualizerFn` conserva su firma y una ruta que `config/visualizers.ts` pueda importar sin cambios.

## No se edita sin ADR

- Ningún cambio en estos archivos sin un ADR aprobado por el usuario, ni siquiera de estilo o de tipos.
- Si una actualización de dependencias (spec 0003) obliga a tocarlos, el cambio es el mínimo imprescindible, lleva su ADR y se comprueba con el smoke e2e de visualizadores.
- Los bugs de esta zona (C5 y la parte del canvas de C15 en `docs/known-issues.md`) solo se corrigen si el usuario lo aprueba, con un ADR.

## Su contrato con el reproductor (esto sí se preserva y se testea)

- Leen el audio del `<audio>` compartido por `audioRef` mediante Web Audio API (`AnalyserNode`).
- Necesitan que los datos del audio no estén «contaminados» por CORS: por eso `crossOrigin = 'anonymous'` en toda fuente asignada a `audio.src`; en las rutas MSE los datos ya llegan por XHR/fetch con CORS (ADR 0004).
- Se cargan de forma diferida (`getVisualizer()`, `import()` dinámico) y solo se activan con el audio sonando. Si se pintan o sale la animación estática lo decide el núcleo según la fuente (ADR 0031; hasta la 0007, `use-can-visualize.tsx`).
- El valor de `radplapag_station_visualizer` elige cuál se usa (`config/visualizers.ts`); mientras carga, o si no existe, se usa el de `getDefaultVisualizer()`.

## Tests

- Excluidos de la cobertura (`player/vitest.config.ts`). Los dos hooks siguen excluidos hasta la tarea de la 0007 que los rehace (ADR 0031).
- Smoke e2e (spec 0002): con cada valor de `radplapag_station_visualizer`, la página carga y reproduce sin errores en consola.
