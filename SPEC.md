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

**Valores cerrados** (listas blancas; un valor desconocido pasa al primero):

- `theme_color`: `neutral`, `blue`, `green`, `red`, `orange`, `yellow`, `purple`, `pink`.
- `visualizer`: `oscilloscope`, `bars`, `particles`, `waterfall`.

**Opciones:**

| Opción | Qué es |
|---|---|
| `radplapag_settings` | Formato de antes de la 3.3.0. Origen de la migración; se borra al migrar. |
| `radplapag_db_version` | Versión del esquema. Hoy `'330'` (`RADPLAPAG_DB_VERSION`). |
| `radplapag_migration_skipped_cpt_conflict` | `'1'` si la migración se saltó porque ya había emisoras publicadas. |

**Transients:**

| Transient | Caducidad | Qué es |
|---|---|---|
| `radplapag_station_schedule_errors_<post_id>` | 45 s | Error de validación del horario tras guardar. |
| `radplapag_station_field_errors_<post_id>` | 45 s | Errores de los campos de la emisora tras guardar. |
| `radplapag_migrating` | 120 s | Bloqueo mientras corre la migración. |
| `radplapag_migration_success_notice` | 60 s | Aviso de migración correcta. |
| `radplapag_migration_error_notice` | 120 s | Mensaje de error de la migración. |

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
  2. `admin_init` (prioridad 20), `radplapag_run_legacy_migration_if_needed()`: solo en el admin, con `manage_options`, si la versión no es `'330'` y `radplapag_settings` tiene `stations`. Si ya hay emisoras publicadas, no migra y marca `radplapag_migration_skipped_cpt_conflict`. Si no, toma el bloqueo, migra como el primer administrador y deja el aviso de éxito o de error.
  3. `upgrader_process_complete`: al actualizar este plugin, la misma comprobación (en `init` con prioridad 100 si los CPT aún no existen).
- Avisos en `admin_notices` (`radplapag_migration_admin_notices`), descartables con `?radplapag_dismiss=migration_conflict` y nonce `radplapag_dismiss_migration_conflict`.
- Al migrar: se borra `radplapag_settings`, `radplapag_db_version` pasa a `'330'`, un mismo `id` de programa en dos emisoras se crea una sola vez y se comparte, una franja con un programa desconocido se descarta, el título vacío pasa a «Radio Station» y las franjas migradas llevan `is_rerun: false`. El detalle está fijado por el golden master del spike (`spike/php/`; tests en la spec 0002).

### 3.3 Página del reproductor

_Se completa en la tarea 1.25._

### 3.4 API PHP

**Funciones documentadas** en `README.md`:

| Función | Devuelve |
|---|---|
| `radplapag_get_config()` | `[ 'stations' => radplapag_get_stations() ]` |
| `radplapag_get_stations()` | Lista ordenada de emisoras publicadas (array de configs: `id`, `stream_url`, `player_page`, `station_title`, `background_id`, `logo_id`, `theme_color`, `visualizer`, `schedule`, …) |
| `radplapag_get_station_for_current_page()` | La config de la emisora de la página actual, o `false` |
| `radplapag_get_now_playing_for_station( $station_index )` | Programa actual y siguiente (si empieza en 10 minutos o menos, `RADPLAPAG_NOW_PLAYING_UPCOMING_WINDOW_MINUTES`) de la emisora con ese índice en `radplapag_get_stations()`, o `null` si el índice no existe |

**Regla:** **todas** las funciones globales `radplapag_*`, las clases `Radplapag_*`, las constantes `RADPLAPAG_*` y los callbacks enganchados (con su hook, prioridad y número de argumentos) son contrato, porque un tercero puede llamarlos o desengancharlos con `remove_action`/`remove_filter`. En el refactor quedan como envoltorios finos que delegan en el código nuevo (strangler, ADR 0017). El plugin no expone filtros ni acciones propios.

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

### 3.7 Desinstalación

`uninstall.php` (solo con `WP_UNINSTALL_PLUGIN`) borra las opciones `radplapag_db_version` y `radplapag_migration_skipped_cpt_conflict` y todos los posts de los dos CPT, en cada sitio si es multisite, y vacía la caché de objetos. Desactivar el plugin no borra nada.

### 3.8 Reproductor (comportamiento)

_Se completa en la tarea 1.25._

### 3.9 Visualizadores (zona congelada)

_Se completa en la tarea 1.25._

### 3.10 Release

- El zip lo genera `scripts/build-release-zip.sh` con una **lista de inclusión**: `radio-player-page.php`, `readme.txt`, `uninstall.php`, `includes/`, `admin/`, `blocks/<bloque>/{block.json,render.php,build/}` y `player/dist/`. `npm run check:zip` compara la lista con la de `v3.4.2` y rechaza las rutas de desarrollo.
- `player/dist/` y `blocks/*/build/` se commitean (ADR 0014).
- La publicación se hace por SVN en wordpress.org, desde un checkout aparte (`radio-player-page-svn`), **siempre a mano por el usuario** (ADR 0015).

## 4. Invariantes

1. El código publicado funciona en PHP 7.4 y WP 6.6.
2. Nada de §3 cambia sin un ADR.
3. La migración es unidireccional e idempotente.
4. El horario es informativo: nunca controla la reproducción.
5. Toda fuente asignada directamente a `audio.src` lleva `crossOrigin = 'anonymous'`; las rutas MSE no (ADR 0004).
6. Los visualizadores no se editan sin un ADR (ADR 0018).
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
