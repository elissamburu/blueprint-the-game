# Notas del autor · private-vpc-service-access

## Intención pedagógica
- **Gateway endpoint vs interface endpoint**: el gateway endpoint existe solo para S3 y DynamoDB, es una ruta en las tablas de ruteo y no tiene cargo; el resto de los servicios (Secrets Manager, SQS, CloudWatch Logs) se alcanza con interface endpoints (PrivateLink), que cobran por hora por zona y por GB procesado.
- **NAT e internet gateway violan la restricción** (`no-internet`, rojo con `violates`) en todos los casilleros de acceso.
- **Funciona pero cuesta más** (naranja por `low-cost`): interface endpoint para S3 y DynamoDB. En DynamoDB además pierde por `simple-ops`, porque los clientes tienen que usar la URL específica del endpoint.
- Los tres casilleros de interface endpoint (secretos, cola, logs) repiten la respuesta a propósito: la idea es que el jugador generalice "casi todo va por interfaz; el acceso por ruta es la excepción".

## Decisiones de calibración
- **Redacción de la restricción `no-internet`.** La doc de AWS aclara que el tráfico a S3 o DynamoDB que sale por NAT e internet gateway *no sale de la red de AWS*. Por eso la restricción no dice "los paquetes no pueden viajar por internet", sino "la VPC no tiene ni puede tener salida a internet". El NAT la viola porque un NAT público vive en una subred pública y enruta hacia el internet gateway. Las rationales hablan de "salida a internet de la VPC", no de "tráfico por internet".
- **Interface endpoint en S3 = naranja solo por costo.** S3 soporta DNS privado en interface endpoints, así que no hay penalidad de operación.
- **Interface endpoint en DynamoDB = naranja por costo y operación.** La doc de DynamoDB pide configurar los clientes con la URL del endpoint y no crear zonas privadas que sobrescriban el nombre del servicio.
- **Amazon MQ = naranja** en la cola: funciona, pero se paga por hora de broker aunque no haya mensajes, y hay tamaño, modo de despliegue y ventanas de mantenimiento.
- **Kinesis Data Streams = naranja**, alineado con `serverless-pdf-processing`. Es discutible: no es una lista de trabajos que se toman y se borran. Si las métricas muestran que confunde, evaluar pasarlo a rojo (requiere `version++` si el escenario ya no está en draft).
- **SNS = rojo**: empuja y no retiene trabajos para que el consumidor los tome a su ritmo.
- **`multi-az` solo en los interface endpoints**: su doc recomienda al menos dos zonas por endpoint. No se afirma nada sobre la disponibilidad por zona de los gateway endpoints, que no está en la doc consultada.
- **Transit Gateway y Direct Connect** como rojos sin `violates`: no violan la restricción, simplemente no resuelven el acceso a los servicios.

## Catálogo
Este escenario agregó al catálogo `vpc-gateway-endpoint`, `vpc-interface-endpoint`, `nat-gateway` e `internet-gateway`, más el grupo de confusión `vpc-private-access`. PrivateLink no es una entrada aparte: el interface endpoint *es* PrivateLink (patrón de filtración "PrivateLink" incluido), y tener dos entradas duplicaría el patrón (C010) y la respuesta.

## Fuentes verificadas
- Gateway endpoints: solo S3 y DynamoDB, sin cargo adicional, rutas con lista de prefijos; el tráfico por NAT/IGW no sale de la red de AWS: https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
- Interface endpoints: una interfaz por subred y zona, DNS privado, recomendación de al menos dos zonas, cobro por hora por zona y por GB: https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-aws-services.html · https://aws.amazon.com/privatelink/pricing/
- S3 gateway vs interface ("Not billed" vs "Billed"), DNS privado: https://docs.aws.amazon.com/AmazonS3/latest/userguide/privatelink-interface-endpoints.html
- DynamoDB gateway vs interface, URL específica del endpoint: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/privatelink-interface-endpoints.html
- Servicios con PrivateLink (Secrets Manager, SQS, CloudWatch Logs): https://docs.aws.amazon.com/vpc/latest/privatelink/aws-services-privatelink-support.html
- NAT gateway público en subred pública con ruta al IGW; cobra por hora y por GB: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html · https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-pricing.html
- SQS: el consumidor borra el mensaje después de procesarlo; si no, vuelve a estar visible: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html · sin mínimo: https://aws.amazon.com/sqs/pricing/
- Amazon MQ: cobro por hora de broker, ventanas de mantenimiento: https://aws.amazon.com/amazon-mq/pricing/ · https://docs.aws.amazon.com/amazon-mq/latest/developer-guide/amazon-mq-basic-elements.html
- Kinesis Data Streams: cargo por hora por stream (on-demand standard) o por shard (provisioned): https://aws.amazon.com/kinesis/data-streams/pricing/

## Íconos
- Los íconos de los cuatro servicios nuevos (`Res_Amazon-VPC_Endpoints_48`, `Arch_AWS-PrivateLink_48`, `Res_Amazon-VPC_NAT-Gateway_48`, `Res_Amazon-VPC_Internet-Gateway_48`) se verificaron el 2026-09-28 contra el Icon package oficial **07/31/2026** descargado de https://aws.amazon.com/architecture/icons/.

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
- [ ] Evaluar si tres casilleros con la misma respuesta resultan tediosos.
