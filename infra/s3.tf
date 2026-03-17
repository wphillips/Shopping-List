# S3 Bucket Configuration for Static Website Hosting
# Requirements: 1.1, 1.2, 1.3, 1.4, 9.1, 9.2

# Random suffix for unique bucket name
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Main S3 bucket for website hosting
# Requirements: 1.1, 9.2
resource "aws_s3_bucket" "website" {
  bucket        = "${var.bucket_prefix}-${random_id.bucket_suffix.hex}"
  force_destroy = false

  tags = {
    Name        = "${var.bucket_prefix}-website"
    Environment = var.environment
  }
}

# Enable versioning for rollback capability
# Requirement: 1.3
resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Configure AES-256 server-side encryption
# Requirement: 1.4
resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all public access
# Requirement: 1.2
resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rule to expire noncurrent object versions after 30 days
# Requirement: 9.1
resource "aws_s3_bucket_lifecycle_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# S3 bucket policy - allow only CloudFront OAC to read objects
# Requirements: 4.1, 4.2, 4.3
data "aws_iam_policy_document" "website_bucket_policy" {
  statement {
    sid    = "AllowCloudFrontOACRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.website.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.website.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id
  policy = data.aws_iam_policy_document.website_bucket_policy.json
}
