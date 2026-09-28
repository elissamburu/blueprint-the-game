# Notas del autor · static-website-https

## Intención pedagógica
- Nivel 100, primer escenario con paleta **curated**: el jugador arma la arquitectura canónica de un sitio estático (almacenamiento de objetos + CDN + certificado + DNS) reconociendo la función de cada pieza.
- Dos restricciones `hard` (`no-servers`, `https-own-domain`) para mostrar que "montar un servidor" funciona pero viola una restricción (rojo con `violates`).
- Cada pieza se justifica contra un objetivo distinto: latencia global (CDN), HTTPS con dominio propio (certificado y DNS alias en la raíz), sin servidores y costo mínimo (almacenamiento de objetos).

## Paleta curated resultante
Calculada con `buildCuratedPalette` (maxSize 12 por defecto):
- Respuestas (4): route53, acm, cloudfront, s3.
- Distractores (8): global-accelerator, kms, secrets-manager, alb, ec2, ebs, efs, systems-manager.
- Recortados por maxSize: nlb, apigateway, fsx.

## Decisiones de calibración
- **Sin naranjas.** Ningún servicio del catálogo resuelve un casillero y pierde solo contra una meta `soft`: el balanceador y la red global de IP estáticas no pueden usar el almacenamiento de objetos como destino (rojo, con explicación específica). Si se agrega Amplify Hosting al catálogo, podría ser un naranja o un óptimo alternativo del conjunto "almacenamiento + distribución"; como v1 no modela casilleros combinados, queda fuera.
- **EBS y EFS con `violates: [no-servers]`**: ninguno sirve HTTP por sí solo; necesitan cómputo que alguien administre.
- **Global Accelerator aparece en dos casilleros** (DNS y distribución) con explicaciones distintas: es la confusión típica de "red global de AWS".
- **Certificados en IAM**: CloudFront también acepta certificados subidos al almacén de certificados de IAM (lo menciona la doc de requisitos de certificados). IAM no entra en la paleta armada, así que no se declara; si alguna vez entra (por `extra` o por un grupo de confusión nuevo), habría que declararlo en `incorrect` o como `acceptable` con rationale de renovación manual.

## Fuentes verificadas
- CloudFront enruta cada pedido a la ubicación de borde con menor latencia y cobra por transferencia y pedidos; la transferencia desde orígenes de AWS como S3 no tiene cargo: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
- Certificado de ACM para CloudFront en us-east-1: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
- ACM emite certificados sin costo para servicios integrados: https://aws.amazon.com/certificate-manager/pricing/ · renovación administrada: https://docs.aws.amazon.com/acm/latest/userguide/managed-renewal.html
- Registro alias en la raíz y consultas alias a CloudFront sin cargo: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html
- El endpoint de sitio web de S3 no soporta HTTPS: https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html · OAC: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
- Destinos de Global Accelerator (NLB, ALB, EC2, IP elásticas): https://docs.aws.amazon.com/global-accelerator/latest/dg/about-endpoints.html
- Tipos de destino de ALB (instance, ip, lambda): https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html

## Pendiente
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
