# Radio Player Page — especificación del producto

> **Qué es este documento:** cómo es el producto **hoy**, su contrato público y sus invariantes. Es la fuente de verdad del producto. Versión descrita: **3.4.2** (verificada contra el código en la spec 0001, fase 1).
>
> Cambiar cualquier punto del contrato (§3) exige un ADR (`docs/adr/`) y actualizar este documento en el mismo commit. El trabajo en curso está en `docs/specs/` (índice y hoja de ruta en [`docs/specs/README.md`](docs/specs/README.md)); los bugs y rarezas conocidos, en [`docs/known-issues.md`](docs/known-issues.md).

## 1. Producto

Plugin de WordPress, publicado en el directorio de wordpress.org, que da a cada emisora de radio **una página propia y limpia**: un HTML mínimo que no carga el tema y monta un reproductor React (ADR 0008).

- **Emisoras** y **programas** son tipos de contenido (CPT) que gestiona un administrador (`manage_options`).
- Cada emisora tiene una URL de stream (MP3/OGG, HLS, DASH; Icecast y Shoutcast incluidos), una página de WordPress asignada, marca (título, tema de color, logo, fondo), un visualizador, un audio de bienvenida opcional y un **horario semanal** de programas, con reposiciones y franjas que cruzan la medianoche.
- Tres **bloques** muestran el horario, la lista de programas y el programa en antena dentro del contenido normal de WordPress.
- Requisitos mínimos: **WordPress 6.6** y **PHP 7.4** (ADR 0012).

## 2. Dos mundos (ADR 0019)

| | Parte WordPress | Parte React (`player/`) |
|---|---|---|
| **Qué incluye** | `radio-player-page.php`, `includes/`, `admin/`, `blocks/*`, `uninstall.php`, `readme.txt`, `scripts/build-release-zip.sh` | `player/src/**`, su build (`player/dist/`) y su configuración |
| **Normas** | Guidelines del directorio de WordPress.org, WordPress Coding Standards (PHP, JS, CSS), Plugin Handbook, Block Editor Handbook | Sus propias convenciones: TypeScript `strict`, typescript-eslint, Prettier (`player/.prettierrc`), MUI, i18next |
| **Verificación** | Plugin Check, PHPCS (WPCS + PHPCompatibilityWP `7.4-`), subagente `wporg-reviewer` | `tsc`, ESLint, Prettier y Vitest del player |

- La frontera es estrecha: el player **solo** recibe datos por las globales `window.RADPLAPAG_*` que imprime PHP (§3.3) y no llama a ninguna API de WordPress.
- Comunes a los dos, porque todo acaba en el zip: licencias GPL-compatibles, código fuente público, **ninguna petición a terceros** en runtime (solo al stream y a los medios que configura el administrador) y accesibilidad (WCAG 2.2 AA como referencia).
- `player/` y cada `blocks/*` son proyectos independientes, con su `package.json`, su lockfile y su build (ADR 0020).

## 3. Contrato público

### 3.1 Datos

**CPT** (los dos con `map_meta_cap`; las capacidades propias `radplapag_station(s)` / `radplapag_program(s)` se conceden a quien tiene `manage_options` mediante `user_has_cap`, y `map_meta_cap` las resuelve con `manage_options`):

| CPT | Notas |
|---|---|
| `radplapag_station` | Editor clásico forzado (`use_block_editor_for_post_type`). Orden: `menu_order`, después título. |
| `radplapag_program` | |

**Meta de emisora** (`radplapag_station_*`): `stream_url`, `player_page` (ID de la página), `schedule`, `visualizer`, `theme_color`, `logo_id`, `background_id`, `intro_audio_id`.

**Meta de programa** (`radplapag_program_*`): `description`, `extended_description`, `logo_id`.

**Meta interna** (no es parte del formato de datos): `_radplapag_migration_pending` = `'1'` en los posts que crea una migración en curso; se borra al terminar bien, y los posts que aún la llevan se borran al reintentar (ADR 0037).

**Valores cerrados** (listas blancas; un valor desconocido pasa al primero):

- `theme_color`: `neutral`, `blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`.
- `visualizer`: `oscilloscope`, `bars`, `particles`, `waterfall`.

**Opciones:**

