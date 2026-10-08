# Guía · Configurar AWS en tu fork (OIDC, sin access keys)

Esta guía deja tu fork desplegando en **tu** cuenta de AWS con GitHub Actions, sin credenciales de larga vida. Se hace **una sola vez, a mano**. Después, cada merge a `main` despliega solo (con tu aprobación).

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
└── Rol <prefijo>-gh-deploy-content  ← solo desde el environment "prod" de TU repo
```

Ningún rol se puede asumir desde otro repo, otra rama sin environment ni un PR de un fork. Todo lleva la etiqueta `Project = <project_tag>`.

El primer despliegue (paso 5) suma, desde GitHub Actions:

```
├── Bucket S3 <prefijo>-site-<cuenta>-<región>  ← privado; solo lo lee la distribución
├── CloudFront: distribución (con tu dominio), origin access control <prefijo>-site,
│     función <prefijo>-spa-rewrite y response headers policy <prefijo>-security-headers
└── Presupuesto <prefijo>-mensual              ← filtrado por la etiqueta Project
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
| `prod` | **Sí (vos, y quien más apruebe despliegues)** | Solo `main` | `terraform apply` y subida de la web y el contenido (roles `gh-apply` y `gh-deploy-content`) |

En `prod`:

- **Required reviewers**: agregá al menos una persona. El job que asume `gh-apply` se pausa hasta que alguien lo apruebe.
- **Deployment branches and tags**: *Selected branches and tags* → `main`.
- Si hay más de una persona con permisos, activá **Prevent self-review** para que quien dispara el despliegue no se lo apruebe a sí misma.

En `prod-plan`, ni reviewers ni restricción de ramas: el `plan` de un PR corre en la rama del PR. Eso quiere decir que un workflow de **cualquier rama de tu repo** puede asumir `gh-plan`, que solo lee (los recursos del proyecto y el state) y toma el lock del state. Por eso:

- El job `plan` de [`deploy.yml`](../../.github/workflows/deploy.yml) **no corre en PR de forks**: su job lleva la condición `github.event.pull_request.head.repo.full_name == github.repository`, además de que los PR de forks corren sin acceso a AWS ([ADR-0015](../adr/0015-ci-para-prs-de-forks.md)).
- Quien puede crear ramas en tu repo puede leer el state y la configuración del proyecto: dale permiso de escritura solo a personas de confianza.

Los nombres tienen que ser exactamente `prod-plan` y `prod`: son parte del `sub` que la trust policy compara.

Además, en **Settings → Branches**, protegé `main`: PR obligatorio, checks requeridos (`ci`) y sin force-push.

## 3. Aplicá el bootstrap (una sola vez)

### 3.1 Sesión y chequeo de la cuenta

```powershell
aws sso login --profile <perfil-admin>
$env:AWS_PROFILE = "<perfil-admin>"
aws sts get-caller-identity          # confirmá que es la cuenta correcta
```

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

**Trust policy** de `gh-apply` (formato inmutable):

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
        "token.actions.githubusercontent.com:sub": "repo:<OWNER>@<OWNER_ID>/<REPO>@<REPO_ID>:environment:prod"
      }
    }
  }]
}
```

En Terraform, el `sub` se arma en [infra/bootstrap/locals.tf](../../infra/bootstrap/locals.tf):

```hcl
repo_ref = (
  var.subject_format == "immutable"
  ? "${var.github_owner}@${var.github_owner_id}/${var.github_repo}@${var.github_repo_id}"
  : "${var.github_owner}/${var.github_repo}"
)
# sub = "repo:${local.repo_ref}:environment:${environment}"   (prod-plan o prod)
```

**Permisos** ([infra/bootstrap/iam_policies.tf](../../infra/bootstrap/iam_policies.tf)), pensados para una cuenta compartida:

| Rol | Puede |
|---|---|
| `gh-plan` | Leer el state y tomar el lock; leer los buckets `<prefijo>-*`, CloudFront, los certificados de `us-east-1`, los presupuestos `<prefijo>-*`, los roles y políticas `<prefijo>-*` y, si la configuraste, la hosted zone. |
| `gh-apply` | Lo de `gh-plan`, escribir el state, y crear o cambiar los recursos del proyecto: buckets `<prefijo>-*`; distribuciones, funciones y certificados **con la etiqueta `Project`**; crear *origin access controls* y *response headers policies*, y cambiar o borrar solo los de `cloudfront_oac_ids` y `cloudfront_response_headers_policy_ids`; presupuestos `<prefijo>-*`; roles y políticas `<prefijo>-*` con el boundary; los registros de Route 53 listados. |
| `gh-deploy-content` | Listar, subir y borrar archivos en buckets `<prefijo>-*` (nunca en el de state) e invalidar distribuciones con la etiqueta `Project`. |

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
```

