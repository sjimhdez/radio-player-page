# Auditoría · zona 5, player sin visualizadores

Spec 0002, fase 4, tarea 4.6 · 2026-10-18 · código auditado: 3.4.2 (sin cambios).

**Alcance:** `player/src` menos la zona congelada del ADR 0018 (`components/visualizers/**`, `config/visualizers.ts`, `types/visualizers.tsx`, `hooks/use-audio-visualizer.tsx`, `hooks/use-can-visualize.tsx`, que solo se leen por cómo comparten `audioRef`): `App.tsx`, `main.tsx`, `ThemeProviderWrapper.tsx`, `components/dashboard/*`, `config/{i18n,theme}.ts`, los hooks del reproductor, `types/{global,player}`, `utils/{program-schedule,timezone}.ts`, `locales/*.json` y los CSS. Del lado de WordPress, solo el `lang` que imprime la página limpia (K62).

**Resultado:** 17 hallazgos confirmados (K55–K71) y uno de axe (AX6), más variantes de K1 (DASH sin CORS, medido ahora), K11, K52 y AX2. Uno de gravedad alta (K67: `dashjs` llama a `time.akamai.com`), siete de gravedad media. Los tres huecos de `contract-map.md` de esta zona quedan cerrados con e2e. La línea base de axe no cambia: lo nuevo de axe (AX6 y la variante de AX2) sale en estados que los escenarios de `a11y.spec.ts` no alcanzan y se fija en tests aparte. 20 líneas de candidatos descartados. No se ha tocado código publicado.

## 1. Herramientas estáticas

Solo como informe; la configuración del player no cambia.

| Herramienta | Salida |
|---|---|
| `npm --prefix player run typecheck` | limpio. |
| `npm --prefix player run lint` | 0 errores; 3 avisos `Unused eslint-disable directive` en `player/coverage/*.js`, que es lo que genera `test:coverage` (no está en git) → ruido del informe de cobertura. |
| `tsc` con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` (tsconfig temporal en el scratchpad que extiende `tsconfig.app.json`) | 85 errores; 12 en la zona sin tests (el plan estimaba 17; el resto son tests y la zona congelada). `DAY_MAP[dayOfWeek]` y `schedule[dayKey]` en `program-schedule.ts` (6) y `t(DAY_KEYS[…])` en los dos modales (2): `dayOfWeek` sale de `getDay()` o de un bucle 0–6, siempre en rango → ruido. `parseToMinutes()` con `hour`/`minute` posiblemente `undefined` (2): las horas llegan validadas como `HH:MM` desde PHP → ruido. `exactOptionalPropertyTypes` en `use-config.tsx` y `index.tsx` (2): `undefined` explícito en props opcionales → ruido. Ningún bug. |
| ESLint con `eslint-plugin-react-hooks@7.1.1` y todas sus reglas como error (configuración temporal en el scratchpad) | 4 `set-state-in-effect`: `SleepMode.tsx:130`, `index.tsx:167`, `use-is-ios.tsx:19`, `use-program-schedule.tsx:55`. Son renders de más, sin efecto visible → ruido (para el refactor de la spec 0006). |
| `npm --prefix player audit --omit=dev` y `node scripts/check-licenses.mjs player` (los dos en la CI, job «Licenses and npm audit») | 0 vulnerabilidades; 113 paquetes de runtime con licencia compatible con GPL (medido al cerrar la fase, 2026-10-18). |
| «Ninguna petición a terceros» (`.claude/rules/player.md`) | sin URLs externas en `index.css`, `App.css`, `theme.ts` ni `main.tsx` (fuentes `system-ui`); `player/index.html` (picsum, pravatar) es solo del servidor de desarrollo y no entra en `dist/`. Todos los e2e pasan con el *fixture* que aborta cualquier petición fuera del sitio de test y de los dos servidores de medios. **Pero** el *chunk* de `dashjs` trae `https://time.akamai.com/?iso&ms` y lo usa con un directo DASH sin `<UTCTiming>`: K67. |

## 2. Revisores lanzados

Con contexto limpio y la lista de archivos de arriba:

