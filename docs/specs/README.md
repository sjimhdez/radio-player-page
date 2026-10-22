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
| 0007 | [Correcciones: reproducción](0007-playback-fixes/spec.md) | propuesta | `spec/0007-playback-fixes` | 0006 |
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
  - **0008:** el plan de la migración en `Migration\Legacy_Plan` (K30, K32, K79) y la escritura y la reversión en `WP\Migration_Writer` (K30, K31; la validación del horario sigue en el escritor, tras crear los programas); las decisiones de la actualización en `Upgrade\Upgrade_Policy` (K4, K29, K32, K33), con los avisos, el descarte y los ganchos en `includes/radplapag-upgrade.php` (K29, K33).
  - **0009:** `Schedule\Time` (C16), `Schedule\Slot_Validator` (C3, C10, K41), `Schedule\Now_Playing_Resolver` (C16, K52), `Schedule\Schedule_View` (C10), `Player\Globals_Builder` (C9, C10, K17, K78) y `WP\Program_Repository` (el filtro de publicados de C10); en el admin, `admin/js/schedule-rules.js` (C3). Los vectores siguen en `tests/fixtures/schedule-vectors.json` (capas `php` y `admin`).
  - **0010:** las reglas del horario en `admin/js/schedule-rules.js` (K44, K74, K75) y el DOM en `admin/js/station-admin.js` (K15, K16, K39, K45, AX3, AX4); el guardado en `Station\Field_Sanitizer` + `WP\Station_Meta_Saver` (C13, K37, K42) y `Program\Field_Sanitizer` + `WP\Program_Meta_Saver` (K5, K34); `Schedule\Slot_Validator` (K38). El render de los meta boxes sigue en `includes/radplapag-*-cpt.php` (K36, AX3, AX4).
  - **0012:** la lectura en `WP\Station_Repository` y `WP\Program_Repository` (K21), el guardado del programa en `WP\Program_Meta_Saver` (K43), las globales en `Player\Globals_Builder` (K21, K43) y la búsqueda de la emisora en `Data\Stations` (K24). La página limpia, las capacidades y `uninstall.php` no se movieron (C11, K7, K23, K25, K26).
  - **0013:** el orden de `stationIndex` en `WP\Station_Repository` (K46); los datos de los bloques en `Schedule\Schedule_View`, `Programs_List_View` y `Now_Playing_Resolver`; los enlaces a la página (K50) y el markup siguen en `includes/radplapag-*-block.php` y `blocks/*/render.php`.
- **Dónde queda cada corrección del player tras la 0006:** la lógica vive en `player/src/core/` (sin React ni MUI, ADR 0029) y los hooks son adaptadores con la misma firma. Una corrección va en el núcleo, con su test (el `currently` del núcleo pasa a regresión junto al del hook o el e2e), y el hook o el componente solo cambian si cambia lo que pintan. La columna de archivo de `known-issues.md` apunta a los dos.
  - **0009:** el horario sigue en `utils/program-schedule.ts` (C16, K8, K52; D3), que usa `core/schedule/now-playing.ts`; los vectores, en `tests/fixtures/schedule-vectors.json` (`schedule-vectors.test.ts`).
  - **0011:** la interfaz sigue en los componentes de `components/dashboard/` (C6, C15, K56–K61, K69, AX1, AX2, AX6), que solo pintan; i18n en `config/i18n.ts` (K55, K62, K68). El error visible es un valor derivado en `Dashboard` y el foco al cancelar el sueño (K58), en `SleepTimer.tsx` e `index.tsx`.
- **Correcciones (0007–0013), comunes a todas:**
  - cada fila se corrige con `fix-bug`: el test `currently` pasa a test de regresión en rojo y luego a verde; la fila de `known-issues.md` pasa a «corregido (versión)»;
  - la prioridad de cada fila (alta · media · baja) ordena las fases; los motivos y el detalle de cada decisión están en la columna «Decisión del usuario» de `known-issues.md`;
  - una decisión que cambie `SPEC.md` o un ADR lleva su ADR en la spec que la corrige (se indica abajo).
- **0008 Migración y actualización** (tras la 0005):
  - alta: K29 (el descarte se recuerda; si necesita una opción nueva, ADR, y la opción entra en `uninstall.php` y §3.7), K30 (se descarta solo la franja inválida; amplía §3.2 → ADR);
  - media: K33 (la migración corre sin un administrador delante; cambia el paso 2 de `SPEC.md` §3.2 → ADR);
  - baja: K31, K32, y la sospecha de la auditoría 4.3: bloqueo `radplapag_migrating` atómico (`add_option()`) y reintento que no duplica lo ya creado, junto a K30 (pasa de transient a opción en §3.1 → ADR, y entra en `uninstall.php` y §3.7).
