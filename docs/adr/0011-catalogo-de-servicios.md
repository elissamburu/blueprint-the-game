# 0011 · Catálogo curado + sincronización asistida con SSM

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
La paleta depende de una lista de servicios de AWS con categorías. AWS lanza y retira servicios con frecuencia. Hay dos fuentes oficiales útiles, y ninguna alcanza sola:
- El **paquete de íconos de arquitectura** está organizado por categoría y se publica trimestralmente: fines de enero, abril y julio, sin release en Q4 (según la página oficial de íconos).
- Los **parámetros públicos de SSM** (`/aws/service/global-infrastructure/services`) listan servicios, pero como **namespaces de API** (p. ej. `apigateway`, `apigatewayv2`, `apigatewaymanagementapi`), sin categoría. Esa ruta solo se puede consultar desde un conjunto de regiones soportadas (p. ej. `us-east-1`).

## Decisión
- `content/catalog/services.yaml` es la **fuente de verdad curada** (id estable, nombre, categoría, alias, `leakPatterns`, descripción, `ssmNamespaces`, ícono, estado).
- Un workflow mensual (`catalog-sync.yml`) con un rol **de solo lectura** vía OIDC ejecuta `get-parameters-by-path`, compara con `ssmNamespaces` del catálogo y con el snapshot anterior, y **abre un PR** con:
  - namespaces nuevos sin mapear (candidatos a servicio nuevo),
  - namespaces desaparecidos (candidatos a `deprecated`),
  - el snapshot actualizado.
- Un humano decide el mapeo producto ↔ namespaces y la categoría. Nunca se commitea directo a `main`.
- La actualización trimestral del paquete de íconos se revisa en el mismo proceso (nuevas categorías o renombres).

## Alternativas consideradas
- **Scraping de la página de productos de AWS**: frágil y sin garantías.
- **Sincronización automática sin revisión**: el mapeo namespace → producto requiere criterio; se colarían namespaces técnicos a la paleta.

## Consecuencias
- El catálogo nunca queda desactualizado en silencio, y la curación sigue siendo humana.
- Los escenarios que referencian servicios retirados se detectan con L010.
