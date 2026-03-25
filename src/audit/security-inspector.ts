import { readFile, readdir } from 'fs/promises';
import { resolve, join } from 'path';
import type { Finding } from './types';
import { createFinding } from './utils';

/** Sensitive data patterns for localStorage checks. */
const SENSITIVE_PATTERNS = [
  /localStorage\.\w+\s*\(\s*['"`].*(?:token|auth|credential|password|secret|session|jwt|api[_-]?key).*['"`]/i,
  /localStorage\.\w+\s*\(\s*['"`].*(?:access[_-]?token|refresh[_-]?token|id[_-]?token).*['"`]/i,
];

/** Credential/token patterns for service worker caching checks. */
const SW_CREDENTIAL_PATTERNS = [
  /token/i,
  /credential/i,
  /password/i,
  /secret/i,
  /auth/i,
  /session/i,
  /jwt/i,
  /api[_-]?key/i,
  /Authorization/i,
];

/**
 * Scan a file's content for innerHTML assignments and return findings.
 * Pure function — no filesystem access.
 */
export function checkInnerHtmlUsage(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match innerHTML assignments: .innerHTML = or .innerHTML +=
    if (/\.innerHTML\s*[+]?=/.test(line)) {
      // Check if the value is a static string (emoji, simple HTML) vs dynamic content
      const isTemplateLiteral = /\.innerHTML\s*[+]?=\s*`/.test(line);
      const isStaticString = /\.innerHTML\s*[+]?=\s*['"]/.test(line);
      const isDynamic = isTemplateLiteral || !isStaticString;
      const hasEscaping = content.substring(Math.max(0, content.indexOf(line) - 200), content.indexOf(line) + line.length + 200).includes('escapeHtml');

      let severity: 'High' | 'Medium' | 'Low';
      let riskDescription: string;

      if (hasEscaping) {
        severity = 'Low';
        riskDescription = 'innerHTML assignment with escapeHtml mitigation detected. Risk is mitigated but consider using textContent or DOM APIs instead.';
      } else if (isDynamic) {
        severity = 'High';
        riskDescription = 'innerHTML assignment with dynamic content (template literal or variable). This is a potential XSS injection vector.';
      } else {
        severity = 'Medium';
        riskDescription = 'innerHTML assignment with static content. While lower risk, prefer textContent or DOM APIs to avoid accidental injection.';
      }

      findings.push(
        createFinding({
          category: 'Security',
          severity,
          title: `innerHTML assignment in ${filePath}`,
          description: `Line ${i + 1}: ${riskDescription}`,
          filePaths: [filePath],
          lineRanges: [`${i + 1}`],
          recommendation:
            'Replace innerHTML with safer DOM APIs (textContent, createElement, appendChild) or use a sanitization library like DOMPurify.',
          requirementRef: 'Req 3.2',
        })
      );
    }
  }

  return findings;
}

/**
 * Check service worker content for credential/token caching.
 * Pure function — operates on the SW source string.
 */
export function checkServiceWorkerSecurity(swContent: string): Finding[] {
  const findings: Finding[] = [];

  // Check if the cached asset list references any credential-like paths
  const cacheArrayMatch = swContent.match(/(?:ASSETS_TO_CACHE|STATIC_ASSETS|BUILT_ASSETS)\s*=\s*\[([^\]]*)\]/gs);
  let cachesCredentials = false;

  if (cacheArrayMatch) {
    for (const match of cacheArrayMatch) {
      for (const pattern of SW_CREDENTIAL_PATTERNS) {
        if (pattern.test(match)) {
          cachesCredentials = true;
          break;
        }
      }
    }
  }

  // Check if the fetch handler stores credentials in cache
  const hasFetchHandler = /addEventListener\s*\(\s*['"]fetch['"]/.test(swContent);
  const hasCachePut = /cache\.put\s*\(/.test(swContent);
  const hasAuthorizationFilter = /Authorization/i.test(swContent);

  if (hasFetchHandler && hasCachePut && !hasAuthorizationFilter) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Medium',
        title: 'Service worker caches all network responses without filtering',
        description:
          'The service worker fetch handler caches network responses without checking for sensitive content. ' +
          'If the app ever makes authenticated API requests, tokens or credentials could be cached.',
        filePaths: ['public/sw.js'],
        recommendation:
          'Add a check in the fetch handler to exclude responses containing Authorization headers or sensitive API endpoints from the cache.',
        requirementRef: 'Req 3.3',
      })
    );
  }

  if (cachesCredentials) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'High',
        title: 'Service worker caches credential-related assets',
        description:
          'The service worker cache list contains references to credential or token-related resources.',
        filePaths: ['public/sw.js'],
        recommendation:
          'Remove any credential or token-related URLs from the service worker cache list. Sensitive data should never be cached by the service worker.',
        requirementRef: 'Req 3.3',
      })
    );
  }

  if (findings.length === 0) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Service worker credential caching — no direct issues found',
        description:
          'The service worker does not directly cache credentials or tokens in its static asset list. ' +
          'However, the fetch handler does cache network responses which could include sensitive data if the app evolves to use authenticated APIs.',
        filePaths: ['public/sw.js'],
        recommendation:
          'Consider adding explicit exclusion logic in the fetch handler for any future authenticated endpoints.',
        requirementRef: 'Req 3.3',
      })
    );
  }

  return findings;
}

/**
 * Check CloudFront Terraform config for HTTPS-only viewer protocol policy.
 * Pure function — operates on the .tf file content string.
 */
export function checkCloudFrontHttps(tfContent: string): Finding[] {
  const findings: Finding[] = [];

  // Find all viewer_protocol_policy values
  const policyMatches = [...tfContent.matchAll(/viewer_protocol_policy\s*=\s*"([^"]+)"/g)];

  if (policyMatches.length === 0) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'High',
        title: 'No viewer_protocol_policy found in CloudFront configuration',
        description:
          'The CloudFront distribution does not specify a viewer_protocol_policy. This may allow HTTP access.',
        filePaths: ['infra/cloudfront.tf'],
        recommendation:
          'Add viewer_protocol_policy = "redirect-to-https" to all cache behaviors in the CloudFront distribution.',
        requirementRef: 'Req 3.4',
      })
    );
    return findings;
  }

  for (const match of policyMatches) {
    const policy = match[1];
    if (policy !== 'redirect-to-https' && policy !== 'https-only') {
      findings.push(
        createFinding({
          category: 'Security',
          severity: 'High',
          title: `CloudFront viewer protocol policy is "${policy}" instead of "redirect-to-https"`,
          description:
            `A cache behavior uses viewer_protocol_policy = "${policy}", which may allow unencrypted HTTP access.`,
          filePaths: ['infra/cloudfront.tf'],
          recommendation:
            'Change viewer_protocol_policy to "redirect-to-https" to enforce HTTPS for all viewers.',
          requirementRef: 'Req 3.4',
        })
      );
    }
  }

  if (findings.length === 0) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'CloudFront enforces HTTPS — all behaviors use redirect-to-https',
        description:
          `All ${policyMatches.length} cache behavior(s) enforce HTTPS via redirect-to-https or https-only policy.`,
        filePaths: ['infra/cloudfront.tf'],
        recommendation: 'No action needed. HTTPS enforcement is correctly configured.',
        requirementRef: 'Req 3.4',
      })
    );
  }

  return findings;
}

/**
 * Check S3 Terraform config for public access block (all four flags must be true).
 * Pure function — operates on the .tf file content string.
 */
export function checkS3PublicAccess(tfContent: string): Finding[] {
  const findings: Finding[] = [];

  const requiredFlags = [
    'block_public_acls',
    'block_public_policy',
    'ignore_public_acls',
    'restrict_public_buckets',
  ];

  // Check for the public_access_block resource
  const hasPublicAccessBlock = /aws_s3_bucket_public_access_block/.test(tfContent);

  if (!hasPublicAccessBlock) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Critical',
        title: 'S3 bucket missing public access block',
        description:
          'No aws_s3_bucket_public_access_block resource found. The S3 bucket may be publicly accessible.',
        filePaths: ['infra/s3.tf'],
        recommendation:
          'Add an aws_s3_bucket_public_access_block resource with all four flags set to true.',
        requirementRef: 'Req 3.5',
      })
    );
    return findings;
  }

  const missingOrFalse: string[] = [];

  for (const flag of requiredFlags) {
    const flagRegex = new RegExp(`${flag}\\s*=\\s*(true|false)`);
    const match = tfContent.match(flagRegex);

    if (!match) {
      missingOrFalse.push(`${flag} (missing)`);
    } else if (match[1] !== 'true') {
      missingOrFalse.push(`${flag} (set to false)`);
    }
  }

  if (missingOrFalse.length > 0) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Critical',
        title: 'S3 public access block is incomplete',
        description:
          `The following public access block flags are not properly configured: ${missingOrFalse.join(', ')}. ` +
          'This may allow public access to the S3 bucket.',
        filePaths: ['infra/s3.tf'],
        recommendation:
          'Set all four public access block flags to true: block_public_acls, block_public_policy, ignore_public_acls, restrict_public_buckets.',
        requirementRef: 'Req 3.5',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'S3 public access block is correctly configured',
        description:
          'All four public access block flags (block_public_acls, block_public_policy, ignore_public_acls, restrict_public_buckets) are set to true.',
        filePaths: ['infra/s3.tf'],
        recommendation: 'No action needed. S3 public access is properly blocked.',
        requirementRef: 'Req 3.5',
      })
    );
  }

  return findings;
}

/**
 * Check WAF Terraform config for rate-limiting rule.
 * Pure function — operates on the .tf file content string.
 */
export function checkWafRateLimiting(tfContent: string): Finding[] {
  const findings: Finding[] = [];

  const hasWafAcl = /aws_wafv2_web_acl/.test(tfContent);

  if (!hasWafAcl) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'High',
        title: 'No WAF Web ACL found',
        description:
          'No aws_wafv2_web_acl resource found in the WAF configuration. The CloudFront distribution is not protected by a WAF.',
        filePaths: ['infra/waf.tf'],
        recommendation:
          'Add an aws_wafv2_web_acl resource with at least a rate-limiting rule to protect against DDoS and brute-force attacks.',
        requirementRef: 'Req 3.6',
      })
    );
    return findings;
  }

  const hasRateBasedStatement = /rate_based_statement/.test(tfContent);

  if (!hasRateBasedStatement) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'High',
        title: 'WAF missing rate-limiting rule',
        description:
          'The WAF Web ACL exists but does not contain a rate_based_statement rule. The distribution is not protected against rate-based attacks.',
        filePaths: ['infra/waf.tf'],
        recommendation:
          'Add a rate_based_statement rule to the WAF Web ACL to limit request rates per IP.',
        requirementRef: 'Req 3.6',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'WAF rate-limiting rule is configured',
        description:
          'The WAF Web ACL includes a rate_based_statement rule for rate limiting.',
        filePaths: ['infra/waf.tf'],
        recommendation: 'No action needed. WAF rate limiting is properly configured.',
        requirementRef: 'Req 3.6',
      })
    );
  }

  return findings;
}

/**
 * Check localStorage usage for sensitive data (auth tokens, credentials).
 * Pure function — operates on the source file content string.
 */
export function checkLocalStorageSensitiveData(content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(line)) {
        findings.push(
          createFinding({
            category: 'Security',
            severity: 'Critical',
            title: 'Sensitive data stored in localStorage',
            description:
              `Line ${i + 1}: localStorage is used to store what appears to be sensitive data (tokens, credentials, or secrets). ` +
              'localStorage is accessible to any JavaScript running on the page and is vulnerable to XSS attacks.',
            filePaths: ['src/storage.ts'],
            lineRanges: [`${i + 1}`],
            recommendation:
              'Move sensitive data to httpOnly cookies or use a secure session management approach. Never store authentication tokens in localStorage.',
            requirementRef: 'Req 3.8',
          })
        );
        break; // One finding per line is enough
      }
    }
  }

  if (findings.length === 0) {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'No sensitive data found in localStorage usage',
        description:
          'The localStorage usage in src/storage.ts does not appear to store authentication tokens, credentials, or secrets. ' +
          'It stores application state (grocery list data) which is appropriate for localStorage.',
        filePaths: ['src/storage.ts'],
        recommendation: 'No action needed. Continue to avoid storing sensitive data in localStorage.',
        requirementRef: 'Req 3.8',
      })
    );
  }

  return findings;
}

/**
 * Recursively find all .ts files under a directory.
 */
async function findTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Read a file safely, returning null if it doesn't exist or can't be read.
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Main entry point: run all security checks and return findings.
 * Scans source files for innerHTML, checks service worker, infra configs,
 * and localStorage usage.
 */
export async function inspectSecurity(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Scan all TypeScript files under src/ for innerHTML assignments
  try {
    const tsFiles = await findTsFiles('src');
    for (const filePath of tsFiles) {
      const content = await safeReadFile(filePath);
      if (content) {
        findings.push(...checkInnerHtmlUsage(filePath, content));
      }
    }
  } catch {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Unable to scan source files for innerHTML usage',
        description: 'Failed to glob or read TypeScript source files under src/.',
        filePaths: ['src/'],
        recommendation: 'Verify that the src/ directory exists and is readable, then re-run the audit.',
        requirementRef: 'Req 3.2',
      })
    );
  }

  // 2. Check service worker for credential caching
  const swContent = await safeReadFile(resolve('public/sw.js'));
  if (swContent) {
    findings.push(...checkServiceWorkerSecurity(swContent));
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Unable to read service worker file',
        description: 'Could not read public/sw.js. Service worker credential caching check was skipped.',
        filePaths: ['public/sw.js'],
        recommendation: 'Verify that public/sw.js exists and is readable.',
        requirementRef: 'Req 3.3',
      })
    );
  }

  // 3. Check CloudFront HTTPS enforcement
  const cfContent = await safeReadFile(resolve('infra/cloudfront.tf'));
  if (cfContent) {
    findings.push(...checkCloudFrontHttps(cfContent));
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Unable to read CloudFront configuration',
        description: 'Could not read infra/cloudfront.tf. HTTPS enforcement check was skipped.',
        filePaths: ['infra/cloudfront.tf'],
        recommendation: 'Verify that infra/cloudfront.tf exists and is readable.',
        requirementRef: 'Req 3.4',
      })
    );
  }

  // 4. Check S3 public access block
  const s3Content = await safeReadFile(resolve('infra/s3.tf'));
  if (s3Content) {
    findings.push(...checkS3PublicAccess(s3Content));
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Unable to read S3 configuration',
        description: 'Could not read infra/s3.tf. S3 public access block check was skipped.',
        filePaths: ['infra/s3.tf'],
        recommendation: 'Verify that infra/s3.tf exists and is readable.',
        requirementRef: 'Req 3.5',
      })
    );
  }

  // 5. Check WAF rate-limiting
  const wafContent = await safeReadFile(resolve('infra/waf.tf'));
  if (wafContent) {
    findings.push(...checkWafRateLimiting(wafContent));
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Unable to read WAF configuration',
        description: 'Could not read infra/waf.tf. WAF rate-limiting check was skipped.',
        filePaths: ['infra/waf.tf'],
        recommendation: 'Verify that infra/waf.tf exists and is readable.',
        requirementRef: 'Req 3.6',
      })
    );
  }

  // 6. Check localStorage for sensitive data
  const storageContent = await safeReadFile(resolve('src/storage.ts'));
  if (storageContent) {
    findings.push(...checkLocalStorageSensitiveData(storageContent));
  } else {
    findings.push(
      createFinding({
        category: 'Security',
        severity: 'Low',
        title: 'Unable to read storage module',
        description: 'Could not read src/storage.ts. localStorage sensitive data check was skipped.',
        filePaths: ['src/storage.ts'],
        recommendation: 'Verify that src/storage.ts exists and is readable.',
        requirementRef: 'Req 3.8',
      })
    );
  }

  return findings;
}
