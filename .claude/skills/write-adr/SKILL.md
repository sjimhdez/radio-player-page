---
name: write-adr
description: Escribe un ADR en docs/adr/ cuando se toma o cambia una decisión de arquitectura o de proceso, y actualiza en el mismo commit SPEC.md, la spec activa o las rules que contradiga. Úsala siempre que una decisión no se deduzca del código o contradiga SPEC.md, la spec o un ADR anterior.
argument-hint: "<título corto>"
---

# write-adr

Decisión: `$ARGUMENTS`.

1. **Número:** el siguiente libre en `docs/adr/` (4 dígitos). Archivo: `NNNN-titulo-en-kebab-case-en-ingles.md`.
2. **Plantilla** (en español):

```md
# ADR NNNN — <Título>

- Estado: propuesto | aceptado | sustituido por [NNNN](NNNN-….md) · Fecha: AAAA-MM-DD · Spec: NNNN (fase N)

## Contexto
<qué problema o fuerza obliga a decidir; datos medidos si los hay>

## Decisión
<la decisión, en forma verificable>

## Consecuencias
- <qué se gana, qué se pierde, qué hay que vigilar, qué test lo protege>

## Alternativas descartadas
- **<alternativa>:** por qué no.

Evidencia: <enlace al informe del spike, al plan o al test> (opcional)
```

3. **Retroactivo** (decisión que ya estaba en el código): el contexto cuenta por qué se tomó, con referencias al código o a la versión en la que entró (`git log`, tags). Fecha: la de hoy; el texto indica desde qué versión rige.
4. **Si sustituye a otro ADR:** el antiguo pasa a `sustituido por NNNN`; su contenido no se reescribe ni se borra.
5. **Si contradice `SPEC.md`, la spec activa, una rule o `CLAUDE.md`:** se actualizan en el mismo commit y enlazan el ADR.
6. **Índice:** fila nueva en `docs/adr/README.md` (número, decisión, estado, origen).
7. Si la decisión necesita al usuario: estado `propuesto` y una línea en «Bloqueos / preguntas para el humano» de `docs/status.md`.

`npm run check` en verde; actualizar `docs/status.md`.
