variable "name_prefix" {
  description = "Prefix of every name (the roles of the bootstrap are scoped to it)."
  type        = string
}

variable "project_tag" {
  description = "Value of the Project tag. The boundary of the bootstrap denies creating user pools, identity pools and tables without it."
  type        = string
}

variable "account_id" {
  description = "AWS account of the deployment: the ARN of the boundary of the bootstrap, which the player role must carry."
  type        = string
}

variable "domain" {
  description = "Domain of the site (e.g. beta.example.com): the login returns to https://<domain>/auth/callback."
  type        = string
}

variable "auth_domain_prefix" {
  description = "Prefix of the Cognito domain of the login (<prefix>.auth.<region>.amazoncognito.com). Unique per region across AWS, and never derived from the account ID."
  type        = string

  # The pattern of Domain in CreateUserPoolDomain
  # (https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateUserPoolDomain.html).
  # Stricter than the API: without aws, amazon or cognito, which the console rejects in prefixes
  # (TODO(verificar): not in the API reference; a stricter check never breaks a valid prefix).
  validation {
    condition = (
      can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", var.auth_domain_prefix))
      && length(regexall("aws|amazon|cognito", var.auth_domain_prefix)) == 0
    )
    error_message = "auth_domain_prefix must be 1-63 lowercase letters, digits and hyphens (no hyphen at the ends), without aws, amazon or cognito."
  }
}

variable "local_origin" {
  description = "Origin of the dev server (pnpm dev): its callback and logout URLs are allowed too."
  type        = string
  default     = "http://localhost:5173"
}

# Sign-in with Google (ADR-0029). Both empty: no Google. The OAuth client is created by hand in the
# Google Cloud console (guide, step 3.9).
variable "google_client_id" {
  description = "Client ID of the Google OAuth client (<number>-<id>.apps.googleusercontent.com), or empty for no sign-in with Google."
  type        = string
  default     = ""

  validation {
    condition     = var.google_client_id == "" || can(regex("^[0-9]+-[a-z0-9]+\\.apps\\.googleusercontent\\.com$", var.google_client_id))
    error_message = "google_client_id must be empty or a Google OAuth client ID (<number>-<id>.apps.googleusercontent.com)."
  }
}

variable "google_client_secret" {
  description = "Client secret of the Google OAuth client. Stored in the state (encrypted bucket of the bootstrap)."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = (var.google_client_id == "") == (var.google_client_secret == "")
    error_message = "google_client_id and google_client_secret go together: both set or both empty."
  }
}
