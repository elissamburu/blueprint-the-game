# Notas del autor · private-eks-least-privilege

## Intención pedagógica
Este escenario **no repite** `private-vpc-service-access` (endpoints de VPC en general). El foco es lo que es propio de un clúster de EKS privado:

- **Arrancar un pod sin internet necesita más de lo que parece.** Las APIs de ECR van por interface endpoints (`ecr.api`, `ecr.dkr`) y **las capas se bajan de S3**: la guía de ECR pide un gateway endpoint de S3 para eso. Por eso el casillero de S3 no es solo "para los extractos".
- **Credenciales de los pods.** Un rol por cuenta de servicio (EKS Pod Identity o IRSA), sin claves en el pod, y el endpoint de credenciales (`eks-auth` o `sts`) como la pieza que se olvida en los clústeres privados.
- **El rol del nodo también es un riesgo.** Con Pod Identity o IRSA, el pod igual puede heredar el rol del nodo por los metadatos de la instancia. Por eso la restricción `no-long-lived-credentials` incluye "ni los permisos del rol de los nodos", y la rationale cita la recomendación de bloquear IMDS de la guía de buenas prácticas de EKS.
- **Cifrado por defecto vs clave del cliente.** EKS ya cifra los datos de la API con una clave propiedad de AWS: el objetivo dice explícitamente "clave administrada por el cliente".
- **Auditoría de Kubernetes ≠ auditoría de AWS ≠ detección.** El log de auditoría del plano de control va a CloudWatch Logs. CloudTrail registra las llamadas a la API de AWS. GuardDuty analiza el log de auditoría con su propio flujo, pero no lo deja consultable en la cuenta.
- **Detección de amenazas vs el resto del grupo `security-findings`.** GuardDuty detecta; Inspector busca vulnerabilidades; Security Hub agrega y prioriza hallazgos; Detective investiga después; Macie busca datos sensibles en S3.

## Decisiones de calibración
- **Casilleros: 6** (rango L009 de nivel 300: 6–10): identidad, acceso a S3, APIs, clave, auditoría y detección de amenazas.
- **ECR como nodo fijo.** Ya lo enseña `kubernetes-api-migration`, y la rationale del casillero de APIs lo nombraría (`ecr.api`, `ecr.dkr`). Decisión del mantenedor, 2026-09-29.
- **Objetivo nuevo `threat-detection` (hard, security).** Lo exige el casillero de detección: todo `optimal` referencia ≥ 1 objetivo (L004) y ninguno de los otros lo justificaba. Es `hard` porque el contexto lo presenta como exigencia del área de seguridad. Los rojos del casillero no llevan `violates`: no rompen nada, simplemente no detectan.
- **El agente del DaemonSet es el de GuardDuty Runtime Monitoring.** Runtime Monitoring no soporta EKS en Fargate: eso justifica en el contexto que los nodos sean EC2.
- **GuardDuty en un clúster sin internet.** Con la configuración automática, GuardDuty crea el endpoint `guardduty-data` y su grupo de seguridad, sin costo adicional. Por eso el óptimo también referencia `no-internet-route`, y la rationale de APIs no lista ese endpoint (además revelaría la respuesta).
- **Interface endpoint para S3 = rojo sin `violates`** (antes naranja). La guía de ECR dice "you must create a gateway endpoint for Amazon S3" porque ECR guarda las capas en S3; la interfaz solo aparece como alternativa para dual-stack. Sirve para los extractos, pero cuesta más y los pods no arrancarían. Decisión del mantenedor, 2026-09-29. El casillero queda sin naranja.
- **Secrets Manager = rojo con `violates: [no-long-lived-credentials]`** en el casillero de identidad: guardar mejor las claves de acceso no las vuelve temporales.
- **Identity Center y Cognito = rojos sin `violates`**: no rompen restricciones, no cumplen el rol. Las rationales dicen para quién es cada uno (fuerza laboral vs usuarios finales).
- **CloudTrail y GuardDuty = rojos sin `violates`** en auditoría: la meta es `soft` y ninguno la cumple, ni a medias.
- **Direct Connect = rojo sin `violates`**: no da salida a internet, simplemente no resuelve el acceso de los nodos a las APIs de AWS.
- **Solo los rojos de NAT e internet gateway llevan `violates: [no-internet-route]`.**
- **Endpoint `eks`.** La rationale lo nombra como "API de EKS" y no afirma nada más. Los nodos se registran por el acceso privado al endpoint del clúster (requisito de la doc de clústeres privados), no por ese endpoint de VPC; la doc de endpoints aclara que el endpoint `eks` no da acceso a la API de Kubernetes.

