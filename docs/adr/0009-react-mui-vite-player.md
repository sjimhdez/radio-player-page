# ADR 0009 — El reproductor es una app React + MUI + Vite

- Estado: aceptado (retroactivo: rige desde la 1.0.1) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

El reproductor necesita estado complejo (reproducción, protocolos, intro, horario, temporizador, modales), una interfaz cuidada con temas de color, visualizadores en canvas e i18n. Como la página limpia no carga nada de WordPress (ADR 0008), no hay React del editor ni scripts de core disponibles.

## Decisión

- `player/` es un proyecto **React** (con TypeScript `strict`), **MUI** para la interfaz (Emotion) e **i18next** para las traducciones, compilado con **Vite**.
- El build va a `player/dist/` con `manifest.json` y nombres versionados (`radio-player-page-<versión>[-<chunk>].min.js|css`), que PHP lee para imprimir los assets.
- `hls.js` y `dashjs` se cargan con `import()` dinámico, solo cuando el protocolo lo necesita.

## Consecuencias

- El bundle incluye React y MUI (no se pueden tomar de core en una página sin `wp_head`). Su tamaño se vigila al actualizar (presupuesto de +10 % en la spec 0003).
- El player es un proyecto independiente de WordPress, con sus propias herramientas (ADR 0019, 0020).
- Las mayores de React y MUI se actualizan con sus guías y codemods (spec 0003).

## Alternativas descartadas

- **Interactivity API de WordPress o JS sin framework:** la Interactivity API necesita la cola de scripts de WP, que la página limpia no tiene; sin framework, el estado del reproductor se vuelve difícil de mantener.
- **`@wordpress/scripts` para el player:** pensado para bloques y admin; Vite da el servidor de desarrollo con globales simuladas (`player/index.html`) y el manifiesto que usa PHP.
