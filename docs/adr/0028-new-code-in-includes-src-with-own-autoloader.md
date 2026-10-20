# ADR 0028 — Código nuevo en `includes/src/` con autoloader propio

- Estado: aceptado · Fecha: 2026-10-20 · Spec: 0005 (fase 1)

## Contexto
La parte WordPress mezcla en las mismas funciones la lógica (validar y resolver el horario, sanear campos, transformar los ajustes heredados, armar las globales del player) con las llamadas a WordPress (`get_post`, `update_post_meta`, `__()`, `wp_timezone()`). Casi todo se testea en integración, con Docker, y el reloj solo se controla rotando la parrilla (`Support/Clock`). En el admin, la validación del horario de `admin/js/station-admin.js` lee el DOM.

La spec 0005 separa la lógica pura de los adaptadores sin cambiar el contrato (`SPEC.md` §3, ADR 0017: strangler). Hace falta decidir dónde vive el código nuevo y cómo se carga, sin Composer en runtime (CLAUDE.md, ADR 0019), cumpliendo WPCS sin excepciones (ADR 0021) y sin cambiar cómo se cargan los assets que ya existen. Además, el guard del zip (`npm run check:zip`) exige la misma lista de archivos que la `v3.4.2`, así que cualquier archivo nuevo lo rompe, y la cobertura PHP solo se mide hoy en integración (wp-env con Xdebug: en el PHP local no hay Xdebug ni pcov), donde no corren los tests unitarios.

Las decisiones D1–D3 las tomó el usuario en la sesión de diseño de la spec (2026-10-20, spec 0005 §4.1); la de la cobertura, el plan de la fase 1.

