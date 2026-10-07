# Bootstrap of the deployment (ADR-0014): applied once, by hand, by a human with temporary admin
# credentials. Its own state stays local on purpose: this root creates the state bucket that the
# other roots use (see docs/guias/configurar-aws-en-tu-fork.md to keep a copy of it).
terraform {
  required_version = "= 1.16.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.67.0"
    }
  }
}
