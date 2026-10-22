---
paths:
  - "player/**"
---

# Player (React + MUI + Vite)

**Proyecto independiente de WordPress** (ADR 0019, 0020): sus herramientas, su `package.json`, su lockfile y sus convenciones. No se le aplican WPCS ni `@wordpress/eslint-plugin`.

## Herramientas

- `npm --prefix player run check` = `tsc -b` + ESLint (typescript-eslint + react-hooks) + `prettier --check` (`player/.prettierrc`) + Vitest con cobertura (`test:coverage`, happy-dom, ADR 0006; umbrales por glob en `vitest.config.ts`).
- `npm --prefix player run build` → `player/dist/` (se commitea; nombres `radio-player-page-<versión>[-<chunk>].min.js|css`, que PHP lee de `manifest.json`).
- El minificado conserva los avisos de licencia de terceros (`comments: { legal: true }` en `vite.config.ts`); `npm run check:zip` comprueba que ningún script lleva menos que en la `v3.4.2`.
- `build.target` fijo en el valor por defecto de Vite 6 (`safari14`, `chrome87`…); el soporte efectivo es el de MUI 9 (Safari 17+). No se sube sin ADR (ADR 0027).
- TypeScript `strict`. Alias `src/*` (en `tsconfig.app.json`, `vite.config.ts` y `vitest.config.ts`).
- Prettier cubre todo `src/` salvo `src/config/visualizers.ts`, la zona congelada (ADR 0018), que es lo único que lista `player/.prettierignore` además de lo generado; no se añaden más (ADR 0021).

## Frontera con WordPress

- El player **solo** recibe datos por `window.RADPLAPAG_CONFIG`, `window.RADPLAPAG_PROGRAMS` y `window.RADPLAPAG_SCHEDULE`, que valida `src/core/config/` y lee y expone `hooks/use-config.tsx` (el único sitio que toca esas globales). No llama a APIs de WordPress (REST, `wp.*`, admin-ajax).
- **Ninguna petición a terceros** en runtime: ni fuentes de CDN, ni analítica. Lo de `player/index.html` es solo para el servidor de desarrollo y no entra en el zip.

## Reproducción

- Protocolo por la extensión del `pathname` de la URL, sin distinguir mayúsculas (`detectProtocol()`, ADR 0034): MP3/OGG directo; HLS nativo en iOS y con `hls.js` en el resto (nativo como alternativa); DASH con `dashjs`. `hls.js` y `dashjs` se cargan con `import()` dinámico.
- `crossOrigin = 'anonymous'` en toda fuente asignada a `audio.src` (MP3/OGG, HLS nativo, intro) en el primer intento; no en las rutas MSE (ADR 0004). Si `play()` se rechaza con `NotSupportedError`, un solo reintento sin él en el mismo elemento, salvo que ya pase por Web Audio (`graph.isConnected()`): entonces, error. Tras el reintento la fuente no es limpia (`isCorsClean()`) y no se visualiza (ADR 0033).
- Play tras una pausa, un error o un cambio de emisora recarga el directo en todos los protocolos (vuelve al borde en vivo); si ya suena, no hace nada (ADR 0032). `dashjs` sin fuente de hora de terceros (`clearDefaultUTCTimingSources()` tras `initialize()`).
- El audio de bienvenida suena una vez antes del directo, no se puede pausar y, si falla, pasa al directo sin error.
- **El horario no controla la reproducción:** solo informa (programa actual y siguiente, modales).
- Volumen desactivado en iOS (`use-is-ios.tsx`).
- Visualizador o animación estática: desde la 0007 lo decide el controlador del audio según la fuente en curso, y solo entonces se conecta Web Audio (ADR 0031). Nada de decidirlo por el *user agent*, salvo la excepción medida de WebKit (`isWebKitBrowser()`: nunca visualiza, ADR 0033).

## Núcleo, hooks y componentes (ADR 0029)

- **Núcleo:** `src/core/<zona>/` (`config`, `clock`, `schedule`, `audio`, `media-session`, `sleep`), TypeScript sin React, MUI ni i18next, con el test al lado (`*.test.ts`, TDD). Es interno, no es contrato. Puede importar `src/utils/` y `src/types/`; `src/utils/` se queda donde está, con sus firmas.
- **Frontera (A2):** ESLint, en el bloque de `src/core/**` de `eslint.config.js`, prohíbe importar `react`, `react-dom`, `@mui/*`, `@emotion/*`, `i18next`, `react-i18next`, `src/config/i18n`, `src/hooks/*` y `src/components/*`, y usar los globales `window`, `document`, `navigator` y `localStorage`. No se desactiva.
- **Inyección de dependencias:** lo que no es del núcleo entra como parámetro: el `HTMLAudioElement`, `navigator.mediaSession`, el *user agent*, el constructor de `AudioContext` (`webAudio`), el reloj (`now`, `setTimeout`/`setInterval` y sus `clear*`, con los globales por defecto), los cargadores de `hls.js`/`dashjs` (los `import()` por defecto viven en el núcleo, para que sigan siendo *chunks* aparte) y los textos ya traducidos. Los tests usan *fakes* (`src/test/fake-audio.ts`, `src/test/fake-web-audio.ts`, un reloj *fake*), no `vi.mock` de módulos.
- **Estado:** transición pura `(estado, evento) → estado` + un controlador que ejecuta los efectos y publica una instantánea inmutable con `subscribe()`/`getSnapshot()`. `getSnapshot()` devuelve la misma referencia hasta que algo cambia; los temporizadores arrancan con el primer suscriptor y paran con el último; `attach`/`detach` son idempotentes (`StrictMode`).
- **Hooks** (`src/hooks/`): adaptadores finos con `useSyncExternalStore` (o `useMemo` si no hay suscripción); conservan su firma (salvo `useAudioVisualizer()`, que desde la 0007 dibuja con `getAnalyser()`, ADR 0031). Excepción: `useAudioPlayer()` usa `useState` + `subscribe()` en un efecto, con el `setState` en el *callback*, para conservar el orden de los renders de K1 (ADR 0030, hasta la 0007). Sin `setState` dentro de efectos ni temporizadores propios. **Componentes** (`src/components/dashboard/`): solo pintan.
- Única excepción de `react-hooks` que se queda: `use-is-ios.tsx` («K13, spec 0007»). Sin `process.env` en el código publicado: `import.meta.env.DEV`.
- Los visualizadores son zona congelada (`visualizers.md`).

## i18n

- 14 locales en `src/locales/*.json` (i18next). Todos tienen las mismas claves que `en-US.json` (test de paridad en la 0002).
- Idioma: el del sitio, por el `lang` del `<html>`; reserva `en-US`. El navegador y `localStorage` no son contrato (ADR 0025).
