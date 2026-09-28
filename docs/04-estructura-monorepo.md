# 04 · Estructura del monorepo

Monorepo con **pnpm workspaces + Turborepo** ([ADR-0002](adr/0002-monorepo-pnpm-turborepo.md)), TypeScript de punta a punta ([ADR-0003](adr/0003-typescript-end-to-end.md)).

## 1. Árbol

```
blueprint/
├── .claude/
│   ├── settings.json                  # permisos de Claude Code para el repo
│   └── skills/
│       └── nuevo-escenario/SKILL.md   # generar escenarios con Claude Code (RF-CNT-08)
├── .devcontainer/                     # entorno reproducible (Node, pnpm, Terraform, AWS CLI, gh)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # PR (incluye forks): lint, test, content, build, tf validate — SIN AWS
│   │   ├── deploy.yml                 # push a main: plan → aprobación → apply → deploy de contenido/web
│   │   ├── catalog-sync.yml           # mensual: SSM → diff con el catálogo → abre PR
│   │   ├── link-check.yml             # semanal: enlaces de referencias (L017)
│   │   ├── oidc-debug.yml             # manual: imprime el `sub` OIDC (diagnóstico de la guía de forks)
│   │   └── security.yml               # CodeQL, gitleaks, zizmor (análisis de workflows)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── propuesta-escenario.yml
│   │   └── error-en-escenario.yml     # destino del botón "Reportar un problema" (RF-PLAY-13)
│   ├── PULL_REQUEST_TEMPLATE/
│   │   ├── codigo.md
│   │   └── escenario.md
│   ├── CODEOWNERS                     # infra/ y .github/ requieren revisión de mantenedores
│   └── dependabot.yml                 # npm, github-actions (SHA), terraform
│
├── apps/
│   ├── web/                           # 🎮 el juego — React + Vite, SPA/PWA
│   │   ├── src/
│   │   │   ├── app/                   # router, providers, layout
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── catalog-browse/    # listado, filtros, recomendados
│   │   │   │   ├── play/              # pantalla de juego (usa packages/diagram + game-engine)
│   │   │   │   ├── summary/
│   │   │   │   ├── profile/           # XP, rango, insignias, álbum
│   │   │   │   └── about/
│   │   │   ├── interaction/           # adaptadores drag / tap / teclado → comandos (ADR-0008)
│   │   │   ├── progress/              # repositorio de progreso: LocalStorageRepo | ApiRepo
│   │   │   ├── i18n/                  # strings de UI (es por defecto)
│   │   │   └── main.tsx
│   │   ├── public/
│   │   │   └── icons/                 # ⚙️ generado por icons:fetch (gitignored)
│   │   ├── e2e/                       # Playwright
│   │   └── vite.config.ts
│   │
│   └── studio/                        # 🛠️ Scenario Studio — solo local (ADR-0013)
│       ├── src/                       # UI React (formulario, editor visual, YAML, validación, preview)
│       ├── server/                    # Node (Hono) en 127.0.0.1: lee/escribe content/, IA, gh
│       │   ├── routes/
│       │   │   ├── scenarios.ts       # GET/PUT content/scenarios/*
│       │   │   ├── validate.ts        # schema + lint
│       │   │   ├── ai.ts              # generar / reparar / revisar / regenerar parcial
│       │   │   └── pr.ts              # rama + commit -s + gh pr create
│       │   └── index.ts
│       └── vite.config.ts
│
├── services/
│   └── api/                           # ☁️ backend — Lambdas detrás de API Gateway HTTP API
│       ├── src/
│       │   ├── handlers/              # un archivo por ruta: me.get.ts, attempts.post.ts, ...
│       │   ├── domain/                # casos de uso (usa game-engine)
│       │   ├── adapters/
│       │   │   ├── dynamo/            # repositorios DynamoDB (single-table)
│       │   │   └── content/           # carga del bundle de escenarios publicado
│       │   └── shared/                # logger, errores, middlewares (Powertools)
│       ├── test/
│       └── build.ts                   # esbuild → un zip por handler
│
├── packages/
│   ├── scenario-schema/               # Zod del escenario, catálogo, insignias, game-rules
│   │   ├── src/
│   │   ├── migrations/                # schemaVersion N → N+1
│   │   └── dist/scenario.schema.json  # ⚙️ generado (para autocompletado YAML)
│   ├── content-lint/                  # reglas de docs/03 §3, reporter para CLI/Studio/CI
│   ├── game-engine/                   # 🧠 puro: evaluar, puntaje, XP, rangos, desbloqueos, insignias, paleta por nivel
│   ├── diagram/                       # renderer React Flow compartido (web + studio), auto-layout (elkjs), export Mermaid
│   ├── ai-generator/                  # prompts, tool schema, bucle de reparación, revisión crítica
│   │   └── src/providers/             # bedrock.ts (default), anthropic.ts — interfaz LlmProvider
│   ├── catalog/                       # loader y helpers del catálogo (búsqueda, categorías, grupos de confusión)
│   ├── api-contract/                  # contratos Zod de la API compartidos front/back
│   ├── ui/                            # componentes y tokens de diseño compartidos
│   └── config/                        # tsconfig base, eslint, prettier, vitest
│
├── content/                           # 📚 contenido (licencia CC BY-NC-SA 4.0) — ver docs/03
│   ├── LICENSE
│   ├── areas.yaml
│   ├── game-rules.yaml
│   ├── badges/badges.yaml
│   ├── catalog/{services,categories,confusion-groups}.yaml + ssm-snapshot.json
│   └── scenarios/<id>/{scenario.yaml, notes.md, diagram.mmd, README.md}
│
├── tools/                             # CLIs internos (TypeScript, ejecutados con tsx)
│   ├── content/                       # content:validate | content:gen | content:build
│   ├── catalog-sync/                  # consulta SSM, genera diff y cuerpo del PR
│   └── icons-fetch/                   # descarga el paquete oficial de íconos y mapea a ids
│
├── infra/                             # 🏗️ Terraform (ADR-0014)
│   ├── bootstrap/                     # se aplica UNA vez, a mano: bucket de state, OIDC provider, roles
│   │   ├── main.tf
│   │   ├── oidc.tf
│   │   ├── roles.tf                   # plan (read-only), apply (con permissions boundary), deploy-content
│   │   ├── state.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars.example
│   ├── modules/
│   │   ├── static-site/               # S3 privado + CloudFront (OAC) + headers de seguridad
│   │   ├── auth/                      # Cognito user pool + app client + dominio de login
│   │   ├── api/                       # HTTP API + JWT authorizer + Lambdas + throttling
│   │   ├── data/                      # DynamoDB single-table (on-demand, PITR)
│   │   ├── observability/             # log groups con retención, alarmas, presupuesto
│   │   └── github-deploy-roles/       # usado por bootstrap
│   └── envs/
│       └── prod/
│           ├── main.tf                # compone los módulos
│           ├── backend.tf             # backend "s3" parcial (use_lockfile = true)
│           ├── variables.tf
│           └── versions.tf            # required_version + providers fijados
│
├── docs/                              # este directorio
│   ├── 00..05-*.md
│   ├── adr/
│   └── guias/
│
├── CLAUDE.md                          # instrucciones para Claude Code
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md                        # cómo reportar vulnerabilidades
├── LICENSE                            # PolyForm Noncommercial 1.0.0 (código)
├── TRADEMARKS.md                      # aviso de no afiliación con AWS / uso de íconos
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── .nvmrc
```

