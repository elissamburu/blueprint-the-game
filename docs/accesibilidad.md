# Accesibilidad

> Estado de este documento: **borrador v0.1** · Aplica a: juego (`apps/web`), Studio (`apps/studio`) y toda página pública del sitio.

## 1. Objetivo

Todo el sitio cumple **[WCAG 2.2](https://www.w3.org/TR/WCAG22/) nivel AA** ([referencia rápida](https://www.w3.org/WAI/WCAG22/quickref/)). La accesibilidad es un requisito de producto, no una fase ([00 · Visión, §6](00-vision-y-alcance.md#6-principios-de-diseño)): cada RF se considera terminado solo si cumple este documento. F6 hace la auditoría completa, pero no es el momento en que "se agrega" la accesibilidad.

El objetivo reemplaza a WCAG 2.1 AA en [RNF-02](02-requerimientos-no-funcionales.md). WCAG 2.2 es compatible hacia atrás con 2.1 salvo por 4.1.1 (Parsing), que quedó obsoleto ([What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)).

## 2. Baja visión

| Tema | Regla en el proyecto | Criterio WCAG |
|---|---|---|
| Contraste de texto | ≥ 4,5:1 (≥ 3:1 para texto grande). Ya está resuelto en los tokens: [tokens.css](design/tokens.css) documenta los contrastes medidos y los ajustes ([ADR-0021](adr/0021-ui-shadcn-tailwind-y-referencia-visual.md)). Un token nuevo usado como texto lleva su contraste medido en ese archivo. | [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Contraste de componentes | Bordes y estados de controles interactivos (casilleros, botones, campos, foco) ≥ 3:1 contra el fondo adyacente. El borde del casillero vacío usa `--slot-border`, no `--border`. | [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Nunca solo color | Verde/naranja/rojo siempre llevan además ícono y texto (✓ / ~ / ✗ y el nombre del grado). Lo mismo para restricciones vs. metas, estados de escenarios y validaciones del Studio. | [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) |
| Zoom 400 % | A 1280 px de ancho con zoom 400 % (equivale a 320 px CSS) no hay scroll horizontal en el contenido. El diagrama es la excepción que el criterio admite (contenido que requiere dos dimensiones), pero tiene que haber una alternativa sin ese scroll: el modo texto ([ADR-0022](adr/0022-modo-texto.md)). | [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Texto al 200 % | El texto se puede agrandar al 200 % sin perder contenido ni funciones: nada de alturas fijas que recorten texto. Fuera del tablero vale tanto con el zoom del navegador como agrandando solo el tamaño de letra. Dentro del tablero el texto crece con el zoom del navegador y con el zoom del tablero, pero no con el tamaño de letra; para ese caso está el modo texto (ver "Tamaños en `rem`"). | [1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) |
| Espaciado de texto | La interfaz no se rompe si el usuario fuerza interlineado 1,5, espacio entre párrafos 2×, entre letras 0,12 em y entre palabras 0,16 em. | [1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) |
| Tamaños en `rem` | Tipografía, espaciados y tamaños de controles en `rem` (o `em`), no en `px`, para que respeten el tamaño de fuente elegido en el navegador: paneles, barras, feedback, paleta, diálogos y toda página fuera del juego. `px` solo para bordes finos. **Excepción: el texto dentro del tablero** (etiquetas de nodos y grupos, roles de casilleros, pasos y etiquetas de aristas) va en `px` a propósito, porque forma parte de la geometría del diagrama y escala con el zoom propio del tablero (hasta 300 % como mínimo), además del zoom del navegador. Así lo define el layout v2 ([referencia visual, problemas 27–29](design/README.md#problemas-detectados-para-resolver-al-implementar)). Quien necesita texto grande sin depender del zoom del tablero (por ejemplo, con un tamaño de letra del navegador agrandado) usa el **modo texto** ([ADR-0022](adr/0022-modo-texto.md)), que está todo en `rem`. | Soporte de 1.4.4 |
| Foco visible | Todo elemento enfocable muestra un indicador de foco con contraste 3:1, y el elemento con foco no queda tapado por paneles, barras fijas ni la paleta. | [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Feedback cerca de la acción | Quien usa lupa ve una porción chica de la pantalla. El resultado de una acción (grado del casillero, explicación, error de validación) aparece **junto al elemento donde se actuó**, no solo en un toast en una esquina. Si además hay un aviso global, es redundante, no el único canal. | Buena práctica ([Magnifier](https://support.microsoft.com/help/11542/windows-use-magnifier)); ver también [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) |
| Contenido al pasar el mouse | Las descripciones de la paleta (RF-PAL-03) se pueden cerrar con Esc sin mover el puntero, no desaparecen al pasar el puntero sobre ellas y quedan visibles hasta que el usuario las cierra o saca el foco. | [1.4.13 Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) |

## 3. Preferencias del sistema

El sitio lee las preferencias del sistema operativo y del navegador con media queries de [Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/). No hay un interruptor propio que las reemplace.

- **[`prefers-contrast`](https://www.w3.org/TR/mediaqueries-5/#prefers-contrast)**: con `more`, los tokens suben el contraste (bordes más oscuros, sin grises suaves en texto secundario). Se define como variante de los tokens, no componente por componente.
- **[`forced-colors`](https://www.w3.org/TR/mediaqueries-5/#forced-colors)** (modo de contraste de Windows; [temas de contraste](https://learn.microsoft.com/windows/apps/design/accessibility/high-contrast-themes)): el navegador reemplaza los colores por una paleta reducida del sistema, así que **el estado de un casillero no puede depender solo del fondo ni del color del borde**. Cada estado (vacío, seleccionado, óptimo, aceptable, incorrecto, revelado) se distingue también por ícono, texto y estilo del borde (punteado / continuo / doble). Los íconos SVG usan `currentColor` para seguir la paleta del sistema. No se usa `forced-color-adjust: none` salvo en los íconos de servicios, que son marcas y necesitan sus colores.
- **[`prefers-reduced-motion`](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion)**: con `reduce`, **toda animación tiene una alternativa sin movimiento** (cambio instantáneo o fundido corto). Aplica al reproductor de flujo (RF-PLAY-03), a las microinteracciones (RF-PLAY-17) y a las transiciones de paneles. El reproductor de flujo sigue funcionando: resalta el paso actual sin animar el recorrido. Ninguna animación dura más de 5 s sin forma de pausarla ([2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).

## 4. Decisión: sin lupa ni widget de accesibilidad propios

**No se construye** una lupa, un control de tamaño de letra, un "modo alto contraste" propio ni ningún widget o *overlay* de accesibilidad. El sitio funciona con las herramientas que la persona ya usa: la lupa del sistema operativo, el zoom del navegador, el modo de contraste del sistema y los lectores de pantalla.

Motivos:
- Quien necesita estas ayudas ya las tiene configuradas en su sistema; un widget propio duplica funciones, choca con esas herramientas y hay que aprenderlo sitio por sitio.
- Los overlays no hacen que un sitio cumpla WCAG y suelen empeorar la experiencia de quienes usan tecnología de apoyo ([Overlay Fact Sheet](https://overlayfactsheet.com/)).
- El esfuerzo va a cumplir los criterios de este documento, que es lo que hace funcionar esas herramientas.

## 5. Lectores de pantalla

- El sitio **no "habla" por su cuenta**: no reproduce audio ni síntesis de voz automáticamente. El lector de pantalla del usuario lee la estructura (encabezados, listas, controles con nombre, regiones `aria-live`).
- Los cambios de estado se anuncian con regiones vivas (`aria-live="polite"`, [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#aria-live)), sin duplicar el mismo anuncio por toast (ver RF-GAM-10).
- El diagrama tiene una representación equivalente navegable: el **modo texto** ([ADR-0022](adr/0022-modo-texto.md)).
- **Nombre accesible doble** (tarjetas del nivel 0, RF-PAL-06): la tarjeta muestra dos nombres apilados, el simple arriba y el real abajo, y se lee como uno solo, «Almacenamiento de archivos (Amazon S3)». El nombre real visible lleva `aria-hidden` y una copia `sr-only` con los paréntesis lo reemplaza: así el nombre es el mismo en todos los navegadores, sin depender de cómo cada uno separa elementos apilados. Cumple [2.5.3 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html): el nombre empieza con el texto visible. Donde el control ya tiene `aria-label` (paleta colapsada, casillero del tablero), ese texto es «nombre simple (nombre real)» y el tooltip de la paleta colapsada muestra exactamente el mismo. En papel (hojas de solución) los paréntesis son visibles.
- **Opcional, a futuro**: un botón "Escuchar el caso" que lea en voz alta el contexto y los objetivos con la [Web Speech API](https://webaudio.github.io/web-speech-api/) (`SpeechSynthesis`), pensado para personas con baja visión que no usan lector de pantalla. Solo se activa a pedido, se puede pausar y detener, y no se ofrece como reemplazo del lector. La especificación es un borrador de Community Group de W3C, así que el botón se muestra solo si el navegador la soporta. No tiene RF ni fase asignada.

## 6. Criterios ya cubiertos por el diseño

| Criterio | Cómo se cubre |
|---|---|
| [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) (AA, nuevo en 2.2) | Todo lo que se hace arrastrando se puede hacer con un clic o un toque (seleccionar casillero → elegir servicio) y con teclado. Todos los caminos emiten los mismos comandos del motor ([ADR-0008](adr/0008-interaccion-desacoplada.md), RF-PLAY-05). |
| [2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html) (A) | No hay límites de tiempo: sin temporizadores de presión (principios de GAM en [01](01-requerimientos-funcionales.md#gam--gamificación)). El modo examen (RF-PLAY-12) tampoco tiene tiempo límite. |
| [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) (A) | Adaptador de teclado desde F1 ([ADR-0008](adr/0008-interaccion-desacoplada.md)). |

A revisar en cada pantalla nueva (fáciles de romper sin darse cuenta): [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) (objetivos de 24 × 24 px CSS como mínimo), [3.3.8 Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) (login de F4: permitir pegar contraseñas y gestores de contraseñas) y [3.2.6 Consistent Help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html) ("Reportar un problema" siempre en el mismo lugar relativo).

## 7. Protocolo de pruebas

**axe en CI no reemplaza las pruebas manuales.** Las herramientas automáticas detectan solo una parte de los problemas (contraste, nombres faltantes, ARIA mal formado); no pueden juzgar si el orden de lectura tiene sentido, si un anuncio es comprensible o si una tarea se puede completar ([W3C · Selecting Web Accessibility Evaluation Tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)).

### Automáticas (cada PR)
- axe (vía Playwright, [axe-core](https://github.com/dequelabs/axe-core)) en las pantallas principales; sin violaciones `critical` ni `serious`.

### Manuales (cada PR que cambia UI de forma visible, y completas antes de cerrar F1, F2 y F6)

Tarea de referencia: completar un escenario de nivel 200 de punta a punta (brief → colocar todos los servicios, con al menos un error y una pista → resumen).

| # | Prueba | Qué se verifica |
|---|---|---|
| 1 | **Solo teclado** (sin mouse) | Se completa la tarea; el foco es siempre visible y no queda tapado; el orden de Tab es lógico; no hay trampas de foco fuera de los diálogos modales; Esc cierra paneles y devuelve el foco. |
| 2 | **[NVDA](https://www.nvaccess.org/about-nvda/)** + Firefox o Chrome | Se completa la tarea en el modo texto; encabezados y listas navegables; cada control tiene nombre y estado; el grado y la explicación se anuncian una sola vez. |
| 3 | **[Narrador](https://support.microsoft.com/help/22798/)** + Edge | Igual que la prueba 2 (segundo lector, otro motor). |
| 4 | **Zoom del navegador al 400 %** (ventana de 1280 px) | Sin scroll horizontal en el contenido (el diagrama deriva al modo texto); texto al 200 % sin recortes; espaciado de texto forzado (1.4.12) sin superposiciones. |
| 5 | **[Lupa de Windows](https://support.microsoft.com/help/11542/windows-use-magnifier)** (200–400 %, seguimiento del foco) | El feedback de cada acción aparece cerca de donde se actuó; la lupa sigue el foco del teclado. |
| 6 | **Modo de contraste de Windows** ([temas de contraste](https://learn.microsoft.com/windows/apps/design/accessibility/high-contrast-themes); Alt izq. + Mayús izq. + ImpPant) | Cada estado de casillero se distingue sin color; íconos visibles; foco visible. |
| 7 | **`prefers-reduced-motion`** activado (Windows: Configuración → Accesibilidad → Efectos visuales → Efectos de animación desactivados) | Ninguna animación con movimiento; el reproductor de flujo sigue siendo usable. |

El resultado se deja en la descripción del PR: qué pruebas se corrieron, con qué versiones, y hallazgos abiertos.

### Con personas usuarias reales
Antes de cerrar F6 (y, si es posible, antes en F1), se prueba el juego con al menos una persona que use lector de pantalla y una persona con baja visión que use lupa o zoom en su día a día, con sus propios equipos y configuraciones. Las pruebas del equipo no reemplazan esta instancia ([W3C · Involving Users in Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/involving-users/)). Los hallazgos se registran como issues con la etiqueta `accesibilidad`.

## 8. Documentos relacionados
- [ADR-0008 · Interacción desacoplada](adr/0008-interaccion-desacoplada.md)
- [ADR-0021 · UI con shadcn/ui + Tailwind v4](adr/0021-ui-shadcn-tailwind-y-referencia-visual.md) (tokens y contraste)
- [ADR-0022 · Modo texto](adr/0022-modo-texto.md)
- [02 · RNF-02](02-requerimientos-no-funcionales.md)
