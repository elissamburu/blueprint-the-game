output "bucket" {
  description = "Name of the site bucket."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "ID of the CloudFront distribution."
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_arn" {
  description = "ARN of the CloudFront distribution."
  value       = aws_cloudfront_distribution.site.arn
}

output "distribution_domain_name" {
  description = "Domain of the distribution (dxxxxxxxxxxxxx.cloudfront.net): target of the CNAME of the site domain."
  value       = aws_cloudfront_distribution.site.domain_name
}

# The next two go to the bootstrap (cloudfront_oac_ids and cloudfront_response_headers_policy_ids):
# they have no tags, so gh-apply can only change or delete them by ID.
output "origin_access_control_id" {
  description = "ID of the origin access control."
  value       = aws_cloudfront_origin_access_control.site.id
}

output "response_headers_policy_id" {
  description = "ID of the response headers policy."
  value       = aws_cloudfront_response_headers_policy.security.id
}
