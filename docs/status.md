# Estado
Spec activa: 0010 — Correcciones: admin · Fase: cerrada (1–3, el 2026-10-23; PR #44 listo, pendiente de merge en `trunk`) · Plan: [phase-3.md](specs/0010-admin-fixes/phase-3.md) · Actualizado: 2026-10-23

## En curso
- Spec 0010 (admin: K15, K16, K39, K44, K74, K75, K38, AX3, AX4, K45, K89, AX5, K20, C13, K42, K37, K36, K27, K5, K34, K90, K76; ADRs 0047 y 0048) cerrada el 2026-10-23 en la rama `spec/0010-admin-fixes`; PR #44 listo contra `trunk`, a la espera del merge del usuario.
- Spec 0009 cerrada y fusionada en `trunk` (PR #43, 2026-10-23).

## Siguiente (máx. 5)
1. Merge del PR #44 (lo decide el usuario: merge commit, título `Spec 0010: Correcciones: admin`; antes puede lanzar `/code-review`). Tras el merge, sesión de diseño → `write-spec` de la 0013 (bloques; notas en la hoja de ruta).
2. En la pista del player, sesión de diseño → `write-spec` de la 0011 (interfaz, i18n y accesibilidad; notas en la hoja de ruta), en su worktree.
3. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente); `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0009 (meta box y su aviso, validación del horario, `timezone` impreso, reloj en `±H:MM`); y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0010 (fase 1: foco del editor de franjas, `Slot_Validator`; fase 2: `fieldset`/`legend`, etiquetas, ARIA de los errores y foco, y si los errores de `focusout` necesitan `aria-live`, WCAG 4.1.3; fase 3: guardado campo a campo, `redirect_post_location`, avisos de C13, K36 y K27, estos dos sin `aria-describedby`). No se pasaron al cerrarlas (decisión del usuario). Y el changelog y `== Upgrade Notice ==` de `readme.txt` con lo de la 0009 y la 0010 (lista en la nota de release de `docs/specs/README.md`).

## Bloqueos / preguntas para el humano
- Decidir si se corrige y en qué spec K83 (baja, 2026-10-22): durante el reintento de C1 el controlador publica `error` sin `loading`; no se ve con `useState`, pero impide volver a `useSyncExternalStore` (ADR 0030).

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS.

## Desviaciones de la spec activa (→ ADR)
Ninguna (las de la 0010 ya están en `deviations.md`). Las de las specs cerradas están en [`deviations.md`](deviations.md).
