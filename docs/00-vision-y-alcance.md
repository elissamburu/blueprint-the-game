# 00 · Visión y alcance

> Nombre de trabajo del proyecto: **Blueprint** (provisorio; ver [ADR-0019](adr/0019-nombre-y-marcas.md)).
> Estado de este documento: **borrador v0.1** · Dueño: Rodrigo Elissamburu

## 1. Visión

Un juego web donde el jugador aprende a **pensar arquitecturas en AWS** completando diagramas reales. El diagrama muestra el flujo de datos y el rol de cada componente, pero los servicios están ocultos (casilleros en blanco). El jugador arrastra (o elige) servicios de una paleta y recibe feedback inmediato y **explicado**:

| Color | Significado |
|---|---|
| 🟩 Verde (`optimal`) | Es el servicio correcto **y el más adecuado** para los objetivos del escenario. |
| 🟧 Naranja (`acceptable`) | Funciona, pero **no es el óptimo** dados los objetivos (costo, tráfico, operación, etc.). Se explica por qué. |
| 🟥 Rojo (`incorrect`) | No cumple el rol o **viola una restricción dura** del escenario. Se explica por qué. |

La clave pedagógica: **"óptimo" siempre se justifica contra objetivos explícitos del escenario** (costo, patrón de tráfico, nivel de gestión, latencia, seguridad, etc.). Nunca es una opinión suelta.

## 2. Objetivos del producto

1. Que el jugador **entienda por qué** se elige un servicio y no solo cuál.
2. Que la comunidad pueda **agregar escenarios fácilmente** (el contenido es el cuello de botella; sin contenido nuevo el juego muere).
3. Que cualquiera pueda **forkear y desplegar** su propia instancia de forma segura (OIDC, sin credenciales de larga vida).
4. Que la progresión (niveles, XP, insignias) **motive a seguir** sin patrones oscuros.

## 3. Público

- Personas que empiezan con AWS (nivel 100–200).
- Profesionales que preparan certificaciones o quieren práctica de diseño (300–400).
- Comunidades / user groups que usan el juego en meetups y talleres.

## 4. Alcance

### Dentro del alcance (v1)
- Juego web desktop-first con arquitectura de interacción preparada para mobile ([ADR-0008](adr/0008-interaccion-desacoplada.md)).
- Registro/login, modo invitado, áreas de interés, progreso, XP, rangos e insignias.
- Escenarios niveles 100/200/300/400 como archivos versionados en el repo.
- **Scenario Studio**: UI local para crear escenarios con asistencia de IA, previsualizarlos jugando y exportarlos para PR.
- Catálogo de servicios curado con sincronización periódica asistida.
- Infra con Terraform, CI/CD con GitHub Actions + OIDC, guía para forks.

### Fuera del alcance (v1)
- Certificaciones/acreditaciones con valor externo (las insignias son internas).
- Anti-trampa: las respuestas son públicas por diseño; el objetivo es no hacerse trampa a uno mismo.
- Multijugador en tiempo real, leaderboards globales (candidato a v2, opt-in).
- Contenido multilenguaje (v1 = español; la UI sí nace con i18n; ver [ADR-0017](adr/0017-i18n.md) y, para el formato futuro, [ADR-0023](adr/0023-contenido-multiidioma.md)).
- Casilleros que aceptan combinaciones de varios servicios (v1 = un servicio por casillero).
- Studio hosteado públicamente (v1 = local; ver [ADR-0013](adr/0013-scenario-studio-local-con-ia.md)).

## 5. Glosario

