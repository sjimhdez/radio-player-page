---
paths:
  - "blocks/**"
---

# Bloques

Tres bloques dinámicos (apiVersion 3, renderizado en el servidor): `radplapag/schedule`, `radplapag/programs-list` y `radplapag/now-playing`.

## Cada bloque es un proyecto independiente (ADR 0020)

- Su `package.json`, su `package-lock.json`, su `.nvmrc`, su `.eslintrc.json` (`root: true`) y su `@wordpress/scripts`. Nada se comparte con otro bloque, con la raíz ni con el player.
- Comandos, siempre desde su carpeta o con `--prefix`: `npm --prefix blocks/<bloque> run check` (lint + build), `run build`, `run lint`.
- El lint usa ESLint 8 en modo eslintrc (`ESLINT_USE_FLAT_CONFIG=false`), para que no lea el `eslint.config.mjs` de la raíz.
- `build/` se commitea y nunca se edita a mano; la CI recompila y compara con `git diff --exit-code`.
- Las actualizaciones de `@wordpress/scripts` son de la spec 0004, bloque a bloque. El e2e en WP 6.6 manda.

## Contrato

- **Atributos** (`block.json`) y **markup** del render (clases, `data-program-id`, estilos en línea) no cambian sin un ADR: los temas pueden depender de ellos.
- Datos del editor: `radplapagScheduleBlock`, `radplapagProgramsListBlock`, `radplapagNowPlayingBlock` (con `wp_localize_script` desde `radio-player-page.php`).
- El render se cubre con snapshots normalizados en `tests/php/integration/` (spec 0002); un cambio de snapshot es un cambio de contrato.

## Estilo

- Estándares JS de WordPress (`@wordpress/eslint-plugin`, `wp-prettier`); `render.php` sigue `php.md` y `security.md` (escapar todo lo que se imprime).
- Textos del editor con `__()` de `@wordpress/i18n` y el text domain `radio-player-page`.
