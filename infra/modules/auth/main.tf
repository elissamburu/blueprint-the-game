# Login and the player profile (F4 MVP, ADR-0029): a Cognito user pool with its classic hosted UI on
# a prefix domain, a public app client (authorization code + PKCE), an identity pool for signed-in
# players only, the player role and the profiles table. The browser talks to Cognito and DynamoDB
# directly: there is no API of its own.

data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  partition = data.aws_partition.current.partition
  region    = data.aws_region.current.region

  # Also in the default_tags of the provider. Here explicitly, so creating each resource always
  # carries it (the boundary denies it otherwise) and the tests can check it.
  tags = { Project = var.project_tag }

  # Routes of the web (apps/web/src/auth/config.ts): the login returns to /auth/callback and the
  # logout to the home page.
  callback_path = "/auth/callback"
  origins       = ["https://${var.domain}", var.local_origin]

  # The boundary of the bootstrap (infra/bootstrap/locals.tf): every role gh-apply creates carries it.
  boundary_arn = "arn:${local.partition}:iam::${var.account_id}:policy/${var.name_prefix}-gh-boundary"

  # Prefix domain: <prefix>.auth.<region>.amazoncognito.com
  # (https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-assign-domain-prefix.html).
  auth_domain = "${aws_cognito_user_pool_domain.login.domain}.auth.${local.region}.amazoncognito.com"

  # Sign-in with Google only when its OAuth client is configured.
  google_enabled = var.google_client_id != ""

  # Mail through Amazon SES only with email_domain: its domain identity (Easy DKIM), the account out
  # of the sandbox, the identity policy for email.cognito-idp.amazonaws.com and the service-linked
  # role AWSServiceRoleForAmazonCognitoIdpEmailService are created by hand (guide, step 3.10). The
  # identity lives in the region of the user pool: us-east-2 sends with identities of its own region
  # (Amazon SES email configuration Regions,
  # https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).
  ses_enabled      = var.email_domain != ""
  ses_identity_arn = "arn:${local.partition}:ses:${local.region}:${var.account_id}:identity/${var.email_domain}"

  # The verification message: sign-up and its resend, forgot password and the change of the email
  # (Message options, in the same page). Only DEVELOPER takes a subject and a body of its own
  # (VerificationMessageTemplateType): without SES, Cognito's default message stays.
  verification_email_subject = "Tu código de Blueprint"
  verification_email_message = "Tu código de Blueprint es {####}. Ingresalo para confirmar tu email o para elegir una contraseña nueva. Si no lo pediste, ignorá este mensaje."
}

resource "aws_cognito_user_pool" "players" {
  name = "${var.name_prefix}-players"

  # Sign-in with the email, verified with a code. Cognito sends it through SES from email_domain, or
  # with its default sender without it.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  username_configuration {
    case_sensitive = false
  }
  admin_create_user_config {
    allow_admin_create_user_only = false
  }
  # From takes "Name <address>" (EmailConfigurationType). With DEVELOPER, Cognito sends with the
  # service-linked role, not with the credentials of gh-apply, so the role needs no SES permissions.
  # TODO(verificar): the Cognito guide says the session that sets DEVELOPER needs
  # iam:CreateServiceLinkedRole (user-pool-email.html, "To grant permissions to use your Amazon SES
  # configuration"). The role exists already (created by hand), but if Cognito asks for the
  # permission anyway, the apply fails with AccessDenied on the user pool and the pool stays as it
  # was. Then the boundary has to make room for iam:CreateServiceLinkedRole on
  # role/aws-service-role/email.cognito-idp.amazonaws.com/AWSServiceRoleForAmazonCognitoIdpEmailService
  # with iam:AWSServiceName = email.cognito-idp.amazonaws.com, in gh-apply and in the boundary.
  email_configuration {
    email_sending_account = local.ses_enabled ? "DEVELOPER" : "COGNITO_DEFAULT"
    source_arn            = local.ses_enabled ? local.ses_identity_arn : null
    from_email_address    = local.ses_enabled ? "Blueprint <no-reply@${var.email_domain}>" : null
  }
  # The template, not email_verification_subject/message: UpdateUserPool no longer uses those
  # (https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UpdateUserPool.html).
  # null leaves them computed: without SES, the plan shows no change. Going back from SES to the
  # default sender keeps the Spanish ones in the state, which only DEVELOPER takes
  # (TODO(verificar)): if that apply fails, set Cognito's default subject and message here.
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = local.ses_enabled ? local.verification_email_subject : null
    email_message        = local.ses_enabled ? local.verification_email_message : null
  }
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 3
  }

  mfa_configuration   = "OFF"
  deletion_protection = "ACTIVE"
  tags                = local.tags
}

