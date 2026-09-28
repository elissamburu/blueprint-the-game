# CLAUDE.md

Instrucciones para Claude Code en este repositorio. Leé esto completo antes de cualquier tarea.

## Qué es este proyecto
Juego web para aprender a diseñar arquitecturas en AWS completando diagramas con servicios ocultos. Feedback verde (óptimo) / naranja (aceptable) / rojo (incorrecto), siempre justificado contra los **objetivos** del escenario. Los escenarios son archivos YAML versionados en `content/`; contribuir = PR.

## Antes de implementar
1. Leé [docs/00-vision-y-alcance.md](docs/00-vision-y-alcance.md) y el glosario.
2. Identificá los **RF** que cubre la tarea en [docs/01-requerimientos-funcionales.md](docs/01-requerimientos-funcionales.md) y sus criterios de aceptación.
3. Leé los **ADR** relevantes en [docs/adr/](docs/adr/README.md). No contradigas un ADR aceptado: si hace falta, proponé un ADR nuevo que lo reemplace (`Superseded by`) y frená para consultarlo.
4. Si la tarea toca contenido, leé [docs/03-modelo-de-escenarios.md](docs/03-modelo-de-escenarios.md).
5. Respetá el orden del [roadmap](docs/05-roadmap.md): no implementes funcionalidad de fases futuras "de paso".

## Comandos
```bash
pnpm i
pnpm dev                 # juego (invitado) + studio, sin AWS
pnpm test && pnpm typecheck && pnpm lint
pnpm content:validate    # siempre después de tocar content/ o el schema
pnpm content:gen         # regenerar diagram.mmd y README.md de escenarios
pnpm e2e                 # Playwright
```

## Reglas de arquitectura (no negociables)
- TypeScript `strict`, sin `any` explícito. Zod en todas las fronteras (archivos, API, respuestas de IA).
- `packages/game-engine`, `scenario-schema`, `content-lint` y `catalog` son **puros**: sin `fs`, `fetch` ni SDKs.
- La lógica de evaluación y puntaje vive **solo** en `game-engine`; web, api y studio la importan. No dupliques reglas.
- La UI no decide grados: consulta el motor.
- Drag, tap y teclado emiten los mismos comandos (`selectSlot`, `placeService`, `acceptAcceptable`, `useHint`) — [ADR-0008](docs/adr/0008-interaccion-desacoplada.md).
- Solo `apps/studio/server` escribe en `content/`.
- Nuevas dependencias: justificá en el PR por qué no alcanza con lo existente.

## Reglas de contenido
- **Nunca** nombres un servicio oculto en `title`, `summary`, `context`, `objectives`, `role`, `hints` ni en etiquetas (lint L005).
- Todo `optimal`/`acceptable` referencia ≥ 1 objetivo. Si un servicio viola una restricción `hard`, va en `incorrect` con `violates`.
- No inventes comportamientos de servicios de AWS: cada `optimal` lleva referencia a documentación oficial. Si no estás seguro de un dato, dejalo marcado como `TODO(verificar)` y avisá.
- Cambiar respuestas o grados de un escenario `published` ⇒ incrementar `version`.
- No edites archivos generados (`diagram.mmd`, `README.md` de escenarios, `dist/`).

## Reglas de seguridad
- Nunca agregues credenciales, account IDs reales ni ARNs concretos al repo; usá variables.
- Workflows: acciones fijadas por SHA, `permissions` mínimos por job, **nunca** `pull_request_target` con checkout del código del PR, `id-token: write` solo en jobs de deploy con `environment`.
- Terraform: no ejecutes `apply` fuera de `infra/bootstrap` (y ese solo lo corre un humano). Podés correr `fmt`, `validate` y `plan` con `-backend=false` o contra cuentas de prueba si se te indica.

## Estilo
- Código, identificadores y commits en inglés; docs, UI y contenido en español.
- Conventional Commits con sign-off (`git commit -s`).
- Tests junto al código (`*.test.ts`). Cobertura ≥ 90 % en `game-engine` y `content-lint`.
- Descripción de PR: qué RF implementa, qué ADR aplica, cómo se probó.

## Cuándo frenar y preguntar
- Un requisito es ambiguo o contradice un ADR.
- La tarea requiere tocar `infra/bootstrap`, permisos IAM o workflows de deploy.
- Hay que elegir una dependencia nueva de peso (> 50 KB gzip en el cliente o un servicio externo).
