# Architecture Decision Records

Formato: [MADR](https://adr.github.io/madr/) simplificado (Contexto · Decisión · Alternativas · Consecuencias). Un ADR aceptado no se edita: se reemplaza con uno nuevo que lo marca `Superseded by`.

| # | Título | Estado |
|---|---|---|
| [0001](0001-registrar-decisiones-con-adr.md) | Registrar decisiones con ADRs | Aceptado |
| [0002](0002-monorepo-pnpm-turborepo.md) | Monorepo con pnpm workspaces + Turborepo | Aceptado |
| [0003](0003-typescript-end-to-end.md) | TypeScript de punta a punta | Aceptado |
| [0004](0004-frontend-react-vite.md) | Frontend React + Vite (SPA/PWA) | Aceptado |
| [0005](0005-modelo-de-diagrama.md) | Modelo de diagrama propio; React Flow para render; Mermaid derivado | Aceptado |
| [0006](0006-contenido-como-codigo.md) | Escenarios como contenido versionado en el repo | Aceptado |
| [0007](0007-evaluacion-por-objetivos.md) | Evaluación basada en objetivos explícitos (hard/soft) | Aceptado |
| [0008](0008-interaccion-desacoplada.md) | Interacción desacoplada: comandos comunes para drag, tap y teclado | Aceptado |
| [0009](0009-backend-serverless.md) | Backend serverless: HTTP API + Lambda + DynamoDB single-table | Aceptado |
| [0010](0010-autenticacion-cognito-e-invitado.md) | Autenticación con Cognito + modo invitado | Aceptado |
| [0011](0011-catalogo-de-servicios.md) | Catálogo curado + sincronización asistida con SSM | Aceptado |
| [0012](0012-iconos.md) | Íconos oficiales descargados en build, no versionados | Aceptado (provisorio) |
| [0013](0013-scenario-studio-local-con-ia.md) | Scenario Studio local-first con IA enchufable | Aceptado |
| [0014](0014-infra-terraform-oidc.md) | Terraform con bootstrap separado y OIDC de GitHub | Aceptado |
| [0015](0015-ci-para-prs-de-forks.md) | CI de PRs de forks sin credenciales | Aceptado |
| [0016](0016-licenciamiento.md) | Licencias no comerciales para código y contenido + DCO | Aceptado |
| [0017](0017-i18n.md) | i18n de UI desde el día 1; contenido en español en v1 | Aceptado |
| [0018](0018-gamificacion-declarativa.md) | Gamificación con reglas declarativas | Aceptado |
| [0019](0019-nombre-y-marcas.md) | Nombre del proyecto y uso de marcas de AWS | Pendiente |
| [0020](0020-modelo-de-branching.md) | Modelo de branching: GitHub Flow con squash merge | Aceptado |

## Plantilla

```markdown
# NNNN · Título

- Estado: Propuesto | Aceptado | Rechazado | Superseded by NNNN
- Fecha: AAAA-MM-DD

## Contexto
## Decisión
## Alternativas consideradas
## Consecuencias
```