# Classic hosted UI (managed_login_version = 1): managed login (2) also needs a branding style per
# app client (CreateManagedLoginBranding) before its pages work, one more resource for the same
# sign-up and sign-in (ManagedLoginVersion in
# https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateUserPoolDomain.html).
resource "aws_cognito_user_pool_domain" "login" {
  domain                = var.auth_domain_prefix
  user_pool_id          = aws_cognito_user_pool.players.id
  managed_login_version = 1
}

# Public client of the web: no secret, authorization code with PKCE (the web always sends it), the
# scopes of the profile and aws.cognito.signin.user.admin, which DeleteUser needs ("Eliminar mi
# cuenta"). Access and ID tokens for 1 hour; the refresh token is revoked at logout.
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.players.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile", "aws.cognito.signin.user.admin"]
  supported_identity_providers         = concat(["COGNITO"], local.google_enabled ? ["Google"] : [])
  callback_urls                        = [for origin in local.origins : "${origin}${local.callback_path}"]
  logout_urls                          = [for origin in local.origins : "${origin}/"]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 1
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # The client can only name an identity provider that already exists.
  depends_on = [aws_cognito_identity_provider.google]
}

# Sign-in with Google (ADR-0029), only with google_client_id. The client secret is stored in the
# state (the state bucket of the bootstrap: SSE, versioning, no public access, TLS only); the
# variable is sensitive, so plans print the whole provider_details as (sensitive value).
# Attribute mapping: Google's email, email_verified and name, and username from sub (the source
# Cognito uses for Google: Mapping IdP attributes to profiles and tokens,
# https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-specifying-attribute-mapping.html).
# email_verified matters: a mapped email is unverified otherwise. The app client writes every
# attribute (no write_attributes), as mapped attributes require.
resource "aws_cognito_identity_provider" "google" {
  count = local.google_enabled ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.players.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "openid email profile"
  }

  attribute_mapping = {
    email          = "email"
    email_verified = "email_verified"
    name           = "name"
    username       = "sub"
  }

  # Cognito fills in the endpoints of Google in provider_details: not ours to change.
  lifecycle {
    ignore_changes = [
      provider_details["attributes_url"],
      provider_details["attributes_url_add_attributes"],
      provider_details["authorize_url"],
      provider_details["oidc_issuer"],
      provider_details["token_request_method"],
      provider_details["token_url"],
    ]
  }
}

# Only identities of the user pool, never guests. Enhanced flow only (allow_classic_flow = false).
# Identity pool names take letters, digits, spaces and underscores, not hyphens.
resource "aws_cognito_identity_pool" "players" {
  identity_pool_name               = "${replace(var.name_prefix, "-", "_")}_players"
  allow_unauthenticated_identities = false
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web.id
    provider_name           = aws_cognito_user_pool.players.endpoint
    server_side_token_check = true
  }

  tags = local.tags
}

# Trust as in "Creating roles for role mapping"
# (https://docs.aws.amazon.com/cognito/latest/developerguide/role-based-access-control.html): only
# Cognito, only tokens of this identity pool (aud), only authenticated identities (amr).
resource "aws_iam_role" "player" {
  name                 = "${var.name_prefix}-player"
  description          = "Signed-in players of ${var.name_prefix}: their own items of the profiles table (ADR-0029)"
  max_session_duration = 3600
  permissions_boundary = local.boundary_arn
  tags                 = local.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AuthenticatedPlayers"
        Effect    = "Allow"
        Principal = { Federated = "cognito-identity.amazonaws.com" }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals             = { "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.players.id }
          "ForAnyValue:StringLike" = { "cognito-identity.amazonaws.com:amr" = "authenticated" }
        }
      },
    ]
  })
}

# Only the items whose partition key is the player's identity ID: dynamodb:LeadingKeys with the
# identity ID variable (Service Authorization Reference for DynamoDB: LeadingKeys is a condition key
# of GetItem, PutItem, UpdateItem, DeleteItem and Query).
resource "aws_iam_role_policy" "player" {
  name = "${var.name_prefix}-player-profiles"
  role = aws_iam_role.player.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "OwnItems"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
        Resource = aws_dynamodb_table.profiles.arn
        Condition = {
          "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["$${cognito-identity.amazonaws.com:sub}"] }
        }
      },
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "players" {
  identity_pool_id = aws_cognito_identity_pool.players.id
  roles            = { authenticated = aws_iam_role.player.arn }
}

# pk = identity ID of the player; sk = "profile" or "attempt#<scenarioId>" (ADR-0029).
resource "aws_dynamodb_table" "profiles" {
  name                        = "${var.name_prefix}-profiles"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"
  deletion_protection_enabled = true

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = local.tags
}
