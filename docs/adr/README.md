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
