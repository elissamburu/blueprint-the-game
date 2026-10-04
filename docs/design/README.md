# Referencia visual

Capturas y tokens del prototipo hecho en Lovable (28/09/2026; layout de juego v2 del 29/09/2026). Es **referencia visual, no código**: la implementación vive en `packages/ui` y `apps/web` con shadcn/ui + Tailwind ([ADR-0021](../adr/0021-ui-shadcn-tailwind-y-referencia-visual.md)).

## Qué hay acá

| Archivo | Qué es |
|---|---|
| [tokens.css](tokens.css) | Tokens listos para `packages/ui` (formato shadcn + Tailwind v4, OKLCH). Incluye ajustes de contraste respecto del prototipo. |
| [lovable-styles.css.txt](lovable-styles.css.txt) | CSS original del prototipo, sin tocar. Sirve para consultar medidas y espaciados. **No se copia**: usa clases propias en lugar de utilidades y componentes. |
| [motion-spec.md](motion-spec.md) | Especificación de movimiento del prototipo (03/10/2026): momento, elemento, duración, curva y alternativa con movimiento reducido (RF-PLAY-17). |
| [motion.css.txt](motion.css.txt) | CSS de movimiento original del prototipo, sin tocar: variables `--motion-*` y `@keyframes`. **No se copia** tal cual: la implementación está en `packages/ui`. |
| [pantallas/00-onboarding.png](pantallas/00-onboarding.png) | Onboarding: áreas de interés (multi-selección) y experiencia (RF-ONB-01, RF-ONB-02). |
| [pantallas/01-juego-escenario-300.png](pantallas/01-juego-escenario-300.png) | Pantalla de juego: caso y objetivos, tablero con grupos, casilleros resueltos, aristas numeradas y paleta. |
| [pantallas/02-escenarios-recomendado.png](pantallas/02-escenarios-recomendado.png) | Listado de escenarios: cabecera y banda de recomendado. |
| [pantallas/03-escenarios-listado.png](pantallas/03-escenarios-listado.png) | Listado de escenarios: filtros y tarjetas por nivel (incluye una bloqueada). |
| [pantallas/04-perfil.png](pantallas/04-perfil.png) | Perfil: rango, insignias, maestría por área. |
| [pantallas/05-perfil-album.png](pantallas/05-perfil-album.png) | Perfil: álbum de servicios. |
| [pantallas/06-juego-incorrecto.png](pantallas/06-juego-incorrecto.png) | Juego: casillero incorrecto con el panel de feedback anclado abajo ("Viola: …" + "Probar otra"). |
| [pantallas/07-juego-aceptable.png](pantallas/07-juego-aceptable.png) | Juego: casillero aceptable con feedback ("Me quedo con esta" / "Probar otra"). |
| [pantallas/08-juego-pistas.png](pantallas/08-juego-pistas.png) | Juego: popover de pistas de un casillero. |
| [pantallas/09-resumen-cabecera.png](pantallas/09-resumen-cabecera.png) | Resumen: cabecera con puntaje, XP y casilleros. |
| [pantallas/10-resumen-repaso-1.png](pantallas/10-resumen-repaso-1.png), [11](pantallas/11-resumen-repaso-2.png) | Resumen: repaso por casillero y acciones finales. |
| [pantallas/12-juego-brief.png](pantallas/12-juego-brief.png) | **Juego v2**: brief al entrar (caso, restricciones, metas, vista previa, "Empezar a diseñar"). |
| [pantallas/13-juego-tablero.png](pantallas/13-juego-tablero.png) | **Juego v2**: barra única, tablero a todo el espacio, zoom flotante, paleta expandida. |
| [pantallas/14-juego-ver-caso.png](pantallas/14-juego-ver-caso.png) | **Juego v2**: panel "Ver caso" superpuesto, con los pasos del flujo. |
| [pantallas/15-juego-modo-foco.png](pantallas/15-juego-modo-foco.png) | **Juego v2**: modo foco con barra mínima flotante. |
| [pantallas/16-juego-paleta-colapsada-flujo.png](pantallas/16-juego-paleta-colapsada-flujo.png) | **Juego v2**: paleta colapsada a íconos y reproductor de flujo en marcha. |
| [pantallas/17-juego-feedback-flotante.png](pantallas/17-juego-feedback-flotante.png) | **Juego v2**: tarjeta de feedback flotante sobre el tablero. |

