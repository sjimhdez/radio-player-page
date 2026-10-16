---
paths:
  - "includes/**"
  - "admin/**"
  - "blocks/**/render.php"
  - "radio-player-page.php"
  - "uninstall.php"
---

# Seguridad (parte WordPress)

Referencia: [Plugin Handbook › Security](https://developer.wordpress.org/apis/security/).

## Entrada: sanear y validar

- Todo lo que llega de `$_POST`, `$_GET`, `$_REQUEST` o de la base de datos externa se pasa por `wp_unslash()` y después por el saneador que corresponda: `sanitize_text_field`, `sanitize_textarea_field`, `esc_url_raw`, `absint`, `sanitize_key`.
- **Listas blancas** para los valores cerrados (tema de color, visualizador, días, `HH:MM`). Un valor desconocido se rechaza o pasa al valor por defecto documentado; nunca se guarda tal cual.
- El horario se valida en el servidor (`radplapag_sanitize_station_schedule()`), aunque el admin JS ya lo valide.

## Guardado: nonce + capacidad

- Cada meta box imprime su nonce (`radplapag_station_meta` / `radplapag_program_meta`) y cada guardado lo verifica con `wp_verify_nonce()` **antes** de leer nada.
- La capacidad es `manage_options` (los CPT usan `map_meta_cap` y el filtro `user_has_cap`). Se comprueba en cada guardado y en cada acción del admin.
- Se ignoran los autosaves (`DOING_AUTOSAVE`).

## Salida: escapar al imprimir

- HTML: `esc_html()`, atributos: `esc_attr()`, URLs: `esc_url()`, textos traducidos: `esc_html__()`/`esc_attr__()`; HTML permitido: `wp_kses_post()`.
- Las globales JS de la página limpia se imprimen con `wp_json_encode()` y las banderas `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT`. Nunca se concatena JSON a mano.
- Los datos del editor de bloques van por `wp_localize_script()` o `wp_add_inline_script()` con `wp_json_encode()`.

## Base de datos

- Siempre `$wpdb->prepare()` con marcadores; mejor aún, las APIs de WP (`get_posts`, `get_post_meta`, `update_post_meta`).
- Los transients de errores (`radplapag_station_*_errors_<post_id>`) caducan en 45 s.

El subagente `wp-security-reviewer` revisa todo esto en `close-phase`.
