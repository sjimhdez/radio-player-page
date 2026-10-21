---
paths:
  - "**/*.php"
---

# PHP

- **Sintaxis PHP 7.4** en todo lo que se publica: nada de `match`, `enum`, `readonly`, tipos unión, argumentos con nombre, `?->`, `str_contains()`/`str_starts_with()` sin polyfill. PHPCompatibilityWP (`testVersion 7.4-`) lo vigila en `npm run lint:php`.
- **APIs de WP 6.6 como máximo.** Antes de usar una función, comprueba su `@since` en developer.wordpress.org.
- **Estándares:** WPCS 3 (`phpcs.xml.dist`). Todo el código cumple el estándar completo, sin línea base (ADR 0021); cada excepción va en su línea con `// phpcs:ignore` y su motivo.
- **PHPStan** nivel 8 con `phpstan-baseline.neon` (`npm run lint:phpstan`, en `npm run check` y en la CI; ADR 0024). La baseline solo baja: una entrada nueva solo con la decisión del usuario en el plan de la fase. Al corregir un error, su entrada sale en el mismo commit; `--generate-baseline` solo para eso.
- **Prefijos:** funciones globales `radplapag_*`, clases `Radplapag_*`, constantes `RADPLAPAG_*`.
- **Código nuevo** (a partir de la spec 0005, ADR 0028): namespace `RadioPlayerPage\` en `includes/src/`, cargado por `RadioPlayerPage\Autoloader` (`includes/src/class-autoloader.php`). Composer solo se usa en desarrollo, nunca en runtime. El namespace es interno (`SPEC.md` §3.4).
  - **Nombres de archivo de WPCS:** segmentos del namespace en minúsculas y con `_` → `-` como carpetas, y `class-<clase>.php`. `RadioPlayerPage\Schedule\Slot_Validator` → `includes/src/schedule/class-slot-validator.php`. Una clase `final` por archivo; sin interfaces ni traits salvo necesidad.
  - **Cada archivo nuevo de `includes/src/` va en `tests/zip/expected-additions.txt`** en el mismo commit (`npm run check:zip`).
  - **Tres capas:** núcleo puro (`includes/src/<zona>/`: recibe arrays, escalares y `DateTimeImmutable` —nunca lee la hora— y devuelve arrays u objetos de valor; sin funciones de WordPress ni `__()`, los errores son códigos con datos; lo vigila `PureCoreTest`; TDD en `tests/php/unit/`, cobertura ≥ 90 %), adaptadores de WordPress (`includes/src/wp/`: leen y escriben datos de WP, traducen los códigos, dan la hora; integración) y envoltorios (las funciones `radplapag_*` y clases `Radplapag_*` de siempre, en su archivo, con su firma y docblock y un `@since` que dice que delegan).
  - **Entrada del formulario:** el nonce, las capacidades y la lectura de `$_POST` se quedan en el envoltorio (WPCS exige el nonce en la función que lee `$_POST`, y `includes/src/` no lleva `phpcs:`); el adaptador recibe `( $post_id, array $input )`. Un saneador que no es idempotente (`sanitize_text_field`, `sanitize_textarea_field`) se aplica una sola vez, donde se lee `$_POST`; los idempotentes (`absint`, `sanitize_key`) los puede repetir el adaptador (spec 0005, fase 3).
- **Strangler:** las funciones `radplapag_*` y los callbacks enganchados son contrato (`SPEC.md`); al refactorizar se quedan como envoltorios finos que delegan en el código nuevo. Un tercero puede llamarlos o desengancharlos con `remove_action`.
- **Docblocks** en funciones, clases y archivos, con `@since` (versión del plugin en la que aparece) y `@param`/`@return` tipados.
- Cada archivo empieza con `defined( 'ABSPATH' ) || exit;`.
- `php -l` se ejecuta al editar (hook) y en la CI con PHP 7.4 y 8.4.
- **Callbacks con nombre** (`radplapag_*`), no closures, en `add_action`/`add_filter`: así un tercero puede desengancharlos.
- **Depuración:** `error_log()` solo detrás de `WP_DEBUG` (como hace la migración); nada de `var_dump`/`print_r` en lo publicado.
- **Textos** con `__()`/`esc_html__()` y el text domain `radio-player-page`; las cadenas del JS del admin viven en `admin/admin-strings.php`.
