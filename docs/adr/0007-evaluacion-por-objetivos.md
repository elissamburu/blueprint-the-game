# 0007 · Evaluación basada en objetivos explícitos (hard/soft)

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
"Óptimo" no existe sin requisitos. Lambda vs Fargate vs EC2 es verde, naranja o rojo según el tráfico, el costo, la operación y el equipo. Sin requisitos explícitos, las discusiones de calibración en los PRs no tienen fin y el jugador no entiende el porqué.

## Decisión
- Cada escenario declara `objectives` con `kind: hard | soft` y una categoría (costo, tráfico, operación, etc.).
- `optimal` y `acceptable` **deben** referenciar los objetivos que justifican el grado.
- Violar un objetivo `hard` ⇒ **rojo** (`incorrect` con `violates`), aunque el servicio funcione técnicamente.
- Cumplir el rol pero perder contra un objetivo `soft` ⇒ **naranja**.
- Un servicio no declarado ⇒ rojo con explicación genérica derivada del catálogo.
- El motor (`game-engine`) aplica estas reglas; la UI solo presenta.

## Alternativas consideradas
- **Puntaje numérico por servicio** (0–100): más fino, pero difícil de calibrar y de explicar.
- **Solo correcto/incorrecto**: pierde el aprendizaje clave del "funciona pero no conviene".

## Consecuencias
- Las explicaciones salen casi solas ("pierde contra *Pagar lo mínimo cuando no hay actividad*").
- Los debates de calibración se resuelven discutiendo los objetivos, no las opiniones.
- Un escenario sin objetivos claros no pasa la revisión.
