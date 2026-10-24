# Spec 0011 · Fase 2 — Idioma y textos
Estado: en curso · Inicio: 2026-10-24 · ADRs: 0023, 0025, 0029, 0050 (nuevo)

## Contexto

- **Detección hoy** (`player/src/config/i18n.ts`): `i18next-browser-languagedetector` con `order: ['htmlTag', 'localStorage', 'navigator']` y `caches: ['localStorage']`, y `fallbackLng: 'en-US'`. Solo hay recursos regionales (`de-DE`, `pt-BR`…) salvo `es`, `cs` y `hr`, así que `de-AT` sale en inglés (K68). La página limpia imprime `get_bloginfo( 'language' )`, con guion (`es-ES`, `de-AT`): los alias `de_DE`, `pt_BR` e `it_IT` nunca se alcanzan desde el `<html lang>`, pero se conservan (no estorban y su test sigue igual).
- **K68, `fallbackLng` por idioma** (decisión del usuario, 2026-10-24): `fallbackLng = { de: ['de-DE', 'en-US'], pt: ['pt-BR', 'en-US'], nl, sv, ru, ro, da, it, gl…, default: ['en-US'] }`, derivado de las claves de los recursos (sin los alias con `_`; `es`, `cs` y `hr` no lo necesitan porque el recurso base existe). Comprobado en i18next 26.5.3: `getFallbackCodes` busca el código completo y luego el idioma base (`de-AT` → `de`), y `setResolvedLanguage` recorre la jerarquía, que incluye la reserva, así que `resolvedLanguage` sale `de-DE`, un recurso real: es el valor del `lang` de K62. La derivación es una función pura en un núcleo nuevo, `src/core/i18n/` (sin i18next, regla A2).
- **Detector fuera** (decisión del usuario): `lng` sale de `document.documentElement.lang` (o `en-US` si está vacío) y se quita `i18next-browser-languagedetector` de `player/package.json` (una dependencia de runtime menos; ADR 0050). Ya no se lee `localStorage` ni `navigator`, ni se escribe `i18nextLng`.
- **K69, formas plurales** (decisión del usuario): `Intl.PluralRules` (ICU de Node 26) pide `one,few,many,other` en `cs` y `ru-RU`, `one,few,other` en `hr` y `ro-RO`, **`one,many,other` en `es`, `es-MX`, `it-IT` y `pt-BR`** (millones; la spec solo citaba los cuatro primeros, y §2 se corrige en el commit del plan) y `one,other` en el resto. Cada locale lleva exactamente las claves de su conjunto; `_many` en los idiomas romances repite el texto de `_other`.
- **K62:** `lang` = `i18n.resolvedLanguage`, **siempre** (sin comparar con el `<html lang>`: más simple, y `es` dentro de una página `es-ES` es válido). Va en la raíz del `Dashboard` y, para los portales que se montan en `body`, en los `defaultProps` del tema: `MuiDialog` y `MuiPopover` (el `Menu` de «Sleep mode» lo usa) llevan `lang` en su raíz, y `MuiTooltip` en `slotProps.popper`. `getTheme(colorMode, lang)` lo recibe de `ThemeProviderWrapper`. Ningún componente pasa ya `slotProps` a esos `Tooltip`.
- **C15:** el logo usa `title` (el nombre de la emisora, que `StreamInfo` ya recibe) en `dashboard.stationLogo` = `"{{name}} logo"` (i18next usa `{{…}}`; la spec decía «%s»). El fondo y el avatar pasan a `alt=""`.

### Tests que cambian fuera de §4.6 (aprobados por el usuario el 2026-10-24)

- `player/src/config/locales.test.ts`:
  - «falls back to en-US»: compara `fallbackLng.default` con `['en-US']` y añade una comprobación de comportamiento (`eu` → «Play»).
  - «%s has exactly the keys of en-US»: compara las claves sin el sufijo plural (`_one`, `_few`, `_many`, `_other`). Las formas exactas las vigila el test nuevo contra `Intl.PluralRules`.
