# Guía · Configurar AWS en tu fork (OIDC, sin access keys)

Esta guía deja tu fork desplegando en **tu** cuenta de AWS con GitHub Actions, sin credenciales de larga vida. Se hace **una sola vez, a mano**. Después, cada merge a `main` despliega solo (con tu aprobación).

> Decisiones de diseño detrás de esta guía: [ADR-0014](../adr/0014-infra-terraform-oidc.md) (con su enmienda por cuenta compartida) y [ADR-0015](../adr/0015-ci-para-prs-de-forks.md).
> Tiempo estimado: 30–45 minutos, más hasta 48 horas de espera para la etiqueta de costos (no bloquea).
>
> **Estado:** el bootstrap (`infra/bootstrap`) está listo. El despliegue (`infra/envs/prod` y `deploy.yml`, pasos 5 y 6) llega en el paso 2 de F3, y la guía completa se prueba de punta a punta en una cuenta limpia en el paso 6 ([roadmap](../05-roadmap.md#f3--infraestructura-y-despliegue)).

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

- El workflow de plan (llega en el paso 2 de F3) **no corre en PR de forks**: su job lleva la condición `github.event.pull_request.head.repo.full_name == github.repository`, además de que los PR de forks corren sin acceso a AWS ([ADR-0015](../adr/0015-ci-para-prs-de-forks.md)).
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

# Opcional: dominio propio en Route 53. Vacío = los roles no tienen permisos de Route 53.
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

## 4. Configurá las variables del repo

No son secretos: son identificadores. Van como **variables** de GitHub (no *secrets*), y nunca en el repo. Desde `infra/bootstrap`:

```powershell
gh variable set AWS_REGION          --body "us-east-2"
gh variable set AWS_ACCOUNT_ID      --body (aws sts get-caller-identity --query Account --output text)
gh variable set AWS_ROLE_PLAN_ARN   --body (terraform output -raw role_plan_arn)
gh variable set AWS_ROLE_APPLY_ARN  --body (terraform output -raw role_apply_arn)
gh variable set AWS_ROLE_DEPLOY_ARN --body (terraform output -raw role_deploy_content_arn)
gh variable set TF_STATE_BUCKET     --body (terraform output -raw state_bucket)
gh variable set NAME_PREFIX         --body "blueprint"     # el mismo name_prefix del bootstrap
gh variable set PROJECT_TAG         --body "blueprint"     # el mismo project_tag del bootstrap
```

`infra/envs/prod` usa ese bucket como backend S3 con `use_lockfile = true` (lock nativo de S3; el lock con DynamoDB está deprecado).

## 5. Primer despliegue

> Disponible desde el paso 2 de F3 (`infra/envs/prod` y `deploy.yml`).

```powershell
gh workflow run deploy.yml --ref main
gh run watch
```

El workflow:
1. **build** (sin AWS): tests, `content:build`, build de la web, `icons:fetch`.
2. **plan** (environment `prod-plan`, rol `gh-plan`): `terraform plan` de `infra/envs/prod` y el plan como artefacto de corta retención.
3. **apply** (environment `prod`, rol `gh-apply`): **se pausa hasta que apruebes** en la pestaña Actions. Aplica el plan guardado.
4. **deploy-content** (environment `prod`, rol `gh-deploy-content`): sube la web y el bundle de contenido e invalida CloudFront.

El job que asume un rol lo hace así (acciones fijadas por SHA en el repo real):

```yaml
permissions:
  id-token: write      # necesario para pedir el token OIDC
  contents: read
jobs:
  apply:
    environment: prod
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@<SHA>
        with:
          role-to-assume: ${{ vars.AWS_ROLE_APPLY_ARN }}
          aws-region: ${{ vars.AWS_REGION }}
```

Al terminar, la URL del sitio aparece en el resumen del job (`terraform output site_url`).

### 5.1 Acotá los OAC y las response headers policies

El primer `apply` crea el *origin access control* y la *response headers policy* del sitio, pero `gh-apply` todavía no los puede cambiar ni borrar: con las variables vacías, el boundary lo niega para todos. Antes de cambiar cualquiera de los dos (por ejemplo, los headers de seguridad), re-aplicá el bootstrap con sus IDs.

Con la sesión de administrador del paso 3.1, buscá los IDs (los nombres que pone `infra/envs/prod` empiezan con el prefijo):

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
| El sitio muestra `AccessDenied` | Contenido no subido o política de OAC incompleta. | Revisá el job `deploy-content` y la política del bucket del sitio. |
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
cd infra/envs/prod; terraform init -backend-config=...; terraform destroy
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
