# 0024 · Comando `revealSolution`: ver la solución de un casillero o de todo el escenario

- Estado: Propuesto
- Fecha: 2026-09-30
- Extiende: [ADR-0008](0008-interaccion-desacoplada.md)

## Contexto
RF-PLAY-14 pide que el jugador pueda ver la solución de un casillero ("Ver solución de este casillero") o de todos los pendientes ("Ver solución completa") cuando se traba, siempre con un aviso previo que invita a usar las pistas. Sus criterios de aceptación fijan las reglas:

- el casillero revelado muestra el óptimo, su explicación, los objetivos que cumple y las referencias, igual que un verde, pero marcado como "Solución vista";
- da **0 puntos** (tabla de puntaje de EVAL) y no cuenta como verde al primer intento ni para `perfect_scenario` o `no_hints`;
- con casilleros revelados el escenario **se puede completar y cuenta como completado** (listado, desbloqueos de RF-NAV-03, `complete_count`), pero **no "en verde"**;
- mostrar la solución **nunca resta** XP ni progreso y **nunca baja el mejor resultado** guardado;
- la decisión la toma `game-engine` con un comando nuevo, que se suma a los de [ADR-0008](0008-interaccion-desacoplada.md) con un ADR propio.

ADR-0008 modela la partida como una máquina de estados que recibe `selectSlot`, `placeService`, `acceptAcceptable`, `useHint` y `clearSlot`; los adaptadores (drag, toque, teclado y, en F6, el modo texto de [ADR-0022](0022-modo-texto.md)) solo traducen gestos a esos comandos. Revelar cambia el estado de la partida y el puntaje, así que no puede resolverse en la UI.

## Decisión
Se agrega a la máquina de estados de `game-engine` el comando:

- `revealSolution(slotId)` · revela un casillero.
- `revealSolution(null)` · revela **todos los casilleros sin resolver** en un solo paso ("Ver solución completa").

Reglas del motor:

1. **Qué se revela.** El casillero pasa a tener colocado su primer servicio `optimal` (en el orden del escenario; el lint L003 garantiza que exista), con la evaluación de ese servicio (explicación, objetivos y referencias). Si el casillero tiene más de un óptimo, la UI nombra los demás ("También es óptimo: …") en la explicación y en el resumen. Queda con el estado nuevo `revealed` y bloqueado como un verde: `placeService`, `useHint`, `clearSlot`, `acceptAcceptable` y un nuevo `revealSolution` sobre él se rechazan (`slot-locked`).
2. **Cuándo se puede.** Sobre un casillero vacío, rojo o naranja sin aceptar. Sobre uno ya resuelto (verde, naranja aceptado o ya revelado) se rechaza y **no cambia nada**. Con la partida completada se rechaza como cualquier comando (`session-completed`). Si el casillero revelado era el seleccionado, la selección se libera.
3. **Historia.** Se conservan los errores, los intentos y las pistas que el casillero ya tenía: el resumen los muestra, aunque no cambian su puntaje.
4. **Completar.** Un casillero revelado cuenta como resuelto: la partida se completa cuando todos los casilleros son verdes, naranjas aceptados o revelados.
5. **Puntaje.** Un casillero revelado vale `scoring.revealedSolution` de `game-rules.yaml`, que hoy es **0**, como el resto del puntaje. El schema de reglas exige que no sea negativo (mostrar la solución nunca resta) ni mayor que `acceptedAcceptable` o que `greenAfterErrors.min` (mirar la solución nunca paga más que resolver el casillero). Las pistas usadas antes se restan como en cualquier casillero, sin bajar de 0. Nunca es "verde al primer intento", así que el escenario no es `perfect`. El resultado (`ScenarioResult`) informa cuántas soluciones se vieron (`solutionsViewed`) y cada `SlotResult` si fue revelado (`revealed`).
6. **Progreso.** `applyScenarioResult` trata el resultado como completado (guarda el mejor resultado, abre los niveles de RF-NAV-03), pero con `allOptimal = false`: en el listado figura como completado, no como completado en verde. Nunca se resta XP ni se reemplaza un mejor resultado por uno menor (regla ya vigente de RF-PLAY-10), y un mejor resultado nuevo con soluciones vistas **no le quita** a un escenario el "completado en verde" que ya tenía.

El resultado del comando es `solutionRevealed` con los casilleros revelados y el servicio que muestra cada uno, en el orden del diagrama, para que la UI anuncie una sola vez qué cambió.

La UI (menú "⋯" del juego, y el modo texto cuando exista) solo pregunta al motor si el comando se puede aplicar (`canApply`) para habilitar la opción, muestra el aviso previo y emite el comando; no decide qué se revela ni cuánto vale.

## Alternativas consideradas
- **Revelar en la UI (mostrar el óptimo sin tocar la sesión)**: el puntaje, el "completado" y el progreso quedarían fuera del motor, y cada adaptador (tablero, modo texto, servidor en F4) tendría que repetir las reglas. Contradice ADR-0008 y la regla de que la evaluación vive solo en `game-engine`.
- **Revelar como `placeService` del óptimo**: el casillero quedaría verde y sumaría puntos, y no se podría distinguir en el resumen, el listado ni las insignias.
- **Dos comandos (`revealSlot` y `revealAll`)**: la regla es la misma; un solo comando con `null` para "todos" sigue el patrón de `selectSlot(null)` y evita duplicar validaciones.
- **Un 0 fijo en el motor**: el valor quedaría fuera de `game-rules.yaml`, donde viven todos los demás números del puntaje (RF-EVAL-05). Los riesgos de hacerlo configurable (restar puntos o premiar mirar la solución) los cubre la validación del schema.
- **Que ver la solución no permita completar el escenario**: deja al jugador trabado sin salida, que es justo lo que el requisito quiere evitar.

## Consecuencias
- Los comandos de la partida pasan a ser `selectSlot`, `placeService`, `acceptAcceptable`, `useHint`, `clearSlot` y `revealSolution`. Todo adaptador nuevo (modo texto de ADR-0022, bottom sheet de F6) ofrece también "ver solución" emitiendo este comando.
- `SlotStatus` suma el estado `revealed` y el tablero lo dibuja como "Solución vista": ícono y texto propios, color blueprint (no el verde de acierto) y borde doble, para que se distinga sin color y en modo de contraste ([accesibilidad §3](../accesibilidad.md#3-preferencias-del-sistema)).
- La re-evaluación en el servidor (RF-EVAL-06, F4) tiene que aceptar este comando en la secuencia del intento y aplicar las mismas reglas; como vive en el motor compartido, no hay lógica que duplicar.
- Las insignias de F4 (`perfect_scenario`, `no_hints`, `area_mastery`) leen `revealed` / `solutionsViewed` del resultado para no contar un casillero revelado como verde.
- Guardar el progreso no cambia de formato: `allOptimal` ya existía y ahora también es falso con soluciones vistas.

## Referencias
- [01 · RF-PLAY-14 y su CA](../01-requerimientos-funcionales.md#play--jugar-un-escenario)
- [01 · Reglas de puntaje](../01-requerimientos-funcionales.md#eval--evaluación-y-feedback)
- [ADR-0008 · Interacción desacoplada](0008-interaccion-desacoplada.md)
- [ADR-0022 · Modo texto](0022-modo-texto.md)
