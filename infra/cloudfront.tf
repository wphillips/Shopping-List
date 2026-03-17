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

# Security Response Headers Policy
# Requirements: 7.1, 7.2, 7.3, 7.4
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.bucket_prefix}-security-headers"
  comment = "Security response headers for the grocery list PWA"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }
}

# CloudFront Cache Policies for different asset types
# Requirements: 6.1, 6.2, 6.3, 6.4, 6.5

# Cache policy for /assets/* - immutable hashed files (1 year TTL)
# Requirement: 6.1
resource "aws_cloudfront_cache_policy" "assets_cache" {
  name        = "${var.bucket_prefix}-assets-cache"
  comment     = "Cache policy for immutable hashed assets (1 year TTL)"
  min_ttl     = 31536000
  default_ttl = 31536000
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Cache policy for index.html - always fresh (0s TTL)
# Requirement: 6.2
resource "aws_cloudfront_cache_policy" "index_cache" {
  name        = "${var.bucket_prefix}-index-cache"
  comment     = "Cache policy for index.html (0s TTL - always fresh)"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Cache policy for sw.js - service worker must update immediately (0s TTL)
# Requirement: 6.3
resource "aws_cloudfront_cache_policy" "sw_cache" {
  name        = "${var.bucket_prefix}-sw-cache"
  comment     = "Cache policy for service worker (0s TTL - must update immediately)"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Cache policy for manifest.webmanifest (1 hour TTL)
# Requirement: 6.4
resource "aws_cloudfront_cache_policy" "manifest_cache" {
  name        = "${var.bucket_prefix}-manifest-cache"
  comment     = "Cache policy for PWA manifest (1 hour TTL)"
  min_ttl     = 3600
  default_ttl = 3600
  max_ttl     = 3600

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Cache policy for /icons/* (1 week TTL)
# Requirement: 6.5
resource "aws_cloudfront_cache_policy" "icons_cache" {
  name        = "${var.bucket_prefix}-icons-cache"
  comment     = "Cache policy for app icons (1 week TTL)"
  min_ttl     = 604800
  default_ttl = 604800
  max_ttl     = 604800

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Default cache policy (1 day TTL)
resource "aws_cloudfront_cache_policy" "default_cache" {
  name        = "${var.bucket_prefix}-default-cache"
  comment     = "Default cache policy (1 day TTL)"
  min_ttl     = 86400
  default_ttl = 86400
  max_ttl     = 86400

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# CloudFront Distribution
# Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 7.5, 8.1, 8.2
resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.bucket_prefix} grocery list PWA distribution"

  # S3 origin with OAC (Requirement 2.1, 2.2)
  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "s3-${aws_s3_bucket.website.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  # Default cache behavior (1 day TTL)
  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = aws_cloudfront_cache_policy.default_cache.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # /assets/* - immutable hashed files (1 year TTL) (Requirement 6.1)
  ordered_cache_behavior {
    path_pattern               = "/assets/*"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = aws_cloudfront_cache_policy.assets_cache.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # index.html - always fresh (0s TTL) (Requirement 6.2)
  ordered_cache_behavior {
    path_pattern               = "index.html"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = aws_cloudfront_cache_policy.index_cache.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # sw.js - service worker must update immediately (0s TTL) (Requirement 6.3)
  ordered_cache_behavior {
    path_pattern               = "sw.js"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = aws_cloudfront_cache_policy.sw_cache.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # manifest.webmanifest - infrequent changes (1 hour TTL) (Requirement 6.4)
  ordered_cache_behavior {
    path_pattern               = "manifest.webmanifest"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = aws_cloudfront_cache_policy.manifest_cache.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
  }

  # /icons/* - rarely change (1 week TTL) (Requirement 6.5)
  ordered_cache_behavior {
    path_pattern               = "/icons/*"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-${aws_s3_bucket.website.id}"
    cache_policy_id            = aws_cloudfront_cache_policy.icons_cache.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
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
