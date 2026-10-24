# ADR 0051 — Interfaz accesible del reproductor

- Estado: aceptado · Fecha: 2026-10-24 · Spec: 0011 (fases 1 y 3; tarea 1.2)

## Contexto

- **K56 (media, prioridad alta).** Con `loading`, `PlayerControls` devuelve un `CircularProgress` suelto en lugar del botón: al pulsar Play con el teclado el botón se desmonta y el foco cae a `body` en cada `play()` y en cada `waiting` mientras suena (WCAG 2.4.3). Las tres ramas pintan dos `IconButton` distintos. Con la bienvenida, Pausa sale además `disabled`, que también saca el foco.
- **AX6 + K59 (media).** El *spinner* (`role="progressbar"`) no tiene nombre (axe `aria-progressbar-name`, seria) y «Connecting...» no está en ninguna región viva: la carga no se anuncia (WCAG 4.1.3).
- **K57 (media) y K58 (baja).** Los dos modales llevan `disableRestoreFocus` y al cerrarse el foco cae a `body`; «Cancel sleep mode» se desmonta al pulsarlo (o al llegar a cero) con el mismo resultado (WCAG 2.4.3).
- **K61 + AX1 (baja).** Toda la maqueta va en posición absoluta en un contenedor de `100vw × 100vh`: a 320 × 256 el reloj tapa el nombre de la emisora y el programa la barra de controles (WCAG 1.4.10), y no hay ningún *landmark* (axe `region`).
- **K60 (media).** «On Air» parpadea sin fin en los modales (`scheduleLiveBlink`), igual que «Connecting...» y los puntos de «sonando»; nada respeta `prefers-reduced-motion` (WCAG 2.2.2).
- **C6 y AX2 (baja).** «Show more» sale sin descripción extendida y esconde los horarios del programa; los encabezados de los modales saltan niveles (`h6` y `h5` bajo el `h2` del diálogo).
- `SPEC.md` §3.8 describe el comportamiento visible del reproductor, pero no dice nada de foco, anuncios ni maqueta; estas correcciones lo cambian, así que se fijan aquí antes de la primera (K56). Decisiones del usuario en las filas de [`known-issues.md`](../known-issues.md) (triage de la 0002, 5.4–5.5) y en la spec 0011 (§3, §4.1, §4.4, §4.5).

## Decisión

1. **Botón de Play/Pausa estable (K56).** `PlayerControls` pinta siempre **un solo** `IconButton`, que no se desmonta en ningún estado. Play en `idle`, `paused` y `error`; Pausa en `playing` y en `loading`. Con `loading`, el icono es un `CircularProgress` con `aria-hidden` y del mismo tamaño que el icono, y el botón lleva `aria-busy="true"`; pulsarlo pausa, que cancela la carga como ya dice §3.8 (ADR 0034). El *tooltip* sigue al nombre del botón.
2. **Bienvenida con `aria-disabled` (K56).** Mientras suena la bienvenida, el botón lleva `aria-disabled="true"` y el clic no hace nada, en lugar de `disabled`, para que conserve el foco. El resto de controles deshabilitados (p. ej. «Sleep mode», ADR 0035) siguen con `disabled` nativo.
3. **Región de estado (AX6, K59).** `StreamInfo` monta siempre una región `role="status"`; su contenido es «Connecting...» con `loading && !isPlaying` y vacío si no. El texto visible y el anunciado son el mismo nodo. Ninguna `progressbar` queda sin nombre (el *spinner* va oculto). El error sigue en el `Alert` (`role="alert"`).
4. **Foco devuelto (K57, K58).** Al cerrar el modal del horario o el de programas (Escape o «Close»), el foco vuelve al botón que lo abrió (sin `disableRestoreFocus`). Al cancelar el temporizador de sueño, el foco va a «Sleep mode»; si la cuenta llega a cero con el foco dentro del temporizador, va al botón de Play/Pausa («Sleep mode» queda deshabilitado tras la pausa). Si al recibir el foco por teclado MUI abre el *tooltip* del botón, se acepta (decisión del usuario, 2026-10-24).
5. **Maqueta en flujo con *landmarks* (K61, AX1; fase 3).** Rejilla de tres filas con `min-height: 100dvh` (`100vh` de reserva) y sin `100vw`: arriba el reloj; en medio `<main>` con la información de la emisora y la capa fija del fondo y el canvas; abajo una región con nombre traducido para los controles. La composición no cambia; el canvas conserva las dimensiones de la ventana, `role="img"`, su `aria-label` y la decisión de `canVisualize` (ADR 0031). A 320 × 256 nada se solapa y la página puede desplazarse.
6. **Movimiento (K60; fase 3).** Ninguna animación infinita salvo los puntos de «sonando», que solo existen mientras suena sin visualizador; «On Air» y «Connecting...» no parpadean. Con `prefers-reduced-motion: reduce` no se anima nada (tampoco la transición del `Collapse`). Los visualizadores son zona congelada (ADR 0018, 0031) y no entran.
7. **Modales (C6, AX2; fase 3).** «Show more» y su `Collapse` solo salen con descripción extendida; los horarios del programa se ven siempre. Los días del horario y «Broadcast Times» son `h3` bajo el `h2` del diálogo, con las mismas variantes de MUI (mismo aspecto).
8. **No cambian** las globales `window.RADPLAPAG_*`, los textos traducibles existentes (sale solo el nombre de la región de controles, fase 3), el `<html lang>` de la página limpia, los colores, la tipografía ni los iconos. El núcleo del audio no cambia por este ADR (K83 se corrige sin tocar el ADR 0030).

