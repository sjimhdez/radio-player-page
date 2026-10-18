# Estado
Spec activa: 0002 — Red de seguridad, auditoría y triage · Fase: 5 (triage) · Plan: [`phase-5.md`](specs/0002-safety-net/phase-5.md) · Actualizado: 2026-10-18

## En curso
- Spec 0002, fase 5 (triage, desde el 2026-10-18): 89 filas «pendiente» de `known-issues.md` y 8 sospechas de la auditoría, por zonas (tareas 5.2–5.8), con el usuario; la hoja de ruta 0007+ en 5.9. PR en borrador #37 contra `trunk`.

## Siguiente (máx. 5)
1. 5.6–5.8: triage zona a zona (núcleo PHP, admin, bloques); la sesión propone, el usuario decide. Hechas 5.2–5.5 (5.4: K55 → ADR 0025, redacción de `SPEC.md` §3.8; 5.5: K29 es bug sin ADR, K33 lleva ADR en la spec de migración).
2. Decisiones que cambien la redacción de `SPEC.md` (K46, K53): `write-adr` en su tarea.
3. 5.9: specs 0007+ en `docs/specs/README.md` con sus filas; después `close-phase` (última fase: cierra la spec y deja el PR listo).

## Bloqueos / preguntas para el humano
- Ninguno.

## Verificación manual pendiente
- E2E: la vista previa del editor de bloques en WebKit + WP 6.6 (`blocks.spec.ts`) falló una vez en el suite completo y no se ha reproducido (tarea 2.20). Si vuelve, mirar su traza en `test-results/e2e`.
- Zona 5 (4.6): en Safari real y en iOS, `play()` fuera del gesto con `hls.js`, el temporizador de sueño con la pantalla bloqueada (K66) y los controles con `100vh` bajo la barra de Safari de iOS.
- K18: en Safari (macOS e iOS), Pausa + Play de un directo MP3 se congela? (medido solo en el WebKit de Playwright en macOS, tareas 2.7 y 2.21; en la CI, WebKitGTK, no pasa).

## Desviaciones de la spec (→ ADR)
Spec 0002:
- §5 fase 4: el `/code-review` de cada zona se hizo con un subagente general a esfuerzo alto, solo lectura, en lugar del comando; lo anota el «Resultado:» de cada tarea.
- §4.6: además de las tres `phpcs:ignore` previstas, van en línea con su motivo `UnusedFunctionParameter` en cinco callbacks de firma fija y `SlowDBQuery` en `scripts/fixtures/seed.php` (como en `seed-e2e.php`), y un `phpcs:disable`/`phpcs:enable` de `ControlSignature.NewlineAfterOpenBrace` alrededor de toda la plantilla de `blocks/now-playing/render.php` (`phpcbf` cambiaría su HTML; el sniff salta en las dos cabeceras). La parte WordPress va en tres commits (`phpcbf`, a mano, supresiones) en lugar de uno, para comparar por tokens el de `phpcbf`. Con `.git-blame-ignore-revs`, las líneas que ya existían devuelven su commit anterior, pero las 82 que creó la 3.4 en `station-admin.js` (llaves de `curly`, líneas partidas por Prettier) siguen atribuidas a ella: no tienen commit anterior. Aceptado por el usuario (2026-10-18), con `blame.markUnblamableLines` para marcarlas.
- §3: K17 (`RADPLAPAG_SCHEDULE` sale `[]` sin franjas, `SPEC.md` §3 dice objeto) queda como fila de `known-issues.md`. Triage 5.2 (2026-10-18): es bug, se corrige imprimiendo `{}` (sin ADR).
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