`SITE_DOMAIN`, `ACM_CERTIFICATE_ARN` y `BUDGET_EMAIL` se cargan en el [paso 5.a](#a-certificado-y-valores-del-sitio). Cargalos como secrets **del repositorio** (no de un environment): los usan tanto el plan (`prod-plan`) como el apply (`prod`).

`infra/envs/prod` usa `TF_STATE_BUCKET` como backend S3 con `use_lockfile = true` (lock nativo de S3; el lock con DynamoDB está deprecado). El nombre del bucket entra solo por `-backend-config` en el workflow: no está escrito en el repo.

### 4.1 Qué queda visible en los logs

[`deploy.yml`](../../.github/workflows/deploy.yml) está pensado para logs públicos:

| Queda visible | No queda visible |
|---|---|
| Los nombres de los recursos (`<prefijo>-gh-apply`, `<prefijo>-site-***-us-east-2`, `<prefijo>-mensual`…), con `***` en lugar del account ID. | El account ID: es un secret, y además `configure-aws-credentials` corre con `mask-aws-account-id`. |
| El dominio del sitio y el ID y el dominio `*.cloudfront.net` de la distribución (son públicos de todos modos: el CNAME los muestra). | El ARN del certificado (secret). |
| Los IDs del OAC y de la *response headers policy* (en el resumen del job `apply`, para el [paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)). | El mail del presupuesto: es un secret y, además, `budget_email` es `sensitive` en Terraform, así que el plan muestra `(sensitive value)`. |
| El plan de Terraform: qué recursos cambian y sus atributos (etiquetas, headers, clase de precio…). | Las credenciales: son temporales (1 hora), las enmascara la acción y nunca se imprimen. |
| La lista de archivos que sube el job `deploy`, con su `Cache-Control`. | Los planes guardados y el state: el plan del `apply` queda en el runner y se borra al terminar; nunca se sube como artefacto ni se comenta en el PR. El state solo está en el bucket de state. |

Cada job enmascara además el ARN del rol que asume (`::add-mask::`) antes de cualquier otro paso. El enmascarado es textual: no agregues pasos que impriman esos valores transformados (en base64, partidos, etc.), porque ahí GitHub ya no los reconoce.

## 5. Primer despliegue

El orden importa: **a)** certificado y valores del sitio, **b)** desarmar la beta manual (solo si ya tenías una), **c)** aprobar el `apply`, **d)** CNAME en tu DNS y **e)** re-aplicar el bootstrap con los IDs nuevos ([paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)).

Qué hace [`deploy.yml`](../../.github/workflows/deploy.yml):

