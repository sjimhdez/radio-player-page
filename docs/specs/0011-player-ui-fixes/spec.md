# Spec 0011 — Correcciones: interfaz, i18n y accesibilidad del player

> Estado: **propuesta** · Fecha: 2026-10-24 · Rama: `spec/0011-player-ui-fixes` · Depende de: 0006, 0007
>
> Contexto y decisiones comunes: [`docs/specs/README.md`](../README.md). Contrato del producto: [`SPEC.md`](../../../SPEC.md). Docs en español; código, comentarios y commits en inglés.

## 0. Cómo usar este documento

Esta spec se escribió en una sesión de diseño y **se ejecuta en una sesión nueva** que no conoce esa conversación.

1. Lee `docs/status.md`, esta spec, los ADRs 0018, 0023, 0025, 0027, 0029, 0030, 0031, 0033, 0034, 0035 y 0036, `SPEC.md` §3.8 y §3.9, `.claude/rules/player.md`, `visualizers.md` y `testing.md`, y las filas C6, C15, K55–K62, K68, K69, K83, AX1, AX2 y AX6 de `docs/known-issues.md`. Su columna «Decisión del usuario» es el mandato, con las precisiones de §4.
2. Cada fase empieza con `start-phase` (plan en `docs/specs/0011-player-ui-fixes/phase-N.md`, aprobado en plan mode) y termina con `close-phase`.
3. Si algo de esta spec resulta falso al contrastarlo con el código, o una decisión la contradice: **para y pregunta**. Si se confirma el cambio, `write-adr` y esta spec se actualiza en el mismo commit.
4. Cada fila se corrige con `fix-bug`: su test `currently` pasa a test de regresión, se ve en rojo y luego en verde, y la fila pasa a «corregido (spec 0011)». Los ADRs de §3 se escriben **antes** de la primera corrección que deciden.
5. La lógica va en `player/src/core/` (sin React ni MUI, ADR 0029); los componentes de `components/dashboard/` solo pintan. **Zona congelada** (ADR 0018, 0031): `components/visualizers/**`, `config/visualizers.ts` y `types/visualizers.tsx` no se tocan; `forceVerticalCenter` se sigue leyendo de la configuración tal cual.
6. Ningún test de caracterización se edita para que pase, salvo las excepciones de §4.6. Si cae otro, se para y se pregunta.
7. Fuera de alcance: C5 y el canvas de C15 (zona congelada), C8 (replicar), volver a `useSyncExternalStore` en `useAudioPlayer()` (ADR 0030 se queda, decisión del usuario), los textos de `README.md` y `readme.txt` (release, K3 y K28).

## 1. Contexto y objetivo

El triage de la 0002 (5.4–5.5) dejó en la interfaz del player una fila alta, seis medias y ocho bajas, todas en `components/dashboard/` y `config/i18n.ts`. La alta es **K56**: al pulsar Play con el teclado el botón se desmonta y el foco cae a `body` en cada carga. Las medias: un *spinner* sin nombre y una carga que no se anuncia (AX6, K59), modales que no devuelven el foco (K57), animaciones infinitas (K60), variantes regionales que salen en inglés (K68) y `alt` literales (C15). Las bajas: «Show more» sin descripción larga (C6), el foco al cancelar el sueño (K58), una maqueta en posición absoluta que se solapa a 320 × 256 (K61) y no tiene *landmarks* (AX1), el inglés de reserva marcado con el idioma del sitio (K62), «1 minutes» (K69) y encabezados que saltan niveles en los modales (AX2). Se suma **K83** (decisión del usuario, 2026-10-24): durante el reintento de C1 el núcleo publica `error` sin `loading`, la condición del error visible.

Al cerrar la spec, todas estas filas están corregidas con su test de regresión, K55 pasa a test normal, la línea base de axe del player queda sin `region`, `heading-order` ni `aria-progressbar-name`, y `SPEC.md` §3.8 recoge el idioma y la interfaz accesible con los ADRs 0050 y 0051.

**No objetivos:** rediseñar el aspecto (colores, tipografía, iconos; la maqueta cambia de técnica, no de composición); traducir cadenas nuevas más allá de las formas plurales de K69 y los `alt` de C15; tocar el núcleo del audio salvo K83.

## 2. Criterios de aceptación