## 2. Dependencias entre paquetes

```
                     ┌──────────────────┐
                     │ scenario-schema  │  (Zod, tipos)
                     └────────┬─────────┘
          ┌──────────┬────────┼──────────┬───────────────┐
          ▼          ▼        ▼          ▼               ▼
   content-lint   catalog  game-engine  api-contract   ai-generator
          │          │        │          │               │ (usa content-lint para reparar)
          │          └───┬────┘          │               │
          │              ▼               │               │
          │           diagram            │               │
          │              │               │               │
   ┌──────┴───┬──────────┼───────────────┼───────┐       │
   ▼          ▼          ▼               ▼       ▼       ▼
 tools/    apps/web   apps/studio ◀──────┴── services/api
 content              (usa todo lo anterior + ai-generator)
```

Reglas (enforced con `eslint-plugin-boundaries` o `dependency-cruiser`):
- `packages/*` **no** importan de `apps/*` ni de `services/*`.
- `game-engine`, `scenario-schema`, `content-lint`, `catalog` **no tienen IO** (ni `fs`, ni `fetch`, ni SDKs de AWS) en su `src/`, tests incluidos. Reciben datos y devuelven datos. Sus scripts de build (`scripts/`) pueden usar Node, pero `src/` no puede importarlos.
- `services/api` no importa `diagram` ni `ui`.
- `ai-generator` define la interfaz `LlmProvider`; solo `providers/*` importan SDKs de IA.
- Nada fuera de `apps/studio/server` puede escribir en `content/`.

## 3. Scripts raíz (`package.json`)

| Script | Qué hace |
|---|---|
| `pnpm dev` | Juego en modo invitado + Studio, sin AWS. |
| `pnpm dev:web` / `pnpm studio` | Solo juego / solo Studio. |
| `pnpm build` | Build de todo (Turborepo, con caché). |
| `pnpm test` | Unit tests (Vitest). |
| `pnpm e2e` | Playwright contra `apps/web`. |
| `pnpm lint` / `pnpm typecheck` | ESLint + `tsc --noEmit`. |
| `pnpm content:validate` | Schema + lint de todos los escenarios (o `-- <id>`). |
| `pnpm content:gen [--check]` | Genera `diagram.mmd` y `README.md`. |
| `pnpm content:build` | Bundle JSON en `dist/content`. |
| `pnpm icons:fetch` | Descarga el paquete oficial de íconos. |
| `pnpm catalog:sync [--dry-run]` | Diff del catálogo contra SSM (requiere credenciales AWS de solo lectura). |

## 4. Convenciones

- **Idioma**: código, identificadores, commits y nombres de archivo en **inglés**; documentación, UI y contenido en **español** (v1).
- **Commits**: Conventional Commits + DCO (`git commit -s`) ([ADR-0016](adr/0016-licenciamiento.md)).
- **Ramas**: `main` protegida; PRs con al menos 1 revisión; `infra/` y `.github/` con CODEOWNERS.
- **Versiones**: Node LTS (fijada en `.nvmrc`, alineada con el runtime de Lambda disponible al implementar), pnpm fijado en `packageManager`, Terraform fijado en `versions.tf`.
- **Encabezado SPDX** en cada archivo de código (`PolyForm-Noncommercial-1.0.0`) y de contenido (`CC-BY-NC-SA-4.0`).
