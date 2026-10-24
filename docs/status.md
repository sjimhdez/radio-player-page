# Estado
Spec activa: 0011 — Correcciones: interfaz, i18n y accesibilidad del player · Fase: 2 en curso · Plan: [phase-2.md](specs/0011-player-ui-fixes/phase-2.md) · Actualizado: 2026-10-24

## En curso
- Spec 0011 ([spec](specs/0011-player-ui-fixes/spec.md), PR #46 en borrador contra `trunk`): fase 1 (foco, estado y error) cerrada el 2026-10-24. Fase 2 (idioma y textos) en curso desde el 2026-10-24: ADR 0050, K68, K55, K62, K69 y C15 en siete tareas ([phase-2.md](specs/0011-player-ui-fixes/phase-2.md)); hechas la 2.1 (ADR 0050 aceptado, `SPEC.md` §3.8 y `rules/player.md` al día), la 2.2 (`fallbackLanguages` en `core/i18n/`) y la 2.3 (K68 corregido: variantes regionales en su idioma base). Falta la 3 (maqueta y movimiento).

## Siguiente (máx. 5)
1. Tareas 2.4–2.7 de la 0011 y `close-phase` de la fase 2; después `start-phase` de la 3, en una sesión nueva. Al cerrar la fase 3, llevar a la nota de release las notas de changelog de la fase 1 (tareas 1.3, 1.5 y 1.6 de [phase-1.md](specs/0011-player-ui-fixes/phase-1.md)).
2. Tras la 0011, la spec de la release (depende de todas).
3. Antes de la release: `wp-security-reviewer` y `wporg-reviewer` sobre el diff de la 0008 (SQL directo de `Migration_Lock`, riesgo 3, y el aviso `is-dismissible`, cuya X solo lo oculta hasta la carga siguiente); `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0009 (meta box y su aviso, validación del horario, `timezone` impreso, reloj en `±H:MM`); y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0010 (fase 1: foco del editor de franjas, `Slot_Validator`; fase 2: `fieldset`/`legend`, etiquetas, ARIA de los errores y foco, y si los errores de `focusout` necesitan `aria-live`, WCAG 4.1.3; fase 3: guardado campo a campo, `redirect_post_location`, avisos de C13, K36 y K27, estos dos sin `aria-describedby`). Y `backcompat-reviewer`, `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` sobre el de la 0013 (fase 1: `stationId` en los `block.json`, `query_vars['rest_route']` en `now-playing/render.php`, `Notice` y ayuda del selector en el editor; fase 2: `<hN>` en lugar de `<header>` y `headingLevel`, `SelectControl` «Heading level», `WP\Player_Page::url()`, `nl2br( esc_html() )`, «On Air: » sin enlace). Y `a11y-reviewer` y `backcompat-reviewer` sobre el de la fase 1 de la 0011 (botón estable con `aria-busy`/`aria-disabled`, región `role="status"`, foco devuelto por los modales y el temporizador; markup del player). No se pasaron al cerrarlas (decisión del usuario). Y el changelog y `== Upgrade Notice ==` de `readme.txt` con lo de la 0009, la 0010 y la 0013 (lista en la nota de release de `docs/specs/README.md`).

## Bloqueos / preguntas para el humano
Ninguno.

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Volvió en la 3.10, en Chromium + WP 6.6 (el `waitForResponse` de la vista previa de `schedule` agota los 30 s); aislado, 10/10. Si vuelve, mirar su traza en `test-results/e2e`.
- E2E: `intro.spec.ts` «plays the welcome audio once, unpausable, then the live stream» falló una vez en Chromium + última WP al cerrar la fase 0 de la 0007 (`waitForPlayback` agota los 30 s); aislado, 20/20. No volvió al cerrar la fase 1 (ya con C7). Si vuelve, mirar su traza (K63 se corrigió en la fase 2).
- E2E en local: si el Mac entra en reposo durante la pasada, los tests de reproducción de WebKit agotan los 30 s (cierre de la fase 1 de la 0007). Las pasadas largas se lanzan con `caffeinate -dims`.
- E2E: `a11y.spec.ts` «a11y: player › all-programs modal» (a veces «schedule modal») sale *flaky* en WebKit en la CI desde la 0005 (pasa al reintentar); no viene de la 0006. Si vuelve, mirar qué violación nueva da la traza.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66), en iPhone y iPad reales (también iPad con la web de escritorio) sin deslizador de volumen y con HLS nativo (K13) y los controles con `100vh` bajo la barra de Safari de iOS (la 0011 pasa la maqueta a `100dvh`, fase 3).

## Desviaciones de la spec activa (→ ADR)
Ninguna pide ADR; todas con la decisión del usuario en [phase-1.md](specs/0011-player-ui-fixes/phase-1.md) y la spec al día:
- K83: la secuencia del reintento es `idle/loading → idle → playing`, y el `error` del elemento se aplaza con toda fuente del directo, no solo la directa (§2 y §4.2).
- K58: el caso de la cuenta a cero va en `sleep.spec.ts`, no en `player-a11y.spec.ts`.
- Línea base: además de las dos altas previstas, las `region` de AX1 en `player · loading` (seis nodos y el *tooltip*); salen con la fase 3. `mp3.spec.ts`: excepción también en 243–249 (rama de WebKit de C8). Las de las specs cerradas están en [`deviations.md`](deviations.md).
