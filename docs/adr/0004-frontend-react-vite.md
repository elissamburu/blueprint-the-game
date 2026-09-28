# 0004 · Frontend React + Vite (SPA/PWA)

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
El juego es una aplicación interactiva (diagrama, drag & drop, estado local rico) sin necesidades de SEO por página. Tiene que servirse barato y ser instalable en mobile más adelante.

## Decisión
**React + Vite** como SPA estática, servida desde S3 + CloudFront. Librerías base:
- `@xyflow/react` (React Flow) para diagramas — ver [0005](0005-modelo-de-diagrama.md).
- `@dnd-kit` para drag & drop accesible (soporta teclado y sensores táctiles).
- TanStack Router o React Router, TanStack Query para datos del servidor, Zustand para estado de partida.
- Tailwind CSS con tokens de diseño en `packages/ui`.
- `vite-plugin-pwa` en F6.

El diseño visual se trabaja aparte (p. ej. con una herramienta de diseño/prototipado) y se traduce a tokens y componentes en `packages/ui`; la lógica no depende del look.

## Alternativas consideradas
- **Next.js**: SSR/RSC no aportan valor acá y complican el hosting estático y los forks.
- **SvelteKit / Svelte Flow**: muy agradable, pero con una comunidad de contribuidores más chica que React.
- **Motor de juego (Phaser, etc.)**: sobredimensionado; la interacción es de UI, no de física.

## Consecuencias
- Hosting 100 % estático y barato; un fork no necesita servidores para el front.
- React Flow y el editor YAML se cargan de forma diferida para cumplir RNF-03.
