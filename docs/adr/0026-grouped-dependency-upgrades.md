# ADR 0026 — Actualizaciones de dependencias agrupadas por proyecto

- Estado: aceptado · Fecha: 2026-10-20 · Spec: 0003 (diseño)

## Contexto
El ADR 0022 y la skill `upgrade-dependency` pedían una versión mayor por commit, y la hoja de ruta reservaba dos specs para las dependencias: la 0003 (player, en cuatro fases, con un script de presupuesto del bundle en la CI y un proyecto de capturas de Playwright) y la 0004 (bloques, raíz, Composer y Actions). Al empezar la fase 1 de la 0003 (2026-10-20), el usuario consideró que el plan estaba sobredimensionado:

- La red de la 0002 (unidad, hooks, e2e en Chromium y WebKit sobre WP 6.6 y la última, axe y `check:zip`) ya demuestra que el comportamiento no cambia; la medición y las capturas automatizadas añadían herramientas que mantener sin aportar una garantía nueva.
- Las herramientas de la raíz, Composer y las Actions son de desarrollo, recientes (0001/0002) y no llegan al zip.
- Un commit por librería y por versión mayor multiplica los commits y las verificaciones para un trabajo que no cambia nada visible.

## Decisión
- Las dependencias de cada proyecto (`player/`, cada `blocks/*`) se suben **juntas, a la vez**, a su última versión estable: **un commit de actualización por proyecto**, con las guías de migración y los codemods oficiales de cada salto aplicados en ese commit. Si un salto concreto rompe algo que no se arregla con su guía, ese paquete se separa en su propio commit (y, si no puede llegar a la última, lleva su excepción en el ADR 0022).
- Verificación: los tests que ya existen (`npm run check`, el e2e completo en las dos puntas, `check:zip`) y una **revisión visual manual del usuario** en el entorno de desarrollo. No hay script de presupuesto del bundle ni proyecto de capturas: el tamaño en gzip de `player/dist/` antes y después se anota en el PR, y un crecimiento de más del 10 % se consulta con el usuario.
- La spec 0004 desaparece. Los bloques entran en la 0003; la raíz, Composer y las Actions se suben cuando haga falta, como `chore` fuera de una spec, sin ADR salvo que la versión no pueda ser la última.
- Sustituye en el ADR 0022 la línea «una versión mayor por commit»; el resto del 0022 sigue vigente.

## Consecuencias
- Menos commits y una sola verificación por proyecto. A cambio, `git bisect` no aísla qué librería de un proyecto introdujo una regresión: si aparece una, se separan los paquetes sospechosos del commit (por eso la excepción de la decisión).
- Un cambio visible lo detecta el usuario a ojo, no una comparación de imágenes; los e2e y axe siguen detectando los cambios de estructura y de accesibilidad.
- El tamaño del bundle deja de vigilarlo la CI. Si más adelante crece sin control, se reconsidera el script.
- `upgrade-dependency`, `.claude/rules/blocks.md`, `.claude/rules/visualizers.md` y la hoja de ruta se actualizan en el mismo commit.

## Alternativas descartadas
- **Mantener el plan anterior (4 fases, un commit por mayor, bundle y capturas automatizados):** garantías que la red de la 0002 ya cubre casi por completo, a cambio de varias sesiones de trabajo.
- **Un único commit para todos los proyectos:** mezcla lockfiles y builds de proyectos independientes (ADR 0020) y hace más difícil separar un fallo.
- **Mantener la 0004 solo para los bloques:** su build va en el zip, pero el método es el mismo que el del player; no justifica otra spec.
