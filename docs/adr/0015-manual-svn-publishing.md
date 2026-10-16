# ADR 0015 — Publicación en wordpress.org por SVN, siempre a mano por el usuario

- Estado: aceptado (retroactivo: rige desde la 1.0.1) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

wordpress.org distribuye los plugins desde su repositorio SVN. Una publicación llega a todos los sitios con actualizaciones automáticas: un error es caro y difícil de revertir.

## Decisión

- La publicación se hace **a mano por el usuario**, desde un checkout de SVN aparte (`radio-player-page-svn`), con el zip generado desde el tag `vX.Y.Z` de `main` (ADR 0007).
- Claude prepara la versión y los comandos (skill `release`, solo invocable por el usuario) pero no ejecuta `svn` ni crea tags: los dos están denegados en `.claude/settings.json`.

## Consecuencias

- Hay siempre una persona que revisa lo que se publica.
- La release tiene pasos manuales documentados en la skill `release` (versiones, changelog, Plugin Check, prueba de instalación, SVN).

## Alternativas descartadas

- **Despliegue automático por GitHub Actions (p. ej. `10up/action-wordpress-plugin-deploy`):** cómodo, pero publica sin una última revisión humana y exige guardar credenciales de SVN en GitHub.
