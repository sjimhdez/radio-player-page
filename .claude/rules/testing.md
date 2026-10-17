---
paths:
  - "tests/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.test.js"
  - "**/*Test.php"
  - "phpunit*.xml.dist"
  - "**/vitest.config.*"
  - "playwright.config.ts"
---

# Tests

## Pirámide

| Capa | Dónde | Herramienta | Comando |
|---|---|---|---|
| PHP unit (sin WP) | `tests/php/unit/` | PHPUnit 9.6 + polyfills 4 (ADR 0003) | `npm run test:php:unit` |
| PHP integración | `tests/php/integration/` | `WP_UnitTestCase` sobre wp-env, tablas `wptests_` | `npm run test:php:integration` (multisite: `:ms`; cobertura: `:coverage` + `node scripts/check-php-coverage.mjs coverage/php-xml`) |
| JS del player | `player/src/**/*.test.ts(x)` | Vitest + Testing Library + happy-dom (ADR 0006) | `npm --prefix player test` |
| JS de WordPress | `tests/js/admin/` (o en el bloque, si se extrae lógica de un bloque) | Vitest (proyecto `admin` con happy-dom; `node` para el resto) | `npm test` |
| E2E | `tests/e2e/` | Playwright, Chromium + WebKit, entorno de tests | `npm run test:e2e` |
| Hooks | `tests/hooks/*.test.sh` | bash | `npm run test:hooks` |
| Zip | `tests/zip/` | bash | `npm run check:zip` |

## Reglas

- **Caracterización antes de tocar** (skill `characterize`): ningún archivo existente se refactoriza sin tests que fijen su comportamiento, escritos **contra el código sin modificarlo**. Una costura mínima se justifica en el plan de la fase.
- **Un test de caracterización no se edita para que pase.** Si un refactor lo rompe, se arregla el refactor. Solo cambia con un ADR o con la aprobación del usuario apuntada en el plan.
- **Lo raro se fija tal cual:** `test_currently_*` / `it('currently …')` y una fila en `docs/known-issues.md`. Se corrige solo en una spec de correcciones: el test `currently` pasa a test de regresión con el comportamiento correcto, se ve en rojo y después se arregla.
- **TDD** para la lógica nueva o extraída: el test primero y en rojo.
- **Ningún test sale a internet.** PHP: `pre_http_request` si hace falta. E2E: el *fixture* de `tests/e2e/fixtures.ts` aborta cualquier petición fuera del origen de test y falla. Los medios se sirven en local.
- **Tiempo determinista:** Vitest con `vi.useFakeTimers()` y `TZ=UTC` en el proceso (los scripts ya lo fijan); los casos de zona horaria se repiten con varias `TZ`. E2E con `page.clock`. Casos obligatorios del horario: cruce de medianoche, cambio de día, horario de verano y `timezoneOffset` negativo y fraccionario (+5:30).
- **La integración nunca toca el sitio de desarrollo**: corre en `.wp-env.tests.json` con el prefijo `wptests_`. E2E usa el sitio `wp_` de ese mismo entorno y lo siembra `scripts/fixtures/seed.php`.
- **Fixtures** en `tests/fixtures/` (spec 0002): `legacy-settings/` (formatos 2.0.x–3.2.x, ADR 0005), `schedule-vectors.json` (los pasan PHP, el admin JS y TS), `admin/station-meta-box.html` (lo escribe `AdminScreensTest` y lo monta Vitest) y `audio/`. Los snapshots de integración viven en `tests/php/integration/snapshots/` y solo se reescriben con `RADPLAPAG_UPDATE_SNAPSHOTS=1`.
- **Reloj del servidor en integración:** `Support/Clock` fija `gmt_offset` y rota la parrilla; el código publicado no tiene costura de tiempo (spec 0002 §4.3).
- **Nombres:** PHP `*Test.php` con métodos `test_*` (en `tests/` no se aplica la regla de nombres de archivo de WPCS); TS/JS `*.test.ts(x)` / `*.test.js`. Un comportamiento por test.
- **Mutación de comprobación:** un test nuevo se ve fallar al menos una vez (TDD en rojo o una mutación temporal que se revierte).

## Mínimos de cobertura (los hace cumplir la CI desde la spec 0002)

| Zona | Al cerrar la 0002 | Al cerrar la iniciativa |
|---|---|---|
| TS puro: `player/src/utils/**` y el núcleo de la 0006 | ≥ 90 % líneas | ≥ 90 % líneas · ≥ 85 % ramas |
| Hooks del reproductor (sin visualizadores) | ≥ 70 % | ≥ 85 % |
| Componentes `dashboard/**` | sin mínimo (e2e) | sin mínimo |
| Visualizadores | excluidos | excluidos |
| PHP crítico: horario, campos, migración, actualización, programa en antena, config | ≥ 80 % | ≥ 90 % |
| PHP resto (`includes/`, `admin/*.php`, `blocks/*/render.php`, `uninstall.php`) | ≥ 60 % | ≥ 80 % |
| JS de admin (lógica extraída en la 0005) | — | ≥ 85 % |

La fuente de esta tabla es la hoja de ruta (`docs/specs/README.md`); si cambia allí, cambia aquí en el mismo commit.
