# Identifiers, not secrets: they go to the GitHub repository as variables (not secrets), and never
# into the repository itself.
output "role_plan_arn" {
  description = "AWS_ROLE_PLAN_ARN: role of terraform plan (environment prod-plan)."
  value       = aws_iam_role.github["plan"].arn
}

output "role_apply_arn" {
  description = "AWS_ROLE_APPLY_ARN: role of terraform apply (environment prod)."
  value       = aws_iam_role.github["apply"].arn
}

output "role_deploy_content_arn" {
  description = "AWS_ROLE_DEPLOY_ARN: role of the site upload and the CloudFront invalidation (environment prod)."
  value       = aws_iam_role.github["deploy_content"].arn
}

output "state_bucket" {
  description = "TF_STATE_BUCKET: bucket of the remote state of infra/envs/*."
  value       = aws_s3_bucket.state.bucket
}

output "permissions_boundary_arn" {
  description = "Boundary that every role created by gh-apply must carry."
  value       = aws_iam_policy.boundary.arn
}
