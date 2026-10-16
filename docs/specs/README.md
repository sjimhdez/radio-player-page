# Specs — índice y hoja de ruta

> Cada trabajo empieza con una spec: `docs/specs/NNNN-slug/spec.md`. **La spec se escribe en una sesión de diseño y se ejecuta en una sesión nueva.** Las specs son pequeñas (< 250 líneas, salvo la 0001) y se redactan **justo a tiempo**: la siguiente se escribe cuando la anterior se cierra, con lo aprendido.
>
> Idiomas: docs en español; código, comentarios y commits en inglés.

## Índice

| # | Spec | Estado | Rama | Depende de |
|---|---|---|---|---|
| 0001 | [Bootstrap: spike, herramientas e ingeniería de contexto](0001-bootstrap/spec.md) | lista para ejecutar | `spec/0001-bootstrap` | — |
| 0002 | [Red de seguridad, auditoría y triage](0002-safety-net/spec.md) | borrador (se cierra con `write-spec` al terminar la 0001) | `spec/0002-safety-net` | 0001 |
| 0003 | Dependencias del player (React) | pendiente de escribir | — | 0002 |
| 0004 | Dependencias de la parte WordPress (bloques, raíz, Composer, CI) | pendiente de escribir | — | 0002 |
| 0005 | Refactor de PHP y admin | pendiente de escribir | — | 0004 |
| 0006 | Refactor del player | pendiente de escribir | — | 0003 |
| 0007+ | Correcciones por zona (lo aprobado en el triage de la 0002) | pendiente de escribir | — | 0005, 0006 |
| último | Release | pendiente de escribir | — | todas |

Las 0003 y 0004 son independientes entre sí, igual que las 0005 y 0006. Se pueden hacer en cualquier orden o en paralelo, cada una en su worktree.

## Iniciativa en curso: base de calidad (versión 3.x siguiente)

**Problema:** Radio Player Page (3.4.2, publicado en wordpress.org) se desarrolló sin tests. Cualquier cambio es arriesgado, las dependencias están desactualizadas (Node 20 ya no tiene soporte) y la lógica está acoplada a WordPress y a React.

**Objetivo:** dejar el plugin con tests, dependencias al día, lógica testeable y los bugs aprobados corregidos. Todo con la metodología de `../podcast-player-page` (solo el método: ni su arquitectura ni sus decisiones).

### Decisiones comunes a todas las specs de la iniciativa

| # | Tema | Decisión |
|---|---|---|
| 1 | Metodología | Spec-driven development, ADRs, fases con criterios de aceptación, spike, caracterización antes de refactorizar, TDD/ATDD, commits atómicos e ingeniería de contexto (detalle en la 0001, §2). |
| 2 | Requisitos mínimos | Se mantienen **WordPress 6.6+** y **PHP 7.4+**. |
| 3 | Releases y ramas | Ninguna release hasta la spec de release. Trunk-based: una rama `spec/*` por spec, PR a `main` con merge commit (sin squash), que fusiona el usuario; los tags `vX.Y.Z` marcan lo publicado (0001, §6). |
| 4 | Comportamiento | No cambia nada visible hasta las specs de correcciones. Excepción: lo que imponga una actualización de dependencias, con su ADR. |
| 5 | Visualizadores | Siguen en el producto y quedan **congelados**: fuera del refactor y de los mínimos de cobertura. Su contrato con el reproductor (`crossOrigin = 'anonymous'` en todas las fuentes, `audioRef`) se preserva y se testea. C5 y la parte del canvas de C15 solo se corrigen si el usuario lo aprueba, con un ADR. |
| 6 | Dos mundos | La parte WordPress sigue las guidelines de WordPress.org y los estándares de WordPress. La parte React (`player/`) es independiente (0001, §3). |
| 7 | Sin unificar | `player/` y cada `blocks/*` conservan su `package.json`, su lockfile y su build. |
| 8 | Versiones | La última versión estable de todo. Una herramienta de desarrollo que la matriz de mínimos obligue a fijar más atrás lleva su ADR. |
| 9 | Bugs | Solo se corrigen en las specs de correcciones, tras el triage de la 0002. Hasta entonces se fijan con tests `currently` y se registran en `docs/known-issues.md`. Semilla: [`docs/inherited-bugs.md`](../inherited-bugs.md) (C1–C16). |
| 10 | Claude Code | Solo mecanismos oficiales en sus rutas estándar. `docs/specs/`, `docs/adr/`, `docs/status.md` y `docs/known-issues.md` son convenciones del proyecto. |

