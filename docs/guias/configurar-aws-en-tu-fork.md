# Guía · Configurar AWS en tu fork (OIDC, sin access keys)

Esta guía deja tu fork desplegando en **tu** cuenta de AWS con GitHub Actions, sin credenciales de larga vida. Se hace **una sola vez, a mano**. Después, cada merge a `main` despliega solo (con tu aprobación).

> Decisiones de diseño detrás de esta guía: [ADR-0014](../adr/0014-infra-terraform-oidc.md) y [ADR-0015](../adr/0015-ci-para-prs-de-forks.md).
> Tiempo estimado: 30–45 minutos.

## Qué vas a crear

```
Tu cuenta de AWS
├── Bucket S3 de state de Terraform (versionado, cifrado, sin acceso público, lock nativo)
├── Proveedor OIDC: token.actions.githubusercontent.com  (audiencia sts.amazonaws.com)
├── Rol gh-plan            ← solo desde el environment "prod-plan" de TU repo
├── Rol gh-apply           ← solo desde el environment "prod" de TU repo (con aprobación manual)
└── Rol gh-deploy-content  ← solo desde el environment "prod" de TU repo
```

Ningún rol se puede asumir desde otro repo, otra rama sin environment ni un PR de un fork.

---

## 0. Requisitos

- Una cuenta de AWS, **idealmente dedicada** a este proyecto (p. ej. una cuenta nueva dentro de tu AWS Organization).
- Acceso administrativo **temporal** a esa cuenta (recomendado: IAM Identity Center + `aws sso login`). No crees usuarios IAM con access keys.
- Herramientas: AWS CLI v2, Terraform (la versión fijada en `infra/*/versions.tf`), GitHub CLI (`gh`), Node/pnpm (para el build local opcional).
- Tu fork creado en GitHub.

## 1. Obtené los IDs de tu repo y el formato del `sub`

GitHub firma un token OIDC por cada job. El claim `sub` identifica repo y contexto, y **la trust policy de AWS tiene que coincidir exactamente**.

Desde el 15/07/2026, los repos **nuevos** (un fork lo es) usan por defecto el formato **inmutable**, que incluye los IDs numéricos de owner y repo:

```
repo:<OWNER>@<OWNER_ID>/<REPO>@<REPO_ID>:environment:prod     ← inmutable (default para repos nuevos)
repo:<OWNER>/<REPO>:environment:prod                          ← formato anterior (repos viejos sin opt-in)
```

Obtené los IDs:

```bash
gh api repos/<OWNER>/<REPO> --jq '{owner_id: .owner.id, repo_id: .id}'
```

**Verificá el formato real** con el workflow de diagnóstico incluido (`.github/workflows/oidc-debug.yml`, solo `workflow_dispatch`). Imprime **solo** los claims `sub`, `aud` y `repository`, nunca el token:

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
| `prod-plan` | No | Solo `main` | `terraform plan` |
| `prod` | **Sí (vos)** | Solo `main` | `terraform apply` y subida de la web y el contenido |

Además, en **Settings → Branches**, protegé `main`: PR obligatorio, checks requeridos (`ci`) y sin force-push.

## 3. Aplicá el bootstrap (una sola vez)

```bash
aws sso login --profile <perfil-admin>
export AWS_PROFILE=<perfil-admin>
aws sts get-caller-identity          # confirmá que es la cuenta correcta

cd infra/bootstrap
cp terraform.tfvars.example terraform.tfvars
```

Completá `terraform.tfvars`:

```hcl
aws_region        = "us-east-1"          # región principal del despliegue
project_name      = "blueprint"          # prefijo de recursos
github_owner      = "<OWNER>"
github_repo       = "<REPO>"
github_owner_id   = 12345678             # del paso 1
github_repo_id    = 987654321            # del paso 1
subject_format    = "immutable"          # o "legacy" según el paso 1
budget_alert_email = "vos@ejemplo.com"   # alarma de presupuesto
monthly_budget_usd = 10
```

Aplicá:

```bash
terraform init
terraform plan -out bootstrap.tfplan     # revisá: 1 bucket, 1 OIDC provider, 3 roles, políticas, budget
terraform apply bootstrap.tfplan
terraform output
```

**Guardá el state del bootstrap en el bucket recién creado** (para no perderlo):

```bash
cp backend.tf.example backend.tf         # backend "s3" con use_lockfile = true
terraform init -migrate-state \
  -backend-config="bucket=$(terraform output -raw state_bucket)" \
  -backend-config="region=<aws_region>"
```

### Qué quedó creado (para que lo revises)

