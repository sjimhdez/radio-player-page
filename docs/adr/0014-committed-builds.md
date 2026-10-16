# ADR 0014 — Los builds (`player/dist/`, `blocks/*/build/`) se commitean

- Estado: aceptado (retroactivo: `player/dist/` desde la 1.0.1; los bloques desde la 3.3.0) · Fecha: 2026-10-16 · Spec: 0001 (fase 1)

## Contexto

El zip de wordpress.org se arma copiando archivos del repositorio (`scripts/build-release-zip.sh`) y se publica por SVN a mano. El usuario no siempre tiene el entorno de Node a punto al publicar un parche.

## Decisión

- `player/dist/` y `blocks/*/build/` se commitean junto al código fuente que los genera.
- **Nunca se editan a mano**: un hook (`protect-generated.sh`) bloquea las ediciones y el hook `Stop` los regenera al cambiar el fuente.
- La CI recompila cada proyecto con `npm ci` y falla si el resultado difiere de lo commiteado (`git diff --exit-code`).

## Consecuencias

- Cualquier commit del repositorio se puede empaquetar sin compilar, y el zip es reproducible.
- Los diffs de los builds hacen ruido en las revisiones; se revisan por el fuente.
- Cambiar de Node o de herramientas obliga a comprobar que el build sale idéntico (spike R6: idéntico con Node 20–26).

## Alternativas descartadas

- **Compilar solo en la release (o en la CI) y no versionar el build:** el zip dependería del entorno de quien publica y un parche urgente exigiría el toolchain completo.
