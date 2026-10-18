# Estado
Spec activa: 0002 — Red de seguridad, auditoría y triage · Fase: 4 (auditoría) · Plan: [`phase-4.md`](specs/0002-safety-net/phase-4.md) · Actualizado: 2026-10-18

## En curso
- Spec 0002, fase 4 (auditoría): plan aprobado el 2026-10-17, 4.1 hecha (PHPStan nivel 8 con baseline en `npm run check`), 4.2 hecha (zona 1: K21–K28 y una variante de C10, informe en `audit/core.md`), 4.3 hecha (zona 2: K29–K33 y una variante de K21, informe en `audit/migration.md`; K30 alta), 4.4 hecha (zona 3: K34–K45 y AX5, informe en `audit/admin.md`; huecos del ADR 0023 del admin cerrados, 52 entradas nuevas en la línea base de axe con la aprobación del usuario), 4.5 hecha (zona 4: K46–K54 y una variante de C10, informe en `audit/blocks.md`; hueco del ADR 0023 de `now-playing` cerrado con una emisora siempre en antena, sin entradas nuevas en la línea base); 4.6 hecha (zona 5: K55–K71 y AX6, informe en `audit/player.md`; K67 alta: `dashjs` llama a `time.akamai.com`; huecos de `contract-map.md` cerrados; sin entradas nuevas en la línea base de axe); 4.7 hecha (job `PHPStan` en la CI, en verde en el PR; ADR 0024: nivel 8, la baseline solo baja). Fases 1–3 cerradas; queda la 5 (triage). PR en borrador #37 contra `trunk`.

## Siguiente (máx. 5)
1. `close-phase` de la fase 4.

## Bloqueos / preguntas para el humano
- Fase 3: el criterio del blame de la 3.8 se cumple solo para las líneas que ya existían (82 líneas nuevas de `station-admin.js` siguen en la 3.4, ver desviaciones). ¿Se acepta así?

- Zona 2 (4.3): las dos `phpcs:ignore` de `error_log` del migrador no llevan motivo (ADR 0021). Añadirlo toca código publicado, que esta fase no toca: ¿al triage de la fase 5?

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Si vuelve, mirar su traza en `test-results/e2e`.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.
- K18: en Safari (macOS e iOS), Pausa + Play de un directo MP3 se congela? (medido solo en el WebKit de Playwright en macOS, tareas 2.7 y 2.21; en la CI, WebKitGTK, no pasa).

## Desviaciones de la spec (→ ADR)
Spec 0002:
- §4.6: además de las tres `phpcs:ignore` previstas, van en línea con su motivo `UnusedFunctionParameter` en cinco callbacks de firma fija y `SlowDBQuery` en `scripts/fixtures/seed.php` (como en `seed-e2e.php`), y un `phpcs:disable`/`phpcs:enable` de `ControlSignature.NewlineAfterOpenBrace` alrededor de toda la plantilla de `blocks/now-playing/render.php` (`phpcbf` cambiaría su HTML; el sniff salta en las dos cabeceras). La parte WordPress va en tres commits (`phpcbf`, a mano, supresiones) en lugar de uno, para comparar por tokens el de `phpcbf`. Con `.git-blame-ignore-revs`, las líneas que ya existían devuelven su commit anterior, pero las 82 que creó la 3.4 en `station-admin.js` (llaves de `curly`, líneas partidas por Prettier) siguen atribuidas a ella: no tienen commit anterior.
- §3: K17 (`RADPLAPAG_SCHEDULE` sale `[]` sin franjas, `SPEC.md` §3 dice objeto) queda como fila de `known-issues.md`. Si es bug o redacción de `SPEC.md` (con su ADR) se decide en el triage de la fase 5.
- §4.4: huecos de e2e anotados en las desviaciones de `contract-map.md` (i18n en el navegador, visualizadores, OGG, DASH sin CORS) y de la línea base de axe en el ADR 0023 (`now-playing` según la hora, filas añadidas por JS, errores de validación, contraste). Los revisa la fase 4.
- §5 fase 1: `filter_input()` devuelve `null` en CLI. El guardado correcto de URL y página, el aviso tras guardar y C13 se cubren con e2e en la fase 2 (decisión del usuario, 2026-10-16).
- §4.5: la cobertura de PHP por función se lee de `--coverage-xml`; el clover de PHPUnit 9.6 no da funciones globales.
- §5 fase 1: C9 solo en TS. La parte PHP (offset por petición) la fija el snapshot de la página limpia en la fase 2 (`clean-page.spec.ts`). El horario de verano en PHP lo fija ya la integración (`SiteTimezoneTest`, `timezone_string` con DST); el snapshot sigue en `Asia/Kolkata`.
- §4.1: no hay fixture `legacy-settings` de «conflicto con CPT publicados»: el caso necesita una emisora publicada antes de migrar y lo cubre `UpgradeFlowTest::test_published_station_skips_migration_and_flags_conflict`.
- §4.2: las globales `window.RADPLAPAG_*` no se pueden fijar en integración (las imprime `radplapag_output_clean_page()`, que termina con `exit`): van al snapshot HTTP de la fase 2.
- §4.1: `schedule-vectors.json` amplía el formato: parrillas con nombre (`grids.main`, `grids.c3`), resultados de validación por capa (`php`/`admin`, porque C3 los separa) y el código `start_equals_end` (solo admin). La resolución solo se separa donde el player difiere de PHP: el vector C3-2 lleva un objeto `ts` (K8, día sin franjas tras una que cruza la medianoche); el resultado de primer nivel es el de PHP.

Spec 0001:
- §6: rama de integración `trunk`; `main` = lo publicado (ADR 0007).
- §4.2: la migración cubre los formatos 2.0.x–3.2.x, no «cualquier versión anterior a la 3.3.0» (ADR 0005).
- §4.8 / decisión 5: `crossOrigin` solo en las fuentes directas (ADR 0004).
- §4.1: los avisos de migración son transients, no opciones (corrección del inventario, sin cambio de contrato; `SPEC.md` §3.1).
- §7.4: no se deniega `git push *` (incompatible con permitir `git push -u origin spec/*`); se deniegan los push a `main`/`trunk`, `--force` y `--delete`.
- §2.2 / §6: `write-spec` ya crea la rama `spec/NNNN-slug` y commitea la spec; `start-phase` hace el primer push y el PR.
- §7.3–§7.4: estándares con línea base por archivo hasta la 0002 (ADR 0021).
- §6: `gh pr merge` ya no está denegado; Claude fusiona solo si el usuario lo pide, con confirmación (nota en el ADR 0007).
