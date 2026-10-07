# 03 · Modelo de escenarios

Este documento es la **especificación del formato de contenido**. El schema ejecutable vive en `packages/scenario-schema` (Zod), del que se genera `scenario.schema.json` para autocompletado en editores. Si este documento y el schema difieren, **el schema manda** y este documento se corrige en el mismo PR.

## 1. Estructura de carpetas del contenido

```
content/
├── LICENSE                         # CC BY-NC-SA 4.0 (contenido)
├── areas.yaml                      # áreas de interés (serverless, networking, security, data, ml, containers, …)
├── game-rules.yaml                 # puntajes, multiplicadores, rangos, desbloqueos, modos de paleta
├── badges/
│   └── badges.yaml                 # insignias declarativas
├── catalog/
│   ├── services.yaml               # catálogo curado de servicios
│   ├── categories.yaml             # categorías + adyacencias
│   ├── confusion-groups.yaml       # grupos de servicios que se confunden
│   └── ssm-snapshot.json           # GENERADO por catalog-sync (último snapshot de SSM)
└── scenarios/
    ├── _templates/
    │   └── scenario.template.yaml  # punto de partida comentado
    └── <id>/                       # un directorio por escenario, id en kebab-case
        ├── scenario.yaml           # ✍️ FUENTE DE VERDAD (a mano o con el Studio)
        ├── notes.md                # ✍️ opcional: notas del autor, fuentes, decisiones de calibración
        ├── diagram.mmd             # ⚙️ GENERADO – no editar
        └── README.md               # ⚙️ GENERADO – ficha legible en GitHub (incluye Mermaid)
```

### Por qué plano por `id` y no por nivel/área
- El **nivel** y las **áreas** son metadatos que pueden cambiar en una recalibración. Si fueran carpetas, recalibrar sería mover archivos, con diffs ruidosos y links rotos.
- Un escenario pertenece a **varias** áreas; una jerarquía de carpetas obliga a elegir una.
- El índice por nivel/área lo genera `content:build` (`index.json`) y lo filtra la UI.

### Reglas de nombres
- `id`: kebab-case, 3–64 caracteres, `^[a-z0-9]+(-[a-z0-9]+)*$`, **igual al nombre de la carpeta** e **inmutable** una vez publicado (el progreso de los jugadores se asocia al `id`).
- `_` al inicio de una carpeta = no es un escenario (plantillas, fixtures).

### Artefactos generados (no se editan)
| Archivo | Generado por | Propósito |
|---|---|---|
| `diagram.mmd` | `pnpm content:gen` | Vista Mermaid **con respuestas óptimas**, útil para revisar PRs y navegar el repo. |
| `README.md` | `pnpm content:gen` | Ficha del escenario en GitHub: metadatos, objetivos, diagrama Mermaid, tabla de respuestas. |
| `dist/content/**` | `pnpm content:build` | Bundle JSON que consume el juego (no se commitea). |

CI corre `pnpm content:gen --check` y falla si `diagram.mmd` o `README.md` no coinciden con el `scenario.yaml`.

### Qué escenarios entran al bundle (`content:build`)

| `status` | JSON del escenario | Listado en `index.json` |
|---|---|---|
| `draft` | No (solo con `--include-drafts`) | No (solo con `--include-drafts`) |
| `beta` | Sí | Sí |
| `published` | Sí | Sí |
| `retired` | Sí, para que el historial de los jugadores lo pueda abrir | No |

`pnpm content:build --include-drafts` agrega los `draft` al bundle y al índice para probarlos en desarrollo local. **El deploy nunca usa `--include-drafts`**: un `draft` no llega a producción aunque esté mergeado en `main`.

> ⚠️ Los README generados contienen las respuestas (spoilers). Es una decisión aceptada: el repo es público y la idea es no hacerse trampa uno mismo.

## 2. Especificación de `scenario.yaml` (schemaVersion 1)