> **Layout de juego v2.** Las capturas 12–17 **reemplazan el layout** de 01, 06, 07 y 08 (tres columnas, panel del caso fijo, tira de pasos y feedback anclado). De 01, 06, 07 y 08 siguen valiendo el diseño del **casillero**, de los **grupos**, del **popover de pistas** y el **contenido** del feedback; no su ubicación en pantalla.

## Qué se toma y qué no

**Se toma**
- Paleta, radios y el formato de tokens.
- Tipografía: **fuente del sistema** (`--font-sans` en [tokens.css](tokens.css)). El prototipo declaraba Manrope, pero nunca la cargaba (no había `@font-face`, link ni paquete de fuente), así que se veía y se capturó en **Segoe UI**, que es la fuente aprobada. En Mac y Linux se usa la fuente del sistema correspondiente (`system-ui` / `-apple-system`, con Helvetica Neue y Arial de respaldo). No se descargan fuentes.
- Patrón de estados del casillero (borde y fondo suave por color, etiqueta arriba, "Ver pista (−15 pts)" abajo).
- **Layout de juego v2** (capturas 12–17):
  - **Brief al entrar**: nivel, áreas, duración, contexto, restricciones, metas, vista previa no interactiva del diagrama y "Empezar a diseñar".
  - **Sin encabezado global** en el juego: una sola barra con volver, nivel + título, progreso, puntaje, "Ver caso", "Modo foco", "Finalizar" y menú "⋯" ("Reproducir flujo", "Reportar un problema").
  - **Tablero a todo el espacio**, con los controles de zoom flotando abajo a la izquierda.
  - **"Ver caso"**: panel lateral superpuesto (no achica el tablero) con contexto, restricciones, metas y pasos del flujo (número, descripción, origen → destino). Se cierra con X o Esc.
  - **Paleta colapsable** a una columna de íconos con tooltip del nombre.
  - **Feedback como tarjeta flotante** sobre el tablero, solo cuando hay algo que mostrar (al colocar o al tocar un casillero resuelto), con botón cerrar. Siempre visible sin scroll y con `aria-live="polite"`.
  - **Modo foco**: tablero + paleta + barra mínima flotante (progreso, "Ver caso", "Finalizar", "Salir del foco"). Pide pantalla completa; si el navegador no la da o se sale con Esc, el modo foco sigue sin pantalla completa.
- Separación visual entre **Restricciones** (duras) y **Metas** (blandas) en el panel del caso (RF-PLAY-01).
- Paleta agrupada por categoría con buscador. Los pasos del flujo se ven en "Ver caso", al pasar el mouse por el número de cada arista y durante el reproductor (RF-PLAY-03); siguen siendo la alternativa textual del tablero para lectores de pantalla.
- **Pantalla de juego a alto fijo**: sin scroll de página; el tablero se desplaza por dentro. (El panel de feedback anclado con estado vacío del layout anterior queda reemplazado por la tarjeta flotante del layout v2.)
- Acciones del feedback: aceptable → "Me quedo con esta" + "Probar otra" (RF-PLAY-07/08); incorrecto → "Probar otra"; óptimo → sin acciones.
- Etiquetas de objetivos en el feedback: check (cumple), guion (meta a medias), X roja con "Viola: <restricción>".

**No se toma**
- El CSS del prototipo: se reescribe con utilidades de Tailwind y componentes de shadcn/ui.
- El tema oscuro: el bloque `.dark` del prototipo es el default de shadcn, no está diseñado. v1 es solo claro.
- Los íconos de `public/icons` del prototipo: en el repo se descargan en build ([ADR-0012](../adr/0012-iconos.md)).
- Los datos de ejemplo del prototipo: los escenarios, nombres y puntajes son de relleno.

## Elementos del prototipo fuera del alcance de F1

El prototipo muestra cosas que no están en F1 o que no existen en los requisitos. No se implementan en F1 aunque aparezcan en las capturas.

