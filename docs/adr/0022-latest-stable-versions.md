# ADR 0022 — La última versión estable de todo, con excepciones documentadas

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1) · Actualizado: 2026-10-20 (spec 0003, fase 1: excepciones)

## Contexto

Las dependencias están desactualizadas (Node 20 ya no tiene soporte, `@wordpress/scripts` 28 en los bloques). Quedarse atrás acumula deuda de seguridad y saltos de versión cada vez más caros. Pero los mínimos (PHP 7.4, WP 6.6; ADR 0012) obligan a algunas herramientas a quedarse en versiones antiguas.

## Decisión

- Toda dependencia y herramienta va a su **última versión estable** (hoja de ruta, decisión 8). Las de desarrollo de la raíz y del player se fijan con versión exacta.
- Una herramienta que la matriz de mínimos o el *peer* de otra dependencia obliga a fijar más atrás lleva **su ADR**, con la versión elegida y por qué. Excepciones vigentes:
  - **PHPUnit 9.6** (ADR 0003): la librería de tests de WordPress no funciona con PHPUnit ≥ 10, y PHPUnit ≥ 10 exige PHP ≥ 8.1.
  - **TypeScript 6.0.x en `player/` y en `blocks/now-playing`** (dependencia de desarrollo, spec 0003 fase 1): `typescript-eslint` 8.72, el último, pide `typescript >=4.8.4 <6.1.0`, y TypeScript 7 ya existe. En `now-playing` sustituye a la 5.9.3 de la spec 0001 (que imponía `@typescript-eslint` 6 de `@wordpress/scripts` 28); con `@wordpress/scripts` 37 el límite es el mismo *peer*. En `programs-list` y `schedule` no es dependencia directa: npm la resuelve en la 6.0.x por el mismo *peer*. Se revisa cuando `typescript-eslint` admita la 7 (riesgo 6 de la spec 0003).
  - **`@babel/runtime` 7.x en los bloques** (dependencia de desarrollo, spec 0003 fase 1): la 8 existe, pero `@wordpress/scripts` 37 sigue en `@babel/core` ^7 y `@wordpress/babel-preset-default` 10. Va en la 7.29.x, la última de la 7. No aparece en `blocks/*/build/`. Se revisa cuando `@wordpress/scripts` pase a Babel 8.
- ~~Las actualizaciones se hacen una versión mayor por commit~~: sustituido por el [ADR 0026](0026-grouped-dependency-upgrades.md) (un commit por proyecto, todo junto). Siguen la guía de migración oficial y los codemods (skill `upgrade-dependency`).
- Node: la última (ADR 0002).

## Consecuencias

- La spec 0003 lleva el player y los bloques a la última versión; la raíz, Composer y las Actions se suben fuera de una spec (ADR 0026).
- `npm audit` y `composer audit` en la CI vigilan lo que queda atrás.

## Alternativas descartadas

- **Fijar en LTS o «la que funcione»:** más estable a corto plazo, pero repite la deuda que motivó la iniciativa.
