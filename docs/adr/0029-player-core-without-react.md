# ADR 0029 — Núcleo del player en `src/core/` sin React

- Estado: aceptado · Fecha: 2026-10-21 · Spec: 0006 (fase 1) · D2 enmendado para `useAudioPlayer()` por el [ADR 0030](0030-audio-hook-keeps-react-render-priorities.md)

## Contexto
La lógica del player vive dentro de los hooks y de los componentes. `hooks/use-audio-player.tsx` (364 líneas) mezcla en `useCallback` y `useEffect` la detección del protocolo, la carga de `hls.js` y `dashjs`, el `crossOrigin`, la bienvenida y un estado repartido entre `useState` y cinco refs. La cuenta atrás del sueño está en `SleepMode.tsx`, con cinco efectos que se sincronizan con el padre. El reloj por minuto se repite en `use-program-schedule` y `use-transmission-time`, y la lectura de las globales (`use-config`) solo se prueba montando un hook. Quedan seis excepciones de `react-hooks` 7 de la 0003 que remiten a la 0006 (`dashboard/index.tsx`, `SleepMode.tsx`, `use-program-schedule.tsx`, `use-is-ios.tsx` y dos en el `Harness` de `use-audio-player.test.tsx`), y `utils/timezone.ts` lee `process.env.NODE_ENV` cuatro veces.

La 0007 (reproducción) necesita una máquina de estados del audio que se pruebe sin React, y la 0009 y la 0011 tocan el horario y la interfaz. La 0006 separa la lógica de React sin cambiar el comportamiento (ADR 0017: caracterización y strangler), igual que la 0005 hizo en PHP (ADR 0028).

Las decisiones D1–D7 las tomó el usuario en la sesión de diseño de la spec (2026-10-21) o salen del triage de la 0002 (tarea 5.3). La corrección de A4 y D5 la decidió el usuario al planificar la fase 1 (2026-10-21).