La trust policy de `gh-apply` queda así (formato inmutable):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
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

En Terraform, el `sub` se arma con:

```hcl
locals {
  repo_ref = (
    var.subject_format == "immutable"
    ? "${var.github_owner}@${var.github_owner_id}/${var.github_repo}@${var.github_repo_id}"
    : "${var.github_owner}/${var.github_repo}"
  )

  sub_plan  = "repo:${local.repo_ref}:environment:prod-plan"
  sub_apply = "repo:${local.repo_ref}:environment:prod"
}
```

Puntos de seguridad que el bootstrap aplica:
- `StringEquals` (no `StringLike`) sobre `aud` y `sub`: sin comodines.
- `gh-apply` tiene un **permissions boundary**: solo puede crear o modificar roles que lleven el mismo boundary, lo que evita que un workflow comprometido se fabrique un rol administrador.
- `gh-deploy-content` solo puede escribir en el bucket del sitio e invalidar su distribución.
- Duración máxima de sesión de 1 hora.

## 4. Configurá las variables del repo

No son secretos: son identificadores. Van como **variables** (no *secrets*):

```bash
gh variable set AWS_REGION            --body "<aws_region>"
gh variable set AWS_ACCOUNT_ID        --body "$(aws sts get-caller-identity --query Account --output text)"
gh variable set AWS_ROLE_PLAN_ARN     --body "$(terraform output -raw role_plan_arn)"
gh variable set AWS_ROLE_APPLY_ARN    --body "$(terraform output -raw role_apply_arn)"
gh variable set AWS_ROLE_DEPLOY_ARN   --body "$(terraform output -raw role_deploy_content_arn)"
gh variable set TF_STATE_BUCKET       --body "$(terraform output -raw state_bucket)"
gh variable set PROJECT_NAME          --body "blueprint"
```

## 5. Primer despliegue

```bash
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

## 6. Verificá que el aislamiento funciona

| Prueba | Resultado esperado |
|---|---|
| Correr `deploy.yml` desde una rama que no es `main` | El environment la rechaza (regla de ramas) y no se asume ningún rol. |
| Abrir un PR desde otro fork | `ci.yml` corre sin `id-token` y no tiene acceso a AWS. |
| Asumir `gh-apply` desde un job sin `environment: prod` | `Not authorized to perform sts:AssumeRoleWithWebIdentity`. |

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | El `sub` no coincide (formato inmutable vs anterior, environment mal escrito, IDs incorrectos). | Corré `oidc-debug.yml` y compará el `sub` con la trust policy. Ajustá `subject_format` o los IDs y re-aplicá el bootstrap. |
| `Credentials could not be loaded` | Falta `permissions: id-token: write` en el workflow o en el job. | Agregalo en el job que asume el rol. |
| `Error acquiring the state lock` | Quedó un lock de una ejecución cancelada. | Confirmá que no haya otra ejecución y usá `terraform force-unlock <ID>`. |
| El sitio muestra `AccessDenied` | Contenido no subido o política de OAC incompleta. | Revisá el job `deploy-content` y la política del bucket del sitio. |
| Renombraste o transferiste el repo | Desde el 15/07/2026, eso cambia el `sub` al formato inmutable. | Actualizá `subject_format`/IDs y re-aplicá el bootstrap. |

## 8. Checklist de seguridad de la cuenta (recomendado)

- [ ] MFA en el usuario root y root sin access keys.
- [ ] Sin usuarios IAM con access keys (todo por Identity Center u OIDC).
- [ ] CloudTrail habilitado (a nivel de Organization si tenés una).
- [ ] Alarma de presupuesto activa (la crea el bootstrap).
- [ ] Revisar periódicamente el Access Analyzer de IAM.

## 9. Desmontar todo

```bash
# 1) Infra de la app (con credenciales admin locales)
cd infra/envs/prod && terraform init -backend-config=... && terraform destroy
# 2) Bootstrap: primero volvé el state a local
cd infra/bootstrap && rm backend.tf && terraform init -migrate-state && terraform destroy
```

> El bucket de state tiene versionado: para borrarlo hay que vaciar también las versiones (el bootstrap expone `force_destroy` como variable, desactivado por defecto).

## Referencias

- GitHub Docs — [Configuring OpenID Connect in Amazon Web Services](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- GitHub Docs — [OpenID Connect reference (formatos de `sub` y subject inmutable)](https://docs.github.com/en/actions/reference/security/oidc)
- Terraform — [Backend S3 (`use_lockfile`, deprecación del locking con DynamoDB)](https://developer.hashicorp.com/terraform/language/backend/s3)
