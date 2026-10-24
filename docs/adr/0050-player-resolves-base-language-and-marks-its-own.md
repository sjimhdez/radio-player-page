# ADR 0050 — El player resuelve el idioma base y marca el suyo

- Estado: aceptado · Fecha: 2026-10-24 · Spec: 0011 (fase 2; tarea 2.1)

## Contexto
El ADR 0025 fijó que el idioma del reproductor es el del sitio, por el `lang` del `<html>` de la página limpia, con reserva `en-US`. Dejó abiertas tres cosas que la auditoría de la 0002 midió en `player/src/config/i18n.ts`:

- **K68:** la página limpia imprime `get_bloginfo( 'language' )` con guion (`es-ES`, `de-AT`). Solo hay recursos regionales (`de-DE`, `pt-BR`, `nl-NL`…) salvo `es`, `cs` y `hr`, e i18next, con `fallbackLng: 'en-US'`, busca `de-AT` y luego `de`, que no existe, así que un sitio en `de_AT`, `de_CH`, `pt_PT`, `nl_BE`, `sv` o `ru` ve el player en inglés aunque haya traducción a su idioma.
- **K55:** `i18next-browser-languagedetector` con `order: ['htmlTag', 'localStorage', 'navigator']` nunca llega a `localStorage` ni al navegador (el `lang` siempre está), pero sigue escribiendo `i18nextLng` en el navegador del oyente (`caches: ['localStorage']`) y es una dependencia de runtime que no aporta nada.
- **K62:** el player no marca el idioma en que sale. Con el sitio en `eu` la página dice `lang="eu"` y los textos están en inglés; los modales, el menú de «Sleep mode» y los *tooltips* se montan en `body` (portales de MUI) y heredan ese `lang`.

Comprobado en i18next 26.5.3: con un `fallbackLng` objeto, `getFallbackCodes` busca el código completo y luego el idioma base (`de-AT` → `de`), y `resolvedLanguage` recorre la jerarquía con la reserva incluida, así que sale un recurso real (`de-DE`).

## Decisión
- **Reservas por idioma:** `fallbackLng = { [base]: [recurso, 'en-US'], …, default: ['en-US'] }`, derivado de las claves de los recursos por una función pura del núcleo, `player/src/core/i18n/` (sin i18next, frontera A2). Una base entra solo si no es ya un recurso (`es`, `cs` y `hr` no lo necesitan); las claves con `_` (alias `de_DE`, `pt_BR`, `it_IT`) se ignoran; con dos variantes de una base sin recurso base, gana la primera en orden alfabético. Así `de-AT` → `de-DE`, `pt-PT` → `pt-BR`, `es-AR` → `es`, y un idioma sin traducción → `en-US`.
- **Sin detector:** `lng = document.documentElement.lang || 'en-US'`. Sale la dependencia `i18next-browser-languagedetector` de `player/package.json`; el player no lee `localStorage` ni `navigator` ni escribe `i18nextLng`.
- **`lang` del player:** `lang = i18n.resolvedLanguage`, **siempre** (sin compararlo con el `<html lang>`), en la raíz del `Dashboard` y en los portales por los `defaultProps` del tema: raíz de `MuiDialog` y `MuiPopover` (el `Menu` lo usa) y `slotProps.popper` de `MuiTooltip`. `getTheme(colorMode, lang)` lo recibe de `ThemeProviderWrapper`.
- Completa el ADR 0025, no lo cambia: el idioma sigue siendo el del sitio y la reserva `en-US`.

## Consecuencias
- Los sitios en una variante regional sin recurso pasan a ver el player en su idioma base (cambio visible, para mejor; va en el changelog). Los que tienen traducción exacta o ninguna no cambian.
- Un recurso nuevo entra en las reservas sin tocar la configuración. Lo protegen `core/i18n/fallback-languages.test.ts`, la regresión de K68 en `locales.test.ts` y el e2e de `i18n.spec.ts` con el sitio en `de_AT`.
- Una dependencia de runtime menos. El `i18nextLng` que ya guardaron los navegadores se queda ahí, sin leerse ni borrarse. `i18n.spec.ts` comprueba que no se escribe.
- `lang` puede ser `es` dentro de una página `es-ES`: es válido y más simple que comparar. Lo protege la regresión de K62 en `i18n.spec.ts` (raíz, diálogo, menú y *tooltip* con `lang="en-US"` y el sitio en `eu`).
- Un portal nuevo de MUI que no sea `Dialog`, `Popover` ni `Tooltip` necesita su `lang` en el tema; un componente que pase sus propios `slotProps.popper` a un `Tooltip` pisa el del tema.

## Alternativas descartadas
- **Recursos base duplicados (`de.json` copia de `de-DE.json`…):** dobla los archivos que mantener y desincroniza las traducciones.
- **`fallbackLng` escrito a mano:** se queda atrás al añadir un locale; derivarlo cuesta una función de diez líneas con su test.
- **`load: 'languageOnly'`:** busca solo el recurso del idioma base (`de`), que no existe, y dejaría de usar `es-MX`.
- **Mantener el detector con `order: ['htmlTag']` y sin caché:** una dependencia de runtime para leer un atributo.
- **`lang` solo cuando difiere del `<html lang>`:** una comparación más (con normalización de mayúsculas y guiones) para ahorrar un atributo válido.

Evidencia: `docs/known-issues.md` (K55, K62, K68); [plan de la fase 2](../specs/0011-player-ui-fixes/phase-2.md).
