# Offline checks of the bootstrap: a mocked AWS provider, so no credentials and no calls to AWS.
# They render the trust and permission policies and check the rules of ADR-0014 on them.
# "apply" here only applies against the mock, in memory.
# Run with: terraform init -backend=false && terraform test
#
# terraform test also loads the local terraform.tfvars (ignored by git) when it exists: every value
# the asserts rely on is set below, so a real tfvars never changes the result. Values in a test file
# take precedence over tfvars, and a run's own variables over these.

mock_provider "aws" {
  override_data {
    target = data.aws_partition.current
    values = { partition = "aws" }
  }

  override_data {
    target = data.aws_iam_openid_connect_provider.github
    values = {
      arn            = "arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com"
      client_id_list = ["sts.amazonaws.com"]
    }
  }

  # The provider validates ARNs: the mock's random values are not.
  override_resource {
    target = aws_iam_policy.boundary
    values = { arn = "arn:aws:iam::111111111111:policy/blueprint-gh-boundary" }
  }

  override_resource {
    target = aws_iam_openid_connect_provider.github
    values = { arn = "arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com" }
  }

  override_resource {
    target = aws_iam_role.github
    values = { arn = "arn:aws:iam::111111111111:role/mock" }
  }
}

variables {
  account_id  = "111111111111"
  aws_region  = "us-east-2"
  name_prefix = "blueprint"
  project_tag = "blueprint"

  github_owner    = "octo-org"
  github_repo     = "blueprint-fork"
  github_owner_id = 1001
  github_repo_id  = 2002
  subject_format  = "immutable"

  plan_environment           = "prod-plan"
  apply_environment          = "prod"
  deploy_content_environment = "prod-content"

  create_oidc_provider       = true
  state_bucket_force_destroy = false

  route53_zone_id      = ""
  route53_record_names = []

  cloudfront_oac_ids                     = []
  cloudfront_response_headers_policy_ids = []
}