| Job | Cuándo | Environment y rol | Qué hace |
|---|---|---|---|
| `plan` | PR que tocan `infra/**` (solo ramas de tu repo, nunca de forks), push a `main` y ejecución manual | `prod-plan`, `gh-plan` | `terraform plan` de `infra/envs/prod`. |
| `apply` | Push a `main` y ejecución manual, después de `plan` | `prod` (**espera tu aprobación**), `gh-apply` | Vuelve a planificar y aplica ese plan. Deja en el resumen del job la URL, el destino del CNAME y los IDs del paso 5.1. |
| `deploy` | Después de `apply` | `prod` (**espera tu aprobación**), `gh-deploy-content` | Arma el sitio como `pnpm build:beta` (íconos, bundle de contenido sin borradores, build de la web), lo sube con el `Cache-Control` de cada archivo (assets con hash: inmutables; `index.html` y `/content/*.json`: `no-cache`), borra lo que sobra e invalida `/index.html` y `/content/*`. Asume el rol recién después del build. |

Cada push a `main` pide **dos aprobaciones**: una para `apply` y otra para `deploy` (los dos jobs usan `prod`).

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

Si publicaste antes la beta con la [guía de deploy manual](deploy-manual-beta.md), hay que desarmarla **antes de aprobar el primer `apply`**: CloudFront no permite el mismo nombre alternativo (CNAME) en dos distribuciones, y la nueva falla con `CNAMEAlreadyExists` mientras la vieja exista. El sitio queda caído desde este paso hasta el paso d.

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

4. **Response headers policy**: la guía manual usa la administrada `SecurityHeadersPolicy`, que es de AWS y no se borra. Solo si creaste una propia para la beta, borrala igual que el OAC (`aws cloudfront list-response-headers-policies --type custom`, `get-response-headers-policy` para el ETag y `delete-response-headers-policy`).

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

**No** borres:

- el **certificado** de ACM: lo reutiliza la distribución nueva (`ACM_CERTIFICATE_ARN`);
- su **CNAME de validación** en el DNS: sin él, ACM no lo puede renovar;
- el CNAME del sitio en tu DNS: se actualiza en el paso d.

Si la beta usaba registros de Route 53, borralos en el paso d, cuando el CNAME nuevo ya esté cargado.

### c) Aprobá el `apply`

En la pestaña **Actions**, abrí la ejecución de `Deploy`, **Review deployments** → `prod` → **Approve and deploy**. El `apply` crea el bucket, el OAC, la función, la *response headers policy*, la distribución (tarda varios minutos en desplegarse) y el presupuesto. Revisá antes el log de `plan`: no tiene que tocar nada fuera de esa lista.

Al terminar, el resumen del job muestra el **destino del CNAME** (`dxxxxxxxxxxxxx.cloudfront.net`) y los IDs del paso 5.1. Después, `deploy` pide la segunda aprobación y sube el sitio.

### d) CNAME del sitio en tu DNS

Terraform no maneja el DNS. En tu proveedor, apuntá el dominio a la distribución nueva. En **Cloudflare**: **DNS → Records**, editá (o creá) el registro:

| Tipo | Nombre | Destino | Proxy |
|---|---|---|---|
| `CNAME` | `beta` (el subdominio de `SITE_DOMAIN`) | el destino del CNAME del resumen de `apply` | **DNS only** (nube gris) |

Con el proxy de Cloudflare encendido, el tráfico pasaría primero por Cloudflare, con su propio certificado y su propia caché, delante de CloudFront: el sitio está pensado para que lo sirva CloudFront directamente. La guía asume un subdominio: un dominio raíz no admite un `CNAME` estándar.

Verificá (puede tardar unos minutos en propagarse):

```powershell
Resolve-DnsName $Domain -Type CNAME | Select-Object NameHost
curl.exe -sI "https://$Domain/" | Select-String "^HTTP|strict-transport-security|x-content-type-options|x-frame-options|referrer-policy|cache-control"
curl.exe -sI "https://$Domain/escenarios" | Select-String "^HTTP|content-type"            # 200, text/html
curl.exe -sI "https://$Domain/content/index.json" | Select-String "content-type|cache-control"   # application/json, no-cache
```

Y en el navegador, el checklist de la [guía de deploy manual](deploy-manual-beta.md) (sección 8.3): home, recarga de `/escenarios`, escenarios, íconos y enlaces de feedback.

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

