# 01 · Requerimientos funcionales

> Convenciones
> - **ID**: `RF-<MÓDULO>-<NN>`. No se reutilizan IDs; si un RF se descarta, se marca `~~tachado~~` con motivo.
> - **Prioridad** (MoSCoW): **M** = Must, **S** = Should, **C** = Could, **W** = Won't (v1).
> - **Fase**: fase del [roadmap](05-roadmap.md) en la que se implementa (F0–F7).
> - Los criterios de aceptación (CA) son la definición de "terminado" para Claude Code y para la revisión del PR.

## Módulos

| Código | Módulo |
|---|---|
| AUTH | Cuentas, sesión y modo invitado |
| ONB | Onboarding y áreas de interés |
| NAV | Exploración de escenarios |
| PLAY | Jugar un escenario |
| PAL | Paleta de servicios |
| EVAL | Evaluación y feedback |
| GAM | Gamificación (XP, rangos, insignias, rachas) |
| STU | Scenario Studio (creación asistida por IA) |
| CNT | Contenido y contribución |
| CAT | Catálogo de servicios |
| OPS | Operación, métricas y reportes |

---

## AUTH · Cuentas, sesión y modo invitado

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-AUTH-01 | El jugador puede **jugar sin registrarse** (modo invitado). El progreso se guarda localmente en el navegador. | M | F1 |
| RF-AUTH-02 | El jugador puede **registrarse e iniciar sesión** con email + contraseña (y verificación de email). | M | F4 |
| RF-AUTH-03 | El jugador puede iniciar sesión con **Google**. GitHub queda como *Could*, porque Cognito no lo soporta como proveedor OIDC nativo ([ADR-0010](adr/0010-autenticacion-cognito-e-invitado.md)). | S | F4 |
| RF-AUTH-04 | Al registrarse, el sistema **ofrece importar el progreso del modo invitado** a la cuenta. | M | F4 |
| RF-AUTH-05 | El jugador define un **alias público** (único, 3–24 caracteres, sin email visible). | M | F4 |
| RF-AUTH-06 | El jugador puede **eliminar su cuenta y todos sus datos** desde el perfil. | M | F4 |
| RF-AUTH-07 | El jugador puede **exportar sus datos** (JSON con perfil, progreso e insignias). | S | F4 |

**CA RF-AUTH-01**
- Dado un visitante sin sesión, cuando abre un escenario desbloqueado, entonces puede jugarlo completo.
- El progreso persiste al recargar la página en el mismo navegador.
- Se muestra un aviso no intrusivo: "Tu progreso está solo en este navegador. Registrate para no perderlo".

**CA RF-AUTH-04**
- Dado un invitado con progreso local, cuando se registra, entonces ve un diálogo "Importar progreso (N escenarios, X XP)".
- Al aceptar, el servidor **recalcula** XP e insignias a partir de los intentos importados (no confía en totales del cliente).
- Tras importar, se limpia el almacenamiento local.

**CA RF-AUTH-06**
- La eliminación borra perfil, progreso, insignias y el usuario de Cognito. Queda un registro técnico sin datos personales (solo "cuenta eliminada" + fecha) si fuera necesario para auditoría.

---

## ONB · Onboarding y áreas de interés

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-ONB-01 | En el primer ingreso, el jugador elige **áreas de interés** (multi-selección) de la lista `content/areas.yaml`. | M | F1 |
| RF-ONB-02 | El jugador indica su **experiencia** (Recién empiezo / Uso AWS / Diseño arquitecturas / Experto), que define los niveles desbloqueados al inicio en todas las áreas (RF-NAV-03). | M | F1 |
| RF-ONB-03 | El jugador puede **editar áreas e intereses** en cualquier momento desde el perfil. | M | F1 |
| RF-ONB-04 | Tutorial interactivo de 1 escenario nivel 100 que enseña la mecánica (colocar, colores, pistas, flujo). | S | F1 |

**Mapeo experiencia → niveles desbloqueados (inicial, configurable en `content/game-rules.yaml`)**

| Experiencia | Desbloqueados |
|---|---|
| Recién empiezo | 100 |
| Uso AWS | 100, 200 |
| Diseño arquitecturas | 100, 200, 300 |
| Experto | 100–400 |

---

