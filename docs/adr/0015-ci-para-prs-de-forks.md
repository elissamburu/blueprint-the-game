# 0015 · CI de PRs de forks sin credenciales

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
La mayoría de las contribuciones (sobre todo escenarios) llegan como PRs desde forks. Ejecutar código de un fork con acceso a credenciales es la vía clásica de exfiltración en GitHub Actions.

## Decisión
- `ci.yml` se dispara con `pull_request` (no `pull_request_target`), `permissions: contents: read` y **sin** `id-token: write`. Corre: lint, typecheck, tests, `content:validate`, `content:gen --check`, build, `terraform fmt -check`, `terraform validate` (`-backend=false`), tflint, checkov, gitleaks, actionlint + zizmor.
- El comentario con el resumen del escenario (RF-CNT-06) se publica desde un workflow separado disparado por `workflow_run`, que **solo lee artefactos** del CI (JSON/Markdown generados) y nunca ejecuta código del PR.
- `terraform plan` y el deploy corren **solo** en `main` (y `workflow_dispatch` de mantenedores) en jobs con `environment`.
- Acciones fijadas por SHA; Dependabot las actualiza.

## Alternativas consideradas
- **`pull_request_target` con checkout del PR**: da acceso a secrets y tokens con código no confiable; descartado.
- **Plan en cada PR**: requeriría confiar en el `sub` genérico `repo:…:pull_request`, que no distingue de qué rama ni de qué autor viene el PR; descartado en v1.

## Consecuencias
- Los PRs de forks reciben feedback completo de validación sin ningún acceso a AWS.
- Los cambios de infraestructura se ven en el `plan` del deploy, antes de la aprobación manual del environment `prod`.