- **Code review a esfuerzo alto** (subagente general, solo lectura; confirmó sus hallazgos con Vitest en el scratchpad, que aquí se han pasado al repo como tests `currently`): propuso K63, K64, la variante de K11, K65, K66, K67, K68, K69, la variante de K52, K70, el orden desde el domingo del modal de programas y K71; como sospechas, dos `play()` concurrentes con HLS, `pause()` durante la carga de un MP3, `play()` fuera del gesto con `hls.js` en Safari, timers suspendidos en iOS, el ciclo de Media Session, `100vh` en Safari de iOS, desmontaje durante el `import()`, y `use-config` sin validar la forma de programas y horario ni ErrorBoundary. Confirmó que el horario no controla la reproducción y que, salvo C15, todo el texto pasa por `t()`.
- **`a11y-reviewer`** (línea base de axe, C15, AX1, AX2): propuso K56, K57, K58, K59, AX6, la parte de foco y estado del botón del temporizador, K60, la variante de AX2, K62 y K61; como mejoras sin incumplimiento AA claro, `aria-valuetext` del volumen, la cuenta atrás sin anuncio, el nombre de los modales con «Close», `alt` redundantes, semántica de las tarjetas, `prefers-reduced-motion`, botones deshabilitados sin explicación, la diferencia horaria sin unidad y el foco visible que depende de `index.css`. Contraste de los 8 temas y objetivos táctiles (2.5.8): pasan.

## 3. Contraste

**`SPEC.md` §3.8:**

- Configuración solo por `use-config.tsx`: se cumple (K17 sigue).
- Protocolo por la extensión: se cumple (C2 sigue). OGG directo: **suena** en Chromium y WebKit (hueco cerrado, abajo).
- `crossOrigin` en las fuentes directas, `null` en MSE: se cumple, salvo tras la bienvenida (K70).
- Bienvenida una vez, sin pausa y, si falla, al directo sin error: se cumple; pero si el directo falla después, el player se queda bloqueado (K63).
- Volumen, Media Session (K14 sigue) y temporizador de sueño (K65, K66): se cumplen con esas rarezas.
- Programa actual y siguiente, reloj de la emisora: se cumplen salvo lo conocido (C4, C16, K8, K9, K10, K52).
- El horario es solo informativo: se cumple. `use-program-schedule` y los modales no tocan `useAudioPlayer`.
- Errores: «Unable to play the stream…» con las excepciones de K1, que ahora se miden también con DASH.
- i18n: 14 locales y reserva `en-US`, se cumple. «Detección: `lang` → `localStorage` → navegador»: el orden es ese, pero la página siempre imprime `lang`, así que los dos últimos pasos no se alcanzan nunca (K55). Además, las variantes regionales sin recurso salen en inglés (K68), sin marcar el cambio de idioma (K62).

**Filas de `known-issues.md` de la zona** (todas siguen; sus tests `currently` pasan en esta ejecución): C1, C2, C4, C6, C7, C8, C9 (parte del player), C15, C16, K1, K8, K9, K10, K11 (con una variante), K12, K13, K14, K18 (sigue sin poder medirse en la CI, WebKitGTK), AX1 y AX2 (con una variante). C5 es de la zona congelada y no se mira.

### Huecos de `contract-map.md` de esta zona

Cerrados con e2e. `tests/e2e/fixtures/seed-e2e.php` siembra dos variantes nuevas: `ogg` (`tone.ogg` del origen con CORS) y `nocors-dash` (el manifiesto DASH del origen sin CORS).

- **Orden de detección i18n en el navegador** (`SPEC.md` §3.8): `i18n.spec.ts` ya fijaba `lang` > `localStorage`; ahora fija que `navigator` no se alcanza ni con un `lang` sin traducción (K55, contexto de Playwright en `de-DE`).
- **Un directo OGG que suena:** `mp3.spec.ts` (`plays the OGG stream as a direct source`): suena, como fuente directa y con `crossOrigin = 'anonymous'`, en Chromium y WebKit.
- **DASH sin CORS:** `cross-origin.spec.ts` (`currently does not play DASH without CORS and shows the error (C1, K1)`): como HLS, `dashjs` pide el manifiesto (lo reintenta), no pide ningún segmento y sale «Unable to play the stream…» en los dos navegadores. La fila K1 deja de depender de la medición del spike.

## 4. Hallazgos confirmados