```yaml
schemaVersion: 1                 # versión del FORMATO (migraciones en packages/scenario-schema/migrations)
id: serverless-pdf-processing    # = nombre de carpeta
version: 1                       # versión del CONTENIDO; incrementar si cambian respuestas/grados
status: draft                    # draft | beta | published | retired
lang: es
level: 200                       # 100 | 200 | 300 | 400
areas: [serverless, storage]     # ids de content/areas.yaml (≥1)
title: "…"                       # ≤ 80 caracteres, sin nombres de servicios ocultos
summary: "…"                     # ≤ 200 caracteres, para la tarjeta del listado
estimatedMinutes: 8
authors:
  - github: usuario
contributors: []                 # opcional
context: |                       # markdown; narrativa del caso de negocio
  …
objectives:                      # definen qué es "óptimo"
  - id: no-servers               # kebab-case, único en el escenario
    kind: hard                   # hard = restricción (violarla ⇒ rojo) | soft = meta (cumplirla peor ⇒ naranja)
    category: operations         # cost | traffic | operations | latency | security | compliance |
                                 # durability | availability | scalability | performance | team
    text: "El equipo no quiere administrar servidores ni parches de SO."
diagram:
  canvas: { width: 1400, height: 800 }   # coordenadas lógicas; el renderer escala.
                                         # position de un nodo = esquina superior izquierda de su caja
  groups:
    - id: cloud
      kind: aws-cloud            # aws-cloud | region | vpc | az | subnet-public | subnet-private |
                                 # account | on-premises | generic
      label: "Nube"
      rect: { x: 180, y: 40, w: 1180, h: 720 }
      parent: null               # id de otro grupo (anidamiento)
  nodes:
    - id: client
      type: actor                # actor | external | fixed | slot
      label: "Cliente"
      icon: user                 # para actor/external: user | users | mobile | browser | server | third-party
      position: { x: 40, y: 360 }
    - id: logs
      type: fixed                # servicio visible desde el inicio (da contexto)
      service: cloudwatch
      position: { x: 1200, y: 680 }
      group: cloud
    - id: upload-store
      type: slot
      role: "Almacén durable de objetos donde queda el PDF original."   # ≤ 140 caracteres
      position: { x: 520, y: 360 }
      group: cloud
      answers:                   # ≥ 1 optimal
        - service: s3
          grade: optimal
          objectives: [no-servers, low-cost]      # ≥ 1 para optimal/acceptable. optimal: objetivos que cumple;
                                                  # acceptable: metas (soft) que cumple a medias (L020)
          rationale: "…"                          # markdown corto, sin nombrar OTROS servicios ocultos
          references:
            - https://docs.aws.amazon.com/...
          analogyLimit:                           # opcional: dónde se rompe la analogía (ADR-0027 §2)
            text: "…"                             # ≤ 300 caracteres, markdown corto; se muestra después de colocar
            references:                           # ≥ 1, solo docs.aws.amazon.com o aws.amazon.com
              - https://docs.aws.amazon.com/...
      incorrect:                 # confusiones típicas con explicación específica (también son distractores);
                                 # la rationale es obligatoria: sin explicación específica ⇒ palette.extra
        - service: ebs
          violates: []           # opcional: ids de objetivos (hard o soft) que viola; solo permitido en incorrect
          rationale: "…"         # obligatoria, ≤ 600 caracteres
      hints:                     # 0–3, de más general a más específica
        - "…"
  edges:
    - id: e1
      from: client
      to: upload-store
      step: 1                    # orden en el reproductor de flujo; pasos iguales = en paralelo
      label: "Sube el PDF"       # ≤ 40 caracteres
      description: "…"           # opcional, se muestra al reproducir el paso
      style: sync                # sync | async | data | control
palette:                         # opcional
  mode: auto                     # auto | curated | categories | categories-plus | full
  maxSize: 12                    # solo con mode curated o auto; con auto aplica solo si el nivel
                                 # resuelve a curated (game-rules). Default: palette.defaultMaxSize
  extra: [efs]                   # distractores extra sin explicación específica
references:                      # opcional: lecturas generales del escenario
  - title: "…"
    url: https://...
```

