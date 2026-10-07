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

## Enmiendas

### 2026-10-07 · Cuenta compartida y región `us-east-2`
**Motivo.** La cuenta donde se despliega el proyecto es compartida con otros proyectos del mantenedor, y la beta pública ya está publicada a mano en ella ([deploy manual de la beta](../guias/deploy-manual-beta.md)). El bootstrap no puede asumir una cuenta dedicada.

**Precisión.**
- **Región principal `us-east-2`** (configurable con `aws_region`). Los certificados de CloudFront siguen en `us-east-1`, con un alias de provider en `infra/envs/prod`.
- **Prefijo**: todos los nombres empiezan con `name_prefix` (por defecto `blueprint`) y las políticas de los roles se acotan por ARN con ese prefijo.
- **Etiqueta**: todos los recursos llevan `Project = project_tag`. Donde el servicio admite `aws:ResourceTag` y `aws:RequestTag` (distribuciones y funciones de CloudFront, certificados de ACM, presupuestos y roles y políticas de IAM), los roles solo crean recursos con esa etiqueta y solo modifican recursos que la tienen. S3, Route 53, los *origin access control* y las *response headers policies* no admiten esas condiciones: se acotan por nombre de bucket, por zona y nombres de registro, o quedan documentados como no acotables en `infra/bootstrap/iam_policies.tf`.
- **Riesgo aceptado por ahora**: los *origin access control* y las *response headers policies* no tienen etiquetas ni nombre en el ARN, así que `gh-apply` puede crearlos, cambiarlos o borrarlos en toda la cuenta, incluidos los de distribuciones de otros proyectos. El PR 2 de F3 los acota a los IDs importados de la beta, con una variable del bootstrap que se re-aplica.
- **Permissions boundary por etiqueta**: los tres roles llevan el boundary, y el boundary, además de exigirse a sí mismo en todo rol que se cree o modifique, niega cambiar recursos sin `Project = project_tag`, crearlos sin ella, quitarla o cambiarla, y tocar el bucket de state o los recursos del bootstrap. Límite conocido: crear con etiquetas (`CreateDistributionWithTags`, `RequestCertificate`) autoriza la misma acción de etiquetado que etiquetar un recurso existente, así que un recurso **sin** etiqueta `Project` de esos tipos puede ser etiquetado (adoptado) por `gh-apply`. Los recursos de otros proyectos de la cuenta deberían llevar su propia etiqueta `Project`, que el boundary protege.
- **`gh-plan`** lee solo lo del proyecto (por prefijo o zona) y el state; las lecturas de CloudFront quedan sobre `*` porque esos tipos no tienen nombre en el ARN.
- **Environment `prod-plan` sin restricción de ramas ni reviewers**: el `plan` corre en las ramas de los PR, así que cualquier rama del repo puede asumir `gh-plan` (lectura y lock del state). El workflow de plan no corre en PR de forks (`github.event.pull_request.head.repo.full_name == github.repository`). Solo `prod` queda restringido a `main` y con reviewers, y es el único que habilita `gh-apply` y `gh-deploy-content`.
- **`gh-deploy-content`** se acota al prefijo de los buckets y a las distribuciones con la etiqueta del proyecto, no a un bucket y una distribución concretos: esos recursos los crea (o importa) `infra/envs/prod` después del bootstrap.
- **Proveedor OIDC reutilizable**: puede haber uno solo por URL en la cuenta. Con `create_oidc_provider = false` el bootstrap lee el existente y no lo modifica (verifica que acepte la audiencia `sts.amazonaws.com`). Se crea sin thumbprint, que es opcional en la API de IAM.
- **El state del bootstrap queda local** (no se migra al bucket que crea) y se resguarda cifrado fuera de AWS (ni en el bucket de state ni en otro de la cuenta); ver la [guía de forks](../guias/configurar-aws-en-tu-fork.md#3-aplicá-el-bootstrap-una-sola-vez).
- El presupuesto no lo crea el bootstrap: va en `infra/envs/prod` (módulo `observability`), filtrado por la etiqueta `Project` como *cost allocation tag*.
