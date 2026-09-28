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
  rule: { type: complete_count, count: 5, level: 300, area: serverless }
- id: sin-red
  name: "Sin red"
  description: "Completaste un escenario de nivel 300 o más sin usar pistas."
  rule: { type: no_hints, minLevel: 300 }
- id: impecable
  name: "Impecable"
  rule: { type: perfect_scenario }          # todo verde al primer intento
- id: constancia-7
  name: "Constancia"
  rule: { type: streak, days: 7 }
- id: maestro-redes
  name: "Maestro de redes"
  secret: true
  rule: { type: area_mastery, area: networking, percent: 80 }
```

- Tipos iniciales: `complete_count`, `perfect_scenario`, `no_hints`, `streak`, `area_mastery`, `level_complete`, `first_of_kind`. Un tipo nuevo = PR de código + tests; una insignia nueva de un tipo existente = PR de contenido.
- La evaluación de insignias se ejecuta en el servidor tras cada intento (y en el cliente en modo invitado, con la misma función).
- **Principios**: nunca se quita XP ni insignias; las rachas tienen comodín; nada se compra.

## Alternativas consideradas
- **Insignias en código**: más flexible, pero cada idea requiere programar.
- **Motor de reglas genérico (JSONLogic, etc.)**: potente, pero difícil de validar y de explicar a contribuidores.

## Consecuencias
- La comunidad puede proponer insignias por PR de contenido.
- Si se cambian umbrales, las insignias ya otorgadas se conservan.
