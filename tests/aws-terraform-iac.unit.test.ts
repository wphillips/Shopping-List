import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const infraDir = resolve(__dirname, '..', 'infra');

function readInfraFile(name: string): string {
  return readFileSync(resolve(infraDir, name), 'utf-8');
}

function readRootFile(name: string): string {
  return readFileSync(resolve(__dirname, '..', name), 'utf-8');
}

describe('S3 Bucket Configuration', () => {
  const s3 = readInfraFile('s3.tf');

  // Validates: 1.2
  it('has public access blocked (all four block settings true)', () => {
    expect(s3).toMatch(/block_public_acls\s*=\s*true/);
    expect(s3).toMatch(/block_public_policy\s*=\s*true/);
    expect(s3).toMatch(/ignore_public_acls\s*=\s*true/);
    expect(s3).toMatch(/restrict_public_buckets\s*=\s*true/);
  });

  // Validates: 1.3
  it('has versioning enabled', () => {
    expect(s3).toMatch(/status\s*=\s*"Enabled"/);
    expect(s3).toContain('aws_s3_bucket_versioning');
  });

  // Validates: 1.4
  it('has AES-256 encryption', () => {
    expect(s3).toMatch(/sse_algorithm\s*=\s*"AES256"/);
  });

  // Validates: 9.2
  it('has force_destroy set to false', () => {
    expect(s3).toMatch(/force_destroy\s*=\s*false/);
  });

  // Validates: 9.1
  it('lifecycle rule expires noncurrent versions after 30 days', () => {
    expect(s3).toContain('aws_s3_bucket_lifecycle_configuration');
    expect(s3).toMatch(/noncurrent_days\s*=\s*30/);
  });

  // Validates: 4.1, 4.2, 4.3
  it('bucket policy allows only CloudFront OAC principal', () => {
    expect(s3).toContain('cloudfront.amazonaws.com');
    expect(s3).toMatch(/actions\s*=\s*\["s3:GetObject"\]/);
    expect(s3).toContain('AWS:SourceArn');
    expect(s3).toContain('aws_cloudfront_distribution.website.arn');
  });
});

describe('CloudFront Distribution Configuration', () => {
  const cf = readInfraFile('cloudfront.tf');

  // Validates: 2.1
  it('origin points to S3 bucket', () => {
    expect(cf).toContain('aws_s3_bucket.website.bucket_regional_domain_name');
  });

  // Validates: 2.2
  it('uses Origin Access Control with signing_behavior = "always"', () => {
    expect(cf).toContain('aws_cloudfront_origin_access_control');
    expect(cf).toContain('origin_access_control_id');
    expect(cf).toMatch(/signing_behavior\s*=\s*"always"/);
  });

  // Validates: 2.3
  it('redirects HTTP to HTTPS', () => {
    expect(cf).toMatch(/viewer_protocol_policy\s*=\s*"redirect-to-https"/);
  });

  // Validates: 2.4
  it('default root object is index.html', () => {
    expect(cf).toMatch(/default_root_object\s*=\s*"index.html"/);
  });

  // Validates: 2.5
  it('custom error responses for 403/404 return /index.html with 200', () => {
    // Check 403 error response
    const error403 = cf.match(
      /custom_error_response\s*\{[^}]*error_code\s*=\s*403[^}]*\}/s
    );
    expect(error403).not.toBeNull();
    expect(error403![0]).toMatch(/response_code\s*=\s*200/);
    expect(error403![0]).toMatch(/response_page_path\s*=\s*"\/index\.html"/);

    // Check 404 error response
    const error404 = cf.match(
      /custom_error_response\s*\{[^}]*error_code\s*=\s*404[^}]*\}/s
    );
    expect(error404).not.toBeNull();
    expect(error404![0]).toMatch(/response_code\s*=\s*200/);
    expect(error404![0]).toMatch(/response_page_path\s*=\s*"\/index\.html"/);
  });

  // Validates: 2.7
  it('has compression enabled', () => {
    expect(cf).toMatch(/compress\s*=\s*true/);
  });

  // Validates: 8.1, 8.2
  it('viewer certificate minimum_protocol_version is TLSv1.2_2021', () => {
    expect(cf).toMatch(/minimum_protocol_version\s*=\s*"TLSv1\.2_2021"/);
  });
});

