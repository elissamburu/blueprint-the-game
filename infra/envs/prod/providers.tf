provider "aws" {
  region = var.aws_region

  # Refuses to run against any other account: the account is shared with other projects.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project   = var.project_tag
      Stack     = "envs/prod"
      ManagedBy = "terraform"
    }
  }
}
