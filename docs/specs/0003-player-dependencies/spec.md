# Spec 0003 — Dependencias del player y de los bloques

> Estado: **propuesta** · Fecha: 2026-10-20 (reescrita; la primera versión es del 2026-10-18) · Rama: `spec/0003-player-dependencies` · Depende de: 0002
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, `.claude/rules/player.md`, `.claude/rules/blocks.md`, `.claude/rules/visualizers.md`, la skill `upgrade-dependency` y los ADRs 0004, 0014, 0018, 0020, 0021, 0022, 0023 y **0026** (el método de esta spec).
2. Spec ligera, **una sola fase**: empieza con `start-phase` (plan en `docs/specs/0003-player-dependencies/phase-1.md`) y termina con `close-phase`. La rama y el PR #38 (borrador contra `trunk`) ya existen.
3. **Agrupado (ADR 0026):** un commit de actualización por proyecto (`player/` y cada bloque), con todas sus dependencias a la vez. No un commit por librería. Solo se separa un paquete si rompe algo que su guía de migración no resuelve.
4. Las versiones de §4.1 son las del 2026-10-20; al planificar se vuelve a mirar `npm outdated` y manda la última estable.
5. **No se arreglan bugs ni se refactoriza.** Si una migración obliga a cambiar el comportamiento, para y pregunta. Los visualizadores no se tocan (ADR 0018). Los tests de caracterización no se editan para que pasen.
6. Si algo de esta spec resulta falso al contrastarlo con el código: **para y pregunta**.

## 1. Contexto y objetivo

El player (`player/`, React 19 + MUI 7 + Vite 6) y los tres bloques (`@wordpress/scripts` 28) arrastran dependencias atrasadas, algunas en varias versiones mayores. La 0002 dejó la red de tests que demuestra que nada cambia, y la 0006 refactorizará el player con las herramientas definitivas.

Al cerrar esta spec, `player/`, `blocks/now-playing`, `blocks/programs-list` y `blocks/schedule` tienen cada dependencia en su última versión estable, o en la más alta posible con su excepción en el ADR 0022, y el usuario ha revisado a ojo que el player y los bloques se ven igual.

**No objetivos:**

- Herramientas de la raíz, Composer y Actions de GitHub: se suben cuando haga falta, como `chore` fuera de una spec (ADR 0026).
- Medición automatizada del bundle o capturas automatizadas (ADR 0026).
- Refactorizar o quitar las excepciones de lint que deja esta spec (0006, 0005).
- Corregir bugs: K67 (`dashjs` y una fuente de hora de terceros) es de la 0007; K68 y el detector de i18next, de la 0011.

## 2. Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | Todas las dependencias de `player/` y de cada bloque están en su última versión estable, salvo las excepciones del ADR 0022 | `npm --prefix <proyecto> outdated` solo lista esas excepciones |
| A2 | El comportamiento no cambia | `npm run check`; `npm run test:e2e` completo en `env:start:min` (WP 6.6 + PHP 7.4) y en `env:start:latest`, en Chromium y WebKit, sin editar los tests ni la línea base de axe (ADR 0023) |
| A3 | `player/dist/` y `blocks/*/build/` llevan los mismos archivos con los mismos nombres | `npm run check:zip` (la lista coincide con la `v3.4.2`) y los pasos de la CI que comparan los builds commiteados |
| A4 | La zona congelada no cambia | `git diff origin/trunk -- player/src/components/visualizers player/src/config/visualizers.ts player/src/types/visualizers.tsx player/src/hooks/use-audio-visualizer.tsx player/src/hooks/use-can-visualize.tsx` vacío |
| A5 | El tamaño del bundle está anotado | Tabla de `player/dist/*.js|css` en gzip, antes y después, en el PR. Si un archivo crece más de un 10 %, se pregunta al usuario |
| A6 | Licencias GPL-compatibles y sin vulnerabilidades conocidas | CI: `check-licenses.mjs` y `npm audit` |
| A7 | El usuario aprueba la revisión visual | Manual, en <http://localhost:8886>: página del player (pausa, reproducción, modales de horario y de programas, temporizador de sueño, móvil y escritorio) y los tres bloques en el editor y en el front. Queda en «Verificación manual pendiente» de `docs/status.md` hasta que lo apruebe |