| Opción | Qué es |
|---|---|
| `radplapag_settings` | Formato de antes de la 3.3.0. Origen de la migración; se borra al migrar. |
| `radplapag_db_version` | Versión del esquema. Hoy `'330'` (`RADPLAPAG_DB_VERSION`). |
| `radplapag_migration_skipped_cpt_conflict` | `'1'` si la migración se saltó porque ya había emisoras publicadas; `'dismissed'` cuando se descarta el aviso (ADR 0037). |
| `radplapag_migrating` | Bloqueo de la migración, sin autoload. Valor: la marca de tiempo Unix en que caduca (120 s desde la toma o la última renovación, 900 s tras un fallo). Se toma con un `INSERT IGNORE` y, si ha caducado, con un `UPDATE` condicional; gana quien cambia 1 fila. Mientras migra, se renueva antes de cada post con otro `UPDATE` condicional sobre su valor (ADR 0037, 0038 y 0040). |

**Transients:**

| Transient | Caducidad | Qué es |
|---|---|---|
| `radplapag_station_schedule_errors_<post_id>` | 45 s | Error de validación del horario tras guardar. |
| `radplapag_station_field_errors_<post_id>` | 45 s | Errores de los campos de la emisora tras guardar. |
| `radplapag_migrating` | 120 s | **Heredado** (antes de la spec 0008): ya no se lee ni se escribe; el bloqueo es la opción del mismo nombre (ADR 0037). |
| `radplapag_migration_success_notice` | 60 s | Resumen de la migración: `{ stations, dropped: [ { station, day, start, end, program } ] }`. `'1'` (versiones anteriores) se lee como éxito sin detalle (ADR 0037). |
| `radplapag_migration_error_notice` | 900 s | Mensaje de error de la migración (dura lo mismo que la espera tras un fallo, ADR 0037). |

**Formato del horario** (`radplapag_station_schedule`):

```
{ monday: [ { program_id, start: "HH:MM", end: "HH:MM", is_rerun? }, … ], tuesday: …, … sunday: … }
```

- `program_id` es el ID del post `radplapag_program`. Horas en 24 h. Una franja con `end <= start` cruza la medianoche.
- El servidor lo valida al guardar (`radplapag_sanitize_station_schedule()`): campos obligatorios, programa válido, formato `HH:MM` y solapes (incluidas las franjas que cruzan la medianoche). Si falla, no se guarda el horario y queda el aviso.

### 3.2 Migración y actualización

- **Unidireccional** de `radplapag_settings` a los CPT (`includes/migration/`, `Radplapag_Migrator_Settings_To_Cpt`), controlada por `includes/radplapag-upgrade.php` (ADR 0010).
- **Idempotente.** Admite los formatos de **2.0.x a 3.2.x**; los de 1.x quedan fuera del contrato (ADR 0005).
- Flujo:
  1. `plugins_loaded` (prioridad 5), `radplapag_ensure_schema_version_option()`: si la versión no es `'330'` y no hay emisoras que migrar, fija `'330'`.
  2. `admin_init` (prioridad 20), `radplapag_run_legacy_migration_if_needed()`: solo en el admin, con `manage_options`, si la versión no es `'330'` y `radplapag_settings` tiene `stations`. Orden (ADR 0037):
     1. Si la bandera de conflicto está puesta (`'1'` o `'dismissed'`), sale sin contar emisoras (antes, `radplapag_maybe_clear_migration_conflict_flag()` la borra con cualquier valor si hay 0 emisoras publicadas).
     2. Toma el bloqueo (opción `radplapag_migrating`, atómica). Si no puede, sale. Con el bloqueo, vuelve a comprobar la versión y `stations`; si ya no hay nada que migrar, lo suelta y sale (ADR 0040).
     3. Borra los posts que aún llevan `_radplapag_migration_pending` (una migración cortada).
     4. Si ya hay emisoras publicadas, pone la bandera a `'1'` (solo si no existía), suelta el bloqueo y no migra.
     5. Si no, migra como el primer administrador. Bien: suelta el bloqueo y deja el resumen. Mal: *rollback*, retiene el bloqueo 900 s y deja el aviso de error. Antes de cada post renueva el bloqueo; si otra petición lo ha tomado, *rollback* y sale sin avisos ni tocar el bloqueo (ADR 0040).
  3. `upgrader_process_complete`: al actualizar este plugin, la misma comprobación (en `init` con prioridad 100 si los CPT aún no existen).