describe('CloudFront Cache Policies', () => {
  const cf = readInfraFile('cloudfront.tf');

  // Helper to extract a cache policy block by resource name
  function getCachePolicyBlock(resourceName: string): string {
    const regex = new RegExp(
      `resource\\s+"aws_cloudfront_cache_policy"\\s+"${resourceName}"\\s*\\{[^]*?\\n\\}`,
      's'
    );
    const match = cf.match(regex);
    expect(match).not.toBeNull();
    return match![0];
  }

  // Validates: 6.1
  it('/assets/* cache policy has TTL of 31536000', () => {
    const block = getCachePolicyBlock('assets_cache');
    expect(block).toMatch(/default_ttl\s*=\s*31536000/);
    expect(block).toMatch(/min_ttl\s*=\s*31536000/);
    expect(block).toMatch(/max_ttl\s*=\s*31536000/);
    // Verify the ordered_cache_behavior references this policy
    expect(cf).toMatch(/path_pattern\s*=\s*"\/assets\/\*"/);
  });

  // Validates: 6.2
  it('index.html cache policy has TTL of 0', () => {
    const block = getCachePolicyBlock('index_cache');
    expect(block).toMatch(/default_ttl\s*=\s*0/);
    expect(block).toMatch(/min_ttl\s*=\s*0/);
    expect(block).toMatch(/max_ttl\s*=\s*0/);
    expect(cf).toMatch(/path_pattern\s*=\s*"index\.html"/);
  });

  // Validates: 6.3
  it('sw.js cache policy has TTL of 0', () => {
    const block = getCachePolicyBlock('sw_cache');
    expect(block).toMatch(/default_ttl\s*=\s*0/);
    expect(block).toMatch(/min_ttl\s*=\s*0/);
    expect(block).toMatch(/max_ttl\s*=\s*0/);
    expect(cf).toMatch(/path_pattern\s*=\s*"sw\.js"/);
  });

  // Validates: 6.4
  it('manifest.webmanifest cache policy has TTL of 3600', () => {
    const block = getCachePolicyBlock('manifest_cache');
    expect(block).toMatch(/default_ttl\s*=\s*3600/);
    expect(block).toMatch(/min_ttl\s*=\s*3600/);
    expect(block).toMatch(/max_ttl\s*=\s*3600/);
    expect(cf).toMatch(/path_pattern\s*=\s*"manifest\.webmanifest"/);
  });

  // Validates: 6.5
  it('/icons/* cache policy has TTL of 604800', () => {
    const block = getCachePolicyBlock('icons_cache');
    expect(block).toMatch(/default_ttl\s*=\s*604800/);
    expect(block).toMatch(/min_ttl\s*=\s*604800/);
    expect(block).toMatch(/max_ttl\s*=\s*604800/);
    expect(cf).toMatch(/path_pattern\s*=\s*"\/icons\/\*"/);
  });

  it('default cache policy has TTL of 86400', () => {
    const block = getCachePolicyBlock('default_cache');
    expect(block).toMatch(/default_ttl\s*=\s*86400/);
    expect(block).toMatch(/min_ttl\s*=\s*86400/);
    expect(block).toMatch(/max_ttl\s*=\s*86400/);
  });
});

