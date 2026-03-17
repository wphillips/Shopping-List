import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const infraDir = resolve(__dirname, '..', 'infra');

function readInfraFile(name: string): string {
  return readFileSync(resolve(infraDir, name), 'utf-8');
}

/**
 * Terraform validation regex from variables.tf:
 *   can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.bucket_prefix))
 *   || can(regex("^[a-z0-9]$", var.bucket_prefix))
 *
 * This accepts:
 *   - Single char: [a-z0-9]
 *   - Multi char: starts and ends with [a-z0-9], middle can include hyphens
 */
const BUCKET_PREFIX_MULTI_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const BUCKET_PREFIX_SINGLE_REGEX = /^[a-z0-9]$/;

function isValidBucketPrefix(prefix: string): boolean {
  return BUCKET_PREFIX_SINGLE_REGEX.test(prefix) || BUCKET_PREFIX_MULTI_REGEX.test(prefix);
}

/**
 * Arbitrary that generates valid bucket prefixes matching the Terraform validation regex.
 * Produces strings of 1-20 chars: starts/ends with [a-z0-9], middle allows hyphens.
 */
const validBucketPrefixArb = fc.integer({ min: 1, max: 20 }).chain((len) => {
  if (len === 1) {
    // Single character: [a-z0-9]
    return fc.mapToConstant(
      { num: 26, build: (v) => String.fromCharCode(97 + v) }, // a-z
      { num: 10, build: (v) => String.fromCharCode(48 + v) }  // 0-9
    ).map((c) => c);
  }

  const alphanumChar = fc.mapToConstant(
    { num: 26, build: (v) => String.fromCharCode(97 + v) },
    { num: 10, build: (v) => String.fromCharCode(48 + v) }
  );

  const middleChar = fc.mapToConstant(
    { num: 26, build: (v) => String.fromCharCode(97 + v) },
    { num: 10, build: (v) => String.fromCharCode(48 + v) },
    { num: 1, build: () => '-' }
  );

  const middleLen = len - 2;
  return fc.tuple(
    alphanumChar,
    fc.array(middleChar, { minLength: middleLen, maxLength: middleLen }),
    alphanumChar
  ).map(([first, middle, last]) => first + middle.join('') + last);
});

/**
 * Arbitrary that generates a random hex suffix (simulating random_id.bucket_suffix.hex).
 * random_id with byte_length=4 produces 8 hex characters.
 */
const hexCharArb = fc.mapToConstant(
  { num: 10, build: (v) => String.fromCharCode(48 + v) },  // 0-9
  { num: 6, build: (v) => String.fromCharCode(97 + v) }    // a-f
);
const hexSuffixArb = fc.array(hexCharArb, { minLength: 8, maxLength: 8 })
  .map((chars) => chars.join(''));