**Fase 1 — Foco, estado y error**

- **Línea base (primera tarea):** `tests/e2e/a11y.spec.ts` gana los escenarios `player · loading` (stream retenido, como el `currently` de AX6) y `player · all-programs modal expanded` (primer «Show more»). Sus violaciones de hoy (`aria-progressbar-name`, `heading-order` del `h5`) entran en `a11y-baseline.json` con la decisión del usuario apuntada en el plan (ADR 0023), en los dos proyectos.
- **ADR 0051** aceptado y `SPEC.md` §3.8 al día (línea «Interfaz accesible») antes de K56.
- **K56 (alta):** el botón de Play/Pausa no se desmonta: con `loading` pinta el *spinner* dentro del mismo botón. Regresión en `tests/e2e/player-a11y.spec.ts` (el foco sigue en el botón tras Play con Enter y cuando sale Pausa) y en un test nuevo `components/dashboard/PlayerControls.test.tsx` (mismo nodo en `idle` → `loading` → `playing`). Con la bienvenida, el botón usa `aria-disabled` y conserva el foco.
- **AX6 + K59 (media):** ninguna `progressbar` sin nombre (axe `aria-progressbar-name` en el escenario `player · loading`, que sale de la línea base) y «Connecting...» dentro de una región `role="status"` montada siempre. Regresión: el `currently` de AX6/K59.
- **K83 (baja):** durante el reintento sin `crossOrigin` de C1 la instantánea nunca es `{ status: 'error', loading: false }`; la secuencia es `idle/loading → playing`. Regresión: el `currently` de `audio-controller.test.ts` y los e2e de C1 de `cross-origin.spec.ts` siguen en verde.
- **K57 (media):** al cerrar cualquiera de los dos modales (Escape o «Close») el foco vuelve al botón que lo abrió. Regresión: los dos `currently` de K57.
- **K58 (baja):** al cancelar el temporizador el foco va a «Sleep mode»; al llegar a cero con el foco en él, al botón de Play. Regresión: el `currently` de K58 y un caso de cuenta a cero en `player-a11y.spec.ts` (con `page.clock`).

**Fase 2 — Idioma y textos**

- **ADR 0050** aceptado y `SPEC.md` §3.8 (línea «i18n») al día antes de K68.
- **K68 (media):** `de-AT`, `de-CH`, `pt-PT`, `nl-BE`, `sv`, `ru` (y en general cualquier variante sin recurso propio) salen en su idioma base (`de-DE`, `pt-BR`, `nl-NL`, `sv-SE`, `ru-RU`); `es-AR` sigue en `es`; un idioma sin traducción sigue en `en-US`. Regresión: el `currently` de `config/locales.test.ts`, más un e2e en `i18n.spec.ts` con el sitio en `de_AT`. El detector deja de leer `localStorage` y `navigator` y de escribir `i18nextLng` (ADR 0025), y el comentario de `config/i18n.ts` describe lo que hace.
- **K62 (baja):** la interfaz del player lleva el `lang` del idioma que usa (`en` o `en-US` en la reserva), **también los modales, el menú y los *tooltips*** (portales fuera de `#root`, §4.3). Regresión: el `currently` de `i18n.spec.ts` (con el sitio en `eu`, el diálogo abierto tiene un ancestro con `lang` inglés).
- **K55:** su `currently` de `i18n.spec.ts` se renombra como test normal (`uses the site language, never the browser language (K55)`), sin cambiar sus asserts.
- **K69 (baja):** «Coming up» interpola `count` con las formas plurales de cada locale (`_one`/`_other`, y `_few`/`_many` donde las tenga `Intl.PluralRules`: `cs`, `hr`, `ru-RU`, `ro-RO`). Regresión: el `currently` de `locales.test.ts` («(in 1 minute)») y un test por locale con plurales de más de dos formas que comprueba que existen todas las claves que pide `Intl.PluralRules`.
- **C15 (media):** el fondo y el avatar del programa son decorativos (`alt=""`); el logo lleva un `alt` traducido con el nombre de la emisora (`dashboard.stationLogo`: «%s logo»). Regresión: el `currently` de `a11y.spec.ts`. El canvas no se toca.

**Fase 3 — Maqueta y movimiento**

