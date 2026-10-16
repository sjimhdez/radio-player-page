# ADR 0001 — Caracterizar la página limpia por HTTP

- Estado: aceptado · Fecha: 2026-10-16 · Spec: 0001 (fase 0, R2)

## Contexto

`radplapag_output_clean_page()` imprime la página del reproductor y termina con `exit`. Un test de PHPUnit no puede llamarla sin morir con ella. Hay que fijar su salida (spec 0002) **sin tocar el código** antes de tener la red de seguridad (spec 0001, §5.2).

## Decisión

La página limpia se caracteriza con un **snapshot por HTTP** contra wp-env, normalizado (origen, también escapado en JSON; carpeta de subidas `AAAA/MM`; `timezoneOffset`; IDs de posts mapeados a nombres). Va en la capa e2e (Playwright `request`) y cubre también los casos en los que la página **no** se intercepta.

## Consecuencias

- No hace falta ninguna costura antes de caracterizar.
- El snapshot recorre el camino real (`template_redirect` → `exit`).
- Necesita wp-env y un fixture creado en un entorno reseteado. Los IDs no son deterministas, así que el normalizador debe mapearlos.
- `timezoneOffset` depende de la fecha (horario de verano). El horario de verano se cubre en unit/integración, no en este snapshot.
- La costura (una función que devuelve el HTML, con `radplapag_output_clean_page()` como envoltorio que hace `echo` + `exit`) queda como **primer paso del refactor de la 0005**. El spike demostró que su salida es idéntica byte a byte a la de HTTP; este snapshot es el test que lo garantiza.

## Alternativas descartadas

- **Costura antes de caracterizar:** funciona, pero modifica el código antes de tener tests, que es justo lo que §5.2 prohíbe.
- **`@runInSeparateProcess` + buffer de salida:** `exit` mata también el proceso hijo, y PHPUnit no recibe el resultado.
- **Extensiones como `uopz` para interceptar `exit`:** no están en las imágenes de wp-env ni en la CI, y ocultan el comportamiento real.

Evidencia: [`docs/spikes/0001-phase-0.md`](../spikes/0001-phase-0.md), sección R2.
