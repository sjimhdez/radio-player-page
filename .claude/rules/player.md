---
paths:
  - "player/**"
---

# Player (React + MUI + Vite)

**Proyecto independiente de WordPress** (ADR 0019, 0020): sus herramientas, su `package.json`, su lockfile y sus convenciones. No se le aplican WPCS ni `@wordpress/eslint-plugin`.

## Herramientas

- `npm --prefix player run check` = `tsc -b` + ESLint (typescript-eslint + react-hooks) + `prettier --check` (`player/.prettierrc`) + Vitest con cobertura (`test:coverage`, happy-dom, ADR 0006; umbrales por glob en `vitest.config.ts`).
- `npm --prefix player run build` → `player/dist/` (se commitea; nombres `radio-player-page-<versión>[-<chunk>].min.js|css`, que PHP lee de `manifest.json`).
- TypeScript `strict`. Alias `src/*` (en `tsconfig.app.json`, `vite.config.ts` y `vitest.config.ts`).
- Prettier cubre todo `src/` salvo `src/config/visualizers.ts`, la zona congelada (ADR 0018), que es lo único que lista `player/.prettierignore` además de lo generado; no se añaden más (ADR 0021).

## Frontera con WordPress

- El player **solo** recibe datos por `window.RADPLAPAG_CONFIG`, `window.RADPLAPAG_PROGRAMS` y `window.RADPLAPAG_SCHEDULE`, que lee y valida `hooks/use-config.tsx`. No llama a APIs de WordPress (REST, `wp.*`, admin-ajax).
- **Ninguna petición a terceros** en runtime: ni fuentes de CDN, ni analítica. Lo de `player/index.html` es solo para el servidor de desarrollo y no entra en el zip.

## Reproducción

- Protocolo por la extensión de la URL: MP3/OGG directo; HLS nativo en iOS y con `hls.js` en el resto (nativo como alternativa); DASH con `dashjs`. `hls.js` y `dashjs` se cargan con `import()` dinámico.
- `crossOrigin = 'anonymous'` en toda fuente asignada a `audio.src` (MP3/OGG, HLS nativo, intro); no en las rutas MSE (ADR 0004).
- El audio de bienvenida suena una vez antes del directo, no se puede pausar y, si falla, pasa al directo sin error.
- **El horario no controla la reproducción:** solo informa (programa actual y siguiente, modales).
- Volumen desactivado en iOS (`use-is-ios.tsx`).

## Estructura y dirección del refactor (spec 0006)

- La lógica pura vive en `src/utils/` y, después de la 0006, en `src/core/` sin React ni MUI (máquina de estados del audio, adaptadores por protocolo, horario, sueño, Media Session, lectura de las globales).
- Los hooks (`src/hooks/`) quedan como adaptadores finos sobre el núcleo; los componentes (`src/components/dashboard/`) solo pintan.
- Los visualizadores son zona congelada (`visualizers.md`).

## i18n

- 14 locales en `src/locales/*.json` (i18next). Todos tienen las mismas claves que `en-US.json` (test de paridad en la 0002).
- Idioma: el del sitio, por el `lang` del `<html>`; reserva `en-US`. El navegador y `localStorage` no son contrato (ADR 0025).
