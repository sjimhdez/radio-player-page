# ADR 0008 — Páginas del reproductor limpias, sin el tema

- Estado: aceptado (retroactivo: rige desde la 1.0.1) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

Un reproductor de radio tiene que sonar sin cortes y sin que el tema o los plugins del sitio interfieran (scripts, estilos, recargas). Integrarlo en las plantillas del tema obliga a convivir con lo que cada tema encole, y el comportamiento cambia de un sitio a otro.

## Decisión

- Cada emisora se sirve en **su propia página de WordPress**, interceptada en `template_redirect` por `radplapag_output_clean_page()`, que imprime un HTML mínimo y termina con `exit`.
- La página **no llama a `wp_head()` ni a `wp_footer()`**: no carga el tema ni lo que encolan otros plugins. Imprime sus propias meta (título, descripción, Open Graph, Twitter, favicon), las globales `window.RADPLAPAG_*` y los assets del player desde `player/dist/manifest.json`.
- Solo se intercepta una página publicada, sin contraseña y asignada a una emisora; en cualquier otro caso se pinta el tema.

## Consecuencias

- Sin conflictos con el tema y con pocas peticiones: es el diferencial del producto (`readme.txt`).
- Plugin Check marca `NonEnqueuedScript`/`NonEnqueuedStylesheet`; se ignoran a propósito (la página no tiene cola de assets).
- Lo que otros plugins añaden con `wp_head` (SEO, analítica, cookies) no aparece en estas páginas. Es intencionado.
- El `exit` dificulta testear: se caracteriza por HTTP (ADR 0001) y la costura llega con el refactor (spec 0005).

## Alternativas descartadas

- **Plantilla de página dentro del tema** (o shortcode/bloque del reproductor): depende de cada tema y vuelve a los conflictos que se querían evitar.
- **Ruta propia con rewrite rules:** obliga a gestionar URLs fuera de las páginas y empeora la edición para el usuario; asignar una página existente es más simple.
