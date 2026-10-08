locals {
  partition = data.aws_partition.current.partition
  account   = var.account_id
  prefix    = var.name_prefix

  project_tag_key = "Project"

  # Certificates used by CloudFront must live in us-east-1, whatever the main region is.
  cloudfront_certificate_region = "us-east-1"

  github_oidc_host = "token.actions.githubusercontent.com"
  github_audience  = "sts.amazonaws.com"

  repo_ref = (
    var.subject_format == "immutable"
    ? "${var.github_owner}@${var.github_owner_id}/${var.github_repo}@${var.github_repo_id}"
    : "${var.github_owner}/${var.github_repo}"
  )

  roles = {
    plan = {
      name        = "${local.prefix}-gh-plan"
      environment = var.plan_environment
      description = "GitHub Actions: terraform plan of ${var.github_owner}/${var.github_repo} (environment ${var.plan_environment})"
    }
    apply = {
      name        = "${local.prefix}-gh-apply"
      environment = var.apply_environment
      description = "GitHub Actions: terraform apply of ${var.github_owner}/${var.github_repo} (environment ${var.apply_environment})"
    }
    deploy_content = {
      name        = "${local.prefix}-gh-deploy-content"
      environment = var.deploy_content_environment
      description = "GitHub Actions: upload of the site and content of ${var.github_owner}/${var.github_repo} (environment ${var.deploy_content_environment})"
    }
  }

  state_bucket_name = "${local.prefix}-tfstate-${local.account}-${var.aws_region}"
  state_bucket_arn  = "arn:${local.partition}:s3:::${local.state_bucket_name}"

  # ARNs the policies are scoped to. Names start with the prefix; where the service supports tags,
  # the Project tag narrows them further (see iam_policies.tf).
  project_bucket_arn   = "arn:${local.partition}:s3:::${local.prefix}-*"
  project_object_arn   = "arn:${local.partition}:s3:::${local.prefix}-*/*"
  distribution_arn     = "arn:${local.partition}:cloudfront::${local.account}:distribution/*"
  project_function_arn = "arn:${local.partition}:cloudfront::${local.account}:function/${local.prefix}-*"
  certificate_arn      = "arn:${local.partition}:acm:${local.cloudfront_certificate_region}:${local.account}:certificate/*"
  project_budget_arn   = "arn:${local.partition}:budgets::${local.account}:budget/${local.prefix}-*"
  project_role_arn     = "arn:${local.partition}:iam::${local.account}:role/${local.prefix}-*"
  project_policy_arn   = "arn:${local.partition}:iam::${local.account}:policy/${local.prefix}-*"
  hosted_zone_arn      = "arn:${local.partition}:route53:::hostedzone/${var.route53_zone_id}"

  # Origin access controls and response headers policies have no tags and their ARNs carry a
  # generated ID: arn:${Partition}:cloudfront::${Account}:origin-access-control/${Id} and
  # .../response-headers-policy/${Id} (Service Authorization Reference for CloudFront, resource types:
  # https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazoncloudfront.html).
  # Changes are limited to the IDs listed in the variables (see iam_policies.tf).
  project_oac_arns = [
    for id in var.cloudfront_oac_ids : "arn:${local.partition}:cloudfront::${local.account}:origin-access-control/${id}"
  ]
  project_response_headers_policy_arns = [
    for id in var.cloudfront_response_headers_policy_ids : "arn:${local.partition}:cloudfront::${local.account}:response-headers-policy/${id}"
  ]

  # The bootstrap's own IAM resources: no role can change them, not even gh-apply.
  bootstrap_role_arn   = "arn:${local.partition}:iam::${local.account}:role/${local.prefix}-gh-*"
  bootstrap_policy_arn = "arn:${local.partition}:iam::${local.account}:policy/${local.prefix}-gh-*"

  boundary_name = "${local.prefix}-gh-boundary"
  # Built as a string so the boundary can name itself without a dependency cycle.
  boundary_arn = "arn:${local.partition}:iam::${local.account}:policy/${local.boundary_name}"

  oidc_provider_arn = (
    var.create_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : data.aws_iam_openid_connect_provider.github[0].arn
  )
}
