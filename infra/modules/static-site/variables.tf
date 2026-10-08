variable "name_prefix" {
  description = "Prefix of every name (the roles of the bootstrap are scoped to it)."
  type        = string
}

variable "project_tag" {
  description = "Value of the Project tag. The boundary of the bootstrap denies creating distributions and functions without it."
  type        = string
}

variable "account_id" {
  description = "AWS account of the deployment: part of the bucket name, which is global in S3."
  type        = string
}

variable "domain" {
  description = "Alternate domain name (CNAME) of the distribution. Its DNS record is not managed here."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ARN of an issued ACM certificate in us-east-1 that covers the domain. Only referenced: this module never creates or changes it."
  type        = string
}

variable "price_class" {
  description = "Price class of the distribution: PriceClass_All, PriceClass_200 or PriceClass_100."
  type        = string
}

variable "noncurrent_version_days" {
  description = "Days the bucket keeps a replaced or deleted object version (to roll back a file)."
  type        = number
  default     = 30
}