### Geometría del diagrama (contrato)

`position` es la **esquina superior izquierda** de la caja del nodo, y `rect` la de un grupo (`x`, `y`, `w`, `h`), en unidades lógicas del `canvas`. El tamaño lógico de cada tipo de nodo es la constante `NODE_SIZE` exportada por `@blueprint/scenario-schema`:

| Tipo | Ancho × alto |
|---|---|
| `slot` | 160 × 160 |
| `fixed` | 160 × 80 |
| `actor` | 120 × 80 |
| `external` | 120 × 80 |

El renderer dibuja cada nodo con ese tamaño y el lint L007 lo usa para chequear bordes, pertenencia a grupos y superposiciones. Cambiar un tamaño es un cambio de contrato: puede invalidar escenarios existentes (L007) y se hace en un PR propio.

### Paleta curated

El modo de paleta **resuelto** es `palette.mode` si es explícito, o `game-rules.palette.modeByLevel[level]` si es `auto` o no hay `palette` (`resolvePaletteMode` en `@blueprint/scenario-schema`). Cuando resuelve a `curated`, la paleta se arma siempre igual (`buildCuratedPalette`, la misma función que usan el lint y el motor), en este orden:

1. Todas las respuestas (`optimal` y `acceptable`) de todos los casilleros. **Nunca se recortan.**
2. Los servicios de `incorrect` de los casilleros.
3. `palette.extra`.
4. Los compañeros de grupos de confusión de las respuestas, salvo los `deprecated`.

Dentro de cada paso se respeta el orden de aparición (nodos en orden del diagrama y, dentro de cada uno, el orden de sus listas; grupos de confusión en el orden del archivo). Se omiten los servicios ya agregados, los servicios de nodos `fixed` como distractores y los que no están en el catálogo (L002 los reporta). Servicios `deprecated` (RF-PAL-05): aparecen si el autor los eligió explícitamente (respuesta, `incorrect` o `palette.extra`; L010 lo advierte cuando no es `optimal`), pero nunca llegan solo por el relleno automático del paso 4. Los distractores (pasos 2–4) se recortan al llegar a `maxSize` (`palette.maxSize` o `palette.defaultMaxSize` de game-rules).

### Semántica de la evaluación

Para un casillero y un servicio colocado `s`:

1. Si `s` está en `answers` → el grado es el declarado.
2. Si no, si `s` está en `incorrect` → rojo con la `rationale` específica (siempre existe: es obligatoria).
3. Si no (el servicio no está declarado en `answers` ni en `incorrect`, por ejemplo uno de `palette.extra`) → rojo con **explicación genérica**: `"<descripción corta del catálogo>. No cumple el rol: <role>"`.

Un servicio que viola un objetivo `hard` **debe** declararse en `incorrect` con `violates: [<id>]`; la UI usa ese vínculo para decir qué restricción se violó (RF-EVAL-03).

### Objetivos de cada respuesta

Cada respuesta tiene una sola lista de objetivos, y lo que significa depende del grado. El panel de feedback la muestra como etiquetas (`objectiveStatuses` en `game-engine`):

| Grado | Campo | Significado | Etiqueta |
|---|---|---|---|
| `optimal` | `objectives` | Objetivos que **cumple**. | ✓ Cumple |
| `acceptable` | `objectives` | Metas (`soft`) que cumple **a medias**: por qué es naranja y no verde. | — A medias |
| `incorrect` | `violates` | Objetivos que **viola** (opcional). | ✗ Viola |
| no declarado | — | Sin etiquetas: solo la explicación genérica. | — |

Un `acceptable` referencia **solo** objetivos `soft` (L020): una restricción `hard` no se cumple a medias; si el servicio no la cumple, va en `incorrect` con `violates`. En un `acceptable` no se listan los objetivos que sí cumple (la `rationale` puede mencionarlos).

