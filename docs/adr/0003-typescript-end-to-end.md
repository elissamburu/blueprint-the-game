# 0003 · TypeScript de punta a punta

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
Buscamos un desarrollo agradable, con la mayor base posible de contribuidores y tipos compartidos entre el formato de contenido, el front, el back y el Studio.

## Decisión
TypeScript en `strict` para todo: front (React), back (Lambda Node.js), herramientas (tsx), Studio (Hono). **Zod** como fuente de verdad de tipos en las fronteras; los tipos se infieren (`z.infer`) y el JSON Schema del escenario se genera desde Zod.

## Alternativas consideradas
- **Python en el back**: excelente para IA, pero duplica los modelos de datos y la lógica de evaluación.
- **Go/Rust en Lambda**: mejor cold start, pero una barrera de entrada mayor y sin compartir código con el front.

## Consecuencias
- El motor de juego corre igual en navegador, Lambda y Studio (una sola implementación).
- Cold starts de Node aceptables para este tráfico; bundling con esbuild para mantenerlos bajos.
- El runtime de Node de Lambda se elige al implementar según los runtimes soportados vigentes (verificar en la documentación de runtimes de Lambda).