- **K61 + AX1 (baja):** la maqueta va en flujo: cabecera (reloj), `main` (información de la emisora y el canvas) y una región con nombre para los controles, con `min-height: 100dvh` (§4.4). Regresión: el `currently` de K61 (a 320 × 256 el reloj no tapa el `h1` ni el programa la barra de controles; la página puede desplazarse) y los escenarios `player · stopped` y `player · playing` sin entradas `region`. **Verificación manual:** capturas antes y después (1280 × 800, 390 × 844, 320 × 256; parado, cargando, sonando con visualizador y con animación estática) en el PR, revisadas por el usuario.
- **K60 (media):** «On Air» (los dos modales) y «Connecting...» no parpadean; los puntos de «sonando» solo se animan mientras suena (Pausa los para) y con `prefers-reduced-motion: reduce` nada se anima. Regresión: los dos `currently` de K60 (sin animaciones infinitas de `scheduleLiveBlink`) y un e2e con `page.emulateMedia({ reducedMotion: 'reduce' })` que no encuentra animaciones en curso sonando.
- **C6 (baja):** «Show more» solo sale con descripción extendida; los horarios del programa se ven siempre. Regresión: el `currently` de `modals.spec.ts` (programa H).
- **AX2 (baja):** ningún salto de nivel en los modales: los días del horario y «Broadcast Times» cuelgan del `h2` del diálogo. Regresión: el `currently` de AX2 y los escenarios `player · schedule modal` y `player · all-programs modal expanded` sin `heading-order`.

## 3. Cambios al contrato (`SPEC.md`)

Ninguno en las globales, las funciones `radplapag_*`, los bloques ni la página limpia (§3.3 no cambia: el `<html lang>` sigue siendo el del sitio). Cambia el comportamiento visible del player (§3.8):

| Cambio | ADR previsto | Fase |
|---|---|---|
| **i18n:** una variante regional sin recurso cae en su idioma base (`de-AT` → `de-DE`, `pt-PT` → `pt-BR`…); la interfaz del player lleva el `lang` del idioma en que sale; sin `localStorage` ni `navigator` en la detección. Completa el ADR 0025, no lo cambia. | 0050 | 2 |
| **Interfaz accesible:** botón de Play/Pausa estable (con `loading`, el *spinner* va dentro y el botón pausa, que cancela la carga como ya dice §3.8); estado de carga en una región `role="status"`; foco devuelto al cerrar los modales y el temporizador; maqueta en flujo con *landmarks*; sin animaciones infinitas fuera de los puntos de «sonando» y ninguna con `prefers-reduced-motion`; «Show more» solo con descripción extendida. | 0051 | 1 (se aplica en 1 y 3) |

K83 no cambia el contrato: §3.8 ya dice que el error se muestra si el stream falla, y el reintento no es un fallo.

## 4. Diseño

### 4.1 Botón estable, región de estado y foco (fase 1)

- `PlayerControls` pinta siempre un solo `IconButton`. Icono y nombre: `idle`/`paused`/`error` → Play; `playing` o `loading` → Pausa (con `loading`, el icono es un `CircularProgress` con `aria-hidden`, del mismo tamaño que hoy, para que el botón no cambie de tamaño). Durante la bienvenida (`introLocked`), `aria-disabled="true"` y el clic no hace nada, en lugar de `disabled`, que saca el foco. El *tooltip* sigue al nombre.
- La región `role="status"` vive en `StreamInfo`, montada siempre; su contenido es «Connecting...» con `loading && !isPlaying` y vacío si no. El texto visible y el anunciado son el mismo nodo. El error sigue en el `Snackbar`/`Alert` (`role="alert"`).
- K57: quitar `disableRestoreFocus` de los dos `Dialog`. Vigilar que el *tooltip* del botón no se quede abierto al recibir el foco (riesgo 3).
- K58: `Dashboard` guarda una referencia al botón «Sleep mode» y otra al de Play/Pausa (`forwardRef` o `ref` como prop). Al cancelar, el foco va a «Sleep mode»; al llegar a cero, si el foco estaba dentro de `SleepTimer`, va al de Play/Pausa (el de sueño queda deshabilitado tras la pausa).

### 4.2 K83 (fase 1)

