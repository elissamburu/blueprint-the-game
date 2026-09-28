# 0001 · Registrar decisiones con ADRs

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
El proyecto es comunitario y se desarrolla en gran parte con Claude Code. Sin decisiones escritas, cada sesión (humana o de IA) puede reabrir debates ya cerrados o implementar algo contradictorio.

## Decisión
Toda decisión técnica que afecte a más de un paquete, a la seguridad, a la infraestructura o al formato de contenido se registra como ADR en `docs/adr/`. `CLAUDE.md` obliga a leerlos antes de implementar.

## Alternativas consideradas
- Wiki de GitHub: queda fuera del flujo de PR y no se versiona con el código.
- Discusiones en issues: se pierden y no tienen estado.

## Consecuencias
- Cambiar una decisión requiere un PR con un ADR nuevo, visible y revisable.
- Costo bajo: un archivo corto por decisión.
