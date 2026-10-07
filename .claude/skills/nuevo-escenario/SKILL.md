---
name: nuevo-escenario
description: Genera o edita un escenario del juego en content/scenarios/<id>/scenario.yaml a partir de un caso de uso, respetando el schema, el catálogo y las reglas de lint. Usar cuando pidan "crear un escenario", "nuevo caso de uso", "generar escenario de nivel N".
---

# Crear un escenario

Mismo resultado que el Studio con IA, pero desde Claude Code.

## Entradas a pedir si faltan
- Caso de uso (1–3 frases), **nivel** (0/100/200/300/400), **áreas** (de `content/areas.yaml`).
- Objetivos que el usuario ya tenga en mente (costo, tráfico, operación, seguridad, etc.).

## Pasos
1. Leé `docs/03-modelo-de-escenarios.md`, `content/scenarios/_templates/scenario.template.yaml` y el ejemplo `content/scenarios/serverless-pdf-processing/scenario.yaml`.
2. Leé `content/catalog/services.yaml` y `confusion-groups.yaml`. **Solo podés usar ids que existan en el catálogo.** Si falta un servicio, frená y proponé agregarlo al catálogo en un PR aparte.
3. Escribí primero los **objetivos** (2–5; al menos uno `hard` desde el nivel 200). Todo lo demás se justifica contra ellos.
4. Diseñá los casilleros según el rango de L009 para el nivel. Para cada uno:
   - `role` que describa la función **sin nombrar el servicio** (revisá los `leakPatterns` del catálogo).
   - ≥ 1 `optimal` con `rationale` vinculada a objetivos y `references` a docs.aws.amazon.com.
   - `acceptable` solo si realmente funciona y pierde contra un objetivo `soft`. Sus `objectives` son esas metas que cumple a medias, solo `soft` (L020); en un `optimal`, `objectives` son los que cumple.
   - `incorrect` tomados de los grupos de confusión, con `violates` cuando rompen una restricción `hard`.
   - 1–3 `hints`, de lo general a lo específico.
5. Aristas numeradas que cuenten el flujo de datos de punta a punta.
6. Posiciones: usá una grilla de ~260 px en X y ~150 px en Y; el Studio puede reordenar después con auto-layout.
7. `status: draft`, `version: 1`, `authors` con el usuario de `git config user.name`.
8. Ejecutá `pnpm content:validate -- <id>` y corregí hasta que no haya errores. Después `pnpm content:gen`.
9. **Autorevisión crítica** (en un mensaje aparte, antes de terminar): ¿algún `acceptable` debería ser `optimal` o viceversa según los objetivos? ¿Hay datos de servicios de AWS que no puedas respaldar con documentación? Marcalos con `TODO(verificar)` en `notes.md`.
10. Creá `notes.md` con la intención pedagógica y las decisiones de calibración discutibles.

## Nivel 0 («La nube en la vida real», ADR-0027)
Una situación cotidiana (una panadería, un club, una escuela) donde cada casillero es un rol de la vida real y se completa con un **concepto** o un servicio del catálogo.
- **3–5 casilleros** (L009) y área `fundamentos`, más 1 o 2 áreas técnicas cuando aplique.
- **Paleta `curated` de hasta 8 tarjetas** (`maxSizeByLevel` en `game-rules.yaml`): las 3–5 respuestas y al menos 3 distractores (L016). Contá la paleta resuelta antes de sumar `incorrect` o `palette.extra`: los compañeros de grupo de confusión también entran.
- **`plainName`**: toda entrada de la paleta resuelta y de los nodos `fixed` necesita su nombre simple en el catálogo (L022). Se agrega en `content/catalog/services.yaml`, no en el escenario: cotidiano, ≤ 40 caracteres y sin repetir otro (C013). Listá cada `plainName` nuevo en el PR para que lo revise el mantenedor.
- **`analogyLimit` obligatorio** en toda respuesta `optimal` y `acceptable` (L021): dónde se rompe la analogía, ≤ 300 caracteres, con ≥ 1 referencia oficial (`docs.aws.amazon.com` o `aws.amazon.com`).
- **L005 por frase completa**: en el nivel 0, ningún `title`, `summary`, `context`, objetivo, `role`, pista ni etiqueta puede contener el `plainName` completo de una entrada del escenario (sin distinguir mayúsculas ni tildes). Las palabras sueltas sí se pueden usar.
- La `rationale` y el `analogyLimit` se muestran después de colocar: no nombran otros servicios ni conceptos ocultos, tampoco por su `plainName`.
- **Revisión humana (RF-CNT-09)**: toda analogía (la `rationale` y el `analogyLimit` de cada respuesta) la revisa una persona contra la referencia oficial antes de `published`. No cambies el sentido de una analogía ya revisada: si no entra o choca con el lint, frená y proponé.
- Conceptos: solo los que existen en el catálogo (`type: concept`). Si falta uno, proponelo en un PR de catálogo con su fuente oficial (C012), su categoría `concept-…` (C011) y su grupo de confusión.

## No hacer
- No marques `published`.
- No inventes límites, precios ni capacidades de servicios. Ante la duda, `TODO(verificar)`.
- No edites `diagram.mmd` ni `README.md` a mano.

## Al abrir el PR
Los PR de escenarios siguen `.github/PULL_REQUEST_TEMPLATE/nuevo-escenario.md`: el cuerpo se arma copiando la plantilla sección por sección en un archivo y se pasa con `gh pr create --body-file` (gh no combina `--template` con `--body-file`). Desde la web, se puede usar `?template=nuevo-escenario.md`. Completá el checklist y, en el nivel 0, la sección «Solo nivel 0».
