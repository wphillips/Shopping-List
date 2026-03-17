# Input Variable Declarations
# Requirements: 5.1

variable "bucket_prefix" {
  type        = string
  description = "Prefix for the S3 bucket name. Will be combined with a random suffix."

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.bucket_prefix)) || can(regex("^[a-z0-9]$", var.bucket_prefix))
    error_message = "Bucket prefix must be lowercase alphanumeric with hyphens, not starting or ending with hyphen."
  }
}

variable "custom_domain" {
  type        = string
  default     = null
  description = "Custom domain name for CloudFront. If null, uses default CloudFront domain."

  validation {
    condition     = var.custom_domain == null || can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.custom_domain))
    error_message = "Custom domain must be a valid domain name."
  }
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Environment name for resource tagging."
}

variable "aws_region" {
  type        = string
  default     = "us-west-2"
  description = "AWS region for S3 bucket. CloudFront is global."
}
