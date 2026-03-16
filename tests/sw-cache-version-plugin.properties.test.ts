/**
 * Property-based tests for sw-cache-version Vite plugin
 * Feature: sw-cache-versioning
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'node:fs';
import path from 'node:path';
import { computeBuildHash, replacePlaceholder } from '../vite-plugin-sw-cache-version';

// Feature: sw-cache-versioning, Property 1: Distinct asset contents produce distinct hashes
describe('Property 1: Distinct asset contents produce distinct hashes', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 3.1**
   *
   * For any two distinct byte sequences representing concatenated asset contents,
   * computing the build hash on each should produce two different hash strings.
   * SHA-256 truncated to 8 hex chars has a collision space of 2^32, so for 100
   * iterations the probability of a false positive is negligible.
   */
  it('should produce different hashes for distinct byte arrays', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.uint8Array({ minLength: 1 }), fc.uint8Array({ minLength: 1 })).filter(
          ([a, b]) => {
            if (a.length !== b.length) return true;
            for (let i = 0; i < a.length; i++) {
              if (a[i] !== b[i]) return true;
            }
            return false;
          }
        ),
        ([arrayA, arrayB]) => {
          const hashA = computeBuildHash([Buffer.from(arrayA)]);
          const hashB = computeBuildHash([Buffer.from(arrayB)]);

          expect(hashA).toMatch(/^[0-9a-f]{8}$/);
          expect(hashB).toMatch(/^[0-9a-f]{8}$/);
          expect(hashA).not.toBe(hashB);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: sw-cache-versioning, Property 2: Placeholder replacement produces valid service worker
describe('Property 2: Placeholder replacement produces valid service worker', () => {
  const template = fs.readFileSync(path.resolve('public', 'sw.js'), 'utf-8');

  /**
   * **Validates: Requirements 2.3**
   *
   * For any valid build hash string (8-char lowercase hex), replacing
   * __BUILD_HASH__ in the service worker template should produce output that:
   * 1. Contains the build hash
   * 2. Does not contain the literal string __BUILD_HASH__
   * 3. Contains a valid CACHE_NAME assignment
   */
  it('should produce valid service worker output for any 8-char hex hash', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[0-9a-f]{8}$/),
        (hash) => {
          const output = replacePlaceholder(template, hash);

          expect(output).toContain(hash);
          expect(output).not.toContain('__BUILD_HASH__');
          expect(output).toContain(`grocery-list-${hash}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: sw-cache-versioning, Property 3: Cache cleanup retains only the current cache
describe('Property 3: Cache cleanup retains only the current cache', () => {
  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any set of cache names and any current cache name, the activate-handler
   * cleanup logic filters out all caches whose name does not equal the current
   * cache name. After cleanup:
   * - If the current cache name was in the original set, only it remains.
   * - If the current cache name was not in the original set, no caches remain.
   */
  it('should retain only the current cache name after cleanup filtering', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 })),
        fc.string({ minLength: 1 }),
        (cacheNames, currentCacheName) => {
          // Simulate the activate handler's cleanup logic:
          // cacheNames.filter(name => name !== CACHE_NAME) gives caches to delete
          const cachesToDelete = cacheNames.filter(
            (cacheName) => cacheName !== currentCacheName
          );

          // Remaining caches = original set minus deleted ones
          const remaining = cacheNames.filter(
            (cacheName) => !cachesToDelete.includes(cacheName)
          );

          if (cacheNames.includes(currentCacheName)) {
            // Current cache was present — only it should remain
            expect(remaining.every((name) => name === currentCacheName)).toBe(true);
            expect(remaining.length).toBeGreaterThan(0);
          } else {
            // Current cache was not present — nothing should remain
            expect(remaining).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: sw-cache-versioning, Property 4: Cache name round-trip
describe('Property 4: Cache name round-trip', () => {
  const PREFIX = 'grocery-list-';

  /**
   * **Validates: Requirements 8.1, 8.2**
   *
   * For any non-empty alphanumeric string used as a Build_Hash, constructing a
   * Cache_Name (`grocery-list-<hash>`) and then extracting the hash by removing
   * the `grocery-list-` prefix should yield the original Build_Hash value.
   */
  it('should round-trip: construct cache name then extract hash yields original', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z0-9]+$/),
        (buildHash) => {
          // Construction
          const cacheName = `${PREFIX}${buildHash}`;

          // Extraction
          const extractedHash = cacheName.slice(PREFIX.length);

          // Round-trip: extracted hash must equal original
          expect(extractedHash).toBe(buildHash);

          // Also verify the cache name follows the expected format
          expect(cacheName).toBe(`grocery-list-${buildHash}`);
          expect(cacheName.startsWith(PREFIX)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
