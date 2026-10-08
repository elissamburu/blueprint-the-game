# In deploy.yml every value comes from GitHub (variables, and secrets for account_id,
# acm_certificate_arn and budget_email) as TF_VAR_*: none is written in the repo.

variable "account_id" {
  description = "AWS account of the deployment. The provider refuses any other account."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.account_id))
    error_message = "account_id must be the 12-digit AWS account ID."
  }
}

variable "aws_region" {
  description = "Main region (the site bucket lives here). Must match the region of the backend and of the bootstrap."
  type        = string
  default     = "us-east-2"
}

variable "name_prefix" {
  description = "Prefix of every name: the same name_prefix as the bootstrap, whose roles are scoped to it."
  type        = string
  default     = "blueprint"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,18}[a-z0-9]$", var.name_prefix))
    error_message = "name_prefix must be 3-20 characters: lowercase letters, digits and hyphens, starting with a letter."
  }
}

variable "project_tag" {
  description = "Value of the Project tag: the same project_tag as the bootstrap, whose boundary requires it."
  type        = string
  default     = "blueprint"

  validation {
    condition     = can(regex("^[A-Za-z0-9 _.:/=+@-]{1,256}$", var.project_tag))
    error_message = "project_tag must be a valid AWS tag value (1-256 characters)."
  }
}

variable "domain" {
  description = "Domain of the site (e.g. beta.example.com), covered by the certificate. Its DNS record is created outside Terraform."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$", var.domain))
    error_message = "domain must be a lowercase host name without a scheme, a path or a trailing dot (e.g. beta.example.com)."
  }
}

variable "acm_certificate_arn" {
  description = "ARN of the issued ACM certificate of the domain, in us-east-1 and in this account. Created outside Terraform, without the Project tag, so gh-apply cannot change it."
  type        = string

  validation {
    condition = can(regex("^arn:aws[a-z-]*:acm:us-east-1:[0-9]{12}:certificate/[0-9a-f-]+$", var.acm_certificate_arn)) && (
      try(split(":", var.acm_certificate_arn)[4], "") == var.account_id
    )
    error_message = "acm_certificate_arn must be the ARN of a certificate of this account in us-east-1 (CloudFront only reads certificates from there)."
  }
}

variable "price_class" {
  description = "Price class of the distribution. PriceClass_All includes the edge locations of South America."
  type        = string
  default     = "PriceClass_All"

  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.price_class)
    error_message = "price_class must be PriceClass_All, PriceClass_200 or PriceClass_100."
  }
}

variable "budget_usd" {
  description = "Monthly limit of the budget, in USD."
  type        = number
  default     = 10

  validation {
    condition     = var.budget_usd > 0
    error_message = "budget_usd must be greater than 0."
  }
}

variable "budget_email" {
  description = "Address the budget alerts go to."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_email))
    error_message = "budget_email must be an email address."
  }
}

variable "auth_domain_prefix" {
  description = "Prefix of the Cognito domain of the login: <prefix>.auth.<region>.amazoncognito.com (GitHub variable AUTH_DOMAIN_PREFIX). Unique per region across AWS; never derive it from the account ID."
  type        = string
}