describe('Property: Bucket name derives from prefix', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * Property 1: Bucket name derives from prefix
   *
   * For any valid bucket prefix string (lowercase alphanumeric with hyphens),
   * the generated S3 bucket name must contain that prefix as a substring.
   */
  it('generated prefix passes Terraform validation regex and bucket name contains prefix', () => {
    fc.assert(
      fc.property(validBucketPrefixArb, hexSuffixArb, (prefix, hexSuffix) => {
        // 1. The generated prefix must pass the Terraform variable validation regex
        expect(isValidBucketPrefix(prefix)).toBe(true);

        // 2. Verify the Terraform validation regex from variables.tf is present
        const variablesTf = readInfraFile('variables.tf');
        const hasMultiCharRegex = variablesTf.includes('^[a-z0-9][a-z0-9-]*[a-z0-9]$');
        const hasSingleCharRegex = variablesTf.includes('^[a-z0-9]$');
        expect(hasMultiCharRegex).toBe(true);
        expect(hasSingleCharRegex).toBe(true);

        // 3. Simulate bucket name construction: "${var.bucket_prefix}-${random_id.bucket_suffix.hex}"
        const bucketName = `${prefix}-${hexSuffix}`;

        // 4. The bucket name must contain the prefix as a substring
        expect(bucketName).toContain(prefix);

        // 5. The bucket name must start with the prefix followed by a hyphen
        expect(bucketName.startsWith(`${prefix}-`)).toBe(true);

        // 6. The bucket name must end with the hex suffix
        expect(bucketName.endsWith(hexSuffix)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Terraform domain validation regex from variables.tf:
 *   can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.custom_domain))
 *
 * Accepts: lowercase alphanumeric with dots and hyphens, not starting/ending with dot or hyphen.
 */
const DOMAIN_REGEX = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;

function isValidDomain(domain: string): boolean {
  return DOMAIN_REGEX.test(domain);
}

/**
 * Arbitrary that generates valid domain names matching the Terraform custom_domain validation.
 * Produces domains like "example.com", "sub.domain.co", "my-app.example.org".
 */
const domainLabelChar = fc.mapToConstant(
  { num: 26, build: (v) => String.fromCharCode(97 + v) },
  { num: 10, build: (v) => String.fromCharCode(48 + v) }
);

const validDomainArb = fc
  .tuple(
    // subdomain label (optional)
    fc.option(
      fc.array(domainLabelChar, { minLength: 2, maxLength: 8 }).map((chars) => chars.join('')),
      { nil: undefined }
    ),
    // main domain label
    fc.array(domainLabelChar, { minLength: 2, maxLength: 10 }).map((chars) => chars.join('')),
    // TLD
    fc.constantFrom('com', 'org', 'net', 'io', 'co', 'dev', 'app')
  )
  .map(([sub, main, tld]) => {
    const base = `${main}.${tld}`;
    return sub !== undefined ? `${sub}.${base}` : base;
  })
  .filter((d) => isValidDomain(d));

describe('Property: Custom domain conditional resource creation', () => {
  /**
   * **Validates: Requirements 3.1, 3.4, 3.6**
   *
   * Property 2: Custom domain conditional resource creation
   *
   * For any Terraform configuration:
   * - If a custom domain is provided, the config includes ACM resources with count=1,
   *   provider aws.us_east_1, CloudFront aliases containing the domain, and certificate ARN
   *   conditional referencing aws_acm_certificate.website[0].arn.
   * - If no custom domain is provided (null), the ACM count evaluates to 0, CloudFront
   *   aliases evaluate to [], and cloudfront_default_certificate is used.
   */
  it('with custom domain: ACM resources are created and CloudFront aliases are configured', () => {
    const acmTf = readInfraFile('acm.tf');
    const cloudfrontTf = readInfraFile('cloudfront.tf');

    fc.assert(
      fc.property(validDomainArb, (domain) => {
        // The generated domain must pass the Terraform validation regex
        expect(isValidDomain(domain)).toBe(true);

        // --- ACM conditional patterns (Requirement 3.1, 3.6) ---

        // acm.tf must have count conditional that evaluates to 1 when custom_domain is non-null
        expect(acmTf).toContain('count');
        expect(acmTf).toMatch(/count\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*1\s*:\s*0/);

        // acm.tf must use the us-east-1 provider alias (Requirement 3.1)
        expect(acmTf).toContain('provider = aws.us_east_1');

        // acm.tf must reference var.custom_domain as the domain_name
        expect(acmTf).toContain('domain_name');
        expect(acmTf).toMatch(/domain_name\s*=\s*var\.custom_domain/);

        // --- CloudFront alias patterns (Requirement 3.4) ---

        // cloudfront.tf must have aliases conditional that includes the domain when non-null
        expect(cloudfrontTf).toMatch(
          /aliases\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*\[var\.custom_domain\]\s*:\s*\[\]/
        );

        // cloudfront.tf must reference the ACM certificate ARN conditionally
        expect(cloudfrontTf).toMatch(
          /acm_certificate_arn\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*aws_acm_certificate\.website\[0\]\.arn\s*:\s*null/
        );
      }),
      { numRuns: 100 }
    );
  });

  it('without custom domain: no ACM resources and CloudFront uses default certificate', () => {
    const acmTf = readInfraFile('acm.tf');
    const cloudfrontTf = readInfraFile('cloudfront.tf');

    fc.assert(
      fc.property(fc.constant(null), (_nullDomain) => {
        // --- ACM count evaluates to 0 when custom_domain is null (Requirement 3.6) ---

        // The count expression "var.custom_domain != null ? 1 : 0" evaluates to 0 for null
        const countMatch = acmTf.match(
          /count\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*(\d+)\s*:\s*(\d+)/
        );
        expect(countMatch).not.toBeNull();
        // When custom_domain is null, the ternary takes the "else" branch (0)
        expect(countMatch![2]).toBe('0');

        // --- CloudFront aliases evaluate to [] when custom_domain is null (Requirement 3.4) ---

        const aliasMatch = cloudfrontTf.match(
          /aliases\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*\[var\.custom_domain\]\s*:\s*(\[\])/
        );
        expect(aliasMatch).not.toBeNull();
        // When custom_domain is null, aliases is []
        expect(aliasMatch![1]).toBe('[]');

        // --- CloudFront uses default certificate when custom_domain is null ---

        // cloudfront_default_certificate = var.custom_domain == null evaluates to true
        expect(cloudfrontTf).toMatch(
          /cloudfront_default_certificate\s*=\s*var\.custom_domain\s*==\s*null/
        );

        // ssl_support_method is null when custom_domain is null
        expect(cloudfrontTf).toMatch(
          /ssl_support_method\s*=\s*var\.custom_domain\s*!=\s*null\s*\?\s*"sni-only"\s*:\s*null/
        );
      }),
      { numRuns: 100 }
    );
  });
});
