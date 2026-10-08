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
    target = aws_iam_policy.apply_auth
    values = { arn = "arn:aws:iam::111111111111:policy/blueprint-gh-apply-auth" }
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
    condition     = length(aws_iam_policy.apply_auth.policy) <= 6144
    error_message = "The F4 policy of gh-apply exceeds the size of a managed policy (${length(aws_iam_policy.apply_auth.policy)} characters)."
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
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement : s
      if s.Effect == "Allow" && length(setintersection(flatten([s.Action]), [
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:UpdateResponseHeadersPolicy",
        "cloudfront:DeleteResponseHeadersPolicy",
      ])) > 0
    ]) == 0
    error_message = "With empty lists, gh-apply cannot update or delete origin access controls or response headers policies."
  }

  # The boundary allows them on "*" and narrows them with an explicit deny (the same effective
  # permission in fewer characters): with empty lists, the deny covers everything.
  assert {
    condition = (
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "OnlyProjectUntaggable"]).Effect == "Deny"
      && one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "OnlyProjectUntaggable"]).Resource == "*"
      && toset(one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "OnlyProjectUntaggable"]).Action) == toset([
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:UpdateResponseHeadersPolicy",
        "cloudfront:DeleteResponseHeadersPolicy",
      ])
    )
    error_message = "With empty lists, the boundary explicitly denies updating and deleting them on \"*\"."
  }

  assert {
    condition = toset(one([
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement : s.Action if s.Sid == "CloudFrontCreateUntaggable"
    ])) == toset(["cloudfront:CreateOriginAccessControl", "cloudfront:CreateResponseHeadersPolicy"])
    error_message = "gh-apply can still create origin access controls and response headers policies."
  }

  # No CloudFront write on "*" other than creating (and, in the boundary, updating and deleting the
  # types without tags, which OnlyProjectUntaggable denies outside the listed IDs): cache and origin
  # request policies, origin access identities, key value stores and the rest stay out of reach.
  assert {
    condition = alltrue(flatten([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_role_policy.github["deploy_content"].policy).Statement,
        jsondecode(aws_iam_policy.boundary.policy).Statement,
        ) : [
        for a in flatten([s.Action]) :
        length(regexall("^cloudfront:(Get|Describe|List|Create(Distribution|Function|OriginAccessControl|ResponseHeadersPolicy)$|(Update|Delete)(OriginAccessControl|ResponseHeadersPolicy)$)", a)) > 0
        if startswith(a, "cloudfront:")
      ] if s.Effect == "Allow" && try(s.Resource, null) == "*"
    ]))
    error_message = "A CloudFront write other than the allowed creates is open on \"*\"."
  }

  assert {
    condition = length([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_role_policy.github["deploy_content"].policy).Statement,
        jsondecode(aws_iam_policy.apply_auth.policy).Statement,
      ) : s
      if s.Effect == "Allow" && try(s.Resource, null) == "*" && length(regexall("cloudfront:(Update|Delete)", jsonencode(s))) > 0
    ]) == 0
    error_message = "Only the boundary opens updating and deleting on \"*\", always with its deny."
  }
}

run "cloudfront_untaggable_with_ids" {
  variables {
    cloudfront_oac_ids                     = ["E1ABCDEFGHIJKL"]
    cloudfront_response_headers_policy_ids = ["11111111-2222-3333-4444-555555555555"]
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.github["apply"].policy).Statement :
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
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "OnlyProjectUntaggable"]).NotResource
      == [
        "arn:aws:cloudfront::111111111111:origin-access-control/E1ABCDEFGHIJKL",
        "arn:aws:cloudfront::111111111111:response-headers-policy/11111111-2222-3333-4444-555555555555",
      ]
    )
    error_message = "With IDs, the boundary denies updating and deleting any other origin access control or response headers policy."
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

# --- F4 (ADR-0029): login and the player profile.

