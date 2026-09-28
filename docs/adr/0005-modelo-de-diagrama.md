# 0005 · Modelo de diagrama propio; React Flow para render; Mermaid derivado

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
El juego necesita casilleros donde soltar servicios, posiciones controladas, grupos anidados (Nube, Región, VPC, AZ, subredes), aristas ordenadas para animar el flujo y buen comportamiento con zoom en pantallas chicas. Además, agregar escenarios tiene que ser fácil, y la comunidad quiere poder leer el diagrama en GitHub.

## Decisión
1. **Fuente de verdad**: el bloque `diagram` del `scenario.yaml` (grupos, nodos con posición, aristas con `step`). Formato propio, validado con Zod.
2. **Render**: React Flow en `packages/diagram`, compartido por el juego y el Studio. Nodos custom por tipo (`actor`, `external`, `fixed`, `slot`) y grupos como nodos padre.
3. **Auto-layout**: elkjs (layered, con soporte de jerarquía) para ordenar borradores (IA o nuevos) en el Studio; el autor ajusta a mano después. Las posiciones finales se guardan en el YAML (el juego no calcula el layout en runtime).
4. **Mermaid**: se **genera** (`diagram.mmd` + `README.md`) desde el YAML para revisión en PRs y lectura en GitHub. Nunca se edita a mano ni se parsea.

## Alternativas consideradas
- **Mermaid como fuente**: no controla posiciones, no modela casilleros ni metadatos de respuestas, y su layout cambia entre versiones.
- **draw.io / Excalidraw como fuente**: buenos editores, pero formatos pesados para diff y sin semántica de juego.
- **Layout automático en runtime**: el diagrama "salta" entre versiones de la librería; peor para pedagogía.

## Consecuencias
- Agregar un escenario es fácil **gracias al Studio** (editor visual + IA + auto-layout), no por escribir YAML a mano.
- Coordenadas lógicas en un canvas fijo; el renderer escala (`fitView`) para cualquier pantalla.
- Existe una sola forma de dibujar: si hace falta un tipo de nodo nuevo, se agrega al schema y al renderer.
