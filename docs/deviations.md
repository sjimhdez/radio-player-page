# Desviaciones de las specs cerradas

Lo que cada spec hizo distinto de lo escrito, con su motivo y quién lo decidió. Las de la spec activa están en `status.md` y pasan aquí al cerrarla (`close-phase`). Las más recientes van primero.

## Spec 0009
Detalle en cada `phase-N.md`. Los cambios de contrato van con su ADR (0044–0046).

- Fases 1 a 4 (cierre): solo `spec-conformance-reviewer` y `backcompat-reviewer`, sobre el diff de cada fase; `wp-security-reviewer`, `wporg-reviewer` y `a11y-reviewer` quedan para antes de la release. Decidido por el usuario (2026-10-23).
- Fase 4 (4.2): D8 decía `get_option( 'timezone_string' )`; la zona sale de `$now->getTimezone()->getName()` (el mismo `$now` de `wp_timezone()` que da `timezoneOffset`), `null` si es un desfase `±HH:MM`. Equivale y no añade un parámetro al núcleo (ADR 0046).
- Fase 4 (4.4 y 4.5): D6 decía calcular día y hora con `Intl.DateTimeFormat` (`weekday`); en su lugar, `getStationOffset()` da el desfase actual de la zona en cada minuto y se pasa a las funciones de siempre, que conservan su firma (ADR 0046).
- Fase 4 (4.2): §4.3 decía que, para C9, `Support/Clock` fija `timezone_string`; los tests de `SiteTimezoneTest` usan `update_option()` y `WP\Clock::now()`, porque solo comprueban la zona impresa, no la hora.

## Spec 0008
Detalle en el «Resultado» de cada tarea de `phase-1.md`, `phase-2.md` y `phase-3.md`. Los cambios de contrato van con su ADR (0037–0043).

- Fase 3 (cierre): solo `spec-conformance-reviewer` y `backcompat-reviewer`, sobre el diff de la fase; `wp-security-reviewer` y `wporg-reviewer`, previstos sobre el diff de la spec, quedan para antes de la release. Decidido por el usuario (2026-10-23).
- Fase 3 (3.5 y 3.6): el *mu-plugin* de los e2e se carga también en la integración; `PublicApiTest` y `HooksTest` cuentan solo las funciones y callbacks de los archivos del plugin. Decidido por el usuario (2026-10-23).
- Fase 3 (3.6): K25 conserva la guarda `empty( $args[0] )` antes de `get_post()`, para no caer en el post global.
- Fase 3 (3.2 y 3.3): el *mu-plugin* es `tests/e2e/mu-plugins/radplapag-e2e.php` y la cabecera `X-Radplapag-E2e-Rtl: 1`, no los nombres del plan.
- Fase 2 (cierre): K86, K87 y dos huecos de test pasan a la fase 3; `wp-security-reviewer` y `wporg-reviewer` se aplazan al cierre de la spec. Decidido por el usuario (2026-10-23).
- Fase 2: el aviso de éxito no caduca (ADR 0041). Decidido por el usuario (2026-10-23).
- Fase 1: la toma del bloqueo es un `INSERT IGNORE` (ADR 0038); la 1.12 (renovación, ADR 0040) sale de la revisión; `is_rerun` heredado se anula (ADR 0039). Decidido por el usuario (2026-10-22).

## Spec 0007
Detalle en cada `phase-N.md`. Los cambios de contrato van con su ADR (0031–0036).

- Fase 3 (cierre): un solo revisor (`spec-conformance-reviewer`, con la compatibilidad hacia atrás); la accesibilidad se revisó sin subagente. Decidido por el usuario (2026-10-22).
- Fase 3 (3.3): D8 y A12 se enmiendan con el ADR 0036: el volumen se decide por capacidad y la detección de iOS para HLS pasa al núcleo, en lugar de parchear `useIsIOS()`. Decidido por el usuario (2026-10-22).
- Fase 3 (3.1): A11 esperaba 60 s y el test espera 59 (29 min retenidos más el *tick* de 1 s); corregido en el plan.
- Fase 2 (cierre): un solo revisor (`spec-conformance-reviewer`); la compatibilidad se revisó sin subagente. Decidido por el usuario (2026-10-22). K83 se caracterizó tras la 2.7 sin número de tarea.
- Fase 1 (cierre): solo los dos revisores obligatorios (`spec-conformance-reviewer` y `backcompat-reviewer`). Decidido por el usuario (2026-10-22).

## Spec 0006
Detalle en el «Resultado:» de cada tarea de `phase-1.md`, `phase-2.md` y `phase-3.md`; sin cambios de contrato (ADRs 0029 y 0030).

