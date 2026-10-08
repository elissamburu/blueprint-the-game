# Production of the site (ADR-0014): applied by GitHub Actions (deploy.yml) with gh-apply, never by
# hand. Same pins as infra/bootstrap/versions.tf.
terraform {
  required_version = "= 1.16.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.67.0"
    }
  }

  # Partial configuration: the bucket (the state bucket of the bootstrap, whose name carries the
  # account ID) only enters with -backend-config="bucket=..." and is never written in the repo.
  # use_lockfile is the native lock of S3 (locking with DynamoDB is deprecated):
  # https://developer.hashicorp.com/terraform/language/backend/s3
  backend "s3" {
    key          = "envs/prod/terraform.tfstate"
    region       = "us-east-2"
    use_lockfile = true
    encrypt      = true
  }
}