En el núcleo (`core/audio/audio-controller.ts`, `player-machine.ts`): el `error` del primer intento de una fuente directa con `crossOrigin` que **va a reintentarse** no se despacha como `error`; el estado sigue en carga hasta el `playing` del reintento o su propio fallo. El orden de los eventos (`error` del elemento antes del rechazo de `play()`) obliga a decidir el reintento antes de publicar, o a aplazar el `error` del elemento hasta saber si hay reintento: lo decide el plan, con TDD sobre el *fake*. Los e2e de C1 (`cross-origin.spec.ts`) y K1 deben seguir en verde en Chromium y WebKit.

### 4.3 Idioma (fase 2)

- K68: el idioma base sale de la etiqueta (`de-AT` → `de`) y se asigna al recurso de ese idioma que existe (`de` → `de-DE`, `pt` → `pt-BR`, `nl` → `nl-NL`, `sv` → `sv-SE`, `ru` → `ru-RU`, `ro` → `ro-RO`, `da` → `da-DK`, `it` → `it-IT`, `gl` → `gl-ES`). La tabla se deriva de los recursos (no a mano) y se testea; `es` ya existe. Con i18next puede ser un `fallbackLng` por idioma o la resolución antes de `init`: lo decide el plan, con el test primero. Los alias `de_DE`, `pt_BR`, `it_IT` se conservan si siguen haciendo falta (el `lang` de WordPress usa guion; comprobarlo).
- K62: `lang` en el contenedor raíz del `Dashboard` **y** en los portales de MUI (`Dialog`, `Menu`, `Tooltip`), que se montan en `body`, fuera de `#root`. Candidatos: `container` de los portales hacia un nodo con `lang`, o `lang` en `slotProps` de cada uno. El valor es el idioma resuelto por i18next (`i18n.resolvedLanguage`) en formato BCP 47. Solo se imprime si difiere del `<html lang>`, o siempre: lo decide el plan.
- K69: `t('dashboard.upcomingInMinutes', { count })`; las claves `upcomingInMinutes_one`/`_other` (y `_few`/`_many`) en los 14 locales. Las formas las escribe la sesión de ejecución y el usuario las revisa en el PR (riesgo 5).

### 4.4 Maqueta (fase 3)

- `Dashboard`: rejilla de tres filas (`auto 1fr auto`) con `min-height: 100dvh` (Safari 17+, ADR 0027; `100vh` como reserva) y sin `100vw`. Arriba, el reloj (`TimezoneClock`) en flujo, alineado a la derecha; en medio, `<main>` con `StreamInfo` centrado, o arriba si suena con visualizador y sin `forceVerticalCenter` (la regla de hoy); abajo, `<section aria-label>` (nombre traducido, p. ej. «Player controls») con el temporizador, los botones y el volumen.
- El fondo y el canvas pasan a una capa fija detrás (`position: fixed; inset: 0`), dentro de `main` para que axe no marque `region`; el canvas conserva `role="img"`, su `aria-label` y la decisión de `canVisualize` (ADR 0031). Sus dimensiones siguen siendo las de la ventana.
- `StreamInfo` deja de medir su altura (`ResizeObserver` y `top` calculado) si la rejilla ya lo centra; la transición de posición puede perderse (se acepta; aparece en las capturas).
- Antes de tocarla, las capturas «antes» se toman con el `dist/` de `trunk` y se guardan fuera del repo.

### 4.5 Animaciones, modales y encabezados (fase 3)

- K60: fuera `scheduleLiveBlink` (el chip queda fijo) y el `blink` de «Connecting...». Los puntos solo existen con `isPlaying && !canVisualize` (ya es así). `@media (prefers-reduced-motion: reduce)` anula `animation` de los puntos y la transición de `Collapse`.
- C6: el botón y el `Collapse` solo con `programExtendedDescription`; la lista de horarios sale de `Collapse` y se pinta siempre bajo la descripción.
- AX2: `component="h3"` en los días del horario y en «Broadcast Times» (las variantes de MUI no cambian, así que el aspecto tampoco).

### 4.6 Tests que pueden cambiar (excepciones)

Con la aprobación del usuario apuntada en el plan, y solo en lo que se cita:

