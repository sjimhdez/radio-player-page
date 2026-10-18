# ADR 0021 — Estándares de código sobre el código heredado: línea base por archivo

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 1)
- Seguimiento: las líneas base se retiraron en la spec 0002, fase 3 (2026-10-17). Solo queda `player/src/config/visualizers.ts` fuera de Prettier (ADR 0018).

## Contexto

Al montar las herramientas de calidad sobre la 3.4.2 (spec 0001, fase 1):

- **PHPCS** (WPCS 3) da 965 violaciones en 39 sniffs (773 las arreglaría `phpcbf`: indentación, arrays cortos, alineación). PHPCompatibilityWP `7.4-`: 0.
- **ESLint de WordPress** en `admin/js`: más de 1.000 errores, casi todos de formato (Prettier) y `no-var`.
- **Lint de los bloques:** errores de formato y `jsdoc/empty-tags`.
- **Prettier del player:** 8 archivos sin formatear (el player tenía `.prettierrc` pero no Prettier instalado).

La CI tiene que estar en verde, y la spec 0001 no puede cambiar código del plugin: el formateo masivo es de la spec 0002, con la red de seguridad ya puesta.

## Decisión

- Se activa el **estándar completo** en cada proyecto, con una **línea base por archivo**: cada regla o sniff que falla hoy se desactiva **solo en los archivos donde falla**. Los archivos nuevos se comprueban con el estándar completo.
  - PHP: bloque de `<rule ref="…"><exclude-pattern>` en `phpcs.xml.dist`.
  - `admin/js`: bloques `files` + `rules: off` en `eslint.config.mjs`.
  - Bloques: `overrides` en el `.eslintrc.json` de cada uno.
  - Player: los archivos en `player/.prettierignore`.
- PHPCompatibilityWP no tiene línea base: se exige desde ya.
- Tres entradas de la línea base de PHPCS **no son de formato** y no las arregla `phpcbf`: `WordPress.WP.EnqueuedResources.NonEnqueuedScript`/`NonEnqueuedStylesheet` (la página limpia imprime sus assets a propósito, ADR 0008) y `WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents` (lee el `manifest.json` local). La spec 0002 las convierte en `// phpcs:ignore` en su línea, con la justificación, para poder borrar el bloque entero.
- **No se añaden entradas.** La spec 0002 formatea el código (`phpcbf`, `eslint --fix`, `prettier --write`) en commits propios (añadidos a `.git-blame-ignore-revs`), reduce o elimina las líneas base y activa `phpcbf` en el hook `format-edited-file.sh`.

## Consecuencias

- La CI exige el estándar en todo lo nuevo sin tocar el código antiguo antes de caracterizarlo.
- Un archivo de la línea base puede seguir empeorando en esas reglas hasta la 0002; el hook de formato no lo reformatea entero al editar una línea.
- Las comprobaciones de mutación de la fase 1 demuestran que la línea base muerde (sin el bloque de Yoda salen 90 errores; sin el de `station-admin.js`, más de 1.000).

## Alternativas descartadas

- **Formatear todo ahora:** cambia 30+ archivos antes de tener la red de seguridad, y los diffs mezclan formato y comportamiento.
- **Excluir las sniffs en todo el repositorio:** el código nuevo tampoco cumpliría.
- **Comprobar solo las líneas cambiadas (diff-based):** frágil en la CI y no protege los archivos nuevos completos.
