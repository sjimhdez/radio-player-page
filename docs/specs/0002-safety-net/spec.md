# Spec 0002 — Red de seguridad, auditoría y triage

> Estado: **borrador**. Se completa con `write-spec` en una sesión de diseño cuando se cierre la 0001, con lo que salga del spike (`docs/spikes/0001-phase-0.md`). · Rama: `spec/0002-safety-net` · Depende de: 0001
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Reglas de tests: `.claude/rules/testing.md` (creada en la 0001).

## 1. Objetivo

Fijar con tests el comportamiento actual de la 3.4.2 antes de tocar nada (caracterización). Confirmar los bugs heredados, buscar los que nadie ha detectado y decidir con el usuario qué se corrige. **No cambia ningún comportamiento.**

## 2. Criterios de aceptación

- Se cumplen los mínimos de cobertura de la columna «al cerrar la 0002» de la hoja de ruta, y la CI los hace cumplir.
- Los 12 escenarios de §4 pasan en Chromium y WebKit.
- La integración pasa en verde con PHP 7.4 + WP 6.6 y con PHP 8.4 + la última WP.
- Cada punto del contrato de `SPEC.md` tiene al menos un test.
- El catálogo C1–C16 está confirmado o descartado.
- La auditoría está hecha en todas las zonas.
- El usuario ha triageado `docs/known-issues.md`.
- Las herramientas estáticas están en la CI con su baseline.

## 3. Fixtures

- `tests/fixtures/legacy-settings/`: valores de `radplapag_settings` reales de los formatos 2.0.x–3.2.x ([ADR 0005](../../adr/0005-migration-sources-2-0-plus.md); el spike ya los reconstruyó en `spike/php/fixtures/legacy-settings/`), con varias formas: una emisora, varias, sin horario, con datos corruptos y con conflicto con los CPT. Se reconstruyen a partir del historial de git anterior a `v3.3.0`.
- `tests/fixtures/schedule-vectors.json`: casos del horario compartidos por PHP (`radplapag_get_now_playing_for_station()` y la validación del servidor) y TS (`utils/program-schedule.ts` y la validación del admin). La semilla son los vectores de `docs/known-issues.md` (catálogo heredado). Cada vector guarda el resultado **de la 3.4.2**; los vectores 13 y 14 (C16) y los de C3 se guardan como `currently` hasta la spec de correcciones. Los dos lenguajes tienen que pasar los mismos vectores.
- `tests/fixtures/audio/`:
  - tonos cortos generados con ffmpeg (MP3 y OGG)
  - una lista HLS (`.m3u8` + segmentos)
  - un manifiesto DASH (`.mpd` + segmentos)
  - todo commiteado y de pocos KB
- **Servidor de streams de test** (lo arranca el `global-setup` de Playwright):
  - sirve los fixtures y un **stream MP3 infinito** en bucle, al estilo Icecast;
  - se puede configurar **con y sin** `Access-Control-Allow-Origin`.
- `../local-icecast-developer-tool` se puede usar para pruebas manuales en macOS, pero **no** sirve para la CI.
- `scripts/fixtures/seed.php` (ya existe) siembra un sitio completo. Se reutiliza para e2e haciéndolo idempotente.

## 4. Escenarios e2e obligatorios

1. **Reproducción MP3:** la página de la emisora carga, Play reproduce y `currentTime` avanza.
2. **HLS** (`hls.js` en Chromium; nativo en WebKit si aplica) y **DASH**: los dos reproducen.
3. **Intro:**
   - suena una vez y después pasa al directo;
   - no se puede pausar mientras suena;
   - si la intro falla, se pasa al directo sin error.
4. **`crossOrigin`:**
   - el `<audio>` lleva `crossorigin="anonymous"` con cada fuente asignada a `audio.src` (MP3, HLS nativo, intro) y no lo lleva en las rutas MSE (`hls.js`, `dashjs`) ([ADR 0004](../../adr/0004-crossorigin-on-direct-sources.md));
   - se comprueba (y se apunta como comportamiento actual) qué pasa con un stream **sin** cabeceras CORS.
