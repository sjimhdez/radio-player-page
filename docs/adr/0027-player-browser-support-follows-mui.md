# ADR 0027 — Navegadores del player: el `build.target` de Vite 6 y el soporte de MUI 9

- Estado: aceptado · Fecha: 2026-10-20 · Spec: 0003 (fase 1)

## Contexto
Hasta la 3.4.2 el player no declaraba navegadores soportados. En la práctica dependían de dos cosas: el `build.target` por defecto de Vite 6 (`['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']`), que fija hasta dónde se transpila la sintaxis, y los navegadores que soporta MUI 7 (Safari 15.4, Chrome 109, Firefox 115).

En la tarea 1.1 de la spec 0003 hay dos cambios que tiran hacia arriba:

- Vite 7 sube el `build.target` por defecto a `'baseline-widely-available'`, y Vite 8 aún más (Chrome 111, Edge 111, Firefox 114, Safari 16.4).
- MUI 9 sube su soporte oficial a Chrome 117, Edge 121, Firefox 121 y Safari 17.0 (macOS e iOS), según su [guía de migración](https://mui.com/material-ui/migration/upgrade-to-v9/). No exige un `build.target` concreto: su código publicado ya está compilado, pero no garantiza las APIs de runtime en navegadores anteriores.

La spec (§4.2) pedía mantener el target de Vite 6 y preguntar si MUI 9 exigía más. El usuario lo decidió el 2026-10-20.

## Decisión
- `player/vite.config.ts` fija `build.target` explícitamente en el valor por defecto de Vite 6: `['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']`. Solo se sube con otro ADR.
- El player usa MUI 9. El soporte efectivo de navegadores es el de MUI 9 (Safari 17+, Chrome 117+, Firefox 121+, Edge 121+); en los navegadores anteriores al de MUI 9 y posteriores al target puede funcionar, pero no se garantiza.
- La release que lleve este cambio lo menciona en el changelog de `readme.txt`.

## Consecuencias
- La sintaxis del bundle no cambia respecto a la 3.4.2; no se deja fuera a nadie por un error de parseo.
- Safari 14–16 (iOS 14–16) ya no tiene garantía: un fallo de MUI en esos navegadores no se considera bug del plugin salvo que se corrija sin tocar MUI.
- Lightning CSS (Vite 8) compila el CSS para el mismo target: añade reservas de `system-ui` y variables para `light-dark`. Son +105 bytes en gzip, aceptados por el usuario en la misma decisión.
- El e2e corre en Chromium y WebKit recientes y no cubre los navegadores antiguos. Lo protege el `build.target` explícito en `vite.config.ts`.

## Alternativas descartadas
- **Quedarse en MUI 7 (excepción en el ADR 0022):** congela la librería de UI justo antes del refactor de la 0006 y acumula deuda de migración.
- **Subir el `build.target` a los navegadores de MUI 9:** el bundle sería algo menor, pero se dejaría fuera formalmente a navegadores que hoy cargan el player, sin necesidad medida.

Evidencia: `docs/specs/0003-player-dependencies/phase-1.md` (tarea 1.1).
