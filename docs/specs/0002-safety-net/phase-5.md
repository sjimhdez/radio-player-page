# Spec 0002 · Fase 5 — Triage con el usuario
Estado: en curso · Inicio: 2026-10-18 · ADRs: 0005, 0007, 0018, 0021, 0023 (y los que salgan de decisiones que cambien `SPEC.md`)

## Contexto
- Fases 1–4 cerradas. `docs/known-issues.md` tiene 94 filas (C1–C16, K1–K72, AX1–AX6), 89 «pendiente»; ya decididas: C8 (replicar, mejora futura), K2 (tooling), K4 (no arreglar, ADR 0005), C12 y C14 (no se reproduce / no aplica → «—»). Los números de las verificaciones usan la penúltima columna (`$(NF-1)`): C16 y K13 llevan `\|` en la descripción.
- `trunk` no ha avanzado desde que salió la rama (sin merge). PR en borrador #37.
- Además de las filas, `docs/status.md` lleva al triage: `exit` en `template_redirect` frente a plugins de acceso restringido (`audit/core.md` §5), `<html>` sin `dir` en RTL (ídem), programas con contraseña en bloques y `RADPLAPAG_PROGRAMS` (`audit/blocks.md` §5), hueco de `withRules()` (`audit/player.md` §4), gravedad AX6 (media) vs K59 (baja), endurecimiento de `innerHTML` del admin (`audit/admin.md` §5 → 0005), sospechas del player (dos `play()` concurrentes con HLS, `pause()` durante la carga de un MP3) y las de experiencia del admin (aviso «Entrada publicada» con error, meta box contraído con error).
- Esta fase **no toca código publicado** (spec §0.4) ni decide por el usuario (spec §5 fase 5).

## Objetivo
Cada fila de `known-issues.md` y cada sospecha sale con una decisión del usuario (corregir en qué spec y con qué prioridad · otra spec · no arreglar), y la hoja de ruta lista las specs 0007+ por zona con sus filas.

## Método de cada tarea de triage
1. Leo las filas del grupo y sus tests; para cada una propongo decisión y prioridad con motivo, sin decidir.
2. `AskUserQuestion` en tandas de ≤ 4 filas (opciones: mi recomendación primero, alternativas, «Other» para matizar).
3. Escribo la decisión en la columna «Decisión del usuario» con este formato:
   - `corregir: <zona> (prioridad alta|media|baja)` — la zona se convierte en número de spec en 5.9;
   - `otra spec: 000N (<motivo corto>)`;
   - `no arreglar: <motivo>`.
   Si el usuario cambia una gravedad, se cambia la columna y se anota.
4. Si una decisión implica cambiar la redacción de `SPEC.md` (K17, K55, §3.3/§3.5 de los informes) o contradice un ADR: `write-adr` en la misma tarea, y `SPEC.md` en el mismo commit.
5. Commit `docs(0002): triage <zona> (5.N)` con `known-issues.md` (y el ADR si lo hay); `phase-5.md` marca la tarea anterior.

