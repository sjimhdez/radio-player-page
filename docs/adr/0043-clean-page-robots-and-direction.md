# ADR 0043 — Robots y dirección del texto en la página limpia

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0008 (fase 3, tarea 3.2)

## Contexto

- **K23.** La página limpia no llama a `wp_head()` (ADR 0008), así que `wp_robots()` no corre. Con «Disuadir a los motores de búsqueda» (`blog_public = 0`) el resto del sitio imprime `<meta name="robots" content="noindex, nofollow">` y la página del reproductor sigue indexable. Las guidelines de WordPress.org piden respetar esa opción.
- **5.6 (auditoría de la 0002).** `<html>` lleva `lang`, pero no `dir`: en un sitio en un idioma RTL el navegador pinta la página en LTR.
- Si se llamara a `wp_robots()`, su filtro `wp_robots` dejaría entrar a los plugins de SEO, que es justo lo que el ADR 0008 deja fuera.
- Caracterizado en `tests/e2e/clean-page.spec.ts` (tarea 3.1): «currently prints no robots meta with blog_public = 0 (K23)» y «currently prints no dir on a right-to-left site». La dirección RTL se simula sin paquete de idioma con el *mu-plugin* de los tests `tests/e2e/mu-plugins/radplapag-e2e.php` y la cabecera `X-Radplapag-E2e-Rtl: 1`.

Decisión D12 de la spec 0008 (§4.1).

## Decisión

Precisa el ADR 0008. `radplapag_output_clean_page()`:

1. Imprime `<meta name="robots" content="noindex, nofollow">` en el `<head>` **si y solo si** `'0' === (string) get_option( 'blog_public' )`. Lo imprime directamente: no llama a `wp_robots()` ni aplica el filtro `wp_robots`. Con `blog_public = 1` no imprime ninguna meta `robots`.
2. Añade `dir="rtl"` a `<html>` **si y solo si** `is_rtl()`. En LTR no imprime `dir` (es el valor por defecto), así que la salida de hoy no cambia.

## Consecuencias

- La página del reproductor sigue la misma política de indexación que el resto del sitio, sin depender del tema ni de otros plugins.
- Un plugin de SEO no puede cambiar la meta `robots` de la página limpia (ni con `blog_public = 1` ni con `0`). Es coherente con el ADR 0008: lo que se engancha a `wp_head` no aparece.
- Solo se imprime `dir`: si la maqueta del player se ve mal en RTL, es otra fila de `known-issues.md`, no este ADR.
- Con `blog_public = 1` y LTR la salida es idéntica a la de antes: ningún *golden* ni *snapshot* cambia.
- Lo protegen los tests de regresión de `tests/e2e/clean-page.spec.ts` (tarea 3.3): `blog_public` a 0 y a 1, un filtro `wp_robots` de prueba que no entra, y RTL y LTR.

## Alternativas descartadas

- **Llamar a `wp_robots()`:** aplica el filtro `wp_robots`, por el que entran los plugins de SEO (contra el ADR 0008), y sus directivas por defecto cambian entre versiones de WordPress.
- **Imprimir siempre `dir`** (`dir="ltr"` en LTR): cambia la salida de todos los sitios sin necesidad.
- **Leer la dirección de `get_bloginfo( 'text_direction' )`:** es la misma fuente que `is_rtl()` (`$wp_locale`), con más rodeo.

Evidencia: [`phase-3.md`](../specs/0008-migration-and-core-fixes/phase-3.md), K23 en [`known-issues.md`](../known-issues.md), [`audit/core.md`](../specs/0002-safety-net/audit/core.md).
