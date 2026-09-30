# 0022 · Modo texto: representación alternativa del juego

- Estado: Propuesto
- Fecha: 2026-09-30

## Contexto
El diagrama es el centro del juego y es una imagen compleja: nodos posicionados en dos dimensiones, grupos anidados (Cloud, Región, VPC, subredes) y aristas numeradas que describen el flujo. Aunque cada casillero sea enfocable y tenga nombre accesible ([ADR-0008](0008-interaccion-desacoplada.md)), recorrer un lienzo 2D con lector de pantalla no transmite la estructura: el orden de Tab no es el orden del flujo y las relaciones entre nodos no se leen.

Con lupa o zoom al 400 % pasa algo parecido: el diagrama necesita scroll en dos dimensiones y se pierde el contexto. WCAG admite ese scroll para contenido que requiere dos dimensiones ([1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)), pero el juego tiene que poder jugarse igual. Además, el texto del tablero va en `px` y escala con el zoom propio del tablero, no con el tamaño de letra del navegador ([accesibilidad, "Tamaños en `rem`"](../accesibilidad.md#2-baja-visión)): quien agranda solo la letra no ve cambios en el diagrama.

La guía de W3C para imágenes complejas pide una alternativa textual equivalente que transmita la misma información, no solo una descripción corta ([Complex Images](https://www.w3.org/WAI/tutorials/images/complex/)). En este juego la alternativa además tiene que ser **operable**: no alcanza con describir el diagrama, hay que poder completarlo.

## Decisión
El juego tiene un **modo texto**: una representación equivalente del escenario, navegable con lector de pantalla y útil con lupa o zoom, que se puede elegir en cualquier momento y queda recordada como preferencia del jugador. Se genera a partir del mismo modelo de escenario ([ADR-0005](0005-modelo-de-diagrama.md)); no es contenido que el autor escribe aparte.

Estructura:
1. **Caso y objetivos como encabezados y listas.** Encabezado del escenario; contexto como párrafos; restricciones (`hard`) y metas (`soft`) en dos listas con su propio encabezado, distinguidas por texto y no solo por estilo.
2. **El flujo como lista ordenada de pasos**, a partir de las aristas numeradas (`step`). Cada paso dice origen → destino, su etiqueta y su descripción. Los pasos con el mismo número (en paralelo) se agrupan en un mismo ítem. Los grupos (VPC, subred, etc.) se mencionan como ubicación del nodo, no como pasos.
3. **Cada casillero aparece en su paso** (en el primero donde interviene como origen o destino; en los siguientes, como referencia con enlace a ese control). Un casillero que no participa de ninguna arista va en una sección final "Otros componentes".
4. **Cada casillero es un grupo de controles de formulario** (`fieldset` con `legend` = número de casillero y rol):
   - selector de servicio (lista con búsqueda, con las mismas opciones que la paleta del nivel);
   - el rol del casillero;
   - botón de pista (con su costo) y las pistas reveladas;
   - el resultado: grado (en texto e ícono), explicación y objetivos vinculados; y, si el grado es naranja, el botón "Me quedo con esta".

   Los controles emiten **los mismos comandos** del motor que el drag, el toque y el teclado ([ADR-0008](0008-interaccion-desacoplada.md)): `selectSlot`, `placeService`, `acceptAcceptable`, `useHint`, `clearSlot`. El modo texto es **un adaptador más**, no una segunda implementación de las reglas.
5. **Feedback por `aria-live`**: al colocar un servicio, una región `aria-live="polite"` anuncia el casillero, el grado y un resumen de una línea; la explicación completa queda en el grupo del casillero, junto al control donde se actuó (útil también con lupa). No se usan toasts como único canal.

El modo texto y el diagrama comparten el estado de la partida: se puede cambiar de uno a otro sin perder nada. Funciones como "Ver solución" (RF-PLAY-14) o el reproductor de flujo (RF-PLAY-03, que en modo texto resalta el paso de la lista) tienen su equivalente.

## Alternativas consideradas
- **Solo nombres accesibles en los nodos del diagrama**: el lector anuncia cada casillero, pero no el flujo ni la relación entre nodos. Insuficiente.
- **Descripción larga estática (`aria-describedby` o página aparte)**: describe pero no permite jugar; obliga a ir y volver entre la descripción y el lienzo.
- **Texto alternativo escrito por el autor en el YAML**: duplica información que ya está en el modelo, se desactualiza y agrega trabajo a cada escenario.
- **Mermaid generado (`diagram.mmd`) como alternativa**: es para autores y revisores de PR, no es accesible como interfaz.

## Consecuencias
- **Todo componente nuevo del juego tiene que poder expresarse en el modo texto.** Un PR que agrega una interacción o un elemento visual al tablero incluye su equivalente en modo texto (o justifica por qué no aplica). Esto se revisa en el PR.
- El modelo de escenario ya alcanza: `step` de las aristas, `role` de los casilleros y objetivos. Un cambio futuro al modelo (p. ej. casilleros con varios servicios) tiene que contemplar su representación en texto.
- La lógica de "en qué paso aparece cada casillero" es derivación pura del escenario y vive en un paquete puro (candidato: `packages/diagram` o `game-engine`), testeable sin DOM.
- El modo texto se prueba con el protocolo de [accesibilidad](../accesibilidad.md#7-protocolo-de-pruebas) (NVDA, Narrador, zoom 400 %, Lupa de Windows).
- Se implementa en F6 ([roadmap](../05-roadmap.md)); lo que aplica desde ya es la consecuencia anterior: no agregar al juego nada que no pueda expresarse en texto.

## Referencias
- W3C WAI — [Complex Images](https://www.w3.org/WAI/tutorials/images/complex/)
- W3C — [WAI-ARIA 1.2 · `aria-live`](https://www.w3.org/TR/wai-aria-1.2/#aria-live)
- W3C — [Understanding 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
