---
name: characterize
description: Fija con tests el comportamiento actual de un archivo o módulo existente antes de tocarlo (tests de caracterización, Feathers). Escribe los tests contra el código sin modificarlo, los valida con una mutación temporal y apunta las rarezas en docs/known-issues.md. Úsala antes de refactorizar, actualizar o corregir código que aún no tiene tests.
argument-hint: "<archivo o módulo>"
---

# characterize

Objetivo: `$ARGUMENTS`.

**No se cambia el código caracterizado.** Si hace falta una costura mínima (*seam*) para poder testear, se para: va justificada en el plan de la fase y aprobada antes de tocar nada.

## 1. Inventario (antes de escribir tests)

Lee el código y apunta, en el plan de la fase o en el propio test como lista de casos:

- **Entradas:** argumentos, `$_POST`/`$_GET`, opciones y meta que lee, globales `window.RADPLAPAG_*`, hora y zona horaria, `userAgent`.
- **Salidas:** valores de retorno, HTML impreso, JSON, estado de React.
- **Efectos:** hooks que registra o dispara, escrituras en BD (meta, opciones, transients), redirecciones, `exit`, eventos de `<audio>`, `localStorage`.
- **Ramas:** cada `if`/`switch` y cada valor por defecto o de reserva.

## 2. Tests

- Capa según `.claude/rules/testing.md`: lógica pura → unit; WP → integración; navegador o página limpia → e2e (ADR 0001).
- Un comportamiento por test. Los datos, con fixtures (`tests/fixtures/`) o constructores pequeños en el test.
- **Lo raro se fija tal cual**: `test_currently_<qué_hace>` / `it('currently …')`, con un comentario que enlace la fila de `docs/known-issues.md`. No se «arregla» el test para que diga lo correcto.
- Tiempo, zona horaria y red deterministas (fake timers, `TZ`, sin internet).

## 3. Comprobar que los tests muerden

Por cada grupo de tests, una **mutación temporal** del código caracterizado (invertir una condición, quitar una asignación, cambiar un valor por defecto) → al menos un test falla → se revierte la mutación (`git diff` limpio sobre el código). Apunta en el commit qué mutación se probó.

## 4. Registrar

- Cada rareza o bug encontrado: fila nueva en `docs/known-issues.md` (ID `K<n>`, origen «caracterización», descripción, archivo y test, gravedad propuesta, decisión del usuario pendiente). Si coincide con un `C*` heredado, se actualiza esa fila («confirmado» o «no se reproduce»).
- Commit `test(NNNN): characterize <zona> (N.M)`.

`npm run check` en verde; actualizar `docs/status.md`.
