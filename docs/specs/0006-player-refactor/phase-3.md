# Spec 0006 · Fase 3 — Media Session, sueño y dashboard
Estado: en curso · Inicio: 2026-10-21 · ADRs: 0004, 0013, 0017, 0018, 0021, 0029, 0030

## Contexto (medido al planificar)

- **Media Session:** `hooks/use-media-session.tsx` (115 líneas) hace todo en un `useEffect` (deps `title, logoUrl, onPlay, onPause, t, status`): metadatos (`title || t('dashboard.liveRadio')`, seis tamaños de *artwork* con el tipo por la extensión), `play`/`pause`, `playbackState` (`playing` o `paused`) y los cinco manejadores de búsqueda y pista a `null`. El *cleanup* borra los metadatos y `play`/`pause` (no `playbackState`). Si algo falla, avisa con `console.warn('Media Session API error:' | 'Media Session API cleanup error:', …)`. Lo fijan los 14 casos de `use-media-session.test.tsx` (spec 0002, 1.16), entre ellos el `currently` de K14. **Ningún e2e** mira Media Session (riesgo 5); solo `mp3.spec.ts` captura sus manejadores para K81 (envolviendo `MediaSession.prototype.setActionHandler`, porque WebKit ignora una propiedad propia).
- **Sueño:** la cuenta atrás vive en `SleepMode.tsx` (193 líneas, cinco efectos), que la sincroniza con `sleepTimerSeconds` de `dashboard/index.tsx` mediante `onTimerChange` y `externalTimerSeconds`. El intervalo se recrea en cada *tick* (deps `remainingSeconds`) y resta 1 por *tick* (K66). Pasar de `isPlaying` a falso con el temporizador activo lo borra (K65: el paso de la bienvenida al directo pasa por `paused`). Al llegar a 1, llama a `onSleepTimerEnd()` (`pause`). `SleepTimer.tsx` ya solo pinta (`remainingSeconds`, `onCancel`).
- **Lo que fija el sueño:** `sleep.spec.ts` (cuenta y pausa, pausa manual, cancelar, `currently` de K65) y `SleepMode.test.tsx` (`currently` de K66). Su `Host` monta `SleepMode` con las props de hoy. **Decisión del usuario (2026-10-21):** se reescribe solo el `Host`, que pasa a montar `SleepMode` sobre `useSleepTimer()`, sin tocar ni el nombre ni la aserción (`1799`). Es una ampliación de D5: el ADR 0029 y la spec se corrigen en la 3.1. Sin cobertura: las opciones de 60 y 120 min (`1:00:00`), volver a elegir con el temporizador activo y el botón deshabilitado sin reproducción.
- **Error visible:** `Dashboard` lo calcula en un efecto con `setOpenError(status === 'error' && loading === false)` (`eslint-disable`). Lo cubren los e2e (`cross-origin`: HLS/DASH sin CORS y K1; `intro`: la bienvenida rota sin error; `mp3`: K81), pero ningún test de componente (§4.4 lo pide antes de tocarlo).
- **Excepciones que quedan (A4):** `dashboard/index.tsx:167`, `SleepMode.tsx:130` y `use-is-ios.tsx:19`. La de iOS se queda (D4), pero su motivo dice «spec 0006 rewrites it» y A4 pide «K13, spec 0007».
- **Reutilizable:** `Clock`/`defaultClock` de `core/clock/minute-ticker.ts` (el reloj inyectable) y el `createFakeClock()` local de `core/clock/minute-ticker.test.ts`, que pasa a `src/test/fake-clock.ts`. El patrón `subscribe`/`getSnapshot` + `useSyncExternalStore` de `use-transmission-time.tsx`.

## Objetivo

