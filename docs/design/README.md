# Referencia visual

Capturas y tokens del prototipo hecho en Lovable (28/09/2026). Es **referencia visual, no código**: la implementación vive en `packages/ui` y `apps/web` con shadcn/ui + Tailwind ([ADR-0021](../adr/0021-ui-shadcn-tailwind-y-referencia-visual.md)).

## Qué hay acá

| Archivo | Qué es |
|---|---|
| [tokens.css](tokens.css) | Tokens listos para `packages/ui` (formato shadcn + Tailwind v4, OKLCH). Incluye ajustes de contraste respecto del prototipo. |
| [lovable-styles.css.txt](lovable-styles.css.txt) | CSS original del prototipo, sin tocar. Sirve para consultar medidas y espaciados. **No se copia**: usa clases propias en lugar de utilidades y componentes. |
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

## Qué se toma y qué no

**Se toma**
- Paleta, tipografía (Manrope), radios y el formato de tokens.
- Layout de juego en tres columnas (caso · tablero · paleta) y el patrón de estados del casillero (borde y fondo suave por color, etiqueta arriba, "Ver pista (−15 pts)" abajo).
- Separación visual entre **Restricciones** (duras) y **Metas** (blandas) en el panel del caso (RF-PLAY-01).
- Paleta agrupada por categoría con buscador; tira de pasos del flujo debajo del tablero (RF-PLAY-03).
- **Pantalla de juego a alto fijo**: sin scroll de página; el tablero se desplaza por dentro y el panel de feedback queda **anclado al pie de la columna central, siempre visible** (`aria-live="polite"`). Con el panel vacío se muestra "Colocá un servicio para ver la explicación".
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
