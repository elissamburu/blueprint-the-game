---
name: nuevo-escenario
description: Genera o edita un escenario del juego en content/scenarios/<id>/scenario.yaml a partir de un caso de uso, respetando el schema, el catálogo y las reglas de lint. Usar cuando pidan "crear un escenario", "nuevo caso de uso", "generar escenario de nivel N".
---

# Crear un escenario

Mismo resultado que el Studio con IA, pero desde Claude Code.

## Entradas a pedir si faltan
- Caso de uso (1–3 frases), **nivel** (100/200/300/400), **áreas** (de `content/areas.yaml`).
- Objetivos que el usuario ya tenga en mente (costo, tráfico, operación, seguridad, etc.).

## Pasos
1. Leé `docs/03-modelo-de-escenarios.md`, `content/scenarios/_templates/scenario.template.yaml` y el ejemplo `content/scenarios/serverless-pdf-processing/scenario.yaml`.
2. Leé `content/catalog/services.yaml` y `confusion-groups.yaml`. **Solo podés usar ids que existan en el catálogo.** Si falta un servicio, frená y proponé agregarlo al catálogo en un PR aparte.
3. Escribí primero los **objetivos** (2–5; al menos uno `hard` desde el nivel 200). Todo lo demás se justifica contra ellos.
4. Diseñá los casilleros según el rango de L009 para el nivel. Para cada uno:
   - `role` que describa la función **sin nombrar el servicio** (revisá los `leakPatterns` del catálogo).
   - ≥ 1 `optimal` con `rationale` vinculada a objetivos y `references` a docs.aws.amazon.com.
   - `acceptable` solo si realmente funciona y pierde contra un objetivo `soft`.
   - `incorrect` tomados de los grupos de confusión, con `violates` cuando rompen una restricción `hard`.
   - 1–3 `hints`, de lo general a lo específico.
5. Aristas numeradas que cuenten el flujo de datos de punta a punta.
6. Posiciones: usá una grilla de ~260 px en X y ~150 px en Y; el Studio puede reordenar después con auto-layout.
7. `status: draft`, `version: 1`, `authors` con el usuario de `git config user.name`.
8. Ejecutá `pnpm content:validate -- <id>` y corregí hasta que no haya errores. Después `pnpm content:gen`.
9. **Autorevisión crítica** (en un mensaje aparte, antes de terminar): ¿algún `acceptable` debería ser `optimal` o viceversa según los objetivos? ¿Hay datos de servicios de AWS que no puedas respaldar con documentación? Marcalos con `TODO(verificar)` en `notes.md`.
10. Creá `notes.md` con la intención pedagógica y las decisiones de calibración discutibles.

## No hacer
- No marques `published`.
- No inventes límites, precios ni capacidades de servicios. Ante la duda, `TODO(verificar)`.
- No edites `diagram.mmd` ni `README.md` a mano.
