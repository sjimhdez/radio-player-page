# Estado
Spec activa: 0006 — Refactor del player · Fase: 3 (Media Session, sueño y dashboard) · Plan: [`phase-3.md`](specs/0006-player-refactor/phase-3.md) · Actualizado: 2026-10-21

## En curso
- Spec 0006: fases 1 (cimientos, globales y tiempo) y 2 (audio) cerradas el 2026-10-21 ([`phase-1.md`](specs/0006-player-refactor/phase-1.md), [`phase-2.md`](specs/0006-player-refactor/phase-2.md)). Fase 3 (Media Session, sueño y dashboard) en curso desde el 2026-10-21: tareas 3.1–3.11, 3.1 (ampliación de D5), 3.2 (e2e de Media Session) 3.3 (caracterización del `Dashboard`) y 3.4 (`core/media-session`) hechas ([`phase-3.md`](specs/0006-player-refactor/phase-3.md)). Rama `spec/0006-player-refactor`, PR en borrador contra `trunk`.

## Siguiente (máx. 5)
1. Fase 3 de la 0006: tarea 3.5 (K14, el tipo del *artwork* por el `pathname`), después 3.6–3.11 en orden y `close-phase`, que cierra la spec.
2. En la pista de WordPress, la 0008 (correcciones de migración y actualización) y la 0012 (núcleo PHP y desinstalación) ya pueden escribirse en paralelo, cada una en su worktree (`docs/specs/README.md`).

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
- Fase 2 (cierre): el plan numera 2.1–2.13 frente a las 2.1–2.5 de §5 (2.1–2.2 → 2.1; 2.3–2.4 → 2.2; 2.5 → 2.3; 2.6–2.8 → 2.4; 2.9–2.10 → 2.5); los commits usan la del plan. La 2.11 (ADR 0030, dos commits) sale de la regresión de la 2.8, la 2.13 de la revisión y la 2.14 de la CI (el e2e del volumen de la 2.1 en WebKitGTK, con la aserción ajustada a `float32` con la aprobación del usuario). No se lanzó `a11y-reviewer` (la fase no toca componentes ni markup). Decidido por el usuario (2026-10-21).
- Fase 2 (2.2): el caso de K80 no lanza los dos `play()` en el mismo tick, sino el segundo desde el `isSupported()` del *fake* (la misma ventana): con Vitest 5.0.5, un `import()` de un módulo con `vi.mock` lanzado mientras otro está en vuelo resuelve al módulo real.
- Fase 1 (plan): A4 pedía `grep -rn "process.env" player/src` vacío, pero los tests de caracterización `utils/timezone.test.ts` y `hooks/use-transmission-time.test.tsx` usan `process.env.TZ` y no se editan. A4 se limita al código publicado (`--exclude='*.test.*'`), y `"types": ["node"]` se queda en `tsconfig.app.json` porque lo usan esos tests (D5). Decidido por el usuario (2026-10-21); corregido en la spec y en el ADR 0029 (1.1).
