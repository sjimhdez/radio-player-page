# ADR 0006 — happy-dom como entorno DOM de Vitest en el player

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 0, R4)

## Contexto

Los tests unitarios del player (Vitest + Testing Library) necesitan un DOM. Ni happy-dom ni jsdom reproducen medios, así que `use-audio-player` se testea con un *FakeAudioElement* (los métodos de `HTMLMediaElement.prototype` se sustituyen) y con `hls.js`/`dashjs` simulados por `vi.mock`.

## Decisión

- **happy-dom** es el entorno por defecto de Vitest en `player/`.
- Vitest vive **dentro de `player/`**, con su `package.json` y su `vitest.config`, que repite el alias `src/*` de `tsconfig.app.json`.

## Consecuencias

- Los 6 tests del spike pasan con happy-dom y con jsdom. happy-dom prepara el entorno en la mitad de tiempo (~0,17 s frente a ~0,36 s).
- Si un test necesita una API que happy-dom no tiene, puede usar jsdom con `// @vitest-environment jsdom`.
- Ejecutar Vitest desde fuera de `player/` con alias carga dos copias de React (la de Testing Library como *peer*) y rompe los hooks. Es otro motivo para la decisión 7 (sin unificar).

## Alternativas descartadas

- **jsdom por defecto:** es más lento al arrancar y no aporta nada para estos tests.
- **Vitest en la raíz con alias a `player/`:** produce dos copias de React (ver arriba).

Evidencia: [`docs/spikes/0001-phase-0.md`](../spikes/0001-phase-0.md), sección R4.
