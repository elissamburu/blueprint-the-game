# 0010 · Autenticación con Cognito + modo invitado

- Estado: Aceptado
- Fecha: 2026-09-27

## Contexto
Queremos que la primera partida no tenga fricción, pero que el progreso se pueda guardar entre dispositivos. Los datos personales deben ser mínimos y borrables.

## Decisión
- **Modo invitado** por defecto: progreso en `localStorage` detrás de la interfaz `ProgressRepository` (`LocalProgressRepo`).
- **Amazon Cognito User Pools** para registro (email + contraseña con verificación) y el login administrado de Cognito con flujo *authorization code + PKCE*. El front usa `ApiProgressRepo` cuando hay sesión.
- **Proveedores sociales**: Google (soportado de forma nativa por Cognito) como *Should*. GitHub **no** es un proveedor OIDC nativo de Cognito y requiere un adaptador intermedio; queda como *Could* y se evalúa aparte.
- Al registrarse, se ofrece importar el progreso local; el servidor re-evalúa los intentos (no confía en totales del cliente).
- El `sub` de Cognito es el id de usuario; el email solo vive en Cognito.

## Alternativas consideradas
- **Auth0 / Clerk / Supabase Auth**: buenos, pero agregan un proveedor externo y cuentas extra para cada fork.
- **Solo social login**: excluye a quien no quiere vincular cuentas.

## Consecuencias
- Un fork obtiene autenticación con solo aplicar Terraform.
- Hay que implementar bien la migración invitado → cuenta (idempotente, sin duplicar XP).
