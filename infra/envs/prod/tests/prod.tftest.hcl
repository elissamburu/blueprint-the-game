# Offline checks of envs/prod and its modules: a mocked AWS provider, so no credentials, no backend
# and no calls to AWS. "apply" here only applies against the mock, in memory.
# Run with: terraform init -backend=false && terraform test
#
# Assertions only see the resources of the module under test, so the runs that check a module's
# resources load it directly (module { source = ... }); the last runs check the root itself.

mock_provider "aws" {
  # The provider validates ARNs built with the partition (the boundary of the player role): the
  # mock's random values are not. Every run of the root needs it, plan-only runs included.
  override_data {
    target = module.auth.data.aws_partition.current
    values = { partition = "aws" }
  }

  override_data {
    target = module.auth.data.aws_region.current
    values = { region = "us-east-2" }
  }
}

variables {
  name_prefix         = "acme"
  project_tag         = "acme-game"
  account_id          = "111111111111"
  domain              = "beta.example.com"
  acm_certificate_arn = "arn:aws:acm:us-east-1:111111111111:certificate/00000000-0000-0000-0000-000000000000"
  price_class         = "PriceClass_All"
  budget_usd          = 10
  budget_email        = "alerts@example.com"
  auth_domain_prefix  = "acme-login"
}

