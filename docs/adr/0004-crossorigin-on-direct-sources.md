# ADR 0004 — `crossOrigin` en las fuentes directas, no en las rutas MSE

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 0, R3) · Afecta a: decisión 5 de la hoja de ruta, spec 0001 §4.8 y §7.2

## Contexto

La spec decía «`crossOrigin = 'anonymous'` en todas las fuentes». El spike (R3, R4) y el código de la 3.4.2 muestran otra cosa:

- `use-audio-player.tsx` lo pone **solo cuando asigna `audio.src` directamente**: MP3/OGG, HLS nativo en iOS, HLS nativo como alternativa y el audio de bienvenida.
- En las rutas de **`hls.js` y `dashjs`** (Media Source Extensions, `blob:`), `audio.crossOrigin` queda en `null`. No hace falta: las librerías descargan por XHR/fetch, que ya exige CORS, y el `AnalyserNode` de los visualizadores recibe datos que no están «contaminados».

## Decisión

El contrato con los visualizadores se redacta así:

> Toda fuente que se asigna directamente a `audio.src` lleva `crossOrigin = 'anonymous'`. Las rutas MSE (`hls.js`, `dashjs`) cargan los datos por XHR/fetch con CORS.

Es la redacción del comportamiento actual: el código **no** cambia.

## Consecuencias

- Los tests (spec 0002) fijan `crossOrigin === 'anonymous'` en las rutas directas y `null` en las MSE. Una mutación que quite el atributo rompe los tests de las rutas directas (comprobado en R4).
- C1 sigue igual: sin CORS no suena **ningún** protocolo. En MP3 es por el atributo; en HLS/DASH, por el XHR.
- Se actualizan la decisión 5 de la hoja de ruta, la spec 0001 (§4.8 y la invariante de §7.2) y el borrador de la 0002.

## Alternativas descartadas

- **Mantener la redacción y apuntar las rutas MSE como desviación:** describiría un contrato que el código nunca cumplió y llevaría a «arreglar» algo que funciona.
- **Poner `crossOrigin` también en las rutas MSE:** no tiene efecto sobre un `blob:` y sería un cambio de código sin motivo.

Evidencia: [`docs/spikes/0001-phase-0.md`](../spikes/0001-phase-0.md), secciones R3 y R4.
