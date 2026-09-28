# 0018 · Gamificación con reglas declarativas

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
Las insignias, los rangos y los puntajes son el incentivo para seguir jugando y van a ajustarse muchas veces. Si cada insignia es código, cada idea nueva es un PR de programación y no de contenido.

## Decisión
- `content/game-rules.yaml`: puntajes, multiplicadores por nivel, umbrales de rango, reglas de desbloqueo, modos de paleta por nivel.
- `content/badges/badges.yaml`: insignias como datos, con un conjunto cerrado de **tipos de regla** implementados en `game-engine`:

```yaml
- id: primer-verde
  name: "Primer verde"
  description: "Completaste tu primer escenario."
  rule: { type: complete_count, count: 1 }
- id: serverless-300
  name: "Serverless 300"
  description: "Completaste 5 escenarios de nivel 300 del área serverless."
  rule: { type: complete_count, count: 5, level: 300, area: serverless }
- id: sin-red
  name: "Sin red"
  description: "Completaste un escenario de nivel 300 o más sin usar pistas."
  rule: { type: no_hints, minLevel: 300 }
- id: impecable
  name: "Impecable"
  description: "Completaste un escenario con todo verde al primer intento."
  rule: { type: perfect_scenario }          # todo verde al primer intento
- id: constancia-7
  name: "Constancia"
  description: "Jugaste 7 días seguidos."
  rule: { type: streak, days: 7 }
- id: maestro-redes
  name: "Maestro de redes"
  description: "Completaste en verde el 80 % de los escenarios de redes."
  secret: true
  rule: { type: area_mastery, area: networking, percent: 80 }
- id: nivel-200
  name: "Nivel 200 completo"
  description: "Completaste todos los escenarios publicados de nivel 200."
  rule: { type: level_complete, level: 200 }
```

- Tipos iniciales: `complete_count`, `perfect_scenario`, `no_hints`, `streak`, `area_mastery`, `level_complete`. Un tipo nuevo = PR de código + tests; una insignia nueva de un tipo existente = PR de contenido.
- La evaluación de insignias se ejecuta en el servidor tras cada intento (y en el cliente en modo invitado, con la misma función).
- **Principios**: nunca se quita XP ni insignias; las rachas tienen comodín; nada se compra.

## Alternativas consideradas
- **Insignias en código**: más flexible, pero cada idea requiere programar.
- **Motor de reglas genérico (JSONLogic, etc.)**: potente, pero difícil de validar y de explicar a contribuidores.

## Consecuencias
- La comunidad puede proponer insignias por PR de contenido.
- Si se cambian umbrales, las insignias ya otorgadas se conservan.

## Revisión 2026-09-28
Al implementar el schema de insignias en `packages/scenario-schema` se precisaron puntos que la versión original dejaba abiertos. La decisión de fondo (insignias declarativas con un conjunto cerrado de tipos) no cambia.

- **Se elimina `first_of_kind`**: no tenía semántica ni parámetros definidos. Si hace falta, se propone de nuevo como tipo nuevo (PR de código + tests), con su significado explícito.
- **`level_complete` toma `{ level }`** y significa completar todos los escenarios `published` de ese nivel existentes al momento de evaluar. Se otorga solo si existe **al menos un** escenario `published` de ese nivel: con cero escenarios la regla no se cumple (evita que una insignia se otorgue "gratis" para un nivel todavía vacío). La implementación va en `game-engine` (F1).
- **`description` es obligatoria** en todas las insignias; se completaron los ejemplos que no la tenían y se agregó uno de `level_complete`.
- **`secret` es opcional**, con valor por defecto `false`.

El formato completo quedó documentado en [03 §6](../03-modelo-de-escenarios.md#6-áreas-categorías-reglas-de-juego-e-insignias).