## TODO(verificar)
- Ninguno abierto. Se cerraron con fuentes:
  - Capas de ECR por S3: gateway endpoint obligatorio según la guía de ECR (ver calibración).
  - Endpoint `eks` y `logs`: tabla de https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html. `logs` es "required for node and pod logs sent to Amazon CloudWatch Logs".
  - Log de auditoría del plano de control: la rationale cita solo https://docs.aws.amazon.com/eks/latest/userguide/control-plane-logs.html y no afirma nada sobre endpoints.
  - Bloqueo de IMDS: https://docs.aws.amazon.com/eks/latest/best-practices/identity-and-access-management.html ("Restrict access to the instance profile assigned to the worker node").

## Fuentes verificadas (2026-09-29)
- Requisitos de clústeres privados: registro en la VPC, acceso privado al endpoint del clúster para que los nodos se registren, tabla de endpoints (`ec2`, `ecr.api`, `ecr.dkr`, `s3`, `logs`, `sts`, `eks-auth`, `eks`…), Pod Identity requiere `eks-auth` e IRSA requiere `sts`: https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html
- Endpoints `eks`, `eks-auth`, `oidc-eks`; el endpoint `eks` no da acceso a la API de Kubernetes: https://docs.aws.amazon.com/eks/latest/userguide/vpc-interface-endpoints.html
- Capas de ECR en S3, gateway endpoint de S3 obligatorio, bucket de capas `prod-<region>-starport-layer-bucket`: https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html
- Pod Identity: agente en cada nodo, `AssumeRoleForPodIdentity` de la API EKS Auth, credenciales temporales: https://docs.aws.amazon.com/eks/latest/userguide/pod-id-how-it-works.html
- Los pods pueden heredar el rol del nodo; bloquear IMDS (`--http-tokens required --http-put-response-hop-limit 1`): https://docs.aws.amazon.com/eks/latest/best-practices/identity-and-access-management.html
- Cifrado por defecto de todos los datos de la API desde Kubernetes 1.28 con clave propiedad de AWS; clave administrada por el cliente opcional, con costo de KMS; clave deshabilitada ⇒ clúster degradado: https://docs.aws.amazon.com/eks/latest/userguide/envelope-encryption.html
- Rotación automática solo para claves administradas por el cliente (365 días por defecto, configurable): https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
- Logs del plano de control (incluido `audit`) a CloudWatch Logs, apagados por defecto, con costo de ingesta y almacenamiento: https://docs.aws.amazon.com/eks/latest/userguide/control-plane-logs.html
- CloudTrail registra las llamadas a la API de EKS: https://docs.aws.amazon.com/eks/latest/userguide/logging-using-cloudtrail.html
- GuardDuty EKS Protection usa "its own independent stream" de los audit logs; habilitar los logs del plano de control en CloudWatch "is not required"; GuardDuty no los deja accesibles en la cuenta: https://docs.aws.amazon.com/guardduty/latest/ug/kubernetes-protection.html
- Runtime Monitoring en EKS: add-on `aws-guardduty-agent`, soporta EC2 y Auto Mode, no Fargate; la configuración automática crea el endpoint `guardduty-data` y un grupo de seguridad, sin costo adicional; el nodo necesita un camino de red a ese endpoint: https://docs.aws.amazon.com/guardduty/latest/ug/how-runtime-monitoring-works-eks.html
- El agente es un DaemonSet `aws-guardduty-agent`: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty-configure-security-agent-eks-addon.html
- Con gestión manual del agente, el endpoint `com.amazonaws.<region>.guardduty-data` es un prerrequisito: https://docs.aws.amazon.com/guardduty/latest/ug/eksrunmon-prereq-deploy-security-agent.html

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes: 14`).
