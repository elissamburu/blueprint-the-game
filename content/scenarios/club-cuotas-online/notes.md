# Notas del autor · club-cuotas-online

## Intención pedagógica
Nivel 0: la economía de la nube (pago por uso, Savings Plans, economías de escala) y el almacenamiento de objetos, con un club de barrio que cobra las cuotas online. El contraste central es entre el primer año (uso incierto, sin compromisos) y los siguientes (uso parejo, conviene comprometerse).

| Casillero | Respuesta | Qué tiene que entender el jugador |
|---|---|---|
| `first-year` | Pago por uso («Pagar solo lo que usás») | Sin saber cuánto se va a usar, lo razonable es no comprometerse. Límite: lo guardado se cobra aunque nadie lo mire y los datos que salen hacia internet también se cobran. Savings Plans es rojo: es un compromiso de 1 o 3 años. |
| `later-years` | Savings Plans («Abono con descuento») | Con uso estable, comprometerse da precios más bajos. Límite: el compromiso es por hora, lo no usado se pierde y lo excedente se paga a precio normal. Pago por uso es naranja: funciona, pero paga más. |
| `why-cheaper` | Economías de escala («Comprar al por mayor») | Por qué la nube puede cobrar menos que un servidor propio: AWS junta el uso de muchísimos clientes. Límite: el club no compra al por mayor. El distractor es la elasticidad: explica cómo se adapta la capacidad, no el precio. |
| `receipts` | Amazon S3 («Almacenamiento de archivos») | Los comprobantes se guardan como objetos y se paga por lo guardado, sin gasto fijo. Límite: no es una caja con dueño; quién los ve se define con permisos. El distractor es EFS, un disco compartido para computadoras. |

## Paleta curated resultante
Calculada con `buildPalette` (nivel 0: `curated`, hasta 8 tarjetas):
- Respuestas (4): pay-as-you-go, savings-plans, economies-of-scale, s3.
- Distractores (4): elasticity, efs, ebs, fsx (ebs y fsx entran como compañeros de grupo de s3).
- Total: 8 tarjetas.

## Decisiones de calibración
- **Pago por uso como naranja en `later-years`**: cumple a medias `steady-savings` (paga más que con un compromiso).
- **Savings Plans cubre solo ciertos servicios**: el descuento aplica a cómputo y bases de datos, no a lo guardado en S3. Por eso el contexto dice que las cuotas se cobran «con un sistema que corre en la nube», la `rationale` habla del «cómputo donde corre el sistema de cobro» y el `analogyLimit` aclara que el compromiso vale «solo en ciertos servicios, como cómputo y bases de datos» (con la referencia de tipos de plan).
- **`analogyLimit` de `why-cheaper` sin «pago por uso»**: se ve después de colocar y nombraba la respuesta de `first-year`. Ahora termina en «precios más bajos».
- Sin pistas.

## Fuentes verificadas
- Pago por uso (sin contratos de largo plazo; almacenamiento y transferencia de datos salientes se cobran): https://docs.aws.amazon.com/whitepapers/latest/how-aws-pricing-works/key-principles.html
- Savings Plans (compromiso de gasto por hora durante 1 o 3 años): https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html
- Tipos de Savings Plans y servicios que cubre cada uno: https://docs.aws.amazon.com/savingsplans/latest/userguide/plan-types.html
- Cómo se aplica el compromiso por hora (lo no usado no se acumula; el excedente va a precio normal): https://docs.aws.amazon.com/savingsplans/latest/userguide/sp-applying.html
- Economías de escala: https://docs.aws.amazon.com/whitepapers/latest/aws-overview/six-advantages-of-cloud-computing.html
- Amazon S3: https://docs.aws.amazon.com/s3/

## Pendiente
- [ ] Revisión humana de cada `rationale` y `analogyLimit` (RF-CNT-09) antes de `published`.
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