- `tests/e2e/i18n.spec.ts`, «the page language wins over the one stored in localStorage»: la última aserción pasa de `'es-ES'` a `toBe( 'de-DE' )` (un `i18nextLng` guardado no se lee y no se escribe: queda como estaba). El plan decía `toBeNull()`, que no puede pasar porque el test siembra `'de-DE'` antes de cargar; corregido con la aprobación del usuario en la tarea 2.4 (2026-10-24). El comentario de cabecera del archivo pasa a describir la detección nueva.

## Objetivo

El player sale en el idioma base cuando la variante regional no tiene recurso, marca con `lang` el idioma que usa (también en modales, menú y *tooltips*), dice «1 minute» con las formas plurales de cada locale y no lleva `alt` literales. ADR 0050 y `SPEC.md` §3.8 lo recogen.

## Criterios de aceptación

| Criterio | Cómo se verifica |
|---|---|
| ADR 0050 aceptado y `SPEC.md` §3.8 («i18n») al día antes de K68 | Revisión del commit 2.1 |
| K68: `de-AT`, `de-CH`, `pt-PT`, `nl-BE`, `sv`, `ru` salen en su idioma base; `es-AR` en `es`; un idioma sin traducción en `en-US` | `locales.test.ts` (regresión de K68) + `core/i18n/fallback-languages.test.ts` + e2e `i18n.spec.ts` con el sitio en `de_AT` |
| Sin `localStorage` ni `navigator`, sin escribir `i18nextLng` | e2e `i18n.spec.ts` (localStorage sin tocar, `'de-DE'`; K55 sin cambios en sus asserts) |
| K55 pasa a test normal (`uses the site language, never the browser language (K55)`) | `i18n.spec.ts` |
| K62: la raíz, el diálogo, el menú y el *tooltip* llevan el `lang` del idioma del player (`en-US` con el sitio en `eu`) | e2e `i18n.spec.ts` (regresión de K62) |
| K69: «(in 1 minute)»; las claves de cada locale son exactamente las categorías de `Intl.PluralRules` | `locales.test.ts` (regresión de K69 + test por locale) |
| C15: fondo y avatar con `alt=""`, logo con «<emisora> logo» traducido | e2e `a11y.spec.ts` (regresión de C15) |
| Formas plurales y textos nuevos de los 14 locales revisados por el usuario | Manual, en el PR (riesgo 5) |
| `npm run check`, `locales.test.ts` e `i18n.spec.ts` en verde (Chromium y WebKit) | Comandos de cada tarea y close-phase |

## Tareas

### 2.1 ADR 0050 y `SPEC.md` §3.8 (≤ 1 h)
- Qué: `write-adr` para el ADR 0050 («El player resuelve el idioma base y marca el suyo»): `fallbackLng` por idioma derivado de los recursos, `lng` desde el `<html lang>` sin detector (fuera la dependencia, sin `localStorage` ni `navigator`), `lang` = `resolvedLanguage` en la raíz y en los portales, siempre. Completa el ADR 0025. Línea «i18n» de `SPEC.md` §3.8, índice de ADRs y la regla `.claude/rules/player.md` (zona `i18n` del núcleo y detección).
- Archivos: `docs/adr/0050-*.md`, `docs/adr/README.md`, `SPEC.md`, `.claude/rules/player.md`
- Test: — (documentación)
- Verificación: `npm run check`
- [x] hecha · commit: ver `git log` («docs(0011): add ADR 0050 on the player language and its lang (2.1)»)