- Avisos en `admin_notices` (`radplapag_migration_admin_notices`). El de conflicto sale solo con la bandera a `'1'`, lleva `is-dismissible` y se descarta con `?radplapag_dismiss=migration_conflict` y nonce `radplapag_dismiss_migration_conflict`, que pone la bandera a `'dismissed'` (ADR 0037). El de éxito nombra las emisoras migradas y las franjas descartadas, o dice que no había ninguna emisora que migrar.
- Al migrar: se borra `radplapag_settings`, `radplapag_db_version` pasa a `'330'`, un mismo `id` de programa en dos emisoras se crea una sola vez y se comparte, una franja con un programa desconocido se descarta, el título vacío pasa a «Radio Station» y las franjas migran con `is_rerun: false`: los formatos heredados no lo tienen y no se lee (ADR 0039). Las franjas se aceptan de una en una, de lunes a domingo y en su orden dentro del día; la que no valida con las ya aceptadas (formato, horas o solape, también entre días) se descarta y el resto migra (gana la anterior; ADR 0037, enmienda el 0010). El detalle está fijado por el golden master del spike (`spike/php/`; tests en la spec 0002).

### 3.3 Página del reproductor

- `template_redirect` → `radplapag_output_clean_page()`. Solo intercepta una **página publicada**, sin contraseña, asignada a una emisora (`radplapag_get_station_for_current_page()`). En cualquier otro caso devuelve sin hacer nada y WordPress pinta el tema.
- Imprime un HTML mínimo **sin `wp_head()`/`wp_footer()`** y termina con `exit` (ADR 0008). Se caracteriza por HTTP (ADR 0001).
- `<head>`: `lang` = idioma del sitio; `<title>` = título de la emisora o, si está vacío, el nombre del sitio; favicon = icono del sitio; `description` «Listen to %s live» (traducible); Open Graph (`og:title`, `og:description`, `og:url`, `og:type=website`, `og:site_name`, `og:locale`) y Twitter Card. La imagen social es el logo, si no el fondo, si no el favicon (`summary_large_image`); sin imagen, `summary`.
- Assets: lee `player/dist/manifest.json` y su entrada `src/main.tsx`. Sin manifiesto, o sin el JS de esa entrada, `wp_die()` con un mensaje traducible. Nombres: `radio-player-page-<versión>[-<chunk>].min.js` y `.css` (versión de `player/package.json`). El JS se carga como `<script type="module">` y monta en `<div id="root">`.
- **Globales JS**, en un `<script>` antes del player, con `wp_json_encode()` y `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT`:

| Global | Forma |
|---|---|
| `window.RADPLAPAG_CONFIG` | `{ streamUrl, siteTitle, backgroundImage, logoImage, introAudioUrl, themeColor, visualizer, timezoneOffset }`. Las URLs de medios son `null` si no hay. `timezoneOffset` = desfase actual de la zona horaria de WordPress en horas (número; puede ser negativo o fraccionario, y cambia con el horario de verano). |
| `window.RADPLAPAG_PROGRAMS` | `[ { id, name, description, extendedDescription, logoUrl } ]` (`id` como cadena; los opcionales, `null`). Solo los programas que aparecen en el horario, **en el orden de su primera aparición** (lunes → domingo). |
| `window.RADPLAPAG_SCHEDULE` | `{ <día>: [ { program_id, start, end, is_rerun } ] }`. `program_id` como cadena; se omiten las franjas incompletas y los días vacíos. |

### 3.4 API PHP

**Funciones documentadas** en `README.md`:

| Función | Devuelve |
|---|---|
| `radplapag_get_config()` | `[ 'stations' => radplapag_get_stations() ]` |
| `radplapag_get_stations()` | Lista ordenada de emisoras publicadas (array de configs: `id`, `stream_url`, `player_page`, `station_title`, `background_id`, `logo_id`, `theme_color`, `visualizer`, `schedule`, …) |
| `radplapag_get_station_for_current_page()` | La config de la emisora de la página actual, o `false` |
| `radplapag_get_now_playing_for_station( $station_index )` | Programa actual y siguiente (si empieza en 10 minutos o menos, `RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES`) de la emisora con ese índice en `radplapag_get_stations()`, o `null` si el índice no existe |

