# 0008 · Interacción desacoplada: comandos comunes para drag, tap y teclado

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
v1 arranca desktop-first (ver arquitecturas en mobile es incómodo), pero no queremos reescribir el juego cuando llegue mobile. Además, drag & drop solo no es accesible.

## Decisión
La partida se modela como una **máquina de estados** en `game-engine` que recibe comandos:

- `selectSlot(slotId)` · `placeService(slotId, serviceId)` · `acceptAcceptable(slotId)` · `useHint(slotId)` · `clearSlot(slotId)`

Los adaptadores de `apps/web/src/interaction/` traducen gestos a comandos:

| Adaptador | Gesto | Comandos |
|---|---|---|
| Drag (desktop) | soltar un servicio sobre un casillero | `placeService` |
| Tap (mobile, F6) | tocar casillero → bottom sheet con paleta → tocar servicio | `selectSlot` + `placeService` |
| Teclado (todos) | Tab al casillero, Enter, buscar, Enter | `selectSlot` + `placeService` |

El layout del juego es responsive desde F1 (diagrama + paneles colapsables); F6 agrega el bottom sheet, gestos y PWA.

## Alternativas consideradas
- **Drag en todos lados**: frustrante en pantallas chicas e inaccesible.
- **App mobile separada**: duplica esfuerzo.

## Consecuencias
- Mobile es "un adaptador más", no una reescritura.
- La partida es testeable sin DOM (tests del motor con secuencias de comandos).
