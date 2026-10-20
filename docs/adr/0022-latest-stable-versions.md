# ADR 0022 — La última versión estable de todo, con excepciones documentadas

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

Las dependencias están desactualizadas (Node 20 ya no tiene soporte, `@wordpress/scripts` 28 en los bloques). Quedarse atrás acumula deuda de seguridad y saltos de versión cada vez más caros. Pero los mínimos (PHP 7.4, WP 6.6; ADR 0012) obligan a algunas herramientas a quedarse en versiones antiguas.

## Decisión

- Toda dependencia y herramienta va a su **última versión estable** (hoja de ruta, decisión 8). Las de desarrollo de la raíz y del player se fijan con versión exacta.
- Una herramienta que la matriz de mínimos obliga a fijar más atrás lleva **su ADR**, con la versión elegida y por qué. Excepciones vigentes:
  - **PHPUnit 9.6** (ADR 0003): la librería de tests de WordPress no funciona con PHPUnit ≥ 10, y PHPUnit ≥ 10 exige PHP ≥ 8.1.
  - **TypeScript 5.9.3 en `blocks/now-playing`** (dependencia de desarrollo, spec 0001 fase 1): el *peer* TypeScript 7 rompía `@typescript-eslint` 6 de `@wordpress/scripts` 28. Se revisa al actualizar `@wordpress/scripts` (spec 0003, ADR 0026).
- ~~Las actualizaciones se hacen una versión mayor por commit~~: sustituido por el [ADR 0026](0026-grouped-dependency-upgrades.md) (un commit por proyecto, todo junto). Siguen la guía de migración oficial y los codemods (skill `upgrade-dependency`).
- Node: la última (ADR 0002).

## Consecuencias

- La spec 0003 lleva el player y los bloques a la última versión; la raíz, Composer y las Actions se suben fuera de una spec (ADR 0026).
- `npm audit` y `composer audit` en la CI vigilan lo que queda atrás.

## Alternativas descartadas

- **Fijar en LTS o «la que funcione»:** más estable a corto plazo, pero repite la deuda que motivó la iniciativa.