| Elemento | Situación |
|---|---|
| "Nv. 7" en el encabezado y "7 · Nivel" en el perfil | **No existe** en el modelo: el jugador tiene **rango** (RF-GAM-01), y "nivel" es la dificultad del escenario (100–400). Mostrar ambos confunde. Se reemplaza por el rango. |
| Racha "4 días" | RF-GAM-05, **F4**. |
| "Meta diaria" | **No existe** en los requisitos. Queda afuera salvo que se agregue un RF. |
| Maestría por área | RF-GAM-04, **F4**. |
| Álbum de servicios | RF-GAM-06, **F4**. |
| Insignias | RF-GAM-02, **F4** (en F1 solo XP y rango local). |

## Problemas detectados para resolver al implementar

1. **Contraste**: el naranja como texto chico ("ACEPTABLE", puntajes) da 3,44:1 y el rojo 4,03:1; el mínimo es 4,5:1. Corregido en `tokens.css`.
2. **Botón "Continuar escenario"** de la banda recomendada: texto azul sobre fondo azul, prácticamente invisible (~1,3:1). Tiene que ser un botón claro (`card`) con texto `blueprint`.
3. **Borde del casillero vacío**: 1,43:1, no alcanza el 3:1 de un límite de componente. Usar `--slot-border`.
4. **Etiquetas de paso sobre los nodos**: en el juego, los círculos 2 y 4 tapan contenido de los casilleros. Las etiquetas de arista se ubican en el tramo libre de la arista o se desplazan si colisionan con un nodo.
5. **Casilleros fuera de su grupo**: los casilleros de la derecha cruzan el borde de las AZ. En el renderer real, un nodo dentro de un grupo no lo excede (lo valida L007).
6. **Umbral de rango**: el perfil dice "1.840 de 2.500 XP para Arquitecto", pero `game-rules.yaml` define Arquitecto en 5.000. El dato sale siempre de `game-rules.yaml`.
7. **Ícono de tarjeta**: todas las tarjetas de escenario usan la misma nube. Usar el ícono del área principal o nada.
8. **Etiqueta "Pistas 0/..."** cortada en el casillero naranja: el texto no debe desbordar el ancho del nodo.
9. **Onboarding — textos de experiencia**: el prototipo dice "Uso la nube"; el RF-ONB-02 dice "Uso AWS". Las cuatro opciones y los niveles que desbloquea cada una salen de `game-rules.yaml` + i18n, no del componente.
10. **Onboarding — "1 de 2"**: no está definido cuál es el paso 2. Propuesta: el tutorial del escenario 100 (RF-ONB-04), salteable. Si no, el indicador se quita.
11. **Onboarding — áreas**: la lista sale de `content/areas.yaml`, no está fija en el componente. "Ver mi ruta" queda deshabilitado hasta elegir al menos un área y una experiencia.
12. **Onboarding — semántica**: las áreas son un grupo de toggles (`aria-pressed`) y la experiencia es un `radiogroup` (RadioGroup de shadcn), navegable con flechas. El estado seleccionado ya se indica con ícono además de color, y eso se mantiene.
13. **Objetivos en el feedback**: el prototipo decide qué objetivos mostrar buscando palabras clave en el texto. En el juego real salen de las referencias por id de cada respuesta en `scenario.yaml` (`objectives` de la respuesta), evaluadas por `game-engine`.
14. **Puntaje vs. XP**: el prototipo aplica el multiplicador de nivel al puntaje y además muestra "PUNTAJE NaN". Regla correcta (RF-SCO): el **puntaje** por casillero no lleva multiplicador (máx. 100; −15 por pista, mínimo 0) y la **XP** del escenario es Σ puntos × multiplicador. Todo lo calcula `game-engine`; la UI solo lo muestra.
15. **Grupos superpuestos**: "Ingreso" se mete dentro de "Procesamiento por eventos", su borde tapa la etiqueta "NUBE" y el casillero de EC2 cruza su borde (capturas 06 y 07). Grupos hermanos no se superponen y los nodos quedan adentro con margen (L007).
16. **Resumen estático**: puntaje (1.240 / 1.500), XP (+320) y la insignia son fijos. El máximo real depende de los casilleros y la regla del punto 14. La insignia es F4: en F1 el resumen muestra XP ganada y, si corresponde, subida de rango y nivel desbloqueado (RF-GAM-10).
17. **Resumen — título**: "¡Arquitectura publicada!" no describe lo que pasó. Usar "Escenario completado" o similar.
18. **Resumen — repaso incompleto**: RF-PLAY-09 pide, por casillero, **qué eligió el jugador y con qué resultado**, la explicación de la óptima y **enlaces a documentación oficial**. El prototipo solo muestra la óptima, sin la elección del jugador ni enlaces.
19. **Resumen — layout del repaso**: el texto de cada tarjeta flota con un hueco variable y la etiqueta "ÓPTIMO" cae debajo del número. Grilla fija: número · ícono · texto (1fr) · estado.
20. **"Reportar un problema en este escenario"** (RF-PLAY-13) no aparece en ninguna pantalla. Va en el resumen y en el menú de la pantalla de juego.
21. **Juego v2 — metas con ✓**: en el brief y en "Ver caso", las metas llevan el mismo check que el feedback usa para "cumple", y parecen ya cumplidas. En listas del caso, ícono neutro (◎ objetivo); el ✓ queda solo para el feedback.
22. **Juego v2 — modo foco**: hay un botón circular con X que se superpone a la barra flotante y tapa el diagrama (captura 15). Sobra: la salida es "Salir del foco" en la barra.
23. **Juego v2 — "Ver caso" oscurece el tablero**: el objetivo es releer el caso mirando el diagrama. Sin fondo oscuro, o uno muy leve; el tablero no queda bloqueado.
24. **Juego v2 — la tarjeta de feedback tapa casilleros** (captura 17: cubre la parte baja de "Región principal"). La tarjeta es compacta (alto máximo, sin espacio vacío); nunca tapa el casillero al que se refiere, y si taparía otros, el tablero se desplaza o la tarjeta se ubica donde no los cubra.
25. **Juego v2 — etiqueta "NUBE"** tapada por el borde de "Región global" (capturas 13–17): mismo caso que el punto 15.
26. **Juego v2 — explicación genérica**: la tarjeta de la captura 17 dice "Este servicio no cumple el rol solicitado…". El texto real para servicios no declarados es el de docs/03 §2 ("<descripción corta>. No cumple el rol: <rol>"), que ya compone la UI.

