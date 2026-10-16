# Spec 0001 — Bootstrap: spike, herramientas e ingeniería de contexto

> Estado: **cerrada** (fases 0 y 1, 2026-10-16) · Fecha: 2026-10-16 · Rama: `spec/0001-bootstrap` · Versión de partida: 3.4.2 (tag `v3.4.2`)
>
> Primera spec de la iniciativa «base de calidad». Contexto, orden y decisiones comunes: [`docs/specs/README.md`](../README.md). Docs en español; código, comentarios y commits en inglés.

---

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación. Todo lo necesario está aquí, en la hoja de ruta y en el código.

Para la sesión que la ejecuta:

1. Lee la hoja de ruta (`docs/specs/README.md`), esta spec y la sección *Documentation for Developers* de `README.md`.
2. Si existe `docs/status.md`, manda. Si no, se empieza por la **fase 0**.
3. **Antes de la fase 0:**
   - crea la rama `spec/0001-bootstrap` desde `main` (§6; `trunk` se creó después, desde `main`, ADR 0007);
   - haz un primer commit con los documentos de diseño (`docs/specs/` y `docs/inherited-bugs.md`), con el mensaje `docs(0001): add specs roadmap and bootstrap spec`;
   - pide al usuario que haga el push y que configure la protección de `main` y de `trunk` en GitHub: PR obligatorio, CI en verde, sin force push. Esa configuración la hace el usuario; los permisos de Claude todavía no existen hasta la fase 1;
   - abre el PR en borrador.
4. Hasta que existan las skills `start-phase` y `close-phase` (se crean en la fase 1), cada fase empieza igual: plan mode → plan en `docs/specs/0001-bootstrap/phase-N.md` con el formato de §7.8 → aprobación del usuario → ejecución tarea a tarea, con un commit por tarea.
5. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, se escribe un ADR y se actualiza la spec en el mismo commit.

La metodología viene de `../podcast-player-page` (`SPEC.md` §18–§21, `CLAUDE.md`, `.claude/`). Se puede consultar como **referencia de método**. Su arquitectura y sus decisiones de producto **no** se aplican aquí.

## 1. Alcance

Esta spec deja el repositorio listo para trabajar con specs y con tests. **No cambia ningún comportamiento del plugin.**

- **Fase 0 — Spike:** demostrar que las herramientas de test funcionan con los mínimos (WP 6.6 / PHP 7.4) y con la reproducción de streams.
- **Fase 1 — Bootstrap:**
  - las herramientas de test y de calidad, con las suites casi vacías;
  - la ingeniería de contexto (§7);
  - `SPEC.md` con el contrato público (§4);
  - los ADRs iniciales;
  - `docs/known-issues.md`;
  - la CI.

**Este documento es más largo que una spec normal** porque diseña el conocimiento permanente del proyecto: metodología (§2), dos mundos (§3), contrato (§4), estrategia de tests (§5) y ramas (§6). **Al cerrar la spec, ese conocimiento vive en su sitio definitivo**: `SPEC.md`, `CLAUDE.md`, `.claude/rules/`, las skills y los ADRs. Las specs siguientes lo enlazan allí y no repiten nada de esta.

Fuera de alcance: escribir tests de caracterización (spec 0002), actualizar dependencias de runtime (0003/0004), refactorizar o corregir bugs.

## 2. Metodología (→ `CLAUDE.md`, skills y ADR)

### 2.1 Prácticas

| Práctica | Cómo se aplica en este repo |
|---|---|
| **Spec-driven development** | `SPEC.md` (raíz) describe **cómo es el producto hoy**: su contrato y sus invariantes. Cada cambio se describe en una **spec de cambio** (`docs/specs/NNNN-slug/spec.md`) con objetivos, fases y criterios de aceptación. Al cerrarla, `SPEC.md` se actualiza con lo que cambió. |
| **ADRs** (Michael Nygard) | Están en `docs/adr/`. Cada decisión de arquitectura lleva su contexto y las alternativas descartadas. Si contradice `SPEC.md` o la spec activa, se actualizan los dos documentos en el mismo commit. |
| **Desarrollo iterativo e incremental por fases** | Cada spec tiene fases con criterios de aceptación. Al cerrar cada fase, `trunk` queda en verde. |
| **Spike** (XP) | Es la fase 0 de una spec con riesgo técnico: un prototipo desechable para validar los riesgos antes de construir. |
| **Tests de caracterización** (Feathers, *Working Effectively with Legacy Code*) | **Antes de tocar código existente**, se fija su comportamiento actual con tests, aunque ese comportamiento sea raro. Esta es la red de seguridad del refactor. |
| **TDD** | Para **la lógica nueva y la lógica extraída**: el test se escribe primero y se ve en rojo. Cada bug corregido lleva su test de regresión, que también se ve fallar primero. |
| **ATDD** | Los criterios de aceptación de cada fase se convierten en tests ejecutables. En un refactor, el criterio base es que **el comportamiento caracterizado no cambia**. |
| **Strangler fig** | El código nuevo crece junto al antiguo, que pasa a delegar en él. Nunca hay una reescritura completa de golpe. |
| **Commits atómicos / small batches** | Tareas de ≤ 1 h, una por commit, cada una con su comando de verificación. |
| **Ingeniería de contexto** | Cada tipo de conocimiento va en su sitio: `CLAUDE.md`, rules por ruta, skills, hooks, subagentes y `docs/status.md` (§7). |

### 2.2 Ciclo de vida de una spec

```
write-spec (sesión de diseño)   →  docs/specs/NNNN-slug/spec.md (propuesta) + entrada en el índice
  └─ sesión nueva: start-phase  →  rama spec/NNNN-slug + docs/specs/NNNN-slug/phase-N.md (aprobado en plan mode)
       └─ tareas (caracterización o TDD, un commit por tarea, hook Stop en verde)
       └─ close-phase           →  revisores, ADRs, SPEC.md, rules, status.md, known-issues.md
  └─ última close-phase         →  spec «cerrada», merge de la rama en `trunk` (§6), índice actualizado
       └─ sesión de diseño: write-spec de la siguiente spec del índice, con lo aprendido
```