### Qué NO modela v1 (a propósito)
- Casilleros con **combinación** de servicios (p. ej. "CDN + firewall"). Se modela como dos casilleros.
- Respuestas dependientes entre casilleros ("si pusiste X acá, entonces Y allá es óptimo").
- Configuración de servicios (tamaños, clases de almacenamiento). Si hace falta, va en el `role`.

## 3. Reglas de lint semántico (`packages/content-lint`)

`lintScenario` recibe el escenario, el catálogo, los grupos de confusión, game-rules y las áreas **ya parseados** por `@blueprint/scenario-schema`, más el nombre de la carpeta del escenario, y devuelve `Issue[]` (`code`, `severity`, `message`, `path`). No hace IO: la lectura de archivos y de git (L012, L014) la hace el CLI.

| Código | Severidad | Regla |
|---|---|---|
| L001 | error | `id` coincide con el nombre de la carpeta. |
| L002 | error | Todo `service` existe en `content/catalog/services.yaml` (nodos `fixed`, `answers`, `incorrect` y `palette.extra`). |
| L003 | error | Cada `slot` tiene ≥ 1 respuesta `optimal`. |
| L004 | error | Cada `optimal`/`acceptable` referencia objetivos (`objectives[].id`) existentes. Que la `rationale` no esté vacía y que haya ≥ 1 objetivo lo valida el schema. |
| **L005** | **error / warning** | **Sin filtraciones**: ningún `leakPattern` aparece en `title`, `summary`, `context`, `objectives[].text`, `role`, `hints`, `label` de grupos, `label` de nodos `actor`/`external` o `label`/`description` de aristas. Case-insensitive, por límites de palabra que reconocen acentos y ñ. **Error** si nombra una respuesta (`optimal` o `acceptable`) de cualquier casillero: un `acceptable` también confirma que el jugador va bien. **Warning** si nombra un servicio de `incorrect` o de `palette.extra`: filtra por eliminación, pero puede haber usos narrativos legítimos (decide el autor). Los servicios de nodos `fixed` se ignoran siempre, aunque sean respuesta de otro casillero, porque ya son visibles. Los servicios que no participan del escenario no tienen restricción. |
| L006 | error | Aristas referencian nodos existentes; `step` sin huecos (1..n). Que `step` sea entero ≥ 1 lo valida el schema. |
| L007 | error / warning | Con las cajas de `NODE_SIZE` (§2). **Error**: un nodo o un grupo fuera del `canvas`; un nodo con `group` fuera del `rect` de su grupo; un grupo hijo fuera del `rect` de su `parent`; dos nodos cualesquiera superpuestos (compartir solo el borde no cuenta). **Warning**: grupos hermanos (mismo `parent`) superpuestos, porque hay superposiciones legítimas (p. ej. un grupo `generic` transversal a varias subredes) pero casi siempre es un descuido; un nodo **sin** `group` cuya caja queda dentro del `rect` de un grupo (suele ser un `group` olvidado). |
| L008 | error | Un servicio no aparece dos veces en el mismo casillero (entre `answers` e `incorrect`). |
| L009 | warning | Cantidad de casilleros recomendada por nivel — 100: 2–4 · 200: 4–7 · 300: 6–10 · 400: 8–14. |
| L010 | error / warning | Servicio `deprecated`: error si es `optimal`; warning en otros usos. |
| L011 | warning | Cada `optimal` tiene ≥ 1 `reference` a documentación oficial (dominios permitidos, por coincidencia exacta del host: `docs.aws.amazon.com`, `aws.amazon.com`). |
| L012 | error | `diagram.mmd` y `README.md` sincronizados (`content:gen --check`). `content-lint` exporta la comparación pura (`checkGeneratedFiles`, ignora finales de línea CRLF); el CLI lee los archivos y corre el generador. |
| L013 | error | Límites de longitud (title 80, summary 200, role 140, label 40, rationale 600). `label` aplica a todos los `label` (grupos, actores/externos y aristas) y `rationale` a `answers` e `incorrect`. **Se aplica en el schema** (`packages/scenario-schema`), no en `content-lint`. |
| L014 | error (CI) | Si el escenario existe en `main` con `status` distinto de `draft` (`beta` y `published` otorgan XP; `retired` conserva progreso histórico), todo cambio que altere el resultado de un intento o las condiciones de juego exige incrementar `version`: por casillero (`id`), el conjunto de (`service`, `grade`) de `answers` y el de servicios de `incorrect`; casilleros agregados o quitados; `level`; `palette` (`mode`, `maxSize`, `extra`). No lo exigen los cambios de texto (`rationale`, `references`, `analogyLimit`, `hints`, `context`, objetivos, labels), de orden ni de posiciones del diagrama. Escenarios nuevos o en `draft` en `main`: no aplica. `content-lint` exporta la comparación pura (`checkVersionBump`); el CLI lee `main` con git. |
| L015 | error | `violates` solo se permite en `incorrect` (lo valida el schema) y referencia objetivos existentes (lo valida el lint). Si la rationale de un `acceptable` menciona que viola una restricción `hard`, el servicio debe moverse a `incorrect` (la revisión crítica de IA y el reviewer lo verifican; el lint valida la estructura). |
| L016 | error / warning | Si el modo de paleta **resuelto** es `curated` (sea cual sea el nivel; ver "Paleta curated" en §2): **error** si las respuestas solas superan `maxSize` (la paleta no puede contenerlas); **warning** si la paleta armada tiene < 3 distractores. Se cuentan los distractores que efectivamente entran, después del recorte por `maxSize`. |
| L017 | warning | Enlaces en `references` responden 200 (job de CI semanal, no bloqueante en PR). |
| L018 | error | Ids únicos dentro de cada colección (`objectives`, `diagram.groups`, `diagram.nodes`, `diagram.edges`); `node.group` y `group.parent` apuntan a grupos existentes, sin ciclos de anidamiento. Las demás referencias viven en una sola regla: `answers[].objectives` en L004, `incorrect[].violates` en L015 y `from`/`to` de aristas en L006. |
| L019 | error | Cada id de `areas` existe en `content/areas.yaml`. |
| L020 | error | En una respuesta `acceptable`, `objectives` referencia solo objetivos `kind: soft`: son las metas que cumple a medias (§2 "Objetivos de cada respuesta"). Una restricción `hard` no se cumple a medias: si no se cumple, el servicio va en `incorrect` con `violates`. Los ids inexistentes los reporta L004. |

