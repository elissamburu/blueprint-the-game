# 0025 · Studio: preview con `packages/play` y servidor local endurecido

- Estado: Aceptado
- Fecha: 2026-10-04
- Extiende: [ADR-0008](0008-interaccion-desacoplada.md), [ADR-0013](0013-scenario-studio-local-con-ia.md)

## Contexto
F2 implementa el Scenario Studio v1 (RF-STU-01..09, 14 y 18). [ADR-0013](0013-scenario-studio-local-con-ia.md) pide que **el preview sea exactamente el juego** y que el Studio reutilice `diagram`, `game-engine`, `scenario-schema` y `content-lint`. Hoy la pantalla de juego (`GameScreen`, su controlador, el store de la sesión, la paleta, el feedback, el brief, "Ver caso" y el diálogo de solución) vive en `apps/web/src/features/play/`, y los adaptadores de interacción en `apps/web/src/interaction/` ([ADR-0008](0008-interaccion-desacoplada.md)). Una app no puede importar de otra.

`GameScreen` depende de `apps/web` solo en seis puntos: el store de progreso (al empezar y al terminar), la navegación al resumen, el layout inmersivo, el adaptador de drag, la ruta de los íconos y los textos de la UI.

Además, el servidor del Studio escribe en el repo. Aunque escuche solo en `127.0.0.1`, cualquier página abierta en el navegador del autor puede intentar mandarle requests (CSRF) o apuntarle un dominio propio (DNS rebinding). Es una superficie de ataque y sus reglas tienen que quedar escritas y probadas.

## Decisión

### 1. La pantalla de juego es un paquete: `packages/play`
- `packages/play` contiene la pantalla de juego y sus piezas (controlador, store de la sesión, paleta, feedback, brief, "Ver caso", diálogo de solución, preferencias de la UI del tablero) y los **adaptadores de interacción** de [ADR-0008](0008-interaccion-desacoplada.md), que dejan `apps/web/src/interaction/`. Los comandos y las reglas no cambian: siguen en `game-engine`.
- Lo propio de cada app entra por un puerto, `GameHost`:

  ```ts
  interface GameHost {
    iconSrc(serviceId: string): string | undefined;
    onStarted?(scenarioId: string): void;           // web: marca el escenario "en curso"
    onFinish(session: SessionState): Promise<void>; // web: guarda y va al resumen; studio: resumen en la misma pantalla
    exit: { label: string; href?: string; onExit?(): void };
    reportIssueUrl?(slotId?: string): string;        // el Studio no lo pasa
    useLayout?(): void;                              // web: layout inmersivo
  }
  ```

  > **Nota (2026-10-04, al implementarlo).** Además de los seis puntos del contexto, la pantalla dependía de `apps/web` en el enlace a la versión imprimible, en `StatusBadge` del listado, en `formatNumber` y en tres textos fuera de `play.*`. Se resolvió sin otro ADR: `GameHost` suma `printHref?(scenarioId): string` (sin él no se ofrece "Imprimir"); `exit.href` y `printHref` son rutas del router de la app, que `packages/play` enlaza con React Router; `StatusBadge` pasa a `packages/play` con sus textos (`status.*`, y el nombre de la lista de áreas), que `apps/web` usa desde el namespace `play`; `formatNumber` pasa a `@blueprint/ui/lib/format`, y "(se abre en otra pestaña)" queda duplicado en los dos namespaces, con un test que verifica que son iguales. Las claves de las preferencias de los avisos del sitio quedan en `apps/web`.

- Quedan en `apps/web`: la ruta y el control de desbloqueo (`PlayPage`, `ScenarioGate`), el resumen, la versión imprimible, el guardado del progreso (`finish.ts`) y el enlace para reportar un problema.
- Los textos de la pantalla de juego viven en `packages/play` con el namespace de i18next `play` ([ADR-0017](0017-i18n.md)); cada app lo registra.
- `packages/play` **puede** importar `game-engine`: es la capa que traduce los eventos del tablero en comandos, el rol que hasta ahora cumplía `apps/web`. `diagram` y `ui` siguen sin poder importarlo.
- El Studio monta el mismo componente con un `GameHost` que no guarda progreso, no reporta problemas y muestra el resultado en la misma pantalla con "Reiniciar". La paleta se arma igual que en el juego (`buildPalette` con las reglas de juego), así que el preview incluye la paleta del nivel (RF-STU-08).