**Regla:** **todas** las funciones globales `radplapag_*`, las clases `Radplapag_*`, las constantes `RADPLAPAG_*` y los callbacks enganchados (con su hook, prioridad y número de argumentos) son contrato, porque un tercero puede llamarlos o desengancharlos con `remove_action`/`remove_filter`. En el refactor quedan como envoltorios finos que delegan en el código nuevo (strangler, ADR 0017). El plugin no expone filtros ni acciones propios.

**Excepción:** `Radplapag_Migrator_Settings_To_Cpt` es **interna** pese al prefijo: solo la llama `radplapag_run_legacy_migration_if_needed()`, y desde la 0008 `run()` devuelve el resumen de la migración en vez de `true` (ADR 0037).

**Namespace interno:** el código nuevo vive en `RadioPlayerPage\` (`includes/src/`, ADR 0028). Es **interno**: sus clases pueden cambiar entre versiones sin aviso y no son contrato; la API pública sigue siendo la de esta sección.

Callbacks enganchados hoy:

| Hook | Callback (prioridad) |
|---|---|
| `plugins_loaded` | `radplapag_ensure_schema_version_option` (5) |
| `init` | `radplapag_register_station_post_type`, `radplapag_register_program_post_type`, `radplapag_register_station_meta` (20), `radplapag_register_program_meta` (20), `radplapag_register_schedule_block`, `radplapag_register_programs_list_block`, `radplapag_register_now_playing_block` |
| `template_redirect` | `radplapag_output_clean_page` |
| `admin_init` | `radplapag_maybe_clear_migration_conflict_flag` (5), `radplapag_handle_migration_notice_dismiss` (15), `radplapag_run_legacy_migration_if_needed` (20) |
| `admin_menu` | `radplapag_admin_menu` (5), `radplapag_remove_duplicate_rpp_submenu` (99) |
| `admin_notices` | `radplapag_migration_admin_notices`, `radplapag_station_schedule_errors_notice` |
| `admin_enqueue_scripts` | `radplapag_admin_scripts` (10, 1 arg), `radplapag_station_edit_scripts`, `radplapag_program_edit_scripts` |
| `add_meta_boxes` | `radplapag_add_station_meta_boxes`, `radplapag_add_program_meta_boxes` |
| `save_post_radplapag_station` / `save_post_radplapag_program` | `radplapag_save_station_meta` / `radplapag_save_program_meta` |
| `enqueue_block_editor_assets` | `radplapag_enqueue_schedule_block_editor_assets`, `radplapag_enqueue_programs_list_block_editor_assets`, `radplapag_enqueue_now_playing_block_editor_assets` |
| `upgrader_process_complete` | `radplapag_on_upgrader_process_complete` (10, 2 args) |
| `map_meta_cap` | `radplapag_map_cpt_meta_cap` (10, 4 args) |
| `user_has_cap` | `radplapag_grant_station_caps_to_manage_options`, `radplapag_grant_program_caps_to_manage_options` (10, 4 args) |
| `use_block_editor_for_post_type` | `radplapag_station_use_classic_editor` (10, 2 args) |

### 3.5 Bloques

Bloques dinámicos, apiVersion 3, renderizados en el servidor. Comparten `supports`: tipografía (tamaño, interlineado), espaciado (margen, relleno), color (texto, fondo) y `html: false`.

| Bloque | Atributos (por defecto) | Datos del editor |
|---|---|---|
| `radplapag/schedule` | `stationIndex` (0), `dayOrder` (`"current_first"`), `showDescription` (true), `showExtendedDescription` (false) | `radplapagScheduleBlock` |
| `radplapag/programs-list` | `stationIndex` (0), `showImage` (true), `showDescription` (true), `showExtendedDescription` (true), `showSchedule` (true) | `radplapagProgramsListBlock` |
| `radplapag/now-playing` | `stationIndex` (0), `showLogo` (true) | `radplapagNowPlayingBlock` |

- `stationIndex` es la posición en `radplapag_get_stations()`. Los datos del editor son `{ stations: [ etiquetas ] }`.
- Se preservan los atributos y **el markup** del render (clases, `data-program-id`, estilos en línea): los temas pueden depender de ellos. El render se fija con snapshots en la spec 0002.
- `now-playing` no imprime nada en el front si no hay programa en antena.

### 3.6 Admin

- Menú «RPP» con las emisoras y los programas (`radplapag_admin_menu`).
- Meta boxes de emisora (detalles y horario, `#radplapag-station-cpt-container`) y de programa, con nonces `radplapag_station_meta` / `radplapag_program_meta`.
- Validación en el cliente (`admin/js/station-admin.js`: solapes, franjas que cruzan la medianoche) y en el servidor; los errores del servidor se muestran como avisos tras guardar (transients de §3.1).
- Las páginas ya asignadas a otra emisora se desactivan en el selector (`radplapag_get_player_pages_assigned_to_other_stations()`).
- Cadenas del JS en `admin/admin-strings.php` (`radplapag_get_admin_strings()`), localizadas como `radplapagAdmin`.
- Reglas del horario del admin en el script `radplapag-schedule-rules` (`admin/js/schedule-rules.js`, desde la 0005), dependencia de `radplapag-station-admin`, que expone `window.radplapagScheduleRules` (**interno**, no es contrato; ADR 0028). Los handles existentes no cambian.