run "immutable_subject_per_environment" {
  assert {
    condition = (
      jsondecode(aws_iam_role.github["apply"].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
      == "repo:octo-org@1001/blueprint-fork@2002:environment:prod"
    )
    error_message = "gh-apply must trust only the prod environment, in the immutable format."
  }

  assert {
    condition = (
      jsondecode(aws_iam_role.github["plan"].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
      == "repo:octo-org@1001/blueprint-fork@2002:environment:prod-plan"
    )
    error_message = "gh-plan must trust only the prod-plan environment."
  }

  # The content upload has its own environment (no reviewers, only main): merges that do not change
  # the infrastructure publish without an approval, and gh-deploy-content no longer trusts prod.
  assert {
    condition = (
      jsondecode(aws_iam_role.github["deploy_content"].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
      == "repo:octo-org@1001/blueprint-fork@2002:environment:prod-content"
    )
    error_message = "gh-deploy-content must trust only the prod-content environment."
  }

  assert {
    condition = length(distinct([
      for role in aws_iam_role.github :
      jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
    ])) == 3
    error_message = "Each role trusts a different environment."
  }

  assert {
    condition     = alltrue([for role in aws_iam_role.github : length(jsondecode(role.assume_role_policy).Statement) == 1])
    error_message = "Each trust policy has a single statement (one subject per role)."
  }

  assert {
    condition = alltrue([
      for role in aws_iam_role.github :
      jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
      && keys(jsondecode(role.assume_role_policy).Statement[0].Condition) == ["StringEquals"]
    ])
    error_message = "Every trust policy uses StringEquals only, on the exact audience."
  }

  assert {
    condition     = alltrue([for role in aws_iam_role.github : role.permissions_boundary == aws_iam_policy.boundary.arn])
    error_message = "Every GitHub role carries the boundary."
  }

  assert {
    condition     = length(aws_iam_openid_connect_provider.github) == 1
    error_message = "The OIDC provider is created by default."
  }

  assert {
    condition     = aws_s3_bucket.state.bucket == "blueprint-tfstate-111111111111-us-east-2"
    error_message = "The state bucket is named with the prefix, the account and the region."
  }
}

run "legacy_subject" {
  variables {
    subject_format = "legacy"
  }

  assert {
    condition = (
      jsondecode(aws_iam_role.github["deploy_content"].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
      == "repo:octo-org/blueprint-fork:environment:prod-content"
    )
    error_message = "The legacy format has no numeric IDs."
  }

  assert {
    condition = (
      jsondecode(aws_iam_role.github["apply"].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
      == "repo:octo-org/blueprint-fork:environment:prod"
    )
    error_message = "gh-apply stays on prod in the legacy format too."
  }
}

run "custom_environments" {
  variables {
    plan_environment           = "staging-plan"
    apply_environment          = "staging"
    deploy_content_environment = "staging-content"
  }

  assert {
    condition = [
      for key in ["plan", "apply", "deploy_content"] :
      jsondecode(aws_iam_role.github[key].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]
      ] == [
      "repo:octo-org@1001/blueprint-fork@2002:environment:staging-plan",
      "repo:octo-org@1001/blueprint-fork@2002:environment:staging",
      "repo:octo-org@1001/blueprint-fork@2002:environment:staging-content",
    ]
    error_message = "Each role trusts the environment of its variable."
  }
}

# gh-apply is the only role behind reviewers: sharing its environment with one of the others would
# let that environment, without reviewers, assume it.
run "rejects_shared_apply_environment" {
  command = plan

  variables {
    deploy_content_environment = "prod"
  }

  expect_failures = [var.apply_environment]
}

run "rejects_content_on_plan_environment" {
  command = plan

  variables {
    deploy_content_environment = "prod-plan"
  }

  expect_failures = [var.deploy_content_environment]
}

run "rejects_bad_environment_name" {
  command = plan

  variables {
    deploy_content_environment = "prod:*"
  }

  expect_failures = [var.deploy_content_environment]
}

run "reuses_existing_oidc_provider" {
  variables {
    create_oidc_provider = false
  }

  assert {
    condition     = length(aws_iam_openid_connect_provider.github) == 0
    error_message = "With create_oidc_provider = false nothing is created."
  }

  assert {
    condition = (
      jsondecode(aws_iam_role.github["plan"].assume_role_policy).Statement[0].Principal.Federated
      == "arn:aws:iam::111111111111:oidc-provider/token.actions.githubusercontent.com"
    )
    error_message = "The roles trust the existing provider."
  }
}

run "policies_fit_iam_limits" {
  variables {
    route53_zone_id                        = "Z0123456789ABCDEFGHIJ"
    route53_record_names                   = ["beta.example.com", "_*.beta.example.com"]
    cloudfront_oac_ids                     = ["E1ABCDEFGHIJKL", "E2ABCDEFGHIJKL"]
    cloudfront_response_headers_policy_ids = ["11111111-2222-3333-4444-555555555555", "66666666-7777-8888-9999-000000000000"]
  }

  # Managed policies: 6,144 characters without whitespace. Inline policies: 10,240 per role.
  assert {
    condition     = length(aws_iam_policy.boundary.policy) <= 6144
    error_message = "The boundary exceeds the size of a managed policy (${length(aws_iam_policy.boundary.policy)} characters)."
  }

  assert {
    condition     = alltrue([for p in aws_iam_role_policy.github : length(p.policy) <= 10240])
    error_message = "A role policy exceeds the inline size limit."
  }

  assert {
    condition = contains(
      [for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement : s.Sid],
      "SiteRecords",
    )
    error_message = "With a hosted zone and record names, gh-apply can change those records."
  }
}

run "no_route53_without_zone" {
  variables {
    route53_zone_id      = ""
    route53_record_names = []
  }

  assert {
    condition = length([
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement : s
      if length(regexall("route53", jsonencode(s))) > 0
    ]) == 0
    error_message = "Without a hosted zone the roles have no Route 53 permissions."
  }
}

run "deploy_content_cannot_touch_state" {
  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_role_policy.github["deploy_content"].policy).Statement :
      s.Effect == "Deny" && contains(s.Resource, "arn:aws:s3:::blueprint-tfstate-111111111111-us-east-2/*")
    ])
    error_message = "gh-deploy-content must have an explicit deny on the state bucket."
  }
}

# Which role actions carry the iam:PermissionsBoundary condition. The key is only in the request
# context of the actions listed by the Service Authorization Reference for IAM (action condition
# keys): with StringNotEquals, an action without the key would always be denied, and with
# StringEquals, never allowed. TagRole and UntagRole do not have it, so they go without it.
run "boundary_condition_actions" {
  assert {
    condition = toset(one([
      for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s.Action if s.Sid == "RolesNeedBoundary"
      ])) == toset([
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:UpdateRole",
      "iam:UpdateRoleDescription",
      "iam:UpdateAssumeRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:PutRolePermissionsBoundary",
    ])
    error_message = "RolesNeedBoundary must list exactly the role actions that carry iam:PermissionsBoundary."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement :
      contains(keys(try(s.Condition.StringEquals, {})), "iam:PermissionsBoundary")
      if contains(["RolesCreate", "RolesManage"], s.Sid)
    ])
    error_message = "gh-apply creates and changes roles only with the boundary."
  }

  assert {
    condition = alltrue(flatten([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_policy.boundary.policy).Statement,
        ) : [
        for a in flatten([try(s.Action, [])]) :
        !contains(["iam:TagRole", "iam:UntagRole"], a) || !contains(keys(try(s.Condition.StringEquals, {})), "iam:PermissionsBoundary") && !contains(keys(try(s.Condition.StringNotEquals, {})), "iam:PermissionsBoundary")
      ]
    ]))
    error_message = "TagRole and UntagRole never take the iam:PermissionsBoundary condition (the key is not in their request context)."
  }
}

