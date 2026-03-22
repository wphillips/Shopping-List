# Requirements Document

## Introduction

Migrate the grocery list PWA's CloudFront distribution from pay-as-you-go pricing to the AWS CloudFront Free flat-rate pricing plan ($0/month, no overage charges). The app serves 3-4 users with offline-first capability and minimal CloudFront usage, making the free plan ideal. This migration requires replacing custom cache policies with AWS managed policies, replacing the custom response headers policy with the managed SecurityHeadersPolicy, reducing cache behaviors to 5 or fewer, attaching a WAF Web ACL, setting Cache-Control headers on S3 objects during deployment, and updating the IAM policy for the Terraform apply user to include WAF permissions.

## Glossary

- **Distribution**: The AWS CloudFront distribution resource that serves the grocery list PWA to end users over HTTPS.
- **Managed_Cache_Policy**: An AWS-provided, read-only CloudFront cache policy (e.g., CachingOptimized, CachingDisabled) that cannot be customized. The free plan requires exclusive use of managed cache policies.
- **Managed_Response_Headers_Policy**: An AWS-provided, read-only CloudFront response headers policy (e.g., SecurityHeadersPolicy). The free plan requires exclusive use of managed response headers policies.
- **WAF_Web_ACL**: An AWS WAF Web Access Control List attached to the Distribution. Required by the free plan and included at no cost, with a maximum of 5 rules.
- **Cache_Behavior**: A CloudFront path-pattern-to-origin mapping with associated cache policy and response headers policy. The free plan allows a maximum of 5 cache behaviors (1 default + 4 ordered).
- **OAC**: Origin Access Control, the mechanism by which CloudFront authenticates requests to the S3 origin. Already in use and compatible with the free plan.
- **Terraform_Apply_User**: The IAM user whose credentials are used to run `terraform apply` against the infrastructure. Currently has S3 and CloudFront permissions only.
- **Cache_Control_Header**: An HTTP header set on S3 objects that instructs CloudFront (via managed CachingOptimized policy) how long to cache the object. Replaces the caching intent previously enforced by custom cache policies.
- **Deploy_Script**: The deployment process (manual or CI) that builds the app, syncs files to S3 with appropriate Cache-Control headers, and invalidates the CloudFront cache.

## Requirements

### Requirement 1: Replace Custom Cache Policies with Managed Cache Policies

**User Story:** As the infrastructure maintainer, I want to replace all 6 custom CloudFront cache policies with AWS managed cache policies, so that the distribution complies with the free plan's restriction against custom caching rules.

#### Acceptance Criteria

1. WHEN the Terraform configuration is applied, THE Distribution SHALL reference only Managed_Cache_Policies (CachingOptimized ID: `658327ea-f89d-4fab-a63d-7e88639e58f6` or CachingDisabled ID: `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`).
2. WHEN the Terraform configuration is applied, THE Terraform configuration SHALL contain zero `aws_cloudfront_cache_policy` resource blocks.
3. WHEN a Cache_Behavior serves content that requires origin-controlled caching (assets, icons, manifest, default), THE Cache_Behavior SHALL use the CachingOptimized Managed_Cache_Policy.
4. WHEN a Cache_Behavior serves content that must always be fresh (index.html, sw.js), THE Cache_Behavior SHALL use the CachingDisabled Managed_Cache_Policy.

### Requirement 2: Reduce Cache Behaviors to Free Plan Maximum

**User Story:** As the infrastructure maintainer, I want to reduce the number of cache behaviors from 6 to 5 or fewer, so that the distribution complies with the free plan's 5-behavior limit.

#### Acceptance Criteria

1. THE Distribution SHALL have at most 5 Cache_Behaviors (1 default + at most 4 ordered).
2. WHEN consolidating cache behaviors, THE Distribution SHALL retain dedicated ordered Cache_Behaviors for `/assets/*`, `index.html`, and `sw.js` paths because these have distinct caching requirements.
3. WHEN consolidating cache behaviors, THE Distribution SHALL absorb the `manifest.webmanifest` and `/icons/*` paths into the default Cache_Behavior because their caching intent can be preserved via Cache_Control_Headers on the S3 objects.
4. THE default Cache_Behavior SHALL use the CachingOptimized Managed_Cache_Policy to respect origin Cache_Control_Headers for manifest, icons, and other files.

### Requirement 3: Replace Custom Response Headers Policy with Managed Policy

**User Story:** As the infrastructure maintainer, I want to replace the custom response headers policy with the AWS managed SecurityHeadersPolicy, so that the distribution complies with the free plan's restriction against custom response header rules.

#### Acceptance Criteria

