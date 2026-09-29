# Notas del autor · kubernetes-api-migration

## Intención pedagógica
- **Kubernetes administrado vs orquestador propio vs Kubernetes autoinstalado.** EKS cumple las dos restricciones duras (`keep-kubernetes`, `no-control-plane`). ECS viola `keep-kubernetes`; Kubernetes sobre EC2 viola `no-control-plane`. Es la confusión clásica del grupo `container-orchestration`.
- **Orquestador ≠ capacidad.** Fargate aparece como distractor en el casillero del orquestador y como óptimo en el de capacidad: la idea es que el jugador separe "quién agenda" de "dónde corre".
- **Fargate vs nodos EC2.** Los dos funcionan; los nodos pierden contra la meta `minimal-servers` (tipos de instancia, escalado, despliegue de AMI parcheadas).
- **Balanceo L7 vs L4.** El ALB entiende rutas HTTP y lo crea el AWS Load Balancer Controller desde el Ingress; el NLB llega a los pods pero no ve rutas.
- **Secretos vs parámetros de configuración.** Secrets Manager rota solo la contraseña de la base; Parameter Store la guarda cifrada pero no la rota.

## Decisiones de calibración
- **Fargate + Secrets Manager: el pod lee el secreto con el SDK, no con el driver CSI.** El AWS Secrets and Configuration Provider (ASCP) del Secrets Store CSI Driver **no soporta Fargate**, porque el driver corre como DaemonSet y Fargate no admite DaemonSets. Tampoco hay EKS Pod Identity en Fargate. Por eso la rationale óptima dice que el pod lee el secreto con el SDK usando **IRSA**. Implica un cambio chico de código en la app, no en los manifiestos; por eso `keep-kubernetes` se redactó como "seguir usando Kubernetes y los charts existentes, sin migrar a otro orquestador; se permiten cambios de valores y anotaciones". La anotación de IRSA en la ServiceAccount y `target-type: ip` en el Ingress entran en esa excepción, y ECS la sigue violando. Decisión del mantenedor, 2026-09-29.
- **Nodos EC2 = naranja, no verde, aunque admiten el ASCP.** Con nodos EC2, el secreto se puede montar como archivo sin tocar el código. Ninguna meta del escenario premia eso ("sin cambiar el código de la app" no es objetivo), así que no sube de grado. La rationale del naranja lo menciona como ventaja real para que el jugador lo aprenda.
- **Parameter Store = naranja por `managed-rotation`.** Se agregó esa meta soft para que el naranja tenga contra qué perder (L020). Cumple la restricción dura: SecureString cifra con KMS y el pod lo lee con IRSA. Pero la tabla oficial de Parameter Store dice *Credential rotation: None*, y su documentación recomienda Secrets Manager para credenciales de bases de datos. Es la sexta meta; la skill sugiere 2–5, pero sin ella no hay forma honesta de calificar Parameter Store.
- **NLB = naranja por `path-routing`.** Funciona como entrada y llega a los pods (con Fargate, targets IP), pero es capa 4: para `/pagos` y `/clientes` hace falta un NLB por servicio o un controlador de Ingress propio detrás. No viola ninguna restricción dura, por eso no es rojo.
- **IAM = rojo sin `violates`.** La autenticación de IAM a la base cumpliría la restricción de no tener contraseñas en texto plano, porque no hay contraseña. Pero el rol del casillero es un *almacén* de la contraseña existente, e IAM no guarda secretos. La rationale reconoce la alternativa para no castigar un razonamiento válido sin explicarlo. TODO(verificar): si las métricas muestran que muchos jugadores lo eligen, evaluar pasarlo a naranja o reformular el rol.
- **API Gateway y CloudFront = rojo sin `violates`.** No rompen restricciones, pero no cumplen el rol: no se crean desde el Ingress y necesitan igual un balanceador u origen detrás.
- **Base de datos como nodo fijo de RDS, no como casillero.** Se pidió decidir entre RDS y Aurora. Ningún objetivo distingue entre RDS for PostgreSQL y Aurora PostgreSQL: los dos son PostgreSQL administrado y los dos integran la contraseña maestra con Secrets Manager. Un casillero tendría que marcar uno como verde y otro como naranja sin una meta que lo justifique, o dar dos verdes que no enseñan nada. Se eligió **RDS for PostgreSQL** por ser el traslado más directo de una instancia PostgreSQL existente, y quedó fijo para dar contexto (las áreas del escenario son contenedores y redes). Si más adelante se quiere un casillero de base, hace falta una meta de costo o de escalado de lectura que discrimine; eso requiere `version++` si el escenario ya no está en draft.
- **Casilleros: 5** (rango L009 de nivel 200: 4–7).