### 3.7 Desinstalación

`uninstall.php` (solo con `WP_UNINSTALL_PLUGIN`) borra las opciones `radplapag_db_version` y `radplapag_migration_skipped_cpt_conflict` y todos los posts de los dos CPT, en cada sitio si es multisite, y vacía la caché de objetos. Desactivar el plugin no borra nada.

### 3.8 Reproductor (comportamiento)

- **Configuración:** `hooks/use-config.tsx` lee las tres globales (una vez por montaje), las valida con `src/core/config/` y las expone; es la única puerta de entrada de datos. `src/core/` es **interno**, no es contrato (ADR 0029).
- **Protocolo por la extensión del `pathname` de la URL**, sin distinguir mayúsculas y sin contar la *query string* ni el fragmento: termina en `.m3u8` → HLS; termina en `.mpd` → DASH; cualquier otra, o una URL que no se puede analizar → audio directo (MP3/OGG, Icecast, Shoutcast) (ADR 0034).
  - HLS: nativo en iOS (también iPadOS con la web de escritorio, ADR 0036); con `hls.js` en el resto si lo soporta (empieza al recibir el manifiesto); si no, nativo como alternativa.
  - DASH: `dashjs` con autoplay, sin fuente de hora de terceros: usa `<UTCTiming>` del MPD o la cabecera `Date`; si no, el reloj del cliente (ADR 0032).
  - `hls.js` y `dashjs` se cargan con `import()` dinámico, solo cuando hacen falta.