5. **Programa actual y siguiente** con el reloj congelado: franja normal, cruce de medianoche, reposición y franja sin programa. **La reproducción no cambia cuando termina un programa.**
6. **Modales** del horario y de todos los programas: se abren, se cierran y muestran sus datos.
7. **Temporizador de sueño:** con el reloj adelantado, pausa la reproducción.
8. **Visualizadores (smoke):** con cada valor de `radplapag_station_visualizer`, la página carga y reproduce sin errores en consola.
9. **i18n:** con `lang="es"`, los textos salen en español; con un locale sin traducción, en inglés.
10. **Admin:**
    - crear un programa y una emisora con horario;
    - errores de validación visibles;
    - página ya asignada a otra emisora;
    - el reproductor refleja los datos guardados.
11. **Bloques** en el frontend (horario, lista de programas y en antena) y en el editor (se insertan y se previsualizan), en WP 6.6 y en la última versión.
12. **Accesibilidad (línea base):** se ejecuta `@axe-core/playwright` en la página del reproductor, los bloques y el admin de la emisora, y se **registran** las violaciones actuales en `docs/known-issues.md`. El criterio no es «cero violaciones», sino **ninguna violación nueva** respecto a esa línea base.

## 5. Fases (propuesta; el plan detallado lo hace `start-phase`)

### Fase 1 — Caracterización

- La skill `characterize` sobre cada zona, por orden de riesgo:
  1. saneado y validación del horario y de los campos (incluidos los vectores de `schedule-vectors.json` en PHP y TS);
  2. migración y actualización (golden master con fixtures);
  3. ruta de lectura y config;
  4. programa en antena;
  5. página limpia (según R2 del spike de la 0001);
  6. render de los bloques;
  7. CPT, capacidades y guardado;
  8. desinstalación;
  9. `utils/` y hooks del player;
  10. admin (e2e).
- Los 12 escenarios de §4.
- Test de paridad de claves de los locales.

### Fase 2 — Confirmación del catálogo heredado

- Cada entrada de C1–C16 en `known-issues.md` se confirma o se descarta contra la 3.4.2 con su test `currently` (`.claude/rules/testing.md`).

### Fase 3 — Revisión de errores no detectados

Skill `audit`, una tarea por zona: PHP del núcleo, migración, admin PHP+JS, bloques, player sin visualizadores.

- **Herramientas estáticas** como informe, sin bloquear la CI todavía:
  - PHPStan con extensiones de WordPress, al nivel más alto que se pueda mantener, con *baseline*;
  - PHPCS completo (WPCS + PHPCompatibilityWP);
  - Plugin Check con todas las categorías;
  - en `player/`, `tsc` con opciones estrictas extra (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) y las reglas estrictas de `eslint-plugin-react-hooks`;
  - `npm audit` y `composer audit` en cada proyecto;
  - listado de licencias.
- **Revisión con contexto limpio:** `/code-review` a esfuerzo alto sobre cada zona, `wp-security-reviewer` y `wporg-reviewer` sobre la parte WordPress, y la línea base de axe (escenario 12).
- **Contraste con la spec:** el código se compara con el contrato de `SPEC.md` y con los casos de `docs/known-issues.md`, por si hay variantes del mismo fallo en otras partes.
- Cada hallazgo confirmado entra en `known-issues.md` con origen `auditoría`, `axe` o `guidelines`.
- Al final de esta fase, las herramientas estáticas pasan a la CI **con su baseline**: nada nuevo puede empeorarla.

### Fase 4 — Triage con el usuario

- Se revisa `known-issues.md` fila a fila. Cada fila sale con su decisión: corregir en una spec de correcciones (agrupadas por zona en la hoja de ruta), abrir otra spec o no arreglar. Las que se corrigen se ordenan por prioridad.

### Fase 5 — Formateo masivo (con la red ya puesta)

- `phpcbf` en la parte WordPress, Prettier en `player/`, y las herramientas de formateo de cada bloque. Todo en un único commit `style(0002): …`, registrado en `.git-blame-ignore-revs`.
- La red de tests en verde antes y después.
- A partir de aquí, el hook PHP también ejecuta `phpcbf`.

## 6. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | El formateo masivo esconde cambios de lógica | Commit aislado, red en verde antes y después, `.git-blame-ignore-revs` |
| 2 | La auditoría produce más hallazgos de los que se pueden corregir | Decide el triage; solo se corrige lo aprobado, y el resto va a otras specs |
| 3 | Los tests de caracterización fijan detalles irrelevantes y frenan el refactor | Se caracteriza el comportamiento observable (salidas, efectos, HTML normalizado), no la estructura interna |
