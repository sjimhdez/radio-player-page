---
paths:
  - "**/*.php"
  - "admin/**"
  - "blocks/**"
  - "readme.txt"
---

# Parte WordPress: directorio de WordPress.org

El plugin se publica en wordpress.org; sus reglas son obligatorias en la parte WordPress (ADR 0019). El player (`player/`) no sigue estas normas, pero lo que entra en el zip sí cumple las comunes.

Fuentes: [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) · [Plugin Handbook](https://developer.wordpress.org/plugins/) · [Coding Standards](https://developer.wordpress.org/coding-standards/) · [Block Editor Handbook](https://developer.wordpress.org/block-editor/) · [readme.txt](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/).

## Lo que más se rompe

- **Prefijos** en todo lo global: funciones, clases, constantes, opciones, meta, transients, hooks, handles y globales JS (`radplapag_`, `RADPLAPAG_`, `Radplapag_`, `RadioPlayerPage\`; ADR 0011).
- **APIs de WP** antes que soluciones propias: `wp_enqueue_*`, HTTP API, `WP_Filesystem` si se escribe en disco, `wp_json_encode`.
- **Ninguna llamada a terceros** ni seguimiento sin consentimiento. Las únicas peticiones salientes son al stream y a los medios que configura el administrador. Nada de fuentes ni scripts de CDN.
- **No empaquetar librerías que trae core** (jQuery, React del editor, etc.): en los bloques van como dependencias de `@wordpress/scripts`.
- **Avisos del admin** que se pueden descartar, solo en las pantallas donde aplican; sin «nags» ni publicidad.
- **i18n:** todos los textos visibles traducibles con el text domain `radio-player-page`, y comentarios `/* translators: */` cuando hay marcadores.
- **Desinstalación limpia** (`uninstall.php`); desactivar el plugin no borra nada.
- **Licencias GPL-compatibles** de todo lo empaquetado (la CI lo comprueba).
- **Código legible:** el código fuente y las herramientas de build son públicos (FAQ de `readme.txt` → GitHub).

## Plugin Check

- La CI lo ejecuta sobre el zip con todas las categorías, incluida `plugin_repo`.
- **No detecta:** llamadas externas en JS, «nags», librerías de core empaquetadas en bundles, licencias de dependencias, si `readme.txt` describe bien el plugin, ni lo que deja la desinstalación. Eso lo revisa el subagente `wporg-reviewer`.
- Ignorados a propósito: `WordPress.WP.EnqueuedResources.NonEnqueuedScript/Stylesheet` en la página limpia (no carga el tema; ADR 0008).

## `readme.txt`

- Cabecera: `Requires at least: 6.6`, `Requires PHP: 7.4`, `Tested up to` (la última WP probada), `Stable tag` (= versión del plugin), licencia.
- Descripción corta de 150 caracteres como máximo.
- `== Changelog ==` y `== Upgrade Notice ==` los mantiene la skill `release`.
