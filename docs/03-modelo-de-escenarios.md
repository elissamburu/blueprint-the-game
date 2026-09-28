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
          objectives: [no-servers, low-cost]      # ≥ 1 para optimal/acceptable
          rationale: "…"                          # markdown corto, sin nombrar OTROS servicios ocultos
          references:
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
| `slot` | 160 × 80 |
| `fixed` | 160 × 80 |
| `actor` | 120 × 80 |
| `external` | 120 × 80 |

El renderer dibuja cada nodo con ese tamaño y el lint L007 lo usa para chequear bordes, pertenencia a grupos y superposiciones. Cambiar un tamaño es un cambio de contrato: puede invalidar escenarios existentes (L007) y se hace en un PR propio.

### Paleta curated

El modo de paleta **resuelto** es `palette.mode` si es explícito, o `game-rules.palette.modeByLevel[level]` si es `auto` o no hay `palette` (`resolvePaletteMode` en `@blueprint/scenario-schema`). Cuando resuelve a `curated`, la paleta se arma siempre igual (`buildCuratedPalette`, la misma función que usan el lint y el motor), en este orden:

1. Todas las respuestas (`optimal` y `acceptable`) de todos los casilleros. **Nunca se recortan.**
2. Los servicios de `incorrect` de los casilleros.
3. `palette.extra`.
4. Los compañeros de grupos de confusión de las respuestas.

Dentro de cada paso se respeta el orden de aparición (nodos en orden del diagrama y, dentro de cada uno, el orden de sus listas; grupos de confusión en el orden del archivo). Se omiten los servicios ya agregados, los servicios de nodos `fixed` como distractores y los que no están en el catálogo (L002 los reporta). Los distractores (pasos 2–4) se recortan al llegar a `maxSize` (`palette.maxSize` o `palette.defaultMaxSize` de game-rules).

### Semántica de la evaluación

Para un casillero y un servicio colocado `s`:

1. Si `s` está en `answers` → el grado es el declarado.
2. Si no, si `s` está en `incorrect` → rojo con la `rationale` específica (siempre existe: es obligatoria).
3. Si no (el servicio no está declarado en `answers` ni en `incorrect`, por ejemplo uno de `palette.extra`) → rojo con **explicación genérica**: `"<descripción corta del catálogo>. No cumple el rol: <role>"`.

Un servicio que viola un objetivo `hard` **debe** declararse en `incorrect` con `violates: [<id>]`; la UI usa ese vínculo para decir qué restricción se violó (RF-EVAL-03).

### Qué NO modela v1 (a propósito)
- Casilleros con **combinación** de servicios (p. ej. "CDN + firewall"). Se modela como dos casilleros.
- Respuestas dependientes entre casilleros ("si pusiste X acá, entonces Y allá es óptimo").
- Configuración de servicios (tamaños, clases de almacenamiento). Si hace falta, va en el `role`.

## 3. Reglas de lint semántico (`packages/content-lint`)

`lintScenario` recibe el escenario, el catálogo, los grupos de confusión y game-rules **ya parseados** por `@blueprint/scenario-schema`, más el nombre de la carpeta del escenario, y devuelve `Issue[]` (`code`, `severity`, `message`, `path`). No hace IO: la lectura de archivos y de git (L012, L014) la hace el CLI.

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
| L014 | error (CI) | Si el escenario existe en `main` con `status` distinto de `draft` (`beta` y `published` otorgan XP; `retired` conserva progreso histórico), todo cambio que altere el resultado de un intento o las condiciones de juego exige incrementar `version`: por casillero (`id`), el conjunto de (`service`, `grade`) de `answers` y el de servicios de `incorrect`; casilleros agregados o quitados; `level`; `palette` (`mode`, `maxSize`, `extra`). No lo exigen los cambios de texto (`rationale`, `references`, `hints`, `context`, objetivos, labels), de orden ni de posiciones del diagrama. Escenarios nuevos o en `draft` en `main`: no aplica. `content-lint` exporta la comparación pura (`checkVersionBump`); el CLI lee `main` con git. |
| L015 | error | `violates` solo se permite en `incorrect` (lo valida el schema) y referencia objetivos existentes (lo valida el lint). Si la rationale de un `acceptable` menciona que viola una restricción `hard`, el servicio debe moverse a `incorrect` (la revisión crítica de IA y el reviewer lo verifican; el lint valida la estructura). |
| L016 | error / warning | Si el modo de paleta **resuelto** es `curated` (sea cual sea el nivel; ver "Paleta curated" en §2): **error** si las respuestas solas superan `maxSize` (la paleta no puede contenerlas); **warning** si la paleta armada tiene < 3 distractores. Se cuentan los distractores que efectivamente entran, después del recorte por `maxSize`. |
| L017 | warning | Enlaces en `references` responden 200 (job de CI semanal, no bloqueante en PR). |
| L018 | error | Ids únicos dentro de cada colección (`objectives`, `diagram.groups`, `diagram.nodes`, `diagram.edges`); `node.group` y `group.parent` apuntan a grupos existentes, sin ciclos de anidamiento. Las demás referencias viven en una sola regla: `answers[].objectives` en L004, `incorrect[].violates` en L015 y `from`/`to` de aristas en L006. |

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
  icon: Arch_Amazon-Simple-Storage-Service_48   # nombre base en el paquete oficial (sin versionar el archivo)
  status: active                          # active | deprecated
  since: 2006
```

`ssmNamespaces` existe porque los parámetros públicos de SSM listan **namespaces de API** (p. ej. `apigateway`, `apigatewayv2`, `apigatewaymanagementapi`), no productos 1:1. El mapeo producto ↔ namespaces es curación humana.

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
  adjacent: [database]            # opcional: categorías adyacentes para el modo categories-plus
```

### `game-rules.yaml`

```yaml
scoring:
  firstTryGreen: 100              # verde al primer intento
  greenAfterErrors:               # verde tras N errores: max(min, firstTryGreen − penaltyPerError·N)
    penaltyPerError: 25
    min: 25
  acceptedAcceptable: 50          # naranja aceptado por el jugador
  hintCost: 15                    # por pista usada (el puntaje del casillero no baja de 0)
levelMultipliers: { 100: 1, 200: 1.5, 300: 2, 400: 3 }   # los cuatro niveles son obligatorios
ranks:                            # ≥ 1, umbral de XP acumulada
  - { id: aprendiz, name: Aprendiz, minXp: 0 }
  - { id: constructor, name: Constructor, minXp: 1000 }
unlock:
  scenariosRequired: 3            # escenarios del nivel N para desbloquear N+1
  byExperience:                   # niveles desbloqueados al inicio según el onboarding (las 4 claves)
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
| `level_complete` | `level` | Completar todos los escenarios `published` de ese nivel existentes al momento de evaluar. |

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
