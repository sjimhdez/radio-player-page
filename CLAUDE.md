# Radio Player Page

Plugin de WordPress (publicado en wordpress.org) que sirve una página limpia por emisora, sin el tema, con un reproductor React para streams MP3/OGG, HLS y DASH. También gestiona emisoras y programas como CPT, con un horario semanal y tres bloques.

- **Producto:** `SPEC.md` (contrato e invariantes). **Trabajo en curso:** la spec activa en `docs/specs/` (índice y hoja de ruta en `docs/specs/README.md`). **Decisiones:** `docs/adr/`.
- **Estado:** `docs/status.md` (se inyecta al iniciar la sesión) y el plan de la fase en `docs/specs/NNNN-slug/phase-N.md`.
- **Bugs y rarezas conocidos:** `docs/known-issues.md`. **Desviaciones de las specs cerradas:** `docs/deviations.md`.
- Código, comentarios, commits y textos traducibles en **inglés**. Docs, specs y ADRs en español.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run check` | PHPCS + PHPStan + PHPUnit unit + ESLint (raíz) + Vitest (raíz) + tests de hooks + `check` del player + `check` de cada bloque + lista del zip. Sin Docker. **Antes de cada commit.** |
| `npm run lint:phpstan` | PHPStan nivel 8 con `phpstan-baseline.neon`; la baseline solo baja (ADR 0024) |
| `npm test` / `npm run test:php:unit` | Vitest de la raíz (`tests/js`) / PHPUnit sin WordPress |
| `npm run test:php:integration` | PHPUnit sobre wp-env (entorno de tests, tablas `wptests_`); corre también la suite unit, salvo el grupo `no-wordpress`, para la cobertura del núcleo (ADR 0028) |
| `npm run test:e2e` | Playwright (Chromium + WebKit) sobre el entorno de tests; antes siembra `scripts/fixtures/seed.php` y `tests/e2e/fixtures/seed-e2e.php` |
| `npm run test:hooks` | Tests de `.claude/hooks/` |
| `npm run check:zip` | Test de la comparación; el zip lista los archivos de `v3.4.2` más las altas de `tests/zip/expected-additions.txt` y no lleva rutas de desarrollo |
| `npm --prefix player run check` / `build` | tsc + ESLint + Prettier + Vitest del player / build a `player/dist/` |
| `npm --prefix blocks/<bloque> run check` / `build` | Lint + build del bloque a `blocks/<bloque>/build/` |

Entornos (Docker, wp-env): desarrollo con `npm run env:start` → <http://localhost:8886>. Tests (integración y e2e) con `npm run env:start:min` (WP 6.6 + PHP 7.4) o `env:start:latest` (última WP + PHP 8.4) → <http://localhost:8890>. Usuario `admin` / `password`. Node 26 (`.nvmrc`), Composer.

## Mapa

- `radio-player-page.php`: arranque, página limpia (`radplapag_output_clean_page()`), globales `window.RADPLAPAG_*`.
- `includes/`: CPT de emisora y programa, datos (`data/`), migración desde `radplapag_settings` (`migration/`, `radplapag-upgrade.php`), bloques.
- `admin/`: meta boxes, validación, `admin-strings.php`, `js/` y `css/`.
- `blocks/<bloque>/`: `block.json`, `render.php`, `src/` → `build/`. Cada bloque es un proyecto independiente.
- `player/`: proyecto React + MUI + Vite independiente; `src/` → `dist/` (se commitea).
- `uninstall.php`, `readme.txt` (wordpress.org), `scripts/build-release-zip.sh` (lista de inclusión del zip).
- `tests/`: `php/unit`, `php/integration`, `js`, `e2e`, `hooks`, `zip`.
- `spike/`: el spike de la spec 0001, desechable. No se reutiliza ni se publica.
- `.claude/rules/` se cargan por ruta; `.claude/skills/` son los procedimientos; `.claude/agents/` son los revisores.

## Invariantes

1. El código publicado funciona en **PHP 7.4 y WP 6.6** (PHPCompatibilityWP y la matriz de la CI; ADR 0012).
2. Las meta keys, opciones, transients, globales `window.RADPLAPAG_*`, funciones `radplapag_*`, callbacks enganchados y el markup y los atributos de los bloques no cambian sin un ADR (`SPEC.md`).
3. La migración desde `radplapag_settings` es unidireccional e idempotente (ADR 0005, 0010).
4. El horario es informativo: **nunca** controla la reproducción.
5. Toda fuente asignada directamente a `audio.src` lleva `crossOrigin = 'anonymous'` en el primer intento; si falla, un solo reintento sin él (ADR 0033). Las rutas MSE (`hls.js`, `dashjs`) no lo llevan (ADR 0004).
6. Los visualizadores (dibujo y catálogo) no se editan sin un ADR (zona congelada, ADR 0018 y 0031).
7. El núcleo del reproductor (`player/src/core/`, spec 0006) no importa React ni MUI.
8. `player/dist/` y `blocks/*/build/` se regeneran y nunca se editan a mano (un hook lo bloquea; ADR 0014).
9. El zip solo incluye lo que lista `scripts/build-release-zip.sh` (`npm run check:zip`).
10. La parte WordPress cumple las guidelines de WordPress.org. El player es independiente y solo recibe datos por `window.RADPLAPAG_*` (ADR 0019).
11. `player/` y cada `blocks/*` tienen su propio `package.json`, lockfile, configuración y build; nunca se unifican (ADR 0020).

## Flujo de trabajo

- Todo trabajo empieza con una spec (`write-spec`, en una sesión de diseño). Cada fase empieza con `start-phase` y termina con `close-phase`.
- Plan mode para cualquier cambio de código de más de un archivo.
- Caracterización antes de tocar código existente (`characterize`). Test primero para la lógica nueva o extraída. Bug → `fix-bug` (test de regresión en rojo primero).
- Un commit por tarea del plan: `<type>(NNNN): <description> (<fase>.<tarea>)`. Los commits de proceso (`docs(NNNN): add spec`, `docs(NNNN): add phase N plan`, `chore(NNNN): close phase N`) no llevan tarea. Push solo de ramas `spec/*`. El merge lo hace el usuario, o Claude con `gh pr merge` solo si el usuario lo pide (Claude Code pide confirmación).
- Si algo contradice `SPEC.md` o un ADR: para y usa `write-adr`.
- Los hooks formatean cada archivo editado y, al terminar el turno, regeneran builds y pasan los tests rápidos de lo tocado. Si bloquean, se arregla la causa.

## Qué no hacer

- Añadir dependencias de runtime sin un ADR.
- Subir los requisitos mínimos (WP 6.6, PHP 7.4).
- Corregir un bug sin su test de regresión, o fuera de una spec de correcciones.
- Editar un test de caracterización para que pase.
- Desactivar reglas de PHPCS, ESLint o Prettier por archivo (ADR 0021): se arregla el código, o la excepción va en su línea con su motivo.
- Hacer peticiones reales a internet en los tests.