run "auth_apply_policy" {
  assert {
    condition     = aws_iam_role_policy_attachment.apply_auth.role == aws_iam_role.github["apply"].name
    error_message = "The F4 policy is attached to gh-apply."
  }

  assert {
    condition     = aws_iam_policy.apply_auth.name == "blueprint-gh-apply-auth"
    error_message = "The F4 policy is named <prefix>-gh-*, so the boundary protects it (ProtectBootstrap)."
  }

  # Created with the Project tag (aws:RequestTag), changed only with it (aws:ResourceTag).
  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_policy.apply_auth.policy).Statement :
      s.Condition == { StringEquals = { "aws:RequestTag/Project" = "blueprint" } }
      if contains(["AuthCreateTagged", "TablesCreateTagged", "AuthTagOnCreate"], s.Sid)
    ])
    error_message = "Creating and tagging on create need Project = project_tag in the request."
  }

  assert {
    condition = (
      one([for s in jsondecode(aws_iam_policy.apply_auth.policy).Statement : s if s.Sid == "AuthManageTagged"]).Condition
      == { StringEquals = { "aws:ResourceTag/Project" = "blueprint" } }
    )
    error_message = "Changing the user pool, the identity pool or the table needs the Project tag on them."
  }

  assert {
    condition = (
      one([for s in jsondecode(aws_iam_policy.apply_auth.policy).Statement : s if s.Sid == "TablesCreateTagged"]).Resource
      == "arn:aws:dynamodb:us-east-2:111111111111:table/blueprint-*"
    )
    error_message = "Tables are created only with the prefix, in the main region."
  }

  # iam:PassRole: only the player role, only to Cognito identity pools.
  assert {
    condition = one([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_policy.apply_auth.policy).Statement,
      ) : s if contains(flatten([s.Action]), "iam:PassRole")
      ]) == {
      Sid       = "PassPlayerRole"
      Effect    = "Allow"
      Action    = "iam:PassRole"
      Resource  = "arn:aws:iam::111111111111:role/blueprint-player"
      Condition = { StringEquals = { "iam:PassedToService" = "cognito-identity.amazonaws.com" } }
    }
    error_message = "gh-apply passes only the player role, and only to cognito-identity.amazonaws.com."
  }

  # SetIdentityPoolRoles has no resource type nor condition key: the only F4 write on "*" besides
  # the creates.
  assert {
    condition = toset(flatten([
      for s in jsondecode(aws_iam_policy.apply_auth.policy).Statement : s.Action if try(s.Resource, null) == "*"
      ])) == toset([
      "cognito-idp:CreateUserPool",
      "cognito-identity:CreateIdentityPool",
      "cognito-identity:SetIdentityPoolRoles",
    ])
    error_message = "Only the creates without a resource and SetIdentityPoolRoles go on \"*\"."
  }
}

# No service wildcard for Cognito or DynamoDB, and nothing that reads the users of a pool (their
# emails): no ListUsers, Admin*, or Get*/List* wildcards.
run "auth_no_service_wildcards" {
  assert {
    condition = alltrue(flatten([
      for s in concat(
        jsondecode(aws_iam_role_policy.github["plan"].policy).Statement,
        jsondecode(aws_iam_role_policy.github["apply"].policy).Statement,
        jsondecode(aws_iam_policy.apply_auth.policy).Statement,
        jsondecode(aws_iam_policy.boundary.policy).Statement,
        ) : [
        for a in flatten([try(s.Action, [])]) :
        length(regexall("^(cognito-idp|cognito-identity|dynamodb):([*]$|Get[*]|List[*]|Describe[*]|Admin|ListUsers)", a)) == 0
      ] if s.Effect == "Allow"
    ]))
    error_message = "A Cognito or DynamoDB service wildcard, or an action that reads users, is allowed."
  }

  assert {
    condition = alltrue(flatten([
      for s in jsondecode(aws_iam_policy.boundary.policy).Statement : [
        for a in flatten([try(s.Action, [])]) :
        !startswith(a, "dynamodb:") || contains([
          "dynamodb:CreateTable", "dynamodb:TagResource", "dynamodb:UntagResource", "dynamodb:*Item", "dynamodb:Query",
          "dynamodb:*Table", "dynamodb:*ContinuousBackups", "dynamodb:*TimeToLive", "dynamodb:ListTagsOfResource",
        ], a)
      ] if s.Effect == "Allow"
    ]))
    error_message = "The DynamoDB ceiling is the reviewed list (the suffix wildcards are expanded in a comment of iam_policies.tf)."
  }
}

