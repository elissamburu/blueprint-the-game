# 0002 · Monorepo con pnpm workspaces + Turborepo

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
El juego, el Studio, la API y las herramientas de contenido comparten schema, motor de juego y renderer de diagramas. Deben evolucionar juntos (un cambio de schema toca todo) y ser fáciles de clonar para contribuir.

## Decisión
Un único repositorio con **pnpm workspaces** para dependencias y **Turborepo** para orquestar tareas con caché. Estructura `apps/`, `services/`, `packages/`, `tools/`, `content/`, `infra/` (ver [04](../04-estructura-monorepo.md)).

## Alternativas consideradas
- **Nx**: más potente (generadores, grafo), pero más conceptos y configuración para contribuidores ocasionales.
- **Multi-repo** (juego / contenido / infra): complica los cambios de schema coordinados y duplica CI.
- **npm/yarn workspaces**: pnpm es más estricto con dependencias fantasma y más eficiente en disco.

## Consecuencias
- Un solo PR puede cambiar schema + motor + UI + escenarios de forma atómica.
- CI con caché de Turborepo; solo se reconstruye lo afectado.
- Hay que hacer cumplir los límites entre paquetes con lint (ver reglas en [04](../04-estructura-monorepo.md)).