## 3. Cambios al contrato (`SPEC.md`)

Ninguno: el comportamiento caracterizado, el markup y los atributos de los bloques y los nombres de los assets no cambian. Un cambio visible que imponga una dependencia lleva su ADR, aprobado por el usuario.

## 4. Diseño

### 4.1 Inventario (2026-10-20, `npm outdated`)

**`player/`** — todo junto en un commit:

| Grupo | De → a |
|---|---|
| Herramientas | `typescript` 5.8 → **6.0.x** (no la 7, §4.2) · `eslint` y `@eslint/js` 9 → 10 · `typescript-eslint` 8.72 · `eslint-plugin-react-hooks` 5 → 7 · `eslint-plugin-react-refresh` 0.4 → 0.5 · `globals` 16 → 17 · `@types/node` 24 → 26 |
| Build | `vite` 6 → 8 (Rolldown) · `@vitejs/plugin-react` 4 → 6 |
| Runtime | `react`, `react-dom` y sus `@types` 19.3 · `hls.js` 1.7 · `dashjs` 5.2.1 · `date-fns` 3 → 4 · `i18next` 25 → 26 · `react-i18next` 15 → 17 · `@mui/material` y `@mui/icons-material` 7 → 9 (no hay 8) |
| Ya al día | Vitest, `happy-dom`, Prettier, Testing Library, Emotion: se vuelve a comprobar |

**Cada bloque** — un commit para los tres, o uno por bloque si alguno da guerra: `@wordpress/scripts` 28 → 37, `@babel/runtime` a la última compatible y, en `now-playing`, `typescript` 5.9.3 (excepción del ADR 0022 que se revisa: con `@wordpress/scripts` 37 puede subir).

### 4.2 Lo que ya se sabe de la migración

Player (probado en una copia el 2026-10-18):

- **TypeScript:** `typescript-eslint` 8.72 pide `typescript >=4.8.4 <6.1.0`, así que se queda en la 6.0.x más alta; se añade como excepción al ADR 0022. TS 6 da error con `baseUrl` (`TS5101`): se quita de `tsconfig.app.json`. `types` ya no incluye todos los `@types`, y `src/utils/timezone.ts` usa `process.env.NODE_ENV`: se declara `"types": ["node"]` en la configuración, sin tocar el código.
- **`eslint-plugin-react-hooks` 7** da 6 errores: `set-state-in-effect` en `src/components/dashboard/SleepMode.tsx:130`, `src/components/dashboard/index.tsx:167`, `src/hooks/use-is-ios.tsx:19` y `src/hooks/use-program-schedule.tsx:55`; `immutability` y `refs` en `src/hooks/use-audio-player.test.tsx:73-74`. Excepción en su línea, `// eslint-disable-next-line <regla> -- <motivo, remite a la 0006>` (ADR 0021). No se reescriben los efectos.
- **ESLint 10:** `tseslint.config()` → `defineConfig()` de `eslint/config`. Las reglas nuevas se arreglan en el código si no cambian el comportamiento; si lo cambian, excepción en su línea.
- **Vite 7** sube el `build.target` por defecto: se mantiene explícito el de Vite 6 en `vite.config.ts`, para no dejar fuera navegadores que hoy funcionan. Si MUI 9 exige más, se pregunta (ADR).
- **Vite 8:** `build.rollupOptions` → `rolldownOptions`. Los nombres de los chunks (`hls`, `dash.all.min`) pueden cambiar: `check:zip` lo detecta y se ajusta `chunkFileNames` hasta reproducir los de la 3.4.2.
- **MUI 9:** guía oficial y `@mui/codemod`. Puede cambiar estilos por defecto (tipografía, `Slider`, `Dialog`): lo ve la revisión visual; se compensa en `src/config/theme.ts` o va a un ADR.
- **i18next 26 / react-i18next 17:** el idioma sigue al del sitio (ADR 0025); lo vigilan `i18n.spec.ts` y `locales.test.ts`. No se cambia la configuración del detector salvo que la API lo exija.