## Criterios de aceptación
| Criterio | Cómo se verifica |
|---|---|
| A10: ninguna fila con «pendiente» en «Decisión del usuario» | `awk -F'|' '/^\| (C|K|AX)[0-9]/ && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío |
| Las sospechas de la lista del Contexto tienen decisión | checklist en `phase-5.md` §Sospechas, una línea cada una con la decisión |
| Hoja de ruta con las specs 0007+ por zona y sus filas | `docs/specs/README.md`: índice y «Lo que se sabe» con cada fila «corregir» en una spec; revisión manual |
| Toda fila «corregir» está en exactamente una spec de la hoja de ruta | script de 5.9 (cruza IDs de `known-issues.md` con `README.md`) |
| `blame.markUnblamableLines` documentado | `grep -n markUnblamableLines .git-blame-ignore-revs` |
| Sin cambios en código publicado | `git diff --stat origin/trunk...HEAD -- radio-player-page.php includes admin blocks/*/render.php blocks/*/src player/src uninstall.php` igual que al cierre de la fase 4 |

## Tareas

### 5.1 `blame.markUnblamableLines` en `.git-blame-ignore-revs` (≤ 1 h)
- Qué: añadir a la cabecera `git config blame.markUnblamableLines true` y una línea sobre las 82 líneas de `station-admin.js` que creó la 3.4 (desviación aceptada, 2026-10-18).
- Archivos: `.git-blame-ignore-revs`.
- Test: — (comentario de documentación).
- Verificación: `grep -n markUnblamableLines .git-blame-ignore-revs && npm run check`
- [x] hecha · commit: f4aa0ee

### 5.2 Triage · horario y programa en antena (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: C3, C4, C9, C10, C16, K8, K9, K10, K17 (bug o redacción de `SPEC.md` §3), K52.
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si K17 pasa a redacción); `phase-5.md`.
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (C3|C4|C9|C10|C16|K8|K9|K10|K17|K52) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [x] hecha · commit: aa5a4c5

### 5.3 Triage · player, reproducción (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: C1, C2, C7, K1, K11, K12, K13, K14, K18, K63, K64, K65, K66, K67, K70. Sospechas: dos `play()` concurrentes con HLS; `pause()` durante la carga de un MP3.
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si una decisión cambia el contrato); `phase-5.md` (sospechas y la tarea anterior).
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (C1|C2|C7|K1|K11|K12|K13|K14|K18|K63|K64|K65|K66|K67|K70) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [x] hecha · commit: 9a3a04c

### 5.4 Triage · player, interfaz, i18n y accesibilidad (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: C5 (zona congelada, ADR 0018), C6, C15, K55 (bug o redacción de `SPEC.md` §3.8), K56, K57, K58, K59, K60, K61, K62, K68, K69, K71, AX1, AX2, AX6. Sospechas: gravedad AX6 vs K59; hueco de `withRules()` (dos escenarios nuevos en la línea base, ADR 0023: ¿en qué spec?).
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si una decisión cambia el contrato); `phase-5.md` (sospechas y la tarea anterior).
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (C5|C6|C15|K55|K56|K57|K58|K59|K60|K61|K62|K68|K69|K71|AX1|AX2|AX6) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [x] hecha · commit: 32c27e2

### 5.5 Triage · migración y actualización (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: K29, K30, K31, K32, K33, K72.
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si una decisión cambia el contrato); `phase-5.md` (sospechas y la tarea anterior).
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (K29|K30|K31|K32|K33|K72) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [x] hecha · commit: f367536

### 5.6 Triage · núcleo PHP, CPT, desinstalación y guidelines (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: C11, K3, K7, K21, K22, K23, K24, K25, K26, K27, K28. Sospechas: `exit` en `template_redirect` frente a plugins de acceso restringido; `<html>` sin `dir` en RTL.
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si una decisión cambia el contrato); `phase-5.md` (sospechas y la tarea anterior).
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (C11|K3|K7|K21|K22|K23|K24|K25|K26|K27|K28) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [x] hecha · commit: aa75d9a

### 5.7 Triage · admin (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: C13, K5, K15, K16, K19, K20, K34, K35, K36, K37, K38, K39, K40, K41, K42, K43, K44, K45, AX3, AX4, AX5. Sospechas: endurecimiento de `innerHTML` (→ 0005); «Entrada publicada» junto al error; meta box contraído con un error.
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si una decisión cambia el contrato); `phase-5.md` (sospechas y la tarea anterior).
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (C13|K5|K15|K16|K19|K20|K34|K35|K36|K37|K38|K39|K40|K41|K42|K43|K44|K45|AX3|AX4|AX5) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [x] hecha · commit: 62e188a

### 5.8 Triage · bloques (≤ 1 h)
- Qué: triage con el usuario según el «Método». Filas: K6, K46 (contrato §3.5: corregir pide ADR), K47, K48, K49, K50, K51, K53 (markup = contrato), K54. Sospecha: programas con contraseña en los bloques y en `RADPLAPAG_PROGRAMS`.
- Archivos: `docs/known-issues.md` (+ ADR y `SPEC.md` si una decisión cambia el contrato); `phase-5.md` (sospechas y la tarea anterior).
- Test: — (decisiones; sin código).
- Verificación: `awk -F'|' '/^\| (K6|K46|K47|K48|K49|K50|K51|K53|K54) / && $(NF-1) ~ /pendiente/' docs/known-issues.md` vacío
- [ ] hecha · commit: —

### 5.9 Hoja de ruta de las specs de correcciones (≤ 1 h)
- Qué: con el usuario, convertir las zonas «corregir» en specs 0007+ (número, nombre, orden, dependencias) y escribirlas en el índice y en «Lo que se sabe» de `docs/specs/README.md`, cada una con sus filas y prioridades; las filas «otra spec» se añaden a las notas de 0003–0006 / release. Sustituir en `known-issues.md` la zona por el número de spec. Sustituir la lista de candidatas 0007+ actual.
- Archivos: `docs/specs/README.md`, `docs/known-issues.md`.
- Test: — (hoja de ruta).
- Verificación: el criterio A10 (awk vacío) y un script de una línea que lista los IDs con `corregir:` y comprueba que cada uno aparece en `docs/specs/README.md`: `for id in $(awk -F'|' '/^\| (C|K|AX)[0-9]/ && $(NF-1) ~ /corregir/ {gsub(/ /,"",$2); print $2}' docs/known-issues.md); do grep -q "\b$id\b" docs/specs/README.md || echo "falta $id"; done` sin salida
- [ ] hecha · commit: —

## Sospechas (decisión del usuario)
- [x] `exit` en `template_redirect` frente a plugins de acceso restringido (5.6) → no arreglar: es el diseño del ADR 0008 y no se reproduce sin un plugin de terceros; si llega un informe, se trata entonces
- [x] `<html>` sin `dir` en sitios RTL (5.6) → corregir: núcleo (prioridad baja) — `dir="rtl"` con `is_rtl()`, test simulando la dirección; la maqueta del player en RTL queda fuera (otra fila si se ve mal)
- [x] Programas con contraseña en bloques y `RADPLAPAG_PROGRAMS` (5.8) → corregir: horario (prioridad baja), junto a C10 — un programa con contraseña cuenta como no publicado (bloques, `RADPLAPAG_PROGRAMS` y la resolución); antes se fija con un test `currently`
- [x] Hueco de `withRules()` en `player-a11y.spec.ts` (5.4) → corregir: interfaz, primera tarea de esa spec: los escenarios de carga y de programa expandido entran en la línea base de `a11y.spec.ts` (ADR 0023) antes de arreglar AX6 y AX2
- [x] Gravedad AX6 vs K59 (5.4) → K59 sube de baja a media; las dos, corregir: interfaz (prioridad media), juntas
- [x] Endurecimiento de `innerHTML` del admin (5.7) → otra spec: 0005 (endurecimiento, no bug: el refactor del admin construye el DOM con `textContent` / `createElement`)
- [x] Dos `play()` concurrentes con HLS; `pause()` durante la carga de un MP3 (5.3) → otra spec: 0006 (el núcleo serializa `play()`/`pause()` y lo comprueba con sus tests; si se confirma un fallo visible, pasa como fila a la spec de reproducción)
- [x] «Entrada publicada» con error; meta box contraído con error (5.7) → las dos, corregir: admin (prioridad baja). «Entrada publicada»: si hay error se quita el mensaje de core; la emisora se sigue publicando (contrato, §3.1 y §3.6). Meta box contraído: primero se reproduce con un test; si se confirma, se abre el meta box con el error, y si no, se cierra sin cambios
- [x] Bloqueo `radplapag_migrating` no atómico; migración cortada a medias (5.5, auditoría 4.3) → corregir: migración (prioridad baja) — bloqueo atómico con `add_option()` y un reintento que no duplica lo ya creado, junto a K30

## Decisiones abiertas → ADR
- Cualquier decisión que cambie la redacción de `SPEC.md` (candidatas: K17, K55, K29 —§3.2 dice descartable—, K46, K53) o un ADR: `write-adr` en su tarea.

## Verificación de la fase
- `npm run check` en verde.
- Los criterios de aceptación de arriba.
- Sin cambios en código publicado (`git diff --stat` del criterio).