### 2.2 Mapa de reservas por idioma en el núcleo (≤ 1 h)
- Qué: `fallbackLanguages(resourceKeys, defaultLanguage)` → `{ [base]: [primerRecursoDeEseIdioma, default], default: [default] }`; ignora las claves con `_` y los idiomas cuya base ya es un recurso (`es`, `cs`, `hr`). Orden estable (alfabético) si hubiera dos variantes de una base sin recurso base.
- Archivos: `player/src/core/i18n/fallback-languages.ts`, `player/src/core/i18n/fallback-languages.test.ts`
- Test: primero (TDD): `fallback-languages.test.ts`
- Verificación: `npm --prefix player run check`
- [x] hecha · commit: ver `git log` («feat(0011): add the per-language fallback map to the i18n core (2.2)»)

### 2.3 K68: variantes regionales en su idioma base (≤ 1 h)
- Qué (`fix-bug`): el `currently` de K68 pasa a regresión (`changeLanguage(language)` → «Abspielen», «Reproduzir», «Afspelen»… el texto de `dashboard.play` del recurso base), en rojo y luego en verde con `fallbackLng: fallbackLanguages(Object.keys(resources), 'en-US')`. «falls back to en-US» cambia (aprobado). E2E nuevo en `i18n.spec.ts` con el sitio en `de_AT` (botón «Abspielen» o su texto en `de-DE`). Fila K68 → «corregido (spec 0011)».
- Archivos: `player/src/config/i18n.ts`, `player/src/config/locales.test.ts`, `tests/e2e/i18n.spec.ts`, `docs/known-issues.md`
- Test: regresión (antes `currently`): `locales.test.ts`, `i18n.spec.ts`
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/i18n.spec.ts`
- Rojo: `locales.test.ts`, los seis casos de K68 con `Expected: "Abspielen"` (`"Reproduzir"`, `"Afspelen"`, `"Spela"`, `"Воспроизвести"`) / `Received: "Play"`, y «falls back to en-US» (`fallbackLng` era `['en-US']`); el e2e nuevo, contra el `dist/` anterior, no encuentra el botón «Abspielen».
- Changelog: «The player shows regional variants without their own translation (de-AT, pt-PT, nl-BE…) in their base language instead of English.»
- [x] hecha · commit: ver `git log` («fix(0011): show regional variants in their base language (2.3)»)

### 2.4 Detección solo por el `<html lang>` y K55 (≤ 1 h)
- Qué: fuera `LanguageDetector` y la dependencia (`npm --prefix player uninstall i18next-browser-languagedetector`); `lng: document.documentElement.lang || 'en-US'`. El comentario de `config/i18n.ts` describe lo que hace (idiomas, base, reserva, sin almacenamiento). En `i18n.spec.ts`: la aserción de `localStorage` → `toBe( 'de-DE' )` (aprobado; el plan decía `toBeNull()`), el comentario de cabecera al día, y el `currently` de K55 se renombra `uses the site language, never the browser language (K55)` sin tocar sus asserts. Fila K55 al día.
- Archivos: `player/src/config/i18n.ts`, `player/package.json`, `player/package-lock.json`, `tests/e2e/i18n.spec.ts`, `docs/known-issues.md`
- Test: e2e existentes (`i18n.spec.ts`) + `locales.test.ts`
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/i18n.spec.ts`
- [x] hecha · commit: ver `git log` («refactor(0011): read the player language only from the page (2.4)»)

