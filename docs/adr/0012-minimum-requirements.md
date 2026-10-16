# ADR 0012 — Requisitos mínimos: WordPress 6.6 y PHP 7.4

- Estado: aceptado (retroactivo: WP 6.6 desde la 3.3.1; PHP 7.4 desde la 1.0.1) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

La 3.3.1 subió el mínimo de WordPress de 5.0 a 6.6 para los bloques (Block API v3 y el *runtime* moderno de JSX). PHP 7.4 era el mínimo desde la 1.0.1. La iniciativa «base de calidad» decidió mantener los dos (hoja de ruta, decisión 2): subirlos deja a sitios sin actualizaciones.

## Decisión

- El código publicado funciona en **WordPress 6.6+** y **PHP 7.4+** (`readme.txt`, cabecera del plugin).
- Se verifica en la CI: PHPCompatibilityWP `7.4-`, `php -l` en 7.4 y 8.4, y la integración y el e2e en **PHP 7.4 + WP 6.6** y en **PHP 8.4 + la última WP**.
- Subir un mínimo exige un ADR y una release con su `== Upgrade Notice ==`.

## Consecuencias

- Nada de sintaxis de PHP 8 ni de APIs de WP posteriores a la 6.6 en lo publicado (`.claude/rules/php.md`, subagente `backcompat-reviewer`).
- Las herramientas de test se eligen para la matriz: PHPUnit se queda en 9.6 (ADR 0003).
- Si un build moderno de los bloques necesita una WP posterior, se fija la versión de la herramienta con un ADR (spec 0004).

## Alternativas descartadas

- **Subir a PHP 8.1 / WP más reciente:** simplificaría las herramientas, pero corta las actualizaciones a sitios que hoy funcionan.
