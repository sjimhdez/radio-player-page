---
paths:
  - "player/src/components/visualizers/**"
  - "player/src/config/visualizers.ts"
  - "player/src/types/visualizers.tsx"
---

# Visualizadores: zona congelada

Los cuatro visualizadores (osciloscopio, barras, cascada y partículas) siguen en el producto, pero **quedan fuera del refactor y de los mínimos de cobertura** (ADR 0018; hoja de ruta, decisión 5). La zona es el dibujo y el catálogo: `components/visualizers/**`, `config/visualizers.ts` y `types/visualizers.tsx`. `use-audio-visualizer.tsx` salió de ella (ADR 0031) y desde la 0007 es solo el bucle de dibujo; `use-can-visualize.tsx` ya no existe. `VisualizerFn` conserva su firma y su ruta (`hooks/use-audio-visualizer.tsx`), que `config/visualizers.ts` importa sin cambios.

## No se edita sin ADR

- Ningún cambio en estos archivos sin un ADR aprobado por el usuario, ni siquiera de estilo o de tipos.
- Si una actualización de dependencias (spec 0003) obliga a tocarlos, el cambio es el mínimo imprescindible, lleva su ADR y se comprueba con el smoke e2e de visualizadores.
- Los bugs de esta zona (C5 y la parte del canvas de C15 en `docs/known-issues.md`) solo se corrigen si el usuario lo aprueba, con un ADR.

## Su contrato con el reproductor (esto sí se preserva y se testea)

- Leen el audio del `AnalyserNode` del controlador (`getAnalyser()` de `useAudioPlayer()`), que conecta el `<audio>` compartido con Web Audio API. Solo el controlador crea el `AudioContext` (en `play()`, dentro del gesto) y conecta el elemento.
- Necesitan que los datos del audio no estén «contaminados» por CORS: por eso `crossOrigin = 'anonymous'` en toda fuente asignada a `audio.src`; en las rutas MSE los datos ya llegan por XHR/fetch con CORS (ADR 0004).
- Se cargan de forma diferida (`getVisualizer()`, `import()` dinámico) y solo se activan con el audio sonando. Si se pintan o sale la animación estática lo decide el núcleo según la fuente (`canVisualize`, ADR 0031 y 0033); el `Dashboard` usa ese único valor para el canvas, la animación estática y el bucle de dibujo (`status === 'playing' && canVisualize`).
- El valor de `radplapag_station_visualizer` elige cuál se usa (`config/visualizers.ts`); mientras carga, o si no existe, se usa el de `getDefaultVisualizer()`.

## Tests

- Excluidos de la cobertura (`player/vitest.config.ts`). `use-audio-visualizer.tsx` no lo está desde la 0007 (tarea 1.8): cuenta en el mínimo de los hooks.
- Smoke e2e (spec 0002): con cada valor de `radplapag_station_visualizer`, la página carga y reproduce sin errores en consola.
