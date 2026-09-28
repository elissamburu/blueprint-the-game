# 0020 · Modelo de branching: GitHub Flow con squash merge

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto
El repo recibe cambios del mantenedor, de Claude Code y de PRs de forks (sobre todo escenarios). Hace falta un flujo simple de explicar a contribuyentes nuevos, que mantenga un historial legible en `main` y que no dependa de ramas de larga vida para controlar qué llega a producción. El despliegue ya pasa por environments con aprobación manual ([ADR-0014](0014-infra-terraform-oidc.md)) y el CI de PRs corre sin credenciales ([ADR-0015](0015-ci-para-prs-de-forks.md)).

## Decisión
- **GitHub Flow**: `main` está siempre desplegable. Es la única rama de larga vida.
- **Protección de `main` con un ruleset**:
  - PR obligatorio para cualquier cambio.
  - Historial lineal.
  - Status check requerido: `ci` (el job agregador de `ci.yml`, independiente de la matriz de sistemas operativos).
  - Sin force push ni borrado de la rama.
  - Lista de bypass vacía: las reglas aplican también a administradores.
- **Ramas cortas desde `main`**, una por tarea, con prefijo según el tipo de cambio:

  | Prefijo | Uso |
  |---|---|
  | `feat/` | Funcionalidad nueva |
  | `fix/` | Corrección de errores |
  | `content/` | Escenarios y catálogo en `content/` |
  | `docs/` | Documentación y ADRs |
  | `infra/` | Terraform y workflows de despliegue |
  | `chore/` | Mantenimiento, dependencias, tooling, CI |

  Las ramas se borran al mergear (opción *Automatically delete head branches* del repo).
- **Solo squash merge**: cada PR queda como un único commit en `main`. El **título del PR** sigue [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) porque es el mensaje del commit resultante. Los commits intermedios del PR pueden ser libres, pero llevan sign-off DCO ([ADR-0016](0016-licenciamiento.md)).
- **Sin rama `dev`**: el control previo a producción se hace con **environments** de GitHub (aprobación manual de reviewers), no con ramas. Un environment de **staging** queda previsto para la fase F3 del [roadmap](../05-roadmap.md).
- **Releases**: tags semver (`vMAJOR.MINOR.PATCH`) sobre `main` cuando se quiera marcar un hito, con GitHub Releases. No son obligatorios para desplegar.

## Alternativas consideradas
- **GitFlow / rama `dev` permanente**: obliga a un doble PR (feature → `dev` → `main`), las dos ramas divergen y hay que reconciliarlas, y agrega fricción a los PRs de forks (que por defecto apuntan a `main` y habría que redirigir). El control que aporta (un paso previo a producción) ya lo dan los environments con aprobación manual. Descartado.
- **Merge commits o rebase merge**: conservan commits intermedios ("fix typo", "wip") que ensucian el historial y no garantizan que cada commit de `main` pase el CI. Descartado.

## Consecuencias
- Cada commit de `main` corresponde a un PR revisado y con CI verde, y su mensaje es un Conventional Commit: se puede generar un changelog a partir del historial.
- El ruleset se configura a mano en GitHub (no está versionado en el repo); si cambia, se actualiza este ADR o se reemplaza.
- Los contribuyentes, incluido Claude Code, trabajan siempre en ramas desde `main` actualizado y nunca commitean directo en `main` ([CLAUDE.md](../../CLAUDE.md), [CONTRIBUTING.md](../../CONTRIBUTING.md)).
- Staging se agrega como environment en F3 sin cambiar el modelo de ramas.
