---
paths:
  - "admin/**"
  - "tests/js/**"
---

# Admin (meta boxes, validación y JS del admin)

## Qué hay

- `admin/admin.php`: carga los assets de las pantallas de emisora y programa y pasa los datos al JS con `wp_localize_script()` (`radplapagAdmin`).
- `admin/admin-strings.php`: **todas** las cadenas que usa el JS del admin (`radplapag_get_admin_strings()`), traducibles con el text domain `radio-player-page`. El JS nunca tiene textos visibles en inglés escritos a mano.
- `admin/js/station-admin.js`: editor del horario, validación en el cliente (solapes, franjas que cruzan la medianoche, campos obligatorios) y páginas ya asignadas a otra emisora.
- `admin/js/program-admin.js`: meta box del programa.
- Los meta boxes, el guardado y los avisos están en `includes/radplapag-station-cpt.php` y `includes/radplapag-program-cpt.php` (ver `security.md`).

## Reglas

- **La validación del cliente es una ayuda, no la garantía:** el servidor valida lo mismo (`radplapag_sanitize_station_schedule()`). Si cambia una regla en un lado, cambia en el otro y en los vectores compartidos (`tests/fixtures/schedule-vectors.json`, spec 0002), que pasan PHP y JS.
- **Lógica pura fuera del DOM** (spec 0005): validación del horario, cálculo de solapes y formato de horas se extraen a módulos testeables con Vitest en `tests/js/admin/`. El archivo de `admin/js` queda como adaptador fino del DOM.
- Mientras no exista ese refactor, los scripts se cargan en un `vm` con globales simuladas (ver `tests/js/admin/smoke.test.js`); el comportamiento visible se cubre con e2e.
- **Estándares JS de WordPress** (`eslint.config.mjs` de la raíz, con `wp-prettier`). Los dos archivos heredados tienen una línea base por regla hasta la spec 0002 (ADR 0021).
- Sin dependencias de npm en runtime: el JS del admin se publica tal cual, sin build. Si algún día necesita build, eso es un ADR.
- Los avisos del admin se pueden descartar y solo aparecen en las pantallas del plugin (`wordpress-org.md`).
