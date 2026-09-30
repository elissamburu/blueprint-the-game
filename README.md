# Blueprint · documentos de requerimientos

> Nombre de trabajo. Juego web para aprender a diseñar arquitecturas en AWS completando diagramas.
> **Código disponible, no comercial** (ver [ADR-0016](docs/adr/0016-licenciamiento.md)). No afiliado a Amazon Web Services (ver [TRADEMARKS.md](TRADEMARKS.md)).

Este paquete es el punto de partida del repositorio: se copia en la raíz del repo nuevo y Claude Code lo usa como especificación.

## Contenido

| Archivo | Qué es |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas para Claude Code (leer primero) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Cómo preparar el entorno, flujo de ramas, DCO y checks de CI |
| [TRADEMARKS.md](TRADEMARKS.md) | Aviso de no afiliación con AWS y uso de los íconos de arquitectura |
| [docs/00-vision-y-alcance.md](docs/00-vision-y-alcance.md) | Visión, alcance, glosario, principios |
| [docs/01-requerimientos-funcionales.md](docs/01-requerimientos-funcionales.md) | RF por módulo, prioridad, fase y criterios de aceptación |
| [docs/02-requerimientos-no-funcionales.md](docs/02-requerimientos-no-funcionales.md) | RNF verificables |
| [docs/03-modelo-de-escenarios.md](docs/03-modelo-de-escenarios.md) | Formato de escenario, carpetas de contenido, reglas de lint |
| [docs/04-estructura-monorepo.md](docs/04-estructura-monorepo.md) | Árbol del monorepo, dependencias entre paquetes, scripts |
| [docs/05-roadmap.md](docs/05-roadmap.md) | Fases F0–F7 con definición de terminado |
| [docs/adr/](docs/adr/README.md) | 21 ADRs |
| [docs/design/](docs/design/README.md) | Referencia visual: pantallas, tokens y estilos de referencia (ADR-0021) |
| [docs/guias/configurar-aws-en-tu-fork.md](docs/guias/configurar-aws-en-tu-fork.md) | Guía de OIDC + Terraform para forks |
| [docs/guias/deploy-manual-beta.md](docs/guias/deploy-manual-beta.md) | Deploy manual de la beta pública (temporal, lo reemplaza F3) |
| [content/scenarios/serverless-pdf-processing/](content/scenarios/serverless-pdf-processing/scenario.yaml) | Escenario de ejemplo completo (nivel 200) |
| [content/scenarios/_templates/](content/scenarios/_templates/scenario.template.yaml) | Plantilla comentada |
| [.claude/skills/nuevo-escenario/](.claude/skills/nuevo-escenario/SKILL.md) | Skill de Claude Code para generar escenarios |

## Cómo arrancar con Claude Code

1. Creá el repo, copiá estos archivos y hacé el primer commit.
2. Resolvé lo que está **Pendiente**: [ADR-0019](docs/adr/0019-nombre-y-marcas.md) (nombre).
3. Pedile a Claude Code: *"Implementá la fase F0 del roadmap"*. Una fase por vez, un PR por módulo.
