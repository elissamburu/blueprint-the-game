# Notas del autor · gpu-inference-on-eks

## Intención pedagógica
Nivel 400: el jugador ya conoce clústeres de EKS (`kubernetes-api-migration`, `private-eks-least-privilege`). Acá el foco está en lo propio de servir un **modelo propio con GPU** sobre una plataforma Kubernetes existente:

- **La plataforma es una restricción, no una preferencia.** Bedrock, SageMaker AI y ECS pueden servir modelos o contenedores con GPU, pero el caso exige Helm y GitOps en el clúster de la plataforma. Bedrock además choca con el modelo propio: Custom Model Import solo acepta una lista cerrada de arquitecturas.
- **Las GPU no están en la capacidad serverless.** Fargate no tiene GPU; los nodos son instancias EC2 con GPU que Auto Mode o Karpenter crean y eliminan según la demanda.
- **El cuello de botella del arranque son los pesos.** Decenas de GB por nodo en el pico de la mañana. La respuesta es doble: dónde se guardan (S3, leído en paralelo) y por dónde viajan (gateway endpoint, para que el NAT compartido no frene a todos los nodos a la vez).
- **Métricas de GPU** para dimensionar, y un **balanceo que entiende HTTP** para pedidos de duración muy variable con respuestas en streaming.

## Decisiones de calibración
- **Casilleros: 6** (L009 recomienda 8–14 en nivel 400; queda como warning). El pedido original fue "agregá otro casillero solo si enseña algo nuevo; si no, no rellenes". Candidatos descartados:
  - Identidad del pod para leer los pesos (`iam`, Pod Identity): repite lo que ya enseña `private-eks-least-privilege`.
  - ECR como casillero (imágenes de 8 a 15 GB, pull paralelo con SOCI): el mantenedor pidió dejarlo como nodo fijo.
  - Manejo de interrupciones de Spot: no encontré una pieza de catálogo que lo enseñe sin depender de Karpenter (que no es un servicio del catálogo).