Bloques (sin probar todavía):

- `@wordpress/scripts` 37 trae **ESLint 10**, que ya no admite eslintrc: `ESLINT_USE_FLAT_CONFIG=false` y `.eslintrc.json` dejan de funcionar. Cada bloque pasa a su propio `eslint.config.mjs` (según la guía de `@wordpress/scripts`), que tiene que seguir aislándolo del de la raíz (ADR 0020); se actualiza `.claude/rules/blocks.md`.
- Pide Node `^22.22.2 || ^24.15.0 || >=26.0.0` (el proyecto usa 26).
- El build cambia (webpack, Babel): el e2e de bloques en WP 6.6 manda. Si el build nuevo necesita una WP posterior a la 6.6, para y pregunta (ADR 0012).
- `@babel/runtime` no aparece en `blocks/*/build/` (grep, 2026-10-20). `check-licenses.mjs` no lo mira porque es dependencia de desarrollo; si tras la subida acaba en el build, se mueve a `dependencies`.

### 4.3 Orden

1. Anotar el tamaño en gzip de `player/dist/` (línea base, idéntica a la `v3.4.2`).
2. Player: subir todo, aplicar las guías y codemods, arreglar `check`, build, e2e. Un commit (más los separados, si alguno rompe).
3. Bloques: lo mismo.
4. E2E completo en las dos puntas, tabla del bundle en el PR y revisión visual del usuario.

## 5. Fases

### Fase 1 — Actualización agrupada

- Tareas, una por commit: player (`build(0003): upgrade player dependencies (1.N)`), bloques (`build(0003): upgrade block dependencies (1.N)`), excepciones del ADR 0022 y lo que salga de la revisión visual.
- ✅ **Criterios:** A1–A7.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación |
|---|---|---|
| 1 | Al agruparlo todo, un fallo no dice qué librería lo causa | Se separan los paquetes sospechosos (MUI, Vite, i18next) en su propio commit (ADR 0026) |
| 2 | MUI 9 cambia estilos por defecto | Revisión visual; se compensa en `theme.ts` o ADR |
| 3 | El bundle crece más de un 10 % | Antes de preguntar, mirar los imports desde los barriles `@mui/material` y `@mui/icons-material` (`VolumeControl.tsx`, `StreamInfo.tsx`, `AllProgramsModal.tsx`, `ScheduleModal.tsx`): cambiarlos a imports por ruta no altera el comportamiento |
| 4 | Una actualización obliga a tocar un visualizador | Cambio mínimo, ADR aprobado por el usuario y `visualizers.spec.ts` |
| 5 | El build de `@wordpress/scripts` 37 no funciona en WP 6.6 | Se fija la versión más alta que funcione, con su excepción en el ADR 0022 |
| 6 | `typescript-eslint` admite TypeScript 7 durante la spec | Se sube y se quita la excepción |

## Apéndice — Referencias

- ADR 0026 (método), 0022 (últimas versiones y excepciones), 0020 (proyectos independientes), 0014 (builds commiteados), 0018 (zona congelada), 0021 (excepciones en su línea), 0023 (línea base de axe), 0025 (idioma del sitio), 0012 (mínimos).
- Guías: MUI 9 (`mui.com/material-ui/migration/`), Vite 7 y 8 (`vite.dev/guide/migration`), ESLint 10, TypeScript 6.0, `react-i18next` 16 y 17, `i18next` 26, `date-fns` 4, changelog de `@wordpress/scripts`.