Sacar Media Session y la cuenta atrás del sueño al núcleo (`core/media-session/`, `core/sleep/`) con TDD. `useMediaSession()` queda como adaptador con la misma firma, y `use-sleep-timer.tsx` es un hook nuevo sobre `useSyncExternalStore`. `SleepMode`, `SleepTimer` y `Dashboard` solo pintan, el error visible es un valor derivado y salen las dos últimas excepciones de `react-hooks` (la de iOS se queda, con su motivo). K14 corregido. K65 y K66 se conservan. Al final, el cierre documental de la spec.

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| A1 Comportamiento sin cambios | `npm --prefix player run check`; `npm run test:e2e` en `env:start:min` y `env:start:latest` (incluidos `sleep`, `media-session` (nuevo), `mp3`, `intro`, `cross-origin`, `player-a11y`, `a11y`, `modals`). `git diff origin/trunk -- 'player/src/**/*.test.*' tests/e2e` solo muestra las altas, las ediciones aprobadas (D5 y su ampliación: el `Harness`, `timezone.test.ts` y el `Host` de `SleepMode.test.tsx`) y los `currently` que pasan a regresión (K9, K70, K80, K14). Snapshots y `a11y-baseline.json` sin cambios |
| A2 Frontera | El bloque de `src/core/**` de ESLint cubre `core/media-session/**` y `core/sleep/**`; `grep -rn "eslint-disable" player/src/core` vacío |
| A3 Cobertura | `npm --prefix player run test:coverage`: `src/core/**` ≥ 90 % líneas y ≥ 85 % ramas; `src/hooks/**` ≥ 85 % líneas; `src/utils/**` ≥ 90 % |
| A4 | `grep -rn "eslint-disable" player/src` solo da `use-is-ios.tsx` con «K13, spec 0007»; `grep -rn "process.env" player/src --exclude='*.test.*'` vacío |
| A5 Assets y bundle | `npm run check:zip`; `hls.mjs` y `dash.all.min.js` con `isDynamicEntry: true` en `manifest.json`; tabla del gzip frente a `origin/trunk` (`gzip -9` de macOS) en la 3.10 y en el PR. Si un archivo crece más de un 10 %, se pregunta |
| A6 Zona congelada | El `git diff origin/trunk` de los archivos de §3.9 está vacío |
| A7 (K14) | El `currently` de K14 pasa a regresión (rojo y después verde); la fila pasa a «corregido (spec 0006)» |
| A9 Revisión visual | Manual, en <http://localhost:8886>: se apunta en «Verificación manual pendiente» de `docs/status.md` (3.11) hasta que el usuario la apruebe |

## Tareas

### 3.1 Ampliación de D5: el `Host` de `SleepMode.test.tsx` (≤ 1 h)
- Qué: en el ADR 0029 (D5) y en la spec (§4.1 D5, §0.3), se añade la edición aprobada del `Host` de `SleepMode.test.tsx`: solo cambia cómo se monta (`SleepMode` sobre `useSleepTimer()`), no el nombre ni la aserción. Decisión del usuario, 2026-10-21.
- Archivos: `docs/adr/0029-player-core-without-react.md`, `docs/specs/0006-player-refactor/spec.md`.
- Test: —
- Verificación: `npm run check`
- Resultado: D5 ampliado con el `Host` de `components/dashboard/SleepMode.test.tsx` (monta `SleepMode` sobre `useSleepTimer()`; nombre y aserción `1799` intactos) en el ADR 0029 (estado, contexto, D5 y evidencia) y en la spec (§0.3, D5 y su origen). `npm run check` en verde.
- [x] hecha · commit: `d2e5c0e`

### 3.2 Caracterización e2e de Media Session (≤ 1 h)
- Qué: `tests/e2e/media-session.spec.ts` (Chromium y WebKit), contra el hook de hoy. Un `addInitScript` envuelve `MediaSession.prototype.setActionHandler` (como `mp3.spec.ts`; si hace falta, se saca a `tests/e2e/support/player.ts` sin cambiar el de `mp3`). Casos:
  - Con la emisora con logo: `metadata.title` es el nombre de la emisora y `artwork` tiene seis tamaños con el tipo del logo.
  - `playbackState` es `paused` al cargar, `playing` tras Play y `paused` tras Pause.
  - `play`/`pause` registrados y los cinco de búsqueda y pista a `null`. El `play` capturado arranca la reproducción y el `pause` capturado la para.
- Archivos: `tests/e2e/media-session.spec.ts` (y `tests/e2e/support/player.ts` si hace falta).
- Test: caracterización. Se ve fallar con una mutación temporal del hook (por ejemplo, `playbackState` siempre a `paused`, o el *artwork* vacío), que se revierte con `dist/` restaurado.
- Verificación: `npm run check && npx playwright test tests/e2e/media-session.spec.ts`
- Resultado: cuatro casos en `tests/e2e/media-session.spec.ts` sobre la emisora `mp3` (logo JPG): metadatos (título «E2E MP3» y seis tamaños `image/jpeg` con el `logoImage`), `playbackState` (`paused` → `playing` → `paused`), los siete manejadores (`play`/`pause` funciones, los cinco de búsqueda y pista puestos a `null`) y Play/Pausa desde los manejadores capturados. La captura se queda local en el archivo (no hizo falta sacarla a `support/player.ts`; `mp3.spec.ts` intacto). 8/8 en Chromium y WebKit. Mutación (`playbackState` fijo a `paused`, *artwork* vacío, sin `seekto`, `play` → `onPause`): 8/8 en rojo; revertida con `dist/` restaurado. `npm run check` en verde.
- [x] hecha · commit: (este)

