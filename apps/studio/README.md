# Blueprint Studio

Editor local de escenarios ([ADR-0013](../../docs/adr/0013-scenario-studio-local-con-ia.md), [ADR-0025](../../docs/adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md)). Corre en tu máquina, escucha solo en `127.0.0.1` y lee y escribe `content/scenarios/` de tu copia del repo. **Nunca se despliega** (RF-STU-18): no entra en `pnpm build:beta` ni en `pnpm deploy:beta` (lo verifica `tools/deploy-beta/src/studio-excluded.test.ts`).

Qué hace hoy (F2, PR 4): listar los escenarios, abrir uno, editar su `scenario.yaml` con un formulario (metadatos, contexto, objetivos, casilleros, grupos, nodos y aristas) o en el YAML, con validación en vivo (schema + lint, los mismos mensajes que `pnpm content:validate`), jugar el borrador y ver todas sus respuestas, y guardarlo regenerando `diagram.mmd` y `README.md`. El editor visual del diagrama llega en el PR siguiente del [roadmap](../../docs/05-roadmap.md).

## Uso

```powershell
pnpm studio
```

Compila la UI, levanta el servidor e imprime la dirección (`http://127.0.0.1:4320`). Abrila en el navegador. `Ctrl+C` lo cierra.

| Variable | Default | Para qué |
|---|---|---|
| `STUDIO_PORT` | `4320` | Puerto. Si está ocupado, el Studio no arranca (no busca otro). |
| `STUDIO_CONTENT_DIR` | `<repo>/content` | Carpeta de contenido. Relativa a donde corrés `pnpm`. Útil para probar sobre una copia. |

El host no se configura: siempre es `127.0.0.1` (S1).

```powershell
# Probar sobre una copia, sin tocar content/
Copy-Item -Recurse content "$env:TEMP\content-studio"
$env:STUDIO_CONTENT_DIR = "$env:TEMP\content-studio"; pnpm studio
Remove-Item Env:STUDIO_CONTENT_DIR
```

### Editar
- La lista muestra título, nivel, estado y si el escenario tiene errores. Cada título abre el editor.
- El editor guarda el texto **tal cual**: no reformatea ni pierde comentarios. Abrir y guardar sin cambios deja el archivo idéntico byte a byte (también con CRLF).
- La validación corre 250 ms después de cada cambio. Cada problema del panel es un botón que lleva el cursor a su línea. L012 y L014 no corren en el Studio: guardar regenera los archivos generados, y L014 queda en `pnpm content:validate --base origin/main` y en el CI.
- **Guardar** (o `Ctrl+S`) revalida en el servidor: un YAML con errores de sintaxis, que no pasa el schema o cuyo `id` no es el nombre de la carpeta no se guarda. Los errores de lint no impiden guardar un borrador.
- Si el archivo cambió en disco desde que lo abriste (otro editor, un `git pull`), el Studio **no lo pisa**: avisa y ofrece recargar.
- Con cambios sin guardar, el navegador y el Studio preguntan antes de salir.