### Mínimos de cobertura (los hace cumplir la CI)

| Zona | Al cerrar la 0002 | Al cerrar la iniciativa |
|---|---|---|
| TS puro: `player/src/utils/**` y el núcleo extraído en la 0006 | ≥ 90 % líneas | ≥ 90 % líneas · ≥ 85 % ramas |
| Hooks del reproductor (`player/src/hooks/**`, sin visualizadores) | ≥ 70 % | ≥ 85 % |
| Componentes `player/src/components/dashboard/**` | sin mínimo (los cubre e2e) | sin mínimo |
| Visualizadores | excluidos | excluidos |
| PHP crítico: saneado y validación del horario y de los campos, migración, actualización, programa en antena, config | ≥ 80 % | ≥ 90 % |
| PHP resto (`includes/`, `admin/*.php`, `blocks/*/render.php`, `uninstall.php`) | ≥ 60 % | ≥ 80 % |
| JS de admin: lógica extraída en la 0005 | — | ≥ 85 % |

### Lo que se sabe de las specs pendientes

Se escribirán con `write-spec`. Estas notas son el punto de partida, no la spec.

- **0003 Dependencias del player:**
  - todo a la última versión, una versión mayor por commit (skill `upgrade-dependency`);
  - **MUI** (hoy 7.3.x) y Emotion con la guía oficial y `@mui/codemod`, versión mayor a versión mayor;
  - React, `hls.js`, `dashjs`, i18next, `date-fns`, Vite, TypeScript, ESLint;
  - Node a la última versión;
  - presupuesto del bundle (más de un +10 % necesita un ADR);
  - capturas antes y después para la revisión visual del usuario;
  - los visualizadores, sin tocar o con un cambio mínimo y su ADR.
- **0004 Dependencias de WordPress:**
  - `@wordpress/scripts` de **cada bloque por separado**;
  - las herramientas de la raíz, Composer y las Actions de GitHub;
  - el e2e de los bloques en WP 6.6 manda: si un build moderno necesita una WP posterior, se fija la versión con un ADR.
- **0005 Refactor de PHP y admin:**
  - *strangler*: el código nuevo en el namespace `RadioPlayerPage\` con autoloader PSR-4 propio;
  - las funciones `radplapag_*` como envoltorios;
  - la lógica pura separada de los adaptadores de WP, con TDD;
  - la lógica pura de `admin/js/*` extraída a módulos testeables, que pasan los mismos vectores del horario que PHP.
- **0006 Refactor del player:**
  - núcleo `player/src/core/` sin React ni MUI: máquina de estados del audio, adaptadores por protocolo, `crossOrigin`, intro, horario, sueño, Media Session y lectura de las globales;
  - los hooks, como adaptadores finos;
  - TDD.
- **0007+ Correcciones:** una spec por zona. Candidatas:
  - horario: C3, C4, C16;
  - player: C2, C6, C7, C15;
  - admin: C10, C12, C13;
  - desinstalación: C11;
  - más los hallazgos `K*` aprobados.
- **Release:**
  - Plugin Check sobre el zip, la checklist de las guidelines y la matriz PHP 7.4/8.4 × WP 6.6/última;
  - verificación manual: iOS y Android, una emisora real y una actualización desde la 3.4.2;
  - changelog y `== Upgrade Notice ==`;
  - merge a `main`, tag `vX.Y.Z` y pasos de SVN para el usuario.
