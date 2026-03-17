# ACM Certificate Configuration (Conditional)
# Requirements: 3.1, 3.2, 3.6

# SSL/TLS certificate in us-east-1 (required for CloudFront)
# Only created when a custom domain is provided
# Requirements: 3.1, 3.2, 3.6
resource "aws_acm_certificate" "website" {
  count    = var.custom_domain != null ? 1 : 0
  provider = aws.us_east_1

  domain_name       = var.custom_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.bucket_prefix}-certificate"
    Environment = var.environment
  }
}