- **Pesos: S3 verde, FSx y EFS naranjas.** Decisión del mantenedor, 2026-09-30. Las fuentes se contradicen:
  - La **guía de buenas prácticas** de EKS ([aiml-storage](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-storage.html)) recomienda **FSx for Lustre** para "multiple EC2 GPU compute instance" con servicio de modelos, y **Mountpoint for S3** para el escenario "single GPU instance". A EFS lo describe con "moderate performance and scalability needs".
  - La **guía de usuario** de EKS ([ml-inference](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference.html), [ml-inference-fast-model-loading](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference-fast-model-loading.html)) arma el caso de inferencia con **streaming de los pesos desde S3 directo a la memoria de la GPU** (Run:ai Model Streamer, una herramienta de código abierto de NVIDIA, no una función de AWS) y lo presenta como la técnica para los arranques en frío del scale-up.
  - Lo que inclina la balanza es el costo: FSx se aprovisiona por capacidad, con throughput proporcional a los TiB ([ssd-storage](https://docs.aws.amazon.com/fsx/latest/LustreGuide/ssd-storage.html)), y se paga también de noche. Por eso el objetivo de costo dice "ni GPUs ni almacenamiento aprovisionado". FSx es naranja contra `no-idle-capacity`.
  - EFS es naranja contra `fast-node-ready`: Elastic llega a 1.500 MiBps por cliente ([performance](https://docs.aws.amazon.com/efs/latest/ug/performance.html)).
  - **Idea para una variante:** con demanda pareja las 24 horas (sin ahorro nocturno), FSx for Lustre vinculado a S3 y precalentado sería el verde.
- **EBS y ECR = rojos sin `violates` en el casillero de pesos.** Un volumen de bloques no es un punto de publicación compartido. Meter los pesos en la imagen *funciona*, pero la guía de buenas prácticas recomienda no embeberlos (agrandan la imagen y el pull), y cada adaptador nuevo obliga a reconstruirla, lo que va en contra de cargarlos en caliente. Si el reviewer lo prefiere, ECR podría pasar a naranja contra `fast-node-ready` (ver autorevisión en el PR).
- **Acceso a los pesos: gateway endpoint verde, NAT e interface endpoint naranjas.** La guía de carga rápida recomienda explícitamente el gateway endpoint: el NAT (hasta 100 Gbps) se comparte entre todos los nodos de la subred y es el cuello de botella en el scale-up. NAT es naranja contra `fast-node-ready`. El interface endpoint es naranja contra `no-idle-capacity` porque cobra por hora en cada zona aunque de noche no pase tráfico; esta es la calibración más discutible del escenario.
- **Entrada: ALB verde, NLB naranja.** Decisión del mantenedor, 2026-09-30. El objetivo soft `balanced-load` existe para eso: la guía de balanceo de EKS recomienda ALB para cargas HTTP y menciona el algoritmo "least outstanding requests"; NLB balancea por conexión en capa 4. API Gateway es rojo sin `violates`: necesita un VPC link hacia un balanceador, no lo reemplaza.
- **Bedrock = rojo con `violates: [own-model, same-platform]`.** El contexto dice que el modelo tiene una arquitectura propia (una cabeza de clasificación agregada), que no está entre las soportadas por Custom Model Import. La rationale no afirma nada sobre adaptadores: la doc no los menciona.
- **SageMaker AI = rojo con `violates: [same-platform]`**, con una rationale que reconoce que es una muy buena opción para servir contenedores propios con GPU.
- **Métricas: CloudWatch verde.** La guía de usuario de EKS usa Prometheus + Amazon Managed Service for Prometheus + DCGM Exporter + Grafana, que no están en el catálogo. Container Insights con observabilidad mejorada es la alternativa del catálogo y tiene métricas de GPU documentadas.

## TODO(verificar)
- **Lambda sin GPU.** Solo encontré fuentes de terceros que lo confirman; no hay una página de docs.aws.amazon.com que lo diga de forma explícita. La rationale solo dice "no ofrece GPU".
- **Container Insights con GPU en EKS Auto Mode.** Requiere el plugin de dispositivos de NVIDIA; en Auto Mode ese plugin "runs automatically and isn't visible as a daemon set". No encontré una confirmación explícita de que el agente de CloudWatch recolecte las métricas de GPU en nodos de Auto Mode. La rationale habla de la AMI acelerada y no afirma nada sobre Auto Mode.
- **Adaptadores en Custom Model Import.** La doc no menciona adaptadores (LoRA) ni carga en caliente. La rationale de Bedrock no lo usa como argumento: se apoya solo en las arquitecturas soportadas.

## Fuentes verificadas (2026-09-30)
- Custom Model Import: arquitecturas soportadas (Mistral, Mixtral, Flan, Llama 2/3/3.1/3.2/3.3/Mllama, GPTBigCode, Qwen2/2.5/2-VL/2.5-VL/3, GPT-OSS), pesos en formato Hugging Face `.safetensors`, límites de tamaño (< 200 GB texto, < 100 GB multimodal) y de contexto (< 128K): https://docs.aws.amazon.com/bedrock/latest/userguide/model-customization-import-model.html
- Fargate en EKS: "GPUs aren't currently available on Fargate"; no soporta DaemonSets: https://docs.aws.amazon.com/eks/latest/userguide/fargate.html
- ECS soporta GPU con instancias EC2 de GPU: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-gpu.html
- Auto Mode incluye drivers de NVIDIA y el device plugin; escala a cero; NodePool de ejemplo con `consolidationPolicy: WhenEmpty`: https://docs.aws.amazon.com/eks/latest/userguide/auto-accelerated.html
- AMI acelerada AL2023 NVIDIA: incluye driver y container toolkit; el device plugin se instala aparte (Bottlerocket NVIDIA sí lo incluye): https://docs.aws.amazon.com/eks/latest/userguide/ml-eks-optimized-ami.html
- Guía de inferencia en EKS: pesos en S3, streaming a la GPU, SOCI, ALB para producción, Karpenter con escala desde cero: https://docs.aws.amazon.com/eks/latest/userguide/ml-inference.html
- Carga rápida de modelos: gateway endpoint para S3, NAT compartido (100 Gbps) como cuello de botella, Run:ai Model Streamer: https://docs.aws.amazon.com/eks/latest/userguide/ml-inference-fast-model-loading.html
- Buenas prácticas de almacenamiento para IA y ML (FSx for Lustre, Mountpoint, EFS; no embeber pesos en la imagen): https://docs.aws.amazon.com/eks/latest/best-practices/aiml-storage.html
- Mountpoint for S3 CSI driver: no soporta Fargate, solo aprovisionamiento estático: https://docs.aws.amazon.com/eks/latest/userguide/s3-csi.html
- FSx for Lustre: throughput por TiB aprovisionado: https://docs.aws.amazon.com/fsx/latest/LustreGuide/ssd-storage.html
- EFS: Elastic, 1.500 MiBps por cliente: https://docs.aws.amazon.com/efs/latest/ug/performance.html
- Container Insights con métricas de GPU de NVIDIA (agente 1.300034.0+, add-on v1.3.0+, requiere device plugin y container toolkit; monitoreo detallado desde 1 s): https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-enhanced-EKS.html
- Balanceo en EKS: ALB para HTTP con "least outstanding requests", NLB para TCP/UDP o IP de origen, targets IP: https://docs.aws.amazon.com/eks/latest/best-practices/load-balancing.html
- Idle timeout del ALB: 60 s por defecto, de 1 a 4000 s: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes: 15`).