- Fase 3 (cierre): el plan numera 3.1–3.11 frente a las 3.1–3.4 de §5 (3.4–3.5 → 3.1; 3.6–3.8 → 3.2; 3.9 → 3.3; 3.10–3.11 → 3.4); los commits usan la del plan. La 3.1 (ampliación de D5), la 3.2 (e2e de Media Session) y la 3.3 (caracterización del `Dashboard`) no están en §5: salen al planificar (riesgo 5 y §4.4). D5 decía que el `NodeJS.Timeout` de `SleepMode.tsx` pasaba a `ReturnType<typeof setInterval>`; desapareció con la cuenta atrás (3.8), y la spec y el ADR 0029 se corrigen al cerrar. A1: en la 3.10, el e2e completo en `env:start:min` dio 1 fallo, el intermitente de `blocks.spec.ts` (2.20; aislado, 10/10); la CI del PR #40 pasa la matriz min/latest entera.
- Fase 2 (cierre): el plan numera 2.1–2.13 frente a las 2.1–2.5 de §5 (2.1–2.2 → 2.1; 2.3–2.4 → 2.2; 2.5 → 2.3; 2.6–2.8 → 2.4; 2.9–2.10 → 2.5); los commits usan la del plan. La 2.11 (ADR 0030, dos commits) sale de la regresión de la 2.8, la 2.13 de la revisión y la 2.14 de la CI (el e2e del volumen de la 2.1 en WebKitGTK, con la aserción ajustada a `float32` con la aprobación del usuario). No se lanzó `a11y-reviewer` (la fase no toca componentes ni markup). Decidido por el usuario (2026-10-21).
- Fase 2 (2.2): el caso de K80 no lanza los dos `play()` en el mismo tick, sino el segundo desde el `isSupported()` del *fake* (la misma ventana): con Vitest 5.0.5, un `import()` de un módulo con `vi.mock` lanzado mientras otro está en vuelo resuelve al módulo real.
- Fase 1 (cierre): el plan numera 1.1–1.10 frente a las 1.1–1.5 de §5 (el reloj se parte en 1.4–1.6 y K9 es la 1.8); los commits usan la del plan. La 1.10 (valor desfasado hasta un minuto al montar y frontera de ESLint en `.tsx`) sale de la revisión. La línea base del gzip de la 1.2 se tomó con otra implementación: la 1.9 y la 1.10 miden frente a `origin/trunk` con `gzip -9` de macOS. No se lanzó `a11y-reviewer` (la fase no toca componentes ni markup). Decidido por el usuario (2026-10-21).
- Fase 1 (plan): A4 pedía `grep -rn "process.env" player/src` vacío, pero los tests de caracterización `utils/timezone.test.ts` y `hooks/use-transmission-time.test.tsx` usan `process.env.TZ` y no se editan. A4 se limita al código publicado (`--exclude='*.test.*'`), y `"types": ["node"]` se queda en `tsconfig.app.json` porque lo usan esos tests (D5). Decidido por el usuario (2026-10-21); corregido en la spec y en el ADR 0029 (1.1).

## Spec 0005
Detalle en el «Resultado:» de cada tarea de `phase-1.md`, `phase-2.md`, `phase-3.md` y `phase-4.md`; sin ADR, no cambian el contrato.

