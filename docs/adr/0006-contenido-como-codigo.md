# 0006 · Escenarios como contenido versionado en el repo

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
Queremos que la comunidad contribuya escenarios con revisión, historial y atribución, y que un fork tenga todo el contenido sin migrar datos.

## Decisión
- Escenarios, catálogo, insignias y reglas de juego viven como **YAML en `content/`** (ver [03](../03-modelo-de-escenarios.md)).
- Contribuir = PR, validado en CI por schema + lint semántico.
- `content:build` genera un **bundle JSON** inmutable por versión (`<id>.v<version>.json` + `index.json`) que se publica en S3/CloudFront junto a la web.
- La base de datos guarda **solo** usuarios, progreso, insignias y métricas; nunca contenido.
- El progreso guarda `scenarioId` + `version` jugada.

## Alternativas consideradas
- **CMS / base de datos de contenido**: requiere backoffice, moderación propia y rompe la portabilidad del fork.
- **Contenido en un repo separado**: más fricción para cambios de schema coordinados.

## Consecuencias
- La creación de escenarios necesita tooling bueno (Studio, skill de Claude Code) para no depender de editar YAML a mano.
- Las respuestas son públicas (aceptado; ver [00](../00-vision-y-alcance.md)).
- Publicar contenido = merge a `main` + deploy; no hay edición "en caliente".