### 3.3 Caracterización del `Dashboard`: error visible y sueño (≤ 1 h)
- Qué: `components/dashboard/index.test.tsx` contra el componente de hoy, con `useAudioPlayer` sustituido por un doble controlable (`vi.mock` del hook; los dos hooks de visualización también, sin editarlos). Casos:
  - Error: `error` con `loading` falso muestra la alerta; con `loading` verdadero no; `playing` no; de `error` a `paused` se oculta.
  - Sueño: sin reproducción, «Sleep mode» deshabilitado. «1 hour» muestra `1:00:00` y «2 hours» `2:00:00`. Volver a elegir con el temporizador activo reinicia la cuenta. Al pasar a `paused`, desaparece. Al llegar a cero, `pause` se llama una vez.
  - Las etiquetas exactas se leen de `en-US.json` al escribir el test.
- Archivos: `player/src/components/dashboard/index.test.tsx`.
- Test: caracterización. Mutaciones (revertidas): sin `loading === false`, y sin la limpieza por `!isPlaying` de `SleepMode`.
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

### 3.4 `core/media-session` por TDD y `useMediaSession()` como adaptador (≤ 1 h)
- Qué: `core/media-session/media-session.ts`:
  - `mimeTypeFor(url)` y `artworkFor(logoUrl)`, que conservan K14 por ahora (con su `currently` replicado en el núcleo).
  - `applyMediaSession(deps, state)`, que devuelve el *cleanup*. `deps = { session, createMetadata }`, y `state = { title, logoUrl, onPlay, onPause, status }` con el título ya traducido. Los dos `console.warn` se conservan con el mismo texto.
  - El hook mantiene la comprobación `'mediaSession' in navigator`, el título de reserva con `t()` y las mismas deps del efecto. Llama a `applyMediaSession` y devuelve su *cleanup*.
- Archivos: `player/src/core/media-session/media-session.ts`, `media-session.test.ts`, `player/src/hooks/use-media-session.tsx`, `player/dist/`.
- Test: primero (TDD), en `core/media-session/media-session.test.ts`, con un `MediaSession` *fake*. Los 14 casos del hook, sin tocar.
- Verificación: `npm --prefix player run check && npm --prefix player run build && npx playwright test tests/e2e/media-session.spec.ts`
- [ ] hecha · commit: —

### 3.5 K14: el tipo del *artwork* por el `pathname` (≤ 1 h)
- Qué: `fix-bug`. El `currently` del hook (`currently reports %s as image/png`) y su réplica del núcleo pasan a regresión: `logo.jpg?ver=2` da `image/jpeg` y `logo.webp#x` da `image/webp`. Primero en rojo. Arreglo mínimo en `mimeTypeFor()`: se quita lo que va desde `?` o `#` antes de leer la extensión. Fila K14 → «corregido (spec 0006)».
- Archivos: `player/src/core/media-session/media-session.ts`, `media-session.test.ts`, `player/src/hooks/use-media-session.test.tsx` (solo el `currently` de K14), `docs/known-issues.md`, `player/dist/`.
- Test: regresión primero, en rojo.
- Verificación: `npm --prefix player run check && npm --prefix player run build`
- [ ] hecha · commit: —

### 3.6 `core/sleep/sleep-timer` por TDD (≤ 1 h)
- Qué:
  - `createFakeClock()` pasa de `minute-ticker.test.ts` a `src/test/fake-clock.ts` (solo se mueve).
  - `createSleepTimer({ onEnd, clock = defaultClock })` → `{ start(seconds), cancel(), setPlaying(playing), subscribe, getSnapshot }`. La instantánea es `remainingSeconds: number | null`.
  - Un solo `setInterval` de 1000 ms mientras está activo y tiene suscriptores. Con el último `unsubscribe`, se cancela.
  - `start()` reinicia la cuenta y el intervalo. Cada *tick* resta 1. Al llegar a 1, llama a `onEnd()` y vuelve a `null`.
  - `setPlaying(false)` con el temporizador activo cancela sin llamar a `onEnd`. `getSnapshot()` es estable.
  - `currently` replicados: K66 (cuenta *ticks*: con `now()` adelantado 29 min, un *tick* da 1799) y K65 (cualquier `setPlaying(false)` cancela, también el paso de la bienvenida al directo).
- Archivos: `player/src/core/sleep/sleep-timer.ts`, `sleep-timer.test.ts`, `player/src/test/fake-clock.ts`, `player/src/core/clock/minute-ticker.test.ts` (importa el *fake*).
- Test: primero (TDD).
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

### 3.7 `use-sleep-timer.tsx` (≤ 1 h)
- Qué: `useSleepTimer(isPlaying, onEnd)` → `{ remainingSeconds, start, cancel }`.
  - El temporizador se crea una vez (`useState` con inicializador). `onEnd` va en un ref que se actualiza en un efecto. `setPlaying` se llama en un efecto con `[isPlaying]`.
  - La instantánea se lee con `useSyncExternalStore`. Sin `setState` en efectos.
  - Tests propios en `src/hooks/use-sleep-timer.test.tsx`: la cuenta, el `onEnd` más reciente, la cancelación al pasar `isPlaying` a falso, `StrictMode` (un solo intervalo) y el `currently` de K66.
