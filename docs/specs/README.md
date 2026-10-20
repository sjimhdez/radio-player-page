# Specs — índice y hoja de ruta

> Cada trabajo empieza con una spec: `docs/specs/NNNN-slug/spec.md`. **La spec se escribe en una sesión de diseño y se ejecuta en una sesión nueva.** Las specs son pequeñas (< 250 líneas, salvo la 0001) y se redactan **justo a tiempo**: la siguiente se escribe cuando la anterior se cierra, con lo aprendido.
>
> Idiomas: docs en español; código, comentarios y commits en inglés.

## Índice

| # | Spec | Estado | Rama | Depende de |
|---|---|---|---|---|
| 0001 | [Bootstrap: spike, herramientas e ingeniería de contexto](0001-bootstrap/spec.md) | cerrada (PR #36) | `spec/0001-bootstrap` | — |
| 0002 | [Red de seguridad, auditoría y triage](0002-safety-net/spec.md) | cerrada (PR #37) | `spec/0002-safety-net` | 0001 |
| 0003 | [Dependencias del player y de los bloques](0003-player-dependencies/spec.md) | propuesta | `spec/0003-player-dependencies` | 0002 |
| 0004 | ~~Dependencias de la parte WordPress~~: descartada; los bloques van en la 0003, y la raíz, Composer y las Actions fuera de una spec ([ADR 0026](../adr/0026-grouped-dependency-upgrades.md)) | descartada | — | — |
| 0005 | Refactor de PHP y admin | pendiente de escribir | — | 0003 |
| 0006 | Refactor del player | pendiente de escribir | — | 0003 |
| 0007 | Correcciones: reproducción | pendiente de escribir | — | 0006 |
| 0008 | Correcciones: migración y actualización | pendiente de escribir | — | 0005 |
| 0009 | Correcciones: horario y programa en antena | pendiente de escribir | — | 0005, 0006 |
| 0010 | Correcciones: admin | pendiente de escribir | — | 0005, 0009 |
| 0011 | Correcciones: interfaz, i18n y accesibilidad del player | pendiente de escribir | — | 0006, 0007 |
| 0012 | Correcciones: núcleo PHP y desinstalación | pendiente de escribir | — | 0005 |
| 0013 | Correcciones: bloques | pendiente de escribir | — | 0009, 0010 |
| último | Release | pendiente de escribir | — | todas |

Las 0005 y 0006 son independientes entre sí. Se pueden hacer en cualquier orden o en paralelo, cada una en su worktree y con su rama desde `trunk`.

Las correcciones (0007–0013) salen del triage de la 0002 (fase 5): una spec por zona, numeradas por prioridad en dos pistas. La del player (0007 → 0011) arranca al cerrar la 0006; en la de WordPress, la 0008 y la 0012 arrancan al cerrar la 0005, y la 0010 espera a la 0009. La 0009 (horario) necesita la 0005 y la 0006, y la 0013 (bloques) va detrás de la 0009 y la 0010. Una fila «junto a» otra de más prioridad se corrige con ella. Las filas que cambian `SPEC.md` §3 llevan su ADR en la spec que las corrige, porque el diseño se decide allí (invariante 2). Cada fila de `docs/known-issues.md` con «corregir» está en exactamente una de ellas.

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
| 5 | Visualizadores | Siguen en el producto y quedan **congelados**: fuera del refactor y de los mínimos de cobertura. Su contrato con el reproductor (`crossOrigin = 'anonymous'` en toda fuente asignada a `audio.src`, [ADR 0004](../adr/0004-crossorigin-on-direct-sources.md); `audioRef`) se preserva y se testea. C5 y la parte del canvas de C15 solo se corrigen si el usuario lo aprueba, con un ADR. |
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
| PHP resto (`includes/`, `admin/*.php`, `blocks/*/render.php`, `uninstall.php`) | ≥ 60 % | ≥ 80 % |
| JS de admin: lógica extraída en la 0005 | — | ≥ 85 % |

### Lo que se sabe de las specs pendientes

Se escribirán con `write-spec`. Estas notas son el punto de partida, no la spec.

- **0005 Refactor de PHP y admin:**
  - *strangler*: el código nuevo en el namespace `RadioPlayerPage\` con autoloader PSR-4 propio;
  - las funciones `radplapag_*` como envoltorios;
  - la lógica pura separada de los adaptadores de WP, con TDD;
  - la lógica pura de `admin/js/*` extraída a módulos testeables, que pasan los mismos vectores del horario que PHP;
  - del triage de la 0002: K72 (las dos `phpcs:ignore` de `error_log()` del migrador llevan su motivo en la línea, ADR 0021) y el endurecimiento del `innerHTML` del admin (el DOM se construye con `textContent` / `createElement`).
- **0006 Refactor del player:**
  - núcleo `player/src/core/` sin React ni MUI: máquina de estados del audio, adaptadores por protocolo, `crossOrigin`, intro, horario, sueño, Media Session y lectura de las globales;
  - los hooks, como adaptadores finos;
  - TDD;
  - quitar las excepciones de `react-hooks` 7 que deja la 0003 (`set-state-in-effect` e `immutability`/`refs`, lista en su §4.4 y en el plan de su fase 2) y cambiar `process.env.NODE_ENV` por `import.meta.env.DEV` en `src/utils/timezone.ts`;
  - del triage de la 0002: K9 (el núcleo valida el offset), K14 (Media Session en el núcleo), K70 (cada adaptador por protocolo fija su `crossOrigin`) y las sospechas de dos `play()` concurrentes con HLS y de `pause()` durante la carga de un MP3 (el núcleo serializa `play()`/`pause()` y lo comprueba en sus tests; si se confirma un fallo visible, pasa como fila a la 0007).
- **Correcciones (0007–0013), comunes a todas:**
  - cada fila se corrige con `fix-bug`: el test `currently` pasa a test de regresión en rojo y luego a verde; la fila de `known-issues.md` pasa a «corregido (versión)»;
  - la prioridad de cada fila (alta · media · baja) ordena las fases; los motivos y el detalle de cada decisión están en la columna «Decisión del usuario» de `known-issues.md`;
  - una decisión que cambie `SPEC.md` o un ADR lleva su ADR en la spec que la corrige (se indica abajo).
- **0007 Reproducción** (tras la 0006):
  - alta: C1 (reintento sin `crossOrigin` en las fuentes directas; cambia ADR 0013/0004 → ADR), K18 (antes, verificar en Safari real; lo arregla C7), K67 (`dashjs` sin fuente de hora de terceros; **bloquea la release**);
  - media: C2, C7 (Play recarga el directo; arregla K18 y absorbe K12), K1, K11, K63, K64;
  - baja: K12, K13, K65, K66 (prioridad a revisar si iOS lo confirma).
- **0008 Migración y actualización** (tras la 0005):
  - alta: K29 (el descarte se recuerda; si necesita una opción nueva, ADR, y la opción entra en `uninstall.php` y §3.7), K30 (se descarta solo la franja inválida; amplía §3.2 → ADR);
  - media: K33 (la migración corre sin un administrador delante; cambia el paso 2 de `SPEC.md` §3.2 → ADR);
  - baja: K31, K32, y la sospecha de la auditoría 4.3: bloqueo `radplapag_migrating` atómico (`add_option()`) y reintento que no duplica lo ya creado, junto a K30 (pasa de transient a opción en §3.1 → ADR, y entra en `uninstall.php` y §3.7).
- **0009 Horario y programa en antena** (tras la 0005 y la 0006):
  - alta: C16 (raíz de C4, K8 y K52; PHP, bloques y player con los mismos vectores);
  - media: C10 (la resolución ignora los programas no publicados y el admin avisa; cambia §3.3/§3.4 → ADR, con la sospecha de las contraseñas), K8, K41 (junto a C10);
  - baja: C3, C4, C9 (la zona al player: clave nueva en una global → ADR), K10, K17 (imprimir `{}`; cambia la forma observable de una global → ADR corto, changelog y `== Upgrade Notice ==`), K52, y la sospecha de 5.8: un programa con contraseña cuenta como no publicado (bloques, `RADPLAPAG_PROGRAMS` y la resolución), junto a C10, fijado antes con un test `currently`.
- **0010 Admin** (tras la 0005 y la 0009, que también toca `station-admin.js`):
  - alta: K15 (índice = mayor índice + 1);
  - media: C13, K5, K20, K39, K42, K45, AX3, AX4 (K45, AX3, AX4 y AX5 juntas; salen de la línea base de axe);
  - baja: K16, K27, K34 (junto a K5), K36 (coordinada con el enlace a páginas no servidas de la 0013), K37, K38, K44, AX5, y las sospechas de 5.7: quitar «Entrada publicada» cuando hay error (la emisora se sigue publicando) y el meta box contraído con un error (primero se reproduce con un test; si no se confirma, se cierra sin cambios).
- **0011 Interfaz, i18n y accesibilidad del player** (tras la 0006 y la 0007, que fija los estados del audio):
  - primera tarea: los escenarios de carga y de programa expandido entran en la línea base de `a11y.spec.ts` (hueco de `withRules()`, ADR 0023), antes de AX6 y AX2;
  - alta: K56 (botón estable que cambia de estado);
  - media: C15 (el canvas no se toca, zona congelada), K57, K59 y AX6 (juntas, región `role="status"`), K60, K68 (al tocarla, quitar `localStorage` y `navigator` del detector de i18next: con `supportedLngs` el navegador ganaría a un idioma del sitio sin traducción, contra el ADR 0025; y corregir el comentario de `player/src/config/i18n.ts`, si la 0006 no lo hizo);
  - baja: C6, K58, K61 (con capturas antes y después, junto al `100vh` de iOS), K62, K69, K71, AX1, AX2;
  - K55 no se corrige (manda el idioma del sitio, ADR 0025), pero su test `currently` pasa aquí a test normal.
- **0012 Núcleo PHP y desinstalación** (tras la 0005):
  - media: C11 y K7 (juntas: `uninstall.php` limpia opciones, transients y todos los estados en cada sitio; amplía §3.7 → ADR), K21 y K43 (juntas: decodificar entidades solo de lo que se imprime para el player, sin ADR);
  - baja: K23 y la sospecha de 5.6 (juntas, un ADR que amplía §3.3: `noindex, nofollow` impreso según `blog_public` sin el filtro `wp_robots`, y `<html dir="rtl">` con `is_rtl()`; la maqueta del player en RTL queda fuera), K24, K25, K26 (sin ADR).
- **0013 Bloques** (tras la 0009 y la 0010):
  - media: K46 (atributo con el ID de la emisora, `stationIndex` de respaldo; cambia `SPEC.md` §3.5 → ADR), K53 (encabezados accesibles; el ADR elige la forma, con `SPEC.md` §3.5);
  - baja: K6, K47 (con el atributo de K46), K48, K49 y K50 (juntas; K50 coordinada con la página asignada sin publicar de la 0010), K51, K54. K49, K50 y K51 cambian el markup de §3.5: entran en el mismo ADR que K46/K53.
- **Fuera de las correcciones:** C8 (sin reconexión automática) se replica, mejora futura; C5, K4, K19, K22, K35, K40 y la sospecha del `exit` en `template_redirect` (ADR 0008): no arreglar (motivos en `known-issues.md`).
- **Release:**
  - Plugin Check sobre el zip, la checklist de las guidelines y la matriz PHP 7.4/8.4 × WP 6.6/última;
  - verificación manual: iOS y Android, una emisora real y una actualización desde la 3.4.2;
  - changelog y `== Upgrade Notice ==`;
  - del triage de la 0002: K3 (los textos se revisan con el estado final) y K28 (`readme.txt`); comprobar que la petición a terceros de `dashjs` está corregida (verificación, no asignación: la fila es de la 0007);
  - merge en `trunk`, PR `trunk` → `main`, tag `vX.Y.Z` y pasos de SVN para el usuario.
