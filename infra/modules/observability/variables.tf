variable "name_prefix" {
  description = "Prefix of every name (the roles of the bootstrap are scoped to it)."
  type        = string
}

variable "project_tag" {
  description = "Value of the Project tag: the budget counts only the costs of resources with it."
  type        = string
}

variable "account_id" {
  description = "AWS account that owns the budget."
  type        = string
}

variable "budget_usd" {
  description = "Monthly limit of the budget, in USD."
  type        = number
}

variable "budget_email" {
  description = "Address the budget alerts go to."
  type        = string
  sensitive   = true
}