## Decisión
- **D1 · Ubicación y nombres.** El código nuevo de PHP vive en el namespace `RadioPlayerPage\`, en `includes/src/`, con los nombres de archivo de WPCS: los segmentos del namespace, en minúsculas y con `_` → `-`, son carpetas; el archivo es `class-<clase en minúsculas, _ → ->.php`. Ejemplo: `RadioPlayerPage\Schedule\Slot_Validator` → `includes/src/schedule/class-slot-validator.php`. Clases `final`, una por archivo, que empieza con `defined( 'ABSPATH' ) || exit;`.
- **Autoloader propio.** `RadioPlayerPage\Autoloader` (`includes/src/class-autoloader.php`) mapea el prefijo a la carpeta como PSR-4, pero con esos nombres de archivo; fuera del prefijo no hace nada. `radio-player-page.php` hace `require_once` del autoloader y llama a `register()` antes que a los demás `includes/`, cuyo orden no cambia. Composer sigue siendo solo de desarrollo.
- **Capas.** Núcleo puro (`includes/src/<zona>/`): recibe arrays, escalares y `DateTimeImmutable` y devuelve arrays u objetos de valor; sin WordPress ni `__()`, con los errores como códigos con datos. Adaptadores de WordPress (`includes/src/wp/`): leen y escriben datos de WP, traducen los códigos y dan la hora. Envoltorios: las funciones `radplapag_*` y las clases `Radplapag_*` conservan archivo, firma y docblock (con un `@since` que dice que delegan). `PureCoreTest` (unit) prohíbe las llamadas a WordPress en el núcleo.
- **El namespace `RadioPlayerPage\` es interno** (`SPEC.md` §3.4): sus clases pueden cambiar entre versiones; la API pública sigue siendo la de §3.4.
- **D2 · Lógica, no presentación.** Registro de CPT, meta y bloques, HTML de los meta boxes, menús, avisos, `blocks/*/render.php` y la plantilla de la página limpia se quedan donde están; solo pasan a llamar al código nuevo.
- **D3 · Admin.** La lógica pura del horario del admin va en un script clásico nuevo, `admin/js/schedule-rules.js` (sin build, ES2019), handle `radplapag-schedule-rules`, dependencia de `radplapag-station-admin`, que expone `window.radplapagScheduleRules` (interno, `SPEC.md` §3.6). Termina con una guarda `if ( typeof module !== 'undefined' && module.exports )` para que Vitest lo importe. Los handles existentes no cambian.
- **Zip con altas declaradas.** `tests/zip/expected-additions.txt` (una ruta por línea, versionada) lista los archivos nuevos del zip. `check:zip` acepta exactamente la lista de `REFERENCE_TAG` más esas altas, y falla si falta o sobra una ruta o si un alta ya estaba en la referencia. `scripts/build-release-zip.sh` no cambia (ya copia `includes/`). Cada release mueve `REFERENCE_TAG` y vacía la lista.
- **Cobertura del núcleo.** `phpunit-integration.xml.dist` tiene una segunda `testsuite`, `unit` (`tests/php/unit`), así que el informe de cobertura de wp-env cuenta lo que prueban los tests unitarios. El núcleo (`includes/src/**` salvo `includes/src/wp/**`) es la zona `core` de `tests/coverage/php-zones.json`, con `min: 90`; los adaptadores y envoltorios siguen en `critical` o `rest`. `scripts/check-php-coverage.mjs` evalúa las zonas en orden: una zona por glob no cuenta las líneas ya reclamadas por las anteriores, y admite `exclude`.

## Consecuencias
- El núcleo se testea sin Docker (`npm run test:php:unit`) y con la hora como parámetro, así que medianoche, horario de verano y desfases se prueban sin rotar la parrilla. `Support/Clock` sigue valiendo para los envoltorios.
- WPCS se cumple sin excepciones en `includes/src/` (`WordPress.Files.FileName` incluido), y `grep -rn 'phpcs:' includes/src` debe salir vacío.
- Un tercero no debe usar `RadioPlayerPage\…`; si lo hace, no tiene garantías. Lo que protege el contrato es `PublicApiTest` (firmas de la 3.4.2) y `HooksTest`.
- La suite unit corre también dentro de wp-env, en PHP 7.4 + WP 6.6 y en la última punta: un test unitario que dependa de no tener WordPress cargado falla allí. El bootstrap de integración define `RADPLAPAG_TESTS_PLUGIN_DIR` si falta.
- Cada archivo nuevo de `includes/src/` va en `expected-additions.txt` en el mismo commit; si no, `check:zip` falla. Olvidar vaciar la lista en la release la deja con altas que ya están en la referencia, y el guard también falla.
- Si WPCS pidiera otro prefijo de archivo para interfaces o traits, el autoloader tendría que admitirlo; por eso se prefieren clases `final` sin interfaces.
- PHP 7.4: propiedades tipadas sí; tipos unión, `match`, `enum`, `readonly` y argumentos con nombre, no (ADR 0012).

## Alternativas descartadas
- **Autoloader de Composer en runtime (`vendor/autoload.php`):** mete `vendor/` en el zip y Composer en producción; CLAUDE.md lo descarta.
- **PSR-4 puro (`includes/src/Schedule/SlotValidator.php`):** obliga a excluir `WordPress.Files.FileName` en una carpeta, contra el ADR 0021.
- **Carpeta nueva en la raíz (`src/`):** cambia `scripts/build-release-zip.sh` y su lista de inclusión; `includes/` ya se publica entero.
- **`require_once` a mano de cada clase:** un error de orden por cada archivo nuevo, y nada que impida cargar adaptadores desde el núcleo.
- **Script modules de WP 6.5 para el admin:** cambian cómo se carga un asset, y `wp_localize_script()` no se aplica a módulos.
- **Un segundo informe de cobertura solo con la suite unit (`--zones`):** necesita Xdebug fuera de wp-env (el PHP local no lo tiene) y unir dos informes; la segunda `testsuite` reutiliza el job y el informe que ya existen.
- **Guard del zip comparando con el árbol actual o regenerando la referencia:** deja pasar cualquier archivo que se cuele; la lista de altas obliga a declarar cada uno.

Evidencia: [`spec.md`](../specs/0005-php-admin-refactor/spec.md) §4.1–§4.6; tareas 1.3 (zip), 1.4 (autoloader), 1.5 (`PureCoreTest`) y 1.6 (cobertura) de [`phase-1.md`](../specs/0005-php-admin-refactor/phase-1.md).