- **`crossOrigin = 'anonymous'`** en toda fuente asignada directamente a `audio.src` (audio directo, HLS nativo y audio de bienvenida). Las rutas MSE (`hls.js`, `dashjs`) cargan por XHR/fetch con CORS y dejan el atributo en `null` (ADR 0004). Si una fuente directa falla con `crossOrigin` (`play()` rechazado con `NotSupportedError`), un solo reintento en el mismo elemento sin él, salvo que el elemento ya pase por Web Audio (entonces, error). Así un stream directo sin cabeceras CORS suena, sin visualizador; HLS/DASH sin CORS siguen sin sonar y muestran el error (ADR 0033).
- **Pausa y Play:** Play tras una pausa (o un error, o un cambio de emisora) recarga el directo, en todos los protocolos, y vuelve al borde en vivo; si el directo ya suena, o durante la bienvenida, no hace nada (ADR 0032). Una pausa mientras el directo carga cancela la carga: queda en pausa, sin error, y con HLS/DASH no empieza a sonar después. El indicador de carga sigue hasta que el elemento suena de verdad (evento `playing`), en todos los protocolos (ADR 0034).
- **Audio de bienvenida:** si `introAudioUrl` existe, suena una vez, en la primera reproducción, antes del directo; mientras suena no se puede pausar; al terminar, si falla al arrancar o si da un error mientras suena, pasa al directo sin mostrar error. Si algo externo la pausa (una llamada, unos auriculares que se desconectan), queda en pausa y Play carga el directo. Si falla el directo que la sigue, se muestra el error y Play lo vuelve a cargar: la bienvenida nunca bloquea el reproductor (ADR 0034).
- **Volumen:** control deslizante; oculto donde el sistema no deja cambiarlo (iOS), según una sonda del núcleo y no el *user agent* (ADR 0036).
- **Media Session:** título de la emisora y logo en la pantalla de bloqueo; acciones de reproducir y pausar.
- **Temporizador de sueño:** 30, 60 o 120 minutos con cuenta atrás contra una hora límite (el tiempo real, aunque los temporizadores del navegador se retrasen); al llegar a cero pausa; cualquier pausa lo cancela; deshabilitado mientras suena la bienvenida (ADR 0035).
- **Programa actual y siguiente:** según el horario y `timezoneOffset`, incluidas las reposiciones y las franjas que cruzan la medianoche. El siguiente se anuncia si empieza en 10 minutos o menos.
- **Reloj de la emisora:** si la zona horaria de la emisora difiere de la del oyente, muestra la hora de la emisora y la diferencia.
- **Modales** del horario semanal y de todos los programas.
- **El horario es solo informativo:** nunca inicia, detiene ni cambia la reproducción.
- **Errores:** si el stream falla, se muestra «Unable to play the stream. Try again later.» (traducido), en Chromium y en WebKit; una pausa no lo borra (spec 0007, K1).
- **i18n:** 14 locales en `player/src/locales/` (`cs`, `da-DK`, `de-DE`, `en-US`, `es`, `es-MX`, `gl-ES`, `hr`, `it-IT`, `nl-NL`, `pt-BR`, `ro-RO`, `ru-RU`, `sv-SE`). Idioma: el del sitio, por el `lang` del `<html>`; si no tiene traducción, reserva `en-US`. El idioma del navegador no se usa (ADR 0025).

### 3.9 Visualizadores (zona congelada, ADR 0018 y 0031)

- Cuatro: osciloscopio (por defecto), barras, cascada y partículas, según `visualizer`. Se cargan de forma diferida (`getVisualizer()`) y solo se activan con el audio sonando.
- Zona congelada: `player/src/components/visualizers/**`, `player/src/config/visualizers.ts`, `player/src/types/visualizers.tsx` (el dibujo y el catálogo).
- Visualizador o animación estática: lo decide el controlador del audio según la fuente en curso (`canVisualize`, ADR 0031 y 0033). Se pinta el visualizador solo con el directo sonando con datos limpios (CORS sin reintento, o rutas MSE); si no, la animación estática, y el audio no pasa por Web Audio. La bienvenida nunca se visualiza y WebKit (`isWebKitBrowser()`) nunca visualiza.
- Contrato con el reproductor: el controlador del audio crea el `AudioContext` dentro del gesto de Play y conecta el `<audio>` a un `AnalyserNode` (`fftSize` 256) la primera vez que `canVisualize` pasa a verdadero; `useAudioVisualizer()` solo dibuja con ese analizador (`getAnalyser()`) mientras suena y `canVisualize` es verdadero. Por eso dependen del `crossOrigin` de §3.8.
- Fuera del refactor y de los mínimos de cobertura. Las actualizaciones de dependencias no los tocan; si una lo obliga, el cambio es mínimo y lleva un ADR.

### 3.10 Release

- El zip lo genera `scripts/build-release-zip.sh` con una **lista de inclusión**: `radio-player-page.php`, `readme.txt`, `uninstall.php`, `includes/`, `admin/`, `blocks/<bloque>/{block.json,render.php,build/}` y `player/dist/`. `npm run check:zip` compara la lista con la de `v3.4.2` y rechaza las rutas de desarrollo.
- `player/dist/` y `blocks/*/build/` se commitean (ADR 0014).
- La publicación se hace por SVN en wordpress.org, desde un checkout aparte (`radio-player-page-svn`), **siempre a mano por el usuario** (ADR 0015).

## 4. Invariantes