run "static_site" {
  module {
    source = "../../modules/static-site"
  }

  variables {
    auth_domain = "acme-login.auth.us-east-2.amazoncognito.com"
  }

  override_data {
    target = data.aws_region.current
    values = { region = "us-east-2" }
  }

  # The provider validates ARNs: the mock's random values are not.
  override_resource {
    target = aws_s3_bucket.site
    values = {
      arn                         = "arn:aws:s3:::acme-site-111111111111-us-east-2"
      bucket_regional_domain_name = "acme-site-111111111111-us-east-2.s3.us-east-2.amazonaws.com"
    }
  }

  override_resource {
    target = aws_cloudfront_distribution.site
    values = {
      id          = "E2EXAMPLEDIST"
      arn         = "arn:aws:cloudfront::111111111111:distribution/E2EXAMPLEDIST"
      domain_name = "d111111abcdef8.cloudfront.net"
    }
  }

  override_resource {
    target = aws_cloudfront_function.spa_rewrite
    values = { arn = "arn:aws:cloudfront::111111111111:function/acme-spa-rewrite" }
  }

  # --- Names: the roles of the bootstrap only reach "<prefix>-*".
  assert {
    condition     = aws_s3_bucket.site.bucket == "acme-site-111111111111-us-east-2"
    error_message = "The bucket is named with the prefix, the account and the region."
  }

  assert {
    condition = alltrue([
      for name in [
        aws_s3_bucket.site.bucket,
        aws_cloudfront_origin_access_control.site.name,
        aws_cloudfront_function.spa_rewrite.name,
        aws_cloudfront_response_headers_policy.security.name,
      ] : startswith(name, "acme-")
    ])
    error_message = "Every name starts with name_prefix."
  }

  # --- Project tag on everything that takes tags (the boundary denies creating distributions and
  # functions without it). OACs and response headers policies have no tags.
  assert {
    condition = alltrue([
      for tags in [
        aws_s3_bucket.site.tags,
        aws_cloudfront_distribution.site.tags,
        aws_cloudfront_function.spa_rewrite.tags,
      ] : tags["Project"] == "acme-game"
    ])
    error_message = "The bucket, the distribution and the function carry Project = project_tag."
  }

  # --- The bucket is private.
  assert {
    condition = (
      aws_s3_bucket_public_access_block.site.block_public_acls
      && aws_s3_bucket_public_access_block.site.block_public_policy
      && aws_s3_bucket_public_access_block.site.ignore_public_acls
      && aws_s3_bucket_public_access_block.site.restrict_public_buckets
    )
    error_message = "The public access block blocks everything."
  }

  assert {
    condition     = one(aws_s3_bucket_ownership_controls.site.rule).object_ownership == "BucketOwnerEnforced"
    error_message = "No ACLs: BucketOwnerEnforced."
  }

  assert {
    condition     = one(one(aws_s3_bucket_server_side_encryption_configuration.site.rule).apply_server_side_encryption_by_default).sse_algorithm == "AES256"
    error_message = "SSE-S3 by default."
  }

  assert {
    condition     = one(aws_s3_bucket_versioning.site.versioning_configuration).status == "Enabled"
    error_message = "Versioning is on."
  }

  assert {
    condition     = one(one(aws_s3_bucket_lifecycle_configuration.site.rule).noncurrent_version_expiration).noncurrent_days == 30
    error_message = "Old versions expire."
  }

  # --- The bucket policy: only CloudFront, only for this distribution, only with TLS.
  assert {
    condition = jsondecode(aws_s3_bucket_policy.site.policy).Statement[0] == {
      Sid       = "AllowCloudFrontServicePrincipalReadOnly"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "arn:aws:s3:::acme-site-111111111111-us-east-2/*"
      Condition = { StringEquals = { "AWS:SourceArn" = "arn:aws:cloudfront::111111111111:distribution/E2EXAMPLEDIST" } }
    }
    error_message = "Only the service principal of CloudFront reads objects, and only for this distribution."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_s3_bucket_policy.site.policy).Statement :
      s.Effect == "Deny" || s.Principal == { Service = "cloudfront.amazonaws.com" }
    ])
    error_message = "No other principal is allowed."
  }

  assert {
    condition = anytrue([
      for s in jsondecode(aws_s3_bucket_policy.site.policy).Statement :
      s.Effect == "Deny" && s.Action == "s3:*" && try(s.Condition.Bool["aws:SecureTransport"], "") == "false"
    ])
    error_message = "Requests without TLS are denied."
  }

  # --- CloudFront.
  assert {
    condition = (
      aws_cloudfront_origin_access_control.site.signing_protocol == "sigv4"
      && aws_cloudfront_origin_access_control.site.signing_behavior == "always"
      && aws_cloudfront_origin_access_control.site.origin_access_control_origin_type == "s3"
    )
    error_message = "OAC signs every request with SigV4."
  }

  assert {
    condition = (
      aws_cloudfront_function.spa_rewrite.runtime == "cloudfront-js-2.0"
      && aws_cloudfront_function.spa_rewrite.publish
      && strcontains(aws_cloudfront_function.spa_rewrite.code, "function handler(event)")
    )
    error_message = "The rewrite function is the one of tools/deploy-site, published, on runtime 2.0."
  }

  assert {
    condition = (
      aws_cloudfront_distribution.site.aliases == toset(["beta.example.com"])
      && aws_cloudfront_distribution.site.http_version == "http2and3"
      && aws_cloudfront_distribution.site.is_ipv6_enabled
      && aws_cloudfront_distribution.site.default_root_object == "index.html"
      && aws_cloudfront_distribution.site.price_class == "PriceClass_All"
    )
    error_message = "Alias, HTTP/2 and HTTP/3, IPv6, default root object and price class."
  }

  assert {
    condition = (
      one(aws_cloudfront_distribution.site.viewer_certificate).acm_certificate_arn == "arn:aws:acm:us-east-1:111111111111:certificate/00000000-0000-0000-0000-000000000000"
      && one(aws_cloudfront_distribution.site.viewer_certificate).ssl_support_method == "sni-only"
      && one(aws_cloudfront_distribution.site.viewer_certificate).minimum_protocol_version == "TLSv1.2_2025"
    )
    error_message = "The existing certificate, by ARN, with SNI and TLS 1.2 or later."
  }

  assert {
    condition = (
      one(aws_cloudfront_distribution.site.origin).origin_access_control_id == aws_cloudfront_origin_access_control.site.id
      && one(aws_cloudfront_distribution.site.default_cache_behavior).viewer_protocol_policy == "redirect-to-https"
      && one(aws_cloudfront_distribution.site.default_cache_behavior).compress
      && length(one(aws_cloudfront_distribution.site.default_cache_behavior).forwarded_values) == 0
      && one(aws_cloudfront_distribution.site.default_cache_behavior).response_headers_policy_id == aws_cloudfront_response_headers_policy.security.id
    )
    error_message = "The origin uses the OAC; the behavior redirects to HTTPS, compresses, uses a cache policy (no legacy forwarded values) and the security headers."
  }

  # The id of a data source that is looked up by name is optional, not computed, in the schema, so
  # the mock leaves it null: the name is what can be checked offline.
  assert {
    condition     = data.aws_cloudfront_cache_policy.caching_optimized.name == "Managed-CachingOptimized"
    error_message = "The cache policy is the managed CachingOptimized, read by name (no policy of its own)."
  }

  # --- Content-Security-Policy, phase 1 of #44: only Report-Only, from the file of tools/deploy-site.
  assert {
    condition     = length(one(aws_cloudfront_response_headers_policy.security.security_headers_config).content_security_policy) == 0
    error_message = "Phase 1 of #44: the policy is not enforced yet (no Content-Security-Policy header)."
  }

  assert {
    condition = (
      length(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items) == 1
      && one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).header == "Content-Security-Policy-Report-Only"
      && one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).override
    )
    error_message = "The only custom header is Content-Security-Policy-Report-Only, over whatever the origin sends."
  }

  assert {
    condition = (
      startswith(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "default-src 'self'; script-src 'self'; ")
      && strcontains(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "; object-src 'none'; ")
      && endswith(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "; frame-ancestors 'none'")
      && !strcontains(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "unsafe-eval")
      && !strcontains(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "\n")
      && !strcontains(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "\r")
    )
    error_message = "The value is the policy file in one line: directives joined with \"; \", no 'unsafe-eval'."
  }

  # The template with region us-east-2 and the domain acme-login.auth.us-east-2.amazoncognito.com.
  # tools/deploy-site/src/csp.test.ts expects the very same connect-src from renderCsp: both
  # readers of the template send the same header.
  assert {
    condition = strcontains(
      one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value,
      "; connect-src 'self' https://acme-login.auth.us-east-2.amazoncognito.com https://cognito-idp.us-east-2.amazonaws.com https://cognito-identity.us-east-2.amazonaws.com https://dynamodb.us-east-2.amazonaws.com; ",
    )
    error_message = "connect-src has exactly the endpoints of the login and the profile, in the region of the site (ADR-0029)."
  }

  assert {
    condition     = !strcontains(one(one(aws_cloudfront_response_headers_policy.security.custom_headers_config).items).value, "$${")
    error_message = "Every placeholder of the template is filled in."
  }
}