- **0009 Horario y programa en antena** (tras la 0005 y la 0006):
  - **enfoque: rehacer el modelo, no parchear filas** (usuario, 2026-10-21). C16 es la raíz de C4, K8 y K52, y el mismo modelo («día + horas») está tres veces: PHP (`Schedule\Time`, `Now_Playing_Resolver`, `Slot_Validator`), player (`utils/program-schedule.ts`, `core/schedule/now-playing.ts`) y admin (`admin/js/schedule-rules.js`: C3, K16, K74, K75). Propuesta de partida: cada franja es un intervalo en minutos de la semana (0–10080) que da la vuelta al domingo, y de él salen el programa actual y el siguiente, los solapes y las 24 h, igual en los tres lenguajes, con `tests/fixtures/schedule-vectors.json` como red; el player trabaja con la zona (`Intl`, C9) y no con un desfase (K10). La spec decide con `write-adr` si cambia algo de §3.3/§3.4; las filas siguen cerrándose con su test de regresión;
  - alta: C16 (raíz de C4, K8 y K52; PHP, bloques y player con los mismos vectores);
  - media: C10 (la resolución ignora los programas no publicados y el admin avisa; cambia §3.3/§3.4 → ADR, con la sospecha de las contraseñas), K8, K41 (junto a C10);
  - baja: C3, C4, C9 (la zona al player: clave nueva en una global → ADR), K10, K17 (imprimir `{}`; cambia la forma observable de una global → ADR corto, changelog y `== Upgrade Notice ==`), K52, K78 (junto a K17: `RADPLAPAG_PROGRAMS` sale de las franjas que se imprimen), y la sospecha de 5.8: un programa con contraseña cuenta como no publicado (bloques, `RADPLAPAG_PROGRAMS` y la resolución), junto a C10, fijado antes con un test `currently`.
- **0010 Admin** (tras la 0005 y la 0009, que también toca `station-admin.js`):
  - **enfoque candidato: rehacer el editor de franjas** de `admin/js/station-admin.js` como estado → render, en vez de parchear su DOM imperativo (usuario, 2026-10-21; se confirma en la sesión de diseño tras leer el archivo entero). Quitaría de raíz K15 (índice por número de filas), K39 (reordenar con `appendChild` pierde el foco) y K16, y dejaría K45, AX3 y AX4 en un solo sitio. Restricción: los `name` del formulario (`radplapag_station_schedule[día][i][…]`) no cambian; las reglas salen del modelo de la 0009;
  - alta: K15 (índice = mayor índice + 1);
  - media: C13, K5, K20, K39, K42, K45, AX3, AX4 (K45, AX3, AX4 y AX5 juntas; salen de la línea base de axe);
  - baja: K16, K27, K34 (junto a K5), K36 (coordinada con el enlace a páginas no servidas de la 0013), K37, K38, K44, K74, K75, AX5, y las sospechas de 5.7: quitar «Entrada publicada» cuando hay error (la emisora se sigue publicando) y el meta box contraído con un error (primero se reproduce con un test; si no se confirma, se cierra sin cambios).
- **0011 Interfaz, i18n y accesibilidad del player** (tras la 0006 y la 0007, que fija los estados del audio):
  - la maqueta se rehace en flujo (K61, AX1, `100vh` de iOS, región de estado de K59/AX6), no se parchea; parte del valor único de la 0007 que elige entre visualizador y animación estática (ADR 0031);
  - estados del audio que pinta, fijados por la 0007 (ADR 0034): `status`, `loading`, `introLocked`, `canVisualize` y `volumeControllable` de la instantánea del controlador. El error visible es `status === 'error'` sin `loading`; «Sleep mode» está deshabilitado mientras `introLocked` (ADR 0035); el deslizador de volumen sale de `volumeControllable` (ADR 0036). K83 (durante el reintento de C1 se publica `error` sin `loading`) sigue pendiente de asignar: si va aquí, antes de volver a `useSyncExternalStore` (ADR 0030);
  - primera tarea: los escenarios de carga y de programa expandido entran en la línea base de `a11y.spec.ts` (hueco de `withRules()`, ADR 0023), antes de AX6 y AX2;
  - alta: K56 (botón estable que cambia de estado);
  - media: C15 (el canvas no se toca, zona congelada), K57, K59 y AX6 (juntas, región `role="status"`), K60, K68 (al tocarla, quitar `localStorage` y `navigator` del detector de i18next: con `supportedLngs` el navegador ganaría a un idioma del sitio sin traducción, contra el ADR 0025; y corregir el comentario de `player/src/config/i18n.ts`, si la 0006 no lo hizo);
  - baja: C6, K58, K61 (con capturas antes y después, junto al `100vh` de iOS), K62, K69, AX1, AX2 (K71 ya lo corrigió la 0003);
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
  - changelog y `== Upgrade Notice ==` (incluye el soporte efectivo de navegadores del player, Safari 17+, ADR 0027);
  - del triage de la 0002: K3 (los textos se revisan con el estado final) y K28 (`readme.txt`); comprobar que la petición a terceros de `dashjs` está corregida (verificación, no asignación: la fila es de la 0007);
  - merge en `trunk`, PR `trunk` → `main`, tag `vX.Y.Z` y pasos de SVN para el usuario.
