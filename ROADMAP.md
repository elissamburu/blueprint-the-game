# 🗺️ Blueprint · Qué hay y qué viene

Última actualización: 2026-09-30

Blueprint es open source y todo lo que decidimos está escrito en este repo. Antes de comentar "estaría bueno que…", fijate acá: probablemente ya esté planeado. Y si no, ¡abrí un issue!

## ✅ Qué ya está en la beta

- **8 escenarios** de nivel 100 a 400: sitio estático, serverless, redes privadas, EKS (migración, clúster privado y GPUs) e IA con Bedrock (RAG y datos sensibles).
- **Feedback por casillero** en verde, naranja o rojo, siempre justificado contra los objetivos del escenario y con links a la documentación oficial de AWS.
- **Pistas y mostrar solución**: una pista descuenta unos puntos del casillero y un casillero con la solución vista suma 0, pero nunca perdés XP, progreso ni tu mejor resultado anterior (el objetivo es aprender, no competir). Además, resumen con repaso casillero por casillero, XP, rangos y desbloqueo de niveles por área.
- **Accesibilidad desde el día 1**: objetivo WCAG 2.2 AA, se juega completo con teclado, respeta el modo de contraste de Windows y el movimiento reducido, con pruebas automáticas (axe) en cada cambio.
- **Progreso local**: sin cuentas por ahora, se guarda en tu navegador.

## 🛣️ Qué viene

| Fase                            | Qué incluye                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **F1.1 · Pulido**               | Versión imprimible (caso, diagrama vacío y solución opcional) y animaciones                          |
| **F2 · Scenario Studio**        | Editor visual para crear escenarios sin tocar YAML                                                   |
| **F3 · Infraestructura**        | Deploy con Terraform + OIDC (hoy la beta se publica a mano) y Content-Security-Policy propia         |
| **F4 · Cuentas**                | Registro, progreso en la nube, insignias, rachas, maestría por área                                  |
| **F5 · IA en el Studio**        | Generar borradores de escenarios con IA, siempre validados                                           |
| **F6 · Mobile y accesibilidad** | Juego en celular, PWA offline y **modo texto** para lectores de pantalla                             |
| **F7 · Comunidad**              | Rutas por certificación de AWS, modo examen, métricas de calibración                                 |
| **Contenido (siempre)**         | Escenarios de seguridad, multicuenta (Organizations, Control Tower, RAM) y multirregión              |
| **Después de v1**               | Contenido en otros idiomas y "diseño libre": escribís un requerimiento, diagramás y la IA lo analiza |

Detalle con criterios de terminado por fase: [docs/05-roadmap.md](docs/05-roadmap.md)

## 📚 Dónde está cada definición

| Tema                                                       | Archivo                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Visión, alcance y principios                               | [docs/00-vision-y-alcance.md](docs/00-vision-y-alcance.md)                           |
| Requisitos funcionales (con criterios de aceptación)       | [docs/01-requerimientos-funcionales.md](docs/01-requerimientos-funcionales.md)       |
| Requisitos no funcionales (seguridad, performance, costos) | [docs/02-requerimientos-no-funcionales.md](docs/02-requerimientos-no-funcionales.md) |
| Cómo se modela un escenario (objetivos, grados, lint)      | [docs/03-modelo-de-escenarios.md](docs/03-modelo-de-escenarios.md)                   |
| Estructura del monorepo                                    | [docs/04-estructura-monorepo.md](docs/04-estructura-monorepo.md)                     |
| Roadmap completo                                           | [docs/05-roadmap.md](docs/05-roadmap.md)                                             |
| Accesibilidad y protocolo de pruebas                       | [docs/accesibilidad.md](docs/accesibilidad.md)                                       |
| Decisiones de arquitectura (ADR)                           | [docs/adr/](docs/adr/)                                                               |
| Reglas de puntaje, rangos y desbloqueos                    | [content/game-rules.yaml](content/game-rules.yaml)                                   |
| Catálogo de servicios y grupos de confusión                | [content/catalog/](content/catalog/)                                                 |
| Escenarios (YAML + notas de calibración)                   | [content/scenarios/](content/scenarios/)                                             |
| Cómo contribuir                                            | [CONTRIBUTING.md](CONTRIBUTING.md)                                                   |

Preguntas frecuentes, respondidas en un ADR:

- ¿Por qué verde, naranja y rojo contra objetivos? → [ADR-0007](docs/adr/0007-evaluacion-por-objetivos.md)
- ¿Por qué no hay lupa ni widget de accesibilidad propio? → [accesibilidad, sección 4](docs/accesibilidad.md#4-decisión-sin-lupa-ni-widget-de-accesibilidad-propios)
- ¿Cómo se va a jugar con lector de pantalla? → [ADR-0022](docs/adr/0022-modo-texto.md)
- ¿Otros idiomas? → [ADR-0017](docs/adr/0017-i18n.md) (interfaz) y [ADR-0023](docs/adr/0023-contenido-multiidioma.md) (escenarios)
- ¿Mostrar la solución? → [ADR-0024](docs/adr/0024-comando-revealsolution.md)

## ❓ Lo que todavía está abierto

- **Calibración de los escenarios**: los 8 están en _beta_, y tu feedback decide si un naranja debería ser verde (o al revés). Cada [escenario](content/scenarios/) tiene un `notes.md` con las decisiones discutibles.
- **Escenarios de seguridad**: detección de amenazas, organización multicuenta con guardrails y respuesta automática a incidentes.
- **Content-Security-Policy propia**: [issue #44](https://github.com/elissamburu/blueprint-the-game/issues/44).
- **Modo celular**: hoy es solo para escritorio (llega en F6).
- **Pruebas con personas usuarias** de lector de pantalla y de lupa: si usás alguna de estas herramientas y querés probarlo, escribime.

## 💬 Cómo dar feedback

Desde el juego: **"Contanos qué te pareció"** (feedback general) o **"Reportar un problema en este escenario"** (desde el resumen o el menú ⋯). Los dos abren un issue en GitHub con la plantilla lista.