### Integridad entre archivos compartidos (C0xx)

`lintSharedContent` recibe `catalog`, `categories`, `confusionGroups`, `areas`, `gameRules` y `badges` **ya parseados** y devuelve `Issue[]`; el primer segmento de cada `path` es la clave del archivo (p. ej. `["catalog", 3, "category"]`). `content:validate` la ejecuta una sola vez, antes de los escenarios, y muestra sus issues en un bloque propio ("Integridad entre archivos compartidos"). Si falta alguno de los seis archivos o no pasa el schema, se informa como omitida.

| Código | Severidad | Regla |
|---|---|---|
| C001 | error | La `category` de cada servicio de `services.yaml` existe en `categories.yaml`. |
| C002 | error | Cada id de `adjacent` en `categories.yaml` existe y no es la propia categoría. |
| C003 | error | Cada servicio de un grupo de `confusion-groups.yaml` existe en `services.yaml`. |
| C004 | error | Un grupo de confusión no repite servicios y tiene ≥ 2 servicios **distintos**. Que tenga ≥ 2 entradas lo valida el schema. |
| C005 | error | Ids únicos en cada archivo: servicios, categorías, grupos de confusión, áreas, insignias y rangos de `game-rules.yaml`. |
| C006 | error | El `area` de las reglas de insignias (`complete_count`, `area_mastery`) existe en `areas.yaml`. Que `level` y `minLevel` sean niveles válidos (100, 200, 300, 400) lo valida el schema. |
| C007 | error | Los `ranks` de `game-rules.yaml` empiezan en `minXp: 0` y siguen ordenados por `minXp` estrictamente creciente (sin umbrales repetidos). |
| C008 | error | En `unlock.byExperience` de `game-rules.yaml`, cada experiencia incluye el nivel 100 y sus niveles son contiguos, sin saltos (p. ej. `[100, 300]` falla). El orden dentro de la lista no importa. |
| C009 | warning | Un grupo de confusión incluye un servicio `deprecated`. La paleta curated no lo agrega como compañero de grupo (paso 4 de "Paleta curated"), así que el grupo pierde ese distractor salvo que el escenario lo nombre explícitamente. |
| C010 | warning | El mismo `leakPattern`, comparado sin distinguir mayúsculas, aparece en más de un servicio: L005 no puede distinguir cuál de los dos filtra. Las repeticiones dentro de un mismo servicio no se reportan. |
| C011 | error | Un concepto (`type: concept`) va en una categoría `kind: concept` y un servicio en una `kind: service`. Si la categoría no existe, lo reporta C001. |
| C012 | error | El `docs` de un concepto apunta a `docs.aws.amazon.com` o `aws.amazon.com` (los mismos dominios que L011): es su fuente oficial. |
| C013 | warning | El mismo `plainName` aparece en más de una entrada, comparado sin distinguir mayúsculas ni tildes (y con los espacios normalizados): en el nivel 0 las dos tarjetas se verían igual. |

