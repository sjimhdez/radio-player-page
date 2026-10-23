# Estado
Spec activa: 0009 — Correcciones: horario y programa en antena · Fase: cerrada (1–4, el 2026-10-23; PR listo, pendiente de merge en `trunk`) · Plan: [`phase-4.md`](specs/0009-schedule-model/phase-4.md) · Actualizado: 2026-10-23

## En curso
- Spec 0009 (horario y programa en antena: C16, C4, K8, K52, C10, K41, K88, K78, K17, C3, C9, K10; ADRs 0044–0046) cerrada el 2026-10-23 en la rama `spec/0009-schedule-model`; PR listo contra `trunk`, a la espera del merge del usuario.
- Spec 0008 cerrada y fusionada en `trunk` (PR #42, 2026-10-22).

## Siguiente (máx. 5)
1. Merge del PR de la 0009 (lo decide el usuario: merge commit, título `Spec 0009: Correcciones: horario y programa en antena`; antes puede lanzar `/code-review`).
2. Tras el merge, sesión de diseño → `write-spec` de la 0010 (admin; parte del modelo de la 0009, notas en la hoja de ruta).
3. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.
4. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente) y `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0009 (meta box y su aviso, validación del horario, `timezone` impreso, reloj en `±H:MM`). No se pasaron al cerrarlas (decisión del usuario). Y el changelog y `== Upgrade Notice ==` de `readme.txt` con lo de la 0009 (lista en la nota de release de `docs/specs/README.md`: ADR 0044, 0045 y 0046).

## Bloqueos / preguntas para el humano
- Decidir si se corrige y en qué spec K76 (baja: `completeTimeFields` y `startEndSame` sin uso; propuesta: 0010 admin).
- Decidir si se corrige y en qué spec K83 (baja, 2026-10-22): durante el reintento de C1 el controlador publica `error` sin `loading`; no se ve con `useState`, pero impide volver a `useSyncExternalStore` (ADR 0030).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna (las de la 0009 ya están en `deviations.md`). Las de las specs cerradas están en [`deviations.md`](deviations.md).