# gh-plan only reads: no Cognito or DynamoDB action that changes anything.
run "auth_plan_reads_only" {
  assert {
    condition = alltrue(flatten([
      for s in jsondecode(aws_iam_role_policy.github["plan"].policy).Statement : [
        for a in flatten([s.Action]) :
        length(regexall("^(cognito-idp|cognito-identity|dynamodb):(Describe|Get|List)", a)) > 0
        if length(regexall("^(cognito-idp|cognito-identity|dynamodb):", a)) > 0
      ]
    ]))
    error_message = "gh-plan has a Cognito or DynamoDB action that is not a read."
  }

  assert {
    condition = alltrue([
      for s in jsondecode(aws_iam_role_policy.github["plan"].policy).Statement :
      s.Condition == { StringEquals = { "aws:ResourceTag/Project" = "blueprint" } }
      if contains(["UserPoolsRead", "IdentityPoolsRead", "TablesRead"], s.Sid)
    ])
    error_message = "gh-plan reads only the user pools, identity pools and tables with the Project tag."
  }
}

run "auth_boundary" {
  # The player role's whole ceiling: items of the tables of the prefix.
  assert {
    condition = anytrue([
      for s in jsondecode(aws_iam_policy.boundary.policy).Statement :
      s.Effect == "Allow" && contains(s.Action, "dynamodb:*Item") && contains(s.Action, "dynamodb:Query")
      && contains(s.Resource, "arn:aws:dynamodb:us-east-2:111111111111:table/blueprint-*") && try(s.Condition, null) == null
    ])
    error_message = "The boundary allows the item actions on the tables of the prefix."
  }

  assert {
    condition = (
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s if s.Sid == "CeilingAuthTagged"]).Condition
      == { StringEquals = { "aws:ResourceTag/Project" = "blueprint" } }
    )
    error_message = "Every change to a user pool, identity pool or table needs the Project tag on it."
  }

  assert {
    condition = length(setintersection(
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s.Action if s.Sid == "CreateWithProjectTag"]),
      ["cognito-idp:CreateUserPool", "cognito-identity:CreateIdentityPool", "dynamodb:CreateTable"],
    )) == 3
    error_message = "User pools, identity pools and tables are born with the Project tag."
  }

  assert {
    condition = alltrue([
      for a in ["cognito-idp:TagResource", "cognito-identity:TagResource", "dynamodb:TagResource"] :
      contains(one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s.Action if s.Sid == "NoOtherProjectResources"]), a)
      && contains(one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s.Action if s.Sid == "NoOtherProjectTag"]), a)
    ])
    error_message = "The tag rules cover the F4 resources."
  }

  assert {
    condition = alltrue([
      for a in ["cognito-idp:UntagResource", "cognito-identity:UntagResource", "dynamodb:UntagResource"] :
      contains(one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s.Action if s.Sid == "KeepProjectTag"]), a)
    ])
    error_message = "The Project tag of the F4 resources cannot be removed."
  }
}

# Sign-in with Google: the identity provider of the user pool, only on pools with the Project tag.
run "auth_google_identity_provider" {
  assert {
    condition = length(setintersection(
      one([for s in jsondecode(aws_iam_policy.apply_auth.policy).Statement : s.Action if s.Sid == "AuthManageTagged"]),
      ["cognito-idp:CreateIdentityProvider", "cognito-idp:UpdateIdentityProvider", "cognito-idp:DeleteIdentityProvider"],
    )) == 3
    error_message = "gh-apply manages the identity provider of a user pool with the Project tag."
  }

  assert {
    condition = contains(
      one([for s in jsondecode(aws_iam_role_policy.github["plan"].policy).Statement : s.Action if s.Sid == "UserPoolsRead"]),
      "cognito-idp:DescribeIdentityProvider",
    )
    error_message = "gh-plan reads the identity provider (refresh of aws_cognito_identity_provider)."
  }

  # Suffix wildcard: in the Service Authorization Reference it matches only Create, Delete,
  # Describe and Update IdentityProvider. Behind the tag condition.
  assert {
    condition = contains(
      one([for s in jsondecode(aws_iam_policy.boundary.policy).Statement : s.Action if s.Sid == "CeilingAuthTagged"]),
      "cognito-idp:*IdentityProvider",
    )
    error_message = "The boundary allows the identity provider actions on tagged user pools."
  }
}