### 2.5 K62: `lang` del idioma del player en la raíz y en los portales (≤ 1 h)
- Qué (`fix-bug`): el `currently` de K62 pasa a regresión: con el sitio en `eu`, la raíz del player lleva `lang="en-US"`, y al abrir el horario, el menú de «Sleep mode» y un *tooltip* (hover en «Sleep mode»), cada uno tiene un ancestro con `lang="en-US"` (`closest('[lang]')`). Arreglo: `lang` en la raíz del `Dashboard` (`useTranslation().i18n.resolvedLanguage`) y `getTheme(colorMode, lang)` con los `defaultProps` de `MuiDialog`, `MuiPopover` y `MuiTooltip` (`slotProps.popper`). Fila K62 → «corregido».
- Archivos: `player/src/components/dashboard/index.tsx`, `player/src/config/theme.ts`, `player/src/ThemeProviderWrapper.tsx`, `tests/e2e/i18n.spec.ts`, `docs/known-issues.md`
- Test: regresión (antes `currently`): `i18n.spec.ts`
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/i18n.spec.ts tests/e2e/a11y.spec.ts`
- Rojo: `i18n.spec.ts`, «marks the English fallback with its own language (K62)», en Chromium y WebKit: `Expected: "en-US"` / `Received: "eu"` (el ancestro con `lang` del botón Play es el `<html>`).
- Changelog: «The player marks its interface, dialogs, menu and tooltips with the language it shows (English when the site language has no translation).»
- [x] hecha · commit: ver `git log` («fix(0011): mark the player and its portals with its language (2.5)»)

### 2.6 K69: formas plurales de «Coming up» (≤ 1 h)
- Qué (`fix-bug`): el `currently` de K69 pasa a regresión (`t('dashboard.upcomingInMinutes', { count: 1 })` → «(in 1 minute)»), más un test por locale: las claves `upcomingInMinutes_*` son exactamente las categorías de `new Intl.PluralRules(locale).resolvedOptions().pluralCategories`. «exactly the keys of en-US» compara sin el sufijo plural (aprobado). `upcomingInMinutes` → `_one`/`_other` (+ `_few`/`_many` según el locale) con `{{count}}` en los 14 locales; `StreamInfo` pasa `count`. Fila K69 → «corregido».
- Archivos: `player/src/locales/*.json`, `player/src/components/dashboard/StreamInfo.tsx`, `player/src/config/locales.test.ts`, `docs/known-issues.md`
- Test: regresión (antes `currently`) y nuevo: `locales.test.ts`
- Verificación: `npm --prefix player run check`
- Rojo: `locales.test.ts`, la regresión de K69 con `Expected: "(in 1 minute)"` / `Received: "(in {{minutes}} minutes)"` y los 14 casos por locale (ninguna clave `upcomingInMinutes_*`). `schedule.spec.ts` sigue esperando «(in 10 minutes)» y pasa.
- Changelog: «The "Coming up" countdown uses the plural forms of each language ("in 1 minute").»
- [x] hecha · commit: ver `git log` («fix(0011): use plural forms in the coming-up countdown (2.6)»)

### 2.7 C15: `alt` traducidos o vacíos (≤ 1 h)
- Qué (`fix-bug`): el `currently` de C15 pasa a regresión: los `alt` de las `img` del player son `''` (fondo y avatar del programa en antena) y «<emisora> logo» (el título sembrado). `dashboard.stationLogo` = `"{{name}} logo"` en los 14 locales; `StreamInfo` usa `t('dashboard.stationLogo', { name: title })`; el fondo y el `Avatar` pasan a `alt=""` (el avatar sigue con `aria-hidden`). El canvas no se toca. Fila C15 → «corregido».
- Archivos: `player/src/components/dashboard/index.tsx`, `player/src/components/dashboard/StreamInfo.tsx`, `player/src/locales/*.json`, `tests/e2e/a11y.spec.ts`, `docs/known-issues.md`
- Test: regresión (antes `currently`): `a11y.spec.ts`
- Verificación: `npm --prefix player run check && npm run test:e2e -- tests/e2e/a11y.spec.ts`
- Rojo: la regresión de C15 en Chromium y WebKit, con `Received` `["Background", "Logo", "{currentProgram.programName}"]` frente a `["", "", "Fixture Radio Station logo"]`. Verde: `a11y.spec.ts` 36/36.
- Changelog: los `alt` de las imágenes del player: el logo dice «<emisora> logo» (traducible) y el fondo y el avatar del programa, decorativos, van vacíos.
- [x] hecha · commit: ver `git log` («fix(0011): translate the logo alt and empty the decorative ones (2.7)»)

## Decisiones abiertas → ADR

- ADR 0050 (tarea 2.1). Ninguna otra.
