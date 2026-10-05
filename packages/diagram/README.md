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
  slots={{ [slotId]: { grade, number, serviceId, hints: { used, total }, selected } }}
  onSlotActivate={(slotId) => dispatch(commands.selectSlot(slotId))}
  onServiceDrop={(slotId, serviceId) => dispatch(commands.placeService(slotId, serviceId))}
  slotHintAction={(slotId, { roleId }) => <HintAction roleId={roleId} … />}
  stepList="hidden"
  playButton={false}
  ref={diagramRef} // DiagramHandle: playFlow(), panBy(dx, dy), element()
/>
```

- Sin `onSlotActivate`, el tablero es de solo lectura: los casilleros no son enfocables. Con él, cada casillero se enfoca con Tab y se activa con Enter o Espacio.
- Nombre accesible del casillero: con `number` en su `SlotView` (el número que da `slotNumbers` de `game-engine`, el mismo del resumen) es corto y único en el tablero, empieza con el texto visible y termina con el número ("Óptimo: Amazon S3, casillero 2", "Arrastrá o elegí un servicio, casillero 3"), y el rol visible es su descripción (`aria-describedby`). Sin `number`, el nombre es "<rol>. <estado>[: <servicio>]".
- Con `onServiceDrop`, cada casillero es un destino de `@dnd-kit/core`: el tablero tiene que estar dentro del `DndContext` de la app, y lo que se arrastra lleva `data: { type: "service", serviceId }` (`ServiceDragData`).
- Con `slotHintAction`, lo que devuelve para un casillero reemplaza su contador "Pistas n/m" (p. ej. el botón "Ver pista" con su popover). Si devuelve `undefined`, queda el contador. Recibe también el `id` del texto del rol del casillero (`roleId`), para describir con él el control que devuelve: su nombre accesible tiene que ser distinto en cada casillero (WCAG 2.4.6).
- Cada número de paso es un botón ("Paso 3: <etiqueta>", único en el tablero) que abre un popover con la etiqueta, la descripción y el recorrido de su arista (RF-PLAY-03). Van en el `ViewportPortal` de React Flow: en el orden de Tab quedan después de los casilleros y, en pantalla, entre las aristas y los nodos (`Z.step`), así su área de toque (al menos 24 × 24 px con cualquier zoom, `stepTargetDiameters`) nunca le saca un clic a un nodo. En la vista previa son solo los círculos.
- Un clic en un control del tablero nunca lo desplaza: los casilleros con algo para hacer y los números de paso llevan la clase `nopan` (`NO_PAN`), así React Flow no toma como arrastre un clic en el que el puntero se mueve un par de píxeles (y no se traga el clic, issue #48). La rueda y el arrastre desde el fondo siguen desplazando el tablero.
- Con `onViewportChange`, la app se entera de cada cambio de zoom o posición (el juego lo usa para ubicar la tarjeta de feedback).
- Con `insetLeft` (px), la app avisa que tapa una franja a la izquierda con un panel propio ("Ver caso"): los controles flotantes se corren a su derecha y un casillero al que se llega con Tab se centra en la parte libre (`revealViewport` en `viewport.ts`, que además muestra entero un casillero que creció).
- Los textos de los nodos van en `px`: dentro del tablero escalan con el zoom del tablero, no con el tamaño de letra del navegador, así los nodos (de tamaño fijo en el canvas) no se superponen con letra grande (docs/design, problema 28).

## Editor visual (Studio)

`@blueprint/diagram/editor` exporta `DiagramEditor`, el editor del diagrama del Studio (RF-STU-04). Es un subpath aparte para que el juego no lo cargue (regla `web-not-to-diagram-editor` de dependency-cruiser).

- Dibuja un **borrador** del bloque `diagram` (`parseDiagramDraft` de `scenario-schema`): solo exige la geometría, así que un elemento recién creado se ve aunque no pase el schema (⚠ «Incompleto»).
- **No conoce el YAML**: emite comandos por id (`editor-model.ts`) y la app los traduce a ediciones del documento.

```tsx
<DiagramEditor
  draft={parseDiagramDraft(raw.diagram)}
  services={lookup}
  selection={selection} // { kind: "group" | "node" | "edge", id }
  onSelectionChange={setSelection}
  onCommand={(command) => apply(command)} // place, addNode, addGroup, connect, remove, moveStep
  issues={issues} // Map<"node:<id>", "error" | "warning">
  readOnly={!parses}
  onActivate={(selection) => focusInspector(selection)}
  onUndo={undo}
  onRedo={redo}
  ref={editorRef} // focus(selection), reveal(selection), openConnect()
/>
```

- `place` lleva las posiciones finales (absolutas, como en el YAML) y el grupo o padre de cada elemento movido: la pertenencia se recalcula al mover (`containerOf`): se conserva mientras el elemento siga entero dentro de su grupo; si no, pasa al grupo más interno que lo contiene entero. Mover un grupo mueve sus descendientes. `input: "pointer"` es un paso de deshacer; `"keyboard"`, una pulsación que se puede sumar a las siguientes.
- `remove` es un pedido: la app confirma.
- **Teclado**: el canvas es una sola parada de `Tab`; adentro, `Tab` recorre los elementos en orden de lectura (`readingOrder`) y `Esc` seguido de `Tab` sale. Los atajos de una tecla solo actúan con el foco en el canvas o en un elemento (WCAG 2.1.4). La ayuda (`EDITOR_HELP`) está visible debajo del canvas y es su descripción accesible.
- Los grupos se mueven desde su etiqueta, así el fondo de un grupo sigue desplazando el canvas.

## Auto-layout (Studio)

`@blueprint/diagram/layout` exporta `autoLayout`, el «Ordenar» del Studio (RF-STU-05), con [elkjs](https://github.com/kieler/elkjs) ([ADR-0005](../../docs/adr/0005-modelo-de-diagrama.md), [ADR-0025 §2](../../docs/adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md)). No usa React ni el DOM, así que corre también en Node (el pipeline de IA de F5). La entrada principal del paquete nunca lo alcanza (regla `diagram-entry-not-to-layout` de dependency-cruiser) y el Studio lo carga de forma diferida.

```ts
const { positions, rects, canvas } = await autoLayout(diagram); // Diagram o DiagramDraft
```

- Algoritmo *layered* de izquierda a derecha (`RIGHT`) con los grupos como nodos compuestos (`INCLUDE_CHILDREN`), el tamaño de cada nodo de `NODE_SIZE` y, arriba de cada grupo, lugar para su etiqueta. El orden del modelo es el de los pasos (`considerModelOrder`), así el flujo se lee en orden.
- Coordenadas absolutas, en la grilla de 10, con un margen de 40 alrededor del contenido; el canvas termina en ese margen. Los espacios entre elementos son de al menos 20, así redondear a la grilla nunca saca un nodo de su grupo ni lo superpone con otro (L007).
- Solo calcula geometría: no cambia ids, textos, pertenencia, aristas ni pasos. Un grupo vacío conserva su tamaño. Es determinista: ordenar lo ordenado no cambia nada.
- Tolera un borrador: un grupo o padre inexistente, o un ciclo de padres, deja el elemento en el nivel superior; las aristas a nodos que no existen y los lazos se ignoran.
- `overlappingSiblingGroups` lista los grupos hermanos que hoy se superponen (al ordenar quedan separados; el Studio pregunta antes).
