---
name: upgrade-dependency
description: Actualiza una dependencia (npm de player/ o de un bloque, de la raíz, Composer o una Action de GitHub) a la última versión estable, una versión mayor por commit, con su guía de migración y codemods oficiales, check y e2e, y comparación del bundle. Úsala en las specs 0003/0004 o cuando haya que subir cualquier dependencia.
argument-hint: "<proyecto> <paquete>"
---

# upgrade-dependency

Dependencia: `$ARGUMENTS` (proyecto: `player`, `blocks/<bloque>`, raíz, Composer o `.github/workflows`).

1. **Cada proyecto por separado** (ADR 0020): se trabaja con su `package.json`/lockfile (`npm --prefix <proyecto> …`). Nunca se mueve una dependencia a otro proyecto.
2. **Destino:** la última versión estable (`npm view <paquete> version`, Packagist, releases de la Action). Si no puede llegar (requisitos mínimos, incompatibilidad), se fija la más alta posible con un ADR (decisión 8 de la hoja de ruta; ADR 0022).
3. **Una versión mayor por commit.** De la 5 a la 7: 5 → 6 (commit) → 7 (commit).
4. **Antes de cada salto:** lee el changelog o la guía de migración oficial de esa mayor y aplica los codemods oficiales si los hay (p. ej. `@mui/codemod`). Apunta en el commit qué guía se siguió.
5. **Verificación de cada salto:**
   - `npm run check` (incluye el `check` del proyecto) y el build del proyecto; si cambia `player/dist/` o `blocks/*/build/`, se commitea el resultado.
   - `npm run test:e2e` (y el e2e de los bloques en WP 6.6: manda).
   - Player: compara el tamaño del bundle (`player/dist/*.js` y `.css`, en bytes y en gzip) antes y después. Más de un +10 % necesita un ADR.
   - UI: capturas antes y después de las pantallas afectadas para la revisión visual del usuario («Verificación manual pendiente» en `docs/status.md`).
6. **ADR obligatorio** si cambia algo visible, si hay que tocar los visualizadores (cambio mínimo; `visualizers.md`) o si la dependencia no puede llegar a la última versión.
7. Licencia: la nueva versión sigue siendo GPL-compatible (la CI lo comprueba en lo empaquetado).
8. Commit `build(NNNN): upgrade <paquete> to <versión> in <proyecto> (N.M)`.

`npm run check` en verde; actualizar `docs/status.md`.