### 2. Modelo de edición del Studio
- **Fuente de verdad**: el texto YAML y su `Document` (librería `yaml`), en memoria. Formulario, diagrama, vista de respuestas y preview se derivan de él. Las ediciones del formulario y del diagrama son comandos sobre el `Document` con el path más fino posible (`setIn` de un escalar, nunca reemplazar un subárbol) y regeneran el texto, así que hay una sola pila de deshacer.
- **YAML inválido a medio escribir**: si no parsea, el formulario, el diagrama, el preview y las respuestas muestran el último estado válido en solo lectura, con un aviso que indica la línea del error. Si parsea pero no pasa el schema, el formulario sigue editable (trabaja por path); el diagrama y el preview usan el último escenario válido. (Precisado para el editor visual en [Enmiendas, 2026-10-05](#enmiendas).)
- **Comentarios**: se conservan los de los nodos que no se editan; borrar un nodo borra sus comentarios. Guardar escribe el texto tal cual; el Studio nunca reformatea el archivo entero. Un archivo abierto y guardado sin cambios queda idéntico byte a byte.
- **Validación en vivo** (RF-STU-07): `scenario-schema` y `content-lint` corren en el navegador (son puros). El servidor repite la validación al guardar. Cada issue lleva su `path`, que se resuelve a una línea del YAML y al campo del formulario. L014 (control de `version` contra `main`) **no** corre en el Studio: queda en `pnpm content:validate --base origin/main` y en el CI.
- **Archivos generados**: el generador de `diagram.mmd` y `README.md` (puro) pasa de `tools/content` a `@blueprint/content-lint`, junto a la comparación de L012. El CLI y el servidor del Studio lo importan de ahí. Guardar regenera los dos archivos.
- **Auto-layout** (RF-STU-05): elkjs en `packages/diagram`, como pide [ADR-0005](0005-modelo-de-diagrama.md), en un subpath sin React (`@blueprint/diagram/layout`) para que el juego no lo cargue y el pipeline de IA de F5 lo pueda usar desde Node. El Studio lo carga de forma diferida.
- **Editor visual** (RF-STU-04): mover, crear, borrar y conectar en el canvas emiten los mismos comandos de edición que el formulario, el mismo patrón que [ADR-0008](0008-interaccion-desacoplada.md) aplica al juego. El formulario es la alternativa completa sin arrastrar, y el nodo seleccionado también se mueve con las flechas ([accesibilidad](../accesibilidad.md), 2.1.1 y 2.5.7).

### 3. Dependencias exclusivas del Studio
CodeMirror 6 (`@codemirror/*`, editor YAML con diagnósticos) y `elkjs` (auto-layout) superan los 50 KB gzip y solo las usa el Studio local. **Nunca** llegan al bundle de `apps/web`, y un chequeo automático lo garantiza:
- una regla de dependency-cruiser (`reachable`) que prohíbe que algo alcanzable desde `apps/web/src` llegue a `@codemirror/*` o `elkjs`;
- el build de `apps/web` falla si algún módulo del bundle sale de `node_modules/@codemirror/` o `node_modules/elkjs/`.

### 4. Seguridad del servidor local
`pnpm studio` compila la UI y un único servidor Hono la sirve, junto con `/api/*` y `/icons/<id>.svg` (de `apps/web/public/icons`, solo si `<id>` cumple el patrón de ids del catálogo). No sirve ningún otro archivo. El modo de desarrollo del Studio (Vite con recarga en caliente) levanta el mismo servidor Hono en su proceso, escucha en `127.0.0.1` y aplica las mismas reglas.

| # | Regla | Cómo se cumple | Test previsto |
|---|---|---|---|
| S1 | Escucha solo en loopback | `serve({ fetch, hostname: "127.0.0.1", port })`. El host no es configurable; el puerto sí (`STUDIO_PORT`). | El servidor arrancado reporta `127.0.0.1`; ninguna opción ni variable cambia el host. |
| S2 | Protección contra DNS rebinding | Middleware: el header `Host` tiene que ser exactamente `127.0.0.1:<puerto>` o `localhost:<puerto>`. Si falta o es otro, 421. | `Host: evil.example:<puerto>`, `Host: 127.0.0.1:<otro puerto>`, `Host: localhost` sin puerto y sin `Host` se rechazan. |
| S3 | CSRF en todos los métodos no seguros | (1) `Origin` exactamente `http://127.0.0.1:<puerto>` o `http://localhost:<puerto>`; sin `Origin`, 403. (2) Si viene `Sec-Fetch-Site`, tiene que ser `same-origin`. (3) Header `X-Studio-Token` igual al token de sesión, comparado en tiempo constante; se exige en **todas** las rutas de `/api`, también en los GET. El servidor lo inyecta en el `index.html` que sirve: otra página no lo puede leer (política de mismo origen) ni obtener con rebinding (S2), y el header propio fuerza un preflight que nunca se aprueba (S4). (4) Los cuerpos solo se aceptan como `application/json`; si no, 415. | PUT/POST con `Origin` ajeno, sin `Origin`, sin token, con token incorrecto, con `Content-Type: text/plain` o con `Sec-Fetch-Site: cross-site` se rechazan sin efectos en disco. |
| S4 | Sin CORS | No se registra ningún middleware de CORS; ninguna respuesta lleva `Access-Control-Allow-*`. | Un preflight `OPTIONS` desde otro origen no recibe headers `Access-Control-Allow-*`. |
| S5 | Sin path traversal | El `id` se valida con el patrón del schema (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3–64 caracteres) **antes** de tocar el disco; los que empiezan con `_` se rechazan. Los nombres de archivo salen de una lista cerrada (`scenario.yaml`, `diagram.mmd`, `README.md`). Toda ruta resuelta (`path.resolve` + `path.relative`, y `realpath` para symlinks y junctions de Windows) tiene que quedar dentro de `content/scenarios/`. | (1) Ids inválidos (`..%2f`, `..\`, rutas absolutas `C:\…` y `\\?\…`, mayúsculas, unicode): 400 sin ninguna llamada al sistema de archivos. (2) Una junction o un symlink dentro de `content/scenarios/` con un id válido que apunta afuera: se rechaza después de `realpath`, sin leer ni escribir el destino. |
| S6 | Límite de tamaño del body | `bodyLimit` de 1 MiB (el escenario más grande pesa unos 20 KB). | Un body de 1 MiB + 1 byte devuelve 413. |
| S7 | Escritura atómica | Se escribe en un archivo temporal en la misma carpeta (patrón `*.studio-tmp`, ignorado por git) y se hace `rename`, con reintentos ante `EPERM`/`EBUSY` en Windows. Ante un error se borra solo ese temporal. | Si la escritura falla antes del `rename`, el archivo original queda intacto y no quedan temporales. |
| S8 | Nunca borrar ni pisar a ciegas | Sin rutas para borrar ni renombrar escenarios. Crear usa `mkdir` exclusivo: si la carpeta existe, 409. Guardar exige el hash del archivo tal como se leyó: si cambió en disco desde entonces, 409 y no se escribe. | Guardar con un hash viejo o sin hash devuelve 409 y el archivo no cambia; crear un `id` existente devuelve 409. |
| S9 | Headers de seguridad | `Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'` (CodeMirror y React Flow usan estilos inline), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`. | Los headers están en `/` y en `/api/*`. |
| S10 | Validación en la frontera | Zod en cada request y respuesta. Antes de escribir, el servidor revalida YAML y schema, y que el `id` del contenido sea igual al de la ruta. Un escenario con `status: draft` se guarda aunque no pase el schema ni el lint, si el YAML parsea y el `id` es el de la ruta; en ese caso no se regeneran `diagram.mmd` ni `README.md`, y la respuesta lo dice ([Enmiendas, 2026-10-05](#enmiendas)). | Un YAML con error de sintaxis devuelve 422 sin escribir, aunque sea un borrador. Un escenario que no es borrador y no pasa el schema devuelve 422 sin escribir. Un borrador que no pasa el schema se guarda (200) sin regenerar los archivos generados. Un `id` distinto al de la ruta devuelve 422 sin escribir, también en un borrador. |
| S11 | Sin procesos en F2 | El servidor no ejecuta procesos (`child_process`, `execFile`, `spawn`, `exec`, `fork`). Una regla de ESLint `no-restricted-imports` sobre `node:child_process` y `child_process` en `apps/studio/server` lo impide. Crear el PR con `gh` (RF-STU-15, F5) revisa esta regla con un ADR propio. | `pnpm lint` falla con un archivo de prueba que importa `node:child_process` en `apps/studio/server`. |
| S12 | El token no se filtra | El token se genera con 32 bytes aleatorios en cada arranque, vive solo en memoria y **nunca** se escribe en logs, mensajes de error ni archivos, tampoco en modo desarrollo. | Dos arranques generan tokens distintos; capturando la salida del servidor durante una sesión completa (incluido un error), el token no aparece. |

`apps/studio/README.md` enlaza esta sección y la mantiene como lista de verificación para todo cambio en `apps/studio/server`.

## Alternativas consideradas
- **El Studio abre `apps/web` en un iframe o en otra pestaña con el borrador inyectado**: fidelidad total sin refactor, pero el juego publicado necesitaría una ruta que acepte escenarios por `postMessage` (superficie en producción que habría que excluir del build), el preview escribiría el progreso local del juego salvo que se agreguen ramas de "modo preview" dentro del juego, y `pnpm studio` tendría que levantar dos servidores y usar un bundle de contenido que puede estar desactualizado. Descartada.
- **El Studio importa el código de `apps/web` (alias de Vite o dependencia de workspace)**: sin refactor, pero arrastra el router y el store de progreso de la web y rompe los límites entre apps. Descartada.
- **Preview propio del Studio con el mismo `diagram` y `game-engine`**: dos pantallas de juego que divergen con el tiempo; contradice "el preview es exactamente el juego". Descartada.
- **Formulario como fuente de verdad (objeto JS) y YAML regenerado**: más simple de sincronizar, pero cada guardado reformatea el archivo y pierde los comentarios. Descartada.
- **CSRF solo con el middleware `csrf` de Hono**: valida `Origin` solo para los content types de formularios; no cubre `application/json` ni otros métodos. Por eso S3 combina `Origin`, `Sec-Fetch-Site` y un token.

## Consecuencias
- El primer PR de F2 es un refactor sin cambios de comportamiento: los archivos se mueven con `git mv` en un commit de solo movimientos, separado de los commits que cambian código. El e2e del juego es la red de seguridad.
- El juego y el preview no pueden divergir: cualquier cambio en la pantalla de juego llega a los dos.
- `packages/play` es el único paquete de UI que puede importar `game-engine`.
- El servidor del Studio tiene reglas de seguridad numeradas y probadas; cambiarlas requiere un ADR nuevo.
- Las dependencias pesadas del Studio no afectan el bundle del juego (RNF-03), y eso queda verificado en CI.

## Enmiendas

### 2026-10-05 · El editor visual dibuja un borrador de la geometría (§2, "YAML inválido a medio escribir")
**Motivo.** Crear un elemento rompe el schema en el acto: un casillero nuevo nace con `role: ""` y `answers: []`, y un actor o una arista con `label: ""`, igual que en el formulario. Si el editor visual (RF-STU-04) dibujara solo el último escenario válido, el elemento recién creado no aparecería en el canvas, o el canvas quedaría en solo lectura hasta completar las respuestas.

**Precisión.**
- El editor visual dibuja un **borrador de la geometría** del bloque `diagram`, validado con un schema Zod **permisivo** en `@blueprint/scenario-schema`: ids, `type`, `position`, `group`, `rect`, `parent`, `from`/`to`/`step`, con los textos opcionales. Ese schema no reemplaza a `DiagramSchema` ni lo usa nadie más que el editor.
- Los elementos incompletos (los que no pasan el schema completo) se dibujan igual y se marcan con ⚠ (ícono y texto, no solo color). Un elemento que ni siquiera tiene la geometría válida no se dibuja, y el editor dice cuántos quedaron afuera.
- El **preview** y la vista de **respuestas** siguen usando el último escenario válido, sin cambios.
- Si el YAML **no parsea**, el canvas queda en solo lectura con el último borrador válido y el aviso de la línea del error, como el resto de las vistas.
- Las ediciones del canvas siguen siendo comandos sobre el `Document` por el path más fino (una sola pila de deshacer); el borrador solo cambia qué se dibuja, no cómo se edita.

### 2026-10-05 · Un borrador se guarda aunque no pase el schema (§4, S10)
**Motivo.** En uso real, un escenario nuevo o a medio escribir no pasa el schema durante un buen rato (un casillero sin respuestas, un objetivo sin texto), y S10 impedía guardarlo: el trabajo quedaba solo en la memoria del navegador hasta completar todo. El lint ya no bloqueaba el guardado; el schema sí.

**Precisión.**
- Si el YAML **parsea**, su `status` es `draft` y su `id` es igual al de la ruta, el servidor lo guarda **aunque no pase el schema ni el lint**. En ese caso **no** regenera `diagram.mmd` ni `README.md` (el generador necesita un escenario válido) y la respuesta lo dice (`generatedSkipped: true`), para que la UI avise que quedaron sin regenerar.
- Un YAML que **no parsea** se sigue rechazando con 422, sea o no un borrador: sin un documento no hay `status` ni `id` que verificar.
- Un `id` distinto al de la ruta se sigue rechazando con 422, también en un borrador.
- Para un escenario que **no** es `draft`, S10 queda como estaba: tiene que pasar el schema, y el lint no bloquea.
- No cambian Zod en la frontera (request y respuesta), el límite de tamaño (S6) ni el control del hash (S8).
- Un borrador inválido guardado en `content/` hace fallar `pnpm content:validate` y el CI hasta que se corrija, como cualquier otro error: la enmienda solo evita perder trabajo en la copia local del autor.

### 2026-10-07 · `GameHost` guarda la partida en curso (§1, RF-PLAY-18)
**Motivo.** La partida vivía solo en la memoria de la pantalla: recargar la perdía y, de paso, borraba los errores, las pistas usadas y las soluciones vistas, así que recargar permitía rehacer el escenario con puntaje completo. Guardarla es algo propio de cada app (la web la guarda, el preview del Studio no), así que entra por el puerto.

**Precisión.**
- `GameHost` suma tres miembros opcionales:

  ```ts
  loadAttempt?(scenarioId: string): SavedAttempt | null; // web: localStorage, validado con Zod
  saveAttempt?(attempt: SavedAttempt): void;             // después de cada comando aceptado
  clearAttempt?(scenarioId: string): void;               // «Finalizar», «Empezar de nuevo»
  ```

  Sin ellos cada visita empieza de cero: el Studio no los pasa.
- `SavedAttempt` (`game-engine`) es `{ scenarioId, version, commands }`: la lista de comandos que el motor aceptó, sin `selectSlot` (no es progreso). No se guarda el estado derivado. Al abrir, `resumeAttempt` vuelve a aplicar los comandos con el mismo reductor; si la `version` del escenario cambió, o un comando ya no se aplica, la partida se descarta. Así el puntaje reconstruido sale de las mismas reglas y recargar no lo mejora.
- `loadAttempt` es **síncrono**: la pantalla arma la sesión antes de su primer render y no muestra un tablero vacío que después cambia. Un almacenamiento remoto (F4) carga la partida antes de montar la pantalla.
- La validación de lo guardado (Zod) es del host, en la frontera del almacenamiento; el motor sigue sin IO.

## Referencias
- Hono — [Node.js (`@hono/node-server`)](https://hono.dev/docs/getting-started/nodejs), [Body Limit](https://hono.dev/docs/middleware/builtin/body-limit), [CSRF Protection](https://hono.dev/docs/middleware/builtin/csrf)
- OWASP — [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- MDN — [`Sec-Fetch-Site`](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site)
- `yaml` — [Documents](https://eemeli.org/yaml/#documents) (comentarios y edición por path)
- CodeMirror — [Accessibility / Tab handling](https://codemirror.net/examples/tab/)
