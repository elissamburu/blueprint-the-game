# 0013 · Scenario Studio local-first con IA enchufable

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
El juego vive de su contenido. Escribir YAML a mano no escala. Queremos una UI donde describir un caso de uso, generarlo con IA, **verlo y jugarlo**, ajustarlo y terminar en un PR. Un endpoint público de generación con IA tendría costo y riesgo de abuso.

## Decisión
- **`apps/studio`** es una app incluida en el repo que corre **localmente** (`pnpm studio`): UI React + servidor Node (Hono) que escucha solo en `127.0.0.1`.
- Reutiliza `packages/diagram`, `game-engine`, `scenario-schema` y `content-lint`: **el preview es exactamente el juego**.
- El servidor lee y escribe `content/scenarios/` del clon local, valida en vivo y puede crear la rama, el commit (`-s`) y el PR con `gh`.
- **IA** en `packages/ai-generator`, detrás de la interfaz `LlmProvider`:
  - `bedrock` (default): Amazon Bedrock con las credenciales del perfil local de AWS del contribuidor (`AWS_PROFILE`), modelo configurable (`AI_MODEL_ID`).
  - `anthropic`: Anthropic API con `ANTHROPIC_API_KEY`.
- **Pipeline de generación**:
  1. *Generate*: salida estructurada forzando una herramienta cuyo `input_schema` es el JSON Schema del escenario, con `service` restringido a un enum de ids del catálogo (acotado a las categorías relevantes para no inflar el prompt).
  2. *Validate*: schema + lint locales.
  3. *Repair*: si hay errores, se reenvían al modelo (máx. `AI_MAX_REPAIR`, default 3).
  4. *Layout*: auto-layout con elkjs (la IA no calcula coordenadas finas).
  5. *Critique*: segunda llamada independiente que revisa calibración vs objetivos, filtraciones, distractores y claridad; devuelve observaciones para el humano (no modifica sola).
  6. *Human in the loop*: el autor edita, juega el preview y decide.
- La skill de Claude Code `nuevo-escenario` sigue las mismas reglas y termina en el mismo `content:validate`.

## Alternativas consideradas
- **Generador como CLI solamente**: rápido de hacer, pero sin el ciclo ver → jugar → ajustar que hace falta para calibrar.
- **Studio hosteado público**: costo de IA, abuso, autenticación y moderación; queda para después, con presupuesto y autenticación.
- **Generación en GitHub Actions** (`workflow_dispatch`): sin preview interactivo; útil como complemento futuro.

## Consecuencias
- Cada contribuidor usa su propia cuenta/clave de IA (el costo no recae en el proyecto).
- Sin credenciales de IA, el Studio funciona igual en modo manual.
- El modelo es flojo justamente en calibrar óptimo vs aceptable: por eso la revisión crítica y la revisión humana son obligatorias antes de `published`.
