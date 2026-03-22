# WAF Web ACL for CloudFront Distribution
# Requirements: 4.1, 4.2, 4.3, 4.4, 4.6

resource "aws_wafv2_web_acl" "cloudfront" {
  provider = aws.us_east_1
  name     = "${var.bucket_prefix}-cloudfront-waf"
  scope    = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 300
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.bucket_prefix}-rate-limit"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.bucket_prefix}-waf"
  }

  tags = {
    Name        = "${var.bucket_prefix}-cloudfront-waf"
    Environment = var.environment
  }
}
