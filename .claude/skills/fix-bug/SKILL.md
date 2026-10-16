---
name: fix-bug
description: Corrige un bug aprobado por el usuario con TDD (test de regresión primero y en rojo, arreglo mínimo, verde). Sustituye el test currently si existía y actualiza docs/known-issues.md. Úsala solo dentro de una spec de correcciones o de un hotfix.
argument-hint: "<ID de known-issues, p. ej. C3 o K2>"
---

# fix-bug

Bug: `$ARGUMENTS` (fila de `docs/known-issues.md`).

1. **Precondición:** la fila tiene la decisión del usuario «corregir» y la spec activa lo incluye (o es un `hotfix/*` aprobado). Si no, para y pregunta.
2. **Si cambia algo visible o del contrato** (`SPEC.md`), antes `write-adr`.
3. **Test de regresión primero:**
   - Si existe un test `currently`, se sustituye por uno que describe el comportamiento correcto (mismo lugar, nombre sin `currently`).
   - Si no existe, se escribe en la capa más baja que reproduce el bug.
   - Se ejecuta y **se ve en rojo** por la razón esperada (apunta la salida en el plan).
4. **Arreglo mínimo:** el cambio más pequeño que pone el test en verde. Nada de refactors de paso.
5. **Verde:** el test nuevo y toda la suite de la zona (`npm run check`; integración/e2e si la zona lo necesita).
6. **Registrar:** la fila de `docs/known-issues.md` pasa a «corregido en <versión>/<spec>» con el test. Si el arreglo cambia algo que ve el usuario, nota para el changelog en el plan de la fase.
7. Commit `fix(NNNN): <descripción> (N.M)` con el test y el arreglo juntos.

`npm run check` en verde; actualizar `docs/status.md`.