- Fase 4 (revisión): sin efecto en los datos ni en lo observable sin filtros de terceros. `Migration\Legacy_Plan` sanea todos los programas (cada aparición) y emisoras antes de escribir nada; en la 3.4.2, una vez por programa único y cada emisora justo antes de insertarla. Sale la guarda `(int) $post_id > 0` de la reversión (inalcanzable: los IDs vienen de `wp_insert_post( …, true )`). `radplapag_on_upgrader_process_complete()` calcula `plugin_basename()` (sin filtro) antes de comprobar `action`/`type`, no después. `Upgrade_Policy::is_current()` recibe `string $target`: un `RADPLAPAG_DB_VERSION` entero definido fuera del plugin se compararía como cadena (fuera del contrato).
- Fase 4 (plan): §4.3 pone el `error_log()` de la migración en `WP\Migration_Writer`. Se queda en `Radplapag_Migrator_Settings_To_Cpt::run()`, que le pasa al escritor un closure con la comprobación de `WP_DEBUG` y un solo `phpcs:ignore` con su motivo (K72), porque `includes/src/` no lleva `phpcs:` (A6). El escritor lo llama en los mismos momentos que hoy. Decidido por el usuario (2026-10-21).
- Fase 3 (revisión): se quitan dos guardas inalcanzables, como en la fase 1: `isset`/`is_array` de `radplapag_get_config()['stations']` en `radplapag_get_station_for_current_page()` (la función no tiene filtro y siempre da un array) e `instanceof WP_Post` en `WP\Station_Repository::published_rows()` (`get_posts()` con `suppress_filters` solo da posts; un `posts_pre_query` con un ID sin post rompe antes dentro de WP, comprobado). Los títulos y `blogname` pasan a parámetros `string`: un filtro que devolviera `null` daría un `TypeError` (WP siempre da cadenas), y `get_bloginfo( 'name' )` se lee siempre, no solo sin título. En la 3.12, `Radplapag_Station_Config` se caracterizó después de delegarla (3.5), no antes (§4.4); los tests pasan también contra la clase de `trunk`. El arnés de los tests de orden de escrituras (3.2, 3.8) escucha `set_transient` en WP ≥ 6.8 (`setted_transient` está obsoleta); las listas esperadas no cambian.
- Fase 3 (plan): §4.3 pone el nonce, las capacidades y `$_POST` en el adaptador del guardado. Se quedan en `radplapag_save_station_meta()` y `radplapag_save_program_meta()`, con su `phpcs:ignore` de siempre, porque WPCS exige el nonce en la misma función que lee `$_POST` y A6 no admite supresiones en `includes/src/`. El adaptador (`WP\Station_Meta_Saver`, `WP\Program_Meta_Saver`) recibe `( $post_id, array $input )`. Decidido por el usuario (2026-10-21).
- Fase 2 (plan): riesgo 1 de la spec. Las filas que añade el JS conservan el texto visible de hoy (entidades decodificadas como hacía `innerHTML`) con `DOMParser`; K21 sigue para la 0012. Decidido por el usuario (2026-10-20).
- Fase 2, 2.5: `AdminScreensTest::test_admin_scripts_on_the_station_screen` amplía la aserción de `deps` de `radplapag-station-admin` con `radplapag-schedule-rules` (ADR 0028 D3), fija los `deps` de `radplapag-program-admin` en el mismo bucle y añade aserciones del handle nuevo (también en `test_admin_scripts_on_the_program_screen`, que no se registre). Solo esa aserción cambia; lo demás son altas. Aprobado por el usuario (2026-10-20).
- Fase 2, 2.8: una traducción con etiquetas en la fila que añade el JS se ve como texto (antes `innerHTML` creaba los elementos; ninguna cadena del plugin las lleva). K77. Aceptado por el usuario (2026-10-21).
- Fase 2, 2.3: se quita la rama inalcanzable «Please complete all time fields»; `completeTimeFields` sigue en `radplapagAdmin.strings` (contrato, §3.6) sin uso: K76.
- Fase 1, 1.8: `Slot_Validator` no emite `end_before_start` (§4.2): la rama era inalcanzable en la 3.4.2. `WP\Schedule_Messages` conserva el mensaje para el POT. En la 1.10 y la 1.12 se quitan las guardas inalcanzables de la 3.4.2 (`count( $days_out ) === 7`, claves de día `null`).
- Fase 1, 1.6: `SmokeTest` pasa al grupo `no-wordpress` (solo la anotación) para que la suite unit corra dentro de la integración (ADR 0028). Fase 1, 1.3: la guarda del zip con altas va en su propia tarea y no con el ADR (§4.5). La 1.16 (autoloader con identificadores válidos) sale de `close-phase`.

## Spec 0003

- Tarea 1.1: K71 (anuncio de i18next en la consola) lo corrigió la subida a i18next 26, fuera de una spec de correcciones; su test `currently` pasa a regresión en la misma fase. Aprobado por el usuario (2026-10-20).
- Tarea 1.2b: K73 (fallo del test `BlockRenderTest`, depende del día de la semana) se arregla en la 0003 y no en la 0013, porque deja la CI en rojo los lunes y martes. Solo el test; los snapshots no cambian. Aprobado por el usuario (2026-10-20).
- Tarea 1.1: hls.js 1.7 pasa `preferManagedMediaSource` a `false`; se restaura con `new Hls({ preferManagedMediaSource: true })` (código de producción, con test unitario) para no cambiar el comportamiento en Safari. Decidido por el usuario (2026-10-20).
- Tarea 1.6 (sale de `close-phase`): Vite 8 quitaba los avisos de licencia del bundle; se restauran y `check:zip` lo vigila. Decidido por el usuario (2026-10-20).
- Tarea 1.2: el runtime de webpack de `@wordpress/scripts` 37 usa `Object.hasOwn` también en `programs-list` y `schedule` (`now-playing` ya lo usaba). Solo corre en el editor; el e2e de bloques en WP 6.6 pasa en Chromium y WebKit. Sin ADR.

## Spec 0002

