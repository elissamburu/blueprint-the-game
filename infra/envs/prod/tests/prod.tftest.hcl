# Offline checks of envs/prod and its modules: a mocked AWS provider, so no credentials, no backend
# and no calls to AWS. "apply" here only applies against the mock, in memory.
# Run with: terraform init -backend=false && terraform test
#
# Assertions only see the resources of the module under test, so the runs that check a module's
# resources load it directly (module { source = ... }); the last runs check the root itself.

mock_provider "aws" {}

variables {
  name_prefix         = "acme"
  project_tag         = "acme-game"
  account_id          = "111111111111"
  domain              = "beta.example.com"
  acm_certificate_arn = "arn:aws:acm:us-east-1:111111111111:certificate/00000000-0000-0000-0000-000000000000"
  price_class         = "PriceClass_All"
  budget_usd          = 10
  budget_email        = "alerts@example.com"
}

run "static_site" {
  module {
    source = "../../modules/static-site"
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

  assert {
    condition     = length(one(aws_cloudfront_response_headers_policy.security.security_headers_config).content_security_policy) == 0
    error_message = "No Content-Security-Policy yet (#44)."
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
