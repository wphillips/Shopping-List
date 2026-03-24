import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../src/audit/utils';
import {
  checkInnerHtmlUsage,
  checkServiceWorkerSecurity,
  checkCloudFrontHttps,
  checkS3PublicAccess,
  checkWafRateLimiting,
  checkLocalStorageSensitiveData,
} from '../src/audit/security-inspector';

beforeEach(() => {
  resetCounters();
});

describe('checkInnerHtmlUsage', () => {
  it('should detect innerHTML assignment with dynamic content', () => {
    const content = 'this.element.innerHTML = `<div>${userInput}</div>`;';
    const findings = checkInnerHtmlUsage('src/index.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].category).toBe('Security');
    expect(findings[0].filePaths).toContain('src/index.ts');
    expect(findings[0].requirementRef).toBe('Req 3.2');
  });

  it('should detect innerHTML assignment with static emoji content', () => {
    const content = "button.innerHTML = '📤';";
    const findings = checkInnerHtmlUsage('src/index.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Medium');
  });

  it('should lower severity when escapeHtml is used nearby', () => {
    const content = [
      'const safe = this.escapeHtml(name);',
      'trigger.innerHTML = `<span>${safe}</span>`;',
    ].join('\n');
    const findings = checkInnerHtmlUsage('src/components/ListSelector.ts', content);
    const templateFinding = findings.find(f => f.description.includes('Line 2'));
    expect(templateFinding).toBeDefined();
    expect(templateFinding!.severity).toBe('Low');
  });

  it('should return empty array for file with no innerHTML', () => {
    const content = 'const x = 1;\nconst y = 2;\n';
    const findings = checkInnerHtmlUsage('src/utils.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should detect innerHTML += assignment', () => {
    const content = 'el.innerHTML += "<p>more</p>";';
    const findings = checkInnerHtmlUsage('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('checkServiceWorkerSecurity', () => {
  it('should flag fetch handler that caches without filtering', () => {
    const swContent = `
      addEventListener('fetch', (event) => {
        event.respondWith(
          caches.match(event.request).then(r => {
            return fetch(event.request).then(resp => {
              const clone = resp.clone();
              caches.open('my-cache').then(c => cache.put(event.request, clone));
              return resp;
            });
          })
        );
      });
    `;
    const findings = checkServiceWorkerSecurity(swContent);
    const cacheFinding = findings.find(f => f.title.includes('caches all network responses'));
    expect(cacheFinding).toBeDefined();
    expect(cacheFinding!.severity).toBe('Medium');
  });

  it('should flag credential-related URLs in cache list', () => {
    const swContent = `
      const STATIC_ASSETS = ['/api/token', '/index.html'];
      addEventListener('fetch', (event) => {});
    `;
    const findings = checkServiceWorkerSecurity(swContent);
    const credFinding = findings.find(f => f.title.includes('credential-related'));
    expect(credFinding).toBeDefined();
    expect(credFinding!.severity).toBe('High');
  });

  it('should produce low-severity finding for clean service worker', () => {
    const swContent = `
      const STATIC_ASSETS = ['/', '/index.html', '/styles.css'];
      addEventListener('fetch', (event) => {
        event.respondWith(caches.match(event.request));
      });
    `;
    const findings = checkServiceWorkerSecurity(swContent);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.every(f => f.severity === 'Low')).toBe(true);
  });
});

describe('checkCloudFrontHttps', () => {
  it('should pass when all policies are redirect-to-https', () => {
    const tf = `
      viewer_protocol_policy = "redirect-to-https"
      viewer_protocol_policy = "redirect-to-https"
    `;
    const findings = checkCloudFrontHttps(tf);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('enforces HTTPS');
  });

  it('should flag allow-all policy', () => {
    const tf = 'viewer_protocol_policy = "allow-all"';
    const findings = checkCloudFrontHttps(tf);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('allow-all');
  });

  it('should flag missing viewer_protocol_policy', () => {
    const tf = 'resource "aws_cloudfront_distribution" "website" {}';
    const findings = checkCloudFrontHttps(tf);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('No viewer_protocol_policy');
  });

  it('should accept https-only as valid', () => {
    const tf = 'viewer_protocol_policy = "https-only"';
    const findings = checkCloudFrontHttps(tf);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
  });
});

describe('checkS3PublicAccess', () => {
  it('should pass when all four flags are true', () => {
    const tf = `
      resource "aws_s3_bucket_public_access_block" "website" {
        block_public_acls       = true
        block_public_policy     = true
        ignore_public_acls      = true
        restrict_public_buckets = true
      }
    `;
    const findings = checkS3PublicAccess(tf);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('correctly configured');
  });

  it('should flag when a flag is false', () => {
    const tf = `
      resource "aws_s3_bucket_public_access_block" "website" {
        block_public_acls       = true
        block_public_policy     = false
        ignore_public_acls      = true
        restrict_public_buckets = true
      }
    `;
    const findings = checkS3PublicAccess(tf);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[0].description).toContain('block_public_policy');
  });

  it('should flag missing public access block resource', () => {
    const tf = 'resource "aws_s3_bucket" "website" {}';
    const findings = checkS3PublicAccess(tf);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[0].title).toContain('missing public access block');
  });

  it('should flag missing flags', () => {
    const tf = `
      resource "aws_s3_bucket_public_access_block" "website" {
        block_public_acls = true
      }
    `;
    const findings = checkS3PublicAccess(tf);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[0].description).toContain('block_public_policy (missing)');
  });
});

describe('checkWafRateLimiting', () => {
  it('should pass when WAF has rate_based_statement', () => {
    const tf = `
      resource "aws_wafv2_web_acl" "cloudfront" {
        rule {
          statement {
            rate_based_statement {
              limit = 300
            }
          }
        }
      }
    `;
    const findings = checkWafRateLimiting(tf);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('rate-limiting rule is configured');
  });

  it('should flag missing WAF ACL', () => {
    const tf = '# empty waf config';
    const findings = checkWafRateLimiting(tf);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('No WAF Web ACL');
  });

  it('should flag WAF without rate-limiting rule', () => {
    const tf = `
      resource "aws_wafv2_web_acl" "cloudfront" {
        rule {
          statement {
            managed_rule_group_statement {}
          }
        }
      }
    `;
    const findings = checkWafRateLimiting(tf);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('missing rate-limiting');
  });
});

describe('checkLocalStorageSensitiveData', () => {
  it('should flag localStorage storing tokens', () => {
    const content = "localStorage.setItem('auth_token', token);";
    const findings = checkLocalStorageSensitiveData(content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[0].requirementRef).toBe('Req 3.8');
  });

  it('should flag localStorage storing jwt', () => {
    const content = "localStorage.setItem('jwt', value);";
    const findings = checkLocalStorageSensitiveData(content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Critical');
  });

  it('should flag localStorage storing credentials', () => {
    const content = "localStorage.setItem('credential', cred);";
    const findings = checkLocalStorageSensitiveData(content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Critical');
  });

  it('should not flag localStorage storing non-sensitive data', () => {
    const content = [
      "const STORAGE_KEY = 'grocery-list-state';",
      "localStorage.setItem(STORAGE_KEY, json);",
    ].join('\n');
    const findings = checkLocalStorageSensitiveData(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('No sensitive data');
  });

  it('should flag localStorage storing password', () => {
    const content = "localStorage.setItem('password', pw);";
    const findings = checkLocalStorageSensitiveData(content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Critical');
  });
});
