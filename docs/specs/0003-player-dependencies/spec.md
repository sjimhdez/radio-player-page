# Spec 0003 — Dependencias del player (React)

> Estado: **propuesta** · Fecha: 2026-10-18 · Rama: `spec/0003-player-dependencies` · Depende de: 0002
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, `.claude/rules/player.md`, `.claude/rules/visualizers.md`, la skill `upgrade-dependency` y los ADRs 0004, 0014, 0018, 0020, 0021, 0022 y 0025.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0003-player-dependencies/phase-N.md`, aprobado en plan mode) y termina con `close-phase`. La fase 1 hace el primer push y abre el PR en borrador contra `trunk`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. **Solo se toca `player/`** (su `package.json`, lockfile, configuración, `src/` en lo que exija una migración y `dist/` regenerado) y las herramientas de medición de la fase 1. La parte WordPress es de la 0004.
5. Cada salto de versión mayor se hace con `upgrade-dependency`: un commit por versión mayor, con la guía de migración oficial y los codemods. Las versiones de §4.1 son las del 2026-10-18; al planificar cada fase se vuelve a mirar `npm view <paquete> version`, y manda la última estable.
6. **No se arreglan bugs ni se refactoriza.** Si una migración obliga a cambiar el comportamiento del player, para y pregunta (ADR, decisión 4 de la hoja de ruta). Los visualizadores no se tocan (ADR 0018); si una actualización lo exige, el cambio es mínimo y lleva su ADR aprobado por el usuario.

## 1. Contexto y objetivo

El player (`player/`, React 19 + MUI 7 + Vite 6) arrastra dependencias atrasadas, algunas en varias versiones mayores: MUI 7 → 9, Vite 6 → 8, ESLint 9 → 10, TypeScript 5.8 → 7, `react-i18next` 15 → 17, `date-fns` 3 → 4. Ahora es el momento: la 0002 dejó la red de tests (unidad, hooks, e2e en Chromium y WebKit, axe) que demuestra que nada visible cambia, y la 0006 refactorizará el player con las herramientas definitivas.

Al cerrar esta spec: cada dependencia de `player/` está en su última versión estable, o en la más alta posible con un ADR que explica por qué; el tamaño del bundle se mide y la CI lo vigila, y el usuario ha revisado las capturas de antes y después.

**No objetivos:**

- Las dependencias de la parte WordPress, de los bloques, de la raíz, de Composer y de las Actions (0004).
- Refactorizar el player o quitar las excepciones de lint que deja esta spec (0006).
- Corregir bugs: K67 (`dashjs` llama a una fuente de hora de terceros) es de la 0007, y K68 y el detector de i18next son de la 0011.
- Cambiar los imports de MUI, salvo que lo exija el presupuesto del bundle o un codemod.

## 2. Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | Todas las dependencias de `player/package.json` están en su última versión estable, salvo las excepciones con ADR | `npm --prefix player outdated` solo lista las excepciones de §3, que se enumeran en el ADR 0022 |
| A2 | El bundle está dentro del presupuesto frente a la línea base de la 3.4.2 | `npm run check:bundle` (dentro de `npm run check` y de la CI), con su test en `tests/js` (§4.2) |
| A3 | `player/dist/` lleva los mismos archivos con los mismos nombres; la entrada `src/main.tsx` del manifiesto sigue igual y con su CSS | `npm run check:zip` (la lista coincide con la `v3.4.2`) y la CI «Committed player/dist matches the build» |
| A4 | El comportamiento no cambia | `npm run check`; `npm run test:e2e` completo en Chromium y WebKit, en `env:start:min` y en `env:start:latest`, al cerrar cada fase; `visualizers.spec.ts`, `cross-origin.spec.ts` (ADR 0004), `hls-dash.spec.ts`, `i18n.spec.ts` y `a11y.spec.ts` sin cambiar ni el test ni la línea base |
| A5 | Ningún archivo de la zona congelada cambia, salvo que lo autorice un ADR | `git diff origin/trunk -- player/src/components/visualizers player/src/config/visualizers.ts player/src/types/visualizers.tsx player/src/hooks/use-audio-visualizer.tsx player/src/hooks/use-can-visualize.tsx` vacío en `close-phase` |
| A6 | El usuario aprueba la revisión visual de cada fase que cambia el runtime | `npm run screenshots -- <etiqueta>` antes y después (§4.3). Se anota en «Verificación manual pendiente» de `docs/status.md` hasta que el usuario lo apruebe; cualquier diferencia visible lleva su ADR |
| A7 | Los tests de caracterización de la 0002 no se editan para que pasen | Diff de `player/src/**/*.test.*` y `tests/e2e/**` revisado en cada `close-phase`: solo pueden cambiar por una API eliminada (p. ej. un import de Testing Library), con el motivo en el commit |
| A8 | Licencias GPL-compatibles y sin vulnerabilidades conocidas | CI: `check-licenses.mjs player` y `npm audit` del job de licencias |
| A9 | Las excepciones de lint que deja esta spec están en su línea, con su motivo | `grep -rn "eslint-disable" player/src` da como mucho las 6 líneas de §4.4 |

## 3. Cambios al contrato (`SPEC.md`)

Ninguno: el comportamiento caracterizado no cambia, y los nombres de los assets (`SPEC.md` §3, «Assets») se mantienen (A3). ADRs previstos, todos de proceso o de herramientas:

| ADR | Qué decide | Fase |
|---|---|---|
| Presupuesto del bundle del player | La medición, la línea base de la 3.4.2 y la regla del +10 %: la línea base solo se mueve con un ADR | 1 |
| TypeScript del player en 6.0.x | `typescript-eslint` 8.71.2 (la última) pide `typescript >=4.8.4 <6.1.0`, así que TypeScript 7.0.2 no puede entrar. Se fija la 6.0.x más alta y se añade a las excepciones del ADR 0022. Se revisa cuando `typescript-eslint` admita la 7 | 2 |
| Navegadores del player | Vite 7 sube el `build.target` por defecto (de `modules` a `baseline-widely-available`). La decisión por defecto es mantener explícito el *target* de Vite 6, para no dejar fuera navegadores que hoy funcionan. Si MUI 9 u otra dependencia exige más, el ADR fija el suelo resultante | 2 (y se revisa en la 4) |
| Cualquier cambio visible que imponga una dependencia | Lo que muestren las capturas o un e2e (decisión 4) | La fase donde aparezca |

Si alguna dependencia no puede llegar a su última versión estable (A1), se añade al ADR de TypeScript o se escribe uno propio, y se lista en el ADR 0022.

## 4. Diseño

### 4.1 Inventario (2026-10-18, `npm outdated` en `player/`)

| Paquete | Instalada | Última | Saltos de versión mayor (un commit cada uno) | Fase |
|---|---|---|---|---|
| `typescript` | 5.8.3 | 7.0.2 | 5.9 (menor) → 6.0.x; **no a la 7** (§3) | 2 |
| `eslint`, `@eslint/js` | 9.39.5 | 10.13.0 / 10.0.1 | 9 → 10 | 2 |
| `typescript-eslint` | 8.65.0 | 8.71.2 | menor | 2 |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.1.1 | 5 → 6 → 7 | 2 |
| `eslint-plugin-react-refresh` | 0.4.26 | 0.5.7 | 0.4 → 0.5 (en 0.x, la menor es mayor) | 2 |
| `globals` | 16.5.0 | 17.13.0 | 16 → 17 | 2 |
| `@types/node` | 24.13.3 | 26.6.5 | 24 → 26 (Node 26, ADR 0002) | 2 |
| `@types/react`, `@types/react-dom` | 19.2.x | 19.3.0 | menor (con React, fase 3) | 3 |
| `vite` | 6.4.3 | 8.3.4 | 6 → 7 → 8 (Rolldown) | 2 |
| `@vitejs/plugin-react` | 4.7.0 | 6.1.2 | 4 → 5 (con Vite 7) → 6 (pide Vite 8) | 2 |
| `vitest`, `@vitest/coverage-v8`, `happy-dom`, `prettier`, Testing Library | última | — | ya al día; se vuelve a comprobar | 2 |
| `react`, `react-dom` | 19.2.8 | 19.3.1 | menor | 3 |
| `hls.js` | 1.6.16 | 1.7.3 | menor | 3 |
| `dashjs` | 5.2.0 | 5.2.1 | parche (K67 sigue: 0007) | 3 |
| `date-fns` | 3.6.0 | 4.4.0 | 3 → 4 (solo `intervalToDuration` en `SleepTimer.tsx`) | 3 |
| `i18next` | 25.10.10 | 26.5.2 | 25 → 26 | 3 |
| `react-i18next` | 15.7.4 | 17.1.0 | 15 → 16 → 17 (la 17 pide `i18next >= 26.2.0`) | 3 |
| `i18next-browser-languagedetector` | 8.2.0 | 8.2.1 | parche | 3 |
| `@mui/material`, `@mui/icons-material` | 7.3.11 | 9.5.0 | 7 → 9: **no hay 8**. Un solo salto, con la guía de la 9 y `@mui/codemod` (si la guía remite a cambios de la serie 8, se aplican en el mismo commit) | 4 |
| `@emotion/react`, `@emotion/styled` | 11.14.x | 11.14.x | al día; MUI 9 sigue pidiendo Emotion 11 | 4 |

### 4.2 Medición del bundle (fase 1)

- `scripts/check-player-bundle.mjs` (Node, sin dependencias): lee `player/dist/manifest.json` y mide cada archivo de `player/dist/*.js|css` en bytes y en gzip (`zlib.gzipSync`, nivel 9, determinista). Imprime una tabla con la línea base, el valor actual y el porcentaje de cambio.
- La línea base `tests/bundle/player-baseline.json` es el `dist` de la 3.4.2 (medido el 2026-10-18 en gzip: principal 178 185, CSS 570, `hls` 161 659, `dash-all-min` 255 283 y los cuatro visualizadores, de 482 a 1 099). Las claves son los nombres sin la versión, para que sobrevivan a la subida de versión de la release.
- Regla, **acumulada frente a la 3.4.2** (decisión del usuario, 2026-10-18): falla si un asset crece más de un 10 % en gzip, o si lo hace la carga inicial (JS principal + CSS). Para los archivos de menos de 10 kB en gzip, la tolerancia es de 1 kB. También falla si aparece o desaparece un archivo. La línea base solo se reescribe con `--update` y un ADR.
- `npm run check:bundle` en la raíz, dentro de `npm run check` y en el job del player de la CI (que ya comprueba que `dist` coincide con el build). Su test, en `tests/js/scripts/check-player-bundle.test.js` (como `check-php-coverage.test.js`), usa fixtures en `tests/js/scripts/fixtures/` con un `dist` pequeño: dentro, fuera, tolerancia y archivo nuevo.

### 4.3 Capturas para la revisión visual (fase 1)

- Decisión del usuario (2026-10-18): **capturas a petición, fuera de la CI y fuera del repo**. No hay `toHaveScreenshot`.
- `tests/visual/player-screens.spec.ts`, en un proyecto propio de Playwright que `npm run test:e2e` ignora. `npm run screenshots -- <etiqueta>` lo lanza sobre el entorno de tests y escribe `test-results/screenshots/<etiqueta>/<navegador>/<pantalla>.png` (ignorado por git), en Chromium y WebKit, con 1280×800 y 390×844.
- Pantallas: la página mínima; MP3 en pausa y reproduciendo, con programa en antena y el siguiente; el modal de horario; el modal de todos los programas; el menú y la cuenta atrás del temporizador de sueño; el error de reproducción (snackbar), y un idioma distinto de `en-US`. Reutiliza los datos sembrados, `support/player.ts` y `support/clock.ts` (hora congelada) de los e2e, y también sus servidores de medios locales: ninguna petición a internet.
- Los visualizadores no se capturan (el canvas no es determinista); los cubre `visualizers.spec.ts`.
- Flujo: la etiqueta `3.4.2` en la fase 1 es la referencia. Cada fase que cambia el runtime (2 por Vite, 3 y 4) genera las suyas y le presenta al usuario las parejas, una al lado de la otra (p. ej. un HTML simple en `test-results/screenshots/`).

### 4.4 Lo que ya se sabe de la migración (prueba en una copia, 2026-10-18)

- **`eslint-plugin-react-hooks` 7** activa las reglas del React Compiler en `recommended` y da 6 errores en el código actual: `react-hooks/set-state-in-effect` en `src/components/dashboard/SleepMode.tsx:130`, `src/components/dashboard/index.tsx:167`, `src/hooks/use-is-ios.tsx:19` y `src/hooks/use-program-schedule.tsx:55`, y `react-hooks/immutability` y `react-hooks/refs` en `src/hooks/use-audio-player.test.tsx:73-74`. Decisión del usuario (2026-10-18): **excepción en su línea** (`// eslint-disable-next-line <regla> -- <motivo>`, ADR 0021), con un motivo que remita a la 0006; la regla sigue activa para el código nuevo. No se reescriben los efectos: cambiaría el momento del render en código que rehace la 0006.
- **TypeScript 6** da error con `baseUrl` (`TS5101`, obsoleto): se quita de `tsconfig.app.json` (las `paths` funcionan sin él). Además, `types` deja de incluir por defecto todos los `@types`: `src/utils/timezone.ts` usa `process.env.NODE_ENV` (4 veces), así que hay que declarar `"types": ["node"]` o equivalente en la configuración, sin tocar el código. Cambiarlo a `import.meta.env.DEV` es de la 0006.
- **ESLint 10:** `tseslint.config()` está obsoleto en favor de `defineConfig()` de `eslint/config`. Con la 10 pueden aparecer reglas nuevas en `recommended`: se tratan como las de `react-hooks` (excepción en su línea solo si arreglarlas cambia el comportamiento; si no, se arregla el código, con un test que lo cubra).
- **Vite 8** usa Rolldown: `build.rollupOptions` pasa a `rolldownOptions`, y el nombre de los chunks puede cambiar (`chunkFileNames` usa `chunkInfo.name`, que hoy da `hls` y `dash.all.min`). A3 lo vigila; si cambia, se ajusta la función de `vite.config.ts` hasta reproducir los nombres de la 3.4.2.
- **Vite 7** cambia el *target* por defecto (§3): se fija en `vite.config.ts` en el mismo commit del salto.

### 4.5 Orden

Primero la medición (para comparar desde la 3.4.2), después las herramientas y el build, y por último el runtime, de menos a más visible. Dentro de una fase, el plan ordena los saltos por dependencias de *peers*: `@vitejs/plugin-react` 6 detrás de Vite 8, `react-i18next` 17 detrás de `i18next` 26 y `@types/react` con React.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase`. En cada salto: `npm run check`, el build y, si cambia `dist`, `check:bundle` y su commit (skill `upgrade-dependency`, paso 5).

### Fase 1 — Medición y capturas

- `scripts/check-player-bundle.mjs`, su línea base y su test (§4.2); `check:bundle` en `check` y en la CI.
- ADR del presupuesto del bundle.
- Proyecto de capturas y `npm run screenshots` (§4.3), y la referencia `3.4.2` generada y revisada por el usuario: confirma que las pantallas son las que quiere comparar.
- ✅ **Criterios:** A2 con la línea base (0 % en todo); su test en verde en `npm test`; `npm run screenshots -- 3.4.2` genera todas las pantallas en los dos navegadores; `npm run test:e2e` no ejecuta el proyecto de capturas.

### Fase 2 — Herramientas y build

- TypeScript (5.9 → 6.0.x), ESLint 10 y `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` (5 → 6 → 7, con las 6 excepciones de §4.4), `eslint-plugin-react-refresh`, `globals` y `@types/node`. Vitest, `happy-dom`, Prettier y Testing Library, si han salido versiones nuevas.
- Vite 6 → 7 (*target* explícito) → 8, con `@vitejs/plugin-react` 4 → 5 → 6.
- ADRs de TypeScript 6.0.x y de los navegadores del player.
- ✅ **Criterios:** A1 para las herramientas y Vite; A2, A3 y A4; A5; A9; las capturas de la fase (Vite cambia el bundle) y A6.

### Fase 3 — Runtime sin MUI

- React y `react-dom` (con sus `@types`), `hls.js`, `dashjs`, `date-fns` 3 → 4, `i18next` 25 → 26, `react-i18next` 15 → 16 → 17 y `i18next-browser-languagedetector`.
- `i18next` 26 y `react-i18next` 17: el idioma sigue al del sitio (ADR 0025); lo vigila `i18n.spec.ts`, más `locales.test.ts` (paridad de claves). No se cambia la configuración del detector (K68, 0011), salvo que la API lo exija.
- `hls.js` y `dashjs`: `cross-origin.spec.ts` y `hls-dash.spec.ts` mandan (ADR 0004; K70 sigue como está).
- ✅ **Criterios:** A1 para estos paquetes; A2, A3, A4, A5, A7; A6 con las capturas de la fase.

### Fase 4 — MUI 9 y Emotion

- `@mui/material` y `@mui/icons-material` 7 → 9 con la guía oficial y `@mui/codemod` (el codemod se aplica en un commit propio dentro del salto, para revisar su diff aparte de los arreglos a mano). Emotion, si hay versión nueva.
- Se revisan los navegadores mínimos de MUI 9 frente al ADR de navegadores de la fase 2.
- Revisión de la línea base de axe: sin violaciones nuevas (ADR 0023). Si MUI corrige alguna, el aviso de entrada obsoleta se resuelve con `RADPLAPAG_UPDATE_A11Y_BASELINE=1` en los dos proyectos, y el diff solo puede tener bajas.
- ✅ **Criterios:** A1 completo (`npm outdated` solo da las excepciones del ADR 0022); A2–A9; la revisión visual final del usuario frente a `3.4.2`.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | MUI 9 cambia estilos por defecto (tipografía, espaciados, `Slider`, `Dialog`) | Capturas antes y después; un cambio visible no aceptado se compensa en `src/config/theme.ts` y, si no se puede, va a un ADR | Fase 4 |
| 2 | MUI 9 (o Vite 8) hace crecer el bundle más de un 10 % | Antes de pedir un ADR, buscar la causa (p. ej. los imports desde los barriles `@mui/material` y `@mui/icons-material` en `VolumeControl.tsx`, `StreamInfo.tsx`, `AllProgramsModal.tsx` y `ScheduleModal.tsx`): cambiarlos a imports por ruta no altera el comportamiento | Fases 2 y 4 |
| 3 | Rolldown cambia los nombres de los chunks o el manifiesto | A3 lo detecta; se ajustan `chunkFileNames`/`entryFileNames` hasta reproducir los de la 3.4.2 | Fase 2 |
| 4 | Una actualización obliga a tocar un visualizador (tipos de `AnalyserNode`, React 19.3) | Cambio mínimo, con ADR aprobado por el usuario y `visualizers.spec.ts` (`visualizers.md`) | Fases 2–4 |
| 5 | `typescript-eslint` admite TypeScript 7 durante la spec | Se sube en ese momento (un commit) y el ADR de la fase 2 pasa a sustituido | Cualquiera |
| 6 | Reglas nuevas de ESLint 10 o de `react-hooks` 7 en el código | §4.4: excepción en su línea solo si arreglarlo cambia el comportamiento; la lista final de excepciones queda en el plan de la fase 2 y en la hoja de ruta de la 0006 | Fase 2 |
| 7 | `react-i18next` 16/17 cambia la API de `Trans`/`useTranslation` o la carga de recursos | Guía oficial de cada mayor; `i18n.spec.ts` y `locales.test.ts` | Fase 3 |
| 8 | Las capturas varían entre ejecuciones (fuentes, animaciones) | Hora congelada, animaciones desactivadas (`reducedMotion`) y la misma máquina para el antes y el después | Fase 1 |

## Apéndice — Referencias

- Skill `upgrade-dependency`; ADR 0022 (últimas versiones y excepciones), 0020 (proyectos independientes), 0014 (builds commiteados), 0018 (zona congelada), 0021 (excepciones en su línea), 0023 (línea base de axe), 0025 (idioma del sitio).
- Guías de migración: MUI 9 (`mui.com/material-ui/migration/`), Vite 7 y 8 (`vite.dev/guide/migration`), ESLint 10, TypeScript 6.0 (`aka.ms/ts6`), `react-i18next` 16 y 17, `i18next` 26 y `date-fns` 4 (changelogs).
- Medición de la 3.4.2: `player/dist/` del 2026-10-18 (§4.2).
