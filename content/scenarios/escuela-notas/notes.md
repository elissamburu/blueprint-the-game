# Notas del autor · escuela-notas

## Intención pedagógica
Nivel 0: seguridad (responsabilidad compartida, privilegio mínimo), cómputo y alta disponibilidad, con una escuela que lleva su sistema de notas a la nube. Las dos restricciones `hard` son de seguridad y se cruzan a propósito: cada concepto de seguridad es el distractor del otro.

| Casillero | Respuesta | Qué tiene que entender el jugador |
|---|---|---|
| `responsibility` | Modelo de responsabilidad compartida («Cada uno cuida su parte») | AWS cuida la seguridad *de* la nube y la escuela la seguridad *en* la nube. Límite: el reparto cambia según el servicio. Privilegio mínimo es rojo: ordena permisos, pero no reparte responsabilidades. |
| `permissions` | Privilegio mínimo («Cada llave abre solo su puerta») | Cada docente recibe solo los permisos de sus cursos. Límite: un permiso define acciones, recursos y condiciones, y se ajusta con el tiempo. Responsabilidad compartida es rojo. |
| `server` | Amazon EC2 («Computadora alquilada») | El sistema corre en un servidor virtual; el sistema operativo y sus parches son de la escuela. El distractor es S3: guarda archivos, pero no corre el sistema. |
| `availability` | Alta disponibilidad («Tener un repuesto listo») | Si falla una computadora, otra sigue atendiendo. Límite: nunca es 100 % y el repuesto hay que tenerlo configurado. El distractor es la elasticidad: suma capacidad, no reemplaza lo que falla. |

## Paleta curated resultante
Calculada con `buildPalette` (nivel 0: `curated`, hasta 8 tarjetas):
- Respuestas (4): shared-responsibility, least-privilege, ec2, high-availability.
- Distractores (4): s3, elasticity, lambda, fargate (lambda y fargate entran como compañeros de grupo de ec2).
- Total: 8 tarjetas.

## Decisiones de calibración
- **Rol y contexto sin «computadora alquilada»**: es el `plainName` de EC2 y L005 lo revisa por frase completa en el nivel 0. El rol dice «El equipo en la nube donde corre el sistema de notas» y el contexto, «a un equipo en la nube».
- **Objetivo de EC2**: la meta `soft` `no-own-hardware` («sin que la escuela compre equipos propios») se agregó para el óptimo de `server`, que no cumplía ninguno de los otros tres objetivos.
- El `analogyLimit` de `responsibility` dice «En un servidor virtual» y no «En una computadora alquilada», el `plainName` de la respuesta de `server`: se ve después de colocar y revelaba esa tarjeta.
- Sin pistas.

## Fuentes verificadas
- Modelo de responsabilidad compartida (seguridad de la nube vs en la nube; en EC2 el cliente administra el sistema operativo y sus parches): https://aws.amazon.com/compliance/shared-responsibility-model/
- Privilegio mínimo y su ajuste progresivo: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html
- Amazon EC2: https://docs.aws.amazon.com/ec2/
- Disponibilidad como porcentaje y redundancia: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/availability.html

## Pendiente
- [ ] Revisión humana de cada `rationale` y `analogyLimit` (RF-CNT-09) antes de `published`.
- [ ] Jugarlo en preview y medir el tiempo real (`estimatedMinutes`).