run "budget" {
  module {
    source = "../../modules/observability"
  }

  assert {
    condition     = aws_budgets_budget.monthly.name == "acme-mensual"
    error_message = "The budget is <prefix>-mensual."
  }

  assert {
    condition     = aws_budgets_budget.monthly.tags["Project"] == "acme-game"
    error_message = "The budget carries the Project tag."
  }

  assert {
    condition = (
      one(aws_budgets_budget.monthly.cost_filter).name == "TagKeyValue"
      && one(aws_budgets_budget.monthly.cost_filter).values == tolist(["user:Project$acme-game"])
    )
    error_message = "The budget counts only the costs tagged Project = project_tag."
  }

  assert {
    condition = (
      aws_budgets_budget.monthly.time_unit == "MONTHLY"
      && aws_budgets_budget.monthly.limit_unit == "USD"
      && tonumber(aws_budgets_budget.monthly.limit_amount) == 10
    )
    error_message = "Monthly, in USD, with the limit of budget_usd."
  }

  assert {
    condition     = length(aws_budgets_budget.monthly.notification) == 2
    error_message = "Two alerts: actual and forecasted."
  }
}

run "prod" {
  override_data {
    target = module.site.data.aws_region.current
    values = { region = "us-east-2" }
  }

  override_resource {
    target = module.site.aws_s3_bucket.site
    values = {
      arn                         = "arn:aws:s3:::acme-site-111111111111-us-east-2"
      bucket_regional_domain_name = "acme-site-111111111111-us-east-2.s3.us-east-2.amazonaws.com"
    }
  }

  override_resource {
    target = module.site.aws_cloudfront_distribution.site
    values = {
      id          = "E2EXAMPLEDIST"
      arn         = "arn:aws:cloudfront::111111111111:distribution/E2EXAMPLEDIST"
      domain_name = "d111111abcdef8.cloudfront.net"
    }
  }

  override_resource {
    target = module.site.aws_cloudfront_function.spa_rewrite
    values = { arn = "arn:aws:cloudfront::111111111111:function/acme-spa-rewrite" }
  }

  override_data {
    target = module.auth.data.aws_region.current
    values = { region = "us-east-2" }
  }

  override_data {
    target = module.auth.data.aws_partition.current
    values = { partition = "aws" }
  }

  override_resource {
    target = module.auth.aws_iam_role.player
    values = { arn = "arn:aws:iam::111111111111:role/acme-player" }
  }

  override_resource {
    target = module.auth.aws_dynamodb_table.profiles
    values = { arn = "arn:aws:dynamodb:us-east-2:111111111111:table/acme-profiles" }
  }

  assert {
    condition     = output.auth_domain == "acme-login.auth.us-east-2.amazoncognito.com"
    error_message = "The login domain is the prefix domain of the region."
  }


  assert {
    condition     = output.bucket == "acme-site-111111111111-us-east-2"
    error_message = "The root passes prefix and account to the site."
  }

  assert {
    condition     = output.site_url == "https://beta.example.com"
    error_message = "The site URL is the domain."
  }

  assert {
    condition     = output.distribution_domain_name == "d111111abcdef8.cloudfront.net"
    error_message = "The target of the CNAME is an output."
  }
}