### Formulario
- Primera pestaña del panel izquierdo (RF-STU-03), en secciones que se expanden y contraen: **Metadatos** (el `id` es de solo lectura), **Contexto**, **Objetivos** (agregar, quitar y reordenar) y **Casilleros** (rol, pistas, respuestas con servicio, grado, objetivos vinculados, rationale y referencias, e incorrectos con servicio, rationale y objetivos que viola), **Grupos**, **Nodos** y **Aristas**.
- Grupos, nodos y aristas son la alternativa por teclado al editor visual: crear y borrar, tipo, etiqueta, padre o grupo, la caja en números (`x`, `y`, `w`, `h`), y aristas con «Desde», «Hacia» y «Paso». «Subir paso» y «Bajar paso» mueven una arista un lugar en el flujo (sola en su paso, se suma en paralelo al vecino; compartiendo el paso, queda sola antes o después) y renumeran los pasos sin huecos. Quitar un nodo quita sus aristas; quitar un grupo deja a sus nodos sin grupo y a sus grupos hijos bajo su padre, en un solo cambio.
- El YAML sigue siendo la fuente de verdad ([ADR-0025 §2](../../docs/adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md#2-modelo-de-edición-del-studio)): cada cambio del formulario es un comando sobre el documento por su path (un escalar, o agregar, quitar o mover un ítem de una lista) y cambia solo las líneas de ese nodo; los comentarios y el formato del resto quedan como estaban. Si un cambio no puede quedar acotado, se amplía al nodo padre: nunca se escribe un resultado distinto del pedido.
- Formulario y YAML comparten **una sola pila de deshacer**: `Ctrl+Z` (y `Ctrl+Y` o `Ctrl+Mayús+Z`) en cualquiera de los dos deshace el último cambio, venga de donde venga.
- El servicio se elige del catálogo con un buscador (nunca texto libre). Quitar algo pide confirmación; mover y quitar se anuncian para lectores de pantalla.
- Si el YAML no parsea, el formulario muestra la última versión válida en solo lectura, con la línea del error. Si parsea pero no pasa el schema, sigue editable.
- Con el formulario visible, cada problema del panel de validación lleva a su campo (abre las secciones y lo enfoca); el campo muestra el mensaje. Lo que el formulario no edita (paleta, referencias generales, el canvas) lleva a la línea del YAML.

### Diagrama
- Segunda pestaña (RF-STU-04): el editor visual del diagrama, con una **paleta** de tipos de nodo y de grupo, el **canvas** y el **inspector** de la selección. Cada cambio es un comando sobre el documento, igual que en el formulario: el YAML sigue siendo la fuente de verdad, cambia solo lo que se tocó y hay una sola pila de deshacer.
- El canvas dibuja un **borrador de la geometría** ([ADR-0025, enmienda del 2026-10-05](../../docs/adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md#enmiendas)): un elemento recién creado se ve aunque todavía no pase el schema, marcado con ⚠ «Incompleto»; los que tienen problemas del panel de validación se marcan con ✗ o ⚠. Si el YAML no parsea, el canvas y el inspector quedan en solo lectura con la línea del error.
- **Con mouse**: arrastrar un nodo, o un grupo desde su etiqueta; cambiar el tamaño de un grupo seleccionado con sus asas; arrastrar desde el asa (●) de un nodo hasta otro para conectarlos; arrastrar un tipo de la paleta al canvas, o elegirlo para crearlo en el centro de la vista. Lo que se suelta se ajusta a una grilla de 10.
- Al mover un nodo o un grupo, su **grupo se actualiza solo**: mientras siga entero dentro del suyo, no cambia; si sale o cae dentro de otro, pasa al grupo más interno que lo contiene (o a ninguno), y el cambio se anuncia. Mover un grupo mueve lo que tiene adentro.
- **Conectar sin arrastrar**: con un nodo seleccionado, «Conectar con…» (o `C`) abre la lista de los otros nodos, con buscador. La arista nueva va al final del flujo y el foco pasa a su etiqueta en el inspector.
- El **inspector** tiene los mismos campos del formulario para el elemento seleccionado y los avisos que ningún campo muestra. Las respuestas de un casillero se editan en el formulario («Editar respuestas en el formulario»). Sin selección, muestra el flujo: las aristas por paso, cada una lleva a su arista.
- Eliminar siempre pide confirmación y dice qué más se va: las aristas de un nodo; los nodos de un grupo quedan sin grupo.
- **Ordenar** (RF-STU-05) acomoda el diagrama solo, de izquierda a derecha en el orden de los pasos, con los grupos alrededor de sus nodos. Cambia únicamente posiciones, rects y el tamaño del canvas (nunca ids, textos, grupos, aristas ni pasos), en una sola edición: un `Ctrl+Z` la deshace entera. Después dice cuántos nodos y grupos se reubicaron, con «Deshacer» mientras sea la última edición, o «Ya está ordenado». Si hay grupos hermanos superpuestos (quizás a propósito), pregunta antes nombrándolos, porque al ordenar quedan separados. El auto-layout ([elkjs](https://github.com/kieler/elkjs), EPL-2.0) se carga recién al usarlo.

- Diagramas hechos con [React Flow (xyflow)](https://reactflow.dev/). El editor oculta la atribución de React Flow dentro del canvas (sería una parada de `Tab` entre `Esc` y la salida); el crédito queda acá y en la página «Acerca de» del juego, como pide su [política de atribución](https://reactflow.dev/api-reference/types/pro-options).

### Jugar y Respuestas
- A la izquierda del editor, dos pestañas más sobre el **borrador** (el último texto que pasa el schema, no el archivo en disco). Si el YAML no parsea o no pasa el schema, muestran la última versión válida con un aviso que lleva a la línea del error.
- **Jugar** (RF-STU-08) es la pantalla de juego de `@blueprint/play`, la misma de la web, con la paleta y las reglas del nivel. No guarda progreso ni ofrece reportar un problema ni la versión imprimible. Al finalizar, el resultado (puntaje y grado por casillero) queda en el mismo panel con «Reiniciar». Si el escenario cambia en medio de una partida, la partida sigue y un aviso ofrece reiniciar con la versión nueva.
- **Respuestas** (RF-STU-09) muestra el diagrama con el óptimo de cada casillero y, por casillero, los óptimos, aceptables e incorrectos con su grado, los objetivos, el porqué y la documentación: la misma lista que las hojas de solución de la versión imprimible.

### Teclado
- `Tab` indenta dentro del editor. Para salir del editor con el teclado: `Esc` y después `Tab` (o `Mayús+Tab`). La ayuda está visible arriba del editor.
- `Ctrl+S` guarda; `Ctrl+F` busca.
- Las pestañas Formulario, Diagrama, Jugar y Respuestas se cambian con las flechas; el foco queda en la pestaña. Cambiar de pestaña no corta la partida en curso ni cierra las secciones abiertas del formulario.
- En el diagrama, `Tab` y `Mayús+Tab` recorren los elementos en orden de lectura (grupos y nodos de arriba abajo y de izquierda a derecha, después las aristas por paso). Las flechas mueven la selección de a 10 (con `Mayús`, de a 1) y, sin selección, desplazan el canvas; `Alt`+flechas cambian el tamaño de un grupo; `C` conecta; `Supr` elimina (con confirmación); `Enter` lleva al inspector; `Alt+Re Pág` y `Alt+Av Pág` cambian el paso de una arista. Para salir del diagrama: `Esc` y después `Tab` (o `Mayús+Tab`); la ayuda está visible debajo del canvas. Los atajos de una tecla solo actúan con el foco en el canvas o en un elemento, nunca en un campo de texto.
- En el formulario, cada campo tiene su etiqueta y todo se opera con `Tab`, `Enter` y `Espacio`; las acciones de un ítem (Subir, Bajar, Quitar) están en su encabezado, antes de sus campos. En el buscador de servicios, las flechas recorren la lista, `Enter` elige y `Esc` cierra.

### Desarrollo

```powershell
pnpm dev           # juego + Studio (turbo), con recarga en caliente
pnpm dev:studio    # solo el Studio, con recarga en caliente
pnpm --filter @blueprint/studio test
pnpm e2e:studio    # Playwright contra pnpm studio sobre una copia temporal de content/
```

Los tests nunca usan el `content/` real para escribir: copian el contenido a una carpeta temporal.

## Seguridad: lista de verificación S1–S12

Las reglas están en [ADR-0025 §4](../../docs/adr/0025-studio-preview-con-packages-play-y-servidor-local-endurecido.md#4-seguridad-del-servidor-local). **Todo cambio en `apps/studio/server` revisa esta lista**; cambiar una regla requiere un ADR nuevo.

| # | Regla | Dónde | Tests |
|---|---|---|---|
| S1 | Escucha solo en `127.0.0.1`; solo el puerto es configurable. | `server/config.ts` (`HOST`), `server/server.ts` | `server/cli.test.ts` |
| S2 | `Host` exactamente `127.0.0.1:<puerto>` o `localhost:<puerto>`; si no, 421. | `server/security.ts` (`hostGuard`) | `server/security.test.ts` |
| S3 | `Origin` propio en métodos no seguros, `Sec-Fetch-Site: same-origin` si viene, `X-Studio-Token` en toda `/api` (comparación en tiempo constante), cuerpos solo `application/json` (415). | `server/security.ts` (`apiGuard`), `server/static.ts` (token en `index.html`) | `server/security.test.ts` |
| S4 | Sin CORS: ninguna respuesta lleva `Access-Control-Allow-*`. | `server/app.ts` (no se registra CORS) | `server/security.test.ts` |
| S5 | `id` validado con el patrón del schema antes de tocar el disco; nombres de archivo de una lista cerrada; rutas dentro de `content/scenarios/` también después de `realpath` (symlinks y junctions). | `server/routes/scenarios.ts`, `server/paths.ts` | `server/scenarios.test.ts` |
| S6 | Cuerpo de 1 MiB como máximo (413). | `server/app.ts` (`bodyLimit`) | `server/security.test.ts` |
| S7 | Escritura atómica: temporal `*.studio-tmp` en la misma carpeta + `rename`, con reintentos ante `EPERM`/`EBUSY`. | `server/atomic-write.ts` | `server/atomic-write.test.ts` |
| S8 | Sin rutas para borrar ni renombrar; guardar exige el hash con que se abrió el archivo (409 si falta o cambió). | `server/content-store.ts`, `server/routes/scenarios.ts` | `server/scenarios.test.ts` |
| S9 | `Content-Security-Policy`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer` en `/`, `/api/*` y los errores. | `server/security.ts` (`securityHeaders`) | `server/security.test.ts` |
| S10 | Zod en cada request y respuesta; antes de escribir se revalidan YAML, schema e `id` (422). | `shared/api.ts`, `shared/validation.ts`, `server/content-store.ts` | `server/scenarios.test.ts` |
| S11 | El servidor no ejecuta procesos (`child_process`). | `eslint.config.js` (`no-restricted-imports`), `.dependency-cruiser.cjs` (`studio-server-no-processes`) | `server/lint-rules.test.ts` |
| S12 | Token de 32 bytes por arranque, solo en memoria; nunca en logs, errores ni archivos. | `server/security.ts` (`createToken`), `server/cli.ts`, `server/app.ts` (`onError`) | `server/cli.test.ts` |

Cada test lleva el id de su regla en el nombre (`it("S2: rejects …")`): `pnpm --filter @blueprint/studio exec vitest run -t "S5:"` corre los de una regla.

### Junctions de Windows (S5)

`server/scenarios.test.ts` crea una **junction** en Windows y un **symlink** de carpeta en Linux, así que el CI la prueba en los dos sistemas (el job `checks` corre en `ubuntu-latest` y `windows-latest`). Para probarlo a mano en Windows:

```powershell
$tmp = Join-Path $env:TEMP "studio-s5"
Copy-Item -Recurse content "$tmp\content"
New-Item -ItemType Directory -Force "$tmp\afuera" | Out-Null
(Get-Content content\scenarios\static-website-https\scenario.yaml -Raw).Replace("id: static-website-https", "id: escape-link") | Set-Content "$tmp\afuera\scenario.yaml" -NoNewline
New-Item -ItemType Junction -Path "$tmp\content\scenarios\escape-link" -Target "$tmp\afuera" | Out-Null
$env:STUDIO_CONTENT_DIR = "$tmp\content"; pnpm studio
```

Abrí `http://127.0.0.1:4320/escenarios/escape-link`: tiene que decir que el escenario apunta fuera de `content/scenarios/`, y `escape-link` no aparece en la lista. Después: `Remove-Item Env:STUDIO_CONTENT_DIR; Remove-Item -Recurse -Force $tmp`.

## Modo desarrollo (Vite)

En `pnpm dev` y `pnpm dev:studio` el HTML y los módulos los sirve Vite con recarga en caliente, y la misma app de Hono corre dentro del proceso de Vite para `/api` e `/icons` (`vite.config.ts`). El modo normal (`pnpm studio`) cumple las doce reglas sin excepciones. En modo dev:

| Regla | Cómo queda |
|---|---|
| S1 | Igual: `server.host: "127.0.0.1"` fijo, `strictPort: true`, puerto `STUDIO_PORT`. |
| S2 | Un middleware que corre antes que los de Vite exige el `Host` exacto en **todas** las respuestas, también los módulos (421). Los hosts que no son una IP ni `localhost` ya los rechaza antes el chequeo propio de Vite, con 403. |
| S3, S6, S7, S8, S10 | Iguales: la API es la misma app de Hono. El token se inyecta en el `index.html` con `transformIndexHtml`. |
| S4 | Igual: `server.cors: false` y Hono sin CORS. |
| S5 | Igual para `/api`. Vite sirve el código fuente del repo (es su función), pero `/@fs/` queda limitado al repo (`server.fs.strict` y `server.fs.allow: [repo]`, con la lista de Vite que niega `.env` y certificados). |
| S9 | Los tres headers en todas las respuestas, con otra CSP: `script-src 'self' 'nonce-…'` (el preámbulo inline de React Fast Refresh lleva un nonce por proceso, `html.cspNonce` de Vite) y `connect-src` con el websocket de HMR del mismo host. Sigue sin `'unsafe-inline'` ni `'unsafe-eval'` en scripts. |
| S11 | Igual (la regla de ESLint aplica a `server/`). |
| S12 | Igual: el token se genera al arrancar y no se imprime; Vite no lo muestra. |

## Probar a mano

1. `pnpm studio` y abrir la dirección que imprime.
2. Abrir un escenario, romper el YAML (por ejemplo, escribir `roto: [` en una línea vacía): el panel muestra el error con su línea; el botón lleva el cursor ahí.
3. Corregirlo, guardar y ver "Guardado". `git diff` muestra solo tu cambio y, si cambió algo visible, `README.md`/`diagram.mmd` regenerados. `pnpm content:validate` pasa.
4. Con un cambio sin guardar, editar el mismo `scenario.yaml` en otro editor y guardar en el Studio: aparece "El archivo cambió en disco" y el archivo no se pisa.
5. Solo con teclado: `Tab` hasta el editor, `Esc` + `Tab` para salir, `Tab` hasta un problema del panel y `Enter`.
