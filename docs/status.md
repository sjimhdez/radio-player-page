# Estado
Spec activa: 0007 — Correcciones: reproducción · Fase: 1 en curso · Plan: [`phase-1.md`](specs/0007-playback-fixes/phase-1.md) · Actualizado: 2026-10-22

## En curso
- Fase 1 de la 0007 (plan aprobado el 2026-10-22, [`phase-1.md`](specs/0007-playback-fixes/phase-1.md)): K67 (1.1, hecha: `dashjs` ya no pide la hora a Akamai), el *fixture* de K18 (1.2, hecha: `/live.mp3` emite solo los marcos de audio), C7 y K12 con el ADR 0032 (1.3, hecha: Play tras una pausa recarga el directo en todos los protocolos), la caracterización de los hooks del visualizador (1.4, hecha: fila K82, la decisión por *user agent* al montar y el grafo conectado con el canvas oculto), el grafo de Web Audio en el núcleo (1.5), C1 con el ADR 0033 (1.6), `canVisualize` en la instantánea (1.7) y los hooks rehechos (1.8).
- Spec 0007 (Correcciones: reproducción) escrita el 2026-10-21 ([`spec.md`](specs/0007-playback-fixes/spec.md)), rama `spec/0007-playback-fixes` con PR en borrador contra `trunk`. Fase 0 (spike) cerrada el 2026-10-22, propuesta aprobada por el usuario; informe en [`spikes/0007-phase-0.md`](spikes/0007-phase-0.md). Medido: K67 pide limpiar las fuentes de hora **después** de `initialize()`; K18 es del *fixture* e2e, no del player; WebKit solo da datos al analizador con un MP3 finito con longitud. Elegido por el usuario: la bienvenida no se visualiza y WebKit nunca visualiza. Spec corregida.
- ADR 0031 (2026-10-21): la decisión visualizador / animación estática se rehace en la 0007. La decide el núcleo según la fuente; `use-can-visualize.tsx` y `use-audio-visualizer.tsx` salen de la zona congelada. El spike (R1) mide lo que falta.
- Spec 0006 (Refactor del player) cerrada y fusionada en `trunk` (PR #40, 2026-10-21).

## Siguiente (máx. 5)
1. Tarea 1.5 de la fase 1: el grafo de Web Audio y la excepción de WebKit en el núcleo (`core/audio/web-audio.ts`, TDD con `fake-web-audio.ts`).
2. Seguir las tareas 1.6–1.8 en orden y cerrar la fase con `close-phase`, que incluye una pasada en Safari con el player corregido (A15).
3. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree.

## Bloqueos / preguntas para el humano
- Decidir si se corrigen y en qué spec dos rarezas bajas: K76 (`completeTimeFields` sin uso; propuesta: 0010 admin) y K79 (la migración heredada pierde `is_rerun` de las franjas, que el refactor conserva; propuesta: 0008 migración).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. La fase no tocaba código publicado. Si vuelve, mirar su traza: es la zona de K63 y C7 de la fase 1.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.
- 0007 (A15): K18 y C1 verificados en Safari real con la página del spike (macOS e iOS, 2026-10-22). Al cerrar la fase 1, una pasada en Safari con el player corregido.

## Desviaciones de la spec activa (→ ADR)
Ninguna. Las de las specs cerradas están en [`deviations.md`](deviations.md).
