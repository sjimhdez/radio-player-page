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
- **Lógica pura fuera del DOM** (spec 0005, ADR 0028): validación del horario, cálculo de solapes y formato de horas van en `admin/js/schedule-rules.js`, un script clásico sin build (ES2019) con handle `radplapag-schedule-rules`, dependencia de `radplapag-station-admin`. Expone `window.radplapagScheduleRules` (interno, no es contrato) y termina con `if ( typeof module !== 'undefined' && module.exports )` para que Vitest lo importe. Trabaja sobre datos, nunca sobre el DOM, y devuelve códigos de error como el núcleo de PHP (los de `schedule-vectors.json`). Se testea con Vitest en `tests/js/admin/` (TDD, ≥ 85 % de líneas). `station-admin.js` queda como adaptador fino del DOM: lee filas, llama a las reglas y pinta los mensajes.
- **Sin script modules** (WP 6.5): cambiarían cómo se carga un asset, y los handles de hoy no cambian.
- **El DOM nunca se construye con cadenas HTML** (A7 de la spec 0005): nada de `innerHTML`, `.html()` ni `insertAdjacentHTML` en `admin/js` (`grep -nE 'innerHTML|\.html\(|insertAdjacentHTML' admin/js` vacío). Los nodos salen de `createElement` + `setAttribute` + `textContent`/`append` (en jQuery, `.empty().append( nodo )`). Las traducciones y nombres que llegan escapados se decodifican con `decodeEntities()` (`DOMParser`) para conservar el texto visible de antes.
- Los adaptadores del DOM (`station-admin.js`, `program-admin.js`) se ejecutan en Vitest con happy-dom sobre el HTML real del meta box (`tests/fixtures/admin/station-meta-box.html`, montado por `tests/js/admin/support/mount-station-screen.js`); lo que solo se ve en un navegador se cubre con e2e.
- **Estándares JS de WordPress** (`eslint.config.mjs` de la raíz, con `wp-prettier`). Estándar completo, sin línea base (ADR 0021).
- Sin dependencias de npm en runtime: el JS del admin se publica tal cual, sin build, así que su sintaxis no pasa de lo que soportan los navegadores de WP 6.6 (ES2019: `catch {}` sin variable sí; nada que exija transpilar). Si algún día necesita build, eso es un ADR.
- Los avisos del admin se pueden descartar y solo aparecen en las pantallas del plugin (`wordpress-org.md`).
