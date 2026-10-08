# 0028 · Content-Security-Policy del sitio

- Estado: Aceptado
- Fecha: 2026-10-08

## Contexto
RNF-10 pide una CSP estricta para el sitio, con `frame-ancestors 'none'`. El paso 2 de F3 creó la *response headers policy* propia de `infra/modules/static-site` con los headers de la beta y sin CSP ([issue #44](https://github.com/elissamburu/blueprint-the-game/issues/44)). El paso 5b la agrega en dos fases: primero en modo `Content-Security-Policy-Report-Only` (no bloquea, solo informa en la consola), después aplicada.

El sitio es estático (S3 + CloudFront, [ADR-0014](0014-infra-terraform-oidc.md)): el HTML no se genera por request, así que no hay *nonces* posibles.

Inventario del build de producción (`pnpm build:site`, `dist/site`), confirmado en el navegador con la política más estricta (`style-src 'self'`) y el e2e de este ADR:

| Necesidad | Evidencia | Resultado |
|---|---|---|
| Scripts | `index.html` solo tiene `<script type="module" src="/assets/…">` y `modulepreload`; ningún script inline. | `script-src 'self'` |
| `eval` | Zod 4 compila el parser de cada `z.object` con `new Function` (JIT) y antes lo prueba con `Function("")` al construir el schema (`zod/v4/core`, `allowsEval`). Con `'unsafe-eval'` ausente, en Report-Only lo reporta en cada schema; aplicada, Zod cae a su parser normal, pero la prueba sigue reportando. | `z.config({ jitless: true })` (decisión 3); sin `'unsafe-eval'` |
| `<style>` inyectado: sonner | `sonner` inserta su CSS al cargar el módulo (`__insertCSS`): un `<style>` vacío y después su texto. Texto **estático**. | violación de `style-src-elem` |
| `<style>` inyectado: react-remove-scroll-bar | Radix (Dialog, AlertDialog, DropdownMenu, Popover modal) usa `react-remove-scroll`, que con `react-style-singleton` inserta un `<style>` al abrirse. Su texto incluye el ancho de la barra de scroll y los márgenes del `body` **medidos en runtime**: distinto según el sistema, el navegador y el zoom. | violación de `style-src-elem`; no se puede hashear |
| Estilos en atributos | React, React Flow, dnd-kit y Radix escriben `style` por CSSOM (`element.style`), que la CSP no controla. Ningún `style="…"` en HTML parseado. | — |
| Imágenes | Íconos en `/icons/*.svg`, `favicon.svg`; React Flow dibuja el fondo y las flechas con SVG inline (`url(#id)` a elementos del documento, no recursos). Ningún `data:` ni `blob:` (las cadenas `data:`/`blob:` del bundle son de la lista de esquemas peligrosos de React Router). | `img-src 'self'` |
| Fuentes | Pila del sistema (Segoe UI…): ningún `@font-face` ni `.woff2`. | `font-src 'self'` |
| Fetch / XHR | El bundle de contenido (`fetch("/content/…")`) y el polyfill de `modulepreload` de Vite, ambos del mismo origen. Sin WebSocket, EventSource ni `sendBeacon`. | `connect-src 'self'` |
| Workers, service worker, manifest | No hay. | `default-src 'self'` los cubre; `manifest-src 'self'` explícito |
| Orígenes externos | GitHub (feedback, reportar un problema, repositorio), licencias, íconos de AWS y React Flow: solo enlaces `<a href>` que se abren en otra pestaña. Ninguna carga de otro origen. | — |
| Formularios | Ningún formulario navega: el único `<form>` (`ConnectDialog` de `@blueprint/diagram`) hace `preventDefault`. | `form-action 'none'` |

## Decisión

### 1. La política
```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

La única fuente que no es `'self'` ni `'none'` es **`'unsafe-inline'` en `style-src`**, por react-remove-scroll-bar: su `<style>` cambia con cada entorno, y un hash o un nonce desactivan `'unsafe-inline'` en la misma directiva, así que no se pueden combinar para cubrir también a sonner. El riesgo que habilita es inyectar CSS si alguna vez hubiera una inyección de HTML, y queda acotado:
- React escapa todo el texto y la web no usa `dangerouslySetInnerHTML`.
- La forma conocida de sacar datos con CSS (selectores de atributos + `url()` a un servidor ajeno) no sale del sitio: `img-src`, `font-src` y `connect-src` solo permiten el mismo origen.
- Scripts siguen en `'self'`, sin `'unsafe-inline'` ni `'unsafe-eval'`.

Sin `report-uri` ni `report-to`: no hay endpoint. Las violaciones se ven en la consola del navegador ([guía de forks](../guias/configurar-aws-en-tu-fork.md#revisar-la-content-security-policy)).

### 2. Una sola fuente, dos lectores
La política vive en `tools/deploy-site/cloudfront/content-security-policy.txt`, una directiva por línea, al lado de la CloudFront Function. La leen:
- **Terraform** (`infra/modules/static-site/locals.tf`), que la une con `"; "` y la pone en la *response headers policy*;
- el **preview server** (`pnpm preview:site`, `tools/deploy-site/src/csp.ts`), que la une igual y la manda en cada respuesta, errores incluidos, como hace CloudFront.

`csp.ts` además falla si la política tiene `'unsafe-eval'`, `'unsafe-inline'` en `script-src*`, `report-uri`/`report-to`, una directiva repetida o mal formada, o más de 1.783 caracteres; Terraform repite el límite de largo como `precondition`.

**Fase 1** (este ADR): el valor va como *custom header* `Content-Security-Policy-Report-Only`, con `override = true`. `Report-Only` no es uno de los *security headers* de la política (`content_security_policy` siempre manda `Content-Security-Policy`); CloudFront agrega cualquier *custom header* a todas las respuestas, con un valor de hasta 1.783 caracteres ([Understand response headers policies, Custom headers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-response-headers-policies.html#understanding-response-headers-policies-custom); [Quotas on headers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-custom-headers)).

**Fase 2** (otro PR): el mismo valor pasa a `security_headers_config.content_security_policy` (también hasta 1.783 caracteres) y el *custom header* se borra.

### 3. Zod sin JIT en el juego
`apps/web/vite.config.ts` resuelve `zod` (coincidencia exacta) a `apps/web/src/zod-jitless.ts`, que reexporta Zod después de `z.config({ jitless: true })` (documentación de `$ZodConfig.jitless` en `zod/v4/core`: «Disable JIT schema compilation. Useful in environments that disallow `eval`»; el README de Zod 4.6 lo indica para «CSP environments»). Zod lee la opción al construir cada schema, y los schemas se construyen al evaluar los módulos de `@blueprint/scenario-schema` y los demás paquetes, que Rolldown pone en un chunk compartido que se evalúa **antes** que el cuerpo de `main.tsx`. Con el alias, todo módulo del bundle que importa `zod` depende del que lo configura, así que el orden queda garantizado por ESM. Studio y las herramientas de Node no cambian.

### 4. Prueba
`apps/web/e2e/site/csp.spec.ts` (proyecto `site` de Playwright, en el job `e2e` de CI) corre contra el preview server sobre `dist/site`, que `pnpm e2e` arma con `site:assemble`. Registra `securitypolicyviolation` con `addInitScript` en todas las pestañas y recorre: home y onboarding, `/escenarios` con recarga, el brief (diálogo), arrastrar una carta a un casillero, el popover de pistas, el menú «⋯» y la versión imprimible en otra pestaña en modo impresión. Falla con cualquier violación, aunque la política solo reporte. Una actualización de sonner, Radix o Zod que cambie lo que inyectan la rompe.

## Alternativas consideradas
- **Hashes para los `<style>`**: sirven para sonner (texto fijo) pero no para react-remove-scroll-bar. Un hash, además, apaga `'unsafe-inline'` en la directiva.
- **Separar `style-src-elem 'self' 'unsafe-inline'` de `style-src-attr 'none'`**: quien pueda inyectar HTML puede inyectar un `<style>`, así que bloquear solo los atributos casi no agrega protección, y en navegadores sin `style-src-elem` (que caen a `style-src`) los toasts quedarían sin estilos al aplicarla.
- **Nonce fijo** (`__webpack_nonce__` de `get-nonce`): en un sitio estático sería el mismo para todos y público en el bundle; equivale a `'unsafe-inline'` con más piezas.
- **Sacar el bloqueo de scroll de Radix** (`modal={false}`): cambia el comportamiento accesible de los diálogos (foco atrapado, `aria-modal`).
- **`z.config` en `main.tsx`**: corre después de los schemas de los chunks compartidos; el e2e lo mostró.
- **`output.strictExecutionOrder` de Rolldown** o **`import()` dinámico de la app**: el primero cambia cómo se empaqueta todo el bundle; el segundo agrega una cascada de carga antes del primer render.
- **CSP en `<meta>`**: no admite `frame-ancestors` ni Report-Only, y duplicaría la fuente.

## Consecuencias
- El plan de este cambio cambia en el lugar la *response headers policy* (el *custom header* y su `comment`) y la función (un comentario de su código la republica): `0 to add, 2 to change, 0 to destroy`. El rol `gh-apply` necesita el ID de la política en `cloudfront_response_headers_policy_ids` (paso 4 de F3).
- `'unsafe-inline'` en `style-src` queda hasta que el juego no dependa de un `<style>` dinámico. Si Radix deja de inyectarlo, se reemplaza por el hash de sonner.
- La política de los dos lectores es la misma por construcción; el test de Terraform y el de `csp.ts` verifican el formato, y el e2e la usa tal cual la sirve el preview.
- `X-Frame-Options: SAMEORIGIN` sigue (el de la beta). Con la fase 2, `frame-ancestors 'none'` manda en los navegadores con CSP.
