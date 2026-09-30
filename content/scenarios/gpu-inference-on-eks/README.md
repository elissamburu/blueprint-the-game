<!-- Archivo generado por pnpm content:gen a partir de scenario.yaml. No se edita a mano. -->

# Un modelo propio con GPU en la plataforma Kubernetes de la empresa

> ⚠️ **Spoilers:** esta ficha contiene las respuestas del escenario. Si lo querés jugar, no sigas leyendo.

Una logística sirve su modelo de lenguaje ajustado en el clúster que ya usan todos los equipos: GPUs que se apagan de noche, pesos de decenas de GB que cargan rápido y métricas para dimensionar.

| Campo | Valor |
|---|---|
| Id | `gpu-inference-on-eks` |
| Versión | 1 |
| Estado | draft |
| Nivel | 400 |
| Áreas | `ml`, `containers` |
| Duración estimada | 15 min |
| Autores | @elissamburu |
| Paleta | auto |

## Contexto

Una **empresa de logística** tiene una **plataforma interna sobre Kubernetes**: todos los
equipos despliegan con **charts de Helm** y un flujo **GitOps**, y el equipo de plataforma
opera el clúster. Los nodos corren en **subredes privadas** y las imágenes se guardan en
**ECR**.

El equipo de datos ajustó un **modelo de lenguaje open-weights** para **clasificar y resumir
reclamos**. Le cambió la arquitectura (agregó una cabeza de clasificación propia) y entrenó
**adaptadores** por tipo de reclamo que el motor carga **en caliente**, sin reiniciar. Lo
sirve con un **motor de inferencia de código abierto** en un contenedor, que expone una API
HTTP y **devuelve el resumen a medida que lo genera**.

La demanda sigue el día: **picos a la mañana**, cuando entran los reclamos de la noche, y
**casi nada de noche**. Los pedidos duran desde un segundo (clasificar) hasta varios minutos
(resumir un expediente largo).

Los **pesos del modelo pesan decenas de GB**: en el pico, varios nodos nuevos los descargan
a la vez, y cada minuto que tardan es un minuto de GPU pagada sin responder.

## Objetivos

| Id | Tipo | Categoría | Objetivo |
|---|---|---|---|
| `same-platform` | Restricción | team | La inferencia corre en la plataforma Kubernetes existente y se despliega con las mismas herramientas que el resto de los equipos: charts de Helm y GitOps. |
| `own-model` | Restricción | operations | Se sirve el modelo propio, con su arquitectura y sus adaptadores cargados en caliente, sin convertirlo a otro formato. |
| `gpu` | Restricción | performance | Los pods de inferencia corren sobre GPU. |
| `no-idle-capacity` | Meta | cost | No pagar capacidad ociosa de noche: ni GPUs ni almacenamiento aprovisionado que nadie usa. |
| `fast-node-ready` | Meta | scalability | Que un nodo nuevo sirva pedidos lo antes posible en el pico de la mañana, aunque los pesos pesen decenas de GB. |
| `gpu-metrics` | Meta | operations | Tener métricas de uso y de memoria de GPU por nodo y por pod para dimensionar instancias y réplicas. |
| `balanced-load` | Meta | latency | Repartir los pedidos según la carga real de cada réplica: duran de un segundo a varios minutos y la respuesta llega de a partes. |

## Diagrama con las respuestas óptimas

Los casilleros tienen borde punteado.

```mermaid
flowchart LR
  n_data_team(["Equipo de datos"])
  n_consumers(["Sistemas internos de reclamos"])
  n_gitops{{"Repositorio GitOps (charts de Helm)"}}
  subgraph g_region["Región"]
    subgraph g_vpc["Red de la plataforma"]
      subgraph g_nodes_subnets["Subredes privadas de los nodos"]
        n_gpu_compute["Amazon EC2"]
      end
      n_weights_private_path["Gateway VPC endpoint"]
      n_entry["Application Load Balancer"]
    end
    n_registry["Amazon ECR"]
    n_platform["Amazon EKS"]
    n_weights_store["Amazon S3"]
    n_gpu_metrics["Amazon CloudWatch"]
  end
  n_data_team ==>|"1. Publica pesos y adaptadores"| n_weights_store
  n_gitops --o|"1. Sincroniza el chart de Helm"| n_platform
  n_platform --o|"2. Crea un nodo con GPU por demanda"| n_gpu_compute
  n_gpu_compute ==>|"3. Descarga la imagen del motor"| n_registry
  n_gpu_compute ==>|"4. Pide los pesos del modelo"| n_weights_private_path
  n_weights_private_path ==>|"5. Lee los pesos por la red privada"| n_weights_store
  n_consumers -->|"6. Pide clasificar o resumir"| n_entry
  n_entry -->|"7. Envía a la réplica menos cargada"| n_gpu_compute
  n_gpu_compute -.->|"8. Métricas de uso de GPU"| n_gpu_metrics
  classDef slot stroke-dasharray: 6 4,stroke-width:2px
  class n_platform,n_gpu_compute,n_weights_store,n_weights_private_path,n_gpu_metrics,n_entry slot
```

