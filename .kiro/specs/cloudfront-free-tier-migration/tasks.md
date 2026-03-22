# Implementation Plan: CloudFront Free Tier Migration

## Overview

Migrate the CloudFront distribution from pay-as-you-go to the free plan by replacing custom policies with managed policies, reducing cache behaviors to 5, creating a WAF Web ACL, and documenting Cache-Control headers for the deploy script. All Terraform changes are in `infra/`, tests use vitest + fast-check in `tests/`.

## Prerequisites

- **IAM Manual Step (Requirement 6):** Before running `terraform apply`, attach the AWS managed policy `AWSWAFFullAccess` (ARN: `arn:aws:iam::aws:policy/AWSWAFFullAccess`) to the Terraform apply user. This is a manual step — do NOT automate it.

## Tasks

- [x] 1. Create WAF Web ACL resource
  - [x] 1.1 Create `infra/waf.tf` with `aws_wafv2_web_acl` resource
    - Use `provider = aws.us_east_1`, `scope = "CLOUDFRONT"`, `default_action { allow {} }`
    - Add a single rate-based rule: `limit = 300`, `aggregate_key_type = "IP"`, `action { block {} }`
    - Include `visibility_config` blocks and tags using `var.bucket_prefix` and `var.environment`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [ ]* 1.2 Write unit tests for WAF configuration
    - Verify `aws_wafv2_web_acl` resource exists with correct provider, scope, and default action
    - Verify rate-based rule with limit 300 exists
    - Verify at most 5 `rule` blocks
    - Verify no `aws_iam` resource blocks exist in any `.tf` file (Requirement 6.2)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.2_

- [x] 2. Migrate cloudfront.tf to managed policies and reduced behaviors
  - [x] 2.1 Remove all custom cache policy and response headers policy resource blocks
    - Delete all 6 `aws_cloudfront_cache_policy` resource blocks (`assets_cache`, `index_cache`, `sw_cache`, `manifest_cache`, `icons_cache`, `default_cache`)
    - Delete the `aws_cloudfront_response_headers_policy.security_headers` resource block
    - _Requirements: 1.2, 3.2_

  - [x] 2.2 Update cache behaviors to use managed policies and reduce to 5
    - Replace `cache_policy_id` in default behavior with CachingOptimized ID `658327ea-f89d-4fab-a63d-7e88639e58f6`
    - Replace `cache_policy_id` in `/assets/*` behavior with CachingOptimized ID
    - Replace `cache_policy_id` in `index.html` and `sw.js` behaviors with CachingDisabled ID `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`
    - Replace all `response_headers_policy_id` references with SecurityHeadersPolicy ID `67f7725c-6f97-4210-82d7-5512b31e9d03`
    - Remove the `manifest.webmanifest` ordered cache behavior entirely
    - Remove the `/icons/*` ordered cache behavior entirely
    - Result: 1 default + 3 ordered = 4 total behaviors (within the 5 max)
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1_

  - [x] 2.3 Attach WAF Web ACL to the CloudFront distribution
    - Add `web_acl_id = aws_wafv2_web_acl.cloudfront.arn` to the `aws_cloudfront_distribution.website` resource
    - _Requirements: 4.5_

  - [ ]* 2.4 Write property test: All cache behaviors use only managed policies (Property 1)
    - **Property 1: All cache behaviors use only managed policies**
    - Parse all cache behavior blocks from `cloudfront.tf`, generate random selections, verify each references only managed cache policy IDs and the managed SecurityHeadersPolicy ID
    - **Validates: Requirements 1.1, 3.1**

  - [ ]* 2.5 Write property test: No custom policy resource blocks exist (Property 2)
    - **Property 2: No custom policy resource blocks exist**
    - Read all `.tf` files from `infra/`, verify none contain `aws_cloudfront_cache_policy` or `aws_cloudfront_response_headers_policy` resource blocks
    - **Validates: Requirements 1.2, 3.2**

  - [ ]* 2.6 Write property test: All cache behaviors enforce HTTPS redirect (Property 3)
    - **Property 3: All cache behaviors enforce viewer HTTPS redirect**
    - Parse all cache behavior blocks from `cloudfront.tf`, generate random selections, verify each has `viewer_protocol_policy = "redirect-to-https"`
    - **Validates: Requirements 7.4**

  - [ ]* 2.7 Write unit tests for migrated cloudfront.tf
    - Verify exactly 3 `ordered_cache_behavior` blocks exist (was 5, now 3)
    - Verify `/assets/*`, `index.html`, and `sw.js` path patterns are retained (Requirement 2.2)
    - Verify no `manifest.webmanifest` or `/icons/*` ordered behaviors exist (Requirement 2.3)
    - Verify default behavior uses CachingOptimized (Requirement 2.4)
    - Verify `web_acl_id` references the WAF resource (Requirement 4.5)
    - Verify OAC, custom_error_response blocks, geo_restriction "none", is_ipv6_enabled, compress, minimum_protocol_version remain unchanged (Requirements 7.1–7.6)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 3. Checkpoint - Verify Terraform changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update outputs and add deploy script reference
  - [x] 4.1 Add WAF output to `infra/outputs.tf`
    - Add `waf_web_acl_arn` output referencing `aws_wafv2_web_acl.cloudfront.arn`
    - _Requirements: 4.5_

  - [x] 4.2 Add deploy script reference as a comment block in `infra/outputs.tf`
    - Document `aws s3 sync` / `aws s3 cp` commands with `--cache-control` flags for each file pattern:
      - `/assets/*`: `public, max-age=31536000, immutable`
      - `index.html`: `no-cache, no-store, must-revalidate`
      - `sw.js`: `no-cache, no-store, must-revalidate`
      - `manifest.webmanifest`: `public, max-age=3600`
      - `/icons/*`: `public, max-age=604800`
      - Everything else: `public, max-age=86400`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 4.3 Write unit tests for outputs
    - Verify `waf_web_acl_arn` output exists in `outputs.tf`
    - Verify deploy script reference documents all 6 Cache-Control patterns
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 5. Update existing tests for compatibility
  - [x] 5.1 Update `tests/aws-terraform-iac.unit.test.ts` to reflect the migration
    - Update or remove tests that reference custom cache policies (they no longer exist)
    - Update or remove tests that reference the custom response headers policy
    - Update behavior count expectations (was 6, now 4)
    - Update security headers tests to verify managed SecurityHeadersPolicy ID instead of custom policy attributes
    - _Requirements: 1.2, 2.1, 3.1, 3.2_

  - [x] 5.2 Update `tests/aws-terraform-iac.properties.test.ts` for compatibility
    - Ensure existing property tests still pass against the modified `cloudfront.tf`
    - Update any assertions that depend on removed custom cache policy blocks
    - _Requirements: 7.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Requirement 6 (IAM) is a manual prerequisite — not automated in Terraform
- The design specifies HCL for Terraform files and TypeScript for tests (vitest + fast-check)
- Property tests validate universal correctness properties from the design document
- Existing tests in `aws-terraform-iac.unit.test.ts` and `aws-terraform-iac.properties.test.ts` must be updated since they assert against the current (pre-migration) configuration
