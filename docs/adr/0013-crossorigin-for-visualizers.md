# ADR 0013 — `crossOrigin = 'anonymous'` en el audio para los visualizadores

- Estado: aceptado (retroactivo: rige desde la 1.0.1); su alcance lo precisa [ADR 0004](0004-crossorigin-on-direct-sources.md); enmendado por [ADR 0033](0033-retry-direct-sources-without-crossorigin.md) (reintento sin `crossOrigin`) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

Los visualizadores leen las muestras del `<audio>` con Web Audio API (`createMediaElementSource` + `AnalyserNode`). Si el audio viene de otro origen sin CORS, el navegador entrega silencio al analizador (medio «contaminado»), y el visualizador no se mueve. Los streams casi siempre están en otro dominio que el sitio.

## Decisión

- El reproductor pone `audio.crossOrigin = 'anonymous'` al asignar `audio.src`, para que los visualizadores reciban datos reales cuando el servidor del stream envía cabeceras CORS.
- ADR 0004 precisa el alcance: solo en las fuentes asignadas directamente a `audio.src` (audio directo, HLS nativo, audio de bienvenida); las rutas MSE (`hls.js`, `dashjs`) ya descargan por XHR/fetch con CORS.

## Consecuencias

- **Un stream sin cabeceras CORS no suena** (C1, medido en el spike: con MP3 por el atributo; con HLS/DASH lo bloquearía igualmente el XHR). Es el precio de los visualizadores; cambiarlo es decisión del usuario en una spec de correcciones.
- Es parte del contrato entre el reproductor y la zona congelada (ADR 0018): se testea en la 0002.

## Alternativas descartadas

- **Sin `crossOrigin`:** los streams sin CORS sonarían, pero los visualizadores quedarían planos en casi todos los sitios.
- **`crossOrigin` solo si el visualizador está activo, o reintento sin él tras un error:** posible corrección futura (C1), no comportamiento actual.
