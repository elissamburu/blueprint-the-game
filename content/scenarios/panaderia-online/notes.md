# Notas del autor · panaderia-online

## Intención pedagógica
Nivel 0: la infraestructura global de AWS (región, zona de disponibilidad, ubicación de borde) y la elasticidad, con una panadería de Rosario que vende a todo el país. Cada casillero es un rol de la vida real y cada respuesta explica dónde se rompe la analogía.

| Casillero | Concepto | Qué tiene que entender el jugador |
|---|---|---|
| `main-place` | Región de AWS («Lugar del mundo») | La aplicación funciona en un lugar concreto del mapa, y elegirlo cerca de los clientes baja la latencia. Límite: cada región está aislada y AWS no copia datos entre regiones. |
| `backup` | Zona de disponibilidad («Local aparte en la misma ciudad») | Para sobrevivir a la falla de un edificio entero, la copia va en otra zona de la misma región: separada físicamente, con energía y red propias. Otra región también sobrevive (naranja), pero está más lejos y los datos no se copian solos. |
| `photos` | Ubicación de borde («Sucursal cerca tuyo») | Las fotos se acercan a cada provincia con copias en caché. Límite: solo tiene lo que se pide seguido y busca el resto en el origen. El distractor es el almacenamiento: guarda las fotos, pero en un solo lugar. |
| `scaling` | Elasticidad («Crecer y achicarse según la demanda») | Sumar capacidad en las fiestas y sacarla en enero, sin comprar equipos. Límite: se configuran reglas y sumar capacidad lleva minutos. Los distractores son alta disponibilidad (fallas, no demanda) y pago por uso (cómo se paga, no cuánta capacidad hay). |

## Paleta curated resultante
Calculada con `buildPalette` (nivel 0: `curated`, hasta 8 tarjetas):
- Respuestas (4): region, availability-zone, edge-location, elasticity.
- Distractores (3): s3, high-availability, pay-as-you-go.
- Total: 7 tarjetas.

## Decisiones de calibración
- **Región como naranja en `backup`**: sobrevive a la falla de un edificio, pero queda más lejos de los clientes y la copia entre regiones la configura uno. Cumple a medias `fast-everywhere`. Ese objetivo se amplió de «las fotos» a «la tienda y las fotos» porque un `acceptable` no puede referenciar la restricción `hard` `building-failure` (L020); así también encaja mejor el óptimo de `main-place`.
- **Ubicación de borde en `backup` con `violates: [building-failure]`**: no puede tomar pedidos si la tienda se cae.
- Sin pistas: las analogías y los roles ya están pensados para alguien que recién empieza.

## Fuentes verificadas
- Regiones y zonas de disponibilidad (aislamiento entre regiones, zonas con energía y red propias, separadas físicamente): https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions-availability-zones.html
- Cómo funcionan las ubicaciones de borde y la caché (cada pedido va a la ubicación que mejor puede atenderlo, normalmente la más cercana; lo que no está se busca en el origen): https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HowCloudFrontWorks.html
- Elasticidad («Stop guessing capacity», escalar con pocos minutos de aviso): https://docs.aws.amazon.com/whitepapers/latest/aws-overview/six-advantages-of-cloud-computing.html
- Escalado automático con reglas: https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_adapt_to_changes_autoscale_adapt.html

## Pendiente
- [ ] Revisión humana de cada `rationale` y `analogyLimit` (RF-CNT-09) antes de `published`.
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