## NAV · Exploración de escenarios

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-NAV-01 | Listado de escenarios con **filtros por nivel, área y estado** (nuevo, en curso, completado verde, completado). "Completado" es un escenario completado sin todos los casilleros en verde: con naranjas aceptados, con soluciones vistas (RF-PLAY-14) o con ambos. | M | F1 |
| RF-NAV-02 | Sección **"Recomendados para vos"** según áreas de interés, nivel desbloqueado y escenarios no jugados. | M | F1 |
| RF-NAV-03 | **Desbloqueo progresivo de niveles por área**: el nivel N+1 de un área se desbloquea al completar `unlock.scenariosRequired` escenarios (default 3) de esa área en el nivel N, además de lo definido en onboarding. Ver reglas en CA RF-NAV-03. | M | F1 |
| RF-NAV-04 | Cada tarjeta muestra: título, resumen, nivel, áreas, duración estimada, mejor resultado del jugador. | M | F1 |
| RF-NAV-05 | Solo se listan escenarios con `status: published` (y `beta` con etiqueta "Beta"). `draft` y `retired` no se listan. | M | F1 |
| RF-NAV-06 | **Escenario destacado de la semana** (configurable en contenido). | C | F7 |
| RF-NAV-07 | **Rutas de certificación**: los escenarios se etiquetan con los **dominios publicados** en la guía oficial de cada examen de AWS ([AWS Certification Exam Guides](https://docs.aws.amazon.com/aws-certification/latest/examguides/aws-certification-exam-guides.html)); el listado permite filtrar por certificación y dominio, y cada certificación tiene una ruta ordenada de escenarios. Se vincula con el modo examen (RF-PLAY-12). | C | F7 |

**CA RF-NAV-03**
- El desbloqueo es por par **(área, nivel)**. XP y rango siguen siendo globales.
- La experiencia del onboarding (RF-ONB-02) define los niveles abiertos al inicio en **todas** las áreas.
- Requisito para abrir (área, N+1), con (área, N) abierto:
  - si el área tiene escenarios de nivel N: completar `min(unlock.scenariosRequired, escenarios del área en N)` escenarios de esa área en N;
  - si el área no tiene escenarios de nivel N: completar `min(unlock.scenariosRequired, escenarios de nivel N en cualquier área)` escenarios de nivel N de cualquier área;
  - si no hay ningún escenario de nivel N en ninguna área, no se abre.
- Un requisito de 0 nunca cuenta como cumplido: un jugador nuevo no tiene abierto ningún nivel más allá de los de su experiencia.
- Un escenario completado cuenta para **cada una** de sus áreas.
- Un escenario es jugable si su nivel está desbloqueado en **al menos una** de sus áreas.
- Los desbloqueos son permanentes: el progreso guarda los pares (área, nivel) abiertos como un conjunto que solo crece. Si después se publican más escenarios en el nivel N, el nivel N+1 ya abierto sigue abierto.
- Jugar niveles inferiores o repetir escenarios nunca bloquea nada.

**CA RF-NAV-07**
- Las etiquetas usan **solo** el código del examen (p. ej. `SAA-C03`) y el nombre y número de dominio tal como figuran en su guía oficial pública. Nunca se incluyen preguntas reales de examen, preguntas "parecidas a las del examen" reconstruidas de memoria ni ningún otro contenido protegido por el acuerdo de certificación ([AWS Certification policies](https://aws.amazon.com/certification/policies/)).
- La lista de exámenes y dominios vive en contenido (un archivo en `content/`, con el enlace a la guía y la versión del examen de la que salió), no en el código. Cuando AWS publica una versión nueva de un examen, se actualiza ese archivo por PR y el lint avisa de etiquetas que apuntan a dominios que ya no existen.
- La UI aclara que las rutas son práctica de diseño relacionada con los dominios del examen, no una preparación oficial ni una garantía de aprobarlo, y mantiene el aviso de no afiliación con AWS (RF-OPS-03).

---

## PLAY · Jugar un escenario

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-PLAY-01 | La pantalla de juego muestra el **diagrama** y la **paleta**. El **contexto** del caso y los **objetivos** (con distinción visual entre restricciones duras y metas) se muestran **al entrar** (brief) y **a demanda** ("Ver caso"), en lugar de todos a la vez. | M | F1 |
| RF-PLAY-02 | El diagrama muestra **actores, grupos (Cloud, Región, VPC, AZ, subredes), nodos fijos y casilleros en blanco** con su **rol** visible. | M | F1 |
| RF-PLAY-03 | **Reproductor de flujo**: el jugador puede reproducir paso a paso el flujo de datos (aristas numeradas y animadas con su etiqueta y descripción). | M | F1 |
| RF-PLAY-04 | Colocar un servicio en un casillero mediante **drag & drop** (desktop). | M | F1 |
| RF-PLAY-05 | Colocar un servicio mediante **selección por toque/teclado**: seleccionar casillero → elegir servicio en panel/bottom sheet. Disponible en todos los dispositivos. | M | F1 (teclado) / F6 (mobile) |
| RF-PLAY-06 | **Pistas** por casillero (`hints`), reveladas de a una, con costo en puntaje. | M | F1 |
| RF-PLAY-07 | El jugador puede **reintentar** un casillero naranja o rojo. | M | F1 |
| RF-PLAY-08 | El escenario se completa cuando **todos los casilleros son verdes o naranjas aceptados** por el jugador ("me quedo con esta"). | M | F1 |
| RF-PLAY-09 | **Pantalla de resumen**: puntaje, XP ganada, insignias nuevas, detalle por casillero con la explicación de la respuesta óptima y enlaces a documentación oficial. | M | F1 |
| RF-PLAY-10 | **Modo revancha**: re-jugar un escenario completado; solo otorga XP por mejora sobre el mejor resultado. | S | F4 |
| RF-PLAY-11 | Zoom/pan del diagrama y **ajuste automático a pantalla**. | M | F1 |
| RF-PLAY-12 | **Modo examen** (opcional, niveles 300–400): el feedback de colores se muestra al enviar todo, no por casillero. | C | F7 |
| RF-PLAY-13 | Botón **"Reportar un problema en este escenario"** que abre un issue de GitHub pre-cargado (id, versión, casillero, comentario). | S | F1 |
| RF-PLAY-14 | **Mostrar solución**: desde el menú del juego, "Ver solución de este casillero" (con un casillero seleccionado) y "Ver solución completa", siempre con un aviso previo que invita a usar las pistas. Ver CA. | S | F1 |
| RF-PLAY-15 | **"Reproducir flujo" visible**: el reproductor de flujo (RF-PLAY-03) se abre con un botón en la barra del juego, no escondido en el menú. "Reportar un problema" (RF-PLAY-13) sigue en el menú y en el resumen. | S | F1 |
| RF-PLAY-16 | **Versión imprimible** del escenario, con estilos de impresión y "Guardar como PDF" del navegador, sin servidor. Ver CA. | C | F1 |
| RF-PLAY-17 | **Animaciones**: microinteracciones al colocar un servicio, al mostrar el resultado de un casillero y al subir de rango, diseñadas en la herramienta de diseño como referencia visual ([ADR-0021](adr/0021-ui-shadcn-tailwind-y-referencia-visual.md)) y con alternativa sin movimiento bajo `prefers-reduced-motion` ([accesibilidad](accesibilidad.md#3-preferencias-del-sistema)). | C | F1 |

**CA RF-PLAY-01**
- Al entrar a cada escenario se abre el **brief**: nivel, áreas, duración estimada, contexto, restricciones, metas y una vista previa del diagrama de solo lectura con los casilleros vacíos. "Empezar a diseñar" (o Esc) lo cierra y deja el tablero.
- "Ver caso" abre, en un panel lateral sobre el tablero y sin oscurecerlo, el contexto, las restricciones, las metas y los pasos del flujo (número, etiqueta y origen → destino).
- El brief es un diálogo modal: el foco queda atrapado adentro y, al cerrarlo, pasa al tablero.
- "Ver caso" es un panel no modal: al abrirlo el foco va al panel, sin quedar atrapado; Esc o la X lo cierran y devuelven el foco al botón. Mientras está abierto, el tablero y la paleta siguen operables (también el drag & drop).
- En las listas del caso, las metas llevan un ícono neutro: el ✓ queda para el feedback ("cumple").

**CA RF-PLAY-02**
- Ningún texto visible antes de acertar (rol, etiquetas, contexto, objetivos, pistas) contiene el nombre de un servicio que el jugador deba adivinar. Esto lo garantiza el lint `L005` en CI, no la UI.
- Los nodos fijos (`type: fixed`) muestran su servicio e ícono desde el inicio.

**CA RF-PLAY-05**
- Todo lo que se puede hacer con drag se puede hacer con teclado (Tab/Enter/flechas) y con toque. Ambos caminos emiten el mismo comando del motor ([ADR-0008](adr/0008-interaccion-desacoplada.md)).

**CA RF-PLAY-14**
- Antes de revelar se muestra un aviso **sin tono de castigo**, que invita a probar una pista si al casillero le quedan (p. ej. "¿Querés probar con una pista primero? Si preferís ver la solución, este casillero no suma puntos, pero podés terminar el escenario igual"). Opciones: "Usar una pista" (si quedan), "Ver solución" y "Cancelar". "Ver solución completa" muestra un único aviso para todos los casilleros pendientes.
- El casillero revelado muestra el servicio óptimo, su explicación, los objetivos que cumple y las referencias, igual que un verde (RF-EVAL-04), pero marcado como **"Solución vista"** con texto e ícono propios, no con el verde de acierto.
- Un casillero revelado da **0 puntos** (ver la tabla de puntaje en EVAL) y no cuenta como verde al primer intento ni para insignias como `perfect_scenario` o `no_hints`.
- Con casilleros revelados, el escenario **se puede completar y cuenta como completado** (para el listado, los desbloqueos de RF-NAV-03 y `complete_count`), pero **no "en verde"**: en RF-NAV-01 figura como completado, no como completado verde.
- Mostrar la solución **nunca resta** progreso ni XP ya ganada y **nunca baja el mejor resultado** guardado del escenario: si una partida con soluciones vistas da menos puntos, se conserva el mejor anterior.
- La decisión de qué se revela y cuánto puntúa la toma el motor (`game-engine`) con un comando nuevo, no la UI. Ese comando se suma a los de [ADR-0008](adr/0008-interaccion-desacoplada.md) con un ADR que lo extienda, propuesto en el PR que lo implementa.
- Existe también en el modo texto ([ADR-0022](adr/0022-modo-texto.md)).

**CA RF-PLAY-15**
- El botón "Reproducir flujo" está en la barra del juego con ícono y texto visible (no solo ícono), con el mismo comportamiento que tenía la opción del menú.
- Si el ancho no alcanza, la barra colapsa antes otros elementos secundarios; "Reproducir flujo" sale de la barra solo en modo foco.
- "Reportar un problema" queda en el menú "⋯" y en la pantalla de resumen (RF-PLAY-09).

**CA RF-PLAY-16**
- Se imprime desde el navegador ("Imprimir" → "Guardar como PDF"); no hay generación de PDF en el servidor ni dependencias nuevas.
- **Hoja 1**: el caso (título, nivel, áreas, contexto) y los objetivos, con restricciones y metas distinguidas por texto.
- **Hoja 2**: el diagrama con los casilleros vacíos **numerados** y, debajo, la tira de pasos del flujo (número, etiqueta, origen → destino), para completar a mano.
- **Opcional** (casilla "Incluir soluciones" antes de imprimir): una hoja por casillero con el óptimo, los aceptables, los incorrectos típicos, el porqué de cada uno y los enlaces a la documentación oficial.
- Cada sección empieza en una **página nueva** (`break-before: page`); la barra del juego, la paleta y los controles no se imprimen.
- Se imprime legible en blanco y negro: los grados de las hojas de solución se distinguen por texto e ícono, no por color.

---

## PAL · Paleta de servicios

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-PAL-01 | La paleta se arma según el **modo de paleta** resultante del nivel (o del override del escenario). | M | F1 |
| RF-PAL-02 | Servicios **agrupados por categoría** (colapsables) con **buscador** (por nombre y alias). | M | F1 |
| RF-PAL-03 | En niveles 100–200 cada servicio muestra una **descripción corta** al pasar el mouse o mantener presionado. En 300–400 no. | S | F1 |
| RF-PAL-04 | Los servicios ya colocados se marcan visualmente pero **pueden reutilizarse** (un servicio puede ser respuesta de varios casilleros). | M | F1 |
| RF-PAL-05 | La paleta se genera a partir del **catálogo vigente**. Los servicios `deprecated` no aparecen salvo que el escenario los use. | M | F1 |

**Modos de paleta**

| Modo | Default para nivel | Contenido |
|---|---|---|
| `curated` | 100 | Respuestas (todas las gradaciones) + `incorrect` del escenario + distractores de sus grupos de confusión, hasta `palette.maxSize` (default 12). |
| `categories` | 200 | Todos los servicios de las categorías de las respuestas. |
| `categories-plus` | 300 | `categories` + categorías adyacentes (definidas en `categories.yaml`). |
| `full` | 400 | Catálogo completo, sin resaltar categorías. |

---

## EVAL · Evaluación y feedback

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-EVAL-01 | Al colocar un servicio, el casillero toma **color inmediato**: verde/naranja/rojo. | M | F1 |
| RF-EVAL-02 | Cada resultado muestra una **explicación**: para `optimal` y `acceptable`, la `rationale` del escenario **vinculada a los objetivos** que la justifican; para un servicio declarado en `incorrect`, su rationale específica (obligatoria); para un servicio no declarado en `answers` ni en `incorrect` (p. ej. un distractor de `palette.extra`), una explicación genérica (descripción del servicio desde el catálogo + "no cumple el rol: …"). | M | F1 |
| RF-EVAL-03 | Un servicio que viola un objetivo `hard` es **siempre rojo**, aunque técnicamente funcione. La explicación nombra la restricción violada. | M | F1 |
| RF-EVAL-04 | Una vez verde, el casillero **revela el servicio** (nombre + ícono) y queda bloqueado. | M | F1 |
| RF-EVAL-05 | El puntaje se calcula con el **motor de reglas** (`packages/game-engine`) según `content/game-rules.yaml`. | M | F1 |
| RF-EVAL-06 | Con sesión iniciada, el **servidor re-evalúa** el intento contra la versión publicada del escenario antes de otorgar XP/insignias. | M | F4 |

**Reglas de puntaje iniciales (configurables)**

| Evento | Puntos del casillero |
|---|---|
| Verde al primer intento | 100 |
| Verde tras N errores | `max(25, 100 − 25·N)` |
| Naranja aceptado por el jugador | 50 |
| Cada pista usada | −15 (mínimo 0) |
| Casillero con la solución vista (RF-PLAY-14) | 0 (`scoring.revealedSolution` en `game-rules.yaml`; nunca mayor que un naranja aceptado ni que el mínimo de un verde) |
| XP del escenario | `Σ puntos × multiplicador` (100: ×1 · 200: ×1,5 · 300: ×2 · 400: ×3) |

---

## GAM · Gamificación

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-GAM-01 | **XP acumulada** y **rango del jugador** por umbrales (Aprendiz → Constructor → Arquitecto → Arquitecto Senior → Principal; nombres y umbrales en `game-rules.yaml`). | M | F1 (local) / F4 |
| RF-GAM-02 | **Insignias** definidas de forma declarativa en `content/badges/badges.yaml` ([ADR-0018](adr/0018-gamificacion-declarativa.md)). | M | F4 |
| RF-GAM-03 | Tipos de regla de insignia mínimos: `complete_count` (N escenarios, filtrable por nivel/área), `perfect_scenario` (todo verde al primer intento), `no_hints` (completar sin pistas), `streak` (N días), `area_mastery` (% de escenarios de un área en verde), `level_complete` (todos los escenarios `published` de un nivel existentes al evaluar). ~~`first_of_kind`~~: descartado, sin semántica definida ([ADR-0018, revisión 2026-09-28](adr/0018-gamificacion-declarativa.md#revisión-2026-09-28)). | M | F4 |
| RF-GAM-04 | **Maestría por área**: barra de progreso por área de interés. | S | F4 |
| RF-GAM-05 | **Rachas** diarias con un "comodín" semanal que evita perder la racha por un día (sin castigo). | S | F4 |
| RF-GAM-06 | **Álbum de servicios**: cada servicio acertado en verde se "desbloquea" como ficha (qué es, cuándo conviene, cuándo no, enlaces). | S | F4 |
| RF-GAM-07 | **Insignias secretas** (ocultas hasta obtenerlas). | C | F4 |
| RF-GAM-08 | **Perfil público opcional** con insignias y rango, e **imagen compartible** (p. ej. para LinkedIn) al ganar una insignia. | C | F7 |
| RF-GAM-09 | **Leaderboard** por comunidad (opt-in). | W | v2 |
| RF-GAM-10 | Notificación in-app al ganar XP, subir de rango o desbloquear un nivel: al finalizar un escenario se muestra en la **pantalla de resumen** y se anuncia con `aria-live="polite"`, **sin toast**, para que los lectores de pantalla no lo lean dos veces. Un nivel desbloqueado al cambiar la experiencia en el perfil (RF-ONB-03) se avisa con un mensaje de estado junto a "Guardar cambios" (`role="status"`, `aria-live="polite"`), que queda visible hasta volver a editar o salir de la pantalla; tampoco hay toast. La notificación de insignias es F4. | M | F1 / F4 |

**Principios (no negociables)**: nunca se pierde progreso ni XP; sin temporizadores de presión; sin monedas compradas; las rachas no castigan.

---

## STU · Scenario Studio (creación asistida por IA)

> Herramienta **local** (`pnpm studio`) incluida en el repo. Ver [ADR-0013](adr/0013-scenario-studio-local-con-ia.md).

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-STU-01 | **Crear escenario** desde cero, desde plantilla, duplicando uno existente o **con IA**. | M | F2 / F5 |
| RF-STU-02 | **Abrir/editar** cualquier escenario existente de `content/scenarios/`. | M | F2 |
| RF-STU-03 | **Editor por formulario** de metadatos, contexto, objetivos, casilleros (rol, respuestas, grados, rationale, objetivos vinculados, referencias, pistas) y aristas. | M | F2 |
| RF-STU-04 | **Editor visual del diagrama**: mover nodos, crear/eliminar nodos y grupos, dibujar aristas, numerar pasos. | M | F2 |
| RF-STU-05 | **Auto-layout** del diagrama (botón "Ordenar") para borradores generados por IA. | M | F2 |
| RF-STU-06 | **Editor YAML** lado a lado, sincronizado en ambos sentidos con el formulario y el diagrama. | S | F2 |
| RF-STU-07 | **Panel de validación en vivo**: errores y advertencias de schema y lint (`L0xx`), con clic que lleva al campo. | M | F2 |
| RF-STU-08 | **Preview jugable**: botón "Jugar" que abre el escenario con el mismo renderer y motor del juego, incluida la paleta del nivel. | M | F2 |
| RF-STU-09 | **Vista "respuestas"** para el autor: todos los casilleros revelados con grado y rationale. | M | F2 |
| RF-STU-10 | **Generar borrador con IA** a partir de: caso de uso en texto libre, nivel, áreas y objetivos opcionales. El resultado es un escenario **válido contra el schema** con servicios restringidos al catálogo. | M | F5 |
| RF-STU-11 | **Bucle de reparación**: si el borrador no pasa schema/lint, la IA recibe los errores y corrige (máx. `AI_MAX_REPAIR` iteraciones, default 3). | M | F5 |
| RF-STU-12 | **Revisión crítica por IA** ("segunda opinión"): una pasada separada revisa calibración de grados vs objetivos, filtraciones, distractores y claridad, y devuelve observaciones (no modifica solo). | S | F5 |
| RF-STU-13 | **Regenerar parcial con IA**: un casillero, una rationale, las pistas o los distractores. | S | F5 |
| RF-STU-14 | **Guardar** en `content/scenarios/<id>/` (repo local) y **descargar** como `.zip` (escenario + archivos generados). | M | F2 |
| RF-STU-15 | **Crear PR** desde el Studio: si `gh` está instalado y autenticado, crea rama, commit (con DCO sign-off) y PR con la plantilla completada. Si no, muestra los comandos. | S | F5 |
| RF-STU-16 | **Proveedor de IA configurable** por variables de entorno: Amazon Bedrock (default, credenciales del perfil local de AWS) o Anthropic API (API key). | M | F5 |
| RF-STU-17 | Mostrar **costo estimado / tokens** de cada llamada de IA. | C | F5 |
| RF-STU-18 | El Studio **nunca** se despliega en la infraestructura pública; escucha solo en `127.0.0.1`. | M | F2 |

**CA RF-STU-10**
- Dado "procesar PDFs subidos por clientes, picos a fin de mes, equipo chico", nivel 200, áreas `serverless`: cuando genero, entonces obtengo en menos de 60 s un escenario que pasa `pnpm content:validate` sin errores (advertencias permitidas), con ≥ 1 `optimal` por casillero y cada `optimal`/`acceptable` vinculado a ≥ 1 objetivo.
- Todos los `service` pertenecen al catálogo (no hay servicios inventados).
- El borrador se marca `status: draft` y `authors` incluye al usuario de git local.

---

## CNT · Contenido y contribución

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-CNT-01 | Los escenarios son archivos YAML en `content/scenarios/<id>/scenario.yaml` ([03](03-modelo-de-escenarios.md)). | M | F0 |
| RF-CNT-02 | CLI `pnpm content:validate` que ejecuta schema + lint semántico y devuelve código ≠ 0 ante errores. | M | F0 |
| RF-CNT-03 | CLI `pnpm content:gen` que genera `diagram.mmd` y `README.md` por escenario; CI falla si están desactualizados (`--check`). | M | F0 |
| RF-CNT-04 | CLI `pnpm content:build` que produce el **bundle** JSON (`index.json`, un JSON por escenario y versión, `catalog.json`, `badges.json`, `game-rules.json`). | M | F0 |
| RF-CNT-05 | Plantilla de PR "Nuevo escenario" con checklist (objetivos claros, sin filtraciones, referencias oficiales, jugado en preview). | M | F0 |
| RF-CNT-06 | CI comenta en el PR un **resumen del escenario** (nivel, áreas, casilleros, advertencias de lint) y el diagrama Mermaid. | S | F3 |
| RF-CNT-07 | Si cambian respuestas o grados de un escenario publicado, **CI exige** incrementar `version`. | S | F3 |
| RF-CNT-08 | **Skill de Claude Code** en el repo (`.claude/skills/nuevo-escenario`) para generar escenarios desde Claude Code con las mismas reglas que el Studio. | S | F5 |

---

## CAT · Catálogo de servicios

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-CAT-01 | Catálogo curado en `content/catalog/services.yaml` (id estable, nombre, categoría, alias, patrones de filtración, descripción corta, estado, namespaces de SSM asociados). | M | F0 |
| RF-CAT-02 | Categorías en `content/catalog/categories.yaml` alineadas a las categorías del paquete oficial de íconos de AWS, con adyacencias para el modo `categories-plus`. | M | F0 |
| RF-CAT-03 | Grupos de confusión en `content/catalog/confusion-groups.yaml`. | M | F0 |
| RF-CAT-04 | **Workflow programado** (mensual) que consulta los parámetros públicos de SSM (`/aws/service/global-infrastructure/services`), compara con el catálogo y **abre un PR** con altas/bajas detectadas para curación humana. Nunca commitea directo a `main`. | M | F7 |
| RF-CAT-05 | Script `pnpm icons:fetch` que descarga el paquete oficial de íconos y mapea íconos a ids del catálogo. Los íconos **no se versionan** en el repo ([ADR-0012](adr/0012-iconos.md)). | M | F1 |
| RF-CAT-06 | Si un servicio pasa a `deprecated`, el lint advierte en los escenarios que lo usan (error si es `optimal`). | M | F0 |

---

## OPS · Operación, métricas y reportes

| ID | Requisito | P | Fase |
|---|---|---|---|
| RF-OPS-01 | **Métricas de calibración anónimas** por casillero: distribución de servicios colocados y tasa de acierto al primer intento. | S | F7 |
| RF-OPS-02 | Vista (interna, para mantenedores) de **escenarios mal calibrados**: casilleros con tasa de acierto < 15 % o > 95 % en su nivel. | C | F7 |
| RF-OPS-03 | Página "Acerca de" con licencia, aviso de no afiliación con AWS y créditos a contribuidores (desde `authors`). | M | F1 |

---

## Trazabilidad

Cada PR de implementación debe referenciar los IDs de RF que cubre en su descripción (p. ej. `Implementa: RF-PLAY-01, RF-PLAY-02`). Claude Code debe leer este documento y el ADR correspondiente antes de implementar un módulo.