| Fila | Qué | Cómo se confirma |
|---|---|---|
| K55 | El idioma del navegador nunca se usa: `lang` siempre gana | e2e `i18n.spec.ts` (`currently never uses the browser language…`), Chromium y WebKit |
| K56 | Play → *spinner* desmonta el botón y el foco cae a `body` | e2e `player-a11y.spec.ts` |
| K57 | Los modales no devuelven el foco al cerrar (`disableRestoreFocus`) | e2e `player-a11y.spec.ts` (los dos modales) |
| K58 | Cancelar el temporizador deja el foco en `body` | e2e `player-a11y.spec.ts` |
| K59 | «Connecting...» no se anuncia (ninguna región viva) | e2e `player-a11y.spec.ts` |
| K60 | «On Air» parpadea sin fin (WCAG 2.2.2) | e2e `player-a11y.spec.ts` (`document.getAnimations()`, `iterations === Infinity`) |
| K61 | A 320 × 256 el reloj tapa el nombre de la emisora | e2e `player-a11y.spec.ts` (cajas que se cruzan) |
| K62 | Inglés de reserva marcado con el `lang` del sitio | e2e `i18n.spec.ts` |
| K63 | Bloqueo en la bienvenida si el directo no arranca después | Vitest `use-audio-player.test.tsx` (4 casos) |
| K64 | Pausa durante el *buffering* → *spinner* para siempre | Vitest `use-audio-player.test.tsx` |
| K65 | El paso de la bienvenida al directo cancela el temporizador | e2e `sleep.spec.ts`, Chromium y WebKit (`pause` llega antes de `ended`) |
| K66 | La cuenta atrás cuenta *ticks*, no tiempo | Vitest `SleepMode.test.tsx` |
| K67 | `dashjs` pide la hora a `time.akamai.com` con un directo DASH | e2e `hls-dash.spec.ts` (MPD dinámico servido en el test; la petición se contesta en local) |
| K68 | `de-AT`, `pt-PT`, `nl-BE`, `sv`, `ru`… salen en inglés | Vitest `locales.test.ts` |
| K69 | «(in 1 minutes)»: sin plural | Vitest `locales.test.ts` |
| K70 | `crossOrigin` se queda en `anonymous` en `hls.js` tras la bienvenida | Vitest `use-audio-player.test.tsx` |
| K71 | Anuncio de Locize en la consola | e2e `i18n.spec.ts` |
| AX6 | `aria-progressbar-name` en el *spinner* de carga | e2e `player-a11y.spec.ts` (axe con el stream retenido) |
| K1 (variante) | DASH sin CORS: error a la vista en los dos navegadores | e2e `cross-origin.spec.ts` |
| K11 (variante) | Una pausa antes de `MANIFEST_PARSED` no cuenta | Vitest `use-audio-player.test.tsx` |
| K52 (variante) | Un programa partido en la medianoche se anuncia a sí mismo | Vitest `program-schedule.test.ts` (y el caso de 24 h) |
| AX2 (variante) | `h5` bajo el `h2` al expandir un programa | e2e `player-a11y.spec.ts` (axe tras «Show more») |

`tests/e2e/player-a11y.spec.ts` es un archivo nuevo que el plan no listaba: junta lo que axe no ve del player para no mezclarlo con los escenarios de la línea base de `a11y.spec.ts`.

**Hueco (cierre de fase, `a11y-reviewer`):** en el estado de carga y con un programa expandido, axe solo corre con `withRules()` (las reglas de AX6 y de la variante de AX2). Una violación de otra regla en esos dos estados no la vigila nadie. Cerrarlo pide dos escenarios nuevos en la línea base de `a11y.spec.ts` (ADR 0023): queda para el triage de la fase 5.

**Mutación de comprobación de Vitest**, en una copia del player en el scratchpad (el repo no se toca): `advanceToLive()` libera `introLocked` al fallar, `onPause`/`onError` lo liberan durante la bienvenida y `onPause` limpia `loading`, `MANIFEST_PARSED` respeta una pausa previa, `removeAttribute('crossorigin')` antes de `hls.attachMedia()`, la ventana de «Coming up» a 4 minutos, la cuenta atrás con un decremento distinto, recursos base `de`/`sv`/`ru`/`pt`/`nl` y «min» sin plural en `en-US` → los 17 casos `currently` nuevos de Vitest en rojo (con algunos ya existentes, como se espera).

