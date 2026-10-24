# Estado
Spec activa: 0011 — Correcciones: interfaz, i18n y accesibilidad del player · Fase: 1 en curso · Plan: [phase-1.md](specs/0011-player-ui-fixes/phase-1.md) · Actualizado: 2026-10-24

## En curso
- Spec 0011, fase 1 (foco, estado y error) empezada el 2026-10-24 ([spec](specs/0011-player-ui-fixes/spec.md), [plan](specs/0011-player-ui-fixes/phase-1.md), PR en borrador contra `trunk`): seis tareas (escenarios de axe, ADR 0051, K56 + AX6 + K59, K83, K57, K58). Decisiones del usuario en el plan: altas de la línea base (también la del *tooltip* en `player · loading`, 1.3), excepción ampliada de `mp3.spec.ts` (132 y 250–254), *tooltip* aceptado al devolver el foco y secuencia de K83 `idle/loading → idle → playing`.
- Spec 0013 cerrada y fusionada en `trunk` (PR #45, 2026-10-24): cierra la pista de WordPress.

## Siguiente (máx. 5)
1. Tarea 1.5 de la fase 1 de la 0011 (K57: los modales devuelven el foco, con `fix-bug`). Hechas 1.1 (escenarios de axe), 1.2 (ADR 0051 y `SPEC.md` §3.8), 1.3 (K56 + AX6 + K59: botón estable y región de estado) y 1.4 (K83: sin `error` durante el reintento de C1).
2. Tras la 0011, la spec de la release (depende de todas).
3. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente); `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0009 (meta box y su aviso, validación del horario, `timezone` impreso, reloj en `±H:MM`); y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0010 (fase 1: foco del editor de franjas, `Slot_Validator`; fase 2: `fieldset`/`legend`, etiquetas, ARIA de los errores y foco, y si los errores de `focusout` necesitan `aria-live`, WCAG 4.1.3; fase 3: guardado campo a campo, `redirect_post_location`, avisos de C13, K36 y K27, estos dos sin `aria-describedby`). Y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0013 (fase 1: `stationId` en los `block.json`, `query_vars['rest_route']` en `now-playing/render.php`, `Notice` y ayuda del selector en el editor; fase 2: `<hN>` en lugar de `<header>` y `headingLevel`, `SelectControl` «Heading level», `WP\Player_Page::url()`, `nl2br( esc_html() )`, «On Air: » sin enlace). No se pasaron al cerrarlas (decisión del usuario). Y el changelog y `== Upgrade Notice ==` de `readme.txt` con lo de la 0009, la 0010 y la 0013 (lista en la nota de release de `docs/specs/README.md`).

## Bloqueos / preguntas para el humano
Ninguno. (K83 se corrige en la 0011, fase 1, sin volver a `useSyncExternalStore`; decisión del usuario, 2026-10-24.)

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS (la 0011 pasa la maqueta a `100dvh`, fase 3).

## Desviaciones de la spec activa (→ ADR)
Ninguna. Las de las specs cerradas están en [`deviations.md`](deviations.md).
