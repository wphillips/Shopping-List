# CloudFront Distribution Configuration
# Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 7.1-7.5, 8.1, 8.2

# Origin Access Control for secure S3 access
# Requirement: 2.2
resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.bucket_prefix}-oac"
  description                       = "Origin Access Control for S3 website bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
# Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 7.5, 8.1, 8.2
resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.bucket_prefix} grocery list PWA distribution"
  web_acl_id          = aws_wafv2_web_acl.cloudfront.arn

  # S3 origin with OAC (Requirement 2.1, 2.2)
  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  # Default cache behavior — CachingOptimized respects origin Cache-Control headers
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed CachingOptimized
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # Managed SecurityHeadersPolicy
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # /assets/* - immutable hashed files, cached at edge via CachingOptimized + origin Cache-Control
  ordered_cache_behavior {
    path_pattern               = "/assets/*"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed CachingOptimized
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # Managed SecurityHeadersPolicy
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # index.html - always fresh, bypasses cache entirely
  ordered_cache_behavior {
    path_pattern               = "index.html"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed CachingDisabled
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # Managed SecurityHeadersPolicy
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # sw.js - service worker must update immediately, bypasses cache entirely
  ordered_cache_behavior {
    path_pattern               = "sw.js"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed CachingDisabled
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # Managed SecurityHeadersPolicy
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # SPA routing: serve index.html for 403/404 errors (Requirement 2.5)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  # Custom domain alias (Requirements 3.3, 3.4)
  aliases = var.custom_domain != null ? [var.custom_domain] : []

  # Restrictions - no geo restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # TLS configuration (Requirements 3.3, 3.4, 8.1, 8.2)
  viewer_certificate {
    acm_certificate_arn            = var.custom_domain != null ? aws_acm_certificate.website[0].arn : null
    cloudfront_default_certificate = var.custom_domain == null
    ssl_support_method             = var.custom_domain != null ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name        = "${var.bucket_prefix}-distribution"
    Environment = var.environment
  }
}
