# Notas del autor · sensitive-claims-assistant

## Intención pedagógica
Continuación de `insurance-docs-assistant` (nivel 200). Misma aseguradora, pero ahora con **datos de salud** y una normativa que obliga a pensar la seguridad de un RAG de punta a punta. Lo que tiene que quedar:

- **Base administrada vs administrada por el cliente: la diferencia real.** Las dos aceptan una clave KMS del cliente. Lo que cambia es **quién elige y opera el almacén vectorial** y si se tiene acceso directo a él ("You provision and maintain your vector DB, with direct access to it").
- **Elegir el almacén vectorial por el patrón de uso.** Pocas consultas por día ⇒ S3 Vectors (pago por uso, "ideal for workloads where queries are less frequent"). OpenSearch Serverless funciona pero cobra capacidad mínima; Aurora funciona pero es otra base de datos que mantener. DynamoDB y DocumentDB no son almacenes soportados.
- **Tráfico privado a servicios de IA = endpoints de interfaz, uno por API.** `bedrock-agent-runtime` (recuperar) y `bedrock-runtime` (invocar el modelo). El acceso por ruta solo existe para S3 y DynamoDB.
- **Auditar llamadas ≠ auditar contenido.** CloudTrail dice quién llamó a qué API; el **registro de invocaciones del modelo** guarda pedido y respuesta completos, en CloudWatch Logs y/o S3.
- **Los registros también tienen datos sensibles.** El registro de invocaciones guarda la entrada original sin enmascarar: por eso también se cifra con la clave propia.
- **Filtrar PII en la respuesta es una función del servicio de modelos (Guardrails), no de Comprehend ni de Macie.** Comprehend detecta PII en un texto; Macie encuentra datos sensibles en S3; ninguno genera ni filtra respuestas.
- **Una base administrada por el cliente no se sincroniza sola.** Hay que llamar a `StartIngestionJob`; EventBridge Scheduler lo hace sin código.

## Decisiones de calibración
- **Base administrada por el cliente, justificada por el objetivo `inspectable-store`** (hard, security): seguridad exige elegir el almacén e inspeccionarlo directamente. La rationale de `bedrock` dice explícitamente que la administrada también acepta clave KMS del cliente (kb-managed-create, encryption-kb). **El enmascaramiento no se usa como argumento** para elegir el tipo de base. Decisión del mantenedor, 2026-09-29.
- **Flujo de la app: `Retrieve` + `Converse` con guardrail, sin `RetrieveAndGenerate`.** Así el hard de PII lo cumple el filtro de información sensible en modo máscara (`ANONYMIZE`) sobre `Converse`, y el hard de auditoría lo cumple el registro de invocaciones, que captura las llamadas por `bedrock-runtime` (Converse incluido). Elimina la duda sobre si se registra la generación interna de `RetrieveAndGenerate`. Decisión del mantenedor, 2026-09-29.
- **Objetivo nuevo `no-db-to-operate`** (soft, operations), **no estaba en el pedido original.** Aurora cumple todas las restricciones y su capacidad serverless puede bajar a 0 ACU: no encontré base documental para decir que pierde en costo contra S3 Vectors. Sí pierde en operación: es un clúster con credenciales en un secreto, versión del motor, rango de capacidad y esquema pgvector a cargo del equipo. El contexto lo respalda ("no quiere sumar otra base de datos que mantener"). Alternativa si el mantenedor no quiere el objetivo extra: Aurora `optimal` junto con S3.
- **OpenSearch = naranja por `low-cost`.** Las colecciones compatibles con las bases de conocimiento (Classic) facturan un mínimo de OCU; el modo NextGen, que escala a cero, "aren't yet compatible with the Amazon Bedrock Knowledge Bases Retrieve API" (blog de AWS, 2026-09-17). La rationale no cita cifras.
- **Audit: `cloudwatch` y `s3` óptimos.** Son los dos destinos del registro de invocaciones; solo S3 admite datos grandes. Graduar el bucket en rojo sería falso.
- **CloudTrail = rojo sin `violates`** mientras no haya doc que diga que no registra el contenido. La rationale afirma solo lo documentado. Decisión del mantenedor, 2026-09-29.
- **Endpoints: el óptimo no referencia `qa-audit`.** El registro de invocaciones depende de la API usada (`bedrock-runtime` vs `bedrock-mantle`), no de si la llamada va por el endpoint de VPC o por el público. La rationale lo deja como recomendación.
- **Step Functions y SQS = rojos con `violates: [auto-ingest]`** (soft): ninguno dispara la sincronización por sí mismo (Step Functions necesita quien lo inicie; SQS, un consumidor). Mismo criterio que EC2 en `insurance-docs-assistant`.
- **Disparo por frecuencia fija y no por evento de S3.** Cuotas: 1 trabajo de ingesta concurrente por fuente de datos y por base, y 0,1 `StartIngestionJob` por segundo. Una regla ante cada objeto nuevo necesita una función intermedia y choca con esos límites (el patrón oficial del blog de AWS agrega Lambda, SQS, Step Functions y DynamoDB para eso).
- **Casilleros: 6** (rango L009 de nivel 300: 6–10): servicio de IA, almacén vectorial, acceso privado, claves, auditoría y disparador. App (Lambda en la VPC) y bucket de expedientes (S3) son nodos fijos.
- **Neptune Analytics** (también almacén soportado) no se usa: el catálogo solo tiene `neptune` (Neptune Database), que no es el mismo servicio.

