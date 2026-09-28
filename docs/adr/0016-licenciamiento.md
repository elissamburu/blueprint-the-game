# 0016 · Licencias no comerciales para código y contenido + DCO

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto
Requisito: cualquiera puede usar, estudiar, modificar y redistribuir el proyecto, pero **no comercializarlo**. El proyecto se comunicó como "open source".

Dos hechos a tener en cuenta:
1. Una licencia que prohíbe el uso comercial **no es "open source"** según la definición de la Open Source Initiative. El término correcto es ***source-available*** (código disponible) o "código abierto no comercial". Conviene comunicarlo así para evitar reclamos de la comunidad.
2. Creative Commons **recomienda no usar sus licencias para software** (no cubren código fuente ni patentes); sí son adecuadas para documentación y contenido.

## Decisión
| Qué | Licencia | Por qué |
|---|---|---|
| Código (`apps/`, `services/`, `packages/`, `tools/`, `infra/`) | **PolyForm Noncommercial 1.0.0** | Licencia estándar, escrita para software, que permite cualquier *propósito no comercial*: uso personal (estudio, hobby, investigación), organizaciones sin fines de lucro, instituciones educativas y gobierno. Permite modificar y redistribuir con aviso de la licencia. |
| Contenido (`content/`, `docs/`) | **CC BY-NC-SA 4.0** | Estándar para contenido educativo: atribución, no comercial y *compartir igual* (las mejoras de escenarios vuelven a la comunidad). |
| Íconos de AWS | No se licencian (no son nuestros) | Ver [0012](0012-iconos.md). |

**Contribuciones**: **DCO** (`Signed-off-by` en cada commit, `git commit -s`, verificado por una GitHub App o un check de CI). No se pide CLA.

## Pendientes abiertos
- **CLA ante una licencia comercial dual**: si en el futuro se quiere ofrecer una licencia comercial dual (p. ej. a empresas que quieran usarlo internamente), el DCO no alcanza y hace falta evaluar un **CLA** que otorgue al mantenedor derechos para relicenciar. Las contribuciones aceptadas solo con DCO no se podrían relicenciar sin el acuerdo de sus autores, así que conviene decidirlo antes de que haya muchas contribuciones externas. Si se adopta, se registra en un ADR nuevo.
- Con PolyForm Noncommercial, una **empresa** que quiera desplegarlo internamente para capacitar a su personal probablemente **no** esté cubierta (no es uso personal ni organización sin fines de lucro). Si se quiere permitir ese uso, hay que evaluar otra licencia o una excepción explícita. Jugar en la instancia pública no requiere licencia (no se copia el software).
- El proyecto no brinda asesoramiento legal; conviene que alguien con formación legal revise esta decisión antes de publicar el repo.

## Alternativas consideradas
- **MIT/Apache-2.0**: open source real, pero permite uso comercial.
- **AGPL-3.0**: open source y protege contra SaaS cerrados, pero permite vender el servicio si se publica el código.
- **CC BY-NC-SA para todo**: no recomendada para software por Creative Commons.
- **Business Source License**: pensada para convertir a open source después de un plazo; más compleja de explicar.

## Consecuencias
- `LICENSE` en la raíz (PolyForm NC) y `content/LICENSE` (CC BY-NC-SA 4.0), encabezados SPDX por archivo y lint con `reuse`.
- El README dice "código disponible, no comercial" y enlaza este ADR.
- [CONTRIBUTING.md](../../CONTRIBUTING.md) explica cómo firmar los commits con DCO.