1. El código publicado funciona en PHP 7.4 y WP 6.6.
2. Nada de §3 cambia sin un ADR.
3. La migración es unidireccional e idempotente.
4. El horario es informativo: nunca controla la reproducción.
5. Toda fuente asignada directamente a `audio.src` lleva `crossOrigin = 'anonymous'` en el primer intento; si falla, un reintento sin él (ADR 0033). Las rutas MSE no lo llevan (ADR 0004).
6. Los visualizadores (su dibujo y su catálogo) no se editan sin un ADR (ADR 0018, alcance del ADR 0031).
7. El núcleo del reproductor (spec 0006) no importa React ni MUI.
8. `player/dist/` y `blocks/*/build/` se regeneran; nunca se editan a mano.
9. El zip solo contiene lo que lista `build-release-zip.sh`.
10. La parte WordPress cumple las guidelines de WordPress.org; el player solo habla con WordPress por `window.RADPLAPAG_*`.
11. `player/` y cada `blocks/*` tienen su propio `package.json` y su propio build; nunca se unifican.

## 5. Cómo se trabaja (resumen)

- **Specs:** cada cambio empieza con una spec de cambio en `docs/specs/NNNN-slug/spec.md`, escrita en una sesión de diseño y ejecutada en otra, por fases con criterios de aceptación (ADR 0016). Al cerrarla, este documento se actualiza con lo que cambió.
- **Tests:** caracterización antes de tocar código existente (ADR 0017), TDD para la lógica nueva, test de regresión para cada bug. Estrategia y mínimos de cobertura en `.claude/rules/testing.md`.
- **Ramas:** `trunk` integra, `main` es lo publicado; una rama `spec/*` por spec con PR a `trunk` (ADR 0007).
- **Decisiones:** ADRs en `docs/adr/`; dependencias a la última versión estable, con las excepciones justificadas (ADR 0022).

## 6. Historial del contrato

| Versión / spec | Cambio | ADR |
|---|---|---|
| 0001 | Contrato inicial documentado (3.4.2). Precisiones: `crossOrigin` solo en fuentes directas; migración desde 2.0.x. | 0004, 0005 |
| 0002 | §3.8: el idioma del reproductor es el del sitio (reserva `en-US`); el navegador y `localStorage` no son contrato. | 0025 |
| 0005 | Sin cambios en el contrato. §3.4: el namespace `RadioPlayerPage\` (`includes/src/`) es interno. §3.6: script nuevo `radplapag-schedule-rules` (`admin/js/schedule-rules.js`), dependencia de `radplapag-station-admin`, con `window.radplapagScheduleRules` interno; los handles existentes no cambian. | 0028 |
| 0006 | Sin cambios en el contrato. §3.8: la validación de las globales vive en `src/core/config/` y `use-config.tsx` las lee; `player/src/core/` (audio, reloj, configuración, Media Session, horario y sueño) es interno. Corregidos K9, K14, K70 y K80 (sin cambio de contrato). | 0029, 0030 |
| 0007 | §3.8 y §3.9: fuentes directas con `crossOrigin` y un reintento sin él; el núcleo decide la visualización (`canVisualize`); Play tras una pausa recarga el directo; DASH sin fuente de hora de terceros; protocolo por el sufijo del `pathname`; estados del audio fieles (`loading` hasta `playing`, la pausa cancela la carga, el error no se borra); la bienvenida nunca bloquea el reproductor; temporizador de sueño contra una hora límite y deshabilitado durante la bienvenida; volumen por capacidad y HLS nativo también en iPadOS. Corregidos C1, C2, C7, K1, K11, K12, K13, K63–K67, K81 y K82; K18 era del *fixture*. | 0031, 0032, 0033, 0034, 0035, 0036 |
| 0008 (fase 1) | §3.1 y §3.2: el bloqueo `radplapag_migrating` pasa a ser una opción atómica (120 s; 900 s tras un fallo) y el transient queda heredado; meta interna `_radplapag_migration_pending` para reintentar sin duplicados; la bandera de conflicto admite `'dismissed'` y el aviso es descartable; las franjas que no validan se descartan una a una y el resto migra; el aviso de éxito es un resumen y el de error dura 900 s. `is_rerun` no se lee de la franja heredada (ADR 0039). El bloqueo se renueva antes de cada post y se vuelve a comprobar todo tras tomarlo (ADR 0040). §3.4: `Radplapag_Migrator_Settings_To_Cpt` es interna. | 0037, 0038, 0039, 0040 |
