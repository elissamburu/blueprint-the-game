# Identifiers, not secrets. The deploy job of deploy.yml uploads to the bucket and invalidates the
# distribution; the two IDs of CloudFront go to the bootstrap after the first apply (step 5.1 of
# docs/guias/configurar-aws-en-tu-fork.md).

output "site_url" {
  description = "URL of the site."
  value       = "https://${var.domain}"
}

output "bucket" {
  description = "Bucket of the site."
  value       = module.site.bucket
}

output "distribution_id" {
  description = "ID of the CloudFront distribution."
  value       = module.site.distribution_id
}

output "distribution_domain_name" {
  description = "Target of the CNAME of the domain in the external DNS."
  value       = module.site.distribution_domain_name
}

output "origin_access_control_id" {
  description = "cloudfront_oac_ids of the bootstrap."
  value       = module.site.origin_access_control_id
}

output "response_headers_policy_id" {
  description = "cloudfront_response_headers_policy_ids of the bootstrap."
  value       = module.site.response_headers_policy_id
}

# Login and profile (ADR-0029): the deploy job builds the web with them as VITE_AUTH_*. Identifiers,
# not secrets; none carries the account ID.
output "auth_region" {
  description = "VITE_AUTH_REGION."
  value       = module.auth.region
}

output "auth_user_pool_id" {
  description = "VITE_AUTH_USER_POOL_ID."
  value       = module.auth.user_pool_id
}

output "auth_user_pool_client_id" {
  description = "VITE_AUTH_CLIENT_ID."
  value       = module.auth.user_pool_client_id
}

output "auth_identity_pool_id" {
  description = "VITE_AUTH_IDENTITY_POOL_ID."
  value       = module.auth.identity_pool_id
}

output "auth_domain" {
  description = "VITE_AUTH_DOMAIN."
  value       = module.auth.auth_domain
}

output "profiles_table" {
  description = "VITE_AUTH_TABLE."
  value       = module.auth.table_name
}
