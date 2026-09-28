# Notas del autor · serverless-pdf-processing

## Intención pedagógica
- Nivel 200: el jugador ya reconoce los servicios base; el foco está en **por qué** cola vs pub/sub vs bus de eventos, y en el costo ocioso (ALB, Fargate siempre encendido, Kinesis).
- Dos restricciones `hard` (`no-servers`, `no-ml-team`) para mostrar la diferencia entre "funciona pero viola una restricción" (rojo) y "funciona pero no es lo mejor" (naranja).

## Decisiones de calibración
- **EventBridge como naranja** (no rojo): enruta el evento con reintentos y es un patrón válido; pierde contra la cola por el control del ritmo de consumo y el procesamiento por lotes durante picos.
- **SNS como rojo**: sin una cola detrás no retiene mensajes para un consumidor que va a su ritmo. Discutible; si las métricas muestran confusión masiva, revisar la rationale antes de cambiar el grado.
- **Bedrock como naranja** en extracción: válido cuando los formatos varían mucho; pierde por determinismo y costo en una tarea estructurada y repetitiva.

## Pendiente
- [ ] Validar enlaces con el job de link-check (L017).
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
