# Offline checks of the bootstrap: a mocked AWS provider, so no credentials and no calls to AWS.
# They render the trust and permission policies and check the rules of ADR-0014 on them.
# "apply" here only applies against the mock, in memory.
# Run with: terraform init -backend=false && terraform test

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
  account_id      = "111111111111"
  github_owner    = "octo-org"
  github_repo     = "blueprint-fork"
  github_owner_id = 1001
  github_repo_id  = 2002
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
      == "repo:octo-org/blueprint-fork:environment:prod"
    )
    error_message = "The legacy format has no numeric IDs."
  }
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
    route53_zone_id      = "Z0123456789ABCDEFGHIJ"
    route53_record_names = ["beta.example.com", "_*.beta.example.com"]
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

run "rejects_bad_account_id" {
  command = plan

  variables {
    account_id = "12345"
  }

  expect_failures = [var.account_id]
}