- Archivos: `player/src/hooks/use-sleep-timer.tsx`, `use-sleep-timer.test.tsx`.
- Test: primero (TDD).
- Verificación: `npm --prefix player run check`
- [ ] hecha · commit: —

### 3.8 `SleepMode` y `Dashboard` solo pintan el sueño (≤ 1 h)
- Qué:
  - `Dashboard` llama a `useSleepTimer(status === 'playing', pause)`. Pinta `SleepTimer` con `remainingSeconds` y `onCancel={cancel}`, y `SleepMode` con `isPlaying` y `onSelect(minutes)` (que llama a `start(minutes * 60)`).
  - `SleepMode` se queda con el menú (`anchorEl`) y sin efectos. Fuera `sleepTimerSeconds`, `onTimerChange`, `externalTimerSeconds` y el `eslint-disable`; también el `NodeJS.Timeout` (D5).
  - El `Host` de `SleepMode.test.tsx` se reescribe según la 3.1.
- Archivos: `player/src/components/dashboard/SleepMode.tsx`, `index.tsx`, `SleepMode.test.tsx` (solo el `Host`), `player/dist/`.
- Test: caracterización ya existente (`SleepMode.test.tsx`, `index.test.tsx` de la 3.3, `sleep.spec.ts`, `player-a11y.spec.ts` (K58)), sin tocar aserciones.
- Verificación: `npm --prefix player run check && npm --prefix player run build && npx playwright test tests/e2e/sleep.spec.ts tests/e2e/player-a11y.spec.ts`
- [ ] hecha · commit: —

### 3.9 El error visible derivado y el motivo de la excepción de iOS (≤ 1 h)
- Qué:
  - En `Dashboard`, `const openError = status === 'error' && !loading`. Fuera el `useState`, el efecto y su `eslint-disable`.
  - En `use-is-ios.tsx`, el motivo del `eslint-disable` pasa a «K13, spec 0007» (D4, A4).
- Archivos: `player/src/components/dashboard/index.tsx`, `player/src/hooks/use-is-ios.tsx`, `player/dist/`.
- Test: caracterización ya existente (`index.test.tsx` de la 3.3; e2e `cross-origin`, `intro`, `mp3`).
- Verificación: `npm --prefix player run check && npm --prefix player run build && npx playwright test tests/e2e/cross-origin.spec.ts tests/e2e/intro.spec.ts tests/e2e/mp3.spec.ts && grep -rn "eslint-disable" src` (desde `player/`)
- [ ] hecha · commit: —

### 3.10 Verificación de la fase (≤ 1 h)
- Qué: `npm run check`; `npm run test:e2e` en `env:start:min` y en `env:start:latest`; A1 (`git diff origin/trunk` de los tests), A2, A4, A6; `manifest.json`; la tabla del gzip frente a `origin/trunk`. Sin commit si no cambia nada (se anota en el cierre).
- Archivos: —
- Test: —
- Verificación: `npm run check && npm run check:zip && npm run test:e2e`
- [ ] hecha · commit: —

### 3.11 Cierre documental de la spec (≤ 1 h)
- Qué:
  - A9 en «Verificación manual pendiente» de `docs/status.md`.
  - `SPEC.md` §6: entrada del historial (sin cambios de contrato; el núcleo es interno; K9, K14, K70 y K80 corregidos).
  - En `docs/specs/README.md`, notas para la 0007, la 0009 y la 0011: dónde queda cada corrección en el núcleo (C1, C2, C7, K1, K11, K12, K13, K63–K66, K81 → `core/audio`, `core/sleep`, `use-is-ios`; C16, K8, K52 → `utils/program-schedule.ts` y `core/schedule`; la UI → los componentes).
  - En `docs/known-issues.md`, la columna de archivo al día (K65 y K66 → `core/sleep/sleep-timer.ts` y `use-sleep-timer.tsx`).
  - La tabla del bundle, preparada para el PR.
- Archivos: `docs/status.md`, `SPEC.md`, `docs/specs/README.md`, `docs/known-issues.md`.
- Test: —
- Verificación: `npm run check`
- [ ] hecha · commit: —

## Decisiones abiertas → ADR

- Ninguna nueva. La ampliación de D5 (el `Host` de `SleepMode.test.tsx`) es decisión del usuario (2026-10-21) y entra en el ADR 0029 en la 3.1.
- Si `useSyncExternalStore` en `useSleepTimer` cambiara el orden visible respecto a K65 (riesgo 3), se para y se pregunta (como en el ADR 0030).