## Fuentes verificadas (2026-09-29)
- Fargate en EKS: sin DaemonSets, sin contenedores privilegiados, sin GPU, sin `HostPort`/`HostNetwork`, **solo subredes privadas**; ALB/NLB solo con targets IP; sin IMDS, usar IRSA: https://docs.aws.amazon.com/eks/latest/userguide/fargate.html
- ASCP no soporta Fargate: https://docs.aws.amazon.com/eks/latest/userguide/manage-secrets.html · https://docs.aws.amazon.com/secretsmanager/latest/userguide/integrate_eks.html
- El driver CSI corre como DaemonSet, no soportado en Fargate: https://github.com/aws/secrets-store-csi-driver-provider-aws
- EKS Pod Identity no soporta pods en Fargate: https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html
- IRSA: https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html
- El AWS Load Balancer Controller crea un ALB por cada Ingress; `target-type: ip` obligatorio con Fargate; IngressGroups para compartir un ALB: https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html
- Reglas del ALB por ruta (`path-pattern`): https://docs.aws.amazon.com/elasticloadbalancing/latest/application/rule-condition-types.html
- NLB desde un Service `LoadBalancer`, capa 4: https://docs.aws.amazon.com/eks/latest/userguide/network-load-balancing.html
- EKS certificado como Kubernetes conforme; AWS administra el plano de control: https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html
- Grupos de nodos administrados: AWS crea y actualiza instancias, pero el cliente despliega las AMI parcheadas: https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
- ECR con EKS; en Fargate, el pod execution role descarga las imágenes privadas: https://docs.aws.amazon.com/AmazonECR/latest/userguide/ECR_on_EKS.html
- RDS administra la contraseña maestra en Secrets Manager y la rota cada 7 días por defecto, sin cambios en la aplicación: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html
- Parameter Store: *Credential rotation: None*; recomienda Secrets Manager para credenciales: https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html

## TODO(verificar)
- TODO(verificar): **re-lectura del secreto después de la rotación.** La doc de RDS dice que la rotación no requiere cambios en la aplicación, pero eso supone que la app vuelve a pedir el secreto (por ejemplo, con las bibliotecas de caché de Secrets Manager o reintentando si falla la autenticación). Si la app lo lee una sola vez al arrancar, los pods que ya están corriendo quedan con la contraseña vieja. La rationale dice "la vuelve a leer si cambia"; confirmar con la doc de caché del cliente de Secrets Manager qué patrón recomendar.
- TODO(verificar): **EKS Auto Mode.** La doc de EKS ofrece Auto Mode, que también administra los nodos (aprovisionamiento, parches de SO, escalado). No está en el catálogo. Revisar si compite con Fargate por `minimal-servers` y si soporta DaemonSets (y por lo tanto el ASCP). Si entra al catálogo, este escenario se recalibra (`version++` si ya no está en draft).

## Ideas para una variante de nivel 300
- **Salida de los pods a AWS.** Los pods de Fargate solo corren en subredes privadas, así que para llegar a Secrets Manager, ECR (API y registro Docker) y S3 (capas de las imágenes) necesitan un NAT o endpoints de VPC (de interfaz para Secrets Manager y ECR, de gateway para S3). STS también hace falta para IRSA en clústeres privados. En el nivel 200 no es un casillero para no pasar de 7; en el 300 puede sumarse, combinado con la restricción "sin salida a internet" de `private-vpc-service-access`. Fuentes: https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html · https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html
- **Nodos EC2 + ASCP** como verde si se agrega la meta "montar el secreto sin tocar el código de la app".

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