> **Nota sobre L005:** muchos nombres de servicios son palabras comunes (*Config*, *Glue*, *Batch*, *Shield*, *Connect*). Por eso el catálogo define `leakPatterns` explícitos por servicio (p. ej. `["AWS Config", "Config rules"]`) en vez de usar el nombre a secas. Los falsos positivos se resuelven ajustando patrones en el catálogo, no silenciando la regla en el escenario.

## 4. Catálogo (`content/catalog/services.yaml`)

```yaml
- id: s3                                  # estable, kebab-case; lo que usan los escenarios
  name: Amazon S3
  fullName: Amazon Simple Storage Service
  category: storage                       # id de categories.yaml
  aliases: [s3, simple storage]           # para el buscador de la paleta
  leakPatterns: ["S3", "Simple Storage Service"]
  short: "Almacenamiento de objetos durable y escalable, pago por uso."
  whenToUse: "…"                          # para el álbum de servicios (RF-GAM-06)
  whenNotToUse: "…"
  docs: https://docs.aws.amazon.com/s3/
  ssmNamespaces: [s3]                     # namespaces de /aws/service/global-infrastructure/services
  icon: Arch_Amazon-Simple-Storage-Service_48   # opcional: nombre base del ícono de 48 px en el paquete oficial (Arch_… o Res_…)
  status: active                          # active | deprecated
  since: 2006
```

`icon` es el nombre base (sin carpeta ni extensión) de un ícono de 48 px del paquete oficial de íconos de arquitectura de AWS: `Arch_…_48` para servicios y `Res_…_48` para recursos que no son servicios (Internet Gateway, NAT Gateway, endpoints de VPC, ALB). `pnpm icons:fetch` lo resuelve contra el paquete descargado y genera `apps/web/public/icons/<id>.svg`, que no se versiona ([ADR-0012](adr/0012-iconos.md)). Si falta, la UI muestra las iniciales del servicio sobre el color de su categoría.

`ssmNamespaces` existe porque los parámetros públicos de SSM listan **namespaces de API** (p. ej. `apigateway`, `apigatewayv2`, `apigatewaymanagementapi`), no productos 1:1. El mapeo producto ↔ namespaces es curación humana.

`plainName` (opcional, ≤ 40 caracteres) es el nombre simple de la entrada para quien recién empieza (p. ej. «Almacenamiento de archivos»). Vive en el catálogo y no en el escenario, así que es el mismo en todos los escenarios ([ADR-0027](adr/0027-nivel-0-y-conceptos-en-el-catalogo.md) §1).

### Conceptos

