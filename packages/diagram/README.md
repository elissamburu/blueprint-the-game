# @blueprint/diagram

Tablero del juego: dibuja el bloque `diagram` de un escenario con React Flow ([ADR-0005](../../docs/adr/0005-modelo-de-diagrama.md)). Se consume como código fuente, como `@blueprint/ui`, y la app lo carga de forma diferida ([ADR-0004](../../docs/adr/0004-frontend-react-vite.md), RNF-03).

- **Posiciones del YAML**, sin layout en runtime. Grupos como nodos padre; nodos `actor`, `external`, `fixed` y `slot` con el tamaño de `NODE_SIZE`.
- **Aristas** rectas entre los bordes de los nodos, con el número de paso en un círculo sobre el tramo libre: nunca encima de un nodo ni de la etiqueta de un grupo (`geometry.ts`).
- **Reproductor de flujo** (RF-PLAY-03) y **tira de pasos**, que además es la alternativa textual del tablero (`aria-describedby`). Con `prefers-reduced-motion` avanza solo a pedido y sin animación.
- **Zoom** (RF-PLAY-11): −, %, + y restablecer (ajustar a la pantalla, hasta el mínimo). Pan arrastrando el fondo; zoom con pellizco o Ctrl + rueda.
- **Al abrir** (`viewport.ts`): el zoom de ajustar a la pantalla, pero nunca menor a 80 %, para que los textos del casillero se lean. Si a 80 % no entra, abre arriba a la izquierda del contenido, corrido lo justo para que se vea el origen del primer paso del flujo (o el primer actor), y el resto se recorre con pan.

## Contrato

No decide grados ni importa `game-engine` (regla `diagram-not-to-game-logic` de dependency-cruiser). La app calcula el estado con el motor y traduce los eventos a comandos ([ADR-0008](../../docs/adr/0008-interaccion-desacoplada.md)):

```tsx
<Diagram
  diagram={scenario.diagram}
  services={(id) => ({ name, category, iconSrc })}
  slots={{ [slotId]: { grade, serviceId, hints: { used, total }, selected } }}
  onSlotActivate={(slotId) => dispatch(commands.selectSlot(slotId))}
  onServiceDrop={(slotId, serviceId) => dispatch(commands.placeService(slotId, serviceId))}
  slotHintAction={(slotId) => <HintAction … />}
/>
```

- Sin `onSlotActivate`, el tablero es de solo lectura: los casilleros no son enfocables. Con él, cada casillero se enfoca con Tab y se activa con Enter o Espacio (`aria-label` "<rol>. <estado>[: <servicio>]").
- Con `onServiceDrop`, cada casillero es un destino de `@dnd-kit/core`: el tablero tiene que estar dentro del `DndContext` de la app, y lo que se arrastra lleva `data: { type: "service", serviceId }` (`ServiceDragData`).
- Con `slotHintAction`, lo que devuelve para un casillero reemplaza su contador "Pistas n/m" (p. ej. el botón "Ver pista" con su popover). Si devuelve `undefined`, queda el contador.