1. WHEN the Terraform configuration is applied, THE Distribution SHALL reference the managed SecurityHeadersPolicy (ID: `67f7725c-6f97-4210-82d7-5512b31e9d03`) on all Cache_Behaviors.
2. WHEN the Terraform configuration is applied, THE Terraform configuration SHALL contain zero `aws_cloudfront_response_headers_policy` resource blocks.
3. THE infrastructure maintainer SHALL accept the following security header behavioral differences from the managed SecurityHeadersPolicy compared to the previous custom policy:
   - HSTS: `includeSubDomains` removed, `override` changes from `true` to `false`
   - X-Frame-Options: changes from `DENY` to `SAMEORIGIN`, `override` changes to `false`
   - Referrer-Policy: `override` changes from `true` to `false`
   - X-Content-Type-Options: unchanged (`nosniff`, `override` `true`)
   - X-XSS-Protection: added (`1; mode=block`)

### Requirement 4: Attach WAF Web ACL to Distribution

**User Story:** As the infrastructure maintainer, I want to create and attach a WAF Web ACL to the CloudFront distribution, so that the distribution meets the free plan's mandatory WAF requirement.

#### Acceptance Criteria

1. WHEN the Terraform configuration is applied, THE Terraform configuration SHALL create an `aws_wafv2_web_acl` resource in the `us-east-1` region (required for CloudFront-scoped WAF).
2. THE WAF_Web_ACL SHALL have a default action of `allow` to permit all traffic (the app is a public PWA with 3-4 users).
3. THE WAF_Web_ACL SHALL contain at most 5 rules, complying with the free plan limit.
4. THE WAF_Web_ACL SHALL include an AWS managed rate-limiting rule that blocks source IPs exceeding 300 requests in a 5-minute evaluation window.
5. WHEN the Terraform configuration is applied, THE Distribution SHALL reference the WAF_Web_ACL via the `web_acl_id` attribute.
6. THE WAF_Web_ACL SHALL not be shared with any other CloudFront distribution, complying with the free plan constraint.

### Requirement 5: Set Cache-Control Headers on S3 Objects During Deployment

**User Story:** As the infrastructure maintainer, I want Cache-Control headers set on S3 objects during deployment, so that the CachingOptimized managed cache policy respects the intended caching durations for each file type.

#### Acceptance Criteria

1. WHEN deploying hashed asset files under `/assets/*`, THE Deploy_Script SHALL set the Cache_Control_Header to `public, max-age=31536000, immutable` (1 year).
2. WHEN deploying `index.html`, THE Deploy_Script SHALL set the Cache_Control_Header to `no-cache, no-store, must-revalidate` (always fresh).
3. WHEN deploying `sw.js`, THE Deploy_Script SHALL set the Cache_Control_Header to `no-cache, no-store, must-revalidate` (always fresh).
4. WHEN deploying `manifest.webmanifest`, THE Deploy_Script SHALL set the Cache_Control_Header to `public, max-age=3600` (1 hour).
5. WHEN deploying icon files under `/icons/*`, THE Deploy_Script SHALL set the Cache_Control_Header to `public, max-age=604800` (1 week).
6. WHEN deploying any other file not matching the above patterns, THE Deploy_Script SHALL set the Cache_Control_Header to `public, max-age=86400` (1 day).
7. THE requirements document SHALL include a reference deploy script example using `aws s3 sync` and `aws s3 cp` commands with `--cache-control` flags, so the maintainer can integrate it into the Deploy_Script.

### Requirement 6: Document IAM Policy for Terraform Apply User (Manual Step)

**User Story:** As the infrastructure maintainer, I want to know which AWS managed IAM policy to attach to the Terraform_Apply_User for WAF permissions, so that I can grant the necessary permissions manually before running `terraform apply`.

#### Acceptance Criteria

1. THE design document SHALL recommend attaching the AWS managed policy `AWSWAFFullAccess` (ARN: `arn:aws:iam::aws:policy/AWSWAFFullAccess`) to the Terraform_Apply_User. This managed policy covers all WAFv2 CRUD operations and CloudFront WAF association permissions needed by Terraform.
2. THE implementation tasks SHALL NOT automate IAM policy changes — the infrastructure maintainer will attach the managed policy manually before running `terraform apply`.
3. THE implementation tasks SHALL include a prerequisite step documenting that `AWSWAFFullAccess` must be attached to the Terraform_Apply_User before the Terraform changes can succeed.

### Requirement 7: Preserve Existing Compatible Configuration

**User Story:** As the infrastructure maintainer, I want to preserve all existing configuration that is already compatible with the free plan, so that the migration changes only what is necessary.

#### Acceptance Criteria

1. THE Distribution SHALL continue to use OAC for S3 origin access (already compatible with the free plan).
2. THE Distribution SHALL continue to support the conditional ACM certificate and custom domain alias when `custom_domain` is provided.
3. THE Distribution SHALL continue to serve `index.html` for 403 and 404 error responses (SPA routing).
4. THE Distribution SHALL continue to use `redirect-to-https` viewer protocol policy and `TLSv1.2_2021` minimum protocol version.
5. THE Distribution SHALL continue to have no geo restrictions.
6. THE Distribution SHALL continue to enable IPv6 and gzip compression.