run "rejects_a_certificate_outside_us_east_1" {
  command = plan

  variables {
    acm_certificate_arn = "arn:aws:acm:us-east-2:111111111111:certificate/00000000-0000-0000-0000-000000000000"
  }

  expect_failures = [var.acm_certificate_arn]
}

run "rejects_a_certificate_of_another_account" {
  command = plan

  variables {
    acm_certificate_arn = "arn:aws:acm:us-east-1:222222222222:certificate/00000000-0000-0000-0000-000000000000"
  }

  expect_failures = [var.acm_certificate_arn]
}

run "rejects_a_domain_with_a_scheme" {
  command = plan

  variables {
    domain = "https://beta.example.com"
  }

  expect_failures = [var.domain]
}

run "auth" {
  module {
    source = "../../modules/auth"
  }

  override_data {
    target = data.aws_region.current
    values = { region = "us-east-2" }
  }

  override_data {
    target = data.aws_partition.current
    values = { partition = "aws" }
  }

  # The provider validates ARNs: the mock's random values are not.
  override_resource {
    target = aws_iam_role.player
    values = { arn = "arn:aws:iam::111111111111:role/acme-player" }
  }

  override_resource {
    target = aws_dynamodb_table.profiles
    values = { arn = "arn:aws:dynamodb:us-east-2:111111111111:table/acme-profiles" }
  }

  override_resource {
    target = aws_cognito_identity_pool.players
    values = { id = "us-east-2:00000000-0000-0000-0000-000000000000" }
  }

  # --- Names and tags: the roles of the bootstrap reach "<prefix>-*" and the Project tag.
  assert {
    condition = (
      aws_cognito_user_pool.players.name == "acme-players"
      && aws_cognito_user_pool_client.web.name == "acme-web"
      && aws_cognito_identity_pool.players.identity_pool_name == "acme_players"
      && aws_iam_role.player.name == "acme-player"
      && aws_dynamodb_table.profiles.name == "acme-profiles"
    )
    error_message = "Every name starts with name_prefix (the identity pool with an underscore: it takes no hyphens)."
  }

  assert {
    condition = alltrue([
      for tags in [
        aws_cognito_user_pool.players.tags,
        aws_cognito_identity_pool.players.tags,
        aws_iam_role.player.tags,
        aws_dynamodb_table.profiles.tags,
      ] : tags["Project"] == "acme-game"
    ])
    error_message = "The user pool, the identity pool, the role and the table carry Project = project_tag."
  }

  # --- User pool.
  assert {
    condition = (
      aws_cognito_user_pool.players.deletion_protection == "ACTIVE"
      && aws_cognito_user_pool.players.username_attributes == toset(["email"])
      && aws_cognito_user_pool.players.auto_verified_attributes == toset(["email"])
      && one(aws_cognito_user_pool.players.admin_create_user_config).allow_admin_create_user_only == false
      && one(aws_cognito_user_pool.players.email_configuration).email_sending_account == "COGNITO_DEFAULT"
    )
    error_message = "Sign-up by email with verification, the default sender of Cognito and deletion protection."
  }

  assert {
    condition = (
      one(aws_cognito_user_pool.players.password_policy).minimum_length >= 12
      && one(aws_cognito_user_pool.players.password_policy).require_lowercase
      && one(aws_cognito_user_pool.players.password_policy).require_uppercase
      && one(aws_cognito_user_pool.players.password_policy).require_numbers
      && one(aws_cognito_user_pool.players.password_policy).require_symbols
    )
    error_message = "Strong password policy."
  }

  assert {
    condition = (
      aws_cognito_user_pool_domain.login.domain == "acme-login"
      && aws_cognito_user_pool_domain.login.managed_login_version == 1
    )
    error_message = "Prefix domain of auth_domain_prefix, with the classic hosted UI."
  }

  # --- App client: public, code + PKCE, exact URLs, revocation, 1 hour tokens.
  assert {
    condition = (
      aws_cognito_user_pool_client.web.generate_secret == false
      && aws_cognito_user_pool_client.web.allowed_oauth_flows_user_pool_client
      && aws_cognito_user_pool_client.web.allowed_oauth_flows == toset(["code"])
      && aws_cognito_user_pool_client.web.allowed_oauth_scopes == toset(["openid", "email", "profile", "aws.cognito.signin.user.admin"])
      && aws_cognito_user_pool_client.web.supported_identity_providers == toset(["COGNITO"])
    )
    error_message = "Public client, authorization code only, the four scopes and only Cognito users."
  }

  assert {
    condition = (
      aws_cognito_user_pool_client.web.callback_urls == toset(["https://beta.example.com/auth/callback", "http://localhost:5173/auth/callback"])
      && aws_cognito_user_pool_client.web.logout_urls == toset(["https://beta.example.com/", "http://localhost:5173/"])
    )
    error_message = "Callback and logout only on the site and the dev server."
  }

  assert {
    condition = (
      aws_cognito_user_pool_client.web.prevent_user_existence_errors == "ENABLED"
      && aws_cognito_user_pool_client.web.enable_token_revocation
      && aws_cognito_user_pool_client.web.access_token_validity == 60
      && aws_cognito_user_pool_client.web.id_token_validity == 60
      && one(aws_cognito_user_pool_client.web.token_validity_units).access_token == "minutes"
      && one(aws_cognito_user_pool_client.web.token_validity_units).id_token == "minutes"
    )
    error_message = "No user existence errors, revocable tokens, access and ID tokens of 1 hour."
  }

  # --- Identity pool and player role.
  assert {
    condition = (
      aws_cognito_identity_pool.players.allow_unauthenticated_identities == false
      && aws_cognito_identity_pool.players.allow_classic_flow == false
      && one(aws_cognito_identity_pool.players.cognito_identity_providers).client_id == aws_cognito_user_pool_client.web.id
    )
    error_message = "Only identities of the user pool (no guests), enhanced flow only."
  }

  assert {
    condition     = aws_cognito_identity_pool_roles_attachment.players.roles == tomap({ authenticated = "arn:aws:iam::111111111111:role/acme-player" })
    error_message = "Only the authenticated role, the player role."
  }

  assert {
    condition     = aws_iam_role.player.permissions_boundary == "arn:aws:iam::111111111111:policy/acme-gh-boundary"
    error_message = "The player role carries the boundary of the bootstrap."
  }

  assert {
    condition = jsondecode(aws_iam_role.player.assume_role_policy).Statement == [{
      Sid       = "AuthenticatedPlayers"
      Effect    = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals             = { "cognito-identity.amazonaws.com:aud" = "us-east-2:00000000-0000-0000-0000-000000000000" }
        "ForAnyValue:StringLike" = { "cognito-identity.amazonaws.com:amr" = "authenticated" }
      }
    }]
    error_message = "Only Cognito, only tokens of this identity pool, only authenticated identities."
  }

  assert {
    condition = jsondecode(aws_iam_role_policy.player.policy).Statement == [{
      Sid       = "OwnItems"
      Effect    = "Allow"
      Action    = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
      Resource  = "arn:aws:dynamodb:us-east-2:111111111111:table/acme-profiles"
      Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["$${cognito-identity.amazonaws.com:sub}"] } }
    }]
    error_message = "The player reads and writes only the items of the table whose partition key is its identity ID."
  }

  # --- Table.
  assert {
    condition = (
      aws_dynamodb_table.profiles.billing_mode == "PAY_PER_REQUEST"
      && aws_dynamodb_table.profiles.hash_key == "pk"
      && aws_dynamodb_table.profiles.range_key == "sk"
      && aws_dynamodb_table.profiles.deletion_protection_enabled
      && one(aws_dynamodb_table.profiles.point_in_time_recovery).enabled
    )
    error_message = "On demand, pk/sk, deletion protection and point-in-time recovery."
  }

  assert {
    condition     = output.auth_domain == "acme-login.auth.us-east-2.amazoncognito.com"
    error_message = "The output is the full host of the prefix domain."
  }
}

run "rejects_a_bad_auth_domain_prefix" {
  command = plan

  module {
    source = "../../modules/auth"
  }

  override_data {
    target = data.aws_partition.current
    values = { partition = "aws" }
  }

  variables {
    auth_domain_prefix = "My_Login"
  }

  expect_failures = [var.auth_domain_prefix]
}

run "rejects_a_reserved_auth_domain_prefix" {
  command = plan

  module {
    source = "../../modules/auth"
  }

  override_data {
    target = data.aws_partition.current
    values = { partition = "aws" }
  }

  variables {
    auth_domain_prefix = "acme-cognito"
  }

  expect_failures = [var.auth_domain_prefix]
}