- **Specs pequeñas** (< 250 líneas) y **justo a tiempo**: solo se escribe completa la siguiente spec. Las demás son entradas de la hoja de ruta.
- **Una tarea pequeña también lleva spec:** una spec ligera de una sola fase. `write-spec` decide el tamaño.
- **Una sesión nueva por fase** (o cuando el contexto se llena). La continuidad la dan `docs/status.md` y el plan de la fase, no la memoria de la conversación.
- **Una sola spec activa a la vez**, salvo que se trabaje en paralelo en worktrees (por ejemplo, 0003 y 0004).

### 2.3 Estructura de documentación

```
SPEC.md                         # Producto actual: contrato e invariantes (vivo)
docs/
├── status.md                   # Estado vivo (< 60 líneas), inyectado en SessionStart
├── known-issues.md             # Bugs y rarezas: origen, test que los fija, decisión del usuario
├── inherited-bugs.md           # Catálogo C1–C16 heredado (semilla de known-issues.md; se borra al sembrar)
├── specs/
│   ├── README.md               # Índice y hoja de ruta
│   ├── _template.md            # Plantilla de write-spec
│   └── NNNN-slug/
│       ├── spec.md
│       └── phase-N.md          # Planes de fase
├── adr/
│   ├── README.md               # Índice
│   └── NNNN-titulo.md
└── spikes/
    └── 0001-phase-0.md         # Informe del spike de esta spec
```

## 3. Dos mundos: WordPress.org y React (→ ADR y rules)

El plugin se distribuye por el directorio oficial de WordPress.org. Sus reglas son de obligado cumplimiento en la **parte WordPress**. La **parte React** es un proyecto independiente que se publica compilado dentro del zip.