27. **Juego — zoom máximo**: el prototipo limita el zoom del tablero a 125 %. Para personas con baja visión hace falta más: el zoom del tablero llega **al menos a 300 %**, en pasos de 25 %, y también con Ctrl + rueda o pellizco.
28. **Tamaños de texto mínimos** (el prototipo usa .55–.72rem, 9–11,5 px, ilegibles para mucha gente):
    - Todo el texto de la interfaz fuera del tablero se define en `rem` (nunca en `px`) y respeta el tamaño de letra configurado en el navegador.
    - Mínimos a tamaño de letra por defecto: **16 px (1rem)** para explicaciones, contexto y textos de lectura; **14 px (0,875rem)** para etiquetas, objetivos, metadatos y botones. Nada por debajo de 12 px, y 12 px solo para contadores muy secundarios (por ejemplo, "Pistas 0/2").
    - Dentro del tablero el texto escala con el zoom; a 100 %, el rol del casillero no baja de 13 px.
    - La página tiene que seguir usable con el zoom del navegador al 200 % (WCAG 1.4.4) y sin scroll horizontal a 320 px de ancho CSS fuera del tablero (WCAG 1.4.10).
29. **Juego — desplazamiento del tablero (pan)**: en el prototipo v2 el tablero no se puede mover, así que con zoom no se llega a las partes que quedan fuera de la vista. El tablero se desplaza siempre, a cualquier zoom:
    - arrastrando el fondo con el mouse (el cursor cambia a "mano");
    - con la rueda o el gesto de dos dedos del trackpad (vertical y, con Shift, horizontal); el zoom queda para Ctrl + rueda o pellizco;
    - con las flechas del teclado cuando el tablero tiene el foco;
    - al enfocar un casillero con Tab, el tablero se desplaza para dejarlo visible.
    Arrastrar un servicio desde la paleta no mueve el tablero. Un control "ajustar a pantalla" vuelve a la vista completa.
