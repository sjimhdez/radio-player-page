# ADR 0011 — Prefijos `radplapag` / `RADPLAPAG` en todo lo global

- Estado: aceptado (retroactivo: rige desde la 1.0.1) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

Las guidelines de WordPress.org exigen prefijos únicos para evitar colisiones con core, temas y otros plugins. «Radio Player Page» → `radplapag` es lo bastante largo para ser único.

## Decisión

- Funciones globales, opciones, meta, transients, CPT, handles y nonces: `radplapag_`. Clases: `Radplapag_`. Constantes y globales JS de la página limpia: `RADPLAPAG_`. Datos localizados del editor: `radplapag…Block`, `radplapagAdmin`. Bloques: `radplapag/…`.
- El código nuevo con namespace (spec 0005) usa `RadioPlayerPage\`.
- PHPCS lo vigila (`WordPress.NamingConventions.PrefixAllGlobals` con esos prefijos).

## Consecuencias

- Todos los nombres con prefijo existentes son contrato (`SPEC.md` §3): no se renombran sin un ADR.
- La línea base de PHPCS (ADR 0021) tiene variables globales sin prefijo en archivos heredados; se corrigen en la spec 0002 o en las de refactor.

## Alternativas descartadas

- **Prefijo corto (`rpp_`):** demasiado probable que colisione; el directorio lo desaconseja.