- `tests/e2e/mp3.spec.ts` (líneas con `getByRole( 'progressbar' )`, 132 y 250 al escribir esta spec): el estado de carga se localiza por el botón (nombre «Pause» con el *spinner*) o por la región de estado, si el *spinner* deja de exponer `progressbar`.
- `tests/e2e/a11y-baseline.json`: se reescribe con `RADPLAPAG_UPDATE_A11Y_BASELINE=1` en los dos proyectos; el diff solo quita entradas, salvo las dos altas de la primera tarea.
- Los selectores de los `currently` que pasan a regresión (p. ej. el ancestro `MuiPaper-root` del reloj en K61) pueden cambiar con la maqueta; los asserts no.

## 5. Fases

Cada fase termina con la CI en verde, sus criterios verificados y `close-phase` (a11y-reviewer y spec-conformance-reviewer como candidatos; el usuario los elige).

### Fase 1 — Foco, estado y error

- Escenarios nuevos de axe; ADR 0051 y `SPEC.md` §3.8; K56, AX6 + K59, K83, K57, K58.
- ✅ **Criterios:** los de la fase 1 de §2; `npm run check` y los e2e del player (Chromium y WebKit, en las dos puntas) en verde.

### Fase 2 — Idioma y textos

- ADR 0050 y `SPEC.md` §3.8; K68, K62, K55, K69, C15.
- ✅ **Criterios:** los de la fase 2 de §2; `locales.test.ts` y `i18n.spec.ts` en verde.

### Fase 3 — Maqueta y movimiento

- Capturas «antes»; K61 + AX1 (con el `100vh` de iOS), K60, C6, AX2; capturas «después» en el PR.
- ✅ **Criterios:** los de la fase 3 de §2; la línea base del player sin `region` ni `heading-order`; las capturas aprobadas por el usuario; nota de release (changelog y `== Upgrade Notice ==` de la 0011) en `docs/specs/README.md`.

## 6. Riesgos y preguntas abiertas

| # | Riesgo / pregunta | Mitigación | Cuándo |
|---|---|---|---|
| 1 | K83: el `error` del elemento llega antes del rechazo de `play()`, que es lo que decide el reintento hoy. Retrasarlo puede romper K1 o el orden de renders del ADR 0030. | TDD en el núcleo con el *fake*; los e2e de C1 y K1 en Chromium y WebKit antes de cerrar la tarea. Si exige cambiar el ADR 0030, parar y preguntar. | Fase 1 |
| 2 | Un `progressbar` dentro de un botón: ARIA trata sus hijos como presentacionales y Playwright puede no encontrarlo. | El *spinner* lleva `aria-hidden`; el estado lo anuncia la región `role="status"` (§4.1); excepción de §4.6. | Fase 1 |
| 3 | Con el foco devuelto (K57) el *tooltip* del botón se abre solo. | Comprobarlo en el e2e; si molesta, `disableFocusListener` solo tras el cierre o aceptar el *tooltip* (decide el usuario en el plan). | Fase 1 |
| 4 | Portales de MUI fuera de `#root` sin `lang` (K62). | Criterio explícito sobre el diálogo; el plan elige `container` o `slotProps`. | Fase 2 |
| 5 | Las formas plurales de 14 idiomas las escribe Claude. | Test de claves contra `Intl.PluralRules`; revisión del usuario en el PR. | Fase 2 |
| 6 | La maqueta en flujo cambia posiciones que el usuario conoce, y el visualizador dibuja por las dimensiones de la ventana. | Capturas antes y después aprobadas por el usuario; el canvas conserva las dimensiones de la ventana; smoke e2e de visualizadores sin editar. | Fase 3 |
| 7 | `a11y.spec.ts` «all-programs modal» ya es *flaky* en WebKit en la CI (`docs/status.md`); el escenario expandido puede heredarlo. | Esperar a que termine el `Collapse` antes de analizar; si falla, mirar la traza. | Fase 1 |

## Apéndice — Referencias

- Filas: `docs/known-issues.md` (C6, C15, K55–K62, K68, K69, K83, AX1, AX2, AX6).
- Auditoría de la zona 5: `docs/specs/0002-safety-net/audit/player.md`.
- Estados del audio que pinta la interfaz: ADR 0034 (`status`, `loading`), 0035 (`introLocked` y «Sleep mode»), 0036 (`volumeControllable`), 0031/0033 (`canVisualize`).