El catálogo también tiene **conceptos**: ideas de la nube que no son servicios (región, zona de disponibilidad, responsabilidad compartida, pago por uso…). Comparten el espacio de ids con los servicios, así que se usan igual en `answers`, `incorrect`, `palette.extra` y nodos `fixed`, y L002 y C005 funcionan sin cambios ([ADR-0027](adr/0027-nivel-0-y-conceptos-en-el-catalogo.md)).

```yaml
- id: region
  type: concept                           # obligatorio en conceptos; en servicios es opcional y vale `service`
  name: Región de AWS
  plainName: Lugar del mundo              # opcional, ≤ 40 caracteres
  category: concept-global-infrastructure # una categoría `kind: concept` (C011)
  leakPatterns: ["Región de AWS", "AWS Region"]
  short: "…"
  docs: https://docs.aws.amazon.com/...   # fuente oficial: docs.aws.amazon.com o aws.amazon.com (C012)
  glyph: region                           # opcional, de CONCEPT_GLYPHS
  status: active
```

El schema es una unión discriminada por `type`, con objetos estrictos:

| Campo | `service` | `concept` |
|---|---|---|
| `id`, `name`, `category`, `leakPatterns`, `short`, `docs`, `status` | obligatorios | obligatorios |
| `fullName`, `aliases`, `whenToUse`, `whenNotToUse`, `since` | opcionales | opcionales |
| `plainName` (≤ 40 caracteres) | opcional | opcional |
| `ssmNamespaces`, `icon` | como arriba | **no permitidos** (error de schema) |
| `glyph` | **no permitido** | opcional |

`glyph` toma un valor del conjunto cerrado `CONCEPT_GLYPHS` de `@blueprint/scenario-schema`: `region`, `availability-zone`, `edge-location`, `global-network`, `shared-responsibility`, `pay-as-you-go`, `savings`, `elasticity`, `high-availability`, `fault-tolerance`, `security`, `compliance`. La UI lo dibuja con un ícono de lucide-react; sin `glyph`, muestra las iniciales, como un servicio sin ícono. Los conceptos no usan íconos oficiales de AWS ([ADR-0012](adr/0012-iconos.md)): `pnpm icons:fetch` los ignora y no los reporta como sin mapear.

Los modos de paleta `categories`, `categories-plus` y `full` **no agregan conceptos por relleno**: aparecen solo si el escenario los usa (respuesta, `incorrect` o `palette.extra`), como los servicios `deprecated` (RF-PAL-07). En `curated` entran como cualquier entrada, incluidos los compañeros de un grupo de confusión.

## 5. Grupos de confusión (`confusion-groups.yaml`)

```yaml
- id: messaging
  services: [sqs, sns, eventbridge, kinesis-data-streams, mq]
  note: "Colas vs pub/sub vs bus de eventos vs streaming."
- id: load-balancing-entry
  services: [alb, nlb, apigateway, cloudfront, global-accelerator]
- id: relational
  services: [rds, aurora, aurora-dsql, redshift]
```

## 6. Áreas, categorías, reglas de juego e insignias

Formatos validados por `packages/scenario-schema`. Los valores de ejemplo son los iniciales de [01](01-requerimientos-funcionales.md).

### `areas.yaml`

```yaml
- id: serverless                  # kebab-case; lo que usan los escenarios en `areas`
  name: Serverless
  description: "…"                # opcional
```

### `catalog/categories.yaml`

```yaml
- id: storage                     # kebab-case; lo que usa `category` en services.yaml
  name: Almacenamiento
  kind: service                   # opcional: service (default) | concept (C011)
  adjacent: [database]            # opcional: categorías adyacentes para el modo categories-plus
```

Las categorías de conceptos (`kind: concept`) son cuatro: `concept-global-infrastructure` (Infraestructura global), `concept-cloud-economics` (Economía de la nube), `concept-cloud-principles` (Beneficios y principios de la nube) y `concept-security-compliance` (Seguridad y cumplimiento). Llevan el prefijo `concept-` para no chocar con las de servicios, no se alinean con el paquete de íconos y no tienen adyacencias.