## TODO(verificar)
- [ ] Destino universal de Scheduler: `arn:aws:scheduler:::aws-sdk:bedrockagent:startIngestionJob`. La página no nombra `bedrockagent`; se infiere del identificador que usa la integración SDK de Step Functions y de que la acción no empieza con un prefijo bloqueado. Probarlo en una cuenta de prueba.
- [ ] ¿CloudTrail registra el contenido del prompt y de la respuesta? La doc no lo dice; el ejemplo de `InvokeModel` solo muestra `modelId` y `responseElements: null`.
- [ ] Qué modo de colección (Classic/NextGen), capacidad y redundancia crea la *quick create* de OpenSearch Serverless desde Bedrock.
- [ ] Configuración del guardrail: se asume `outputAction: ANONYMIZE` y sin enmascarar la entrada, para no enmascarar los fragmentos que recibe el modelo. Es lectura de la API, no una recomendación documentada.
- [ ] ¿El campo de salida del registro de invocaciones guarda la respuesta original o la enmascarada? La doc solo dice que el `input` es siempre el original.
- [ ] Qué excepción devuelve `StartIngestionJob` si ya hay un trabajo en curso (la referencia lista `ConflictException`, `ServiceQuotaExceededException` y `ThrottlingException` sin decir cuál).

## Fuentes verificadas (2026-09-29)
- Administrada vs administrada por el cliente (almacén, "direct access", conectores): https://docs.aws.amazon.com/bedrock/latest/userguide/kb-build-managed.html
- La base administrada acepta clave KMS del cliente ("optionally provide a KMS key for encryption of the managed vector store"): https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html
- Cifrado de bases de conocimiento (ingesta transitoria, fuente S3 con SSE-KMS, almacenes, *quick create* con clave para OpenSearch y S3 Vectors): https://docs.aws.amazon.com/bedrock/latest/userguide/encryption-kb.html
- Almacenes soportados (`StorageConfiguration.type`: OpenSearch Serverless, Pinecone, Redis Enterprise Cloud, RDS, MongoDB Atlas, Neptune Analytics, OpenSearch managed cluster, S3 Vectors; sin DynamoDB ni DocumentDB): https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_StorageConfiguration.html · https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-setup.html
- S3 Vectors ("only pay for what you use", "ideal for workloads where queries are less frequent", API propia, IAM): https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html
- S3 Vectors con SSE-KMS y CMK, inmutable tras crear el bucket o índice: https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-data-encryption.html
- OpenSearch Serverless: CMK por colección; mínimo de OCU en Classic; NextGen escala a cero: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-encryption.html · https://aws.amazon.com/opensearch-service/pricing/ · https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scale-to-zero.html
- NextGen no compatible con `Retrieve` de las bases: https://aws.amazon.com/blogs/machine-learning/selecting-a-vector-store-for-amazon-bedrock-knowledge-bases/
- Aurora *quick create* (0–16 ACU, secreto en Secrets Manager, "may not be suitable for production use"); Aurora con CMK: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.quickcreatekb.html · https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Overview.Encryption.html
- Endpoints de interfaz de Bedrock (`bedrock`, `bedrock-runtime`, `bedrock-mantle`, `bedrock-agent`, `bedrock-agent-runtime`), DNS privado: https://docs.aws.amazon.com/bedrock/latest/userguide/vpc-interface-endpoints.html
- Gateway endpoints solo para S3 y DynamoDB: https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
- Registro de invocaciones (apagado por defecto; pedido, respuesta y metadatos; CloudWatch Logs, S3 o ambos; datos grandes solo a S3; SSE-KMS; Converse, ConverseStream, InvokeModel, InvokeModelWithResponseStream; solo por `bedrock-runtime`): https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html
- CloudTrail: InvokeModel/Converse como eventos de administración; Retrieve/RetrieveAndGenerate como eventos de datos, no registrados por defecto: https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html
- Filtros de información sensible (bloquear o enmascarar con `{NAME}`; `ANONYMIZE`; `inputAction`/`outputAction`; el `input` del log de invocaciones queda sin enmascarar; protección de datos de CloudWatch Logs; guardrail con CMK): https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-sensitive-filters.html
- Guardrail con Converse (`guardrailConfig`): https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-converse-api.html
- Recuperación agéntica (solo bases administradas) admite guardrails solo con `BLOCK`, no `MASK`: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-agentic-retrieve.html
- Comprehend detecta y redacta PII: https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html
- Macie descubre datos sensibles en S3: https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html
- Sincronización obligatoria e incremental en bases administradas por el cliente: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-data-source-sync-ingest.html
- `syncSchedule` solo en `managedKnowledgeBaseConnectorConfiguration` (no hay programación nativa en bases administradas por el cliente): https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_CreateDataSource.html
- Destinos universales de EventBridge Scheduler y prefijos no soportados: https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-targets-universal.html
- Cuotas (1 ingesta concurrente por fuente y por base; 0,1 `StartIngestionJob`/s): https://docs.aws.amazon.com/general/latest/gr/bedrock.html
- Integración SDK de Step Functions con `bedrockagent`; Step Functions se inicia con Scheduler o eventos: https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html · https://docs.aws.amazon.com/step-functions/latest/dg/using-eventbridge-scheduler.html
- Patrón oficial de sincronización automática (blog, 2026-04-27): https://aws.amazon.com/blogs/machine-learning/build-and-deploy-an-automatic-sync-solution-for-amazon-bedrock-knowledge-bases/

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes: 14`).
- [ ] Si el catálogo agrega Neptune Analytics como servicio aparte, sumarlo como naranja o rojo en el almacén vectorial.
