# Implementation Plan: AWS Terraform Infrastructure for Grocery List PWA

## Overview

This plan implements Terraform infrastructure to host the Grocery List PWA on AWS. The implementation creates an S3 bucket for static hosting, CloudFront distribution for CDN delivery with HTTPS, optional ACM certificate for custom domains, and configures security headers, caching policies, and remote state management.

All Terraform files will be created in the `infra/` directory at the project root.

## Tasks

- [x] 1. Set up Terraform project structure and providers
  - [x] 1.1 Create infra/ directory and providers.tf with AWS provider configuration
    - Configure required Terraform version >= 1.0
    - Configure AWS provider version >= 5.0
    - Add us-east-1 provider alias for ACM certificates
    - _Requirements: 5.3, 5.4, 5.5_
  - [x] 1.2 Create variables.tf with all input variable declarations
    - Define bucket_prefix (required, with validation)
    - Define custom_domain (optional, with validation)
    - Define environment (optional, default "production")
    - Define aws_region (optional, default "us-east-1")
    - _Requirements: 5.1_
  - [x] 1.3 Create outputs.tf with all output declarations
    - Output s3_bucket_name, s3_bucket_arn
    - Output cloudfront_distribution_id, cloudfront_domain_name, website_url
    - Output acm_certificate_arn, acm_validation_records (conditional)
    - _Requirements: 5.2, 1.5, 2.8, 3.5_
  - [x] 1.4 Create terraform.tfvars.example with documented placeholder values
    - Include all configurable variables with example values
    - _Requirements: 5.6, 10.5_

- [x] 2. Implement S3 bucket for static hosting
  - [x] 2.1 Create s3.tf with S3 bucket resource
    - Create bucket with name derived from bucket_prefix variable
    - Set force_destroy = false
    - _Requirements: 1.1, 9.2_
  - [x] 2.2 Configure S3 bucket security settings
    - Enable versioning for rollback capability
    - Configure AES-256 server-side encryption
    - Block all public access (all four settings)
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.3 Configure S3 lifecycle rule
    - Expire noncurrent object versions after 30 days
    - _Requirements: 9.1_

- [x] 3. Checkpoint - Verify S3 configuration
  - Run `terraform validate` and `terraform plan` to verify S3 resources
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement CloudFront distribution
  - [x] 4.1 Create cloudfront.tf with Origin Access Control
    - Create OAC for secure S3 access
    - _Requirements: 2.2_
  - [x] 4.2 Create CloudFront response headers policy
    - Configure Strict-Transport-Security: max-age=31536000; includeSubDomains
    - Configure X-Content-Type-Options: nosniff
    - Configure X-Frame-Options: DENY
    - Configure Referrer-Policy: strict-origin-when-cross-origin
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 4.3 Create CloudFront cache policies for different asset types
    - /assets/* with TTL 1 year (31536000s)
    - index.html with TTL 0s
    - sw.js with TTL 0s
    - manifest.webmanifest with TTL 1 hour (3600s)
    - /icons/* with TTL 1 week (604800s)
    - Default TTL 1 day (86400s)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 4.4 Create CloudFront distribution resource
    - Configure S3 bucket as origin with OAC
    - Set default root object to index.html
    - Configure HTTP to HTTPS redirect
    - Enable gzip and brotli compression
    - Configure custom error responses (403/404 → /index.html with 200)
    - Attach response headers policy to all cache behaviors
    - Configure minimum TLS version TLSv1.2_2021
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 7.5, 8.1, 8.2_

- [x] 5. Implement S3 bucket policy for CloudFront access
  - [x] 5.1 Add S3 bucket policy to s3.tf
    - Allow only CloudFront distribution to read objects
    - Use OAC service principal
    - Deny all other access
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Checkpoint - Verify CloudFront configuration
  - Run `terraform validate` and `terraform plan` to verify CloudFront resources
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement ACM certificate (conditional)
  - [x] 7.1 Create acm.tf with conditional ACM certificate
    - Create certificate in us-east-1 region (using provider alias)
    - Configure DNS validation method
    - Only create when custom_domain variable is provided
    - _Requirements: 3.1, 3.2, 3.6_
  - [x] 7.2 Update CloudFront distribution for custom domain support
    - Associate ACM certificate with distribution (conditional)
    - Configure alternate domain name (conditional)
    - _Requirements: 3.3, 3.4_

- [x] 8. Configure remote backend for state security
  - [x] 8.1 Create backend.tf with S3 remote backend configuration
    - Configure S3 backend with encryption enabled
    - Configure DynamoDB table for state locking
    - Add comments explaining backend bucket/table must be pre-created
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 8.2 Verify .gitignore excludes terraform.tfvars
    - Confirm *.tfvars is in .gitignore (already present)
    - Confirm terraform.tfvars.example is not excluded
    - _Requirements: 10.4_

- [x] 9. Final checkpoint - Validate complete infrastructure
  - Run `terraform validate` to verify all configuration
  - Run `terraform plan` with example variables to verify resource creation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write tests for Terraform configuration
  - [x]* 10.1 Create aws-terraform-iac.unit.test.ts with unit tests
    - Test S3 bucket configuration (versioning, encryption, public access block)
    - Test CloudFront configuration (OAC, HTTPS redirect, compression, error responses)
    - Test cache behavior TTLs for each asset type
    - Test security response headers configuration
    - Test TLS minimum version configuration
    - Test lifecycle rule configuration
    - Test file structure (variables.tf, outputs.tf, terraform.tfvars.example)
    - _Requirements: 1.2, 1.3, 1.4, 2.1-2.8, 5.1-5.6, 6.1-6.5, 7.1-7.5, 8.1-8.2, 9.1-9.2, 10.1-10.5_
  - [x]* 10.2 Write property test for bucket name derivation
    - **Property 1: Bucket name derives from prefix**
    - Generate random valid bucket prefixes, verify bucket name contains prefix
    - **Validates: Requirements 1.1**
  - [x]* 10.3 Write property test for custom domain conditional logic
    - **Property 2: Custom domain conditional resource creation**
    - Verify ACM resources created only when custom_domain is provided
    - Verify CloudFront aliases configured only when custom_domain is provided
    - **Validates: Requirements 3.1, 3.4, 3.6**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The backend S3 bucket and DynamoDB table must be pre-created before running `terraform init`
- CloudFront distributions take 10-15 minutes to deploy/update
- ACM certificate validation requires manual DNS record creation unless using Route53
- All Terraform files are created in the `infra/` directory
