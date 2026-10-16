# ADR 0019 — Dos mundos: parte WordPress (WordPress.org) y parte React independiente

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1, §3)

## Contexto

El plugin vive en el directorio de WordPress.org, cuyas guidelines y estándares son obligatorios. El player, en cambio, es una app React que no carga nada de WordPress (ADR 0008, 0009). Aplicar WPCS o `@wordpress/eslint-plugin` al player no tiene sentido; ignorar las guidelines en la parte WordPress pone en riesgo la publicación.

## Decisión

- **Parte WordPress** (`radio-player-page.php`, `includes/`, `admin/`, `blocks/*`, `uninstall.php`, `readme.txt`, `scripts/build-release-zip.sh`): guidelines de WordPress.org, WordPress Coding Standards (PHP, JS, CSS), Plugin Handbook y Block Editor Handbook. Se verifica con Plugin Check, PHPCS (WPCS + PHPCompatibilityWP) y el subagente `wporg-reviewer`.
- **Parte React** (`player/`): sus propias convenciones (TypeScript `strict`, typescript-eslint, Prettier, MUI, i18next). Se verifica con `tsc`, ESLint, Prettier y Vitest del player.
- **Frontera:** el player solo recibe datos por `window.RADPLAPAG_*` y no llama a APIs de WordPress.
- **Común**, porque todo acaba en el zip: licencias GPL-compatibles (la CI lo comprueba), código fuente público, ninguna petición a terceros en runtime y accesibilidad (WCAG 2.2 AA como referencia).

## Consecuencias

- Rules separadas: `wordpress-org.md`, `php.md`, `security.md`, `blocks.md`, `admin.md` frente a `player.md`.
- Los incumplimientos que aparezcan en el código existente se registran en `docs/known-issues.md` y se triagean como cualquier bug.

## Alternativas descartadas

- **Un solo estándar para todo:** WPCS en el player choca con sus herramientas; las del player no cubren lo que exige el directorio.
