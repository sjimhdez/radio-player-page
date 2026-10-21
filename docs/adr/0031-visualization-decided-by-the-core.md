# ADR 0031 — La visualización la decide el núcleo según la fuente; la zona congelada se reduce al dibujo

- Estado: aceptado · Fecha: 2026-10-21 · Spec: 0007 (diseño; se aplica en la fase 1 con C1) · Enmienda el [ADR 0018](0018-frozen-visualizers.md) (alcance de la zona congelada)

## Contexto

Si el reproductor pinta un visualizador o la animación estática de `StreamInfo` (los puntos de «sonando») lo deciden hoy dos hooks de la zona congelada (ADR 0018). Por lectura del código (sin test todavía, porque la zona está fuera de la cobertura):

- `useCanVisualize()` se calcula **una sola vez, al montar**, con `[audioRef]` como dependencia. El `<audio>` tiene `preload="none"` y aún no tiene `src`, así que la comprobación de mismo origen nunca ve la fuente real: en WebKit siempre da `false` (también con un stream del mismo origen o con CORS) y en el resto siempre `true`, venga de donde venga el audio.
- Decide por el *user agent* (WebKit sin Chrome), no por lo que importa: si los datos del audio llegan «limpios» a Web Audio. Ese requisito (CORS) es el mismo en todos los navegadores.
- Sin visualización, el canvas solo pasa a `opacity: 0`. El `Dashboard` sigue pasando `canvasRef` a `useAudioVisualizer()`, que llama a `createMediaElementSource()` igualmente: el audio pasa por Web Audio para un visualizador que nadie ve, y esa conexión no se puede deshacer en el elemento.
- El `AudioContext` se crea en un efecto al pasar a `playing`, fuera del gesto del usuario, y nunca se llama a `resume()`. Si arranca suspendido (Safari, iOS), el audio ya desviado podría quedar mudo. Sin medir: lo mide el spike de la 0007.

C1 (0007) reintenta las fuentes directas sin `crossOrigin` cuando fallan. Con la lógica actual, Chromium conectaría el visualizador a un medio sin CORS, y Web Audio entrega silencio: el reintento «sonaría» en silencio. La D1 de la 0007 lo parcheaba pasando `canvasRef = null` sobre una decisión que ya es incorrecta. El usuario prefiere rehacerla desde cero dentro de la 0007, para no tener que corregirla después.

## Decisión

1. **Zona congelada reducida.** Siguen congelados (ADR 0018) solo `player/src/components/visualizers/**`, `player/src/config/visualizers.ts` y `player/src/types/visualizers.tsx`: el dibujo y el catálogo. `player/src/hooks/use-can-visualize.tsx` y `player/src/hooks/use-audio-visualizer.tsx` salen de la zona y se rehacen en la 0007. El tipo `VisualizerFn` conserva su firma y una ruta desde la que `config/visualizers.ts` lo importe sin cambios.
2. **Quién decide.** El controlador del audio (`src/core/audio/`, ADR 0029) decide si la fuente que suena se puede visualizar y lo publica en su instantánea (el nombre lo fija el plan de la fase 1). Es una función de la fuente en curso, recalculada en cada intento, no del navegador. Se puede visualizar si hay Web Audio y los datos llegan limpios: rutas MSE (`hls.js`, `dashjs`) o fuente directa cargada con `crossOrigin = 'anonymous'`. No se puede con una fuente directa reintentada sin `crossOrigin` (C1), ni en los casos en que el spike de la 0007 mida silencio o datos planos con CORS (candidato: HLS nativo de iOS y Safari). Sin *user agent* salvo una excepción medida, con su test.
3. **Una sola regla para conectar.** `createMediaElementSource()` solo se llama si la fuente en curso se puede visualizar. Si no, el audio nunca pasa por Web Audio. El cableado de Web Audio (crear y reanudar el `AudioContext`, conectar el analizador) va al núcleo con el constructor inyectado; el hook queda como adaptador del bucle de dibujo.
4. **Una sola fuente de verdad para lo que se ve.** Sonando y visualizable: el visualizador. Sonando y no visualizable: la animación estática. El mismo valor gobierna los dos: sin canvas oculto con el grafo conectado.
5. **Lo que decide el spike de la 0007** (R1, aprobado por el usuario antes de la fase 1): cuándo se crea o se reanuda el `AudioContext` (dentro del gesto de Play o con `resume()`); qué pasa si el elemento ya pasó por Web Audio y la fuente siguiente no sería limpia (la bienvenida con visualizador seguida de C1); qué plataformas dan datos planos con CORS, y si hace falta una red de seguridad en tiempo real (analizador plano N segundos sonando → animación estática).

## Consecuencias

- La decisión queda en el núcleo y se testea con *fakes* (ADR 0029). Los dos hooks salen de la exclusión de cobertura de `player/vitest.config.ts` en la tarea de la 0007 que los rehace, no antes, y desde entonces cuentan para los mínimos de `src/hooks/**` y `src/core/**`.
- Antes de rehacerlos se caracteriza el comportamiento actual (`currently` y fila en `docs/known-issues.md`: WebKit nunca visualiza, el grafo se conecta con el canvas oculto), como manda `characterize`.
- En WebKit con un stream con CORS se verá el visualizador, que hoy nunca sale: cambio visible a propósito, en `SPEC.md` §3.9 y en la revisión visual de la 0007.
- El smoke e2e de visualizadores (`tests/e2e/visualizers.spec.ts`) sigue sin editarse; la 0007 añade el e2e de cuándo se ve el visualizador o la animación estática (Chromium y WebKit, con y sin CORS).
- La rule `.claude/rules/visualizers.md`, `SPEC.md` §3.9 e invariante 6, `CLAUDE.md` y la spec 0007 (D1, A3, §0, R1, riesgo 1) cambian en el mismo commit.

## Alternativas descartadas

- **Parchear C1 en el `Dashboard` (`canvasRef = null` sin CORS), la D1 original:** deja la decisión por *user agent* al montar, con sus errores, y suma una segunda regla.
- **Spec aparte después de la 0007:** C1 se arreglaría con un parche que luego se tira, y la 0007 tendría que reordenarse.
- **Descongelar toda la zona:** el dibujo no tiene fallos que afecten a la reproducción (C5 es estético) y sigue fuera de la iniciativa.
- **Seguir decidiendo por el navegador con una lista mejor:** el requisito real es CORS en todos los navegadores; una lista se queda vieja y no ve la fuente.

Evidencia: lectura de `player/src/hooks/use-can-visualize.tsx`, `player/src/hooks/use-audio-visualizer.tsx` y `player/src/components/dashboard/index.tsx` en `ec8ad80`; la medición, en el informe del spike de la 0007 (`docs/spikes/0007-phase-0.md`).
