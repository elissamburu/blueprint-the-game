# Identifiers, not secrets: the deploy job builds the web with them (VITE_AUTH_*). None carries the
# account ID.

output "region" {
  description = "Region of the user pool, the identity pool and the table."
  value       = local.region
}

output "user_pool_id" {
  description = "ID of the user pool."
  value       = aws_cognito_user_pool.players.id
}

output "user_pool_client_id" {
  description = "ID of the public app client of the web."
  value       = aws_cognito_user_pool_client.web.id
}

output "identity_pool_id" {
  description = "ID of the identity pool."
  value       = aws_cognito_identity_pool.players.id
}

output "auth_domain" {
  description = "Host of the hosted UI and of the OAuth endpoints (<prefix>.auth.<region>.amazoncognito.com)."
  value       = local.auth_domain
}

output "table_name" {
  description = "Name of the profiles table."
  value       = aws_dynamodb_table.profiles.name
}

output "google_enabled" {
  description = "Whether sign-in with Google is configured (the web shows its button)."
  value       = local.google_enabled
}