**Mutación de comprobación de los e2e**, con la aprobación del usuario (el clasificador de permisos la había bloqueado), temporal y revertida (`git checkout` de los fuentes y `vite build`; `player/dist/` idéntico a HEAD): sin *spinner* al cargar, sin `disableRestoreFocus` en los dos modales, parpadeo de 3 ciclos, `component="h3"` en «Broadcast Times», el reloj abajo, «Cancel sleep mode» sin acción, el temporizador sin limpiarse al pausar, `navigator` primero en la detección, `showSupportNotice: false`, `lang="en"` en `#root`, una fuente UTC propia para `dashjs`, sin `setStatus('error')` en el error de `dashjs` y sin `crossOrigin` en el OGG → los 16 e2e nuevos en rojo en Chromium y WebKit (32); con el build restaurado, los 32 en verde.

## 5. Descartados

- Contraste de «On Air» a mitad del parpadeo (`opacity: 0.4`): axe no da violación con la animación parada al 50 % en los dos modales.
- `color-contrast` de «Connecting...» en WebKit durante la carga: es el texto a media opacidad de su parpadeo, el mismo caso que K60.
- Botón del temporizador sin `aria-haspopup`/`aria-expanded`: el menú se anuncia al abrirse y funciona con teclado; mejora, sin incumplimiento claro de 4.1.2.
- `aria-valuetext` del volumen («0.47» frente a «47 %»), la cuenta atrás y el cambio de programa sin anuncio, el nombre de los diálogos con «Close», `alt` redundantes en las tarjetas, tarjetas sin lista ni encabezado, «Show more» genérico, «Back to today» sin mover el foco, botones deshabilitados sin explicación, diferencia horaria sin unidad: mejoras de a11y sin incumplimiento AA medido; para el triage o la spec 0005.
- `prefers-reduced-motion` no respetado fuera del parpadeo: 2.3.3 es AAA.
- Foco visible que depende de la regla `button:focus` de `index.css` y foco de los `MenuItem` poco marcado: hoy se ve; riesgo para el refactor, no bug.
- Contraste de los 8 temas y objetivos táctiles (2.5.8): pasan.
- Canvas con nombre «Audio Visualizer» también parado (`opacity: 0`): parte de C15 (canvas), zona congelada.
- El modal de programas lista los horarios desde el domingo (el resto del plugin, desde el lunes): ya fijado en `program-schedule.test.ts` (`lists slots by day from Sunday…`); orden de presentación sin contrato en `SPEC.md`.
- Dos `play()` concurrentes con HLS dejan vivo el primer `Hls`: no se pudo fijar (con dos `import()` concurrentes el segundo recibe el `hls.js` real en Vitest) ni se ha visto en e2e; sospecha para el triage.
- `pause()` durante la carga de un MP3 da «Unable to play» por el `AbortError` de `play()`: el *fake* no lo reproduce y no se ha medido en navegador; sospecha.
- `play()` fuera del gesto con `hls.js` en Safari (`NotAllowedError`): el WebKit de Playwright no aplica la política de *autoplay*; prueba manual.
- Temporizador de sueño con la pantalla bloqueada en iOS: depende de un dispositivo; queda como límite de K66.
- Media Session que borra metadatos y *handlers* en cada cambio de estado, y `idle`/`error` anunciados como `paused`: sin efecto visible medido.
- `100vh` y controles bajo la barra de Safari de iOS: no se puede medir sin un dispositivo.
- Desmontaje durante el `import()` de `hls.js`: inalcanzable (el dashboard nunca se desmonta).
- `use-config` sin validar la forma de programas y horario, `streamUrl` vacío, sin ErrorBoundary: PHP siempre emite listas y URL (`SPEC.md` §3.3); robustez para la spec 0006.
- `:` añadidos fuera de `t()` y diferencia horaria con punto decimal: mejoras de i18n sin bug visible con las traducciones actuales (como en las zonas 3 y 4); spec 0005.
- `timezoneOffset` limitado a −12…14 en `use-config.tsx`: cubre todas las zonas reales.
- Errores de `tsc` estricto, `set-state-in-effect` de React Hooks 7 y avisos de ESLint en `player/coverage/`: ruido (§1).
