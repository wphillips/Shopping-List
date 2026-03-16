/**
 * Property-based tests for URL codec module
 * Feature: multi-list-sharing
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { encodeListUrl, decodeListFragment } from '../src/url-codec';

// --- Generators ---

/**
 * Generate a non-empty string suitable for serialized JSON payloads
 */
function arbNonEmptyString(): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength: 200 });
}

/**
 * Generate a plausible origin string (e.g., "https://example.com")
 */
function arbOrigin(): fc.Arbitrary<string> {
  return fc.webUrl().map((url) => {
    const u = new URL(url);
    return u.origin;
  });
}

/**
 * Generate hash strings that do NOT contain a `list=` parameter
 */
function arbHashWithoutList(): fc.Arbitrary<string> {
  return fc.oneof(
    // Empty string
    fc.constant(''),
    // Just a hash mark
    fc.constant('#'),
    // Hash with other parameter
    fc.constant('#other=value'),
    fc.constant('#foo=bar&baz=qux'),
    // Hash with key that starts with "list" but isn't "list="
    fc.constant('#listing=something'),
    fc.constant('#listof=items'),
    // Random hash without list=
    fc
      .array(
        fc.tuple(
          fc.stringMatching(/^[a-z]{1,10}$/).filter((k) => k !== 'list'),
          fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)
        ),
        { minLength: 0, maxLength: 3 }
      )
      .map((pairs) => {
        if (pairs.length === 0) return '';
        return '#' + pairs.map(([k, v]) => `${k}=${v}`).join('&');
      })
  );
}

/**
 * Generate corrupted hash strings of the form `#list=<random-non-lzstring-data>`
 * These should NOT be valid lz-string compressed payloads.
 * We filter out strings that lz-string accidentally decompresses successfully.
 */
function arbCorruptedHash(): fc.Arbitrary<string> {
  return fc
    .oneof(
      // Random alphanumeric strings
      fc.stringMatching(/^[a-zA-Z0-9]{5,50}$/),
      // Random ASCII characters (sanitized for hash safety)
      fc.string({ minLength: 3, maxLength: 50 }).map((s) => s.replace(/[#&=]/g, 'x')),
      // Specific known-bad payloads
      fc.constant('!!!invalid!!!'),
      fc.constant('not-compressed-data-at-all'),
      fc.constant('AAAA')
    )
    .filter((data) => {
      // Only keep values where lz-string truly fails (returns null, empty, or throws)
      try {
        const result = decompressFromEncodedURIComponent(data);
        return result === null || result === '';
      } catch {
        return true; // lz-string threw — this is corrupted data
      }
    })
    .map((data) => `#list=${data}`);
}

// --- Property Tests ---

describe('URL Codec Properties', () => {
  // Feature: multi-list-sharing, Property 13: URL codec round-trip preserves the serialized string
  describe('Property 13: URL codec round-trip preserves the serialized string', () => {
    /**
     * **Validates: Requirements 4.7**
     */
    it('should return the original string after encoding then extracting query and decoding', () => {
      fc.assert(
        fc.property(arbNonEmptyString(), arbOrigin(), (input, origin) => {
          const url = encodeListUrl(input, origin);

          // Extract the query portion (everything from ?)
          const queryIndex = url.indexOf('?');
          expect(queryIndex).toBeGreaterThan(-1);
          const query = url.slice(queryIndex);

          const decoded = decodeListFragment(query);

          // Should return the original string, not null or error
          expect(decoded).toBe(input);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 14: Encoded URL matches the expected format
  describe('Property 14: Encoded URL matches the expected format', () => {
    /**
     * **Validates: Requirements 4.2**
     */
    it('should return a URL matching <origin>/?list=<non-empty-string>', () => {
      fc.assert(
        fc.property(arbNonEmptyString(), arbOrigin(), (input, origin) => {
          const url = encodeListUrl(input, origin);

          // Should start with origin + /?list=
          expect(url.startsWith(`${origin}/?list=`)).toBe(true);

          // The encoded data portion should be non-empty
          const encoded = url.slice(`${origin}/?list=`.length);
          expect(encoded.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 15: Missing list parameter returns null
  describe('Property 15: Missing list parameter returns null', () => {
    /**
     * **Validates: Requirements 4.5**
     */
    it('should return null for any hash without list= parameter', () => {
      fc.assert(
        fc.property(arbHashWithoutList(), (hash) => {
          const result = decodeListFragment(hash);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 16: Corrupted encoded data returns an error
  describe('Property 16: Corrupted encoded data returns an error', () => {
    /**
     * **Validates: Requirements 4.6**
     */
    it('should return { error: string } for hash with corrupted lz-string data', () => {
      fc.assert(
        fc.property(arbCorruptedHash(), (hash) => {
          const result = decodeListFragment(hash);

          // Should be an error object (not null, not a string)
          expect(result).not.toBeNull();
          expect(typeof result).toBe('object');
          expect(result).toHaveProperty('error');
          expect(typeof (result as { error: string }).error).toBe('string');
          expect((result as { error: string }).error.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
