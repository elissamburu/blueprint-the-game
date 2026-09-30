# Notas del autor · insurance-docs-assistant

## Intención pedagógica
Primer escenario de **IA generativa con recuperación (RAG)** del juego. Lo que tiene que quedar:

- **Responder con tus documentos ≠ entrenar un modelo.** Una base de conocimiento recupera los fragmentos relevantes y el modelo redacta con ellos, sin reentrenar nada. SageMaker AI es el contraejemplo: entrenar, ajustar y hospedar modelos propios.
- **No todo servicio de IA "de documentos" genera respuestas.** Textract extrae texto, formularios y tablas; Comprehend analiza texto (entidades, sentimiento, clasificación). Ninguno recupera de una colección ni redacta.
- **Mantener el índice al día es parte del diseño.** Los PDF cambian cada semana: la sincronización programada del conector de S3 cumple la meta de "sin intervención manual".
- **Clientes finales ≠ empleados ≠ identidades de AWS.** Cognito para los clientes, IAM Identity Center para la fuerza laboral, IAM para permisos sobre recursos de AWS.
- El resto (API administrado que valida el token, función por pedido) repite el patrón de `serverless-pdf-processing` y da contexto.

## Decisiones de calibración
- **Base de conocimiento administrada por Bedrock (Managed KB), sin casillero de almacén vectorial.** En una base administrada, Bedrock administra el almacén de embeddings, texto y metadatos ("Managed completely by Bedrock"); en una base administrada por el cliente, el equipo elige y dimensiona el almacén. Para un equipo chico y sin científicos de datos, la administrada es la respuesta natural, y hoy la documentación de Knowledge Bases la recomienda. Pedir un almacén vectorial acá sería pedir una pieza que el diseño óptimo no tiene. Decisión del mantenedor, 2026-09-29.
- **Sin casillero de disparador del sync.** Managed KB programa la sincronización (diaria, semanal o mensual) en el propio conector (anuncio del 2026-09-04). En una base administrada por el cliente el sync hay que dispararlo (`StartIngestionJob`), y ahí sí tendría sentido un programador. Decisión del mantenedor, 2026-09-29.
- **Casilleros: 5** (rango L009 de nivel 200: 4–7): repositorio de PDF, base de conocimiento, API, lógica y autenticación.
- **Objetivos.** El soft "sin servidores; pagar por uso" del pedido original se separó en `no-servers` (operations) y `pay-per-use` (cost), para graduar mejor: el ALB y Fargate cumplen el primero y pierden contra el segundo.
- **`bedrock` no referencia `pay-per-use`** y **`cognito` tampoco**: no verificamos el modelo de precios de Managed KB ni el de Cognito.
- **Citas: redacción prudente.** `RetrieveAndGenerate` **no funciona** con bases administradas; hay que usar `AgenticRetrieveStream` o `Retrieve`. `AgenticRetrieveStream` genera la respuesta con `citations`, que apuntan por índice a los fragmentos recuperados (`results`). `Retrieve` devuelve la `location` (URI) del documento de cada fragmento. La rationale afirma solo eso. Decisión del mantenedor, 2026-09-29.
- **EC2 = rojo con `violates: [no-servers, pay-per-use]`** aunque los dos objetivos son `soft`: naranja significa cumplir una meta a medias (L020), y EC2 no cumple ninguna de las dos. Es discutible; la alternativa sería naranja con `objectives: [no-servers, pay-per-use]`.
- **EFS = rojo con `violates: [auto-refresh]`**: no es un conector de la base administrada (lista: S3, Box, Confluence, SharePoint, Google Drive, OneDrive, Salesforce, ServiceNow, Zendesk, Web Crawler, Custom). EBS además viola `no-servers`.
- **App Runner = rojo sin `violates`**: "AWS App Runner is no longer open to new customers" (doc de App Runner). Fargate ocupa el lugar de naranja en la lógica. El catálogo todavía lo tiene `status: active`: **propuesta de PR aparte** para marcarlo `deprecated`.
- **SageMaker AI = rojo con `violates: [no-own-models]`**, incluso si se desplegara un modelo ya entrenado: hospedarlo en un endpoint propio es lo que el equipo no puede hacer.
- **IAM Identity Center e IAM = rojos sin `violates`**: no cumplen el rol. Las rationales dicen para quién es cada uno.
- **En la consola, Managed KB aparece bajo Amazon Bedrock AgentCore.** Se mapea al id `bedrock` del catálogo. Si el catálogo agrega AgentCore como servicio aparte, revisar este casillero.

