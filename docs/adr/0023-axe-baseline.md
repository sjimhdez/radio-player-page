# ADR 0023 — Línea base de axe

- Estado: aceptado · Fecha: 2026-10-17 · Spec: 0002 (fase 2)

## Contexto
La spec 0002 (§4.4, escenario 12) pasa axe (`@axe-core/playwright`) por la página del reproductor, la página de bloques y los meta boxes del plugin. La 3.4.2 ya tiene violaciones. Medidas el 2026-10-17 en Chromium y WebKit, sobre WP 7.1.3 y la siembra e2e, son cuatro reglas: `region` en el reproductor, `heading-order` en el modal del horario y en el meta box del horario, y `label` y `select-name` en las franjas del meta box del horario. Ninguna aparece en la página de bloques ni en el meta box del programa. Si se exigiera «cero violaciones», el escenario no podría entrar sin corregir antes el producto, y en la 0002 no se corrige nada (las correcciones van en una spec de correcciones).

## Decisión
- El criterio es **«ninguna violación nueva»**, no «cero». `tests/e2e/a11y.spec.ts` falla con cualquier violación que no esté en `tests/e2e/a11y-baseline.json` y deja un aviso (anotación `warning` y una línea en la consola) por cada entrada que ya no aparece. El aviso no hace fallar el test.
- La clave de cada entrada es `página · regla · selector`. El selector es el que da axe, sin lo que cambia entre builds: las clases con hash de Emotion pasan a `.css-*` y los ids de `useId()` de React a `#_r_*_`. Los nodos que solo se diferenciaban por eso comparten una clave. Cada entrada guarda `impact`, `help` y los navegadores en los que aparece. El test solo compara las entradas de su navegador.
- La línea base solo se reescribe con `RADPLAPAG_UPDATE_A11Y_BASELINE=1`. Cada test reescribe las entradas de su página y de su navegador, así que hay que pasar los dos proyectos. Cada cambio en el archivo se revisa en el diff del commit.
- Cada regla de la línea base tiene una fila `axe` en `docs/known-issues.md` (AX1–AX4). Lo que axe no detecta va en un test `currently` con su fila: los `alt` literales (C15) y el foco invisible de «Remove Time Slot» (K20).
- Corregir una violación (en una spec de correcciones) quita sus entradas de la línea base en el mismo commit. Una entrada nueva solo se acepta con la decisión del usuario en el plan de la fase.

## Consecuencias
- El escenario entra ya y protege lo que funciona: un cambio de UI que añada una violación lo para la CI.
- Subir MUI o React (specs 0003/0004) puede cambiar los selectores aunque no cambie la accesibilidad. Entonces se reescribe la línea base y el diff muestra si solo cambian los selectores.
- Al normalizar `.css-*`, dos nodos distintos de una misma regla pueden compartir clave, y una violación nueva en un nodo con la misma forma no se detecta. Es el precio de una clave estable entre builds.
- axe no comprueba la calidad del texto alternativo ni la visibilidad del foco: los cubren tests explícitos, no esta línea base.
- La revisión de `a11y-reviewer` en `close-phase` compara con esta línea base.

## Alternativas descartadas
- **Exigir cero violaciones:** obliga a corregir el producto dentro de la 0002, en contra de la spec.
- **Desactivar las reglas que fallan (`disableRules`):** esconde la regla entera, también en los nodos que hoy la cumplen.
- **Contar violaciones por regla:** un número no dice dónde está la nueva, y una corrección compensaría una regresión.
- **Selectores de axe tal cual:** los hashes de Emotion y los ids de React cambian con cada build y la línea base fallaría sin cambios de accesibilidad.

Evidencia: `tests/e2e/a11y.spec.ts`, `tests/e2e/a11y-baseline.json`, tarea 2.18 de [`phase-2.md`](../specs/0002-safety-net/phase-2.md).