## Decisión
- **D1 · Núcleo e inyección de dependencias.** La lógica vive en `player/src/core/<zona>/` (`config`, `clock`, `schedule`, `audio`, `media-session`, `sleep`), en TypeScript sin React, MUI ni i18next, con su test al lado (`*.test.ts`). Recibe como parámetro lo que no es suyo: el `HTMLAudioElement`, `navigator.mediaSession`, el *user agent*, el reloj (`now()`, `setTimeout`/`setInterval` y sus `clear*`, con los globales por defecto), los cargadores de `hls.js` y `dashjs` y los textos ya traducidos. Los tests usan *fakes*, sin `vi.mock` de módulos. Los `import('hls.js')` e `import('dashjs')` viven en el núcleo como cargadores por defecto, para que sigan siendo *chunks* aparte.
- **Frontera verificable.** Un bloque de `player/eslint.config.js` para `src/core/**` prohíbe con `no-restricted-imports` `react`, `react-dom` (y sus subrutas), `@mui/*`, `@emotion/*`, `i18next`, `react-i18next`, `src/config/i18n`, `src/hooks/*` y `src/components/*`, y con `no-restricted-globals` `window`, `document`, `navigator` y `localStorage`. El núcleo sí puede importar `src/utils/` y `src/types/`.
- **D2 · Estado.** Una función de transición pura (`(estado, evento) → estado`) por máquina y un controlador por zona que ejecuta los efectos (asignar `src`, `play()`, crear `Hls`…) y publica una instantánea inmutable con `subscribe()`/`getSnapshot()`. Los hooks la leen con `useSyncExternalStore`. `getSnapshot()` devuelve la misma referencia mientras no cambie nada; los temporizadores arrancan con el primer suscriptor y paran con el último, así que `StrictMode` (suscribir, desuscribir, volver a suscribir) deja uno solo. Sin librerías de estado.
- **Adaptadores.** Los hooks conservan su firma y su valor devuelto; los componentes solo pintan. La validación de las globales pasa a `src/core/config/` (una función pura que recibe los valores crudos); `use-config.tsx` lee `window.RADPLAPAG_*` una vez por montaje, se los pasa y expone el resultado (`SPEC.md` §3.8). El núcleo no lee `window`.
- **`src/core/` es interno**, como el namespace `RadioPlayerPage\` en PHP: el contrato sigue siendo el de `SPEC.md` §3.3 (globales), §3.8 y §3.9.
- **D3 · `src/utils/` se queda** donde está, con sus tests y sus firmas; el núcleo lo importa. La 0009 corrige el horario en `src/utils/program-schedule.ts`.
- **D4 · `useIsIOS()`** sigue devolviendo `false` en el primer render (K13, de la 0007). Su `eslint-disable` de `set-state-in-effect` se queda con el motivo «K13, spec 0007»; es la única excepción de `react-hooks` que sobrevive a la 0006.
- **D5 · Líneas de test que se pueden editar**, sin cambiar ninguna aserción: el `Harness` de `use-audio-player.test.tsx` (sus dos excepciones `immutability`/`refs`) y `vi.stubEnv('NODE_ENV', 'development')` → `vi.stubEnv('DEV', true)` en `timezone.test.ts`, al pasar `timezone.ts` a `import.meta.env.DEV`. El `NodeJS.Timeout` de `SleepMode.tsx` pasa a `ReturnType<typeof setInterval>`. `"types": ["node"]` se queda en `tsconfig.app.json`: los tests de caracterización `utils/timezone.test.ts` y `hooks/use-transmission-time.test.tsx` usan `process.env.TZ` y no se editan. Por eso A4 comprueba `process.env` solo en el código publicado (`grep -rn "process.env" player/src --exclude='*.test.*'` vacío).
- **D6 · Correcciones.** K9 (`formatTimeInTimezone` con un offset no finito usa su reserva, la hora local del navegador), K14 (la extensión del *artwork* sale del `pathname`) y K70 (las rutas `hls.js` y `dashjs` dejan `crossOrigin` en `null`, ADR 0004) se corrigen en la 0006 con `fix-bug`. El resto de bugs de `docs/known-issues.md` se conserva y se replica en el núcleo como `currently`.
- **D7 · Serialización de `play()`/`pause()`.** El controlador del audio serializa las llamadas para responder a las dos sospechas de concurrencia del triage (dos `play()` con HLS, `pause()` durante la carga de un MP3), solo si el resultado visible coincide con el de una única llamada. Si cambiara algo visible, se para y se pregunta, y la corrección pasa a la 0007.
- **Cobertura.** `vitest.config.ts`: `src/core/**` ≥ 90 % de líneas y ≥ 85 % de ramas; `src/hooks/**` ≥ 85 % de líneas; `src/utils/**` ≥ 90 % de líneas.

## Consecuencias
- La lógica se prueba sin montar React y con el tiempo controlado: el minuto exacto, la medianoche, el horario de verano y los desfases negativo y fraccionario.
- `useSyncExternalStore` da el valor en el primer render, sin el render intermedio de `useState` + efecto. Ningún test de caracterización lo distingue hoy; si uno lo nota, se arregla el adaptador, nunca el test.
- Los adaptadores y el `<audio>` se enganchan con `attach`/`detach` idempotentes, por `StrictMode` (`main.tsx`).
- El bundle principal puede crecer un poco con el núcleo: tabla del gzip antes y después en el PR; más de un 10 % se pregunta. `manifest.json` vigila que `hls` y `dash` sigan siendo `isDynamicEntry`.
- Lo protegen la regla de ESLint (con su mutación en la 1.2), los umbrales de cobertura, los tests de caracterización de los hooks sin cambios y los e2e en las dos puntas.
- Un componente o un hook nuevo no debe meter lógica de estado ni temporizadores: va al núcleo.

## Alternativas descartadas
- **XState u otra librería de estado:** dependencia de runtime (exige ADR) para máquinas pequeñas que una función de transición resuelve.
- **`vi.mock` de módulos en lugar de inyección:** acopla los tests a la ruta de los módulos y no permite cambiar el reloj o los cargadores por caso.
- **Mover `src/utils/` al núcleo:** ya es puro y tiene sus tests; moverlo cambia rutas e importaciones sin ganar nada y choca con la 0009.
- **Mantener `useState` + `useEffect` con un reloj extraído:** deja las excepciones de `set-state-in-effect` y el render intermedio sin resolver.
- **Quitar `"types": ["node"]` y editar `process.env.TZ` en los tests:** edita tests de caracterización fuera de las líneas aprobadas (D5).

Evidencia: [`spec.md`](../specs/0006-player-refactor/spec.md) §4.1–§4.6; plan de la fase 1 [`phase-1.md`](../specs/0006-player-refactor/phase-1.md) (contexto medido y tarea 1.1).
