data "aws_region" "current" {}

locals {
  # Bucket names are global in S3: the account and the region make it unique, as in the state
  # bucket of the bootstrap. The roles of the bootstrap are scoped to "<prefix>-*".
  bucket_name = "${var.name_prefix}-site-${var.account_id}-${data.aws_region.current.region}"

  # Also in the default_tags of the provider. Here explicitly, so creating a distribution or a
  # function always carries it (the boundary denies it otherwise) and the tests can check it.
  tags = { Project = var.project_tag }

  origin_id = "site-bucket"

  # The Content-Security-Policy of the site, from its only source: one directive per line in
  # tools/deploy-site, where the preview server reads it too and its tests check it. It is a
  # template: ${aws_region} and ${auth_domain} are the endpoints of the login and the profile
  # (ADR-0029), filled in as the preview server fills them (src/csp.ts, renderCsp) and joined as it
  # joins them: trimmed lines, no blank ones, "; " between them.
  content_security_policy = join("; ", [
    for line in split("\n", templatefile("${path.module}/../../../tools/deploy-site/cloudfront/content-security-policy.txt", {
      aws_region  = data.aws_region.current.region
      auth_domain = var.auth_domain
    })) :
    trimspace(line) if trimspace(line) != ""
  ])
}