La adyacencia es **simétrica por definición**: si `storage` lista a `database`, también `database` es adyacente a `storage`, aunque no lo liste. Alcanza con declarar cada par de un solo lado. Donde se usa (modo `categories-plus`), se resuelve en ambos sentidos con `adjacentCategories` de `@blueprint/scenario-schema`; no hay regla de lint que exija declararla en los dos archivos.

### `game-rules.yaml`

```yaml
scoring:
  firstTryGreen: 100              # verde al primer intento
  greenAfterErrors:               # verde tras N errores: max(min, firstTryGreen − penaltyPerError·N)
    penaltyPerError: 25
    min: 25
  acceptedAcceptable: 50          # naranja aceptado por el jugador
  hintCost: 15                    # por pista usada (el puntaje del casillero no baja de 0)
  revealedSolution: 0             # casillero con la solución vista (RF-PLAY-14); ≤ acceptedAcceptable y ≤ greenAfterErrors.min
levelMultipliers: { 100: 1, 200: 1.5, 300: 2, 400: 3 }   # los cuatro niveles son obligatorios
ranks:                            # ≥ 1, umbral de XP acumulada
  - { id: aprendiz, name: Aprendiz, minXp: 0 }
  - { id: constructor, name: Constructor, minXp: 1000 }
unlock:
  scenariosRequired: 3            # por área: completar min(3, escenarios del área en N) del área en N
                                  # para abrir N+1 en esa área; si el área no tiene escenarios de N,
                                  # min(3, escenarios de N de cualquier área) de cualquier área; si no
                                  # hay escenarios de N en ninguna, no se abre (RF-NAV-03)
  byExperience:                   # niveles desbloqueados al inicio en todas las áreas (las 4 claves)
    beginner: [100]
    aws-user: [100, 200]
    architect: [100, 200, 300]
    expert: [100, 200, 300, 400]
palette:
  modeByLevel: { 100: curated, 200: categories, 300: categories-plus, 400: full }  # a qué resuelve `auto`
  defaultMaxSize: 12              # maxSize de curated si el escenario no lo define
```

`modeByLevel` acepta `curated`, `categories`, `categories-plus` y `full` (no `auto`, que es justamente lo que se resuelve con esta tabla).

### `badges/badges.yaml`

```yaml
- id: primer-verde
  name: "Primer verde"
  description: "Completaste tu primer escenario."   # obligatoria
  secret: false                                    # opcional (default false): oculta hasta obtenerla
  rule: { type: complete_count, count: 1 }
```

Tipos de regla (conjunto cerrado, [ADR-0018](adr/0018-gamificacion-declarativa.md)):

| `type` | Parámetros | Significado |
|---|---|---|
| `complete_count` | `count`, `level?`, `area?` | Completar `count` escenarios, opcionalmente de un nivel y/o un área. |
| `perfect_scenario` | — | Completar un escenario con todo verde al primer intento. |
| `no_hints` | `minLevel?` | Completar un escenario (de nivel ≥ `minLevel`) sin usar pistas. |
| `streak` | `days` | Jugar `days` días seguidos. |
| `area_mastery` | `area`, `percent` | Tener en verde el `percent` % de los escenarios de un área. |
| `level_complete` | `level` | Completar todos los escenarios `published` de ese nivel existentes al momento de evaluar. Solo se otorga si existe **al menos un** escenario `published` de ese nivel: con cero, la regla no se cumple. |

## 7. Ciclo de vida de un escenario

```
draft ──(PR revisado)──▶ beta ──(métricas OK / revisión)──▶ published ──▶ retired
```

- `draft`: solo visible en el Studio y en entornos de desarrollo (`content:build --include-drafts`).
- `beta`: visible con etiqueta "Beta"; otorga XP normalmente.
- `published`: estable. Cambios de respuestas ⇒ `version++`.
- `retired`: no se lista; su JSON sigue en el bundle y el progreso histórico de los jugadores se conserva.

## 8. Ejemplo completo

Ver [`content/scenarios/serverless-pdf-processing/scenario.yaml`](../content/scenarios/serverless-pdf-processing/scenario.yaml).