## Respuestas

### Casillero `platform`

> Plataforma que orquesta los contenedores del motor de inferencia, igual que los del resto de los equipos.

| Servicio | Grado | Objetivos | Justificación | Referencias |
|---|---|---|---|---|
| Amazon EKS (`eks`) | 🟢 Óptimo | `same-platform`, `own-model`, `gpu` | Es el clúster que ya opera la plataforma: el motor se despliega con un chart de Helm y lo sincroniza GitOps, como cualquier otro servicio. Como el motor de código abierto corre en un contenedor propio, sirve el modelo con su arquitectura y carga los adaptadores sin convertir nada. Los pods piden GPU (`nvidia.com/gpu`) y el clúster les consigue nodos que la tengan. | [1](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference.html) [2](https://docs.aws.amazon.com/eks/latest/userguide/auto-accelerated.html) |
| Amazon Bedrock (`bedrock`) | 🔴 Incorrecto | viola `own-model`, `same-platform` | Su importación de modelos propios solo acepta ciertas arquitecturas (Llama, Mistral, Mixtral, Flan, GPTBigCode, Qwen y GPT-OSS), con los pesos en formato de Hugging Face: un modelo con arquitectura propia no entra sin rehacerlo. Además, la inferencia quedaría fuera del clúster y de su flujo de despliegue. |  |
| Amazon SageMaker AI (`sagemaker-ai`) | 🔴 Incorrecto | viola `same-platform` | Es una muy buena opción para servir contenedores propios con GPU y escalar endpoints, pero es otra plataforma, con otros despliegues y otra operación, fuera del clúster, de Helm y de GitOps. El caso exige usar la plataforma que el equipo ya opera. |  |
| Amazon ECS (`ecs`) | 🔴 Incorrecto | viola `same-platform` | Soporta tareas con GPU, pero es el orquestador propio de AWS, no Kubernetes: los charts de Helm y el flujo GitOps de la plataforma no sirven ahí. |  |

Pistas:

1. La restricción no es técnica sino de plataforma: tiene que ser el mismo lugar donde despliegan todos.
2. Un servicio administrado de modelos te obliga a encajar en sus arquitecturas; un contenedor propio, no.

### Casillero `gpu-compute`

> Máquinas con GPU donde corren los pods de inferencia, que aparecen con la demanda y desaparecen cuando quedan vacías.

| Servicio | Grado | Objetivos | Justificación | Referencias |
|---|---|---|---|---|
| Amazon EC2 (`ec2`) | 🟢 Óptimo | `gpu`, `no-idle-capacity` | Instancias con GPU (familias G y P) como nodos. Con Auto Mode o Karpenter se crean cuando hay pods de GPU pendientes y se eliminan cuando quedan vacías: de noche queda casi nada. Auto Mode trae los drivers de NVIDIA y el plugin de dispositivos; con nodos propios, la AMI acelerada trae el driver y el toolkit, y el plugin se instala aparte. | [1](https://docs.aws.amazon.com/eks/latest/userguide/auto-accelerated.html) [2](https://docs.aws.amazon.com/eks/latest/userguide/ml-eks-optimized-ami.html) |
| AWS Fargate (`fargate`) | 🔴 Incorrecto | viola `gpu` | Las consideraciones de uso con Kubernetes lo dicen explícitamente: las GPU no están disponibles en esta capacidad serverless. Tampoco corre DaemonSets, que usan los agentes de GPU y de métricas. |  |
| AWS Lambda (`lambda`) | 🔴 Incorrecto | viola `gpu`, `same-platform` | No ofrece GPU y no forma parte del clúster: no puede ser el nodo donde corren los pods de inferencia. |  |

Pistas:

1. La capacidad serverless de contenedores no tiene lo que este modelo necesita.
2. Pensá en máquinas virtuales con aceleradores que el clúster crea y destruye solo.

### Casillero `weights-store`

> Dónde quedan los pesos y los adaptadores que publica el equipo de datos y que cada réplica nueva lee al arrancar.

| Servicio | Grado | Objetivos | Justificación | Referencias |
|---|---|---|---|---|
| Amazon S3 (`s3`) | 🟢 Óptimo | `fast-node-ready`, `no-idle-capacity` | Los pesos quedan en un bucket y cada réplica nueva los lee en paralelo. La guía de inferencia de AWS usa Run:ai Model Streamer, una herramienta de código abierto de NVIDIA que el motor usa para llevarlos directo a la memoria de la GPU; el driver CSI de Mountpoint es otra opción. Se paga lo guardado y los pedidos: de noche no queda capacidad aprovisionada ociosa. | [1](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference.html) [2](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference-fast-model-loading.html) [3](https://docs.aws.amazon.com/eks/latest/userguide/s3-csi.html) |
| Amazon FSx (`fsx`) | 🟠 Aceptable | `no-idle-capacity` | Funciona y es rápido: vinculado al bucket y precalentado, sirve los pesos a muchos nodos a la vez, y la guía de almacenamiento para IA lo recomienda con varias instancias con GPU. Pero se aprovisiona por capacidad, con throughput proporcional a ella, y se paga también de noche, cuando no hay GPUs. | [1](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-storage.html) [2](https://docs.aws.amazon.com/fsx/latest/LustreGuide/ssd-storage.html) |
| Amazon EFS (`efs`) | 🟠 Aceptable | `fast-node-ready` | Un sistema de archivos compartido y elástico que no se aprovisiona: se paga lo guardado y lo leído. La guía lo propone para caches de modelos con necesidades de rendimiento moderadas; cada cliente llega a 1.500 MiBps como máximo, así que decenas de GB por nodo tardan más que leerlos en paralelo. | [1](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-storage.html) [2](https://docs.aws.amazon.com/efs/latest/ug/performance.html) |
| Amazon EBS (`ebs`) | 🔴 Incorrecto | — | Un volumen de bloques se conecta, en general, a un solo nodo y vive en una zona: cada nodo nuevo necesitaría su propia copia de los pesos, y alguien tendría que cargarla antes de que el nodo arranque. |  |
| Amazon ECR (`ecr`) | 🔴 Incorrecto | — | Meter decenas de GB de pesos en la imagen del motor agranda cada descarga y obliga a reconstruir la imagen por cada adaptador nuevo. La guía recomienda montar los pesos como volumen y no embeberlos en la imagen. |  |

Pistas:

1. Nada de lo que elijas debería cobrarse de noche si no hay nodos.
2. La guía de inferencia de AWS lee los pesos en paralelo, directo a la memoria de la GPU, desde el almacén más barato.

### Casillero `weights-private-path`

> Camino privado de los nodos hacia los pesos, que no se sature cuando varios nodos nuevos los descargan a la vez.

| Servicio | Grado | Objetivos | Justificación | Referencias |
|---|---|---|---|---|
| Gateway VPC endpoint (`vpc-gateway-endpoint`) | 🟢 Óptimo | `fast-node-ready`, `no-idle-capacity` | Una ruta en las tablas de las subredes hacia el almacén de los pesos, sin cargo por hora ni por GB. La guía de carga rápida de modelos lo recomienda: el tráfico no pasa por la salida compartida a internet, que en el pico se vuelve el cuello de botella cuando varios nodos bajan el modelo completo a la vez. | [1](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference-fast-model-loading.html) [2](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html) |
| NAT gateway (`nat-gateway`) | 🟠 Aceptable | `fast-node-ready` | Funciona, pero su ancho de banda (hasta 100 Gbps) se comparte entre todos los nodos de la subred: en el pico, varios nodos bajando decenas de GB compiten entre sí y todos tardan más en servir. Además cobra por cada GB que procesa. | [1](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference-fast-model-loading.html) |
| Interface VPC endpoint (AWS PrivateLink) (`vpc-interface-endpoint`) | 🟠 Aceptable | `no-idle-capacity` | Llega por la red privada sin compartir la salida a internet, pero cobra por hora en cada zona aunque de noche no pase nada, y además por GB. La ruta privada sin cargo hace lo mismo para este servicio. | [1](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html) |
| Internet gateway (`internet-gateway`) | 🔴 Incorrecto | — | Los nodos están en subredes privadas: para usarlo tendrían que pasar a subredes públicas con IP pública, y el tráfico iría a los puntos de acceso públicos del servicio. |  |

Pistas:

1. Pensá qué pasa a las 8 de la mañana, cuando diez nodos bajan el modelo completo al mismo tiempo.
2. Para este almacén existe un acceso privado que es solo una ruta y no tiene cargo.

### Casillero `gpu-metrics`

> Métricas de uso, memoria y potencia de cada GPU, por nodo y por pod, para dimensionar instancias y réplicas.

| Servicio | Grado | Objetivos | Justificación | Referencias |
|---|---|---|---|---|
| Amazon CloudWatch (`cloudwatch`) | 🟢 Óptimo | `gpu-metrics` | Container Insights con observabilidad mejorada recolecta métricas de GPU de NVIDIA por nodo, pod y contenedor (uso, memoria, tensor cores, potencia) desde la versión v1.3.0 del add-on de observabilidad. Necesita el plugin de dispositivos de NVIDIA en el clúster y el toolkit de contenedores en los nodos, que ya trae la AMI acelerada. Con el monitoreo detallado, recolecta cada segundo para no perder picos cortos. | [1](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-enhanced-EKS.html) |
| AWS X-Ray (`x-ray`) | 🔴 Incorrecto | — | Traza pedidos a través de los componentes de una aplicación para ver latencias y errores; no mide cuánto se usa cada GPU ni su memoria. |  |
| AWS CloudTrail (`cloudtrail`) | 🔴 Incorrecto | — | Registra las llamadas a las APIs de AWS de la cuenta, por ejemplo quién creó un nodo o cambió un permiso; no mide el uso de las GPU. |  |

Pistas:

1. Buscá el servicio de métricas y logs que ya tiene una vista específica para contenedores.

### Casillero `entry`

> Puerta de entrada interna que reparte los pedidos HTTP entre las réplicas del motor, con respuestas que llegan de a partes.

| Servicio | Grado | Objetivos | Justificación | Referencias |
|---|---|---|---|---|
| Application Load Balancer (`alb`) | 🟢 Óptimo | `balanced-load`, `same-platform` | Se crea desde un Ingress con el controlador de balanceadores, como el resto de la plataforma: interno y con targets IP, directo a los pods. Balancea HTTP y permite el algoritmo de menos pedidos pendientes, que no apila pedidos largos en una réplica. El streaming mantiene viva la conexión; si el primer token tarda, se sube el idle timeout (60 s por defecto, hasta 4000 s). | [1](https://docs.aws.amazon.com/eks/latest/best-practices/load-balancing.html) [2](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html) |
| Network Load Balancer (`nlb`) | 🟠 Aceptable | `balanced-load` | Funciona: el streaming viaja sobre TCP y también se crea desde el clúster, con un Service de tipo LoadBalancer. Pero balancea en capa 4, por conexión, sin ver los pedidos HTTP, así que no puede elegir la réplica con menos pedidos pendientes. La guía lo recomienda para TCP o UDP, o para preservar la IP de origen. | [1](https://docs.aws.amazon.com/eks/latest/best-practices/load-balancing.html) |
| Amazon API Gateway (`apigateway`) | 🔴 Incorrecto | — | Para llegar a un servicio privado del clúster necesita un VPC link hacia un balanceador interno: no lo reemplaza, se sumaría delante sin resolver cómo repartir los pedidos entre las réplicas. |  |

Pistas:

1. El motor habla HTTP: elegí algo que entienda los pedidos, no solo las conexiones.
2. Hay un algoritmo de balanceo que mira cuántos pedidos tiene pendientes cada réplica.

## Referencias

- [Inferencia de IA y ML en EKS](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference.html)
- [Acelerar la carga de modelos en EKS](https://docs.aws.amazon.com/eks/latest/userguide/ml-inference-fast-model-loading.html)
- [Mejores prácticas de EKS para IA y ML: almacenamiento](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-storage.html)
