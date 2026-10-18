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
- **Código nuevo** (a partir de la spec 0005): namespace `RadioPlayerPage\` con un autoloader PSR-4 propio. Composer solo se usa en desarrollo, nunca en runtime.
- **Strangler:** las funciones `radplapag_*` y los callbacks enganchados son contrato (`SPEC.md`); al refactorizar se quedan como envoltorios finos que delegan en el código nuevo. Un tercero puede llamarlos o desengancharlos con `remove_action`.
- **Lógica pura separada** de los adaptadores de WP: lo que no necesita WordPress se testea en `tests/php/unit/` sin Docker.
- **Docblocks** en funciones, clases y archivos, con `@since` (versión del plugin en la que aparece) y `@param`/`@return` tipados.
- Cada archivo empieza con `defined( 'ABSPATH' ) || exit;`.
- `php -l` se ejecuta al editar (hook) y en la CI con PHP 7.4 y 8.4.
- **Callbacks con nombre** (`radplapag_*`), no closures, en `add_action`/`add_filter`: así un tercero puede desengancharlos.
- **Depuración:** `error_log()` solo detrás de `WP_DEBUG` (como hace la migración); nada de `var_dump`/`print_r` en lo publicado.
- **Textos** con `__()`/`esc_html__()` y el text domain `radio-player-page`; las cadenas del JS del admin viven en `admin/admin-strings.php`.
