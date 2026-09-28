# 0012 · Íconos oficiales descargados en build, no versionados

- Estado: Aceptado (provisorio)
- Fecha: 2026-09-27

## Contexto
La página oficial de íconos de arquitectura indica que AWS permite a clientes y partners usar los toolkits y assets para crear diagramas de arquitectura. No encontramos términos explícitos sobre **redistribuir** los archivos en un repositorio público ni sobre su uso dentro de un juego. El mantenedor planea pedir aprobación formal a AWS a medida que el proyecto crezca.

## Decisión
- Los íconos **no se commitean**. `pnpm icons:fetch` descarga el paquete oficial vigente en build (local y CI) y genera `apps/web/public/icons/` (gitignored) y un mapeo `id → archivo` a partir del campo `icon` del catálogo.
- Los íconos se usan **sin modificar** y solo para representar servicios en diagramas.
- `TRADEMARKS.md` y la página "Acerca de" aclaran que el proyecto no está afiliado ni avalado por AWS.
- Fallback: si el ícono no existe o la descarga falla, se renderiza un ícono genérico por categoría con el nombre del servicio.

## Alternativas consideradas
- **Commitear los SVG**: más simple, pero implica redistribuir assets sin términos explícitos.
- **Íconos propios**: evita el tema legal, pero pierde el valor de aprender con la iconografía real.

## Consecuencias
- El build necesita acceso a internet para descargar el paquete (cacheado en CI).
- Revisar este ADR cuando haya una respuesta formal de AWS; entonces pasa a Aceptado o se reemplaza.
