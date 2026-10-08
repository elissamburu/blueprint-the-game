# 0009 · Backend serverless: HTTP API + Lambda + DynamoDB single-table

- Estado: Aceptado; para el MVP de F4, Superseded by [0029](0029-perfil-con-cognito-y-dynamodb-desde-el-navegador.md)
- Fecha: 2026-09-27

## Contexto
El backend solo gestiona perfiles, intentos, progreso, insignias y métricas agregadas. El tráfico será bajo e irregular (picos en meetups). Objetivo: costo cercano a cero en reposo (RNF-05) y fácil de replicar en un fork.

## Decisión
- **API Gateway HTTP API** con authorizer JWT de Cognito y throttling por ruta.
- **Lambda (Node.js, TypeScript, esbuild)**, un handler por ruta, Powertools para logs/métricas/trazas.
- **DynamoDB on-demand**, single-table, con PITR.
- El contenido **no** se lee de la base: la Lambda carga el bundle publicado (JSON en S3, cacheado en memoria por versión) para re-evaluar intentos.

### Rutas (v1)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil, XP, rango, niveles desbloqueados |
| PUT | `/me` | Alias, áreas, experiencia |
| DELETE | `/me` | Borrado de cuenta y datos (RF-AUTH-06) |
| GET | `/me/export` | Exportación de datos (RF-AUTH-07) |
| GET | `/me/progress` | Progreso por escenario |
| GET | `/me/badges` | Insignias obtenidas |
| POST | `/attempts` | Registrar intento: `{scenarioId, version, events[]}` → el servidor re-evalúa y devuelve XP/insignias otorgadas |
| POST | `/me/import-guest` | Importar intentos del modo invitado (se re-evalúan uno por uno) |

Los contratos viven en `packages/api-contract` (Zod) y se comparten con el front.

### Modelo single-table (inicial)
| PK | SK | Atributos |
|---|---|---|
| `USER#<sub>` | `PROFILE` | alias, areas, experience, createdAt |
| `USER#<sub>` | `STATS` | xp, rank, streak, streakFreezeAvailable, lastPlayedOn |
| `USER#<sub>` | `PROGRESS#<scenarioId>` | bestScore, bestGrades, versionPlayed, attempts, completedAt |
| `USER#<sub>` | `BADGE#<badgeId>` | awardedAt, context |
| `ALIAS#<alias>` | `ALIAS` | sub (unicidad del alias con escritura condicional) |
| `SCN#<scenarioId>#v<version>` | `SLOT#<slotId>#SVC#<serviceId>` | count, firstTryCorrect (métricas anónimas, contadores atómicos) |

## Alternativas consideradas
- **AppSync (GraphQL)**: potente, pero agrega un lenguaje y resolvers para una API chica.
- **Aurora Serverless / RDS**: modelo relacional innecesario y costo base mayor.
- **Contenedores (App Runner / ECS)**: costo base y más operación.

## Consecuencias
- Costo proporcional al uso; un fork sin jugadores cuesta prácticamente nada.
- Las consultas analíticas complejas (si aparecen) irán por export a S3 + Athena, no por la tabla principal.
