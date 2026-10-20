---
name: upgrade-dependency
description: Actualiza una dependencia (npm de player/ o de un bloque, de la raíz, Composer o una Action de GitHub) a la última versión estable, con su guía de migración y codemods oficiales, check y e2e, y comparación del bundle. Las de un mismo proyecto se suben juntas (ADR 0026). Úsala en la spec 0003 o cuando haya que subir cualquier dependencia.
argument-hint: "<proyecto> [paquete]"
---

# upgrade-dependency

Dependencias: `$ARGUMENTS` (sin paquete: todas las atrasadas del proyecto) (proyecto: `player`, `blocks/<bloque>`, raíz, Composer o `.github/workflows`).

1. **Cada proyecto por separado** (ADR 0020): se trabaja con su `package.json`/lockfile (`npm --prefix <proyecto> …`). Nunca se mueve una dependencia a otro proyecto.
2. **Destino:** la última versión estable (`npm view <paquete> version`, Packagist, releases de la Action). Si no puede llegar (requisitos mínimos, incompatibilidad), se fija la más alta posible con un ADR (decisión 8 de la hoja de ruta; ADR 0022).
3. **Todo junto, un commit por proyecto** (ADR 0026): se suben a la vez todas las dependencias atrasadas del proyecto, saltando directamente a la última mayor. Si un paquete rompe algo que su guía no resuelve, se separa en su propio commit.
4. **Antes de subir:** lee el changelog o la guía de migración oficial de cada mayor que se salta y aplica los codemods oficiales si los hay (p. ej. `@mui/codemod`). Apunta en el commit qué guía se siguió.
5. **Verificación del commit:**
   - `npm run check` (incluye el `check` del proyecto) y el build del proyecto; si cambia `player/dist/` o `blocks/*/build/`, se commitea el resultado.
   - `npm run test:e2e` (y el e2e de los bloques en WP 6.6: manda).
   - Player: anota el tamaño del bundle (`player/dist/*.js` y `.css`, en gzip) antes y después, para el PR. Más de un +10 % se consulta con el usuario.
   - UI: revisión visual manual del usuario en el entorno de desarrollo («Verificación manual pendiente» en `docs/status.md`).
6. **ADR obligatorio** si cambia algo visible, si hay que tocar los visualizadores (cambio mínimo; `visualizers.md`) o si la dependencia no puede llegar a la última versión.
7. Licencia: la nueva versión sigue siendo GPL-compatible (la CI lo comprueba en lo empaquetado).
8. Commit `build(NNNN): upgrade <proyecto> dependencies (N.M)`, con la lista de paquetes y versiones y las guías seguidas en el cuerpo.

`npm run check` en verde; actualizar `docs/status.md`.
