# 05 · Roadmap

Fases pensadas para implementarse con Claude Code **en orden**. Cada fase termina con algo usable y una Definición de Terminado (DoD) verificable. Los IDs de RF de cada fase están en [01](01-requerimientos-funcionales.md) (columna *Fase*).

> Criterio de orden: el **contenido** es el cuello de botella del proyecto, así que el formato, la validación y el Studio llegan antes que las cuentas y la infraestructura.

---

## F0 · Fundaciones de contenido
**Objetivo**: el formato de escenario existe, se valida y se genera.

- Monorepo (pnpm, Turborepo, TS strict, ESLint, Vitest), `CLAUDE.md`, `CONTRIBUTING.md`, licencias.
- `packages/scenario-schema` (Zod + JSON Schema generado).
- `packages/content-lint` (L001–L016 y L018).
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

## F1.1 · Pulido del MVP
**Estado**: ✅ terminada el 2026-10-04 (#36, #50 y #51).

**Objetivo**: que el juego sea más amable para aprender y se pueda usar fuera de la pantalla (talleres, estudio en papel).

- **Mostrar solución** por casillero y completa, con aviso previo que invita a usar pistas; 0 puntos por casillero revelado y sin restar progreso (RF-PLAY-14).
- **"Reproducir flujo" visible** como botón en la barra del juego (RF-PLAY-15).
- **Versión imprimible** del escenario con estilos de impresión y "Guardar como PDF" (RF-PLAY-16).
- **Animaciones**: microinteracciones al colocar, al mostrar el resultado y al subir de rango, con alternativa bajo `prefers-reduced-motion` (RF-PLAY-17).

**DoD**: un invitado se traba en un casillero, ve la solución tras el aviso, completa el escenario, que figura como completado (no en verde) sin perder su mejor resultado anterior; el escenario de 200 se imprime a PDF con cada sección en página nueva; con `prefers-reduced-motion` activado no hay animaciones con movimiento; pruebas manuales de [accesibilidad](accesibilidad.md#7-protocolo-de-pruebas) sobre lo nuevo.

## F2 · Scenario Studio v1 (sin IA)
**Estado**: 🟡 implementada (PR 0–6: #52–#60). El e2e del Studio cubre la parte automática del DoD: crear un escenario sin tocar el YAML, jugarlo en preview, guardarlo y que pase `content:validate`, con axe en cada pantalla. **Falta para cerrarla**: las pruebas manuales del [protocolo de accesibilidad](accesibilidad.md#7-protocolo-de-pruebas) sobre el Studio (listado, diálogo «Nuevo escenario», formulario, diagrama, YAML, preview, respuestas y «Descargar .zip»), con sus hallazgos resueltos o anotados.

**Objetivo**: crear y editar escenarios cómodamente, con preview jugable.

- `apps/studio` (UI + server local): formulario, editor visual, auto-layout, YAML sincronizado, validación en vivo, preview jugable, vista de respuestas, guardar/descargar.
- Decisiones: [ADR-0025](adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md) (preview con `packages/play`, modelo de edición y reglas de seguridad S1–S12 del servidor local).

Se implementa en 7 PRs, en este orden. Cada uno deja algo usable:

| PR | Alcance | RF | Dependencias nuevas |
|---|---|---|---|
| 0 · `docs` | ADR-0025, [04](04-estructura-monorepo.md) (`packages/play`, generador en `content-lint`, aclaración de `content:gen`) y este plan. | — | — |
| 1 · `refactor(play)` | Extraer la pantalla de juego y los adaptadores de interacción a `packages/play` con el puerto `GameHost`. Sin cambios de comportamiento: el e2e del juego no cambia. Los archivos se mueven con `git mv` en un commit de solo movimientos, separado de los commits que cambian código. | (habilita RF-STU-08) | — |
| 2 · `feat(studio)` base | Servidor endurecido (S1–S12, cada regla con su test), listar y abrir escenarios, editor YAML, validación en vivo (schema + lint) con salto a la línea, guardar con regeneración de `diagram.mmd` y `README.md` (el generador pasa a `content-lint`). Chequeo automático de que el bundle de `apps/web` no incluye `@codemirror/*` ni `elkjs`. Modo dev con Vite: definir y documentar qué reglas de S1–S12 aplican (CSP con scripts inline de HMR, `server.allowedHosts` de Vite). | RF-STU-02, 06 (solo YAML), 07, 14 (guardar), 18 | `hono`, `@hono/node-server`, `@codemirror/*` |
| 3 · `feat(studio)` preview + respuestas | Botón "Jugar" con `packages/play` (sin guardar progreso) y vista "respuestas" con todos los casilleros revelados. | RF-STU-08, 09 | — |
| 4 · `feat(studio)` formulario | Editor por formulario sincronizado con el YAML (comandos sobre el documento, conserva comentarios), con clic del panel de validación al campo. Componentes nuevos de `packages/ui` (input, textarea, label, tabs, checkbox). Se entrega en dos PR usables por separado: 4a (metadatos, contexto, objetivos y casilleros, con el modelo de edición y la pila única de deshacer) y 4b (grupos, nodos y aristas). | RF-STU-03, 06, 07 | — |
| 5 · `feat(studio)` diagrama | Editor visual en `packages/diagram` (mover, crear y borrar nodos y grupos, aristas, pasos), con alternativa por teclado y formulario, y "Ordenar" con elkjs (subpath `@blueprint/diagram/layout`, carga diferida). El wireframe ASCII va en la descripción del PR; si no convence, se pasa por la herramienta de diseño antes de implementar. | RF-STU-04, 05 | `elkjs` |
| 6 · `feat(studio)` crear + .zip | Crear vacío, desde `_templates` o duplicando; descargar `.zip` con el escenario y sus archivos generados. | RF-STU-01 (parte F2), 14 (descargar) | `fflate` |

L014 (control de `version` contra `main`) no corre en el Studio: queda en `pnpm content:validate --base origin/main` y en el CI de F3.

**DoD**: se crea un escenario nuevo sin tocar YAML a mano, se juega en preview, se guarda y pasa `content:validate`; los tests de S1–S12 pasan; el bundle de `apps/web` no incluye `@codemirror/*` ni `elkjs`; pruebas manuales de [accesibilidad](accesibilidad.md#7-protocolo-de-pruebas) completas sobre el Studio.

## F3 · Infraestructura y despliegue
**Objetivo**: el juego (modo invitado) publicado en AWS con CI/CD por OIDC.

- `infra/bootstrap`, `infra/modules/static-site`, `observability` (presupuesto), `envs/prod`.
- `deploy.yml` (plan → aprobación con environment → apply → subida de web + bundle de contenido → invalidación).
- Guía [configurar AWS en tu fork](guias/configurar-aws-en-tu-fork.md) probada end-to-end en una cuenta limpia.
- Comentario de CI con el resumen del escenario (RF-CNT-06) y control de `version` (RF-CNT-07).
- **Reemplazar el deploy manual de la beta pública**: la primera beta (2026-09-30) se publicó antes de esta fase, a mano, con [deploy manual de la beta](guias/deploy-manual-beta.md) y `tools/deploy-beta`. F3 importa o recrea esos recursos con Terraform, elimina esa guía y ese tool, y suma lo que quedó pendiente: una `Content-Security-Policy` propia (RNF-10, [issue #44](https://github.com/elissamburu/blueprint-the-game/issues/44)), probada antes de activarla.

**DoD**: un fork nuevo, siguiendo solo la guía, queda desplegado; un workflow desde una rama distinta de `main` no puede asumir el rol de `apply`.

## F4 · Cuentas, progreso y gamificación
**Objetivo**: registro, progreso en la nube, insignias.

- `infra/modules/{auth,api,data}`, `services/api`, `packages/api-contract`.
- Registro/login, importación del progreso de invitado, re-evaluación en el servidor, XP/rangos/insignias/rachas/maestría/álbum, borrar y exportar datos.
- Validación pendiente del contenido: detectar **insignias imposibles de cumplir** (p. ej. `complete_count` con más escenarios que los existentes para ese nivel/área, o `area_mastery` / `level_complete` sobre un área o nivel sin escenarios `published`). Hoy C006 solo valida que las áreas existan.

**DoD**: un invitado se registra, importa su progreso y el servidor recalcula el mismo XP; al borrar la cuenta no quedan datos personales.

## F5 · IA en el Studio
**Objetivo**: generar escenarios con IA en minutos.

- `packages/ai-generator` (Bedrock + Anthropic), generar, bucle de reparación, revisión crítica, regeneración parcial, creación de PR con `gh`.
- Skill de Claude Code `nuevo-escenario`.

**DoD**: desde un caso de uso en una línea se obtiene en < 60 s un borrador que pasa la validación; la revisión crítica detecta un grado mal calibrado inyectado a propósito.

## F6 · Mobile y accesibilidad
- Interacción por toque con bottom sheet, layout responsive del juego, PWA (instalable, offline para escenarios ya descargados), auditoría WCAG 2.2 AA ([accesibilidad](accesibilidad.md)).
- **Modo texto**: representación alternativa del juego navegable con lector de pantalla y útil con lupa ([ADR-0022](adr/0022-modo-texto.md)).

> La accesibilidad no empieza en F6: cada fase cumple [accesibilidad](accesibilidad.md). F6 agrega el modo texto y la auditoría completa.

**DoD**: el escenario de 200 se completa en un teléfono de 390 px sin drag; el mismo escenario se completa en modo texto con NVDA y con Narrador; auditoría sin hallazgos AA abiertos; el [protocolo de pruebas manuales](accesibilidad.md#7-protocolo-de-pruebas) completo (solo teclado, NVDA y Narrador, zoom 400 % y Lupa de Windows, modo de contraste de Windows, movimiento reducido) sin hallazgos abiertos, y al menos una sesión con personas usuarias reales de lector de pantalla y de lupa.

## F7 · Comunidad y calibración
- `catalog-sync.yml`, métricas de calibración, vista de escenarios mal calibrados, escenario destacado, modo examen, imagen compartible de insignias.
- **Rutas de certificación** (RF-NAV-07): escenarios etiquetados con los dominios publicados en las guías oficiales de examen, filtros y rutas por certificación. Se combinan con el **modo examen** (RF-PLAY-12): una ruta se puede jugar en modo examen. Solo dominios públicos; nunca preguntas reales de examen.

---

## Contenido (transversal a las fases)
El contenido se agrega en cualquier fase, por PR, siguiendo [03 · Modelo de escenarios](03-modelo-de-escenarios.md).

- **Escenarios multicuenta y multirregión**: organización de cuentas y políticas a nivel organización ([Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html)), roles entre cuentas ([tutorial de IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)), landing zone gobernada ([Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html)) y recursos compartidos entre cuentas ([RAM](https://docs.aws.amazon.com/ram/latest/userguide/what-is.html)); arquitecturas activas en más de una región. Usan el grupo `account` del diagrama.
- **Catálogo** (✅ hecho el 2026-10-05):
  - Agregar **AWS Control Tower** y **AWS Resource Access Manager (RAM)** a `content/catalog/services.yaml` (con `leakPatterns`, categoría, ícono y grupos de confusión con Organizations), como requisito de los escenarios multicuenta.
  - Marcar **AWS App Runner** como `deprecated`: su documentación indica que ya no está abierto a clientes nuevos; los clientes existentes pueden seguir usándolo, pero AWS no planea agregar funciones ([What is AWS App Runner?](https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html), [AWS App Runner availability change](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)). Hoy aparece solo en `incorrect` (`insurance-docs-assistant`, `kubernetes-api-migration`), así que el cambio da warnings de L010, no errores; revisar sus rationales en el mismo PR.

---

## Fuera de v1 (backlog)
Leaderboards por comunidad (opt-in) · contenido en inglés · casilleros con combinaciones de servicios · Studio hosteado con autenticación y presupuesto · modo taller para meetups (un facilitador proyecta y los equipos responden).

- **Contenido multiidioma**: traducciones por escenario en `locales/<lang>.yaml`, con el idioma original como fuente de verdad y detección de traducciones desactualizadas ([ADR-0023](adr/0023-contenido-multiidioma.md)). En v1 solo se respeta lo que ese ADR pide para no complicar la migración.
- **Modo "diseño libre"**: el jugador escribe un requerimiento, diagrama la arquitectura con el editor del Studio y la IA la analiza y sugiere mejoras contra objetivos explícitos (como en la evaluación de escenarios, [ADR-0007](adr/0007-evaluacion-por-objetivos.md)). Depende del editor visual de F2 (RF-STU-04) y de la IA de F5; requiere su propio ADR (sale del modelo de respuestas cerradas y necesita IA del lado del jugador, no solo del autor).
