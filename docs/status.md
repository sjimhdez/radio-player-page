# Estado
Spec activa: 0010 — Correcciones: admin · Fase: 3 en curso · Plan: [phase-3.md](specs/0010-admin-fixes/phase-3.md) · Actualizado: 2026-10-23

## En curso
- Spec 0010 (admin: K15 alta; editor de franjas, accesibilidad del horario y guardado; ADRs 0047 y 0048), rama `spec/0010-admin-fixes`. Fases 1 (editor de franjas) y 2 (accesibilidad del horario: AX3, AX4, K45, K89, AX5, K20) cerradas el 2026-10-23. Fase 3 (campos y guardado: C13, K42, K37, K36, K27, K5, K34, «Entrada publicada» y K76) en curso desde el 2026-10-23; tareas 3.1 (ADRs 0047 y 0048, `SPEC.md` §3.4 y §3.6, §4.3 ampliada) y 3.2 (K42 en el servidor: la URL y la página, cada una si es válida) 3.3 (K42 en el cliente: solo `http://` o `https://`) y 3.4 (K37 en el guardado: el adjunto rechazado conserva su valor y avisa) hechas. Refactor dirigido, no reescritura (usuario, 2026-10-23).
- Spec 0009 cerrada y fusionada en `trunk` (PR #43, 2026-10-23).

## Siguiente (máx. 5)
1. Tareas 3.5 a 3.11 de la [fase 3](specs/0010-admin-fixes/phase-3.md) y `close-phase`, que cierra la spec 0010 (`wp-security-reviewer` y `wporg-reviewer`, a elección del usuario).
2. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.
3. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente) y `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0009 (meta box y su aviso, validación del horario, `timezone` impreso, reloj en `±H:MM`). Y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la fase 1 de la 0010 (editor de franjas: foco, `Slot_Validator`); y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la fase 2 (meta box del horario: `fieldset`/`legend`, etiquetas, ARIA de los errores y foco; que `a11y-reviewer` valore si los errores de `focusout` necesitan `aria-live`, WCAG 4.1.3, fuera del alcance de K45). Al cerrar las dos fases solo se pasó `spec-conformance-reviewer`. No se pasaron al cerrarlas (decisión del usuario). Y el changelog y `== Upgrade Notice ==` de `readme.txt` con lo de la 0009 (lista en la nota de release de `docs/specs/README.md`: ADR 0044, 0045 y 0046).

## Bloqueos / preguntas para el humano
- Decidir si se corrige y en qué spec K83 (baja, 2026-10-22): durante el reintento de C1 el controlador publica `error` sin `loading`; no se ve con `useState`, pero impide volver a `useSyncExternalStore` (ADR 0030).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna. Las de las specs cerradas están en [`deviations.md`](deviations.md).
