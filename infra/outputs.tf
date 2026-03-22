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

# WAF Web ACL Output (Requirement 4.5)
output "waf_web_acl_arn" {
  value       = aws_wafv2_web_acl.cloudfront.arn
  description = "ARN of the WAF Web ACL attached to CloudFront"
}

# =============================================================================
# Deploy Script Reference (Requirements 5.1–5.7)
#
# Cache-Control headers must be set on S3 objects during deployment so that
# the CachingOptimized managed cache policy respects the intended TTLs.
# This is documentation only — not a Terraform resource.
#
# Usage: Set BUCKET_NAME and DISTRIBUTION_ID before running.
#
# # Deploy hashed assets (1 year cache)
# aws s3 sync dist/assets/ s3://$BUCKET_NAME/assets/ \
#   --cache-control "public, max-age=31536000, immutable"
#
# # Deploy index.html (no cache)
# aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
#   --cache-control "no-cache, no-store, must-revalidate"
#
# # Deploy service worker (no cache)
# aws s3 cp dist/sw.js s3://$BUCKET_NAME/sw.js \
#   --cache-control "no-cache, no-store, must-revalidate"
#
# # Deploy manifest (1 hour cache)
# aws s3 cp dist/manifest.webmanifest s3://$BUCKET_NAME/manifest.webmanifest \
#   --cache-control "public, max-age=3600"
#
# # Deploy icons (1 week cache)
# aws s3 sync dist/icons/ s3://$BUCKET_NAME/icons/ \
#   --cache-control "public, max-age=604800"
#
# # Deploy remaining files (1 day cache)
# aws s3 sync dist/ s3://$BUCKET_NAME/ \
#   --cache-control "public, max-age=86400" \
#   --exclude "assets/*" \
#   --exclude "index.html" \
#   --exclude "sw.js" \
#   --exclude "manifest.webmanifest" \
#   --exclude "icons/*"
#
# # Invalidate CloudFront cache
# aws cloudfront create-invalidation \
#   --distribution-id $DISTRIBUTION_ID \
#   --paths "/*"
# =============================================================================
