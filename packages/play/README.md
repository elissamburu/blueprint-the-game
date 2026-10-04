# @blueprint/play

Pantalla de juego compartida por el juego web y el preview del Studio ([ADR-0025](../../docs/adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md) §1): el tablero de `@blueprint/diagram` con la barra, la paleta, la tarjeta de feedback, el brief, "Ver caso", el diálogo de solución y el modo foco. Se consume como código fuente, como `@blueprint/ui`.

- **Adaptadores de interacción** ([ADR-0008](../../docs/adr/0008-interaccion-desacoplada.md)) en `src/interaction/`: drag, tap y teclado emiten los mismos comandos. Es el único paquete de UI que importa `game-engine` (regla de dependency-cruiser): traduce los eventos del tablero en comandos y nunca decide un grado.
- **Store de la sesión** (`createSessionStore`, zustand): una pantalla, una sesión. No guarda progreso.
- **Textos** en el namespace de i18next `play` (`src/locales/es.json`). Cada app lo registra:

  ```ts
  import playEs from "@blueprint/play/locales/es.json";
  i18n.init({ resources: { es: { translation: es, play: playEs } } });
  ```

- **Preferencias de la UI del tablero** (paleta colapsada) en `localStorage`, fuera del progreso.

## Contrato

Lo propio de cada app entra por el puerto `GameHost` (`src/host.ts`):

| Campo | Web | Studio (F2, PR 3) |
|---|---|---|
| `iconSrc(serviceId)` | `public/icons/<id>.svg` | `/icons/<id>.svg` del servidor local |
| `onStarted?(scenarioId)` | marca el escenario "en curso" | — |
| `onFinish(session)` | guarda el resultado y va al resumen | resumen en la misma pantalla |
| `exit` | `href: "/escenarios"` | `onExit` |
| `reportIssueUrl?(slotId?)` | issue de GitHub (RF-PLAY-13) | — |
| `printHref?(scenarioId)` | `/escenarios/<id>/imprimir` | — |
| `useLayout?()` | layout inmersivo | — |

`href` y `printHref` son rutas del router de la app (React Router), así que la pantalla tiene que montarse dentro de uno.

```tsx
const GameScreen = lazy(() => import("@blueprint/play/game-screen"));

<GameScreen scenario={scenario} bundle={{ index, catalog, rules }} host={host} />;
```

`@blueprint/play/game-screen` es un subpath aparte para que la app lo cargue en su propio chunk con React Flow y @dnd-kit ([ADR-0004](../../docs/adr/0004-frontend-react-vite.md), RNF-03). La entrada principal (`@blueprint/play`) es liviana: el puerto, los adaptadores al tablero (`createServiceLookup`, `slotViews`) y las piezas que reusan las páginas de la app (`CaseContext`, `CaseObjectives`, `InlineMarkdown`, `StatusBadge`).
