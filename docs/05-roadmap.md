# 05 · Roadmap

Fases pensadas para implementarse con Claude Code **en orden**. Cada fase termina con algo usable y una Definición de Terminado (DoD) verificable. Los IDs de RF de cada fase están en [01](01-requerimientos-funcionales.md) (columna *Fase*).

> Criterio de orden: el **contenido** es el cuello de botella del proyecto, así que el formato, la validación y el Studio llegan antes que las cuentas y la infraestructura.

---

## F0 · Fundaciones de contenido
**Objetivo**: el formato de escenario existe, se valida y se genera.

- Monorepo (pnpm, Turborepo, TS strict, ESLint, Vitest), `CLAUDE.md`, `CONTRIBUTING.md`, licencias.
- `packages/scenario-schema` (Zod + JSON Schema generado).
- `packages/content-lint` (L001–L016).
- `tools/content` (`validate`, `gen`, `build`).
- Catálogo inicial curado (~60 servicios de las categorías más usadas), categorías y grupos de confusión.
- 3 escenarios reales: uno de 100, `serverless-pdf-processing` (200) y uno de 300.
- `ci.yml` (sin AWS).

**DoD**: `pnpm content:validate` pasa en los 3 escenarios; un escenario con una filtración a propósito falla con L005; el CI corre en un PR desde un fork.

## F1 · Juego jugable (modo invitado, desktop)
**Objetivo**: se puede jugar de punta a punta sin backend.

- `packages/diagram` (React Flow + render de grupos, actores, casilleros, aristas y reproductor de flujo).
- `packages/game-engine` (evaluación, puntaje, XP, rangos, desbloqueos, armado de paleta por nivel).
- `apps/web`: onboarding, listado, juego (drag + teclado), resumen, perfil local, acerca de.
- `pnpm icons:fetch`.

**DoD**: un invitado completa los 3 escenarios, ve colores + explicaciones, sube de rango y desbloquea el nivel siguiente; e2e en Playwright; axe sin violaciones críticas.

## F2 · Scenario Studio v1 (sin IA)
**Objetivo**: crear y editar escenarios cómodamente, con preview jugable.

- `apps/studio` (UI + server local): formulario, editor visual, auto-layout, YAML sincronizado, validación en vivo, preview jugable, vista de respuestas, guardar/descargar.

**DoD**: se crea un escenario nuevo sin tocar YAML a mano, se juega en preview, se guarda y pasa `content:validate`.

## F3 · Infraestructura y despliegue
**Objetivo**: el juego (modo invitado) publicado en AWS con CI/CD por OIDC.

- `infra/bootstrap`, `infra/modules/static-site`, `observability` (presupuesto), `envs/prod`.
- `deploy.yml` (plan → aprobación con environment → apply → subida de web + bundle de contenido → invalidación).
- Guía [configurar AWS en tu fork](guias/configurar-aws-en-tu-fork.md) probada end-to-end en una cuenta limpia.
- Comentario de CI con el resumen del escenario (RF-CNT-06) y control de `version` (RF-CNT-07).

**DoD**: un fork nuevo, siguiendo solo la guía, queda desplegado; un workflow desde una rama distinta de `main` no puede asumir el rol de `apply`.

## F4 · Cuentas, progreso y gamificación
**Objetivo**: registro, progreso en la nube, insignias.

- `infra/modules/{auth,api,data}`, `services/api`, `packages/api-contract`.
- Registro/login, importación del progreso de invitado, re-evaluación en el servidor, XP/rangos/insignias/rachas/maestría/álbum, borrar y exportar datos.

**DoD**: un invitado se registra, importa su progreso y el servidor recalcula el mismo XP; al borrar la cuenta no quedan datos personales.

## F5 · IA en el Studio
**Objetivo**: generar escenarios con IA en minutos.

- `packages/ai-generator` (Bedrock + Anthropic), generar, bucle de reparación, revisión crítica, regeneración parcial, creación de PR con `gh`.
- Skill de Claude Code `nuevo-escenario`.

**DoD**: desde un caso de uso en una línea se obtiene en < 60 s un borrador que pasa la validación; la revisión crítica detecta un grado mal calibrado inyectado a propósito.

## F6 · Mobile y accesibilidad
- Interacción por toque con bottom sheet, layout responsive del juego, PWA (instalable, offline para escenarios ya descargados), auditoría WCAG 2.1 AA.

**DoD**: el escenario de 200 se completa en un teléfono de 390 px sin drag; auditoría sin hallazgos AA abiertos.

## F7 · Comunidad y calibración
- `catalog-sync.yml`, métricas de calibración, vista de escenarios mal calibrados, escenario destacado, modo examen, imagen compartible de insignias.

---

## Fuera de v1 (backlog)
Leaderboards por comunidad (opt-in) · contenido en inglés · casilleros con combinaciones de servicios · Studio hosteado con autenticación y presupuesto · modo taller para meetups (un facilitador proyecta y los equipos responden).
