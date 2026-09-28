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
  canvas: { width: 1400, height: 800 }   # coordenadas lógicas; el renderer escala
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
      incorrect:                 # confusiones típicas con explicación específica (también son distractores)
        - service: ebs
          violates: []           # opcional: ids de objetivos (hard o soft) que viola; solo permitido en incorrect
          rationale: "…"
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
  maxSize: 12                    # solo curated
  extra: [efs]                   # distractores extra sin explicación específica
references:                      # opcional: lecturas generales del escenario
  - title: "…"
    url: https://...
```

### Semántica de la evaluación

Para un casillero y un servicio colocado `s`:

1. Si `s` está en `answers` → el grado es el declarado.
2. Si no, si `s` está en `incorrect` → rojo con la `rationale` específica.
3. Si no → rojo con **explicación genérica**: `"<descripción corta del catálogo>. No cumple el rol: <role>"`.

Un servicio que viola un objetivo `hard` **debe** declararse en `incorrect` con `violates: [<id>]`; la UI usa ese vínculo para decir qué restricción se violó (RF-EVAL-03).

### Qué NO modela v1 (a propósito)
- Casilleros con **combinación** de servicios (p. ej. "CDN + firewall"). Se modela como dos casilleros.
- Respuestas dependientes entre casilleros ("si pusiste X acá, entonces Y allá es óptimo").
- Configuración de servicios (tamaños, clases de almacenamiento). Si hace falta, va en el `role`.

## 3. Reglas de lint semántico (`packages/content-lint`)

| Código | Severidad | Regla |
|---|---|---|
| L001 | error | `id` coincide con el nombre de la carpeta. |
| L002 | error | Todo `service` existe en `content/catalog/services.yaml`. |
| L003 | error | Cada `slot` tiene ≥ 1 respuesta `optimal`. |
| L004 | error | Cada `optimal`/`acceptable` tiene `rationale` no vacía y referencia ≥ 1 `objectives[].id` existente. |
| **L005** | **error** | **Sin filtraciones**: ningún `leakPattern` de un servicio **oculto** aparece en `title`, `summary`, `context`, `objectives[].text`, `role`, `hints`, etiquetas de grupos o `label`/`description` de aristas. Case-insensitive, por límites de palabra. Los servicios de nodos `fixed` están permitidos. |
| L006 | error | Aristas referencian nodos existentes; `step` ≥ 1 y sin huecos (1..n). |
| L007 | error | Nodos dentro del `canvas`; un nodo con `group` está dentro del `rect` de su grupo; los casilleros no se superponen. |
| L008 | error | Un servicio no aparece dos veces en el mismo casillero (entre `answers` e `incorrect`). |
| L009 | warning | Cantidad de casilleros recomendada por nivel — 100: 2–4 · 200: 4–7 · 300: 6–10 · 400: 8–14. |
| L010 | error / warning | Servicio `deprecated`: error si es `optimal`; warning en otros usos. |
| L011 | warning | Cada `optimal` tiene ≥ 1 `reference` a documentación oficial (dominios permitidos: `docs.aws.amazon.com`, `aws.amazon.com`). |
| L012 | error | `diagram.mmd` y `README.md` sincronizados (`content:gen --check`). |
| L013 | error | Límites de longitud (title 80, summary 200, role 140, label 40, rationale 600). |
| L014 | error (CI) | Si cambiaron `answers`/`incorrect`/grados respecto de `main` en un escenario `published`, `version` debe incrementarse. |
| L015 | error | `violates` solo se permite en `incorrect` y referencia objetivos existentes. Si la rationale de un `acceptable` menciona que viola una restricción `hard`, el servicio debe moverse a `incorrect` (la revisión crítica de IA y el reviewer lo verifican; el lint valida la estructura). |
| L016 | warning | Nivel 100 con paleta `curated` debe tener ≥ 3 distractores (`incorrect` + grupos de confusión + `extra`). |
| L017 | warning | Enlaces en `references` responden 200 (job de CI semanal, no bloqueante en PR). |

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

## 6. Ciclo de vida de un escenario

```
draft ──(PR revisado)──▶ beta ──(métricas OK / revisión)──▶ published ──▶ retired
```

- `draft`: solo visible en el Studio y en entornos de desarrollo.
- `beta`: visible con etiqueta "Beta"; otorga XP normalmente.
- `published`: estable. Cambios de respuestas ⇒ `version++`.
- `retired`: no se lista; el progreso histórico de los jugadores se conserva.

## 7. Ejemplo completo

Ver [`content/scenarios/serverless-pdf-processing/scenario.yaml`](../content/scenarios/serverless-pdf-processing/scenario.yaml).