## Consecuencias

- El foco ya no se pierde al reproducir, al cerrar un modal ni al terminar el temporizador; la carga se anuncia y el escenario `player · loading` de axe pierde `aria-progressbar-name`. Al cerrar la spec, la línea base del player queda sin `region`, `heading-order` ni `aria-progressbar-name` (ADR 0023).
- Los tests que localizaban la carga por `getByRole('progressbar')` dejan de encontrarla: la excepción de la spec 0011 (§4.6, `mp3.spec.ts` 132 y 250–254) los pasa al botón «Pause» con `aria-busy="true"`. Playwright trata `aria-disabled="true"` como deshabilitado (`toBeDisabled()`), así que `intro.spec.ts` no cambia.
- La maqueta en flujo cambia posiciones que el usuario conoce y pierde la transición de posición de `StreamInfo`: capturas antes y después aprobadas en el PR de la fase 3.
- Hasta la fase 3, la maqueta sigue en posición absoluta, sin *landmarks*, y «Connecting...» y «On Air» siguen parpadeando: §3.8 lo indica.
- Lo protegen `player/src/components/dashboard/PlayerControls.test.tsx` (mismo nodo en `idle` → `loading` → `playing`, `aria-busy`, `aria-disabled`), `tests/e2e/player-a11y.spec.ts` (los `currently` de K56, AX6/K59, K57, K58, K60 y K61 pasan a regresión), `tests/e2e/a11y.spec.ts` con su línea base y `tests/e2e/modals.spec.ts` (C6).

## Alternativas descartadas

- **Mantener el *spinner* fuera del botón y mover el foco a mano al volver Play/Pausa:** el foco pasa por `body` en cada carga y un lector de pantalla lo anuncia; un nodo estable lo evita sin código de foco.
- **Darle nombre al `progressbar` dentro del botón:** los hijos de un botón son presentacionales en ARIA y el nombre no llegaría; la región `role="status"` anuncia el estado y el botón lo expone con `aria-busy`.
- **`disabled` durante la bienvenida:** saca el foco del botón (K56).
- **`aria-live` en el `Alert` o en el contenedor entero:** anunciaría también el programa y el reloj al cambiar; la región solo lleva el estado de la carga.
- **Arreglar el solape de K61 con más `position: absolute` y *media queries*:** no da *landmarks* y vuelve a solaparse con textos largos.

Evidencia: [spec 0011](../specs/0011-player-ui-fixes/spec.md) §3 y §4, [plan de la fase 1](../specs/0011-player-ui-fixes/phase-1.md), auditoría de la zona 5 (`docs/specs/0002-safety-net/audit/player.md`).
