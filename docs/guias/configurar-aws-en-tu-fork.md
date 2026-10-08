# Guía · Configurar AWS en tu fork (OIDC, sin access keys)

Esta guía deja tu fork desplegando en **tu** cuenta de AWS con GitHub Actions, sin credenciales de larga vida. Se hace **una sola vez, a mano**. Después, cada merge a `main` despliega solo: sin aprobaciones si solo cambian la web o el contenido, y con una tuya si cambia la infraestructura.

> Decisiones de diseño detrás de esta guía: [ADR-0014](../adr/0014-infra-terraform-oidc.md) (con su enmienda por cuenta compartida) y [ADR-0015](../adr/0015-ci-para-prs-de-forks.md).
> Tiempo estimado: 30–45 minutos, más hasta 48 horas de espera para la etiqueta de costos (no bloquea).
>
> **Estado:** el bootstrap (`infra/bootstrap`) y el despliegue (`infra/envs/prod` y `deploy.yml`, pasos 4 y 5) están listos. La guía completa se prueba de punta a punta en una cuenta limpia en el paso 6 de F3 ([roadmap](../05-roadmap.md#f3--infraestructura-y-despliegue)).

## Qué vas a crear

```
Tu cuenta de AWS (región principal: us-east-2, configurable)
├── Bucket S3 de state de Terraform (versionado, cifrado, sin acceso público, solo TLS, lock nativo)
├── Proveedor OIDC: token.actions.githubusercontent.com  (audiencia sts.amazonaws.com)
│     └── o el que ya exista en la cuenta (no se toca)
├── Permissions boundary <prefijo>-gh-boundary
├── Rol <prefijo>-gh-plan            ← solo desde el environment "prod-plan" de TU repo
├── Rol <prefijo>-gh-apply           ← solo desde el environment "prod" de TU repo (con aprobación manual)
└── Rol <prefijo>-gh-deploy-content  ← solo desde el environment "prod-content" de TU repo (solo main, sin aprobación)
```

Ningún rol se puede asumir desde otro repo, otra rama sin environment ni un PR de un fork. Todo lleva la etiqueta `Project = <project_tag>`.

El primer despliegue (paso 5) suma, desde GitHub Actions:

```
├── Bucket S3 <prefijo>-site-<cuenta>-<región>  ← privado; solo lo lee la distribución
├── CloudFront: distribución (con tu dominio), origin access control <prefijo>-site,
│     función <prefijo>-spa-rewrite y response headers policy <prefijo>-security-headers
├── Presupuesto <prefijo>-mensual              ← filtrado por la etiqueta Project
└── Cuentas del juego (ADR-0029):
      ├── Cognito user pool <prefijo>-players, con su dominio <AUTH_DOMAIN_PREFIX>.auth.<región>.amazoncognito.com
      │     (hosted UI classic) y su app client público <prefijo>-web
      ├── Cognito identity pool <prefijo>_players  ← solo jugadores con sesión
      ├── Rol <prefijo>-player                      ← solo sus propios ítems de la tabla
      └── Tabla DynamoDB <prefijo>-profiles         ← on demand, PITR, protección contra borrado
```

Dos cosas quedan **fuera** de Terraform y las hacés vos: el certificado de ACM del dominio (en `us-east-1`, se reutiliza por ARN) y el registro DNS del sitio (un `CNAME` en tu proveedor de DNS, que no tiene por qué ser Route 53).

---

## 0. Requisitos

- Una cuenta de AWS. Lo ideal es una **dedicada** a este proyecto (p. ej. una cuenta nueva dentro de tu AWS Organization), pero el bootstrap funciona también en una cuenta **compartida** con otros proyectos: todos los nombres llevan un prefijo, todos los recursos la etiqueta `Project` y los roles solo pueden tocar lo que tiene ese prefijo o esa etiqueta (ver [3.7](#37-qué-quedó-creado)).
- Acceso administrativo **temporal** a esa cuenta (recomendado: IAM Identity Center + `aws sso login`). No crees usuarios IAM con access keys.
- Herramientas: AWS CLI v2, Terraform (la versión exacta de `required_version` en [infra/bootstrap/versions.tf](../../infra/bootstrap/versions.tf)), GitHub CLI (`gh`) y PowerShell 7 (`pwsh`). Los comandos de esta guía son de PowerShell.
- Tu fork creado en GitHub.

## 1. Obtené los IDs de tu repo y el formato del `sub`

GitHub firma un token OIDC por cada job. El claim `sub` identifica repo y contexto, y **la trust policy de AWS tiene que coincidir exactamente**.

Desde el 15/07/2026, los repos **nuevos** (un fork lo es) usan por defecto el formato **inmutable**, que incluye los IDs numéricos de owner y repo:

```
repo:<OWNER>@<OWNER_ID>/<REPO>@<REPO_ID>:environment:prod     ← inmutable (default para repos nuevos)
repo:<OWNER>/<REPO>:environment:prod                          ← formato anterior (repos viejos sin opt-in)
```

Obtené los IDs:

```powershell
gh api repos/<OWNER>/<REPO> --jq '{owner_id: .owner.id, repo_id: .id}'
```

**Verificá el formato real** con un workflow de diagnóstico que imprima **solo** los claims `sub`, `aud` y `repository`, nunca el token. Todavía no está en el repo (se suma en F3); mientras tanto, este es el que vas a usar:

```yaml
# .github/workflows/oidc-debug.yml
name: oidc-debug
on: workflow_dispatch
permissions:
  id-token: write
  contents: read
jobs:
  claims:
    runs-on: ubuntu-latest
    environment: prod-plan
    steps:
      - name: Print OIDC subject (no token)
        run: |
          TOKEN=$(curl -sS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com" | jq -r .value)
          echo "$TOKEN" | python3 -c 'import sys,json,base64
          p=sys.stdin.read().strip().split(".")[1]; p+="="*(-len(p)%4)
          c=json.loads(base64.urlsafe_b64decode(p))
          print(json.dumps({k:c.get(k) for k in ("sub","aud","repository")}, indent=2))'
```

> Ejecutalo **después** de crear los environments (paso 2). Si el `sub` que ves tiene `@<número>`, usá `subject_format = "immutable"`; si no, `"legacy"`.

## 2. Creá los environments en GitHub

En tu fork: **Settings → Environments**:

| Environment | Reviewers obligatorios | Ramas de despliegue | Para qué |
|---|---|---|---|
| `prod-plan` | No | **Todas** (el plan corre en las ramas de los PR) | `terraform plan` (rol `gh-plan`) |
| `prod` | **Sí (vos, y quien más apruebe despliegues)** | Solo `main` | `terraform apply` (rol `gh-apply`), solo cuando el plan tiene cambios |
| `prod-content` | **No** | Solo `main` | Subida de la web y el contenido e invalidación de CloudFront (rol `gh-deploy-content`) |

En `prod`:

- **Required reviewers**: agregá al menos una persona. El job que asume `gh-apply` se pausa hasta que alguien lo apruebe.
- **Deployment branches and tags**: *Selected branches and tags* → `main`.
- **Prevent self-review**: si sos la única persona que mantiene el repo, **dejalo apagado** (si no, no podrías aprobar los despliegues que disparás vos). Si hay más de una persona con permisos, activalo para que quien dispara el despliegue no se lo apruebe a sí misma.

En `prod-content`:

- **Required reviewers**: ninguno. Un merge que solo cambia la web o el contenido se publica sin esperar a nadie: el control humano está en la revisión del PR y en los cambios de infraestructura ([ADR-0014](../adr/0014-infra-terraform-oidc.md#2026-10-08--deploy-de-contenido-sin-aprobación)).
- **Deployment branches and tags**: *Selected branches and tags* → `main`. **Es lo único que impide que otra rama asuma `gh-deploy-content`**: sin reviewers, cualquier workflow de una rama de tu repo que declare `environment: prod-content` podría subir archivos al sitio si el environment aceptara esa rama. No la dejes en *No restriction*.

En `prod-plan`, ni reviewers ni restricción de ramas: el `plan` de un PR corre en la rama del PR. Eso quiere decir que un workflow de **cualquier rama de tu repo** puede asumir `gh-plan`, que solo lee (los recursos del proyecto y el state) y toma el lock del state. Por eso:

- El job `plan` de [`deploy.yml`](../../.github/workflows/deploy.yml) **no corre en PR de forks**: su job lleva la condición `github.event.pull_request.head.repo.full_name == github.repository`, además de que los PR de forks corren sin acceso a AWS ([ADR-0015](../adr/0015-ci-para-prs-de-forks.md)).
- Quien puede crear ramas en tu repo puede leer el state y la configuración del proyecto: dale permiso de escritura solo a personas de confianza.

Los nombres son parte del `sub` que la trust policy compara: tienen que ser exactamente `prod-plan`, `prod` y `prod-content`, o los que pongas en `plan_environment`, `apply_environment` y `deploy_content_environment` del bootstrap (paso 3.3).

> ⚠️ **Creá `prod` (con sus reviewers) y `prod-content` (con su regla de ramas) antes del primer push a `main` que incluya `deploy.yml`.** Si un workflow referencia un environment que no existe, GitHub lo crea solo y **sin ninguna protección**: el `apply` correría sin esperar aprobación y, con cualquiera de los dos, desde cualquier rama. Revisá en **Settings → Environments** que `prod` tenga *Required reviewers* y la regla de ramas, y que `prod-content` tenga la regla de ramas, antes de hacer merge.

Además, en **Settings → Branches**, protegé `main`: PR obligatorio, checks requeridos (`ci`) y sin force-push.

## 3. Aplicá el bootstrap (una sola vez)

### 3.1 Sesión y chequeo de la cuenta

```powershell
aws sso login --profile <perfil-admin>
$env:AWS_PROFILE = "<perfil-admin>"
aws sts get-caller-identity          # confirmá que es la cuenta correcta
```

**Si iniciás sesión con `aws login`** (con las credenciales de la consola, en lugar de IAM Identity Center), el AWS CLI usa esa sesión, pero Terraform no: su provider usa el SDK de AWS para Go, que no soporta las sesiones de `aws login`. Antes de correr `terraform`, exportá las credenciales temporales de la sesión como variables de entorno de **esa** consola de PowerShell:

```powershell
aws login --profile <perfil-admin>
aws configure export-credentials --profile <perfil-admin> --format powershell | Invoke-Expression
Remove-Item Env:AWS_PROFILE -ErrorAction SilentlyContinue   # que el perfil no compita con las credenciales exportadas
aws sts get-caller-identity                                  # la misma cuenta, ahora desde las variables
```

El pipe a `Invoke-Expression` define las variables sin imprimirlas. Son credenciales temporales: cuando venzan, repetí `aws login` y el `export-credentials`. Al terminar (y siempre antes de pasar a otra cuenta), borralas de la consola:

```powershell
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN, Env:AWS_CREDENTIAL_EXPIRATION -ErrorAction SilentlyContinue
```

Cerrar la consola también las borra: nunca se escriben en un archivo.

### 3.2 Chequeos previos

**¿Ya hay un proveedor OIDC de GitHub en la cuenta?** Puede haber uno solo por URL, y en una cuenta compartida otro proyecto puede haberlo creado:

```powershell
aws iam list-open-id-connect-providers
```

- Si la lista **no** incluye un ARN que termine en `oidc-provider/token.actions.githubusercontent.com`: dejá `create_oidc_provider = true` y el bootstrap lo crea.
- Si **ya está**: usá `create_oidc_provider = false`. El bootstrap lo lee y no lo modifica. Confirmá que acepte la audiencia `sts.amazonaws.com` (el plan falla si no):

  ```powershell
  $OidcArn = aws iam list-open-id-connect-providers `
    --query "OpenIDConnectProviderList[?ends_with(Arn, 'token.actions.githubusercontent.com')].Arn" --output text
  aws iam get-open-id-connect-provider --open-id-connect-provider-arn $OidcArn --query ClientIDList
  ```

  Si no la incluye, coordiná con quien lo administra antes de agregarla.

El bootstrap crea el proveedor **sin thumbprint**: es opcional en la API de IAM, y para GitHub AWS valida el certificado con su propia lista de autoridades de certificación ([CreateOpenIDConnectProvider](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateOpenIDConnectProvider.html)).

**Activá la etiqueta `Project` como *cost allocation tag*.** El presupuesto del proyecto (lo crea `infra/envs/prod`, no el bootstrap) filtra los costos por esa etiqueta, y un presupuesto solo puede filtrar por etiquetas activadas ([Budget filters](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create-filters.html)). En una cuenta compartida es lo que separa el gasto del proyecto del resto.

1. Después de aplicar el bootstrap (paso 3.4), sus recursos ya llevan `Project`. La clave puede tardar **hasta 24 horas** en aparecer.
2. En la consola de **Billing and Cost Management → Cost allocation tags**, buscá `Project` entre las *user-defined*, seleccionala y elegí **Activate**. La activación puede tardar **otras 24 horas** ([Activating user-defined cost allocation tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html)).
3. En el filtro del presupuesto la etiqueta aparece como `user:Project`.

Si la cuenta es miembro de una AWS Organization, puede que la activación la tenga que hacer la cuenta de administración. `TODO(verificar)`: no se confirmó contra la documentación oficial quién puede activarlas dentro de una Organization.

No bloquea el resto de la guía: el presupuesto se crea en el primer despliegue y empieza a contar cuando la etiqueta está activa.

### 3.3 Variables

```powershell
cd infra/bootstrap
Copy-Item terraform.tfvars.example terraform.tfvars
```

Completá `terraform.tfvars` (está en `.gitignore`: **nunca** lo subas):

```hcl
account_id = "<ACCOUNT_ID>"      # 12 dígitos; el provider se niega a correr en otra cuenta
aws_region = "us-east-2"         # región principal (el bucket de state vive acá)

name_prefix = "blueprint"        # prefijo de todos los nombres; único en la cuenta
project_tag = "blueprint"        # valor de la etiqueta Project

github_owner    = "<OWNER>"
github_repo     = "<REPO>"
github_owner_id = 12345678       # del paso 1
github_repo_id  = 987654321      # del paso 1
subject_format  = "immutable"    # o "legacy" según el paso 1

# Opcional: environments del paso 2. Solo si les pusiste otros nombres (por defecto, estos).
# plan_environment           = "prod-plan"
# apply_environment          = "prod"
# deploy_content_environment = "prod-content"

create_oidc_provider = true      # false si el paso 3.2 encontró uno

# Opcional: solo si tu DNS está en Route 53. Vacío = los roles no tienen permisos de Route 53
# (infra/envs/prod no maneja DNS: con Cloudflare u otro proveedor, dejalo vacío).
route53_zone_id      = ""                                            # p. ej. "Z0123456789ABCDEFGHIJ"
route53_record_names = []                                            # p. ej. ["beta.tu-dominio.com.ar", "_*.beta.tu-dominio.com.ar"]

# Vacías en el primer apply: se completan después del primer despliegue (paso 5.1).
cloudfront_oac_ids                     = []                          # p. ej. ["E1ABCDEFGHIJKL"]
cloudfront_response_headers_policy_ids = []                          # p. ej. ["67f7725c-6f97-4210-82d7-5512b31e9d03"]
```

Sobre `cloudfront_oac_ids` y `cloudfront_response_headers_policy_ids`: son los únicos *origin access controls* y *response headers policies* que `gh-apply` puede cambiar o borrar (crearlos puede siempre). Los crea `infra/envs/prod`, así que en el primer `apply` del bootstrap todavía no existen: dejalas vacías y completalas en el [paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies). Van los IDs solos, no los ARN.

Sobre `route53_record_names`: son los únicos registros que `gh-apply` puede cambiar en la zona (el del sitio y el CNAME de validación del certificado de ACM, que empieza con `_`). Van en minúsculas y **sin el punto final**, como los compara Route 53 ([condiciones de IAM en Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/specifying-rrset-conditions.html)). La zona en sí no la administra Terraform.

### 3.4 Aplicá

```powershell
terraform init
terraform plan -out bootstrap.tfplan     # revisá: 1 bucket (+ su configuración), 0 o 1 proveedor OIDC, 1 boundary, 3 roles con su política
terraform apply bootstrap.tfplan
terraform output
Remove-Item bootstrap.tfplan             # el plan guardado contiene los valores de las variables
```

### 3.5 Verificá los permisos

Antes de cargar nada en GitHub, comprobá que las políticas hacen lo que dicen. `aws iam simulate-principal-policy` **solo simula**: evalúa las políticas del rol (incluido su permissions boundary) contra una acción y un ARN, no cambia nada y no necesita que el recurso exista ([referencia del AWS CLI v2](https://docs.aws.amazon.com/cli/latest/reference/iam/simulate-principal-policy.html)).

El simulador **no lee las etiquetas ni la cuenta de los recursos**: las claves de contexto (`aws:ResourceTag/Project`, `aws:ResourceAccount`, `iam:PermissionsBoundary`) se le pasan con `--context-entries`, en la sintaxis abreviada `ContextKeyName=…,ContextKeyValues=…,ContextKeyType=string`. Una clave que no se pasa queda ausente: así se simula un recurso **sin** la etiqueta.

Desde `infra/bootstrap`, con la sesión de administrador del paso 3.1:

```powershell
$AccountId   = aws sts get-caller-identity --query Account --output text
$Prefix      = "<name_prefix>"     # el de terraform.tfvars
$ProjectTag  = "<project_tag>"     # el de terraform.tfvars
$RolePlan    = terraform output -raw role_plan_arn
$RoleApply   = terraform output -raw role_apply_arn
$RoleDeploy  = terraform output -raw role_deploy_content_arn
$StateBucket = terraform output -raw state_bucket
$Boundary    = terraform output -raw permissions_boundary_arn

# ARN de prueba: no hace falta que existan.
$Distribution = "arn:aws:cloudfront::${AccountId}:distribution/EDFDVBD6EXAMPLE"
$Certificate  = "arn:aws:acm:us-east-1:${AccountId}:certificate/00000000-0000-0000-0000-000000000000"
$Budget       = "arn:aws:budgets::${AccountId}:budget/$Prefix-prueba"
$SiteObject   = "arn:aws:s3:::$Prefix-sitio-prueba/index.html"
$StateObject  = "arn:aws:s3:::$StateBucket/envs/prod/terraform.tfstate"
$TestRole     = "arn:aws:iam::${AccountId}:role/$Prefix-prueba"
$Oac          = "arn:aws:cloudfront::${AccountId}:origin-access-control/E1ABCDEFGHIJKL"

# Claves de contexto.
$Tagged       = "ContextKeyName=aws:ResourceTag/Project,ContextKeyValues=$ProjectTag,ContextKeyType=string"
$InAccount    = "ContextKeyName=aws:ResourceAccount,ContextKeyValues=$AccountId,ContextKeyType=string"
$WithBoundary = "ContextKeyName=iam:PermissionsBoundary,ContextKeyValues=$Boundary,ContextKeyType=string"

function Test-Permission([string]$Role, [string]$Action, [string]$Resource, [string[]]$Context = @()) {
  $contextArgs = if ($Context.Count) { @("--context-entries") + $Context } else { @() }
  aws iam simulate-principal-policy --policy-source-arn $Role --action-names $Action `
    --resource-arns $Resource @contextArgs --query "EvaluationResults[0].EvalDecision" --output text
}

Test-Permission $RoleDeploy "cloudfront:CreateInvalidation"     $Distribution @($Tagged)                  # allowed
Test-Permission $RoleApply  "cloudfront:CreateInvalidation"     $Distribution @($Tagged)                  # allowed
Test-Permission $RoleDeploy "cloudfront:CreateInvalidation"     $Distribution                             # explicitDeny
Test-Permission $RoleApply  "acm:DeleteCertificate"             $Certificate                              # explicitDeny
Test-Permission $RoleApply  "budgets:ModifyBudget"              $Budget                                   # allowed
Test-Permission $RolePlan   "budgets:ModifyBudget"              $Budget                                   # implicitDeny
Test-Permission $RoleApply  "s3:PutBucketPolicy"                "arn:aws:s3:::$StateBucket" @($InAccount) # explicitDeny
Test-Permission $RoleDeploy "s3:PutObject"                      $SiteObject @($InAccount)                 # allowed
Test-Permission $RoleDeploy "s3:PutObject"                      $StateObject @($InAccount)                # explicitDeny
Test-Permission $RoleApply  "iam:DeleteRole"                    $TestRole @($Tagged, $WithBoundary)       # allowed
Test-Permission $RoleApply  "iam:DeleteRolePermissionsBoundary" $TestRole @($Tagged, $WithBoundary)       # explicitDeny
Test-Permission $RoleApply  "cloudfront:CreateOriginAccessControl" "*"                                    # allowed
Test-Permission $RoleApply  "cloudfront:DeleteOriginAccessControl" $Oac                                   # explicitDeny
```

| Rol | Acción | Recurso | Esperado | Por qué |
|---|---|---|---|---|
| `gh-deploy-content` y `gh-apply` | `cloudfront:CreateInvalidation` | distribución **con** `Project` | `allowed` | Su política lo permite con la etiqueta. |
| `gh-deploy-content` | `cloudfront:CreateInvalidation` | distribución **sin** `Project` | `explicitDeny` | El boundary niega cambiar recursos sin la etiqueta. |
| `gh-apply` | `acm:DeleteCertificate` | certificado **sin** `Project` | `explicitDeny` | Ídem. |
| `gh-apply` | `budgets:ModifyBudget` | `budget/<prefijo>-prueba` | `allowed` | Presupuestos acotados por nombre. |
| `gh-plan` | `budgets:ModifyBudget` | `budget/<prefijo>-prueba` | `implicitDeny` | `gh-plan` solo lee. |
| `gh-apply` | `s3:PutBucketPolicy` | bucket de state | `explicitDeny` | El boundary solo deja tocar objetos del state. |
| `gh-deploy-content` | `s3:PutObject` | `<prefijo>-sitio-prueba/index.html` | `allowed` | Buckets `<prefijo>-*` de la cuenta. |
| `gh-deploy-content` | `s3:PutObject` | objeto del bucket de state | `explicitDeny` | Deny explícito del state en su política. |
| `gh-apply` | `iam:DeleteRole` | `role/<prefijo>-prueba` con `Project` y el boundary | `allowed` | Roles del proyecto que llevan el boundary. |
| `gh-apply` | `iam:DeleteRolePermissionsBoundary` | el mismo rol | `explicitDeny` | Nadie puede quitar un boundary. |
| `gh-apply` | `cloudfront:CreateOriginAccessControl` | `*` | `allowed` | Crear no afecta a otros proyectos. |
| `gh-apply` | `cloudfront:DeleteOriginAccessControl` | un OAC que no está en `cloudfront_oac_ids` | `explicitDeny` | Solo se cambian o borran los IDs listados (con la lista vacía, ninguno). |

`explicitDeny` e `implicitDeny` son las dos formas de «denegado»: la primera viene de un `Deny` (del boundary o de la política), la segunda de que nada lo permite. Sin `$InAccount`, las acciones de S3 dan `implicitDeny`, porque las políticas exigen que el bucket sea de la cuenta (`aws:ResourceAccount`). Si algún resultado no coincide con la tabla, no sigas: revisá la política con `aws iam get-role-policy --role-name <rol> --policy-name <rol>-permissions`.

### 3.6 Resguardá el state del bootstrap

El state del bootstrap **queda local**, en `infra/bootstrap/terraform.tfstate`: no se migra al bucket que el mismo bootstrap crea (si ese bucket se rompiera, perderías justo lo que hace falta para arreglarlo). Está en `.gitignore`: **nunca** lo subas al repo. No tiene secretos, pero sí el account ID y los ARN.

Después de **cada** `apply` del bootstrap:

1. Guardá una copia de `terraform.tfstate` **fuera de AWS** y cifrada: por ejemplo, como adjunto en tu gestor de contraseñas o en un almacenamiento cifrado tuyo. No la subas al bucket de state ni a otro bucket de la cuenta: si perdés el acceso a la cuenta o al bucket, la copia se pierde con ellos.
2. Guardá también tu `terraform.tfvars` en el mismo lugar (el paso 1 te deja reconstruirlo, pero ahorra tiempo).

Si perdés el state, los recursos siguen funcionando. Para volver a administrarlos, se importan con bloques `import` de Terraform (el bucket por su nombre, los roles y el boundary por nombre o ARN y el proveedor OIDC por ARN) antes del próximo `apply`.

### 3.7 Qué quedó creado

**Trust policies**: las tres son iguales salvo el environment del `sub`. La de `gh-deploy-content` (formato inmutable):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "GitHubEnvironment",
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:<OWNER>@<OWNER_ID>/<REPO>@<REPO_ID>:environment:prod-content"
      }
    }
  }]
}
```

Las de `gh-plan` y `gh-apply` terminan en `:environment:prod-plan` y `:environment:prod`. Un solo `sub` por rol, con `StringEquals`: `gh-deploy-content` ya no acepta `prod` ni `gh-apply` acepta `prod-content`.

En Terraform, el `sub` se arma en [infra/bootstrap/locals.tf](../../infra/bootstrap/locals.tf):

```hcl
repo_ref = (
  var.subject_format == "immutable"
  ? "${var.github_owner}@${var.github_owner_id}/${var.github_repo}@${var.github_repo_id}"
  : "${var.github_owner}/${var.github_repo}"
)
# sub = "repo:${local.repo_ref}:environment:${environment}"
# environment: var.plan_environment, var.apply_environment o var.deploy_content_environment
#              (por defecto prod-plan, prod y prod-content)
```

**Permisos** ([infra/bootstrap/iam_policies.tf](../../infra/bootstrap/iam_policies.tf)), pensados para una cuenta compartida:

| Rol | Environment (`sub`) | Puede |
|---|---|---|
| `gh-plan` | `prod-plan` (sin reviewers, cualquier rama) | Leer el state y tomar el lock; leer los buckets `<prefijo>-*`, CloudFront, los certificados de `us-east-1`, los presupuestos `<prefijo>-*`, los roles y políticas `<prefijo>-*` y, si la configuraste, la hosted zone. |
| `gh-apply` | `prod` (reviewers, solo `main`) | Lo de `gh-plan`, escribir el state, y crear o cambiar los recursos del proyecto: buckets `<prefijo>-*`; distribuciones, funciones y certificados **con la etiqueta `Project`**; crear *origin access controls* y *response headers policies*, y cambiar o borrar solo los de `cloudfront_oac_ids` y `cloudfront_response_headers_policy_ids`; presupuestos `<prefijo>-*`; roles y políticas `<prefijo>-*` con el boundary; los registros de Route 53 listados. |
| `gh-deploy-content` | `prod-content` (sin reviewers, solo `main`) | Listar, subir y borrar archivos en buckets `<prefijo>-*` (nunca en el de state) e invalidar distribuciones con la etiqueta `Project`. |

Los tres llevan el **permissions boundary** `<prefijo>-gh-boundary`, que además:

- impide crear o modificar un rol que no lleve ese mismo boundary, y quitar el boundary de un rol;
- impide cambiar recursos **sin** la etiqueta `Project = <project_tag>`, crearlos sin ella, quitarla o cambiarla;
- impide cambiar o borrar *origin access controls* y *response headers policies* que no estén en las variables, y escribir cualquier otro tipo de CloudFront sin etiquetas (*cache policies*, *origin request policies*…);
- deja el bucket de state y los recursos del bootstrap (roles `<prefijo>-gh-*` y el boundary) fuera del alcance de los roles, salvo leer y escribir objetos del state.

Dónde no alcanza la etiqueta (AWS no ofrece condiciones por etiqueta para esos tipos):

- **S3**: se acota por nombre de bucket (`<prefijo>-*`) y cuenta.
- **Route 53**: se acota por zona y por nombre y tipo de registro.
- ***Origin access controls* y *response headers policies* de CloudFront**: no tienen etiquetas y su ARN lleva un ID generado (`origin-access-control/<ID>`, `response-headers-policy/<ID>`). Se acotan por ID: `gh-apply` los puede crear, pero solo cambia o borra los de `cloudfront_oac_ids` y `cloudfront_response_headers_policy_ids` ([paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)). Así, en una cuenta con distribuciones de otros proyectos, un `apply` equivocado o un workflow comprometido que pase la aprobación de `prod` no puede cambiar el OAC o la política de headers de otro sitio.
- **Adopción de recursos sin etiqueta**: crear una distribución o un certificado con etiquetas usa el mismo permiso que etiquetar uno existente, así que `gh-apply` podría ponerle `Project` a una distribución o un certificado **sin** esa etiqueta. Si la cuenta es compartida, etiquetá los recursos de los otros proyectos con su propio `Project`: el boundary impide cambiarlo.

Además: duración máxima de sesión de 1 hora, y `StringEquals` (nunca `StringLike`) sobre `aud` y `sub`.

### 3.8 Si ya tenías el bootstrap aplicado: migrar a `prod-content`

Hasta el 2026-10-08, `gh-deploy-content` confiaba en `prod` y el job `deploy` usaba ese environment, así que cada push a `main` pedía dos aprobaciones. Si aplicaste el bootstrap antes, migrá en este orden:

1. **Creá el environment `prod-content`** (paso 2): sin reviewers y con *Deployment branches and tags* → *Selected branches and tags* → `main`. Hacelo antes que nada: si el workflow nuevo llega a `main` sin el environment, GitHub lo crea sin la regla de ramas.
2. **Re-aplicá el bootstrap desde la rama del PR** que trae el cambio (con la sesión de administrador del paso 3.1, desde `infra/bootstrap`):

   ```powershell
   git fetch origin
   git switch <rama-del-PR>
   terraform plan -out bootstrap.tfplan    # esperado: 1 to change (la trust y la descripción de gh-deploy-content), 0 to add, 0 to destroy
   terraform apply bootstrap.tfplan
   Remove-Item bootstrap.tfplan
   ```

   Si el plan muestra algo más que `<prefijo>-gh-deploy-content`, no apliques. Resguardá el state otra vez (paso 3.6).
3. **Mergeá el PR.** El push a `main` corre el workflow nuevo: `deploy` usa `prod-content` y asume `gh-deploy-content` sin aprobación.

> ⚠️ **Entre el paso 2 y el paso 3 de la migración**, `gh-deploy-content` ya no acepta `prod`. Un deploy desde `main` con el workflow viejo (un push a `main` o una ejecución manual en ese lapso) falla en *Assume gh-deploy-content* con `Not authorized to perform sts:AssumeRoleWithWebIdentity`, después del `apply`. No es grave (el sitio queda como estaba), pero conviene no mergear otra cosa en el medio. Si pasa, volvé a correr `deploy.yml` sobre `main` después del merge.

### 3.9 Si ya tenías el bootstrap aplicado: cuentas y perfil (F4 MVP)

El MVP de F4 ([ADR-0029](../adr/0029-perfil-con-cognito-y-dynamodb-desde-el-navegador.md)) crea Cognito, una tabla de DynamoDB y el rol `<prefijo>-player` desde `infra/envs/prod`. `gh-apply` y `gh-plan` necesitan permisos nuevos **antes** del merge: si no, el plan del PR falla con `AccessDenied` al leer los recursos nuevos y el `apply` no puede crearlos. El orden:

1. **Elegí el prefijo del dominio del login** y cargalo como variable del repo (paso 4): `<prefijo>.auth.<región>.amazoncognito.com`. Es único por región en todo AWS; usá algo de tu proyecto, **nunca** el account ID.

   ```powershell
   gh variable set AUTH_DOMAIN_PREFIX --body "<prefijo-del-login>"
   ```

2. **Re-aplicá el bootstrap desde la rama del PR** (con la sesión de administrador del paso 3.1, desde `infra/bootstrap`):

   ```powershell
   git fetch origin
   git switch <rama-del-PR>
   terraform plan -out bootstrap.tfplan
   # esperado: 2 to add, 3 to change, 0 to destroy
   #   + aws_iam_policy.apply_auth                  (<prefijo>-gh-apply-auth)
   #   + aws_iam_role_policy_attachment.apply_auth  (a <prefijo>-gh-apply)
   #   ~ aws_iam_policy.boundary                    (techo de Cognito, DynamoDB y el rol player)
   #   ~ aws_iam_role_policy.github["plan"]         (lecturas de Cognito y DynamoDB)
   #   ~ aws_iam_role_policy.github["apply"]        (las mismas lecturas)
   terraform apply bootstrap.tfplan
   Remove-Item bootstrap.tfplan
   ```

   Si el plan toca otra cosa (un rol que se reemplaza, el bucket de state, `gh-deploy-content`), no apliques. Resguardá el state otra vez (paso 3.6).
3. **Verificá los permisos nuevos** con las simulaciones de abajo.
4. **Volvé a correr el plan del PR** (*Re-run jobs* en la pestaña *Checks*, o un push a la rama). Esperado en `infra/envs/prod`: `8 to add, 1 to change, 0 to destroy` (los 8 recursos de `module.auth` y la *response headers policy*, por el `connect-src` nuevo de la CSP).
5. **Mergeá el PR** y aprobá el `apply`. El job `deploy` arma la web con los `VITE_AUTH_*` que salen de Terraform: el botón «Ingresar o crear cuenta» aparece solo cuando están.

Simulaciones, con las variables y la función `Test-Permission` del [paso 3.5](#35-verificá-los-permisos):

```powershell
$Region       = "us-east-2"   # aws_region del bootstrap
$UserPool     = "arn:aws:cognito-idp:${Region}:${AccountId}:userpool/${Region}_EXAMPLE"
$IdentityPool = "arn:aws:cognito-identity:${Region}:${AccountId}:identitypool/${Region}:00000000-0000-0000-0000-000000000000"
$Table        = "arn:aws:dynamodb:${Region}:${AccountId}:table/$Prefix-profiles"
$OtherTable   = "arn:aws:dynamodb:${Region}:${AccountId}:table/otro-proyecto"
$PlayerRole   = "arn:aws:iam::${AccountId}:role/$Prefix-player"

$RequestTagged = "ContextKeyName=aws:RequestTag/Project,ContextKeyValues=$ProjectTag,ContextKeyType=string"
$ToCognito     = "ContextKeyName=iam:PassedToService,ContextKeyValues=cognito-identity.amazonaws.com,ContextKeyType=string"
$ToLambda      = "ContextKeyName=iam:PassedToService,ContextKeyValues=lambda.amazonaws.com,ContextKeyType=string"

Test-Permission $RoleApply "cognito-idp:CreateUserPool"            "*" @($RequestTagged)     # allowed
Test-Permission $RoleApply "cognito-idp:CreateUserPool"            "*"                       # explicitDeny
Test-Permission $RoleApply "cognito-idp:DeleteUserPool"            $UserPool @($Tagged)      # allowed
Test-Permission $RoleApply "cognito-idp:DeleteUserPool"            $UserPool                 # implicitDeny
Test-Permission $RoleApply "cognito-idp:ListUsers"                 $UserPool @($Tagged)      # implicitDeny
Test-Permission $RolePlan  "cognito-idp:DescribeUserPool"          $UserPool @($Tagged)      # allowed
Test-Permission $RolePlan  "cognito-idp:UpdateUserPool"            $UserPool @($Tagged)      # implicitDeny
Test-Permission $RoleApply "cognito-identity:CreateIdentityPool"   "*" @($RequestTagged)     # allowed
Test-Permission $RoleApply "cognito-identity:DeleteIdentityPool"   $IdentityPool @($Tagged)  # allowed
Test-Permission $RoleApply "cognito-identity:DeleteIdentityPool"   $IdentityPool             # implicitDeny
Test-Permission $RoleApply "dynamodb:CreateTable"                  $Table @($RequestTagged)  # allowed
Test-Permission $RoleApply "dynamodb:CreateTable"                  $OtherTable @($RequestTagged) # implicitDeny
Test-Permission $RoleApply "dynamodb:DeleteTable"                  $Table @($Tagged)         # allowed
Test-Permission $RoleApply "dynamodb:PutItem"                      $Table @($Tagged)         # implicitDeny
Test-Permission $RoleApply "iam:PassRole"                          $PlayerRole @($ToCognito) # allowed
Test-Permission $RoleApply "iam:PassRole"                          $PlayerRole @($ToLambda)  # implicitDeny
Test-Permission $RoleApply "iam:PassRole"                          $TestRole @($ToCognito)   # implicitDeny
```

| Rol | Acción | Recurso | Esperado | Por qué |
|---|---|---|---|---|
| `gh-apply` | `cognito-idp:CreateUserPool` | `*`, con `Project` en la request | `allowed` | Se crea con la etiqueta. |
| `gh-apply` | `cognito-idp:CreateUserPool` | `*`, sin etiqueta | `explicitDeny` | El boundary exige la etiqueta al crear (`CreateWithProjectTag`). |
| `gh-apply` | `cognito-idp:DeleteUserPool` | user pool con / sin `Project` | `allowed` / `implicitDeny` | Solo se cambian los del proyecto. |
| `gh-apply` | `cognito-idp:ListUsers` | user pool del proyecto | `implicitDeny` | Ningún rol lee usuarios (sus emails). |
| `gh-plan` | `cognito-idp:DescribeUserPool` / `UpdateUserPool` | user pool del proyecto | `allowed` / `implicitDeny` | `gh-plan` solo lee. |
| `gh-apply` | `cognito-identity:CreateIdentityPool` / `DeleteIdentityPool` | con `Project` | `allowed` | Igual que el user pool. |
| `gh-apply` | `dynamodb:CreateTable` | `table/<prefijo>-profiles` / otra tabla | `allowed` / `implicitDeny` | Tablas `<prefijo>-*`. |
| `gh-apply` | `dynamodb:PutItem` | la tabla | `implicitDeny` | Los ítems son solo del rol player. |
| `gh-apply` | `iam:PassRole` | `role/<prefijo>-player` a Cognito / a Lambda | `allowed` / `implicitDeny` | Solo ese rol, solo a `cognito-identity.amazonaws.com`. |
| `gh-apply` | `iam:PassRole` | otro rol del proyecto | `implicitDeny` | Ídem. |

Después del primer `apply`, el rol player existe y también se puede simular. El simulador no conoce el identity ID: se le pasan la variable de la política (`cognito-identity.amazonaws.com:sub`) y la clave de la request (`dynamodb:LeadingKeys`):

```powershell
$Me      = "ContextKeyName=cognito-identity.amazonaws.com:sub,ContextKeyValues=${Region}:11111111-1111-1111-1111-111111111111,ContextKeyType=string"
$MyItems = "ContextKeyName=dynamodb:LeadingKeys,ContextKeyValues=${Region}:11111111-1111-1111-1111-111111111111,ContextKeyType=stringList"
$Others  = "ContextKeyName=dynamodb:LeadingKeys,ContextKeyValues=${Region}:22222222-2222-2222-2222-222222222222,ContextKeyType=stringList"

Test-Permission $PlayerRole "dynamodb:PutItem"     $Table @($Me, $MyItems)  # allowed
Test-Permission $PlayerRole "dynamodb:GetItem"     $Table @($Me, $Others)   # implicitDeny
Test-Permission $PlayerRole "dynamodb:Scan"        $Table @($Me)            # implicitDeny
Test-Permission $PlayerRole "dynamodb:DeleteTable" $Table @($Me)            # implicitDeny
Test-Permission $PlayerRole "dynamodb:PutItem"     $OtherTable @($Me, $MyItems) # implicitDeny
```

Un límite que conviene conocer: `cognito-identity:SetIdentityPoolRoles` no admite recurso ni claves de condición ([Service Authorization Reference de Cognito Identity](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazoncognitoidentity.html)), así que `gh-apply` puede cambiar los roles de **cualquier** identity pool de la región. Lo único que puede asignar es el rol player (por `iam:PassRole`), que solo da acceso a ítems propios de la tabla del proyecto; en una cuenta compartida, revisá los identity pools de los otros proyectos si algo cambia sus roles.

## 4. Configurá los secrets y las variables del repo

El repo es **público**, y los logs de GitHub Actions también: cualquiera puede leerlos. Por eso los valores se separan en dos grupos:

- **Secrets**: GitHub reemplaza su valor por `***` en todo log, también cuando aparece dentro de otro texto (un ARN, el nombre de un bucket). El account ID va acá aunque no sea una credencial: así no queda impreso en cada ARN.
- **Variables**: identificadores que pueden verse. Nunca van en el repo.

| Tipo | Nombre | Valor | Obligatorio |
|---|---|---|---|
| Secret | `AWS_ACCOUNT_ID` | Account ID (12 dígitos) | Sí |
| Secret | `ACM_CERTIFICATE_ARN` | ARN del certificado del dominio, en `us-east-1` ([paso 5.a](#a-certificado-y-valores-del-sitio)) | Sí |
| Secret | `BUDGET_EMAIL` | Mail de las alertas del presupuesto | Sí |
| Variable | `AWS_REGION` | `us-east-2` (la misma `aws_region` del bootstrap) | Sí |
| Variable | `AWS_ROLE_PLAN_ARN`, `AWS_ROLE_APPLY_ARN`, `AWS_ROLE_DEPLOY_ARN` | Salidas del bootstrap | Sí |
| Variable | `TF_STATE_BUCKET` | Salida `state_bucket` del bootstrap | Sí |
| Variable | `NAME_PREFIX`, `PROJECT_TAG` | Los mismos `name_prefix` y `project_tag` del bootstrap | Sí |
| Variable | `SITE_DOMAIN` | Dominio del sitio, p. ej. `beta.example.com` | Sí |
| Variable | `AUTH_DOMAIN_PREFIX` | Prefijo del dominio del login: `<prefijo>.auth.<región>.amazoncognito.com` ([paso 3.9](#39-si-ya-tenías-el-bootstrap-aplicado-cuentas-y-perfil-f4-mvp)). Minúsculas, números y guiones; único en la región; nunca el account ID | Sí |
| Variable | `BUDGET_USD` | Límite mensual del presupuesto, en USD | No (10) |
| Variable | `PRICE_CLASS` | `PriceClass_All`, `PriceClass_200` o `PriceClass_100` | No (`PriceClass_All`, incluye Sudamérica) |
| Variable | `VITE_FEEDBACK_URL` | Formulario externo de feedback, si no usás la plantilla de issue | No |

Desde `infra/bootstrap`, con la sesión de administrador del paso 3.1. Los secrets se pasan desde variables de PowerShell, así su valor no queda escrito en el historial de comandos:

```powershell
$AccountId = aws sts get-caller-identity --query Account --output text
gh secret set AWS_ACCOUNT_ID --body $AccountId
gh variable delete AWS_ACCOUNT_ID    # solo si lo habías cargado como variable con una versión anterior de esta guía

gh variable set AWS_REGION          --body "us-east-2"
gh variable set AWS_ROLE_PLAN_ARN   --body (terraform output -raw role_plan_arn)
gh variable set AWS_ROLE_APPLY_ARN  --body (terraform output -raw role_apply_arn)
gh variable set AWS_ROLE_DEPLOY_ARN --body (terraform output -raw role_deploy_content_arn)
gh variable set TF_STATE_BUCKET     --body (terraform output -raw state_bucket)
gh variable set NAME_PREFIX         --body "blueprint"     # el mismo name_prefix del bootstrap
gh variable set PROJECT_TAG         --body "blueprint"     # el mismo project_tag del bootstrap
gh variable set AUTH_DOMAIN_PREFIX  --body "<prefijo-del-login>"   # paso 3.9
```

`SITE_DOMAIN`, `ACM_CERTIFICATE_ARN` y `BUDGET_EMAIL` se cargan en el [paso 5.a](#a-certificado-y-valores-del-sitio). Cargalos como secrets **del repositorio** (no de un environment): los usan tanto el plan (`prod-plan`) como el apply (`prod`), y `AWS_ACCOUNT_ID` también el deploy (`prod-content`).

`infra/envs/prod` usa `TF_STATE_BUCKET` como backend S3 con `use_lockfile = true` (lock nativo de S3; el lock con DynamoDB está deprecado). El nombre del bucket entra solo por `-backend-config` en el workflow: no está escrito en el repo.

### 4.1 Qué queda visible en los logs

[`deploy.yml`](../../.github/workflows/deploy.yml) está pensado para logs públicos:

| Queda visible | No queda visible |
|---|---|
| Los nombres de los recursos (`<prefijo>-gh-apply`, `<prefijo>-site-***-us-east-2`, `<prefijo>-mensual`…), con `***` en lugar del account ID. | El account ID: es un secret, y además `configure-aws-credentials` corre con `mask-aws-account-id`. |
| El dominio del sitio y el ID y el dominio `*.cloudfront.net` de la distribución (son públicos de todos modos: el CNAME los muestra). | El ARN del certificado (secret). |
| Los IDs del OAC y de la *response headers policy* (en el resumen del job `apply`, para el [paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)). Los IDs del user pool, del app client y del identity pool, el dominio del login y el nombre de la tabla: van al JavaScript público del sitio de todos modos (`VITE_AUTH_*`). | El mail del presupuesto: es un secret y, además, `budget_email` es `sensitive` en Terraform, así que el plan muestra `(sensitive value)`. |
| El plan de Terraform: qué recursos cambian y sus atributos (etiquetas, headers, clase de precio…). | Las credenciales: son temporales (1 hora), las enmascara la acción y nunca se imprimen. |
| La lista de archivos que sube el job `deploy`, con su `Cache-Control`. | Los planes guardados y el state: el plan del `apply` queda en el runner y se borra al terminar; nunca se sube como artefacto ni se comenta en el PR. El state solo está en el bucket de state. |

Cada job enmascara además el ARN del rol que asume (`::add-mask::`) antes de cualquier otro paso. El enmascarado es textual: no agregues pasos que impriman esos valores transformados (en base64, partidos, etc.), porque ahí GitHub ya no los reconoce.

## 5. Primer despliegue

Antes de empezar: los secrets y las variables del paso 4 cargados (sin ellos, cada job falla en su primer paso, *Check the configuration*, con la lista de lo que falta) y los environments `prod` (con reviewers) y `prod-content` (solo `main`) creados (paso 2).

El orden importa: **a)** certificado y valores del sitio, **b)** desarmar la beta manual y borrar su registro DNS (solo si ya tenías una), **c)** aprobar el `apply`, **d)** CNAME en tu DNS y **e)** re-aplicar el bootstrap con los IDs nuevos ([paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)).

Qué hace [`deploy.yml`](../../.github/workflows/deploy.yml):

| Job | Cuándo | Environment y rol | Qué hace |
|---|---|---|---|
| `plan` | PR que tocan `infra/**` (solo ramas de tu repo, nunca de forks), push a `main` y ejecución manual | `prod-plan`, `gh-plan` | `terraform plan -detailed-exitcode` de `infra/envs/prod`: dice si hay cambios. En push y ejecución manual lee además el bucket y la distribución del state (vacíos si todavía no hay infraestructura). En un PR, que haya cambios no hace fallar el job. |
| `apply` | Push a `main` y ejecución manual, después de `plan`, **solo si el plan tiene cambios** | `prod` (**espera tu aprobación**), `gh-apply` | Vuelve a planificar y aplica ese plan. Deja en el resumen del job la URL, el destino del CNAME y los IDs del paso 5.1. |
| `deploy` | Push a `main` y ejecución manual, después de `apply`, o de `plan` si `apply` se salteó. Nunca si alguno falló, se canceló o rechazaste el `apply` | `prod-content` (sin aprobación), `gh-deploy-content` | Arma el sitio con `pnpm build:site` (íconos, bundle de contenido sin borradores, build de la web), lo sube con el `Cache-Control` de cada archivo (assets con hash: inmutables; `index.html` y `/content/*.json`: `no-cache`), borra lo que sobra e invalida `/index.html` y `/content/*` con `pnpm deploy:site`. Asume el rol recién después del build. |

Cuántas aprobaciones pide cada ejecución:

| Caso | Jobs que corren | Aprobaciones |
|---|---|---|
| PR que toca `infra/**` (rama de tu repo) | `plan` | 0 |
| Push a `main` sin cambios de infraestructura (web o contenido) | `plan` → `deploy` | 0 |
| Push a `main` con cambios de infraestructura | `plan` → `apply` → `deploy` | 1 (`apply`) |
| Ejecución manual sobre `main` | Igual que un push: con o sin `apply` según el plan | 0 o 1 |
| Primer despliegue de un fork (state vacío) | `plan` → `apply` → `deploy` (el plan crea todo) | 1 (`apply`) |

`deploy` toma el bucket y la distribución del `apply` si corrió (los pudo crear o reemplazar) y, si no, del state que leyó `plan`. Si los dos vienen vacíos, falla en *Check the configuration* con un mensaje que lo dice.

### a) Certificado y valores del sitio

El sitio usa un certificado de ACM que **no administra Terraform**: tiene que existir, estar emitido, cubrir tu dominio y estar en **`us-east-1`**, la región de la que CloudFront lee los certificados ([requisitos de certificados para CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html)). Crealo **sin** la etiqueta `Project`: así `gh-apply` no lo puede cambiar ni borrar (el boundary niega cambiar recursos sin esa etiqueta) y solo lo referencia por ARN.

Si ya tenés uno (por ejemplo, el de la beta manual), reutilizalo. Si no, con la sesión de administrador:

```powershell
$Domain  = "<beta.tu-dominio.com>"
$CertArn = aws acm request-certificate --domain-name $Domain --validation-method DNS `
  --region us-east-1 --query CertificateArn --output text

# El CNAME de validación (puede tardar unos segundos en aparecer; repetí si viene vacío).
aws acm describe-certificate --certificate-arn $CertArn --region us-east-1 `
  --query "Certificate.DomainValidationOptions[0].ResourceRecord"
```

Cargá ese CNAME en tu proveedor de DNS (en Cloudflare, con el proxy **apagado**: *DNS only*) y **no lo borres nunca**: ACM lo usa para renovar el certificado. Esperá a que quede emitido:

```powershell
aws acm wait certificate-validated --certificate-arn $CertArn --region us-east-1
```

Después cargá los valores del sitio:

```powershell
$Domain  = "<beta.tu-dominio.com>"
$CertArn = aws acm list-certificates --region us-east-1 `
  --query "CertificateSummaryList[?DomainName=='$Domain'].CertificateArn | [0]" --output text
$BudgetEmail = "<tu-mail>"

gh variable set SITE_DOMAIN --body $Domain
gh secret set ACM_CERTIFICATE_ARN --body $CertArn
gh secret set BUDGET_EMAIL --body $BudgetEmail
gh variable set BUDGET_USD --body "10"    # opcional
```

`infra/envs/prod` valida que el ARN sea de `us-east-1` y de la cuenta de `AWS_ACCOUNT_ID`. Confirmá también que la etiqueta `Project` esté activada como *cost allocation tag* (paso 3.2): sin eso, el presupuesto existe pero no cuenta nada.

### b) Desarmá la beta manual (solo si la tenés)

Si publicaste antes la beta a mano (con la guía de deploy manual que tuvo este repo hasta F3), hay que desarmarla **antes de aprobar el primer `apply`**. Son dos condiciones, y la nueva distribución falla con `CNAMEAlreadyExists` si no se cumple cualquiera de las dos:

- **Ninguna otra distribución tiene el dominio como alias.** CloudFront no permite el mismo nombre alternativo (CNAME) en dos distribuciones.
- **El DNS del dominio ya no apunta a otra distribución.** Al agregar un alias, CloudFront consulta el DNS de ese nombre. Si todavía resuelve a otra distribución, falla aunque esa distribución ya no tenga el alias, o aunque ya no exista. No alcanza con sacarle el alias a la vieja ni con borrarla: hay que borrar (o cambiar) el registro DNS. El error es ([Troubleshooting distribution issues](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/troubleshooting-distributions.html#troubleshoot-incorrectly-configured-DNS-record-error)):

  ```text
  One or more aliases specified for the distribution includes an incorrectly configured DNS record that points to another CloudFront distribution. You must update the DNS record to correct the problem.
  ```

Lo mismo vale si el dominio apunta a cualquier otra distribución, aunque no sea de una beta. El sitio queda caído desde este paso hasta el paso d.

El momento justo: hacé merge a `main` (o `gh workflow run deploy.yml --ref main`), esperá a que `plan` termine bien y, **mientras `apply` espera la aprobación**, desarmá la beta. Con la sesión de administrador:

```powershell
$Profile = "<perfil-admin>"
$Domain  = "<beta.tu-dominio.com>"

# 1. La distribución vieja: deshabilitarla, esperar a que se despliegue y borrarla.
$OldId = aws cloudfront list-distributions --profile $Profile --output text `
  --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '$Domain')].Id | [0]"
$Current = aws cloudfront get-distribution-config --id $OldId --profile $Profile --output json | ConvertFrom-Json
$Current.DistributionConfig.Enabled = $false
$ConfigPath = Join-Path $env:TEMP "beta-distribution-disabled.json"
[IO.File]::WriteAllText($ConfigPath, ($Current.DistributionConfig | ConvertTo-Json -Depth 50))
aws cloudfront update-distribution --id $OldId --if-match $Current.ETag `
  --distribution-config "file://$ConfigPath" --profile $Profile --query Distribution.Status
aws cloudfront wait distribution-deployed --id $OldId --profile $Profile
$ETag = aws cloudfront get-distribution --id $OldId --query ETag --output text --profile $Profile
aws cloudfront delete-distribution --id $OldId --if-match $ETag --profile $Profile

# 2. Su función (después de la distribución, que la tenía asociada).
$FunctionName = "blueprint-beta-spa-rewrite"
$ETag = aws cloudfront describe-function --name $FunctionName --query ETag --output text --profile $Profile
aws cloudfront delete-function --name $FunctionName --if-match $ETag --profile $Profile

# 3. Su origin access control (se llamaba "<bucket de la beta>-oac").
$OldBucket = "<bucket-de-la-beta>"
$OacId = aws cloudfront list-origin-access-controls --profile $Profile --output text `
  --query "OriginAccessControlList.Items[?Name=='$OldBucket-oac'].Id | [0]"
$ETag = aws cloudfront get-origin-access-control --id $OacId --query ETag --output text --profile $Profile
aws cloudfront delete-origin-access-control --id $OacId --if-match $ETag --profile $Profile
```

4. **Response headers policy**: la beta manual usaba la administrada `SecurityHeadersPolicy`, que es de AWS y no se borra. Solo si creaste una propia para la beta, borrala igual que el OAC (`aws cloudfront list-response-headers-policies --type custom`, `get-response-headers-policy` para el ETag y `delete-response-headers-policy`).

```powershell
# 5. El bucket: primero todas sus versiones y marcadores de borrado (está versionado), después el bucket.
$DeletePath = Join-Path $env:TEMP "beta-delete-objects.json"
while ($true) {
  $Page = aws s3api list-object-versions --bucket $OldBucket --max-items 500 --output json --profile $Profile | ConvertFrom-Json
  $Objects = @(@($Page.Versions) + @($Page.DeleteMarkers) | Where-Object { $_ } |
    ForEach-Object { @{ Key = $_.Key; VersionId = $_.VersionId } })
  if ($Objects.Count -eq 0) { break }
  [IO.File]::WriteAllText($DeletePath, (@{ Objects = $Objects; Quiet = $true } | ConvertTo-Json -Depth 5))
  aws s3api delete-objects --bucket $OldBucket --delete "file://$DeletePath" --profile $Profile | Out-Null
}
aws s3api delete-bucket --bucket $OldBucket --profile $Profile

# 6. El presupuesto viejo (el nuevo se llama <prefijo>-mensual y lo crea el apply).
$AccountId = aws sts get-caller-identity --query Account --output text --profile $Profile
aws budgets delete-budget --account-id $AccountId --budget-name "blueprint-beta-mensual" --profile $Profile
```

7. **El registro DNS del sitio**, el que apunta el dominio a la distribución vieja: en Cloudflare, el `CNAME` (**DNS → Records** → el registro → **Delete**); en Route 53, los alias `A` y `AAAA`. **Borralo**, o cambialo a un destino que no sea de CloudFront. Hacelo aunque la distribución vieja ya no exista: el `apply` falla mientras el dominio resuelva a un `*.cloudfront.net` (ver arriba). En el paso d se crea el registro nuevo.

Antes de aprobar el `apply`, confirmá que el dominio ya no resuelve a la distribución vieja. Consultá un resolver público, no el de tu máquina, que puede tener la respuesta vieja en caché:

```powershell
Resolve-DnsName $Domain -Server 1.1.1.1 -DnsOnly   # bien: "DNS name does not exist"; mal: un CNAME a *.cloudfront.net
```

Si todavía muestra el `*.cloudfront.net` viejo, esperá el TTL del registro que borraste (en Cloudflare, *Auto* son 300 s) y repetí.

Desde que borrás el registro, los resolvers que consultan el dominio guardan la **respuesta negativa** («no existe»). La guardan por el menor de dos valores del registro SOA de la zona: su TTL y su campo MINIMUM ([RFC 2308, sección 5](https://www.rfc-editor.org/rfc/rfc2308#section-5)). Por eso, en el paso d, el dominio puede seguir sin resolver ese tiempo aunque el registro nuevo ya esté bien cargado. Para saber cuánto es:

```powershell
Resolve-DnsName "<tu-dominio.com>" -Type SOA -Server 1.1.1.1 | Select-Object Name, TTL, DefaultTTL   # DefaultTTL es el MINIMUM
```

**No** borres:

- el **certificado** de ACM: lo reutiliza la distribución nueva (`ACM_CERTIFICATE_ARN`);
- su **CNAME de validación** en el DNS (el que empieza con `_`): sin él, ACM no lo puede renovar.

### c) Aprobá el `apply`

En la pestaña **Actions**, abrí la ejecución de `Deploy`, **Review deployments** → `prod` → **Approve and deploy**. El `apply` crea el bucket, el OAC, la función, la *response headers policy*, la distribución (tarda varios minutos en desplegarse) y el presupuesto. Revisá antes el log de `plan`: no tiene que tocar nada fuera de esa lista.

Al terminar, el resumen del job muestra el **destino del CNAME** (`dxxxxxxxxxxxxx.cloudfront.net`) y los IDs del paso 5.1. Después, `deploy` sube el sitio sin pedir otra aprobación.

### d) CNAME del sitio en tu DNS

Terraform no maneja el DNS. En tu proveedor, apuntá el dominio a la distribución nueva. En **Cloudflare**: **DNS → Records**, creá el registro (el viejo lo borraste en el paso b):

| Tipo | Nombre | Destino | Proxy |
|---|---|---|---|
| `CNAME` | `beta` (el subdominio de `SITE_DOMAIN`) | el destino del CNAME del resumen de `apply` | **DNS only** (nube gris) |

Con el proxy de Cloudflare encendido, el tráfico pasaría primero por Cloudflare, con su propio certificado y su propia caché, delante de CloudFront: el sitio está pensado para que lo sirva CloudFront directamente. La guía asume un subdominio: un dominio raíz no admite un `CNAME` estándar.

Verificá contra un resolver público:

```powershell
Resolve-DnsName $Domain -Type CNAME -Server 1.1.1.1 -DnsOnly | Select-Object NameHost   # el destino del resumen de apply
```

Si todavía dice que el nombre no existe, es la respuesta negativa en caché del paso b: esperá el tiempo del SOA que calculaste ahí y repetí. Cuando `1.1.1.1` ya resuelve bien pero tu máquina no, lo que queda es el caché local:

- **Windows**: `Clear-DnsClientCache` (o `ipconfig /flushdns`; si da *acceso denegado*, en una consola de administrador). Comprobalo con `Resolve-DnsName $Domain -Type CNAME`, sin `-Server`.
- **Chrome** tiene su propio caché: abrí `chrome://net-internals/#dns` y apretá **Clear host cache**. Si sigue fallando, en `chrome://net-internals/#sockets`, **Flush socket pools**.

#### Checklist de verificación

Con `$Site = "https://$Domain"`:

- [ ] **La home carga**: abrí `$Site` en una ventana privada. Aparece el onboarding y, arriba, el aviso de beta.
- [ ] **Recargar `/escenarios` funciona**: completá el onboarding, y en el listado apretá F5. También abrí directo `$Site/escenarios/serverless-pdf-processing`.
- [ ] **El contenido carga**: el listado muestra los escenarios publicados (`beta` y `published`) y ninguno dice "Borrador".
- [ ] **Los íconos cargan**: entrá a un escenario; la paleta muestra los íconos de los servicios.
- [ ] **Los headers de seguridad están presentes**:

  ```powershell
  curl.exe -sI "$Site/" | Select-String "strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|cache-control|content-type"
  curl.exe -sI "$Site/escenarios" | Select-String "^HTTP|content-type"          # 200, text/html
  curl.exe -sI "$Site/content/index.json" | Select-String "content-type|cache-control"   # application/json, no-cache
  curl.exe -sI "http://$Domain/" | Select-String "^HTTP|location"               # 301 hacia https
  curl.exe -sI --http3 "$Site/" | Select-String "^HTTP"                          # HTTP/3, si tu curl lo soporta
  ```

- [ ] **El bucket no es público**: `curl.exe -sI "https://<bucket del sitio>.s3.<región>.amazonaws.com/index.html"` responde 403 (el bucket es `<prefijo>-site-<cuenta>-<región>`).
- [ ] **"Reportar un problema"** (menú "⋯" del juego y pantalla de resumen) abre un issue nuevo en el repositorio con la plantilla "Error en un escenario" y el escenario ya cargado.
- [ ] **"Contanos qué te pareció"** (aviso de beta) abre la plantilla "Feedback de la beta" en GitHub, o tu formulario si definiste `VITE_FEEDBACK_URL`.
- [ ] En una ventana de menos de 1024 px de ancho aparece el aviso de "pensado para escritorio" y se puede cerrar.
- [ ] El código fuente de la página tiene `<meta name="robots" content="noindex">`.
- [ ] **La Content-Security-Policy no reporta violaciones**: ver [Revisar la Content-Security-Policy](#revisar-la-content-security-policy).
- [ ] **Las cuentas funcionan** ([ADR-0029](../adr/0029-perfil-con-cognito-y-dynamodb-desde-el-navegador.md)), en una ventana privada con la consola abierta:
  1. Jugá un escenario como invitado y apretá «Ingresar o crear cuenta»: abre `https://<AUTH_DOMAIN_PREFIX>.auth.<región>.amazoncognito.com/login`.
  2. *Sign up* con un mail tuyo; llega un código de verificación (de `no-reply@verificationemail.com`; mirá el spam). Al confirmarlo, volvés a la misma pantalla con un aviso de que tu progreso subió a la cuenta.
  3. El menú de la cuenta muestra tu mail y tu XP; cambiá el nombre visible.
  4. Abrí el sitio en **otro navegador**, ingresá con la misma cuenta: aparece tu progreso.
  5. «Cerrar sesión» vuelve al progreso de invitado de ese navegador. Volvé a ingresar y probá «Eliminar mi cuenta»: después, ingresar con ese mail ya no funciona.
  6. En la consola, ninguna violación de la CSP y ningún error de CORS.

Repetí el checklist después de cada `deploy` que cambie la web.

#### Revisar la Content-Security-Policy

La política del sitio está en `tools/deploy-site/cloudfront/content-security-policy.txt` ([ADR-0028](../adr/0028-content-security-policy.md)). Por ahora va en modo **Report-Only**: el navegador no bloquea nada, solo avisa en la consola lo que bloquearía. No hay endpoint de reportes, así que la única forma de ver una violación es la consola.

1. Confirmá el header:

   ```powershell
   curl.exe -sI "$Site/" | Select-String "content-security-policy"
   # content-security-policy-report-only: default-src 'self'; script-src 'self'; ...
   ```

2. Abrí `$Site` en Chrome o Edge, **F12** → pestaña **Console**. Recorré el juego: onboarding, el listado (recargá con F5), un escenario (arrastrá una carta, abrí una pista, el menú «⋯» y la versión imprimible).
3. Cada violación aparece como un error que empieza con **`[Report Only] Refused to …`** e indica la directiva (`script-src`, `style-src-elem`, `img-src`…) y el archivo y la línea que la causaron. Para ver solo esas, escribí `Report Only` en el filtro de la consola. La pestaña **Issues** de DevTools también las lista, agrupadas.
4. Si aparece alguna, no cambies la política en la consola de AWS: abrí un issue con el mensaje completo y la página donde ocurrió. La política se cambia por PR, en el archivo, y la prueba e2e `apps/web/e2e/site/csp.spec.ts` (con `pnpm e2e`) tiene que pasar.

Lo mismo se puede revisar en local, antes de subir nada: `pnpm build:site` y `pnpm preview:site` sirven `dist/site` con el mismo header.

### 5.1 Acotá los OAC y las response headers policies

Es el paso **e)** del primer despliegue. El primer `apply` crea el *origin access control* y la *response headers policy* del sitio, pero `gh-apply` todavía no los puede cambiar ni borrar: con las variables vacías, el boundary lo niega para todos. Antes de cambiar cualquiera de los dos (por ejemplo, los headers de seguridad o la CSP del [issue #44](https://github.com/elissamburu/blueprint-the-game/issues/44)), re-aplicá el bootstrap con sus IDs.

Los dos IDs están en el resumen del job `apply` (`cloudfront_oac_ids` y `cloudfront_response_headers_policy_ids`). También los podés buscar con la sesión de administrador del paso 3.1 (los nombres que pone `infra/envs/prod` empiezan con el prefijo: `<prefijo>-site` y `<prefijo>-security-headers`):

```powershell
$Prefix = "<name_prefix>"
aws cloudfront list-origin-access-controls `
  --query "OriginAccessControlList.Items[?starts_with(Name, '$Prefix-')].[Id, Name]" --output text
aws cloudfront list-response-headers-policies --type custom `
  --query "ResponseHeadersPolicyList.Items[?starts_with(ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name, '$Prefix-')].[ResponseHeadersPolicy.Id, ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name]" --output text
```

Confirmá que cada uno es el que usa la distribución del proyecto (consola de CloudFront → la distribución → *Origins* y *Behaviors*) y completá `terraform.tfvars`:

```hcl
cloudfront_oac_ids                     = ["E1ABCDEFGHIJKL"]
cloudfront_response_headers_policy_ids = ["67f7725c-6f97-4210-82d7-5512b31e9d03"]
```

Después, desde `infra/bootstrap`, igual que en el paso 3.4: `terraform plan -out bootstrap.tfplan` (solo cambian la política de `gh-apply` y el boundary), `terraform apply bootstrap.tfplan` y `Remove-Item bootstrap.tfplan`. Resguardá el state otra vez (paso 3.6).

Repetí este paso si un cambio en `infra/envs/prod` **reemplaza** uno de esos recursos (el plan muestra `must be replaced`): el nuevo tiene otro ID. Para que el `apply` pueda borrar el viejo, el viejo tiene que seguir en la lista; agregá el nuevo después del `apply` y sacá el viejo.

### Deploys siguientes

- Un PR que toca `infra/**` o `tools/deploy-site/cloudfront/**` (la función y la CSP, que Terraform lee de ahí), desde una rama de tu repo, corre `plan`: revisalo en el log antes de aprobar el merge.
- Cada push a `main` corre `plan` y `deploy`. Si el plan tiene cambios de infraestructura, en el medio corre `apply`, que espera tu aprobación; si no, `apply` se saltea y `deploy` publica la web y el contenido de ese commit sin pedir nada. Lo que llega a `main` se publica: la revisión del PR es el control.
- Para volver atrás, revertí el commit en `main` (o corré `deploy.yml` sobre `main` después del revert): el sitio se regenera completo desde el código.

## 6. Verificá que el aislamiento funciona

| Prueba | Resultado esperado |
|---|---|
| Correr `deploy.yml` desde una rama que no es `main` | `prod` y `prod-content` la rechazan (regla de ramas): no se asumen `gh-apply` ni `gh-deploy-content`. |
| Un workflow de otra rama con un job `environment: prod-content` | `prod-content` lo rechaza por la regla de ramas (no tiene reviewers que lo frenen): no se asume `gh-deploy-content`. |
| Asumir `gh-deploy-content` desde un job con `environment: prod` | `Not authorized to perform sts:AssumeRoleWithWebIdentity`: solo confía en `prod-content`. |
| Correr el plan desde la rama de un PR de tu repo | Corre con `prod-plan` y asume `gh-plan`, que solo lee y toma el lock. |
| Abrir un PR desde otro fork | El job de plan no corre (condición sobre `head.repo.full_name`) y `ci.yml` corre sin `id-token`: sin acceso a AWS. |
| Asumir `gh-apply` desde un job sin `environment: prod` | `Not authorized to perform sts:AssumeRoleWithWebIdentity`. |

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | El `sub` no coincide (formato inmutable vs anterior, environment mal escrito, IDs incorrectos). | Corré `oidc-debug.yml` y compará el `sub` con la trust policy. Ajustá `subject_format` o los IDs y re-aplicá el bootstrap. |
| `Faltan secrets o variables del repo: …` en *Check the configuration* | No se cargaron los valores del paso 4 o del 5.a. | Cargá los que nombra el error y volvé a correr el job. |
| `Credentials could not be loaded` | Falta `permissions: id-token: write` en el job, o `AWS_ROLE_*_ARN` está vacía. | Revisá el job y las variables del paso 4. |
| `EntityAlreadyExists` al crear el proveedor OIDC | La cuenta ya tiene uno para `token.actions.githubusercontent.com`. | `create_oidc_provider = false` (paso 3.2). |
| `terraform plan` falla porque el account ID no está permitido (`allowed_account_ids`) | El perfil apunta a otra cuenta que `account_id`. | Revisá `aws sts get-caller-identity` y el perfil. |
| `AccessDenied` en `gh-apply` sobre un recurso existente | El recurso no tiene la etiqueta `Project` o su nombre no empieza con el prefijo. | Etiquetalo (o importalo con la etiqueta) con credenciales de administrador. |
| `AccessDenied` en `cloudfront:UpdateOriginAccessControl`, `UpdateResponseHeadersPolicy` o sus `Delete*` | El ID no está en `cloudfront_oac_ids` o `cloudfront_response_headers_policy_ids`. | Agregalo y re-aplicá el bootstrap ([paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)). |
| `Error acquiring the state lock` | Quedó un lock de una ejecución cancelada. | Confirmá que no haya otra ejecución y usá `terraform force-unlock <ID>`. |
| `No hay bucket ni distribución del sitio` en *Check the configuration* del job `deploy` | El plan no tuvo cambios pero el state de `infra/envs/prod` no tiene outputs (p. ej., se borró la infraestructura fuera de Terraform). | Revisá el log de `plan` y corré `deploy.yml` sobre `main`: si falta infraestructura, el plan tiene cambios y `apply` la vuelve a crear. |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` en *Assume gh-deploy-content* | El bootstrap y `deploy.yml` no coinciden en el environment: uno usa `prod` y el otro `prod-content`. | Seguí el orden del [paso 3.8](#38-si-ya-tenías-el-bootstrap-aplicado-migrar-a-prod-content). |
| El sitio muestra `AccessDenied` | Contenido no subido o política de OAC incompleta. | Revisá el job `deploy` y la política del bucket del sitio. |
| `CNAMEAlreadyExists` en el `apply` | Otra distribución (p. ej. la de la beta manual) tiene el mismo dominio como alias, o el DNS del dominio todavía apunta a otra distribución (*incorrectly configured DNS record that points to another CloudFront distribution*), aunque esa ya no exista. | Desarmá la beta y borrá el registro DNS del sitio ([paso 5.b](#b-desarmá-la-beta-manual-solo-si-la-tenés)); confirmá con `Resolve-DnsName <dominio> -Server 1.1.1.1` y volvé a correr el workflow. |
| `InvalidViewerCertificate` en el `apply` | El certificado no está emitido o no cubre `SITE_DOMAIN`. | `aws acm describe-certificate --certificate-arn <ARN> --region us-east-1 --query Certificate.Status` ([paso 5.a](#a-certificado-y-valores-del-sitio)). |
| El plan falla en la validación de `acm_certificate_arn`, `domain` o `budget_email` | Falta el secret o la variable, o tiene otro formato. | Paso 4 y paso 5.a. |
| El dominio no resuelve o muestra el certificado de Cloudflare | Falta el `CNAME` o tiene el proxy encendido. | [Paso 5.d](#d-cname-del-sitio-en-tu-dns): *DNS only*. |
| El `CNAME` está bien cargado pero el dominio sigue sin resolver | Respuesta negativa en caché (RFC 2308), en un resolver, en Windows o en Chrome. | [Paso 5.d](#d-cname-del-sitio-en-tu-dns): verificá con `-Server 1.1.1.1` y limpiá los cachés locales. |
| Terraform no encuentra credenciales aunque `aws sts get-caller-identity` funciona | Sesión de `aws login`, que el SDK de Go de Terraform no soporta. | Exportá las credenciales ([paso 3.1](#31-sesión-y-chequeo-de-la-cuenta)). |
| Renombraste o transferiste el repo | Desde el 15/07/2026, eso cambia el `sub` al formato inmutable. | Actualizá `subject_format`/IDs y re-aplicá el bootstrap. |

## 8. Checklist de seguridad de la cuenta (recomendado)

- [ ] MFA en el usuario root y root sin access keys.
- [ ] Sin usuarios IAM con access keys (todo por Identity Center u OIDC).
- [ ] CloudTrail habilitado (a nivel de Organization si tenés una).
- [ ] Alarma de presupuesto activa (la crea `infra/envs/prod`) y la etiqueta `Project` activada como *cost allocation tag* (paso 3.2).
- [ ] Copia cifrada del state del bootstrap fuera de AWS (paso 3.6).
- [ ] Revisar periódicamente el Access Analyzer de IAM.

## 9. Desmontar todo

```powershell
# 1) Infra de la app (con credenciales admin locales)
cd infra/envs/prod; terraform init -backend-config="bucket=<state_bucket>"; terraform destroy   # pide las mismas variables: terraform.tfvars.example
# 2) Bootstrap (su state es local)
cd ../../bootstrap; terraform destroy
```

> El bucket de state tiene versionado: para borrarlo hay que vaciar también las versiones. Para eso, aplicá antes con `state_bucket_force_destroy = true` (desactivado por defecto).
>
> Si el bootstrap creó el proveedor OIDC (`create_oidc_provider = true`), `destroy` también lo borra. En una cuenta compartida, confirmá antes que ningún otro proyecto lo use; si lo usa, sacalo del state (`terraform state rm 'aws_iam_openid_connect_provider.github[0]'`) antes de destruir.

## Referencias

- GitHub Docs — [Configuring OpenID Connect in Amazon Web Services](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- GitHub Docs — [OpenID Connect reference (formatos de `sub` y subject inmutable)](https://docs.github.com/en/actions/reference/security/oidc)
- AWS IAM API — [CreateOpenIDConnectProvider (thumbprint opcional)](https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreateOpenIDConnectProvider.html)
- AWS CLI v2 — [iam simulate-principal-policy](https://docs.aws.amazon.com/cli/latest/reference/iam/simulate-principal-policy.html)
- AWS Billing — [Budget filters](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create-filters.html) y [Activating user-defined cost allocation tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/activating-tags.html)
- Amazon Route 53 — [Using IAM policy conditions for fine-grained access control](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/specifying-rrset-conditions.html)
- AWS — [Service Authorization Reference](https://docs.aws.amazon.com/service-authorization/latest/reference/reference.html) (qué tipos de recurso admiten `aws:ResourceTag`) y su página de [CloudFront](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazoncloudfront.html) (formato de los ARN de OAC y *response headers policies*)
- Terraform — [Backend S3 (`use_lockfile`, deprecación del locking con DynamoDB)](https://developer.hashicorp.com/terraform/language/backend/s3)
- Terraform — [Tests con providers simulados](https://developer.hashicorp.com/terraform/language/tests/mocking)
