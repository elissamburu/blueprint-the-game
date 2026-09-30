# 0023 · Contenido multiidioma

- Estado: Propuesto
- Fecha: 2026-09-30

## Contexto
[ADR-0017](0017-i18n.md) fija la UI con i18n desde el día 1 y el contenido en un solo idioma por escenario (`lang: es`) en v1, y deja anotado que traducir contenido requiere un ADR nuevo, "probablemente `locales/<lang>.yaml` por escenario, con los textos separados de la estructura". Este es ese ADR. **Extiende** al 0017, no lo reemplaza: en v1 el contenido sigue en un solo idioma.

El riesgo que motiva decidir ahora es el mantenimiento: cada recalibración de un escenario (grados, respuestas, rationales) tendría que replicarse en cada idioma, y una traducción vieja puede enseñar algo incorrecto (una rationale que justifica un grado que ya cambió). Lo que se decide hoy es el formato de destino y qué **no** hacer en v1 para no complicar la migración.

## Decisión

### Formato
```
content/scenarios/<id>/
├── scenario.yaml        # estructura + textos en el idioma original (lang)
└── locales/
    ├── en.yaml          # solo textos, en inglés
    └── pt.yaml
```

1. **El idioma original es la fuente de verdad.** `scenario.yaml` conserva sus textos inline en el idioma de `lang`, como hoy. No hay que migrar los escenarios existentes: una traducción es un archivo nuevo al lado.
2. **Una traducción solo tiene textos, nunca estructura.** `locales/<lang>.yaml` no puede cambiar ids, servicios, grados, objetivos vinculados, pasos, posiciones ni paleta. Cada texto se identifica por el **id estable** del elemento al que pertenece:
   ```yaml
   lang: en
   status: draft                  # draft | published (independiente del estado del escenario)
   translators: [{ github: usuario }]
   source:                        # contra qué versión del original se tradujo
     version: 3                   # = version del escenario
     textHash: "sha256:…"         # hash de todos los textos traducibles del original (lo calcula el CLI)
   title: "…"
   summary: "…"
   context: |
     …
   objectives:
     no-servers: "…"              # por objectives[].id
   groups:
     cloud: "…"                   # label, por groups[].id
   nodes:
     client: { label: "…" }
     upload-store:
       role: "…"
       hints: ["…", "…"]          # misma cantidad y orden que en el original
       answers:
         s3: "…"                  # rationale, por servicio (único por casillero, L008)
       incorrect:
         ebs: "…"
   edges:
     e1: { label: "…", description: "…" }
   ```
3. **Desactualización.** Una traducción está:
   - **al día** si `source.version` y `source.textHash` coinciden con el original;
   - **desactualizada en texto** si coincide `version` pero no `textHash` (cambiaron textos sin cambiar respuestas ni grados, algo que [L014](../03-modelo-de-escenarios.md#3-reglas-de-lint-semántico-packagescontent-lint) permite sin subir `version`): se sigue mostrando, con el aviso "Esta traducción puede estar desactualizada";
   - **obsoleta** si `source.version` < `version`: cambiaron respuestas, grados o condiciones de juego, así que sus rationales pueden justificar algo que ya no es cierto. **No se muestra**: el juego usa el original con el aviso "Este escenario todavía no está traducido a tu idioma".

   Actualizar una traducción es revisar los textos que cambiaron (el diff de git del original entre versiones) y regenerar `source` con el CLI.
4. **Idioma del contenido vs. idioma de la UI.** Son preferencias separadas: el jugador puede tener la UI en inglés y jugar un escenario en su original en español. El listado muestra en qué idiomas está disponible cada escenario. El progreso y el XP se asocian al `id` y la `version` del escenario, nunca al idioma.
5. **Qué valida el lint** (reglas nuevas, numeradas al implementarlas):
   - schema estricto del archivo de traducción: claves desconocidas son error (así no se cuela estructura);
   - toda clave referencia un id que existe en el original, y los `hints` tienen la misma cantidad;
   - claves faltantes: warning en `draft`, error en `published`;
   - **filtraciones (L005) también en el idioma de destino**, con los `leakPatterns` del catálogo más los patrones propios de ese idioma (el catálogo podrá declarar `leakPatterns` por idioma para traducciones de nombres comunes);
   - los mismos límites de longitud que el original (L013);
   - estado de desactualización (warning si está desactualizada en texto; error si está obsoleta y `published`), para que CI lo muestre en el PR que cambia el original.
6. **Archivos compartidos.** Las cadenas del catálogo (`name` no se traduce; `short` sí), las áreas y las insignias siguen el mismo patrón: `content/<carpeta>/locales/<lang>.yaml` con claves por id.
7. **Autoría.** Las traducciones se hacen por PR como cualquier contenido; el Studio podrá crearlas y editarlas (y la IA de F5 proponer un borrador), siempre escribiendo desde `apps/studio/server`.

### Qué se respeta desde ya (v1)
- Todo texto de contenido vive en el YAML, **nunca en el código**, y se identifica por un id estable. No se agregan listas de textos sin id salvo `hints` (ordenadas por diseño).
- No se construyen textos del contenido concatenando fragmentos en la UI (p. ej. `"El " + label + " envía…"`): la UI muestra textos completos del contenido o cadenas de i18n con parámetros.
- `lang` se mantiene obligatorio en cada escenario.
- No se usan textos como identificadores (ids en kebab-case, independientes del idioma).
- El bundle (`content:build`) expone los textos por id, de modo que agregar una capa de traducción no cambie la forma en que el juego los consume.

La implementación queda **fuera de v1** ([roadmap](../05-roadmap.md#fuera-de-v1-backlog)).

## Alternativas consideradas
- **Textos multilenguaje dentro de `scenario.yaml`** (`title: { es: …, en: … }`): ya descartado en ADR-0017; complica la autoría, ensucia los diffs y hace que cada PR de calibración toque todos los idiomas.
- **Un escenario completo por idioma** (copiar el YAML): duplica respuestas y grados; las copias divergen en la calibración.
- **Extraer también el original a `locales/es.yaml`**: más simétrico, pero obliga a migrar todos los escenarios y separa el texto de la estructura justo donde el autor necesita verlos juntos (rol, respuestas y rationale). Se puede revisar en un ADR futuro si el Studio lo hace transparente.
- **Traducción automática en tiempo de ejecución**: sin revisión humana ni control de filtraciones; puede revelar servicios ocultos o cambiar el sentido de una rationale.

## Consecuencias
- Traducir un escenario es agregar un archivo; no toca la estructura ni exige subir `version`.
- Una recalibración del original deja las traducciones obsoletas de forma explícita y visible en CI, en lugar de publicar rationales incorrectas.
- El lint crece (L005 por idioma, cobertura de claves, desactualización) y el catálogo necesita `leakPatterns` por idioma.
- `content:build` y el juego necesitan resolver idioma y fallback; el motor (`game-engine`) no cambia, porque evalúa ids y servicios, no textos.