describe('CloudFront Security Response Headers', () => {
  const cf = readInfraFile('cloudfront.tf');

  // Validates: 7.1
  it('includes HSTS with max-age=31536000 and includeSubDomains', () => {
    expect(cf).toMatch(/access_control_max_age_sec\s*=\s*31536000/);
    expect(cf).toMatch(/include_subdomains\s*=\s*true/);
  });

  // Validates: 7.2
  it('includes X-Content-Type-Options nosniff', () => {
    expect(cf).toContain('content_type_options');
  });

  // Validates: 7.3
  it('includes X-Frame-Options DENY', () => {
    expect(cf).toMatch(/frame_option\s*=\s*"DENY"/);
  });

  // Validates: 7.4
  it('includes Referrer-Policy strict-origin-when-cross-origin', () => {
    expect(cf).toMatch(/referrer_policy\s*=\s*"strict-origin-when-cross-origin"/);
  });

  // Validates: 7.5
  it('response headers policy is attached to all cache behaviors', () => {
    // Count how many cache behaviors exist (default + ordered)
    const defaultBehaviors = cf.match(/default_cache_behavior\s*\{/g) || [];
    const orderedBehaviors = cf.match(/ordered_cache_behavior\s*\{/g) || [];
    const totalBehaviors = defaultBehaviors.length + orderedBehaviors.length;

    // Count how many times response_headers_policy_id is referenced in behaviors
    const policyRefs = cf.match(/response_headers_policy_id\s*=/g) || [];

    expect(totalBehaviors).toBeGreaterThan(0);
    expect(policyRefs.length).toBe(totalBehaviors);
  });
});

describe('ACM Certificate Configuration', () => {
  const acm = readInfraFile('acm.tf');

  // Validates: 3.2
  it('uses DNS validation', () => {
    expect(acm).toMatch(/validation_method\s*=\s*"DNS"/);
  });

  // Validates: 3.6
  it('is conditional on custom_domain', () => {
    expect(acm).toMatch(/count\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*1\s*:\s*0/);
  });

  // Validates: 3.1
  it('uses us_east_1 provider', () => {
    expect(acm).toMatch(/provider\s*=\s*aws\.us_east_1/);
  });
});

describe('Terraform Configuration Structure', () => {
  const variables = readInfraFile('variables.tf');
  const outputs = readInfraFile('outputs.tf');
  const providers = readInfraFile('providers.tf');

  // Validates: 5.1
  it('variables.tf contains all variable declarations', () => {
    expect(variables).toMatch(/variable\s+"bucket_prefix"/);
    expect(variables).toMatch(/variable\s+"custom_domain"/);
    expect(variables).toMatch(/variable\s+"environment"/);
    expect(variables).toMatch(/variable\s+"aws_region"/);
  });

  // Validates: 5.2
  it('outputs.tf contains all output declarations', () => {
    expect(outputs).toMatch(/output\s+"s3_bucket_name"/);
    expect(outputs).toMatch(/output\s+"s3_bucket_arn"/);
    expect(outputs).toMatch(/output\s+"cloudfront_distribution_id"/);
    expect(outputs).toMatch(/output\s+"cloudfront_domain_name"/);
    expect(outputs).toMatch(/output\s+"website_url"/);
    expect(outputs).toMatch(/output\s+"acm_certificate_arn"/);
    expect(outputs).toMatch(/output\s+"acm_validation_records"/);
  });

  // Validates: 5.3, 5.4, 5.5
  it('provider versions have minimum constraints', () => {
    expect(providers).toMatch(/required_version\s*=\s*">= 1\.0"/);
    expect(providers).toMatch(/version\s*=\s*">= 5\.0"/);
  });

  // Validates: 5.6
  it('terraform.tfvars.example file exists with documented variables', () => {
    const example = readInfraFile('terraform.tfvars.example');
    expect(example).toContain('bucket_prefix');
    expect(example).toContain('custom_domain');
    expect(example).toContain('environment');
    expect(example).toContain('aws_region');
  });
});

describe('Remote Backend Configuration', () => {
  const backend = readInfraFile('backend.tf');

  // Validates: 10.1, 10.2
  it('configures S3 remote backend with encryption enabled', () => {
    expect(backend).toContain('backend "s3"');
    expect(backend).toMatch(/encrypt\s*=\s*true/);
  });

  // Validates: 10.3
  it('configures DynamoDB for state locking', () => {
    expect(backend).toContain('dynamodb_table');
  });
});

describe('Version Control and Security', () => {
  // Validates: 10.4
  it('terraform.tfvars is listed in .gitignore', () => {
    const gitignore = readRootFile('.gitignore');
    expect(gitignore).toMatch(/\*\.tfvars/);
  });

  // Validates: 10.5
  it('terraform.tfvars.example contains placeholder values only', () => {
    const example = readInfraFile('terraform.tfvars.example');
    // Should contain generic placeholder values, not real credentials or domains
    expect(example).toContain('my-grocery-pwa');
    expect(example).toContain('example.com');
    // Should not contain real AWS account IDs or secrets
    expect(example).not.toMatch(/\d{12}/); // No 12-digit AWS account IDs
    expect(example).not.toMatch(/AKIA[A-Z0-9]{16}/); // No AWS access keys
  });
});
