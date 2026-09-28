# 0014 · Terraform con bootstrap separado y OIDC de GitHub

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
El repo tiene que poder desplegarse en la cuenta de AWS de quien lo forkee, de forma segura y sin credenciales de larga vida. El rol de despliegue, el proveedor OIDC y el bucket de state no pueden crearse con el mismo pipeline que depende de ellos.

## Decisión
- **Terraform** con dos raíces:
  - `infra/bootstrap/`: se aplica **una vez, a mano**, con credenciales humanas temporales (p. ej. IAM Identity Center). Crea el bucket de state (versionado, cifrado, acceso público bloqueado), el proveedor OIDC de GitHub (`https://token.actions.githubusercontent.com`, audiencia `sts.amazonaws.com`) y tres roles.
  - `infra/envs/prod/`: todo lo demás, aplicado por GitHub Actions.
- **Backend S3 con `use_lockfile = true`** (locking nativo en S3). El locking con DynamoDB está deprecado en el backend S3 de Terraform, así que no se usa.
- **Roles**:
  | Rol | Uso | Confianza (`sub`) | Permisos |
  |---|---|---|---|
  | `gh-plan` | `terraform plan` | environment `prod-plan` | lectura + state |
  | `gh-apply` | `terraform apply` | environment `prod` (con reviewers obligatorios) | lo necesario para los recursos del proyecto, con **permissions boundary** que impide crear/modificar roles sin el mismo boundary |
  | `gh-deploy-content` | subir web + bundle de contenido e invalidar CloudFront | environment `prod` | `s3:PutObject`/`DeleteObject` en el bucket del sitio + `cloudfront:CreateInvalidation` en la distribución |
- **Formato del `sub`**: GitHub usa un formato de subject **inmutable** que incluye los IDs de owner y repo (`repo:OWNER@OWNER_ID/REPO@REPO_ID:environment:prod`) por defecto para repos creados después del 15/07/2026 (y para renombres y transferencias posteriores). Los repos anteriores mantienen el formato `repo:OWNER/REPO:...` salvo que hagan opt-in. Como un fork es un repo nuevo, el bootstrap usa el formato inmutable por defecto y permite el anterior con una variable (`subject_format`).
- Condiciones de confianza con `StringEquals` sobre `aud` y `sub` exactos. Nunca comodines sobre el repo.
- Etiquetas comunes y `allowed_account_ids` en el provider para evitar aplicar en la cuenta equivocada.

## Alternativas consideradas
- **CDK**: TypeScript de punta a punta sería coherente, pero Terraform es un requisito del proyecto y más conocido por la comunidad de infraestructura.
- **Access keys en secrets de GitHub**: credenciales de larga vida; descartado.
- **Un solo rol con permisos amplios**: más simple, pero rompe el mínimo privilegio.

## Consecuencias
- La guía de forks ([configurar AWS en tu fork](../guias/configurar-aws-en-tu-fork.md)) es parte del producto y se prueba en cada release.
- El `sub` depende del formato de subject del repo: una mala configuración produce `Not authorized to perform sts:AssumeRoleWithWebIdentity`; la guía incluye cómo diagnosticarlo.
