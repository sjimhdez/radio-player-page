# ADRs — índice

Decisiones de arquitectura con formato de Michael Nygard: contexto, decisión, consecuencias y alternativas descartadas. Si una decisión contradice `SPEC.md` o la spec activa, se actualizan los dos documentos en el mismo commit.

| # | Decisión | Estado | Origen |
|---|---|---|---|
| [0001](0001-characterize-clean-page-over-http.md) | Caracterizar la página limpia por HTTP | aceptado | 0001 · R2 |
| [0002](0002-node-26.md) | Node 26 para desarrollo y CI | aceptado | 0001 · R6 |
| [0003](0003-phpunit-9-6.md) | PHPUnit 9.6: excepción a «última versión de todo» | aceptado | 0001 · R7 |
| [0004](0004-crossorigin-on-direct-sources.md) | `crossOrigin` en las fuentes directas, no en las rutas MSE | aceptado | 0001 · R3 |
| [0005](0005-migration-sources-2-0-plus.md) | La migración admite los formatos de la 2.0 en adelante | aceptado | 0001 · R5 |
| [0006](0006-happy-dom.md) | happy-dom como entorno DOM de Vitest en el player | aceptado | 0001 · R4 |
| [0007](0007-trunk-integration-branch.md) | Rama de integración `trunk`; `main` = lo publicado | aceptado | 0001 · §6 |
| [0008](0008-clean-player-pages-without-theme.md) | Páginas del reproductor limpias, sin el tema | aceptado (retroactivo) | 0001 · fase 1 |
| [0009](0009-react-mui-vite-player.md) | El reproductor es una app React + MUI + Vite | aceptado (retroactivo) | 0001 · fase 1 |
| [0010](0010-cpt-storage-and-migration.md) | Emisoras y programas como CPT, con migración desde `radplapag_settings` | aceptado (retroactivo) | 0001 · fase 1 |
| [0011](0011-global-prefixes.md) | Prefijos `radplapag` / `RADPLAPAG` en todo lo global | aceptado (retroactivo) | 0001 · fase 1 |
| [0012](0012-minimum-requirements.md) | Requisitos mínimos: WordPress 6.6 y PHP 7.4 | aceptado (retroactivo) | 0001 · fase 1 |
| [0013](0013-crossorigin-for-visualizers.md) | `crossOrigin = 'anonymous'` en el audio para los visualizadores | aceptado (retroactivo) | 0001 · fase 1 |
| [0014](0014-committed-builds.md) | Los builds se commitean | aceptado (retroactivo) | 0001 · fase 1 |
| [0015](0015-manual-svn-publishing.md) | Publicación por SVN, siempre a mano por el usuario | aceptado (retroactivo) | 0001 · fase 1 |
| [0016](0016-spec-driven-development.md) | Desarrollo dirigido por specs, por fases y con ingeniería de contexto | aceptado | 0001 · fase 1 |
| [0017](0017-characterization-before-refactor.md) | Caracterización antes de tocar, TDD para lo nuevo y strangler fig | aceptado | 0001 · fase 1 |
| [0018](0018-frozen-visualizers.md) | Visualizadores congelados | aceptado | 0001 · fase 1 |
| [0019](0019-two-worlds-wordpress-react.md) | Dos mundos: parte WordPress (WordPress.org) y parte React independiente | aceptado | 0001 · §3 |
| [0020](0020-independent-js-projects.md) | `player/` y cada bloque son proyectos JS independientes | aceptado | 0001 · fase 1 |
| [0021](0021-legacy-code-standards-baseline.md) | Estándares sobre el código heredado: línea base por archivo | aceptado | 0001 · fase 1 |
| [0022](0022-latest-stable-versions.md) | La última versión estable de todo, con excepciones documentadas | aceptado | 0001 · fase 1 |
| [0023](0023-axe-baseline.md) | Línea base de axe: «ninguna violación nueva» | aceptado | 0002 · fase 2 |
| [0024](0024-phpstan-baseline.md) | PHPStan al nivel 8 con baseline: la baseline solo baja | aceptado | 0002 · fase 4 |
| [0025](0025-player-language-follows-site.md) | El idioma del reproductor es el del sitio (reserva `en-US`) | aceptado | 0002 · fase 5 (K55) |
| [0026](0026-grouped-dependency-upgrades.md) | Actualizaciones de dependencias agrupadas por proyecto; sin la spec 0004 | aceptado | 0003 · diseño |
| [0027](0027-player-browser-support-follows-mui.md) | Navegadores del player: `build.target` de Vite 6 y soporte efectivo de MUI 9 | aceptado | 0003 · fase 1 |
| [0028](0028-new-code-in-includes-src-with-own-autoloader.md) | Código nuevo en `includes/src/` (namespace `RadioPlayerPage\`) con autoloader propio, zip con altas declaradas y cobertura del núcleo | aceptado | 0005 · fase 1 |
| [0029](0029-player-core-without-react.md) | Núcleo del player en `src/core/` sin React (inyección de dependencias, transición pura + controlador + `useSyncExternalStore`) | aceptado | 0006 · fase 1 |
| [0030](0030-audio-hook-keeps-react-render-priorities.md) | `useAudioPlayer()` lee el controlador con `useState` y una suscripción (enmienda D2 del 0029; revisado en la 0007: se queda por el reintento de C1) | aceptado | 0006 · fase 2 (regresión de la 2.8) |
| [0031](0031-visualization-decided-by-the-core.md) | La visualización la decide el núcleo según la fuente (no el *user agent*); la zona congelada se reduce al dibujo (enmienda 0018) | aceptado | 0007 · diseño |
| [0032](0032-play-after-pause-reloads-the-live-stream.md) | Play tras una pausa recarga el directo en todos los protocolos (C7, K12); `dashjs` sin fuente de hora de terceros, con el reloj del cliente (K67) | aceptado | 0007 · fase 1 |
| [0033](0033-retry-direct-sources-without-crossorigin.md) | Un reintento sin `crossOrigin` en las fuentes directas (C1); regla de `canVisualize`, WebKit nunca visualiza y la bienvenida tampoco (enmienda 0004, 0013 y 0031) | aceptado | 0007 · fase 1 |
| [0034](0034-audio-states-and-protocol-detection.md) | Estados del audio y protocolo: sufijo del `pathname` (C2), una pausa cancela la carga (D3), `playing` del evento del elemento (D4) y la bienvenida no bloquea, con el `error` a mitad hacia el directo (D5) | aceptado | 0007 · fase 2 |
