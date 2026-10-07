resource "aws_iam_policy" "boundary" {
  name        = local.boundary_name
  description = "Permissions boundary of the GitHub roles of ${local.prefix} and of every role they create (ADR-0014)"
  policy      = local.boundary_policy
}

# Trust: only GitHub's OIDC tokens, with the exact audience and the exact subject of one environment
# of this repository. StringEquals, never wildcards (ADR-0014).
resource "aws_iam_role" "github" {
  for_each = local.roles

  name                 = each.value.name
  description          = each.value.description
  max_session_duration = 3600
  permissions_boundary = aws_iam_policy.boundary.arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "GitHubEnvironment"
        Effect    = "Allow"
        Principal = { Federated = local.oidc_provider_arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.github_oidc_host}:aud" = local.github_audience
            "${local.github_oidc_host}:sub" = "repo:${local.repo_ref}:environment:${each.value.environment}"
          }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy" "github" {
  for_each = {
    plan           = local.plan_policy
    apply          = local.apply_policy
    deploy_content = local.deploy_content_policy
  }

  name   = "${local.roles[each.key].name}-permissions"
  role   = aws_iam_role.github[each.key].id
  policy = each.value
}
