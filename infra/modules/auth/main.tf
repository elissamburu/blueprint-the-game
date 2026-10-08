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
}

resource "aws_cognito_user_pool" "players" {
  name = "${var.name_prefix}-players"

  # Sign-in with the email, verified with a code that Cognito sends with its default sender.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  username_configuration {
    case_sensitive = false
  }
  admin_create_user_config {
    allow_admin_create_user_only = false
  }
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
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
  supported_identity_providers         = ["COGNITO"]
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