## Para el escenario 4 (asistente con datos sensibles, nivel 300)
- Usar una **base de conocimiento administrada por el cliente**, con la elección del **almacén vectorial como casillero**. Opciones de *quick create*: OpenSearch Serverless, Aurora PostgreSQL Serverless, Neptune Analytics y **S3 Vectors** (GA desde el 2025-12-02). Datos para calibrar:
  - S3 Vectors: "cost-optimized", "ideal for workloads where queries are less frequent", latencia de subsegundo, sin infraestructura, pago por uso.
  - OpenSearch Serverless: los grupos de colecciones pueden bajar a 0 OCU; el mínimo configurado se provisiona siempre. Es el único almacén con vectores binarios (junto con los clústeres administrados) y el único para fuentes Confluence, SharePoint o Salesforce en bases administradas por el cliente.
  - Aurora PostgreSQL (*quick create*): 0–16 ACU, escala a cero, crea pgvector, el esquema y el secreto. La doc aclara que "may not be suitable for production use".
- **Casillero de programador del sync**: en una base administrada por el cliente hay que llamar a `StartIngestionJob`. Candidato: EventBridge Scheduler (verificar si puede llamar a la API directamente con un *universal target* o si necesita una función).
- Con la base administrada por el cliente vuelve `RetrieveAndGenerate`, con `citations[].retrievedReferences[].location.s3Location.uri` documentado.

## TODO(verificar)
- [ ] ¿El `results[].metadata` de `AgenticRetrieveStream` incluye la URI del documento de origen (p. ej. `_source_uri`)? Solo lo vi en un resumen de búsqueda, no en docs.aws.amazon.com. Si no la trae, la lógica tiene que resolver la fuente con `Retrieve`.
- [ ] Modelo de precios de Managed KB: ¿hay un costo base o es solo por uso? Si es solo por uso, sumar `pay-per-use` al óptimo.
- [ ] Regiones donde está disponible Managed KB (`kb-managed-regions.html`).
- [ ] Latencia de `AgenticRetrieveStream` con varias iteraciones frente al timeout de integración del API. No se afirma en el escenario, pero condiciona el diseño real (streaming, `maxAgentIteration`).
- [ ] "Bedrock no usa las entradas ni las salidas para entrenar modelos": la página de data protection no lo dice literalmente (solo dice que los proveedores no acceden a prompts ni completions). **No se menciona en ninguna rationale.**

## Fuentes verificadas (2026-09-29)
- Managed vs customer-managed; almacén "Managed completely by Bedrock": https://docs.aws.amazon.com/bedrock/latest/userguide/kb-build-managed.html
- Creación de Managed KB, conectores soportados, `Retrieve` con `managedSearchConfiguration`: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html
- Sincronización incremental y cronograma (on-demand por defecto; daily, weekly, monthly): https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-sync.html
- Anuncio del sync programado (2026-09-04): https://aws.amazon.com/about-aws/whats-new/2026/09/amazon-bedrock-managed-knowledge-base-automatic-sync-scheduling-data-source-connectors/
- `RetrieveAndGenerate` "cannot be used with managed knowledge bases": https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_RetrieveAndGenerate.html
- Recuperación agéntica: `answer`, `citations` (`startIndex`, `endIndex`, `references[].resultIndex`), solo bases administradas: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-agentic-retrieve.html
- `Retrieve` devuelve `location` ("the URI or URL of the document"): https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html
- Sync en bases administradas por el cliente ("you must sync", `StartIngestionJob`, incremental): https://docs.aws.amazon.com/bedrock/latest/userguide/kb-data-source-sync-ingest.html
- *Quick create* de almacenes vectoriales: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-create.html
- Almacenes soportados y S3 Vectors: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-setup.html · https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html
- S3 Vectors GA (2025-12-02): https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-s3-vectors-generally-available/
- OpenSearch Serverless, mínimo de 0 OCU por grupo de colecciones: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scaling.html
- Aurora *quick create* (0–16 ACU, "may not be suitable for production"): https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.quickcreatekb.html
- Autorizador JWT del API con Cognito; los claims llegan a la Lambda: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
- IAM Identity Center es para "workforce users": https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html
- App Runner "no longer open to new customers": https://docs.aws.amazon.com/apprunner/latest/dg/architecture.html

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes: 8`).
- [ ] PR aparte: marcar `app-runner` como `deprecated` en el catálogo.
