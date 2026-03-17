# Output Declarations
# Requirements: 5.2, 1.5, 2.8, 3.5

# S3 Bucket Outputs (Requirement 1.5)
output "s3_bucket_name" {
  value       = aws_s3_bucket.website.id
  description = "Name of the S3 bucket storing website files"
}

output "s3_bucket_arn" {
  value       = aws_s3_bucket.website.arn
  description = "ARN of the S3 bucket"
}

# CloudFront Distribution Outputs (Requirement 2.8)
output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.website.id
  description = "CloudFront distribution ID for cache invalidation"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.website.domain_name
  description = "CloudFront distribution domain name"
}

output "website_url" {
  value       = "https://${coalesce(var.custom_domain, aws_cloudfront_distribution.website.domain_name)}"
  description = "Full URL to access the website"
}

# ACM Certificate Outputs - Conditional (Requirement 3.5)
output "acm_certificate_arn" {
  value       = var.custom_domain != null ? aws_acm_certificate.website[0].arn : null
  description = "ACM certificate ARN (null if no custom domain)"
}

output "acm_validation_records" {
  value       = var.custom_domain != null ? aws_acm_certificate.website[0].domain_validation_options : []
  description = "DNS records required for ACM certificate validation"
}