# Origin access controls and response headers policies have no tags: other projects of a shared
# account can have their own, so only the IDs of the variables can be updated or deleted.
run "cloudfront_untaggable_without_ids" {
  variables {
    cloudfront_oac_ids                     = []
    cloudfront_response_headers_policy_ids = []
  }

  assert {
    condition = length([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_policy.boundary.policy).Statement,
      ) : s
      if s.Effect == "Allow" && length(setintersection(flatten([s.Action]), [
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:UpdateResponseHeadersPolicy",
        "cloudfront:DeleteResponseHeadersPolicy",
      ])) > 0
    ]) == 0
    error_message = "With empty lists, no policy allows updating or deleting origin access controls or response headers policies."
  }

  assert {
    condition = alltrue([
      for sid in ["OnlyProjectOriginAccessControls", "OnlyProjectResponseHeadersPolicies"] :
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == sid]).Effect == "Deny"
      && one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == sid]).Resource == "*"
    ])
    error_message = "With empty lists, the boundary explicitly denies updating and deleting them on \"*\"."
  }

  assert {
    condition = toset(one([
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement : s.Action if s.Sid == "CloudFrontCreateUntaggable"
    ])) == toset(["cloudfront:CreateOriginAccessControl", "cloudfront:CreateResponseHeadersPolicy"])
    error_message = "gh-apply can still create origin access controls and response headers policies."
  }

  # No CloudFront write on "*" other than creating: cache and origin request policies, origin
  # access identities, key value stores and the rest stay out of reach.
  assert {
    condition = alltrue(flatten([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_role_policy.github["deploy_content"].policy).Statement,
        jsondecode(aws_iam_policy.boundary.policy).Statement,
        ) : [
        for a in flatten([s.Action]) :
        length(regexall("^cloudfront:(Get|Describe|List|Create(Distribution|Function|OriginAccessControl|ResponseHeadersPolicy)$)", a)) > 0
        if startswith(a, "cloudfront:")
      ] if s.Effect == "Allow" && try(s.Resource, null) == "*"
    ]))
    error_message = "A CloudFront write other than the allowed creates is open on \"*\"."
  }
}

run "cloudfront_untaggable_with_ids" {
  variables {
    cloudfront_oac_ids                     = ["E1ABCDEFGHIJKL"]
    cloudfront_response_headers_policy_ids = ["11111111-2222-3333-4444-555555555555"]
  }

  assert {
    condition = alltrue([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_policy.boundary.policy).Statement,
      ) :
      (
        contains(flatten([s.Action]), "cloudfront:UpdateOriginAccessControl")
        ? s.Resource == ["arn:aws:cloudfront::111111111111:origin-access-control/E1ABCDEFGHIJKL"]
        : contains(flatten([s.Action]), "cloudfront:UpdateResponseHeadersPolicy")
        ? s.Resource == ["arn:aws:cloudfront::111111111111:response-headers-policy/11111111-2222-3333-4444-555555555555"]
        : true
      )
      if s.Effect == "Allow"
    ])
    error_message = "Updating and deleting are allowed only on the ARNs of the listed IDs."
  }

  assert {
    condition = length([
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement : s
      if contains(["CloudFrontProjectOriginAccessControls", "CloudFrontProjectResponseHeadersPolicies"], s.Sid)
    ]) == 2
    error_message = "With IDs, gh-apply gets one statement per type."
  }

  assert {
    condition = (
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "OnlyProjectOriginAccessControls"]).NotResource
      == ["arn:aws:cloudfront::111111111111:origin-access-control/E1ABCDEFGHIJKL"]
    )
    error_message = "With IDs, the boundary denies updating and deleting any other origin access control."
  }

  assert {
    condition = (
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "OnlyProjectResponseHeadersPolicies"]).NotResource
      == ["arn:aws:cloudfront::111111111111:response-headers-policy/11111111-2222-3333-4444-555555555555"]
    )
    error_message = "With IDs, the boundary denies updating and deleting any other response headers policy."
  }
}

run "rejects_wildcard_cloudfront_ids" {
  command = plan

  variables {
    cloudfront_oac_ids                     = ["*"]
    cloudfront_response_headers_policy_ids = ["arn:aws:cloudfront::111111111111:response-headers-policy/*"]
  }

  expect_failures = [var.cloudfront_oac_ids, var.cloudfront_response_headers_policy_ids]
}

run "rejects_bad_account_id" {
  command = plan

  variables {
    account_id = "12345"
  }

  expect_failures = [var.account_id]
}
