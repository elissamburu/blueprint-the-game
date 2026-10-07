variable "account_id" {
  description = "AWS account where the project is deployed. The provider refuses any other account."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account ID."
  }
}

variable "aws_region" {
  description = "Main region of the deployment (the state bucket lives here). CloudFront certificates stay in us-east-1 regardless."
  type        = string
  default     = "us-east-2"
}

variable "name_prefix" {
  description = "Prefix of every resource name of the project. The policies of the roles are scoped to it, so it must be unique in the account."
  type        = string
  default     = "blueprint"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,18}[a-z0-9]$", var.name_prefix))
    error_message = "name_prefix must be 3-20 characters: lowercase letters, digits and hyphens, starting with a letter."
  }
}

variable "project_tag" {
  description = "Value of the Project tag on every resource of the project. The roles can only modify resources with this tag (where the service supports it) and the budget filters costs by it."
  type        = string
  default     = "blueprint"

  validation {
    condition     = can(regex("^[A-Za-z0-9 _.:/=+@-]{1,256}$", var.project_tag))
    error_message = "project_tag must be a valid AWS tag value (1-256 characters)."
  }
}

variable "github_owner" {
  description = "Owner (user or organization) of the GitHub repository that deploys."
  type        = string
}

variable "github_repo" {
  description = "Name of the GitHub repository that deploys."
  type        = string
}

variable "github_owner_id" {
  description = "Numeric ID of the owner (gh api repos/OWNER/REPO --jq .owner.id). Used by the immutable subject format."
  type        = number
}

variable "github_repo_id" {
  description = "Numeric ID of the repository (gh api repos/OWNER/REPO --jq .id). Used by the immutable subject format."
  type        = number
}

variable "subject_format" {
  description = "Format of the sub claim of the GitHub OIDC token: \"immutable\" (repo:OWNER@OWNER_ID/REPO@REPO_ID:...) or \"legacy\" (repo:OWNER/REPO:...). See ADR-0014."
  type        = string
  default     = "immutable"

  validation {
    condition     = contains(["immutable", "legacy"], var.subject_format)
    error_message = "subject_format must be \"immutable\" or \"legacy\"."
  }
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set to false when the account already has one (there can only be one per URL): it is then read with a data source and left untouched."
  type        = bool
  default     = true
}

variable "state_bucket_force_destroy" {
  description = "Allow terraform destroy to delete the state bucket with its objects and versions. Only to tear everything down."
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "ID of the public hosted zone of the site domain, or empty to give the roles no Route 53 permissions. The zone itself is not managed by Terraform."
  type        = string
  default     = ""

  validation {
    condition     = var.route53_zone_id == "" || can(regex("^Z[A-Z0-9]{1,31}$", var.route53_zone_id))
    error_message = "route53_zone_id must be empty or a hosted zone ID (Z...), without the /hostedzone/ prefix."
  }
}

variable "route53_record_names" {
  description = "Records of the zone that gh-apply can change, normalized as Route 53 expects them: lowercase and without the trailing dot. IAM wildcards (*) are allowed, e.g. [\"beta.example.com\", \"_*.beta.example.com\"] for the site and its ACM validation record."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for name in var.route53_record_names : can(regex("^[a-z0-9_*.-]+[a-z0-9*]$", name))])
    error_message = "Each record name must be lowercase, without the trailing dot."
  }
}

variable "cloudfront_oac_ids" {
  description = "IDs of the CloudFront origin access controls of the project (created by infra/envs/prod). gh-apply can update and delete only these; empty, it can create them but never change or delete one. Fill in after the first apply of infra/envs/prod and re-apply the bootstrap."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for id in var.cloudfront_oac_ids : can(regex("^[A-Z0-9]{1,64}$", id))])
    error_message = "Each origin access control ID must be the bare ID (uppercase letters and digits, e.g. E1ABCDEFGHIJKL), not an ARN or a wildcard."
  }
}

variable "cloudfront_response_headers_policy_ids" {
  description = "IDs of the CloudFront response headers policies of the project (created by infra/envs/prod). gh-apply can update and delete only these; empty, it can create them but never change or delete one. Fill in after the first apply of infra/envs/prod and re-apply the bootstrap."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for id in var.cloudfront_response_headers_policy_ids :
      can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", id))
    ])
    error_message = "Each response headers policy ID must be the bare ID (a lowercase UUID), not an ARN or a wildcard."
  }
}
