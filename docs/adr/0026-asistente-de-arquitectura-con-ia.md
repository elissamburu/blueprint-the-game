# 0026 · Asistente de arquitectura con IA

- Estado: Propuesto
- Fecha: 2026-10-06

## Contexto
Hoy el juego enseña con escenarios cerrados: alguien los escribe, los cura y el jugador completa los casilleros. El mantenedor quiere sumar, en la versión pública, un **asistente de arquitectura**: el usuario describe su caso de uso en un chat, el asistente le pregunta las restricciones que faltan (costo, disponibilidad, equipo, cumplimiento, latencia, etc.) y al final dibuja el diagrama recomendado con el porqué de cada servicio.

Sirve para dos cosas:
1. **Herramienta de diseño**: el usuario sale con una arquitectura propuesta y justificada para su caso.
2. **Origen de escenarios nuevos**: la conversación termina en un borrador de escenario que después se cura en el Studio. El contenido es el cuello de botella del proyecto ([00 · Visión, §2](../00-vision-y-alcance.md#2-objetivos-del-producto)).

Requiere registro y un límite de uso por usuario; más adelante será solo para un plan pago. El objetivo de hoy es **mostrar el potencial**, no abrirlo a todo el mundo.

Relación con lo que ya existe:
- **Modo «diseño libre»** del backlog ([05 · Roadmap](../05-roadmap.md#fuera-de-v1-backlog)): el jugador dibuja y la IA evalúa. Es la variante inversa: acá la IA dibuja y el usuario pregunta. Comparten la idea de evaluar contra objetivos explícitos y la IA del lado del jugador.
- **F4** (cuentas): el asistente necesita usuarios registrados para la cuota, la retención y el borrado de conversaciones ([ADR-0010](0010-autenticacion-cognito-e-invitado.md), [ADR-0009](0009-backend-serverless.md)).
- **F5** (`packages/ai-generator`): ya resuelve salida estructurada contra el schema, servicios limitados al catálogo, bucle de reparación y revisión crítica ([ADR-0013](0013-scenario-studio-local-con-ia.md)). Pero lo hace en el Studio local, con la cuenta de cada contribuidor; el asistente correría en la infraestructura del proyecto y con su costo.
- **[ADR-0007](0007-evaluacion-por-objetivos.md)**: «óptimo» siempre se justifica contra objetivos explícitos `hard`/`soft`. El asistente no puede recomendar «porque sí»: tiene que convertir las restricciones del usuario en objetivos y justificar cada servicio contra ellos.

## Decisión propuesta

### 1. Flujo
1. **Chat**: el usuario describe su caso de uso en texto libre.
2. **Restricciones explícitas**: el asistente pregunta lo que falta (costo, disponibilidad, tamaño y experiencia del equipo, cumplimiento, latencia, patrón de tráfico, nivel de gestión) y las convierte en **objetivos** `hard` (restricciones) y `soft` (metas), con el mismo formato que los escenarios ([03 · Modelo de escenarios](../03-modelo-de-escenarios.md)). Antes de dibujar, le muestra al usuario la lista de objetivos para que la confirme o la corrija.
3. **Diagrama**: el asistente propone la arquitectura como un diagrama del modelo propio ([ADR-0005](0005-modelo-de-diagrama.md)).
4. **Justificación por servicio**: cada servicio recomendado lleva el porqué, los objetivos que cumple y al menos una referencia a documentación oficial; si un objetivo `hard` descarta una alternativa obvia, lo dice.

### 2. Salida estructurada y validada
- La salida del modelo es **estructurada** y se valida con el mismo schema del repo (Zod en `packages/scenario-schema`), no con un formato paralelo. Lo que no pasa la validación no se muestra.
- Los servicios están **limitados a ids del catálogo** (`content/catalog/services.yaml`). Lo que no está en el catálogo se **rechaza** o se muestra **marcado** como «fuera del catálogo, sin verificar», nunca se inventa un id ni se le asigna un ícono.
- Las referencias se limitan a los dominios oficiales que ya acepta el lint (L011).

### 3. Reutilizar `packages/ai-generator`
El asistente usa el núcleo de `packages/ai-generator` de F5 (interfaz `LlmProvider`, herramienta con el JSON Schema del escenario, enum de ids del catálogo, bucle de reparación, revisión crítica) en lugar de duplicarlo. Lo propio del asistente es el chat de restricciones y la sesión con su cuota; el paquete sigue sin IO propio más allá de `providers/*` ([04 · Estructura del monorepo](../04-estructura-monorepo.md)).

### 4. Exportar como borrador de escenario
- Desde una conversación terminada, el usuario puede **exportar un borrador de escenario** (`status: draft`): los objetivos confirmados, el diagrama y, por cada servicio, un casillero con la respuesta `optimal`, su `rationale` y sus referencias.
- El borrador no está listo para jugar: faltan roles sin filtraciones (L005), pistas, distractores, `acceptable` e `incorrect`. Se **cura en el Studio** local, que ya guarda borradores con errores, y se abre el PR con la [plantilla «Nuevo escenario»](../../.github/PULL_REQUEST_TEMPLATE/nuevo-escenario.md). La revisión crítica y la revisión humana siguen siendo obligatorias antes de `published` ([ADR-0013](0013-scenario-studio-local-con-ia.md)).
- La web pública **no** escribe en `content/` ni abre PR: solo entrega el archivo. Solo `apps/studio/server` escribe en `content/`.

### 5. Acceso, cuota y presupuesto
- Solo para **usuarios registrados** (F4). El modo invitado no tiene acceso.
- **Cuota por usuario** (conversaciones o tokens por período), con aviso antes de llegar al límite y mensaje claro al agotarla.
- **Presupuesto global** del proyecto, contado por la aplicación; cuando se agota, el asistente se **corta** para todos con un mensaje claro, sin afectar el juego.
- Un **plan pago** queda fuera de alcance de este ADR.

## Seguridad
- **El texto del usuario es no confiable.** Se trata como dato, nunca como instrucción: prompt injection **directa** (el usuario escribe «ignorá tus instrucciones…») e **indirecta** (lo que el usuario pega: documentos, YAML, salidas de consola). El prompt del sistema delimita el texto del usuario y define el alcance del asistente. Amazon Bedrock describe la prompt injection como un problema de la aplicación, del lado del cliente en el modelo de responsabilidad compartida, y recomienda validar la entrada ([Prompt injection security](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-injection.html)). Si se usa Bedrock, Guardrails tiene un filtro de ataques de prompt que solo evalúa la entrada del usuario cuando está etiquetada ([Detect prompt attacks](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-prompt-attack.html)).
- **Sin herramientas con efectos laterales.** El modelo no ejecuta herramientas que escriban, llamen a la red o toquen cuentas: la única «herramienta» es la de salida estructurada. Así, una inyección exitosa como mucho produce una mala recomendación, que igual tiene que pasar la validación.
- **Validar antes de renderizar.** La salida se valida con Zod antes de mostrarse y **nunca se interpreta como HTML**: el texto se renderiza como texto (o markdown sin HTML crudo) y los enlaces se limitan a los dominios permitidos. Rige la CSP del sitio (RNF-10).
- **Filtros de contenido** sobre la entrada y la salida (odio, insultos, violencia, contenido sexual, conducta indebida). Si el proveedor es Bedrock, con [Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html); con otro proveedor, su equivalente. Además, el asistente se limita a arquitectura en AWS y rechaza otros temas.
- **Rate limiting** por usuario y por IP. El throttling de las HTTP API de API Gateway se configura por stage y por ruta, no por usuario ([Throttle requests to your HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html)), así que el límite por usuario lo lleva la aplicación. Para el límite por IP, AWS WAF tiene reglas por tasa ([rate-based rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html)), pero no se asocia a HTTP API (sí a CloudFront y a REST API, [recursos que protege](https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html)): ver preguntas abiertas.
- **Retención mínima** de conversaciones, con plazo configurable, y el usuario puede **borrar** cada conversación o todas. Borrar la cuenta (RF-AUTH-06) borra las conversaciones. La retención del lado del proveedor también cuenta: en Bedrock depende del modo de retención y del modelo ([Data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html)); se elige una configuración compatible con lo que se le promete al usuario.
- **Logs sin el contenido de la conversación**: solo metadatos (usuario, tokens, duración, resultado de la validación, filtros activados). En Bedrock, el registro de invocaciones guarda la entrada y la salida completas y está apagado por defecto ([Model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html)): queda apagado.
- **Nada de credenciales ni datos de cuentas reales.** La UI avisa, antes del primer mensaje y junto al campo de texto, que no se peguen credenciales, account IDs, ARNs ni datos personales. La entrada se revisa con patrones de secretos conocidos y, si aparecen, se rechaza el mensaje sin enviarlo al modelo. TODO(verificar): si se usa Bedrock, evaluar el filtro de información sensible de Guardrails con expresiones regulares propias ([Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)).

## Costos
- La variable principal es el **costo por conversación**: tokens de entrada (crecen con cada turno, porque se reenvía el historial y el catálogo acotado) y de salida, más las llamadas de reparación y de revisión crítica.
- Límites por sesión: **máximo de turnos** del chat y **máximo de tokens** (entrada y salida) por conversación; al llegar al límite, el asistente propone cerrar con lo que tiene.
- **Modelo configurable** por variables de entorno, como en el Studio (`AI_MODEL_ID`): se puede usar uno más barato para las preguntas y otro para el diagrama final.
- El catálogo que se envía al modelo se acota a las categorías relevantes, como en F5.
- Del lado del proveedor también hay cuotas de tokens y de solicitudes. En Bedrock se ven y se piden aumentos con Service Quotas ([Quotas for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html)). Son un techo de capacidad, **no** un control de gasto: el presupuesto global lo cuenta la aplicación.
- Este ADR no fija precios ni valores: se definen con mediciones antes de abrir el asistente (ver preguntas abiertas). El presupuesto de AWS Budgets de RNF-05 sigue siendo la alarma de respaldo. TODO(verificar): si el límite por IP necesita AWS WAF, revisar su modelo de cobro contra RNF-05 (sin costos fijos por hora).

## Precisión
- Es una **recomendación educativa, no asesoramiento profesional**. La UI lo dice en la pantalla del asistente y en el diagrama exportado, junto con el aviso de no afiliación con AWS (RF-OPS-03).
- Cada servicio recomendado lleva su **referencia oficial**, y el asistente se apoya en `short`, `whenToUse` y `whenNotToUse` del catálogo, que son contenido curado, antes que en lo que «sabe» el modelo.
- La revisión crítica de F5 corre sobre el diagrama antes de mostrarlo y sus observaciones se le muestran al usuario.

## Accesibilidad
- El chat cumple [docs/accesibilidad.md](../accesibilidad.md): cada respuesta nueva se anuncia una sola vez con una región `aria-live="polite"`, sin toasts que la repitan y sin anunciar el texto token por token mientras llega; el foco queda en el campo de texto después de enviar; todo se opera con teclado; el aviso de cuota es un mensaje de estado (`role="status"`).
- El diagrama tiene una **alternativa textual** equivalente, generada del mismo modelo: objetivos como listas, el flujo como lista ordenada de pasos y cada servicio con su porqué ([ADR-0022](0022-modo-texto.md), modo texto, en su variante de solo lectura).

## Alternativas consideradas
- **Modo «diseño libre»** (el usuario dibuja y la IA evalúa): no es una alternativa excluyente sino una **variante complementaria**. Comparte la conversión a objetivos, la validación y `ai-generator`; necesita además el editor visual en la web. Puede venir después del asistente o junto con él, con su propio ADR.
- **Generar sin chat** (un solo prompt con el caso de uso): más barato y simple, pero salta la parte que más enseña (preguntar por las restricciones) y produce objetivos inventados por el modelo. Descartado como experiencia principal; puede ser el primer paso de una demo.
- **Asistente solo local en el Studio**: sin costo para el proyecto ni exposición pública, pero no llega a quien no clona el repo y no cumple la idea de la versión pública. Queda como **demo** posible antes de F4 (ver preguntas abiertas).

## Consecuencias
- Es la primera función con IA del lado del jugador y con costo para el proyecto: suma superficie de ataque, costo variable y datos personales nuevos (las conversaciones). Por eso depende de F4 y de F5, y se ubica en la fase **F8** del [roadmap](../05-roadmap.md).
- La evaluación por objetivos ([ADR-0007](0007-evaluacion-por-objetivos.md)) se extiende a contenido generado en el momento: el asistente no tiene un escenario curado detrás, así que su precisión depende del catálogo, de la validación y de la revisión crítica.
- [ADR-0013](0013-scenario-studio-local-con-ia.md) sigue vigente: el Studio no se publica. El asistente es otra superficie, con sus propias reglas, que reutiliza el mismo núcleo de IA.
- Los escenarios que salen del asistente siguen el camino normal: Studio, PR y revisión humana.

## Preguntas abiertas
- **Proveedor y modelo**: Bedrock, Anthropic API u otro; un modelo o dos (preguntas y diagrama).
- **Valores de cuota**: conversaciones o tokens por usuario y período, turnos y tokens por sesión, presupuesto global. Se definen midiendo el costo por conversación con la demo.
- **Retención**: plazo de las conversaciones del lado del proyecto y modo de retención del proveedor.
- **Límite por IP**: con AWS WAF delante de la API (por ejemplo, la API detrás de CloudFront) o en la aplicación. TODO(verificar) costo y compatibilidad con [ADR-0009](0009-backend-serverless.md).
- **Render del diagrama en la web**: el borrador del asistente no trae coordenadas finas y el auto-layout vive en `@blueprint/diagram/layout` (elkjs), que hoy dependency-cruiser excluye de lo que carga el juego (regla `diagram-entry-not-to-layout`, [ADR-0025](0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md)). Evaluar cargarlo de forma diferida solo en la pantalla del asistente, sin afectar el bundle inicial (RNF-03), o calcular el layout en el servidor.
- **Demo antes de F4**: para mostrar el potencial sin esperar las cuentas, por ejemplo solo en el Studio local (con la cuenta de IA de quien lo corre, como F5), sin exposición pública ni costos de terceros.