- Un PR que toca `infra/**` (desde una rama de tu repo) corre `plan`: revisalo en el log antes de aprobar el merge.
- Cada push a `main` corre `plan`, `apply` y `deploy`, con dos aprobaciones. Si no hay cambios de infraestructura, el `apply` no cambia nada y `deploy` publica la web y el contenido de ese commit.
- Para volver atrás, revertí el commit en `main` (o corré `deploy.yml` sobre `main` después del revert): el sitio se regenera completo desde el código.

## 6. Verificá que el aislamiento funciona

| Prueba | Resultado esperado |
|---|---|
| Correr `deploy.yml` desde una rama que no es `main` | `prod` la rechaza (regla de ramas): no se asumen `gh-apply` ni `gh-deploy-content`. |
| Correr el plan desde la rama de un PR de tu repo | Corre con `prod-plan` y asume `gh-plan`, que solo lee y toma el lock. |
| Abrir un PR desde otro fork | El job de plan no corre (condición sobre `head.repo.full_name`) y `ci.yml` corre sin `id-token`: sin acceso a AWS. |
| Asumir `gh-apply` desde un job sin `environment: prod` | `Not authorized to perform sts:AssumeRoleWithWebIdentity`. |

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | El `sub` no coincide (formato inmutable vs anterior, environment mal escrito, IDs incorrectos). | Corré `oidc-debug.yml` y compará el `sub` con la trust policy. Ajustá `subject_format` o los IDs y re-aplicá el bootstrap. |
| `Credentials could not be loaded` | Falta `permissions: id-token: write` en el workflow o en el job. | Agregalo en el job que asume el rol. |
| `EntityAlreadyExists` al crear el proveedor OIDC | La cuenta ya tiene uno para `token.actions.githubusercontent.com`. | `create_oidc_provider = false` (paso 3.2). |
| `terraform plan` falla porque el account ID no está permitido (`allowed_account_ids`) | El perfil apunta a otra cuenta que `account_id`. | Revisá `aws sts get-caller-identity` y el perfil. |
| `AccessDenied` en `gh-apply` sobre un recurso existente | El recurso no tiene la etiqueta `Project` o su nombre no empieza con el prefijo. | Etiquetalo (o importalo con la etiqueta) con credenciales de administrador. |
| `AccessDenied` en `cloudfront:UpdateOriginAccessControl`, `UpdateResponseHeadersPolicy` o sus `Delete*` | El ID no está en `cloudfront_oac_ids` o `cloudfront_response_headers_policy_ids`. | Agregalo y re-aplicá el bootstrap ([paso 5.1](#51-acotá-los-oac-y-las-response-headers-policies)). |
| `Error acquiring the state lock` | Quedó un lock de una ejecución cancelada. | Confirmá que no haya otra ejecución y usá `terraform force-unlock <ID>`. |
| El sitio muestra `AccessDenied` | Contenido no subido o política de OAC incompleta. | Revisá el job `deploy` y la política del bucket del sitio. |
| `CNAMEAlreadyExists` en el `apply` | Otra distribución (p. ej. la de la beta manual) tiene el mismo dominio como alias. | Desarmá la beta ([paso 5.b](#b-desarmá-la-beta-manual-solo-si-la-tenés)) y volvé a correr el workflow. |
| `InvalidViewerCertificate` en el `apply` | El certificado no está emitido o no cubre `SITE_DOMAIN`. | `aws acm describe-certificate --certificate-arn <ARN> --region us-east-1 --query Certificate.Status` ([paso 5.a](#a-certificado-y-valores-del-sitio)). |
| El plan falla en la validación de `acm_certificate_arn`, `domain` o `budget_email` | Falta el secret o la variable, o tiene otro formato. | Paso 4 y paso 5.a. |
| El dominio no resuelve o muestra el certificado de Cloudflare | Falta el `CNAME` o tiene el proxy encendido. | [Paso 5.d](#d-cname-del-sitio-en-tu-dns): *DNS only*. |
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