| Término | Definición |
|---|---|
| **Escenario** | Caso de uso con contexto, objetivos, diagrama y respuestas. Unidad de contenido. Vive en `content/scenarios/<id>/scenario.yaml`. |
| **Nivel del escenario** | Dificultad del contenido: 0, 100, 200, 300, 400. El nivel 0 («La nube en la vida real», en la UI «Ideas básicas de la nube») usa situaciones cotidianas para las ideas de base de la nube ([ADR-0027](adr/0027-nivel-0-y-conceptos-en-el-catalogo.md)). |
| **Rango del jugador** | Progresión del jugador basada en XP (distinto del nivel del escenario). |
| **Objetivo** | Requisito explícito del escenario. Puede ser `hard` (restricción: violarla = rojo) o `soft` (meta: no cumplirla bien = naranja). |
| **Casillero (slot)** | Nodo del diagrama con el servicio oculto que el jugador debe completar. |
| **Rol** | Descripción de lo que hace un casillero **sin nombrar el servicio**. |
| **Grado** | Resultado de colocar un servicio en un casillero: `optimal`, `acceptable`, `incorrect`. |
| **Paleta** | Lista de servicios disponibles para arrastrar; su amplitud depende del nivel. |
| **Catálogo** | Lista curada de servicios y conceptos de AWS con categoría, alias y metadatos (`content/catalog/`). |
| **Concepto** | Entrada del catálogo con `type: concept` que no es un servicio sino una idea de la nube (responsabilidad compartida, región, pago por uso, elasticidad…). Se usa en la paleta y en las respuestas como un servicio. |
| **Nombre simple (`plainName`)** | Nombre en lenguaje cotidiano de una entrada del catálogo (p. ej. «Almacenamiento de archivos»). En el nivel 0 la tarjeta lo muestra primero y el nombre real en chico. |
| **Dónde se rompe la analogía (`analogyLimit`)** | En una respuesta, el punto en que la analogía cotidiana deja de valer para AWS, con referencia oficial. Obligatorio en el nivel 0. |
| **Grupo de confusión** | Conjunto de servicios que se suelen confundir entre sí (p. ej. SQS / SNS / EventBridge). Fuente de distractores. |
| **Asistente de arquitectura** | Chat con IA (propuesto, F8) en el que un usuario registrado describe su caso de uso, responde preguntas sobre sus restricciones y recibe un diagrama recomendado con el porqué de cada servicio contra objetivos explícitos; se puede exportar como borrador de escenario ([ADR-0026](adr/0026-asistente-de-arquitectura-con-ia.md)). |
| **Studio** | Herramienta local para crear/editar escenarios con IA y preview jugable. |
| **Filtración (leak)** | Texto del escenario que revela el nombre de un servicio que el jugador debe adivinar. Es un error de validación. |

## 6. Principios de diseño

1. **Contenido como código.** Los escenarios son archivos; contribuir = PR. La base de datos solo guarda usuarios y progreso.
2. **Una sola fuente de verdad** por concepto (escenario YAML → todo lo demás se genera).
3. **Motor de juego puro.** La lógica de evaluación, puntaje e insignias es TypeScript sin IO, testeable y compartida entre front, back y Studio.
4. **Seguro por defecto.** Sin secretos en el repo, OIDC, mínimo privilegio, PRs de forks sin credenciales.
5. **Barato en reposo.** Sin recursos con costo fijo por hora en la arquitectura base (todo serverless / pago por uso).
6. **Contribuir en menos de 10 minutos.** `pnpm i && pnpm dev` levanta juego + Studio sin cuenta de AWS.
7. **Aprender con desafíos, no competir ni rendir examen.** El objetivo es que el jugador entienda; el puntaje y la progresión acompañan, no juzgan. Por eso existen las pistas y la opción de **mostrar la solución** (RF-PLAY-14): trabarse no puede ser un callejón sin salida, y ver una respuesta nunca quita progreso. Las rutas de certificación y el modo examen son práctica, no una evaluación con valor externo.
8. **La accesibilidad es un requisito de producto, no una fase.** Todo el sitio apunta a WCAG 2.2 AA desde la primera pantalla ([accesibilidad](accesibilidad.md)); un RF no está terminado si no se puede usar con teclado, lector de pantalla, lupa o zoom. F6 hace la auditoría completa y agrega el modo texto ([ADR-0022](adr/0022-modo-texto.md)), pero no es donde "empieza" la accesibilidad.

## 7. Documentos relacionados

- [01 · Requerimientos funcionales](01-requerimientos-funcionales.md)
- [02 · Requerimientos no funcionales](02-requerimientos-no-funcionales.md)
- [03 · Modelo de escenarios](03-modelo-de-escenarios.md)
- [04 · Estructura del monorepo](04-estructura-monorepo.md)
- [05 · Roadmap](05-roadmap.md)
- [Accesibilidad](accesibilidad.md)
- [ADRs](adr/README.md)
- [Guía: configurar AWS en tu fork](guias/configurar-aws-en-tu-fork.md)
