# Estado
Spec activa: 0006 — Refactor del player · Fase: 2 (audio) · Plan: [`phase-2.md`](specs/0006-player-refactor/phase-2.md) · Actualizado: 2026-10-21

## En curso
- Spec 0006: fase 1 (cimientos, globales y tiempo) cerrada el 2026-10-21 ([`phase-1.md`](specs/0006-player-refactor/phase-1.md)). Fase 2 (audio) en curso: 2.1 hecha (caracterización del ciclo de vida del hook y e2e del *slider* de volumen); 2.2 hecha: las dos sospechas de §4.5 se confirman (K80, K81); 2.3 hecha (`core/audio/protocol` y la fuente `direct`); 2.4 hecha (fuentes `hls` y `dash` con cargadores inyectados y `fake-streaming.ts`); 2.5 hecha (`core/audio/player-machine`, la transición pura, con los `currently` de K1, K11, K63 y K64); 2.6 hecha (`core/audio/audio-controller`: directo, eventos, volumen y `attach`/`detach` idempotentes); 2.7 hecha (la bienvenida y los `currently` de K11, K12, K63, K64 y K70 en el controlador); 2.8 hecha (`useAudioPlayer()` es un adaptador del controlador; el `Harness` sin `eslint-disable`); 2.9 hecha (K70 corregido: las fuentes `hls` y `dash` quitan `crossorigin`); 2.10 hecha (K80 corregido: el controlador serializa `play()`; K81 replicado en el núcleo como `currently`, para la 0007); 2.11 hecha (regresión de la 2.8 corregida: `useAudioPlayer()` con `useState` + `subscribe()`, ADR 0030). Rama `spec/0006-player-refactor`, PR en borrador contra `trunk`.

## Siguiente (máx. 5)
1. Tarea 2.12: verificación de la fase.
3. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree (`docs/specs/README.md`).

## Bloqueos / preguntas para el humano
- Decidir si se corrigen y en qué spec dos rarezas bajas: K76 (`completeTimeFields` sin uso; propuesta: 0010 admin) y K79 (la migración heredada pierde `is_rerun` de las franjas, que el refactor conserva; propuesta: 0008 migración).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Si vuelve, mirar su traza en `test-results/e2e`.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.
- K18: en Safari (macOS e iOS), Pausa + Play de un directo MP3 se congela? (medido solo en el WebKit de Playwright en macOS, tareas 2.7 y 2.21; en la CI, WebKitGTK, no pasa).

## Desviaciones de la spec activa (→ ADR)
Las de las specs cerradas están en [`deviations.md`](deviations.md).
Spec 0006:
- Fase 1 (cierre): el plan numera 1.1–1.10 frente a las 1.1–1.5 de §5 (el reloj se parte en 1.4–1.6 y K9 es la 1.8); los commits usan la del plan. La 1.10 (valor desfasado hasta un minuto al montar y frontera de ESLint en `.tsx`) sale de la revisión. La línea base del gzip de la 1.2 se tomó con otra implementación: la 1.9 y la 1.10 miden frente a `origin/trunk` con `gzip -9` de macOS. No se lanzó `a11y-reviewer` (la fase no toca componentes ni markup). Decidido por el usuario (2026-10-21).
- Fase 2 (2.2): el caso de K80 no lanza los dos `play()` en el mismo tick, sino el segundo desde el `isSupported()` del *fake* (la misma ventana): con Vitest 5.0.5, un `import()` de un módulo con `vi.mock` lanzado mientras otro está en vuelo resuelve al módulo real.
- Fase 1 (plan): A4 pedía `grep -rn "process.env" player/src` vacío, pero los tests de caracterización `utils/timezone.test.ts` y `hooks/use-transmission-time.test.tsx` usan `process.env.TZ` y no se editan. A4 se limita al código publicado (`--exclude='*.test.*'`), y `"types": ["node"]` se queda en `tsconfig.app.json` porque lo usan esos tests (D5). Decidido por el usuario (2026-10-21); corregido en la spec y en el ADR 0029 (1.1).