| | Parte WordPress | Parte React (`player/`) |
|---|---|---|
| **Qué incluye** | `radio-player-page.php`, `includes/`, `admin/` (PHP, JS y CSS), `blocks/*` (PHP, `block.json` y `src/`), `uninstall.php`, `readme.txt`, `scripts/build-release-zip.sh` | `player/src/**`, su build (`player/dist/`) y su configuración |
| **Normas** | [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) (las 18). [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/): PHP (WPCS), JS (`@wordpress/eslint-plugin` en el admin y los bloques), CSS. [Plugin Handbook](https://developer.wordpress.org/plugins/): seguridad, i18n, desinstalación. [Block Editor Handbook](https://developer.wordpress.org/block-editor/) para los bloques. | Sus propias convenciones: la configuración de ESLint de `player/` (typescript-eslint + react-hooks), `player/.prettierrc`, TS en modo `strict`, MUI e i18next con sus locales JSON. **No** se le aplica WPCS. |
| **Verificación** | Plugin Check con todas las categorías (incluida `plugin_repo`). PHPCS (WPCS + PHPCompatibilityWP `7.4-`). Validación de `readme.txt`. Subagente `wporg-reviewer`. | `tsc`, el ESLint y el Prettier de `player/`, Vitest |
| **Puntos clave** | Prefijos en todo lo global. Saneado en la entrada y escape en la salida. Nonces y capacidades. APIs de WP antes que soluciones propias (`wp_enqueue_*`, HTTP API). Textos traducibles con el text domain `radio-player-page` y comentarios para traductores. Avisos del admin que se pueden descartar y sin «nags». Ninguna llamada externa ni seguimiento sin consentimiento. No incluir librerías que ya trae core. Desinstalación limpia. `readme.txt` al día (`Tested up to`, `Stable tag`, descripción corta de ≤ 150 caracteres). | Se mantiene la frontera con WordPress: el player **solo** recibe datos por las globales `window.RADPLAPAG_*` que imprime PHP (§4.3) y no llama a APIs de WP. |

**Lo que se aplica a los dos**, porque todo acaba dentro del zip:

- **Licencias GPL-compatibles** de todas las dependencias empaquetadas. La CI lo comprueba con un listado de licencias en `player/` y en cada bloque.
- **Código legible** (guideline 4): el código fuente y las herramientas de build tienen que ser públicos. El FAQ de `readme.txt` ya enlaza el repositorio de GitHub. Esa entrada se mantiene y se comprueba en la release.
- **Ninguna petición a terceros** en tiempo de ejecución: ni fuentes de CDN, ni analítica, ni recursos remotos (los de `player/index.html` son solo para el desarrollo y no entran en el zip). Las únicas peticiones salientes son al stream y a los medios que configura el administrador.
- **Accesibilidad** (WCAG 2.2 AA como referencia), con axe en e2e (la spec 0002).

Los incumplimientos que aparezcan al revisar el código existente se registran en `docs/known-issues.md` (§5.2) y se triagean como cualquier otro bug.

---

## 4. Contrato público actual (→ `SPEC.md`)

Inventario inicial, sacado del código en la sesión de diseño. **En la fase 1 se verifica, se completa y se pasa a `SPEC.md`**. En la spec 0002, cada punto queda cubierto por al menos un test. Cambiar cualquier punto de esta lista exige un ADR.

La fuente para completarlo es **el código de la 3.4.2** y su `README.md`.

### 4.1 Datos

- **CPT:** `radplapag_station` y `radplapag_program`. El editor clásico se fuerza en las emisoras. La capacidad requerida es `manage_options`, mediante `map_meta_cap` y `user_has_cap`.
- **Meta de emisora:**
  - `radplapag_station_stream_url`
  - `radplapag_station_player_page`
  - `radplapag_station_schedule`
  - `radplapag_station_visualizer`
  - `radplapag_station_theme_color`
  - `radplapag_station_logo_id`
  - `radplapag_station_background_id`
  - `radplapag_station_intro_audio_id`
- **Meta de programa:**
  - `radplapag_program_description`
  - `radplapag_program_extended_description`
  - `radplapag_program_logo_id`
- **Opciones:**
  - `radplapag_settings`: legado de antes de la 3.3.0, origen de la migración.
  - `radplapag_db_version`: actualmente `'330'`.
  - `radplapag_migration_skipped_cpt_conflict`
- **Transients:**
  - los de los avisos de migración: `radplapag_migration_success_notice` y `radplapag_migration_error_notice` (corregido en la fase 1: son transients, no opciones; el inventario verificado está en `SPEC.md` §3.1)
  - `radplapag_station_schedule_errors_*`
  - `radplapag_station_field_errors_*`
  - el de bloqueo de migración, `radplapag_migrating`
- **Formato del horario:** `{ monday: [{ program_id, start: "HH:MM", end: "HH:MM", is_rerun? }], … }`. Incluye franjas que cruzan la medianoche.

### 4.2 Migración y actualización

- Migración unidireccional de `radplapag_settings` a los CPT (`includes/migration/`), controlada por `includes/radplapag-upgrade.php`.
- Debe seguir siendo **idempotente** y funcionar con los formatos de **2.0.x a 3.2.x**. Los de 1.x quedan fuera del contrato ([ADR 0005](../../adr/0005-migration-sources-2-0-plus.md)).

### 4.3 Página del reproductor

- `template_redirect` → `radplapag_get_station_for_current_page()` → `radplapag_output_clean_page()`. Esta última imprime un HTML mínimo y termina con `exit`.
- Lee `player/dist/manifest.json`. Si falla, `wp_die` con mensajes concretos.
- **Globales JS:**
  - `window.RADPLAPAG_CONFIG`: `streamUrl`, `siteTitle`, `themeColor`, `visualizer`, `backgroundImage`, `logoImage`, `introAudioUrl`, `timezoneOffset`.
  - `window.RADPLAPAG_PROGRAMS`
  - `window.RADPLAPAG_SCHEDULE`
- **Nombres de los assets:** `radio-player-page-<versión>[-<chunk>].min.js` y `.css`.

### 4.4 Funciones PHP públicas

- Documentadas en `README.md`:
  - `radplapag_get_config()`
  - `radplapag_get_stations()`
  - `radplapag_get_station_for_current_page()`
  - `radplapag_get_now_playing_for_station( $station_index )`
- **Regla:** todas las funciones globales `radplapag_*` y los callbacks enganchados a hooks se consideran contrato, porque un tercero puede llamarlas o desengancharlas con `remove_action`. En el refactor se mantienen como envoltorios finos que delegan en el código nuevo.

### 4.5 Bloques

- `radplapag/schedule`, `radplapag/programs-list` y `radplapag/now-playing` (apiVersion 3, renderizado en servidor).
- Se preservan sus **atributos y su markup**: clases, `data-program-id`, estilos en línea. Los temas pueden depender de ellos.
- Datos localizados para el editor: `radplapagScheduleBlock`, `radplapagProgramsListBlock` y `radplapagNowPlayingBlock`.

### 4.6 Admin

- Meta boxes de emisora (detalles y horario) y de programa.
- Validación con avisos.
- Detección de páginas asignadas a otra emisora.
- Cadenas del JS en `admin/admin-strings.php`.

### 4.7 Desinstalación

`uninstall.php` borra los posts de ambos CPT, compatible con multisite. Desactivar el plugin no borra nada.

### 4.8 Reproductor (comportamiento)

- **Protocolos:**
  - MP3/OGG progresivo.
  - HLS: nativo en iOS; con `hls.js` en el resto; nativo como alternativa si `hls.js` no está soportado.
  - DASH con `dashjs` y autoplay.
  - Los protocolos se detectan por la extensión de la URL.
- **Audio de bienvenida (intro):** suena una vez antes del directo, no se puede pausar, y si falla se pasa al directo sin mostrar error.
- **`crossOrigin = 'anonymous'` en toda fuente asignada directamente a `audio.src`** (MP3/OGG, HLS nativo, audio de bienvenida). Las rutas MSE (`hls.js`, `dashjs`) cargan por XHR/fetch con CORS y dejan el atributo en `null` (decisión 5, [ADR 0004](../../adr/0004-crossorigin-on-direct-sources.md)).
- **Volumen** desactivado en iOS.
- **Resto de funciones:**
  - Media Session
  - temporizador y modo de sueño
  - reloj de zona horaria
  - programa actual y siguiente (incluidas las reposiciones)
  - modales del horario y de todos los programas
  - tiempo de transmisión
- **El horario es solo informativo:** **nunca controla la reproducción**.
- **i18n:**
  - 14 locales en `player/src/locales/`.
  - Detección por este orden: `lang` del HTML → `localStorage` → navegador.

### 4.9 Zona de visualizadores (fuera del refactor)

- `player/src/components/visualizers/**`
- `player/src/config/visualizers.ts`
- `player/src/types/visualizers.tsx`
- `player/src/hooks/use-audio-visualizer.tsx`
- `player/src/hooks/use-can-visualize.tsx`

Las actualizaciones de dependencias (specs 0003 y 0004) no tocan esta zona. Si una actualización obliga a tocar esta zona, el cambio debe ser mínimo y llevar un ADR.

### 4.10 Release

- `scripts/build-release-zip.sh` funciona con una lista de inclusión.
- La publicación se hace por SVN en wordpress.org, desde un checkout aparte (`radio-player-page-svn`), y **siempre a mano por el usuario**.

---

## 5. Estrategia de tests (→ `.claude/rules/testing.md`)

En esta spec se montan las herramientas y una suite de humo por capa. Los tests de verdad empiezan en la 0002. Los mínimos de cobertura están en la hoja de ruta.

### 5.1 Pirámide

| Capa | Herramienta | Qué cubre |
|---|---|---|
| **PHP unit** | PHPUnit 9.6 + Yoast polyfills 4 ([ADR 0003](../../adr/0003-phpunit-9-6.md)), sin WP (`tests/php/unit/`) | Lógica pura: validación y saneado del horario, cálculo del programa en antena, construcción de la config y mapeo de la migración. Crece sobre todo en la spec 0005. |
| **PHP integration** | `WP_UnitTestCase` sobre wp-env (`tests/php/integration/`) | CPT, meta, capacidades, guardado con nonces, migración y actualización, ruta de lectura, render de los bloques (snapshot normalizado), página limpia y desinstalación (también multisite). |
| **JS unit (React)** | Vitest + Testing Library + happy-dom ([ADR 0006](../../adr/0006-happy-dom.md)), **dentro de `player/`**, con su propio `vitest.config` y en su `package.json` | `utils/`, hooks (no visualizadores) con un `FakeAudioElement` y `hls.js`/`dashjs` simulados, validación de la config, i18n. Más adelante, el núcleo extraído en la spec 0006. |
| **JS unit (WordPress)** | Vitest en la raíz (`tests/js/admin/`) | Lógica pura extraída de `admin/js/` en la spec 0005. Si se extrae lógica de un bloque, sus tests van en ese bloque. |
| **E2E** | Playwright sobre wp-env, Chromium y WebKit (`tests/e2e/`) | Flujos completos (la spec 0002). |
| **Hooks** | bash (`tests/hooks/`) | Scripts de `.claude/hooks/`. |

### 5.2 Reglas

- **Caracterización antes de tocar.** Ningún archivo de código existente se refactoriza sin tests que fijen su comportamiento. Esos tests se escriben contra el código **sin modificarlo**. Si hace falta una costura mínima (*seam*) para poder testear, se justifica en el plan de la fase.
- **Un test de caracterización no se edita para que pase.** Si un refactor lo rompe, se arregla el refactor. Solo se puede cambiar con un ADR o con la aprobación explícita del usuario, apuntada en el plan.
- **Los comportamientos raros se fijan tal cual.** El test se nombra `test_currently_*` / `it('currently …')` y se apunta en `docs/known-issues.md`. Corregirlo corresponde a una spec de correcciones, aprobada por el usuario, que se hace con TDD:
  1. el test `currently` se sustituye por un test de regresión con el comportamiento correcto;
  2. ese test se ve en rojo;
  3. se hace el arreglo.
- **`known-issues.md`** tiene una fila por hallazgo con estas columnas:
  - ID: `C1`–`C16` del catálogo heredado (hoy en [`docs/known-issues.md`](../../known-issues.md)), o `K1…` para los nuevos;
  - origen: catálogo, caracterización, auditoría, axe o guidelines;
  - descripción;
  - archivo y test que lo fija;
  - gravedad;
  - decisión del usuario: corregir en una spec de correcciones, abrir otra spec o no arreglar.
- **El catálogo C1–C16 heredado entra de inicio en [`known-issues.md`](../../known-issues.md)** (sembrado en la fase 1; `inherited-bugs.md` se borró). En la spec 0002, cada uno se **confirma contra la 3.4.2** con su test `currently`: si no se reproduce, se apunta como «no se reproduce». La propuesta heredada sirve de punto de partida, pero se vuelve a confirmar aquí. Hay tres excepciones:
  - C14 no aplica: es un cambio de la arquitectura de la 4.0.
  - C8 se replica.
  - C1 (CORS) y C9 (zona horaria) siguen pendientes.
- **TDD estricto** para el código nuevo o extraído.
- **Ningún test sale a internet.** PHP usa `pre_http_request` si hace falta. En e2e, el navegador falla ante cualquier petición externa que no sea a los orígenes de test.
- **Tiempo y zona horaria deterministas:**
  - JS: `vi.useFakeTimers` y el proceso con `TZ` fijo; los casos de zonas horarias se ejecutan en varias `TZ`.
  - E2E: el reloj de Playwright (`page.clock`).
  - Casos obligatorios:
    - cruce de medianoche
    - cambio de día
    - horario de verano
    - `timezoneOffset` con valores negativos y fraccionarios (+5:30)
- Nombres: PHP `*Test.php` con métodos `test_*`; TS `*.test.ts(x)`. Un comportamiento por test.

## 6. Flujo de ramas ([ADR 0007](../../adr/0007-trunk-integration-branch.md))

Dos ramas largas: **`trunk`** (integración) y **`main`** (lo publicado). Ramas cortas, una por spec, que entran en `trunk` por PR con merge commit (sin squash).

```
main  ──●──────────────────────────────────────────●────── (tag vX.Y.Z en cada merge)
         \                                         /
trunk     ●────────●───────────────●──────────────●────────
           \      / \             / \            /
spec/0001   ●─●─●●   spec/0002 ●─●─●  spec/NNNN ●─●   (PR en borrador → CI → revisión → merge --no-ff)
```

- **`main` = la última versión publicada.**
  - Coincide siempre con el tag más reciente. Solo recibe PRs `trunk` → `main` (release) y `hotfix/*` → `main`.
  - Es la rama por defecto en GitHub: quien visita el repositorio ve lo publicado.
- **`trunk` = integración.**
  - Sale de `main` (3.4.2). Siempre está en verde y puede ir por delante de lo publicado.
  - Recibe todos los PRs de las specs.
- **Las dos ramas están protegidas** en GitHub con el mismo ruleset: PR obligatorio sin aprobaciones, CI en verde con la rama al día, sin force push, sin borrado y solo merge commit.
- **`spec/NNNN-slug`** sale de `trunk` en la primera fase de la spec y dura lo que dura la spec. Dentro, un commit por tarea: `<type>(NNNN): <description> (<fase>.<tarea>)`.
- **PR en borrador contra `trunk`** (`gh pr create --draft --base trunk`; sin `--base` apuntaría a `main`, que es la rama por defecto) desde el primer push, para que la CI corra en cada push.
  - Al cerrar la spec, el PR pasa a «listo».
  - **El merge lo decide siempre el usuario** (lo hace él, o Claude si se lo pide; nota en el ADR 0007), con merge commit (`--no-ff`) y el título `Spec NNNN: <título>`. Antes puede lanzar `/code-review` sobre el PR.
- **Sin squash.**
  - `git log --first-parent trunk` muestra una línea por spec, y `git log --first-parent main` una por versión.
  - `git log` conserva cada tarea.
  - `git bisect`, el blame y `.git-blame-ignore-revs` siguen funcionando.
  - `git revert -m 1 <merge>` deshace una spec entera.
- **Release:**
  1. la spec de release sube la versión en su rama y se fusiona en `trunk`;
  2. el usuario fusiona un PR `trunk` → `main` titulado `Release vX.Y.Z`, con merge commit;
  3. se pone el tag `vX.Y.Z` en ese merge;
  4. la skill `release` genera el zip desde el tag y prepara los pasos de SVN, que ejecuta el usuario.
- **Parche urgente:**
  1. rama `hotfix/X.Y.Z` desde `main` (que es el tag publicado), con su test de regresión;
  2. PR a `main`, merge y tag; se publica desde ese tag;
  3. PR `main` → `trunk` para llevar el arreglo a la integración.
- **Specs en paralelo:** cada una en su worktree y con su rama, las dos desde `trunk`.
- **Permisos de Claude** (`.claude/settings.json`):
  - se permiten: crear ramas `spec/*`, commitear, `git push -u origin spec/*`, `gh pr create --draft --base trunk`, `gh pr view`, `gh pr checks` y `gh pr ready`;
  - se deniegan: `git push` a `main` o a `trunk`, `git push --force*`, `git tag` (solo en la skill `release`, invocada por el usuario) y `svn *`.
- Las skills `start-phase` y `close-phase` crean la rama, abren el PR contra `trunk` y lo marcan como listo. La skill `release` abre el PR `trunk` → `main`.
- **Descartado** (detalle en el ADR 0007):
  - solo `main`, con los tags para lo publicado, porque `main` iría por delante de lo publicado durante toda la iniciativa;
  - `trunk` como rama por defecto, porque quien visita el repositorio vería código sin publicar;
  - GitFlow completo (`release/*`, `feature/*`), porque sobra para un solo desarrollador que publica por SVN;
  - commits directos a `trunk` o a `main`, porque no habría PR donde revisar el trabajo antes de que entre.

## 7. Ingeniería de contexto

Mismos principios que en `podcast-player-page`:

- **Cada tipo de conocimiento va en su mecanismo.**
- **Las instrucciones aconsejan; los hooks garantizan.**
- **Los tests son el mejor contexto.**
- **No se documenta lo que el código ya dice.**
- **Una instrucción vive en un único sitio.**

El contenido se diseña **para este repo**.

### 7.1 Estructura (estándar de Claude Code)

Se usan **solo los mecanismos oficiales de Claude Code, en sus rutas estándar**. Antes de crearlos en la fase 1, se comprueba en la documentación oficial vigente (memoria, settings, rules, skills, hooks, subagentes y MCP) el formato exacto de cada archivo y de su frontmatter. Si algo de esta sección no coincide con la documentación, manda la documentación y se apunta la diferencia.

```
CLAUDE.md                     # memoria del proyecto, < 120 líneas
CLAUDE.local.md               # memoria personal, en .gitignore
.mcp.json                     # servidores MCP del proyecto (Playwright MCP)
.claude/
├── settings.json             # permisos + hooks (versionado)
├── settings.local.json       # personal, en .gitignore
├── hooks/                    # scripts que invocan los hooks de settings.json
├── rules/*.md                # reglas con `paths:` en el frontmatter (§7.3)
├── skills/<nombre>/SKILL.md  # procedimientos (§7.5)
└── agents/<nombre>.md        # subagentes (§7.6)
```

`docs/specs/`, `docs/adr/` y `docs/status.md` **no** son mecanismos de Claude Code. Son convenciones del proyecto, y se conectan con Claude Code mediante el hook `SessionStart`, las skills y las rules.

### 7.2 `CLAUDE.md`

Solo debe contener esto:

1. Qué es el plugin, en 3 líneas, y dónde está la verdad: `SPEC.md` para el producto, la spec activa en `docs/specs/` y las decisiones en `docs/adr/`.
2. Los comandos (`npm run check`, tests y entorno).
3. Un mapa del repositorio de 10–15 líneas.
4. **Invariantes**, en forma de reglas verificables:
   - El código publicado funciona en PHP 7.4 y WP 6.6.
   - Las meta keys, las opciones, las globales JS, las funciones `radplapag_*`, los atributos y el markup de los bloques no cambian sin un ADR (§4).
   - La migración es unidireccional e idempotente.
   - El horario nunca controla la reproducción.
   - Toda fuente asignada directamente a `audio.src` lleva `crossOrigin = 'anonymous'` (ADR 0004).
   - Los visualizadores no se editan sin un ADR.
   - El núcleo del reproductor (cuando exista, spec 0006) no importa React ni MUI.
   - `player/dist/` y `blocks/*/build/` se regeneran y nunca se editan a mano.
   - El zip solo incluye lo que está en la lista de `build-release-zip.sh`.
   - La parte WordPress cumple las guidelines de WordPress.org. El player es independiente y solo habla con WordPress mediante `window.RADPLAPAG_*` (§3).
   - `player/` y cada `blocks/*` tienen su propio `package.json` y su propio build, y nunca se unifican.
5. **Flujo de trabajo:**
   - Todo trabajo empieza con una spec.
   - Plan mode para cualquier cambio de más de un archivo.
   - Caracterización antes de tocar código existente.
   - Test primero para la lógica nueva.
   - Commit por tarea, sin push.
   - Si algo contradice `SPEC.md` o un ADR, se usa `write-adr`.
6. **Qué no hacer:**
   - Añadir dependencias de runtime sin un ADR.
   - Subir los requisitos mínimos.
   - Corregir bugs sin un test de regresión.
   - Editar un test de caracterización para que pase.

### 7.3 Rules por ruta (`paths:` en el frontmatter, 20–60 líneas cada una)

| Rule | `paths` | Contenido clave |
|---|---|---|
| `wordpress-org.md` | `**/*.php`, `admin/**`, `blocks/**`, `readme.txt` | Las guidelines del directorio y los estándares de WordPress aplicados a la parte WordPress (§3), con enlaces a las fuentes oficiales. Qué revisa Plugin Check y qué no. Formato de `readme.txt`. |
| `php.md` | `**/*.php` | Sintaxis PHP 7.4. Prefijos `radplapag_` / `RADPLAPAG_`. Código nuevo en el namespace `RadioPlayerPage\` con autoloader PSR-4 propio (ADR en la spec 0005), sin Composer en runtime. Las funciones globales antiguas pasan a envoltorios. Docblocks con `@since`. |
| `security.md` | `includes/**`, `admin/**`, `blocks/**/render.php`, `radio-player-page.php` | Escapar en la salida. Nonces y capacidades en cada guardado. Sanear en la entrada con listas blancas. `wp_json_encode` para las globales JS. |
| `data-and-migrations.md` | `includes/**`, `uninstall.php` | El contrato de §4.1–§4.2. Nunca se renombran claves. La migración es idempotente y unidireccional. Cualquier cambio de esquema necesita un ADR y una migración nueva con su test de fixtures. |
| `blocks.md` | `blocks/**` | El markup y los atributos son contrato; el render se cubre con snapshots. **Cada bloque es un proyecto independiente** (su `package.json`, su lockfile y su build): no se comparten dependencias ni configuración entre bloques ni con el player. ESLint de WordPress. |
| `admin.md` | `admin/**` | Cadenas en `admin-strings.php`. La lógica pura sale a módulos testeables (spec 0005). Estándares JS de WordPress. |
| `player.md` | `player/**` | **Proyecto independiente de WordPress:** sus herramientas y sus convenciones (§3), sin WPCS. Solo recibe datos por `window.RADPLAPAG_*`. Sin peticiones a terceros. La UI en React/MUI. La lógica en `utils/` y en el núcleo (fase 5) sin React. Los hooks, como adaptadores finos. El horario no controla la reproducción. `crossOrigin`. Los locales con las mismas claves que `en-US.json`. |
| `visualizers.md` | rutas de §4.9 | Zona congelada. Su contrato con el reproductor. Cualquier edición necesita un ADR. |
| `testing.md` | `tests/**`, `**/*.test.ts`, `**/*.test.tsx` | La pirámide, las reglas de §5.2, los fixtures, ningún test sale a internet, los mínimos de la hoja de ruta (`docs/specs/README.md`). |

### 7.4 Hooks (`.claude/settings.json`)

| Evento | Script | Efecto |
|---|---|---|
| `SessionStart` | `session-context.sh` | Inyecta `docs/status.md`, la spec activa, la rama, un resumen de `git status` y si wp-env está arrancado. |
| `PreToolUse` `Edit\|Write` | `protect-generated.sh` | Bloquea las ediciones en `player/dist/**`, `blocks/*/build/**`, `vendor/**` y `node_modules/**`, e indica qué comando regenera cada cosa. |
| `PostToolUse` `Edit\|Write` | `format-edited-file.sh` | Solo actúa sobre el archivo editado. Para `.ts`/`.tsx`/`.js`: ESLint `--fix` + Prettier. Para `.php`: `php -l`, y además `phpcbf` **solo después** del formateo masivo de la spec 0002. Así se evita que editar una línea reformatee un archivo antiguo entero. |
| `Stop` | `verify-before-stop.sh` | Si hubo cambios, regenera lo que toque: el build del player si cambió `player/src`, y **el de cada bloque cuyo `src` cambió**, cada uno con sus propias herramientas. Después ejecuta `tsc` y los tests unitarios de las zonas tocadas. Si algo falla, devuelve `decision: block`. Tiene un tope de iteraciones. |

**Permisos:**

- Se permiten: `npm run *`, `npx wp-env|playwright|tsc|eslint|vitest *`, `composer *`, `vendor/bin/* *`, `php -l *`, `git status|diff|log|add|commit`.
- Se deniegan: `git push *`, `svn *`, `npm publish *` y la lectura de `.env*`.

Los scripts de los hooks tienen sus propios tests (`npm run test:hooks`).

### 7.5 Skills

Todas terminan con «`npm run check` en verde; actualizar `docs/status.md`».

| Skill | Cuándo | Qué garantiza |
|---|---|---|
| `write-spec` | El usuario pide un trabajo nuevo (funcionalidad, refactor o bug no trivial) | Se ejecuta en la sesión de diseño. Lee `SPEC.md`, los ADRs y el código. Escribe `docs/specs/NNNN-slug/spec.md` con la plantilla: contexto, objetivos y no objetivos, cambios al contrato de `SPEC.md`, fases con criterios de aceptación como tests, riesgos y una sección «Cómo usar este documento» para la sesión nueva. Actualiza el índice. **No implementa nada.** |
| `start-phase` | Al empezar una fase | Lee la spec activa, los ADRs y el plan anterior. En la primera fase, crea la rama `spec/NNNN-slug` desde `trunk` y abre el PR en borrador contra `trunk` (§6). En plan mode, escribe `phase-N.md` con tareas de ≤ 1 h, cada una con su test y su comando de verificación. Actualiza `status.md`. |
| `close-phase` | Al terminar una fase | Integración + e2e en verde. Ejecuta los subagentes revisores. Escribe los ADRs de la fase. Actualiza `SPEC.md` si cambió el contrato. Revisa las rules y `CLAUDE.md` (buscando instrucciones contradictorias u obsoletas). Actualiza `status.md`. Commit `chore(NNNN): close phase N`. En la última fase, además, cierra la spec: estado «cerrada» en el índice, PR marcado como «listo» para que el usuario lo fusione (§6) y un recordatorio para escribir la siguiente spec con `write-spec` en una sesión de diseño. |
| `characterize` | Antes de tocar un archivo o módulo existente | Inventaría sus entradas, salidas y efectos (hooks, BD, globales, HTML). Escribe tests contra el código sin modificarlo y los comprueba con una mutación temporal: un cambio que debe romperlos y se revierte después. Apunta las rarezas en `known-issues.md`. |
| `fix-bug` | Se corrige un bug | Test de regresión primero, visto en rojo; después el arreglo mínimo; después en verde. Commit `fix(…)`. |
| `audit` | Revisión de errores no detectados en una zona | Ejecuta las herramientas estáticas de la zona y una revisión con contexto limpio (`/code-review` a esfuerzo alto, más los subagentes que apliquen). Contrasta el código con `SPEC.md` y con el catálogo de `known-issues.md`. Cada hallazgo **confirmado con un test `currently` o con una reproducción** va a `known-issues.md`; los no confirmados se descartan. No corrige nada. |
| `upgrade-dependency` | Se actualiza una dependencia | Lleva a la **última versión estable**, una versión mayor por commit. Lee el changelog o la guía de migración oficial y usa los codemods oficiales si los hay. Ejecuta check + e2e. Compara el tamaño del bundle. Escribe un ADR si cambia algo visible, si hay que tocar los visualizadores o si la dependencia no puede llegar a la última versión. |
| `write-adr` | Se toma o cambia una decisión | Plantilla y numeración. Actualiza el índice y, si hace falta, la spec o `SPEC.md` en el mismo commit. |
| `release` | Solo si la invoca el usuario (`disable-model-invocation: true`) | Versiones (cabecera, `readme.txt` y el `package.json` de cada proyecto), changelog y `== Upgrade Notice ==` si hay correcciones visibles. Checklist de las guidelines de WordPress.org (§3), Plugin Check sobre el zip y comprobación del contenido del zip. Deja preparados los pasos de SVN **para que los ejecute el usuario**. |

### 7.6 Subagentes (solo lectura)

- `spec-conformance-reviewer`: compara el diff de la fase con la spec activa, `SPEC.md`, los ADRs y el plan. Señala desviaciones no documentadas y criterios sin test.
- `backcompat-reviewer`: busca en el diff cambios en el contrato de §4. Revisa claves, opciones, globales, funciones públicas, markup y atributos de los bloques, nombres de los assets y sintaxis por encima de PHP 7.4 o de APIs de WP posteriores a la 6.6.
- `wp-security-reviewer`: escape, nonces, capacidades y saneado.
- `wporg-reviewer`: revisa la parte WordPress del diff, o una zona completa en la auditoría, contra las guidelines del directorio y los estándares de WordPress (§3). Cubre lo que Plugin Check no detecta: llamadas externas, «nags» del admin, prefijos, librerías de core empaquetadas, licencias, `readme.txt` y desinstalación.
- `a11y-reviewer`: comprueba si hay violaciones nuevas respecto a la línea base cuando se toca UI.

Para la revisión general se usan `/code-review` y `/simplify`; no se duplican. MCP: Playwright MCP para explorar el sitio de wp-env.

### 7.7 `docs/status.md`

```md
# Estado
Spec activa: NNNN — título · Fase: N — nombre · Plan: docs/specs/NNNN-slug/phase-N.md · Actualizado: AAAA-MM-DD

## En curso
## Siguiente (máx. 5)
## Bloqueos / preguntas para el humano
## Verificación manual pendiente
## Desviaciones de la spec (→ ADR)
```

### 7.8 Formato de los planes de fase

```md
# Spec NNNN · Fase N — <nombre>
Estado: en curso · Inicio: AAAA-MM-DD · ADRs: …

## Objetivo
## Criterios de aceptación
| Criterio | Cómo se verifica (test o checklist manual) |
## Tareas
### N.1 <título> (≤ 1 h)
- Qué: …
- Archivos: …
- Test: <primero (TDD) | caracterización>: <archivo>
- Verificación: `<comando exacto>`
- [ ] hecha · commit: —
## Decisiones abiertas → ADR
```

Commits: `<type>(NNNN): <description> (<fase>.<tarea>)`. Por ejemplo: `test(0001): characterize schedule sanitizer (2.3)`.

---

## 8. Fases

Cada fase termina con:

- la CI en verde;
- los criterios verificados;
- el cierre hecho: a mano en la fase 0, con `close-phase` en la fase 1.

### Fase 0 — Spike (desechable)

Objetivo: validar los riesgos del montaje de tests antes de construir nada. El código va a `spike/`, que no entra en el zip ni se reutiliza.

| Riesgo | Pregunta que responde |
|---|---|
| R1 | ¿Funciona PHPUnit 9.6 con la suite de tests de WP sobre wp-env, tanto con **PHP 7.4 + WP 6.6** como con **PHP 8.4 + la última WP**? ¿Qué `composer.json` y qué `config.platform` hacen falta? |
| R2 | ¿Cómo se caracteriza `radplapag_output_clean_page()`, que termina con `exit`? Opciones: (a) snapshot por HTTP contra wp-env; (b) una costura mínima, por ejemplo extraer la generación del HTML a una función que devuelve un string, con un test que demuestre que la salida es idéntica byte a byte. Se elige una. |
| R3 | ¿Se puede reproducir con Playwright, en **Chromium y WebKit** y en Linux (CI), un MP3 progresivo, un stream MP3 infinito, HLS y DASH desde un servidor de test local, con y sin cabeceras CORS? ¿Qué flags de autoplay hacen falta? |
| R4 | ¿Se puede testear `use-audio-player` con Vitest + Testing Library usando un `FakeAudioElement` y los `import()` dinámicos de `hls.js`/`dashjs` simulados? ¿happy-dom o jsdom? |
| R5 | ¿Se pueden reconstruir valores reales de `radplapag_settings` de antes de la 3.3.0 a partir del historial de git y hacer un *golden master* de la migración? |
| R6 | ¿Funcionan las herramientas de test con la **última versión de Node**, y siguen saliendo idénticos los builds del player y de los bloques? ¿Con qué versión mínima de Node funcionan? (Node 20 ya no tiene soporte.) |
| R7 | ¿Qué última versión de PHPUnit, Yoast polyfills y wp-env funciona a la vez con PHP 7.4 + WP 6.6 y con PHP 8.4 + la última WP? Esta es la base del ADR de excepciones a «última versión de todo». |

- **Resultado:**
  - `docs/spikes/0001-phase-0.md` con los hallazgos;
  - los ADRs que salgan de ellos (como mínimo, R2, la versión de Node y las excepciones de R7);
  - esta spec (y la hoja de ruta) actualizadas si algo cambia.
- ✅ **Criterio:** cada riesgo tiene una respuesta demostrada con un prototipo que funciona, o una alternativa aprobada por el usuario.

### Fase 1 — Bootstrap: herramientas e ingeniería de contexto

- **Herramientas** (no cambian ningún comportamiento):
  - `package.json` en la raíz, **solo con las herramientas de la parte WordPress** (wp-env, Playwright, Vitest del admin, `@wordpress/eslint-plugin` para `admin/js`) y con scripts que **orquestan** sin unificar (hoja de ruta, decisión 7). Por ejemplo, `npm run check` ejecuta el check de la raíz, `npm --prefix player run check` y el de cada bloque.
  - `player/package.json` incorpora sus propios scripts de tests (`test`, `test:coverage`, `typecheck`, `check`) y Vitest. Cada bloque mantiene su `package.json`.
  - `composer.json` solo de desarrollo: PHPUnit 9.6 y polyfills 4 (ADR 0003), WPCS 3 y PHPCompatibilityWP, con `config.platform.php = 7.4.33`.
  - `phpcs.xml.dist`, `.wp-env.json` de desarrollo y una configuración de tests aparte (`--config`, con la matriz de R1; `testsEnvironment` está obsoleto en wp-env 11, y la suite se ejecuta en un contenedor cuya base de datos no es la del sitio de desarrollo; ADR 0003), `.editorconfig`, `.nvmrc` en la raíz, en `player/` y en cada bloque (todos con la misma versión de Node), `vitest.config` y `playwright.config`.
  - Node 26 en todos los `.nvmrc` y `engines.node: ">=22.22.2"` ([ADR 0002](../../adr/0002-node-26.md)); el campo no estándar `"node"` de `player/package.json` pasa a `engines`. El spike ya comprobó que `player/dist/` y `blocks/*/build/` salen **idénticos**.
  - `.gitignore`: `vendor/`, `coverage/`, `test-results/`, `playwright/.auth/`, `.phpunit.result.cache`, `CLAUDE.local.md` y `.claude/settings.local.json`.
- **Ingeniería de contexto:** todo lo de §7, con sus hooks y los tests de esos hooks. `.claude/rules/testing.md` recoge §5 y los mínimos de cobertura de la hoja de ruta.
- **Documentación:**
  - `SPEC.md` (producto), a partir de §4 verificado contra el código, con la metodología (§2), los dos mundos (§3) y las invariantes;
  - `docs/specs/_template.md`, y el índice (`docs/specs/README.md`) al día;
  - `docs/status.md`;
  - `docs/adr/` con ADRs retroactivos de las decisiones ya existentes: páginas limpias sin tema; React + MUI + Vite en el player; migración a CPT en la 3.3.0; prefijos; requisitos mínimos; `crossOrigin` anónimo para los visualizadores; build commiteado; publicación por SVN. Más los de la iniciativa: flujo de ramas (§6, ya escrito: ADR 0007), metodología por specs, caracterización antes que refactor, visualizadores congelados, dos mundos (WordPress.org / React), proyectos JS sin unificar y última versión de todo.
  - `docs/known-issues.md` sembrado con el catálogo C1–C16 de `docs/inherited-bugs.md` (§5.2), todavía sin confirmar, y con los candidatos `K*` del spike ([informe](../../spikes/0001-phase-0.md), «Para la fase 1»). Después se borra `inherited-bugs.md`.
- **CI:** los jobs nuevos (PHPCS, PHPCompatibility, PHPUnit unit e integración con la matriz de R1, Vitest, Playwright y tests de hooks), aunque las suites estén casi vacías. También la comprobación de que el zip no contiene rutas de desarrollo.
- ✅ **Criterios:**
  - `npm run check` y la CI en verde;
  - la **lista de archivos del zip es idéntica** a la del zip de `v3.4.2` (test que compara las listas);
  - una sesión nueva recibe `status.md` al arrancar (se comprueba con el test del hook);
  - `write-spec`, `start-phase` y `close-phase` existen y pasan una prueba en seco.

## 9. CI objetivo (`.github/workflows/`)

- Sintaxis PHP en 7.4 y 8.4.
- PHPCS (WPCS + PHPCompatibilityWP `7.4-`).
- Plugin Check (todas las categorías).
- PHPStan con su baseline (desde la spec 0002).
- Disparadores: `push` a `main` y a `trunk`, y `pull_request` (las ramas `spec/*` siempre tienen un PR en borrador).
- **Un job por proyecto JS, sin unificar:**
  - la raíz: ESLint de WordPress en `admin/js` y Vitest del admin;
  - `player/`: `npm ci` → `tsc` → ESLint → Vitest con umbrales → build → `git diff --exit-code player/dist/`;
  - cada bloque: `npm ci` → lint → build → `git diff --exit-code blocks/<bloque>/build/`.
- Listado de licencias GPL-compatibles en `player/` y en cada bloque. `npm audit` y `composer audit`.
- PHPUnit unit, sin Docker.
- PHPUnit integración con wp-env: PHP 7.4 + WP 6.6 y PHP 8.4 + la última WP.
- Comprobación de la cobertura de PHP por zonas.
- Playwright en Chromium y WebKit, con informe y trazas como artefactos si falla.
- Tests de los hooks.
- `build-release-zip.sh`, con la comprobación de que el zip no contiene rutas de desarrollo: `CLAUDE.md`, `.claude/`, `.mcp.json`, `docs/`, `SPEC.md`, `tests/`, `spike/`, `scripts/`, `composer.*`, configuraciones.

## 10. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | Las herramientas de test modernas no soportan PHP 7.4 o WP 6.6 | Spike R1 y R7. ADR de excepciones a «última versión de todo» | Fase 0 |
| 2 | La página limpia no se puede testear por el `exit` | Spike R2 | Fase 0 |
| 3 | La reproducción de streams en e2e es inestable (autoplay, WebKit en Linux) | Spike R3, servidor de streams local y reintentos solo en CI | Fase 0 |
| 4 | Con `crossOrigin = 'anonymous'`, los streams sin CORS no suenan (C1) | Se mide en el spike (R3) y se apunta en `known-issues.md`. Se caracteriza en la 0002 | Fase 0 |
| 5 | Una spec larga deja su rama abierta mucho tiempo y se aleja de `trunk` | Specs pequeñas; si una se alarga, se fusiona `trunk` en su rama al empezar cada fase | Continuo |
| 6 | Parches urgentes mientras dura la iniciativa | `hotfix/*` desde `main` (= `v3.4.2`), merge a `main` y PR `main` → `trunk` (§6) | Si ocurre |
| 7 | El bootstrap se come la iniciativa (demasiada configuración antes de escribir tests) | Las suites se quedan en humo; los tests de verdad son la 0002. Criterio de la fase 1: todo funciona, no todo está completo | Fase 1 |

## Apéndice A — Referencias

- Bugs heredados y vectores del horario: [`docs/known-issues.md`](../../known-issues.md) (antes `inherited-bugs.md`).
- Spike de la fase 0: [`docs/spikes/0001-phase-0.md`](../../spikes/0001-phase-0.md).
- WordPress.org: [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/), [Plugin Handbook](https://developer.wordpress.org/plugins/), [Coding Standards](https://developer.wordpress.org/coding-standards/), [Plugin Check](https://wordpress.org/plugins/plugin-check/), [readme.txt](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/).
- Metodología de referencia: `../podcast-player-page/SPEC.md` (§18 fases, §19 tests, §20 ingeniería de contexto, §21 CI), `CLAUDE.md`, `.claude/` (rules, skills, hooks y agentes) y `docs/` (`status.md`, `plans/`, `adr/`).
- Michael Feathers, *Working Effectively with Legacy Code*: tests de caracterización y costuras.
- Martin Fowler, *StranglerFigApplication*.
- Michael Nygard, *Documenting Architecture Decisions*.
- Documentación de Claude Code: memoria (`CLAUDE.md`), rules, skills, hooks y subagentes.
