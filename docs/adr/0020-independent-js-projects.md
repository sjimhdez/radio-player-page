# ADR 0020 — `player/` y cada bloque son proyectos JS independientes

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

Hay cuatro proyectos JS (el player y tres bloques), cada uno con su `package.json` y su lockfile, y ahora una raíz con las herramientas de la parte WordPress. Unificarlos (workspaces, un único lockfile) obligaría a actualizar todo a la vez y mezclaría React del player con las versiones de `@wordpress/scripts`. El spike (R4) vio además que ejecutar Vitest del player desde fuera carga dos copias de React.

## Decisión

- `player/`, `blocks/schedule`, `blocks/programs-list` y `blocks/now-playing` conservan **su `package.json`, su lockfile, su `.nvmrc`, su configuración y su build**. La raíz solo tiene las herramientas de la parte WordPress (wp-env, Playwright, Vitest del admin, ESLint de WordPress) y **orquesta** sin unificar: `npm run check` llama al `check` de cada proyecto.
- Ninguna configuración se hereda entre proyectos: cada bloque tiene su `.eslintrc.json` con `root: true` y lint en modo eslintrc (ESLint 8 encontraba el `eslint.config.mjs` de la raíz); el player tiene su Prettier y su ESLint.
- La CI tiene un job por proyecto. Las dependencias se actualizan proyecto a proyecto (skill `upgrade-dependency`).

## Consecuencias

- Más `npm ci` y más jobs en la CI, a cambio de actualizaciones aisladas (cada proyecto se sube por separado; la 0004 se descartó, ADR 0026).
- Versiones distintas de las mismas herramientas pueden convivir (p. ej. `@wordpress/scripts` 28 en los bloques y el `@wordpress/eslint-plugin` actual en la raíz).

## Alternativas descartadas

- **npm workspaces o un único `package.json`:** acopla las actualizaciones y produce duplicados de React en los tests.
