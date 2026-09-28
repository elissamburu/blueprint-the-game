# 0021 · UI con shadcn/ui + Tailwind v4; herramientas de diseño solo como referencia

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto
[ADR-0004](0004-frontend-react-vite.md) fija React + Vite y Tailwind con tokens en `packages/ui`, y dice que el diseño se trabaja aparte. Faltaba decidir:
1. Qué base de componentes usar (diálogos, popovers, selects, tabs y toasts accesibles).
2. Qué rol tiene una herramienta de prototipado visual como Lovable, que genera muy buen diseño pero en su propio proyecto y con su propio CSS.

Se hizo un prototipo en Lovable. Su CSS usa el mismo formato de tokens que shadcn/ui con Tailwind v4 (variables en `:root`, `@theme inline`, colores OKLCH, `tw-animate-css`).

## Decisión
1. **shadcn/ui** como base de componentes en `packages/ui`. Los componentes se copian al repo con la CLI (`shadcn add`); no es una dependencia versionada. Están construidos sobre primitivas accesibles (Radix).
2. **Tailwind CSS v4** con los tokens de [docs/design/tokens.css](../design/tokens.css) como fuente de verdad visual.
3. **Monorepo**: se usa el soporte de monorepo de la CLI de shadcn. Cada workspace que instala componentes tiene su `components.json`, y los componentes compartidos viven en `packages/ui`.
4. **Herramientas de diseño (Lovable u otras) solo como referencia**: sus capturas y tokens se versionan en `docs/design/`. Su código **no se copia** ni se sincroniza con el repo, y el proyecto de la herramienta es descartable.
5. **Solo tema claro en v1.** El tema oscuro se diseña aparte si se decide agregarlo.
6. **Accesibilidad de tokens**: todo token usado como texto cumple 4,5:1 contra los fondos donde aparece, y los bordes de componentes interactivos cumplen 3:1. Los ajustes quedan documentados en `tokens.css`.

## Alternativas consideradas
- **Seguir el desarrollo dentro de Lovable (con sync a GitHub)**: dos fuentes de verdad, un CSS de clases propias difícil de mantener y la estructura del monorepo (paquetes puros, límites con dependency-cruiser) fuera de control. Descartado.
- **Librería de componentes empaquetada (MUI, Mantine, Chakra)**: más peso en el cliente (RNF-03) y un sistema de theming propio que se superpone con Tailwind. Descartado.
- **Componentes propios desde cero sobre Radix**: mismo resultado que shadcn/ui con más trabajo. Descartado.

## Consecuencias
- Los tokens del prototipo se trasladan casi sin cambios.
- Los componentes de shadcn/ui son código del repo: se revisan, se testean y llevan encabezado SPDX como el resto.
- Cambiar el look = cambiar tokens o componentes en `packages/ui`; la lógica (game-engine, diagram) no se toca.
- Una iteración visual nueva se hace en la herramienta de diseño y se trae como capturas y tokens en un PR `docs/…`.

## Referencias
- shadcn/ui — [Monorepo](https://ui.shadcn.com/docs/monorepo)
- shadcn/ui — [Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
