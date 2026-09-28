# @blueprint/ui

Componentes y tokens de diseño compartidos ([ADR-0021](../../docs/adr/0021-ui-shadcn-tailwind-y-referencia-visual.md)). Se consume como código fuente: lo compila el Vite de cada app.

- `src/styles/globals.css`: Tailwind v4 + tokens de [docs/design/tokens.css](../../docs/design/tokens.css) (fuente de verdad visual). Solo tema claro.
- `src/components/`: componentes de shadcn/ui (copiados con la CLI) y componentes propios (`GradeBadge`, `ObjectiveTag`, `LevelBadge`). Reciben el estado por props; no importan `game-engine` (regla `ui-not-to-game-logic` de dependency-cruiser).

## Usarlo desde una app

```css
/* src/index.css de la app */
@import "@blueprint/ui/globals.css";
@source "../../../packages/ui/src";
```

```tsx
import { Button } from "@blueprint/ui/components/button";
```

## Agregar un componente de shadcn/ui

Desde `packages/ui` (PowerShell o cualquier shell):

```bash
pnpm dlx shadcn@4.21.0 add <componente>
```

Después, a mano:
1. Encabezado `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0` en la primera línea.
2. Si el import de `cn` quedó como `from "cn"` (bug del registro de shadcn), cambiarlo por `from "@blueprint/ui/lib/utils"` y sacar el paquete `cn` si la CLI lo instaló.
3. Quitar `"use client"` (no usamos RSC) y textos en inglés visibles o para lectores de pantalla.
4. `pnpm format`, `pnpm lint` y `pnpm typecheck`.
