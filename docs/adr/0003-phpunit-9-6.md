# ADR 0003 — PHPUnit 9.6: excepción a «última versión de todo»

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 0, R7)

## Contexto

La decisión 8 pide la última versión estable de todo, salvo que la matriz de mínimos obligue a otra cosa. La matriz es PHP 7.4 + WP 6.6 y PHP 8.4 + la última WP (7.1.3). La última PHPUnit es la 13.4.

## Decisión

- **PHPUnit `^9.6`** para las suites unitaria y de integración.
- **Yoast PHPUnit Polyfills `^4.0`** y **`@wordpress/env` 11.17.0** van en su última versión.
- `composer.json` fija `config.platform.php = 7.4.33`.

## Consecuencias

- Una sola versión de PHPUnit para las dos puntas de la matriz.
- La suite de integración se ejecuta en `tests-cli`, nunca en `cli`: en `cli`, la librería de tests instala sus tablas sobre el sitio de desarrollo.
- wp-env 11 avisa de que el entorno de tests automático (`testsEnvironment`, `testsPort`) está obsoleto. La fase 1 usa un archivo de configuración aparte para tests (`--config`).
- Esta excepción se revisa cuando suba el mínimo de PHP a 8.1 o cuando la librería de tests de WP admita PHPUnit ≥ 10.

## Alternativas descartadas

- **PHPUnit 11 o 12:** la librería de tests de WP 7.1.3 falla con ellas (`PHPUnit\Util\Test::parseTestMethodAnnotations()` no existe), y además exigen PHP ≥ 8.2 o 8.3.
- **PHPUnit 10:** exige PHP ≥ 8.1 y los polyfills 4 no la admiten.
- **Dos versiones de PHPUnit (9.6 para la mínima y otra para la última):** dobla la configuración y no hay una versión moderna que funcione con la librería de WP.

Evidencia: [`docs/spikes/0001-phase-0.md`](../spikes/0001-phase-0.md), sección R1 y R7.
