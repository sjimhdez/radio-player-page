# ADR 0024 — PHPStan al nivel 8 con baseline

- Estado: aceptado · Fecha: 2026-10-18 · Spec: 0002 (fase 4)

## Contexto
La spec 0002 (§5, fase 4) añade PHPStan al nivel más alto que se pueda sostener sobre el PHP publicado (`radio-player-page.php`, `uninstall.php`, `includes/`, `admin/`, `blocks/*/render.php`), con `szepeviktor/phpstan-wordpress` y `phpVersion: 70400`. Es una herramienta nueva sobre código heredado, como las del ADR 0021, y en la 0002 no se toca código publicado. Medido el 2026-10-17 con PHPStan 2.3.1 y los stubs de WP 7.1.2, errores por nivel: L0–L3: 0 · L4: 20 · L5: 27 · L6: 77 · L7–L8: 83 · L9: 175 · L10: 311. De L4 a L8 son casi todo comprobaciones redundantes (`isset` sobre claves que siempre existen, `is_array()` sobre arrays) y `esc_attr( int )`. La auditoría (tareas 4.2–4.5) revisó las 83 entradas zona a zona: ninguna es un bug.

## Decisión
- **Nivel 8** con `phpstan-baseline.neon` (83 errores en 75 entradas). El 9 duplica los errores con `mixed`, que en código WordPress es ruido (opciones, meta, `$_POST`), y no dio ningún hallazgo nuevo; el 10, todavía más.
- `npm run lint:phpstan` va en `npm run check` detrás de `lint:php`, y el job `PHPStan` de la CI ejecuta el mismo comando con PHP 8.4.
- **La baseline solo baja.** Una entrada nueva solo se acepta con la decisión del usuario apuntada en el plan de la fase. PHPStan ya hace fallar las entradas que no coinciden (`ignore.count`, `reportUnmatchedIgnoredErrors` por defecto), así que al corregir un error hay que quitar su entrada en el mismo commit.
- `phpstan analyse --generate-baseline` solo se usa al corregir (para retirar entradas), nunca para absorber errores nuevos. El diff de `phpstan-baseline.neon` se revisa en el commit: solo puede tener bajas.
- PHPStan y sus archivos son solo de desarrollo (`require-dev`); no entran en el zip (`npm run check:zip`).

## Consecuencias
- Cualquier error nuevo en el PHP publicado lo para `npm run check` y la CI. Mutaciones en local (tareas 4.1 y 4.7): `esc_html( 1 );` al final de `uninstall.php` hace fallar `lint:phpstan` (`argument.type`), y subir el `count` de una entrada también (`ignore.count`).
- Las entradas son por mensaje, archivo y número de apariciones: en un archivo con entradas, un error nuevo con el mismo mensaje que otro ya ignorado cambia el `count` y falla. Lo que no se detecta es mover un error dentro del mismo archivo.
- Las entradas que se corrijan en las specs de correcciones salen de la baseline en el mismo commit. Mientras sigan, el código de la 3.4.2 queda sin esas comprobaciones en sus líneas.
- Subir PHPStan o los stubs de WordPress (la 0004 se descartó: PHPStan y los stubs suben fuera de una spec, ADR 0026) puede cambiar mensajes y conteos sin cambio de código: entonces se regenera la baseline y el diff muestra si solo cambian los mensajes.
- Subir de nivel es una decisión nueva (este ADR se sustituye) y va con su propia baseline.

## Alternativas descartadas
- **Nivel 9 o 10:** más del doble de entradas, todas por `mixed` y sin hallazgos; la baseline taparía más de lo que protege.
- **Nivel 3, sin baseline:** cero errores hoy, pero deja fuera tipos de retorno, argumentos y nulos, justo lo que vigila el 8.
- **Corregir los 83 errores ya:** toca código publicado, en contra de la spec 0002 (§0.4).
- **`ignoreErrors` por identificador en `phpstan.neon.dist`:** desactiva la comprobación en todo el código, también en el nuevo (lo mismo que descarta el ADR 0021 para PHPCS).

Evidencia: `phpstan.neon.dist`, `phpstan-baseline.neon`, `.github/workflows/ci.yml` (job `phpstan`), tareas 4.1 y 4.7 de [`phase-4.md`](../specs/0002-safety-net/phase-4.md); revisión de las entradas en `docs/specs/0002-safety-net/audit/`.
