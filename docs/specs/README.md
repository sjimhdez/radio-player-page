# Specs — índice y hoja de ruta

> Cada trabajo empieza con una spec: `docs/specs/NNNN-slug/spec.md`. **La spec se escribe en una sesión de diseño y se ejecuta en una sesión nueva.** Las specs son pequeñas (< 250 líneas, salvo la 0001) y se redactan **justo a tiempo**: la siguiente se escribe cuando la anterior se cierra, con lo aprendido.
>
> Idiomas: docs en español; código, comentarios y commits en inglés.

## Índice

| # | Spec | Estado | Rama | Depende de |
|---|---|---|---|---|
| 0001 | [Bootstrap: spike, herramientas e ingeniería de contexto](0001-bootstrap/spec.md) | cerrada (PR #36) | `spec/0001-bootstrap` | — |
| 0002 | [Red de seguridad, auditoría y triage](0002-safety-net/spec.md) | cerrada (PR #37) | `spec/0002-safety-net` | 0001 |
| 0003 | [Dependencias del player y de los bloques](0003-player-dependencies/spec.md) | cerrada (PR #38) | `spec/0003-player-dependencies` | 0002 |
| 0004 | ~~Dependencias de la parte WordPress~~: descartada; los bloques van en la 0003, y la raíz, Composer y las Actions fuera de una spec ([ADR 0026](../adr/0026-grouped-dependency-upgrades.md)) | descartada | — | — |
| 0005 | [Refactor de PHP y admin](0005-php-admin-refactor/spec.md) | cerrada (PR #39) | `spec/0005-php-admin-refactor` | 0003 |
| 0006 | [Refactor del player](0006-player-refactor/spec.md) | cerrada (PR #40) | `spec/0006-player-refactor` | 0003 |
| 0007 | [Correcciones: reproducción](0007-playback-fixes/spec.md) | cerrada (PR #41) | `spec/0007-playback-fixes` | 0006 |
| 0008 | [Correcciones: migración, actualización, núcleo PHP y desinstalación](0008-migration-and-core-fixes/spec.md) | cerrada (PR #42) | `spec/0008-migration-and-core-fixes` | 0005 |
| 0009 | [Correcciones: horario y programa en antena](0009-schedule-model/spec.md) | cerrada (PR #43) | `spec/0009-schedule-model` | 0005, 0006 |
| 0010 | [Correcciones: admin](0010-admin-fixes/spec.md) | cerrada (PR #44) | `spec/0010-admin-fixes` | 0005, 0009 |
| 0011 | [Correcciones: interfaz, i18n y accesibilidad del player](0011-player-ui-fixes/spec.md) | propuesta | `spec/0011-player-ui-fixes` | 0006, 0007 |
| 0012 | ~~Correcciones: núcleo PHP y desinstalación~~: fusionada en la 0008 (comparten `uninstall.php` y `SPEC.md` §3.7; usuario, 2026-10-22) | fusionada | — | — |
| 0013 | [Correcciones: bloques](0013-block-fixes/spec.md) | cerrada (PR #45) | `spec/0013-block-fixes` | 0009, 0010 |
| último | Release | pendiente de escribir | — | todas |

Las 0005 y 0006 son independientes entre sí. Se pueden hacer en cualquier orden o en paralelo, cada una en su worktree y con su rama desde `trunk`.

Las correcciones (0007–0013) salen del triage de la 0002 (fase 5): una spec por zona, numeradas por prioridad en dos pistas. La del player (0007 → 0011) arranca al cerrar la 0006; en la de WordPress, la 0008 (que absorbe la 0012) arranca al cerrar la 0005, y la 0010 espera a la 0009. La 0009 (horario) necesita la 0005 y la 0006, y la 0013 (bloques) va detrás de la 0009 y la 0010. Una fila «junto a» otra de más prioridad se corrige con ella. Las filas que cambian `SPEC.md` §3 llevan su ADR en la spec que las corrige, porque el diseño se decide allí (invariante 2). Cada fila de `docs/known-issues.md` con «corregir» está en exactamente una de ellas.

## Iniciativa en curso: base de calidad (versión 3.x siguiente)

**Problema:** Radio Player Page (3.4.2, publicado en wordpress.org) se desarrolló sin tests. Cualquier cambio es arriesgado, las dependencias están desactualizadas (Node 20 ya no tiene soporte) y la lógica está acoplada a WordPress y a React.

**Objetivo:** dejar el plugin con tests, dependencias al día, lógica testeable y los bugs aprobados corregidos. Todo con la metodología de `../podcast-player-page` (solo el método: ni su arquitectura ni sus decisiones).

### Decisiones comunes a todas las specs de la iniciativa

| # | Tema | Decisión |
|---|---|---|
| 1 | Metodología | Spec-driven development, ADRs, fases con criterios de aceptación, spike, caracterización antes de refactorizar, TDD/ATDD, commits atómicos e ingeniería de contexto (detalle en la 0001, §2). |
| 2 | Requisitos mínimos | Se mantienen **WordPress 6.6+** y **PHP 7.4+**. |
| 3 | Releases y ramas | Ninguna release hasta la spec de release. `trunk` integra y `main` es lo publicado ([ADR 0007](../adr/0007-trunk-integration-branch.md)): una rama `spec/*` por spec, desde `trunk`, PR a `trunk` con merge commit (sin squash), que fusiona el usuario; la release es un PR `trunk` → `main` con su tag `vX.Y.Z` (0001, §6). |
| 4 | Comportamiento | No cambia nada visible hasta las specs de correcciones. Excepción: lo que imponga una actualización de dependencias, con su ADR. |
| 5 | Visualizadores | Siguen en el producto y quedan **congelados**: fuera del refactor y de los mínimos de cobertura. Su contrato con el reproductor (`crossOrigin = 'anonymous'` en toda fuente asignada a `audio.src`, [ADR 0004](../adr/0004-crossorigin-on-direct-sources.md); `audioRef`) se preserva y se testea. Desde la 0007, el primer intento lleva `crossOrigin` y hay un reintento sin él, y los visualizadores dibujan con el analizador del controlador (`getAnalyser()`) según su `canVisualize` ([ADR 0031](../adr/0031-visualization-decided-by-the-core.md), [ADR 0033](../adr/0033-retry-direct-sources-without-crossorigin.md)). C5 y la parte del canvas de C15 solo se corrigen si el usuario lo aprueba, con un ADR. |
| 6 | Dos mundos | La parte WordPress sigue las guidelines de WordPress.org y los estándares de WordPress. La parte React (`player/`) es independiente (0001, §3). |
| 7 | Sin unificar | `player/` y cada `blocks/*` conservan su `package.json`, su lockfile y su build. |
| 8 | Versiones | La última versión estable de todo. Una herramienta de desarrollo que la matriz de mínimos obligue a fijar más atrás lleva su ADR. |
| 9 | Bugs | Solo se corrigen en las specs de correcciones, tras el triage de la 0002. Hasta entonces se fijan con tests `currently` y se registran en `docs/known-issues.md`. El catálogo heredado C1–C16 ya está sembrado allí. |
| 10 | Claude Code | Solo mecanismos oficiales en sus rutas estándar. `docs/specs/`, `docs/adr/`, `docs/status.md` y `docs/known-issues.md` son convenciones del proyecto. |

### Mínimos de cobertura (los hace cumplir la CI)

| Zona | Al cerrar la 0002 | Al cerrar la iniciativa |
|---|---|---|
| TS puro: `player/src/utils/**` y el núcleo extraído en la 0006 | ≥ 90 % líneas | ≥ 90 % líneas · ≥ 85 % ramas |
| Hooks del reproductor (`player/src/hooks/**`, sin visualizadores) | ≥ 70 % | ≥ 85 % |
| Componentes `player/src/components/dashboard/**` | sin mínimo (los cubre e2e) | sin mínimo |
| Visualizadores | excluidos | excluidos |
| PHP crítico: saneado y validación del horario y de los campos, migración, actualización, programa en antena, config | ≥ 80 % | ≥ 90 % |
| PHP núcleo: `includes/src/**` salvo `includes/src/wp/**` (zona `core`, desde la 0005; ADR 0028) | — | ≥ 90 % |
| PHP resto (`includes/`, `admin/*.php`, `blocks/*/render.php`, `uninstall.php`) | ≥ 60 % | ≥ 80 % |
| JS de admin: lógica extraída en la 0005 | — | ≥ 85 % |

### Lo que se sabe de las specs pendientes

Se escribirán con `write-spec`. Estas notas son el punto de partida, no la spec.

- **Dónde queda cada corrección de WordPress tras la 0005:** la lógica pura vive en `RadioPlayerPage\` (`includes/src/`, ADR 0028) y las funciones `radplapag_*` son envoltorios que no cambian de firma. Una corrección va en el núcleo, con su test unitario (el `test_currently_*` del núcleo pasa a regresión junto al de integración), y el envoltorio solo cambia si cambia lo que lee o escribe en WordPress. La columna de archivo de `known-issues.md` apunta a los dos.
- **Dónde queda cada corrección del player tras la 0006:** la lógica vive en `player/src/core/` (sin React ni MUI, ADR 0029) y los hooks son adaptadores con la misma firma. Una corrección va en el núcleo, con su test (el `currently` del núcleo pasa a regresión junto al del hook o el e2e), y el hook o el componente solo cambian si cambia lo que pintan. La columna de archivo de `known-issues.md` apunta a los dos.
- **Correcciones (0007–0013), comunes a todas:**
  - cada fila se corrige con `fix-bug`: el test `currently` pasa a test de regresión en rojo y luego a verde; la fila de `known-issues.md` pasa a «corregido (versión)»;
  - la prioridad de cada fila (alta · media · baja) ordena las fases; los motivos y el detalle de cada decisión están en la columna «Decisión del usuario» de `known-issues.md`;
  - una decisión que cambie `SPEC.md` o un ADR lleva su ADR en la spec que la corrige (se indica abajo).
- **Fuera de las correcciones:** C8 (sin reconexión automática) se replica, mejora futura; C5, K4, K19, K22, K35, K40 y la sospecha del `exit` en `template_redirect` (ADR 0008): no arreglar (motivos en `known-issues.md`).
- **Release:**
  - Plugin Check sobre el zip, la checklist de las guidelines y la matriz PHP 7.4/8.4 × WP 6.6/última;
  - verificación manual: iOS y Android, una emisora real y una actualización desde la 3.4.2;
  - changelog y `== Upgrade Notice ==` (incluye el soporte efectivo de navegadores del player, Safari 17+, ADR 0027);
  - changelog y `== Upgrade Notice ==` de la 0009: `RADPLAPAG_SCHEDULE` vacío es `{}` (K17), las franjas de programas no publicados o con contraseña dejan de mostrarse (C10) y `radplapag_get_program_data( $id, true )` devuelve `null` para un programa con contraseña (ADR 0045), el meta box conserva la franja de un programa no publicado con su estado y un aviso (C10, K41), la clave `timezone` de `RADPLAPAG_CONFIG` (C9), la diferencia del reloj en `±H:MM` en vez de horas con un decimal (`+5:30`, `+5:45`; K10) y el cambio de `radplapag_is_slot_active()` (C16);
  - changelog y `== Upgrade Notice ==` de la 0010: al quitar una franja y añadir otra ya no se pierde ninguna (K15); el foco ya no se pierde en el horario (K39), y los avisos de solape se actualizan entre domingo y lunes (K16) y nombran bien el programa (K44, K74, K75); días y campos del horario con nombre accesible (AX3, AX4), errores atados a sus campos y foco al primero (K45), el meta box contraído se abre con el error (K89), un rojo más oscuro (AX5) y «Remove Time Slot» visible con el foco (K20); la URL del stream exige `http://` o `https://`, y la URL y la página se guardan cada una si es válida (K42); aviso de un stream `http` en un sitio `https` (C13); el selector de la bienvenida solo ofrece MP3 y un adjunto rechazado conserva el anterior y avisa (K37, en `== Upgrade Notice ==`); el selector de «Player Page» conserva la página no publicada con su estado (K36) y deja fuera la de entradas (K27); las descripciones del programa se cortan por caracteres y conservan las barras invertidas (K5, K34); sin «Post published.» junto a los errores (K90); fuera dos cadenas sin uso (K76, ADR 0047);
  - changelog y `== Upgrade Notice ==` de la 0013 (ADR 0049): los tres bloques guardan la emisora por su ID (`stationId`): crear, renombrar o despublicar otra emisora ya no cambia la de un bloque guardado, y una emisora despublicada deja el bloque vacío; los bloques guardados antes siguen por su posición hasta que se elige la emisora en el editor (K46, D2); el editor de los tres bloques avisa cuando la emisora ya no existe o no está publicada, previsualiza lo mismo que el front y deja elegir otra, y un bloque guardado antes muestra qué emisora usa por su posición (K47); el aviso de «Now Playing» vacío ya no sale en el `content.rendered` de la API REST (K48); los títulos y descripciones de «RPP: Weekly Schedule» y «RPP: Radio Shows List» salen traducidos en el *inserter* (K54); los bloques pintan encabezados reales (`h2` por defecto) en lugar de `header`, con el control «Heading level» (H2–H6, atributo `headingLevel`) en el panel de los tres (K53); «Now Playing» y «Schedule» ya no enlazan la página del reproductor si no se sirve (borrador, privada, con contraseña o la página de entradas; K50); «Now Playing» muestra «On Air:» también sin página del reproductor (K49); la descripción extendida de «Programs List» y «Schedule» conserva sus saltos de línea (K51); la clase del contenedor de los bloques ya no sale repetida en WordPress 6.6 (K6). En `== Upgrade Notice ==`: los encabezados `<hN>` toman los estilos del tema para `h2`–`h6` (en Twenty Twenty-Five, su fuente serif) y pueden cambiar el aspecto si el tema estilaba `header` o `h2`; los bloques guardados antes pasan a ID solo al elegir la emisora en el editor, y hasta entonces crear o despublicar otra emisora puede cambiar la que muestran;
  - del triage de la 0002: K3 (los textos se revisan con el estado final) y K28 (`readme.txt`); comprobar que la petición a terceros de `dashjs` está corregida (verificación, no asignación: la fila es de la 0007);
  - merge en `trunk`, PR `trunk` → `main`, tag `vX.Y.Z` y pasos de SVN para el usuario.