- §5 fase 4: el `/code-review` de cada zona se hizo con un subagente general a esfuerzo alto, solo lectura, en lugar del comando; lo anota el «Resultado:» de cada tarea.
- §4.6: además de las tres `phpcs:ignore` previstas, van en línea con su motivo `UnusedFunctionParameter` en cinco callbacks de firma fija y `SlowDBQuery` en `scripts/fixtures/seed.php` (como en `seed-e2e.php`), y un `phpcs:disable`/`phpcs:enable` de `ControlSignature.NewlineAfterOpenBrace` alrededor de toda la plantilla de `blocks/now-playing/render.php` (`phpcbf` cambiaría su HTML; el sniff salta en las dos cabeceras). La parte WordPress va en tres commits (`phpcbf`, a mano, supresiones) en lugar de uno, para comparar por tokens el de `phpcbf`. Con `.git-blame-ignore-revs`, las líneas que ya existían devuelven su commit anterior, pero las 82 que creó la 3.4 en `station-admin.js` (llaves de `curly`, líneas partidas por Prettier) siguen atribuidas a ella: no tienen commit anterior. Aceptado por el usuario (2026-10-18), con `blame.markUnblamableLines` para marcarlas.
- §3: K17 (`RADPLAPAG_SCHEDULE` sale `[]` sin franjas, `SPEC.md` §3 dice objeto) queda como fila de `known-issues.md`. Triage 5.2 (2026-10-18): es bug, se corrige imprimiendo `{}`; en el cierre, el usuario pidió un ADR corto en la 0009 (cambia la forma observable de una global).
- §5 fase 5 (Método, paso 4): las decisiones que cambiarán `SPEC.md` §3 o un ADR al corregirse llevan su ADR en la spec de correcciones que las aplica, no en el triage; solo K55 (redacción, sin código) tuvo su ADR en la fase (0025). Lista en «Decisiones abiertas» de `phase-5.md`.
- §4.4: huecos de e2e anotados en las desviaciones de `contract-map.md` (i18n en el navegador, visualizadores, OGG, DASH sin CORS) y de la línea base de axe en el ADR 0023 (`now-playing` según la hora, filas añadidas por JS, errores de validación, contraste). Los revisa la fase 4.
- §5 fase 1: `filter_input()` devuelve `null` en CLI. El guardado correcto de URL y página, el aviso tras guardar y C13 se cubren con e2e en la fase 2 (decisión del usuario, 2026-10-16).
- §4.5: la cobertura de PHP por función se lee de `--coverage-xml`; el clover de PHPUnit 9.6 no da funciones globales.
- §5 fase 1: C9 solo en TS. La parte PHP (offset por petición) la fija el snapshot de la página limpia en la fase 2 (`clean-page.spec.ts`). El horario de verano en PHP lo fija ya la integración (`SiteTimezoneTest`, `timezone_string` con DST); el snapshot sigue en `Asia/Kolkata`.
- §4.1: no hay fixture `legacy-settings` de «conflicto con CPT publicados»: el caso necesita una emisora publicada antes de migrar y lo cubre `UpgradeFlowTest::test_published_station_skips_migration_and_flags_conflict`.
- §4.2: las globales `window.RADPLAPAG_*` no se pueden fijar en integración (las imprime `radplapag_output_clean_page()`, que termina con `exit`): van al snapshot HTTP de la fase 2.
- §4.1: `schedule-vectors.json` amplía el formato: parrillas con nombre (`grids.main`, `grids.c3`), resultados de validación por capa (`php`/`admin`, porque C3 los separa) y el código `start_equals_end` (solo admin). La resolución solo se separa donde el player difiere de PHP: el vector C3-2 lleva un objeto `ts` (K8, día sin franjas tras una que cruza la medianoche); el resultado de primer nivel es el de PHP.

## Spec 0001

- §6: rama de integración `trunk`; `main` = lo publicado (ADR 0007).
- §4.2: la migración cubre los formatos 2.0.x–3.2.x, no «cualquier versión anterior a la 3.3.0» (ADR 0005).
- §4.8 / decisión 5: `crossOrigin` solo en las fuentes directas (ADR 0004).
- §4.1: los avisos de migración son transients, no opciones (corrección del inventario, sin cambio de contrato; `SPEC.md` §3.1).
- §7.4: no se deniega `git push *` (incompatible con permitir `git push -u origin spec/*`); se deniegan los push a `main`/`trunk`, `--force` y `--delete`.
- §2.2 / §6: `write-spec` ya crea la rama `spec/NNNN-slug` y commitea la spec; `start-phase` hace el primer push y el PR.
- §7.3–§7.4: estándares con línea base por archivo hasta la 0002 (ADR 0021).
- §6: `gh pr merge` ya no está denegado; Claude fusiona solo si el usuario lo pide, con confirmación (nota en el ADR 0007).
