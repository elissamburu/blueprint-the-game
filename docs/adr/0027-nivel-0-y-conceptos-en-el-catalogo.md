# 0027 · Nivel 0 «La nube en la vida real» y conceptos en el catálogo

- Estado: Aceptado
- Fecha: 2026-10-06

## Contexto
El juego empieza en el nivel 100, que ya supone saber qué es un servicio de AWS. Quien recién empieza con la nube (por ejemplo, alguien que se prepara para AWS Certified Cloud Practitioner, [CLF-C02](https://docs.aws.amazon.com/aws-certification/latest/examguides/cloud-practitioner-02.html)) necesita primero las ideas de base: responsabilidad compartida, región, zona de disponibilidad, ubicación de borde, pago por uso, elasticidad, alta disponibilidad. Esas ideas no son servicios: hoy no entran en el catálogo ([ADR-0011](0011-catalogo-de-servicios.md)), no tienen ícono oficial ([ADR-0012](0012-iconos.md)) y el modelo de escenarios no tiene dónde explicar una analogía ni sus límites.

El mantenedor decidió:
1. Misma mecánica que el resto del juego: un diagrama de una situación cotidiana (una pizzería, una mudanza) con casilleros; cada casillero es un rol de la vida real y se completa con una tarjeta de la paleta.
2. Los **conceptos** son entradas del catálogo, con tipo `service | concept`, y se usan en la paleta y en las respuestas igual que un servicio.
3. En el nivel 0 la tarjeta muestra primero un **nombre simple** y el nombre real en chico; la explicación de la respuesta muestra el nombre completo.
4. Cada respuesta del nivel 0 explica la analogía y **dónde se rompe**, con referencia oficial.
5. El onboarding suma la opción «Recién empiezo con la nube», que arranca en el nivel 0. «Recién empiezo» (nivel 100) **sigue aparte** y sigue arrancando en 100.

## Decisión

### 1. Catálogo: servicios y conceptos
- Los conceptos viven en el mismo `content/catalog/services.yaml`, en una sección «Conceptos». Un solo espacio de ids: C005, L002 y los buscadores funcionan sin cambios.
- Cada entrada tiene `type: service | concept`. En servicios es opcional y vale `service` por defecto (las entradas existentes no cambian); en conceptos es obligatorio. El schema es una unión discriminada por `type`.

| Campo | `service` | `concept` |
|---|---|---|
| `id`, `name`, `category`, `leakPatterns`, `short`, `docs`, `status` | obligatorios | obligatorios |
| `fullName`, `aliases`, `whenToUse`, `whenNotToUse`, `since` | opcionales | opcionales |
| `plainName` (nuevo, ≤ 40 caracteres) | opcional | opcional |
| `ssmNamespaces`, `icon` (`Arch_…_48` / `Res_…_48`) | como hoy | **no permitidos** |
| `glyph` (nuevo) | no permitido | opcional |

- `docs` de un concepto es su **fuente oficial** y apunta a `docs.aws.amazon.com` o `aws.amazon.com` (C012). Un dato que no se pueda verificar queda como `TODO(verificar)` y no se publica.
- **`plainName`** vive en el catálogo, no en el escenario: el mismo nombre simple en todos los escenarios (p. ej. «Almacenamiento de archivos»). Es obligatorio para toda entrada que aparezca en un escenario de nivel 0 (L022).
- **Categorías**: `categories.yaml` suma `kind: service | concept` (default `service`). Hay cuatro categorías de conceptos: infraestructura global, economía de la nube, beneficios y principios de la nube, y seguridad y cumplimiento (ids definitivos en el PR del schema). Un concepto va en una categoría `concept` y un servicio en una `service` (C011). Las categorías de conceptos son la única excepción a la alineación con las carpetas del paquete de íconos (RF-CAT-02) y no tienen adyacencias con categorías de servicios.
- **Íconos de conceptos**: `glyph` toma un valor de un enum cerrado (`CONCEPT_GLYPHS`, en `packages/scenario-schema`, que sigue siendo puro). `packages/ui` lo mapea con un mapa estático a íconos de **lucide-react**, que ya es dependencia de `ui`, `play` y `web` (licencia ISC): no hay dependencia nueva y el bundle solo incluye los íconos usados. Un test verifica que el mapa y el enum coincidan. Los glifos usan `currentColor`, así que siguen el modo de contraste del sistema ([accesibilidad §3](../accesibilidad.md#3-preferencias-del-sistema)). Sin `glyph`, se muestran las iniciales como hoy.
- **No** se usan los íconos oficiales de grupos (Region, Availability Zone) para conceptos: ADR-0012 los limita a representar servicios en diagramas. Tampoco se dibujan SVG propios.
- **`icons:fetch`** ignora los conceptos (no los reporta como `unmapped`). **`catalog-sync`** (F7, RF-CAT-04) ignora los conceptos: no tienen `ssmNamespaces`.

### 2. «Dónde se rompe la analogía»
Campo nuevo y opcional en una respuesta (`answers[]`):

```yaml
analogyLimit:
  text: "…"              # ≤ 300 caracteres, markdown corto
  references:            # ≥ 1, documentación oficial (dominios de L011)
    - https://docs.aws.amazon.com/…
```

- Lleva sus propias referencias porque el límite de la analogía es un dato de AWS distinto del que justifica el grado.
- Es opcional en cualquier nivel y **obligatorio en toda respuesta `optimal` y `acceptable` del nivel 0** (L021). La UI lo muestra cuando existe, en cualquier nivel.
- Se muestra después de colocar, como la `rationale`: no es texto visible antes de acertar y L005 no lo revisa. Como la `rationale`, no nombra otros servicios ocultos.
- Cambiarlo es un cambio de texto: no exige subir `version` (L014).

### 3. Nivel 0
- `LEVELS` pasa a ser `[0, 100, 200, 300, 400]`. Todo lo que hoy es «por nivel» (`levelMultipliers`, `palette.modeByLevel`, L009, `LevelBadge`, filtros, progreso guardado) suma el 0. El progreso guardado no necesita migración: solo se agrega un valor posible.
- `content/game-rules.yaml`:

```yaml
levelMultipliers: { 0: 0.5, 100: 1, 200: 1.5, 300: 2, 400: 3 }
palette:
  modeByLevel: { 0: curated, 100: curated, 200: categories, 300: categories-plus, 400: full }
  defaultMaxSize: 12
  maxSizeByLevel: { 0: 8 }     # nuevo, opcional: palette.maxSize del escenario > maxSizeByLevel > defaultMaxSize
unlock:
  scenariosRequired: 3
  byExperience:
    newcomer:  [0]                     # Recién empiezo con la nube (nuevo)
    beginner:  [0, 100]                # Recién empiezo: sigue arrancando en 100
    aws-user:  [0, 100, 200]
    architect: [0, 100, 200, 300]
    expert:    [0, 100, 200, 300, 400]
```

- **XP ×0,5**: un escenario de nivel 0 (3–5 casilleros) da 150–250 XP; uno de 100 (2–4 casilleros), 200–400.
- **Paleta**: `curated` con hasta 8 tarjetas (3–5 respuestas y al menos 3 distractores, L016).
- **L009**: el nivel 0 recomienda de 3 a 5 casilleros.
- **Todas las experiencias incluyen el 0.** El nivel 0 no tiene un nivel anterior que lo desbloquee: si una experiencia no lo incluyera, sus escenarios quedarían bloqueados para siempre. Incluirlo no cambia por dónde arranca cada experiencia: el recomendado sale del nivel más alto abierto (RF-NAV-02), así que «Recién empiezo» sigue arrancando en 100 y «Recién empiezo con la nube» en 0. Los jugadores existentes reciben el 0 sin migración, porque `byExperience` se aplica al calcular los desbloqueos. **C008** pasa a exigir que cada experiencia incluya el primer nivel (0) y que sus niveles sean contiguos.
- **Desbloqueo del 0 al 100**: la regla de RF-NAV-03 sin cambios, recorriendo `LEVELS`.
- **Área nueva `fundamentos`** («Fundamentos de la nube») en `areas.yaml`. Todo escenario de nivel 0 la lleva, junto con 1 o 2 áreas técnicas cuando aplique. En el onboarding viene preseleccionada para `newcomer` y se puede editar.
- **Nombre en la UI**: la UI no nombra el examen hasta resolver [ADR-0019](0019-nombre-y-marcas.md); usa «Ideas básicas de la nube». El nombre y el código del examen aparecen solo en la documentación.
- Textos del onboarding: «Recién empiezo con la nube» — «Nunca usé la nube; quiero entender las ideas básicas». «Recién empiezo» mantiene su título y cambia su descripción a «Conozco la idea de nube y quiero empezar con AWS».

### 4. Conceptos en niveles mayores
Un concepto puede ser respuesta, `incorrect` o `palette.extra` en cualquier nivel. Pero los modos `categories`, `categories-plus` y `full` **no agregan conceptos por relleno**: aparecen solo si el escenario los usa, como los servicios `deprecated` (RF-PAL-05). Sin esta regla, `full` llenaría la paleta del nivel 400 de conceptos. En `curated`, los compañeros de un grupo de confusión entran como hoy (p. ej. región, zona de disponibilidad y ubicación de borde).

### 5. Lint

| Regla | Conceptos | Cambio |
|---|---|---|
| L002, L003, L004, L008, L010, L011, L016, L020 | aplican igual | ninguno |
| L005 | aplica | en el nivel 0 también revisa `plainName` (ver abajo) |
| L009 | — | `0: 3–5` |
| L014 | — | `analogyLimit` es texto: no exige `version` |
| **L021** (error) | — | en el nivel 0, toda `optimal`/`acceptable` tiene `analogyLimit` con ≥ 1 referencia oficial |
| **L022** (error) | — | en el nivel 0, toda entrada de la paleta resuelta y de los nodos `fixed` tiene `plainName` |
| C008 | — | cada experiencia incluye el nivel 0, niveles contiguos |
| **C011** (error) | — | `concept` en categoría `kind: concept`; `service` en `kind: service` |
| **C012** (error) | — | `docs` de un concepto en `docs.aws.amazon.com` o `aws.amazon.com` |
| **C013** (warning) | — | el mismo `plainName` en más de una entrada |

**L005 con `plainName` en el nivel 0.** La tarjeta muestra el nombre simple en grande, así que un rol que lo repite revela la respuesta. En escenarios de nivel 0, L005 suma el `plainName` de cada entrada como un patrón más, con la misma severidad que hoy (error si es respuesta; warning si es `incorrect` o `palette.extra`), pero con otra forma de comparar: **por frase completa**, sin distinguir mayúsculas **ni tildes**, y no por palabras sueltas. «Almacenamiento de archivos» filtra en «el almacenamiento de archivos de la pizzería», pero «archivos» o «almacenamiento» solos no. Así el lint se puede cumplir en textos cotidianos. Los `leakPatterns` siguen funcionando como hoy.

**Revisión humana de las analogías.** Una analogía mal elegida enseña algo falso, y eso no lo detecta el lint. Toda analogía del nivel 0 (la `rationale` y el `analogyLimit` de cada respuesta) pasa por revisión humana antes de que el escenario pase a `published`. La plantilla de PR «Nuevo escenario» (RF-CNT-05) suma un ítem para escenarios de nivel 0: «Revisé cada analogía y su "dónde se rompe" contra la referencia oficial». La plantilla todavía no está en el repo: el PR de contenido de F2.1 la crea con ese ítem si sigue sin existir.

### 6. UI
- **Tarjeta del nivel 0** (paleta expandida, colapsada y casillero del tablero): `plainName` arriba y el nombre real debajo, más chico (≥ 0,75 rem fuera del tablero, ≥ 12 px dentro) y con `--muted-foreground` (6,25:1 sobre la tarjeta). El **nombre accesible incluye los dos**: «Almacenamiento de archivos (Amazon S3)», con los paréntesis como texto solo para lectores de pantalla. La paleta colapsada usa el mismo texto en el tooltip y en `aria-label`. El buscador también busca por `plainName`. Fuera del nivel 0, la tarjeta no cambia.
- La decisión de qué nombre mostrar es presentación, no evaluación: vive en `packages/play`, no en `game-engine`.
- **Feedback**: el encabezado usa el nombre completo (`fullName`, o `name` si no hay). Debajo de la explicación, un bloque «Dónde se rompe la analogía» con rótulo de texto e ícono (no solo color) y su enlace a la documentación. Es contenido de la tarjeta de feedback, no un anuncio aparte: el grado se sigue anunciando una sola vez.
- **Onboarding**: cinco opciones de experiencia, `newcomer` primero; el grupo de radios se sigue navegando con flechas.
- **Studio**: el selector de servicio muestra conceptos con una etiqueta «Concepto» y busca por `plainName`; el formulario de una respuesta suma «Dónde se rompe la analogía» (texto y referencias), marcado como obligatorio en el nivel 0; el selector de nivel suma el 0. El Studio no edita el catálogo: los conceptos se agregan por PR.
- Accesibilidad según [docs/accesibilidad.md](../accesibilidad.md): axe en las pantallas tocadas y el protocolo manual completo sobre un escenario de nivel 0. Los nombres de marca no necesitan `lang="en"` (los nombres propios están exceptuados de 3.1.2).

## Alternativas consideradas
- **Conceptos en un archivo aparte (`concepts.yaml`)**: separa mejor la curación, pero duplica el espacio de ids, la carga y las reglas de existencia (L002, C005). Descartado: el `type` alcanza.
- **Conceptos como un tipo de nodo nuevo del diagrama**: rompe la mecánica común (decisión 1) y obliga a cambiar el renderer y el motor ([ADR-0005](0005-modelo-de-diagrama.md)). Descartado.
- **`plainName` en el escenario**: más flexible, pero el mismo servicio tendría nombres simples distintos según el escenario. Descartado.
- **Fusionar «Recién empiezo» con el nivel 0**: decisión del mantenedor en contra; son públicos distintos.
- **Dejar el nivel 0 fuera de `beginner` y las demás experiencias**: bloquea esos escenarios para siempre (no hay nivel anterior que los abra). Descartado.
- **L005 con `plainName` por palabras sueltas**: imposible de cumplir en textos cotidianos («archivos», «pago»). Descartado: frase completa.
- **Íconos oficiales de grupo o SVG propios para conceptos**: ver §1.

## Consecuencias
- El catálogo deja de ser solo de servicios. [ADR-0011](0011-catalogo-de-servicios.md) y [ADR-0012](0012-iconos.md) siguen vigentes para los servicios; este ADR los **complementa** para los conceptos, no los reemplaza.
- La evaluación por objetivos ([ADR-0007](0007-evaluacion-por-objetivos.md)) no cambia: un concepto es `optimal`, `acceptable` o `incorrect` contra los objetivos del escenario, como un servicio.
- Las reglas del nivel 0 son datos en `game-rules.yaml` ([ADR-0018](0018-gamificacion-declarativa.md)); el motor solo suma `maxSizeByLevel` y el nivel 0.
- Cada escenario de nivel 0 cuesta más revisión: analogías con su límite y referencias oficiales, y revisión humana antes de `published`.
- Se implementa en la fase F2.1 del [roadmap](../05-roadmap.md), en cinco PR.

## Referencias
- AWS Certification — [AWS Certified Cloud Practitioner (CLF-C02)](https://docs.aws.amazon.com/aws-certification/latest/examguides/cloud-practitioner-02.html), [Content Domain 1: Cloud Concepts](https://docs.aws.amazon.com/aws-certification/latest/examguides/cloud-practitioner-02-domain1.html), [Content Domain 3: Cloud Technology and Services](https://docs.aws.amazon.com/aws-certification/latest/examguides/cloud-practitioner-02-domain3.html)
- [Lucide — licencia ISC](https://lucide.dev/license)
