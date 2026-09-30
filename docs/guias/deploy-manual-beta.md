# Guía · Deploy manual de la beta pública (S3 + CloudFront)

> ⚠️ **Esto es temporal.** Esta guía publica la primera beta a mano, con el AWS CLI, para no esperar a la infraestructura definitiva. La reemplaza la fase **F3** del [roadmap](../05-roadmap.md): Terraform (`infra/`) y `deploy.yml` con OIDC, sin credenciales de larga vida ([ADR-0014](../adr/0014-infra-terraform-oidc.md), [guía de forks](configurar-aws-en-tu-fork.md)). Cuando F3 esté lista, los recursos creados acá se importan a Terraform o se borran (ver [§11](#11-qué-pasa-con-esto-en-f3)), y esta guía y `tools/deploy-beta` se eliminan.
>
> **Estado de la guía:** los comandos están escritos contra la documentación oficial de AWS (enlazada en cada paso) y contra los esquemas de entrada del AWS CLI v2, pero **todavía no se ejecutaron de punta a punta en una cuenta**. Si alguno falla en el primer deploy, corregilo en esta guía en el mismo momento.

Tiempo estimado: 45–60 minutos, más lo que tarde la delegación del dominio (si usás uno propio).

## Qué vas a crear

```
Tu cuenta de AWS
├── Bucket S3 privado            ← el sitio: la app, /content e /icons
├── CloudFront Function          ← reescribe las rutas del juego a /index.html
├── Origin Access Control (OAC)  ← CloudFront firma los pedidos al bucket
├── Distribución de CloudFront   ← HTTPS, HTTP/2 y HTTP/3, compresión, headers de seguridad
├── Alarma de AWS Budgets        ← aviso por mail
└── (opcional) dominio propio: hosted zone de Route 53 + certificado de ACM + registros alias
```

Nada de esto tiene costo fijo por hora (RNF-05). La única excepción es la hosted zone de Route 53, que se cobra por mes, y solo si usás dominio propio.

**Se puede publicar primero con el dominio de CloudFront** (`dxxxxxxxxxxxxx.cloudfront.net`) **y sumar el dominio propio después**: los pasos 2 y 7 son opcionales y no bloquean el lanzamiento.

## 0. Requisitos y variables

- AWS CLI **v2** y un perfil con credenciales **temporales** de administrador (p. ej. IAM Identity Center: `aws sso login --profile <perfil>`). No crees usuarios IAM con access keys (RNF-06).
- **PowerShell 7** (`pwsh`), Node y pnpm (los del repo), parado en la **raíz del repo**.
- No pegues account IDs, ARNs ni nombres de perfil en el repo: viven solo en las variables de tu sesión.

Definí las variables una vez por sesión. Todos los pasos las usan.

```powershell
$Profile     = "<tu-perfil>"                 # perfil del AWS CLI
$Region      = "us-east-1"                   # región del bucket
$BucketName  = "<nombre-único-del-bucket>"   # p. ej. blueprint-beta-<algo>; minúsculas, único en todo S3
$BudgetUsd   = "10"                          # presupuesto mensual, en USD
$BudgetEmail = "<tu-mail>"                   # a dónde llega la alarma

# Solo si vas a usar dominio propio (pasos 2 y 7):
$Domain      = "<beta.tu-dominio.com.ar>"    # nombre con el que se va a entrar al sitio
$ZoneName    = "<tu-dominio.com.ar>"         # dominio registrado (la hosted zone)

aws sts get-caller-identity --profile $Profile   # confirmá que es la cuenta correcta
$AccountId = aws sts get-caller-identity --query Account --output text --profile $Profile
```

> `$Profile` pisa, solo en esta sesión, la variable automática de PowerShell con la ruta de tu perfil de consola. No molesta; al cerrar la ventana vuelve a su valor.

Los archivos JSON de configuración están en [deploy-manual-beta/](deploy-manual-beta/), con placeholders `<ASI>`. Esta función los completa con tus valores y deja el resultado **fuera del repo**, en una carpeta temporal:

```powershell
$Work = Join-Path $env:TEMP "blueprint-beta"
New-Item -ItemType Directory -Force $Work | Out-Null

function Use-Template([string]$Name, [hashtable]$Values = @{}) {
  $text = Get-Content (Join-Path "docs/guias/deploy-manual-beta" $Name) -Raw
  foreach ($key in $Values.Keys) { $text = $text.Replace("<$key>", [string]$Values[$key]) }
  if ($text -match '<[A-Z_]+>') { throw "Falta completar $($Matches[0]) en $Name" }
  $path = Join-Path $Work $Name
  [IO.File]::WriteAllText($path, $text)   # UTF-8 sin BOM, como lo espera el AWS CLI
  "file://$path"
}
```

## 1. Bucket S3 privado

Privado, con el acceso público bloqueado, cifrado SSE-S3, versionado (para poder volver atrás, [§10](#10-cómo-volver-atrás)) y ownership `BucketOwnerEnforced` (sin ACLs; es lo que pide OAC, ver [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)).

```powershell
# Fuera de us-east-1 hay que indicar la región también como LocationConstraint.
if ($Region -eq "us-east-1") {
  aws s3api create-bucket --bucket $BucketName --region $Region --profile $Profile
} else {
  aws s3api create-bucket --bucket $BucketName --region $Region `
    --create-bucket-configuration "LocationConstraint=$Region" --profile $Profile
}

aws s3api put-public-access-block --bucket $BucketName --profile $Profile `
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-bucket-ownership-controls --bucket $BucketName --profile $Profile `
  --ownership-controls "Rules=[{ObjectOwnership=BucketOwnerEnforced}]"

aws s3api put-bucket-encryption --bucket $BucketName --profile $Profile `
  --server-side-encryption-configuration (Use-Template "bucket-encryption.json")

aws s3api put-bucket-versioning --bucket $BucketName --profile $Profile `
  --versioning-configuration "Status=Enabled"

# Las versiones viejas se borran solas a los 30 días: el versionado no acumula costo para siempre.
aws s3api put-bucket-lifecycle-configuration --bucket $BucketName --profile $Profile `
  --lifecycle-configuration (Use-Template "bucket-lifecycle.json")
```

Verificá:

```powershell
aws s3api get-public-access-block --bucket $BucketName --profile $Profile
aws s3api get-bucket-encryption --bucket $BucketName --profile $Profile
aws s3api get-bucket-versioning --bucket $BucketName --profile $Profile
aws s3api get-bucket-ownership-controls --bucket $BucketName --profile $Profile
```

## 2. (Opcional) Dominio propio: hosted zone y certificado

Salteá este paso si vas a lanzar con el dominio de CloudFront; podés volver después.

### 2.1 Hosted zone en Route 53 y delegación

```powershell
$ZoneId = (aws route53 create-hosted-zone --name $ZoneName `
  --caller-reference "blueprint-beta-$(Get-Date -Format yyyyMMddHHmmss)" `
  --query HostedZone.Id --output text --profile $Profile).Split("/")[-1]

# Los 4 servidores de nombres que hay que cargar en el registrador:
aws route53 get-hosted-zone --id $ZoneId --query DelegationSet.NameServers --output table --profile $Profile
```

Si ya tenés una hosted zone para ese dominio, no crees otra: buscá su ID con `aws route53 list-hosted-zones-by-name --dns-name $ZoneName --profile $Profile`.

**Delegá los NS desde el registrador.** El dominio sigue registrado donde está; solo cambia quién responde sus DNS:

- **Dominio `.ar` (NIC Argentina):** entrá a [nic.ar](https://nic.ar) con tu cuenta (el trámite corre por Trámites a Distancia), elegí el dominio, abrí **Delegaciones** y cargá los 4 servidores de nombres de Route 53 (sin el punto final), sin direcciones IP. Guardá y ejecutá los cambios. `TODO(verificar)`: los nombres exactos de los botones del panel de NIC Argentina no se verificaron contra su documentación; el dato que importa son los 4 NS.
- **Otro registrador:** reemplazá los *name servers* del dominio por esos 4.

La delegación puede tardar desde minutos hasta algunas horas. Comprobala:

```powershell
Resolve-DnsName $ZoneName -Type NS | Select-Object NameHost
```

Hasta que no responda con los servidores `awsdns`, el certificado del paso siguiente no se valida.

### 2.2 Certificado en ACM, en `us-east-1`

Para usarlo con CloudFront, el certificado **tiene que estar en `us-east-1`** (N. Virginia), sin importar la región del bucket ([Requirements for using SSL/TLS certificates with CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html)). Validación por DNS: ACM lo renueva solo mientras el registro exista.

```powershell
$CertArn = aws acm request-certificate --domain-name $Domain --validation-method DNS `
  --region us-east-1 --query CertificateArn --output text --profile $Profile

# El registro CNAME de validación (puede tardar unos segundos en aparecer; repetí si viene vacío).
$Record = aws acm describe-certificate --certificate-arn $CertArn --region us-east-1 --profile $Profile `
  --query "Certificate.DomainValidationOptions[0].ResourceRecord" --output json | ConvertFrom-Json
$Record

aws route53 change-resource-record-sets --hosted-zone-id $ZoneId --profile $Profile `
  --change-batch (Use-Template "acm-validation-record.json" @{ RECORD_NAME = $Record.Name; RECORD_VALUE = $Record.Value })

# Espera hasta que el certificado quede emitido (necesita la delegación del 2.1 funcionando).
aws acm wait certificate-validated --certificate-arn $CertArn --region us-east-1 --profile $Profile
```

## 3. CloudFront Function para las rutas del juego

El juego es una SPA: `/escenarios` o `/escenarios/<id>/resumen` no son archivos del bucket. Una función de *viewer request* sirve `/index.html` en toda ruta **sin extensión de archivo**, así recargar una ruta funciona. Las rutas con extensión (`/assets/*.js`, `/content/*.json`, `/icons/*.svg`) van al bucket tal cual: un archivo que falta sigue siendo un error (403), nunca la página de la app.

El código está en el repo, con su test: [tools/deploy-beta/cloudfront/spa-rewrite.js](../../tools/deploy-beta/cloudfront/spa-rewrite.js) (`pnpm --filter @blueprint/tools-deploy-beta test`). `pnpm preview:beta` sirve el build local pasando cada pedido por esa misma función.

```powershell
$FunctionName = "blueprint-beta-spa-rewrite"

aws cloudfront create-function --name $FunctionName --profile $Profile `
  --function-config (Use-Template "function-config.json") `
  --function-code fileb://tools/deploy-beta/cloudfront/spa-rewrite.js

# Publicarla (pasa de DEVELOPMENT a LIVE) y quedarse con su ARN.
$FunctionETag = aws cloudfront describe-function --name $FunctionName --query ETag --output text --profile $Profile
aws cloudfront publish-function --name $FunctionName --if-match $FunctionETag --profile $Profile
$FunctionArn = aws cloudfront describe-function --name $FunctionName --stage LIVE `
  --query FunctionSummary.FunctionMetadata.FunctionARN --output text --profile $Profile
```

Si más adelante cambia el código: `aws cloudfront update-function` (con el ETag actual, el mismo `--function-config` y `--function-code`) y otra vez `publish-function`.

Referencias: [CloudFront Functions event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html) y el ejemplo oficial [Add index.html to request URLs without a file name](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html) (runtime 2.0).

## 4. Distribución de CloudFront con Origin Access Control

Origin Access Control (no OAI, que es el mecanismo anterior), HTTPS obligatorio (HTTP redirige a HTTPS), HTTP/2 y HTTP/3, compresión, la función del paso 3 y dos políticas **administradas por AWS**:

| Política | ID | Qué hace | Fuente |
|---|---|---|---|
| Caché `CachingOptimized` | `658327ea-f89d-4fab-a63d-7e88639e58f6` | Clave de caché mínima (sin query strings ni cookies), Gzip y Brotli. TTL mínimo 1 s, por defecto 24 h, máximo 365 días: respeta el `Cache-Control` que sube `pnpm deploy:beta`. | [Use managed cache policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html#managed-cache-caching-optimized) |
| Headers de respuesta `SecurityHeadersPolicy` | `67f7725c-6f97-4210-82d7-5512b31e9d03` | Agrega `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` y `X-XSS-Protection: 1; mode=block`. **No incluye `Content-Security-Policy`** (ver [§9](#9-pendiente-content-security-policy-propia)). | [Use managed response headers policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-response-headers-policies.html#managed-response-headers-policies-security) |

Los dos IDs se verificaron contra esas páginas el 2026-09-30 (la documentación los da como "the ID for this policy" para el AWS CLI, sin variar por cuenta). Para confirmarlos en la tuya, pedí cada política por su ID y mirá el nombre que devuelve:

```powershell
aws cloudfront get-cache-policy --id 658327ea-f89d-4fab-a63d-7e88639e58f6 --profile $Profile `
  --query CachePolicy.CachePolicyConfig.Name --output text
aws cloudfront get-response-headers-policy --id 67f7725c-6f97-4210-82d7-5512b31e9d03 --profile $Profile `
  --query ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name --output text
```

Tienen que nombrar a `CachingOptimized` y a `SecurityHeadersPolicy`. Si alguno falla, listá las administradas (`aws cloudfront list-cache-policies --type managed`, `aws cloudfront list-response-headers-policies --type managed`) y corregí el ID en [distribution-config.json](deploy-manual-beta/distribution-config.json) antes de seguir.

```powershell
$OacId = aws cloudfront create-origin-access-control --profile $Profile `
  --origin-access-control-config (Use-Template "origin-access-control.json" @{ BUCKET_NAME = $BucketName }) `
  --query OriginAccessControl.Id --output text

$Distribution = aws cloudfront create-distribution --profile $Profile --output json `
  --distribution-config (Use-Template "distribution-config.json" @{
    CALLER_REFERENCE = "blueprint-beta-$(Get-Date -Format yyyyMMddHHmmss)"
    BUCKET_NAME      = $BucketName
    REGION           = $Region
    OAC_ID           = $OacId
    FUNCTION_ARN     = $FunctionArn
  }) | ConvertFrom-Json

$DistributionId     = $Distribution.Distribution.Id
$DistributionDomain = $Distribution.Distribution.DomainName
"ID: $DistributionId  ·  dominio: $DistributionDomain"

# El despliegue en los puntos de presencia tarda varios minutos.
aws cloudfront wait distribution-deployed --id $DistributionId --profile $Profile
```

Notas sobre [distribution-config.json](deploy-manual-beta/distribution-config.json):

- El origen usa el dominio **regional** del bucket (`<bucket>.s3.<región>.amazonaws.com`) con `OriginAccessControlId` y `OriginAccessIdentity` vacío: así se indica OAC en lugar de OAI.
- `HttpVersion: http2and3`, `Compress: true`, `ViewerProtocolPolicy: redirect-to-https`, solo `GET` y `HEAD`.
- `PriceClass_All` usa todos los puntos de presencia, incluidos los de Sudamérica. Una clase más barata (`PriceClass_100`, `PriceClass_200`) deja afuera regiones; antes de cambiarla, revisá en la documentación de precios de CloudFront cuáles.
- Arranca con el certificado de CloudFront (`*.cloudfront.net`). El dominio propio se suma en el [paso 7](#7-opcional-sumar-el-dominio-propio).
- No hay páginas de error personalizadas: las rutas del juego las resuelve la función, no un "403 → index.html".

Anotá `$DistributionId` y `$DistributionDomain` (por ejemplo en tu gestor de contraseñas, no en el repo): los vas a necesitar en cada deploy.

## 5. Bucket policy: solo esa distribución puede leer

El bucket sigue siendo privado. La policy permite `s3:GetObject` únicamente al servicio CloudFront y únicamente cuando el pedido viene de **esta** distribución (condición `AWS:SourceArn`), como indica [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#oac-permission-to-access-s3).

```powershell
aws s3api put-bucket-policy --bucket $BucketName --profile $Profile `
  --policy (Use-Template "bucket-policy.json" @{
    BUCKET_NAME     = $BucketName
    ACCOUNT_ID      = $AccountId
    DISTRIBUTION_ID = $DistributionId
  })
```

La policy no da `s3:ListBucket`: por eso un archivo que no existe responde 403 y no 404.

## 6. Alarma de presupuesto

Un presupuesto mensual de costo para toda la cuenta, con aviso por mail al llegar al 80 % del gasto real y cuando el pronóstico supera el 100 % ([create-budget](https://docs.aws.amazon.com/cli/latest/reference/budgets/create-budget.html)).

```powershell
aws budgets create-budget --account-id $AccountId --profile $Profile `
  --budget (Use-Template "budget.json" @{ BUDGET_USD = $BudgetUsd }) `
  --notifications-with-subscribers (Use-Template "budget-notifications.json" @{ BUDGET_EMAIL = $BudgetEmail })

aws budgets describe-budgets --account-id $AccountId --profile $Profile `
  --query "Budgets[].{Nombre:BudgetName,Limite:BudgetLimit.Amount}" --output table
```

Revisá que la dirección de mail esté bien escrita: es el único aviso de gasto que tiene la beta.

## 7. (Opcional) Sumar el dominio propio

Necesita el certificado **emitido** del paso 2.2. Primero se le agregan a la distribución el nombre alternativo y el certificado; después, los registros de DNS.

```powershell
# 7.1 Alias y certificado en la distribución.
$Current = aws cloudfront get-distribution-config --id $DistributionId --output json --profile $Profile | ConvertFrom-Json
$Config  = $Current.DistributionConfig
$Config.Aliases = @{ Quantity = 1; Items = @($Domain) }
$Config.ViewerCertificate = @{
  ACMCertificateArn      = $CertArn
  SSLSupportMethod       = "sni-only"
  MinimumProtocolVersion = "TLSv1.2_2021"
}
$UpdatePath = Join-Path $Work "distribution-update.json"
[IO.File]::WriteAllText($UpdatePath, ($Config | ConvertTo-Json -Depth 50))

aws cloudfront update-distribution --id $DistributionId --if-match $Current.ETag `
  --distribution-config "file://$UpdatePath" --profile $Profile --query Distribution.Status
aws cloudfront wait distribution-deployed --id $DistributionId --profile $Profile

# 7.2 Registros A y AAAA alias hacia la distribución.
aws route53 change-resource-record-sets --hosted-zone-id $ZoneId --profile $Profile `
  --change-batch (Use-Template "route53-alias-records.json" @{ DOMAIN = $Domain; DISTRIBUTION_DOMAIN = $DistributionDomain })
```

`Z2FDTNDATAQYW2`, el `HostedZoneId` del alias en [route53-alias-records.json](deploy-manual-beta/route53-alias-records.json), no es de tu cuenta: es la zona fija de CloudFront para registros alias ([Amazon CloudFront endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/cf_region.html)). El registro AAAA hace falta porque la distribución tiene IPv6 habilitado.

## 8. Primera subida

### 8.1 Build

```powershell
# Repositorio donde "Reportar un problema" y "Contanos qué te pareció" abren issues.
$env:VITE_REPO_URL = "https://github.com/elissamburu/blueprint-the-game"
# Opcional: si el feedback va a un formulario externo en lugar de la plantilla de issue.
# $env:VITE_FEEDBACK_URL = "https://<formulario>"

pnpm i --frozen-lockfile
pnpm build:beta
```

`pnpm build:beta` baja los íconos, genera el bundle de contenido de producción (escenarios `beta` y `published`; nunca `draft`), compila la web sin caché y deja todo en `dist/beta-site`. Termina con una línea como `OK: sitio en dist/beta-site (128 archivos; 8 escenario/s: 8 beta; 79 ícono/s)`. Si querés, mirá el resultado antes de subirlo:

```powershell
pnpm preview:beta     # http://127.0.0.1:4319, con la misma función y los mismos headers
```

Anotá qué commit estás publicando (`git rev-parse --short HEAD`): es lo que necesitás para volver atrás.

### 8.2 Subida

```powershell
$env:BETA_BUCKET          = $BucketName
$env:BETA_DISTRIBUTION_ID = $DistributionId
$env:AWS_PROFILE          = $Profile
$env:AWS_REGION           = $Region

pnpm deploy:beta --dry-run   # muestra cada comando; no ejecuta nada ni contacta a AWS
pnpm deploy:beta
```

Qué hace `pnpm deploy:beta` ([tools/deploy-beta](../../tools/deploy-beta/src/deploy.ts)):

| Archivos | `Cache-Control` |
|---|---|
| `assets/*` con hash en el nombre | `public, max-age=31536000, immutable` |
| `index.html` y los JSON de `/content` | `no-cache` |
| El resto (`/icons/*.svg`, `favicon.svg`) | `public, max-age=3600` |

- Sube cada archivo con su `Content-Type` explícito (`.svg`, `.json`, `.js`, `.css`, `.webmanifest`, …); si aparece una extensión que no conoce, frena antes de subir nada.
- Sube `index.html` al final, después borra del bucket lo que ya no existe y crea una invalidación solo de `/index.html` y `/content/*`.
- Si falla a mitad de camino, el sitio anterior sigue intacto (todavía no se subió el `index.html` nuevo ni se borró nada): corregí y volvé a correrlo.

> Al borrar los `assets/` viejos, una pestaña que quedó abierta con la versión anterior puede fallar al cambiar de pantalla hasta que se recargue. La app lo muestra como "Algo salió mal · Recargar".

### 8.3 Checklist de verificación

Con `$Site = "https://$DistributionDomain"` (o `"https://$Domain"` si ya sumaste el dominio):

- [ ] **La home carga**: abrí `$Site` en una ventana privada. Aparece el onboarding y, arriba, el aviso de beta.
- [ ] **Recargar `/escenarios` funciona**: completá el onboarding, y en el listado apretá F5. También abrí directo `$Site/escenarios/serverless-pdf-processing`.
- [ ] **El contenido carga**: el listado muestra los 8 escenarios, cada uno con la etiqueta **Beta** (ninguno dice "Borrador").
- [ ] **Los íconos cargan**: entrá a un escenario; la paleta muestra los íconos de los servicios.
- [ ] **Los headers de seguridad están presentes**:
  ```powershell
  curl.exe -sI "$Site/" | Select-String "strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|cache-control|content-type"
  curl.exe -sI "$Site/escenarios" | Select-String "^HTTP|content-type"          # 200, text/html
  curl.exe -sI "$Site/content/index.json" | Select-String "content-type|cache-control"   # application/json, no-cache
  curl.exe -sI "http://$DistributionDomain/" | Select-String "^HTTP|location"   # 301 hacia https
  curl.exe -sI --http3 "$Site/" | Select-String "^HTTP"                          # HTTP/3, si tu curl lo soporta
  ```
- [ ] **El bucket no es público**: `curl.exe -sI "https://$BucketName.s3.$Region.amazonaws.com/index.html"` responde 403.
- [ ] **"Reportar un problema"** (menú "⋯" del juego y pantalla de resumen) abre un issue nuevo en el repositorio con la plantilla "Error en un escenario" y el escenario ya cargado.
- [ ] **"Contanos qué te pareció"** (aviso de beta) abre la plantilla "Feedback de la beta" en GitHub, o tu formulario si definiste `VITE_FEEDBACK_URL`.
- [ ] En una ventana de menos de 1024 px de ancho aparece el aviso de "pensado para escritorio" y se puede cerrar.
- [ ] El código fuente de la página tiene `<meta name="robots" content="noindex">`.

### Deploys siguientes

Con las variables del paso 0 y las de 8.2 definidas: `pnpm build:beta`, `pnpm deploy:beta --dry-run`, `pnpm deploy:beta` y el checklist.

## 9. Pendiente: Content-Security-Policy propia

La política administrada `SecurityHeadersPolicy` no envía `Content-Security-Policy`, y RNF-10 pide una CSP estricta con `frame-ancestors 'none'`. **Se agrega después de probarla**, para no romper la app el día del lanzamiento: una CSP mal ajustada bloquea scripts, estilos o íconos sin error visible para el jugador.

Qué falta (seguimiento en el [issue #44](https://github.com/elissamburu/blueprint-the-game/issues/44)):

1. Armar la política a partir de lo que el build realmente carga (scripts y estilos propios con hash, `fetch` a `/content`, imágenes de `/icons`, estilos en línea de las librerías de UI y del tablero).
2. Probarla primero con `Content-Security-Policy-Report-Only` y revisar la consola del navegador en todas las pantallas.
3. Crear una *response headers policy* propia de CloudFront (los headers de la administrada más la CSP y `frame-ancestors 'none'`) y reemplazar `ResponseHeadersPolicyId` en la distribución.
4. Llevarla a `infra/modules/static-site` en F3.

Mientras tanto, `X-Frame-Options: SAMEORIGIN` de la política administrada cubre el *clickjacking*.

## 10. Cómo volver atrás

### Opción A (recomendada): re-subir un build anterior

El sitio completo se regenera desde un commit. Es la forma segura porque vuelve todo junto: app, contenido e íconos.

```powershell
git switch --detach <commit-o-tag-que-estaba-publicado>
pnpm i --frozen-lockfile
pnpm build:beta
pnpm deploy:beta --dry-run
pnpm deploy:beta
git switch -          # volver a la rama en la que estabas
```

### Opción B: restaurar la versión anterior de un archivo del bucket

Sirve para un arreglo urgente de **un** archivo (por ejemplo un JSON de `/content`), gracias al versionado. Las versiones anteriores se conservan 30 días.

```powershell
$Key = "content/index.json"

# Versiones del archivo, de la más nueva a la más vieja.
aws s3api list-object-versions --bucket $BucketName --prefix $Key --profile $Profile `
  --query "Versions[].{Version:VersionId,Fecha:LastModified,Actual:IsLatest}" --output table

$VersionId = "<VersionId a restaurar>"
# Copiar esa versión encima de la actual. REPLACE obliga a repetir los headers del archivo.
aws s3api copy-object --bucket $BucketName --key $Key --profile $Profile `
  --copy-source "$BucketName/${Key}?versionId=$VersionId" `
  --metadata-directive REPLACE `
  --content-type "application/json; charset=utf-8" --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/index.html" "/content/*" --profile $Profile
```

Para `index.html` usá `--content-type "text/html; charset=utf-8"`. **Ojo:** un `index.html` anterior referencia `assets/` con hash que el deploy siguiente borró. En un bucket versionado ese borrado es un *delete marker*: para recuperarlos hay que eliminar el marcador de cada archivo (`aws s3api list-object-versions … --query DeleteMarkers`, y `aws s3api delete-object --key <archivo> --version-id <id del marcador>`). Si hay que volver atrás la app entera, usá la opción A.

## 11. Qué pasa con esto en F3

F3 crea el sitio con Terraform (`infra/modules/static-site`) y lo publica con `deploy.yml` por OIDC. En ese momento:

- El bucket, la distribución, el OAC, la función, el certificado, los registros y el presupuesto de esta guía **se importan a Terraform** (`terraform import`) **o se borran** y se recrean; no quedan recursos administrados a mano.
- `pnpm deploy:beta` deja de usarse: la subida la hace el rol `gh-deploy-content` ([ADR-0014](../adr/0014-infra-terraform-oidc.md)). `tools/deploy-beta` y esta guía se eliminan o se reducen a lo que F3 reutilice (el cálculo de headers y la función de rutas).
- La CSP propia ([§9](#9-pendiente-content-security-policy-propia)) pasa a ser parte del módulo.

Al salir de la beta, además: sacar `<meta name="robots" content="noindex">` de `apps/web/index.html` y el aviso de beta (`apps/web/src/app/SiteNotices.tsx`).

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El sitio responde `AccessDenied` (403) en todo | Falta la bucket policy del paso 5, o tiene otro ID de distribución o de cuenta. | Revisá `aws s3api get-bucket-policy --bucket $BucketName --profile $Profile` y volvé a aplicar el paso 5. |
| La home carga pero recargar `/escenarios` da 403 | La función no está publicada (quedó en `DEVELOPMENT`) o no está asociada a la distribución. | Repetí `publish-function` (paso 3) y revisá `FunctionAssociations` con `aws cloudfront get-distribution-config`. |
| Un `.js` se descarga en vez de ejecutarse, o la consola habla de *MIME type* | El archivo se subió a mano sin `Content-Type`. | Subí siempre con `pnpm deploy:beta`. |
| Subiste un cambio y seguís viendo lo anterior | Caché del navegador de un archivo sin hash (íconos: hasta 1 hora). | Recargá sin caché; para forzarlo, `aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/icons/*" --profile $Profile`. |
| `InvalidViewerCertificate` al sumar el dominio | El certificado no está en `us-east-1`, no está emitido o no cubre `$Domain`. | Revisá el paso 2.2 (`aws acm describe-certificate … --query Certificate.Status`). |
| `CNAMEAlreadyExists` al sumar el dominio | Ese nombre ya está como alias en otra distribución. | Sacalo de la otra distribución primero. |
| `pnpm deploy:beta` dice que falta una variable | No definiste `BETA_BUCKET`, `BETA_DISTRIBUTION_ID` o `AWS_PROFILE` en esta sesión. | Paso 8.2. |
| `ExpiredToken` / `The SSO session … has expired` | Se venció la sesión temporal. | `aws sso login --profile $Profile`. |

## Referencias

- Amazon CloudFront — [Restrict access to an Amazon S3 origin (OAC)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- Amazon CloudFront — [Use managed cache policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)
- Amazon CloudFront — [Use managed response headers policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-response-headers-policies.html)
- Amazon CloudFront — [CloudFront Functions event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html)
- Amazon CloudFront — [Requirements for using SSL/TLS certificates with CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html)
- AWS General Reference — [Amazon CloudFront endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/cf_region.html) (zona de Route 53 para alias)
- AWS CLI — [budgets create-budget](https://docs.aws.amazon.com/cli/latest/reference/budgets/create-budget.html)
