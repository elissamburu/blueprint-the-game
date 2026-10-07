provider "aws" {
  region = var.aws_region

  # Refuses to run against any other account: the account is shared with other projects.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      (local.project_tag_key) = var.project_tag
      Stack                   = "bootstrap"
      ManagedBy               = "terraform"
    }
  }
}

data "aws_partition" "current" {}
