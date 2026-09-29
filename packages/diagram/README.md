# @blueprint/diagram

Tablero del juego: dibuja el bloque `diagram` de un escenario con React Flow ([ADR-0005](../../docs/adr/0005-modelo-de-diagrama.md)). Se consume como código fuente, como `@blueprint/ui`, y la app lo carga de forma diferida ([ADR-0004](../../docs/adr/0004-frontend-react-vite.md), RNF-03).

- **Posiciones del YAML**, sin layout en runtime. Grupos como nodos padre; nodos `actor`, `external`, `fixed` y `slot` con el tamaño de `NODE_SIZE`.
- **Aristas** rectas entre los bordes de los nodos, con el número de paso en un círculo sobre el tramo libre: nunca encima de un nodo ni de la etiqueta de un grupo (`geometry.ts`).
- **Reproductor de flujo** (RF-PLAY-03). Con `playButton` (por defecto) hay un botón flotante "Reproducir flujo"; sin él, la app lo inicia con el handle (`ref.current.playFlow()`). Mientras corre, una tarjeta flotante sobre los controles de zoom muestra el paso actual y los controles; los dos van en una pila abajo a la izquierda (`data-slot="board-controls"`), que la app puede medir para no taparla. Con `prefers-reduced-motion` avanza solo a pedido y sin animación.
- **Lista de pasos**: es la alternativa textual del tablero (`aria-describedby`), con el origen → destino de cada paso (`diagramSteps`: actores por su etiqueta, nodos fijos por su servicio y casilleros por su rol, nunca por el servicio oculto). `stepList="strip"` la muestra debajo del tablero; `"hidden"` la deja solo como descripción (el juego la muestra en "Ver caso"). El número de cada arista muestra su paso al pasar el mouse.
- **Zoom** (RF-PLAY-11): controles flotantes abajo a la izquierda (−, %, + y "Ajustar a la pantalla"), en pasos de 25 %, de 20 % a **300 %** (docs/design, problema 27). También con Ctrl + rueda o pellizco.
- **Desplazamiento** (problema 29), a cualquier zoom: arrastrando el fondo, con la rueda o dos dedos (Shift: horizontal), con las flechas cuando el tablero tiene el foco (es enfocable) y al llegar con Tab a un casillero fuera de la vista, que queda centrado sin cambiar el zoom.
- **Al abrir** (`viewport.ts`): el zoom de ajustar a la pantalla, pero nunca menor a 80 %, para que los textos del casillero se lean. Si a 80 % no entra, abre arriba a la izquierda del contenido, corrido lo justo para que se vea el origen del primer paso del flujo (o el primer actor), y el resto se recorre con pan.
- **Vista previa** (`preview`): una imagen fija ajustada a su caja, sin controles, pan, zoom ni reproductor, con los casilleros vacíos y sin texto. La usa el brief.

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
  stepList="hidden"
  playButton={false}
  ref={diagramRef} // DiagramHandle: playFlow(), panBy(dx, dy), element()
/>
```

- Sin `onSlotActivate`, el tablero es de solo lectura: los casilleros no son enfocables. Con él, cada casillero se enfoca con Tab y se activa con Enter o Espacio (`aria-label` "<rol>. <estado>[: <servicio>]").
- Con `onServiceDrop`, cada casillero es un destino de `@dnd-kit/core`: el tablero tiene que estar dentro del `DndContext` de la app, y lo que se arrastra lleva `data: { type: "service", serviceId }` (`ServiceDragData`).
- Con `slotHintAction`, lo que devuelve para un casillero reemplaza su contador "Pistas n/m" (p. ej. el botón "Ver pista" con su popover). Si devuelve `undefined`, queda el contador.
- Con `onViewportChange`, la app se entera de cada cambio de zoom o posición (el juego lo usa para ubicar la tarjeta de feedback).
- Con `insetLeft` (px), la app avisa que tapa una franja a la izquierda con un panel propio ("Ver caso"): los controles flotantes se corren a su derecha y un casillero al que se llega con Tab se centra en la parte libre (`revealViewport` en `viewport.ts`, que además muestra entero un casillero que creció).
- Los textos de los nodos van en `px`: dentro del tablero escalan con el zoom del tablero, no con el tamaño de letra del navegador, así los nodos (de tamaño fijo en el canvas) no se superponen con letra grande (docs/design, problema 28).
