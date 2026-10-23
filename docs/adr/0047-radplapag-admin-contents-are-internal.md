# ADR 0047 — El contenido de `radplapagAdmin` es interno

- Estado: aceptado · Fecha: 2026-10-23 · Spec: 0010 (fase 3, tarea 3.1)

## Contexto

- `SPEC.md` §3.6 nombra `radplapagAdmin` (las cadenas del JS de `admin/admin-strings.php`, localizadas por `radplapag_get_admin_strings()`) sin decir si su contenido es contrato. `AdminScreensTest::test_admin_strings_keys` fija la lista exacta de claves de `strings`, así que en la práctica cada clave se trataba como contrato.
- **K76 (baja).** Dos cadenas traducibles ya no las usa nadie: `completeTimeFields` («Please complete all time fields.»), solo leída en la 3.4.2 por una rama inalcanzable que la spec 0005 (2.3) quitó, y `startEndSame` («Start and end times cannot be the same.»), sin uso desde la spec 0009 (3.3, C3: el admin acepta `start == end`). Los traductores las ven sin uso, y se quedaron solo porque el test fija las claves.
- `radplapagAdmin` lo localiza el plugin para sus propios scripts del admin (`radplapag-station-admin`, `radplapag-program-admin`); no hay filtro para cambiarlo, nada en wordpress.org lo documenta y su forma ya cambió en las specs 0005 y 0009 (`programs` con `label` y `public`, ADR 0045; claves nuevas de D11 en la 0010). `window.radplapagScheduleRules` ya es interno (ADR 0028).
- Riesgo 5 de la spec 0010: un tercero que lea `radplapagAdmin.strings.startEndSame`.

Decisión del usuario del 2026-10-23 (columna de K76 en [`known-issues.md`](../known-issues.md)); spec 0010, §3.

## Decisión

1. **El contenido de `radplapagAdmin` es interno:** las claves de `strings`, `programs`, `assignedPlayerPages` y cualquier otra que entre. Pueden cambiar, entrar o salir entre versiones sin ADR, como `window.radplapagScheduleRules`.
2. `radplapag_get_admin_strings()` **conserva su firma** (función global `radplapag_*`, contrato por la regla de §3.4), pero el array que devuelve no es contrato.
3. Los handles de los scripts y el nombre del objeto (`radplapagAdmin`) no cambian.
4. Salen `completeTimeFields` y `startEndSame` (tarea 3.11). `AdminScreensTest::test_admin_strings_keys` sigue fijando las claves, como red contra quitar por error una que el JS usa, y se actualiza en el mismo commit que la cadena.

## Consecuencias

- Se pueden quitar cadenas sin uso y cambiar la forma de los datos del admin sin ADR; los traductores dejan de ver cadenas muertas.
- Un tercero que leyera `radplapagAdmin.strings.startEndSame` o `completeTimeFields` recibe `undefined`. Va en el changelog de la release.
- Lo que usa el JS del admin sigue protegido por `test_admin_strings_keys` y por los tests de `tests/js/admin/`.

## Alternativas descartadas

- **Dejar las dos cadenas para siempre:** cada cadena muerta es trabajo de traducción perdido y una señal de las guidelines (K76); y cada cambio futuro de `radplapagAdmin` pediría su propio ADR.
- **Declarar internas solo las dos claves que salen:** no resuelve el caso general; la siguiente cadena sin uso volvería a necesitar un ADR.
- **Hacer interna también `radplapag_get_admin_strings()`:** es una función global con prefijo y la regla de §3.4 la protege; cambiar su firma no aporta nada.

Evidencia: [`spec.md`](../specs/0010-admin-fixes/spec.md) (§3, riesgo 5), [`phase-3.md`](../specs/0010-admin-fixes/phase-3.md) (tarea 3.11), fila K76 de [`known-issues.md`](../known-issues.md).
