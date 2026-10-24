# ADR 0025 — El idioma del reproductor es el del sitio

- Estado: aceptado; completado por [ADR 0050](0050-player-resolves-base-language-and-marks-its-own.md) (idioma base, sin detector ni `localStorage`, `lang` del player) · Fecha: 2026-10-18 · Spec: 0002 (fase 5)

## Contexto
`SPEC.md` §3.8 decía que el reproductor detecta el idioma en este orden: `lang` del `<html>` → `localStorage` → navegador, con reserva `en-US`. La auditoría (K55 en `docs/known-issues.md`) midió otra cosa en la 3.4.2: la página limpia **siempre** imprime `lang` con el idioma del sitio (`SPEC.md` §3.3) y i18next (`player/src/config/i18n.ts`, `order: ['htmlTag', 'localStorage', 'navigator']`) se queda con el primero que encuentra, así que `localStorage` y el navegador nunca se alcanzan. Con un idioma del sitio sin traducción (`eu`, `fr-FR`, `ja`…) el player sale en inglés, la reserva, aunque el navegador esté en un idioma que sí tiene traducción. Medido en Chromium y WebKit (`tests/e2e/i18n.spec.ts`, `currently never uses the browser language…`).

En el triage (tarea 5.4, 2026-10-18) el usuario decidió que es la redacción la que está mal, no el código: el idioma lo elige quien administra el sitio, como en el resto de WordPress.

## Decisión
- El idioma del reproductor es el idioma del sitio, que le llega por el `lang` del `<html>` de la página limpia. Si no hay traducción para él, la reserva es `en-US`.
- El idioma del navegador y `localStorage` no forman parte del contrato. `SPEC.md` §3.8 y `.claude/rules/player.md` se corrigen así en el mismo commit.
- Sin cambio de código en la 0002. La configuración de i18next puede seguir listando `localStorage` y `navigator` mientras no cambie el resultado; si una spec la simplifica (0006 o la de correcciones de interfaz), no necesita otro ADR.

## Consecuencias
- K55 deja de ser un bug y su test `currently` describe el comportamiento del contrato; en la spec de correcciones de interfaz se renombra como test normal.
- Un sitio en un idioma sin traducción muestra el player en inglés aunque el oyente use otro idioma. Que esa reserva vaya marcada con `lang="en"` es K62 (corregir), y que las variantes regionales (`de_AT`, `pt_PT`…) caigan en su idioma base es K68 (corregir); ninguna de las dos cambia esta decisión.
- La línea «Detection» de `README.md` describe aún el orden antiguo; la corrige la release, con K3.
- `caches: ['localStorage']` sigue escribiendo `i18nextLng` en el navegador del oyente aunque nunca se lea. No es contrato; puede quitarse al simplificar la configuración.

## Alternativas descartadas
- **El navegador como reserva cuando el idioma del sitio no tiene traducción:** mezcla dos criterios y hace que la misma página salga en idiomas distintos según el oyente; K68 resuelve la mayoría de esos casos sin ella.
- **El navegador primero, como decía `SPEC.md`:** contradice el idioma elegido en el sitio y el `lang` de la página, y cambiaría lo que ven hoy todos los sitios.

Evidencia: `docs/known-issues.md` (K55, K62, K68); `docs/specs/0002-safety-net/audit/player.md`.
