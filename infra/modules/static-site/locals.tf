data "aws_region" "current" {}

locals {
  # Bucket names are global in S3: the account and the region make it unique, as in the state
  # bucket of the bootstrap. The roles of the bootstrap are scoped to "<prefix>-*".
  bucket_name = "${var.name_prefix}-site-${var.account_id}-${data.aws_region.current.region}"

  # Also in the default_tags of the provider. Here explicitly, so creating a distribution or a
  # function always carries it (the boundary denies it otherwise) and the tests can check it.
  tags = { Project = var.project_tag }

  origin_id = "site-bucket"
}
