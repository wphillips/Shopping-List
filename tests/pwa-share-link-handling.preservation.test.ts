/**
 * Preservation Property Tests — PWA Share Link Handling
 *
 * These tests capture baseline behavior that MUST be preserved after the bugfix.
 * They verify that the URL codec round-trips correctly, that decodeListFragment
 * returns null for URLs without a `list=` parameter, and that existing manifest
 * fields remain unchanged.
 *
 * All tests MUST PASS on UNFIXED code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeListUrl, decodeListFragment } from '../src/url-codec';

// Parse the manifest once for all tests
const manifestPath = resolve(__dirname, '..', 'public', 'manifest.webmanifest');
const manifestRaw = readFileSync(manifestPath, 'utf-8');
const manifest: Record<string, unknown> = JSON.parse(manifestRaw);

// ─── Generators ───

/**
 * Generate a serialized grocery list JSON string that resembles the output
 * of the serialize() function. We constrain to valid SerializedList shapes
 * so that the codec operates on realistic data.
 */
const arbSerializedListJson: fc.Arbitrary<string> = fc
  .record({
    name: fc.string({ minLength: 1, maxLength: 30 }),
    sections: fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 30 }),
        order: fc.nat({ max: 20 }),
        items: fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            quantity: fc.integer({ min: 1, max: 100 }),
            isChecked: fc.boolean(),
          }),
          { minLength: 0, maxLength: 3 }
        ),
      }),
      { minLength: 0, maxLength: 3 }
    ),
  })
  .map((obj) => JSON.stringify(obj));

/**
 * Generate URL-like strings that do NOT contain a `list=` parameter.
 * These simulate direct-launch URLs or unrelated query strings.
 */
const arbNonListUrl: fc.Arbitrary<string> = fc.oneof(
  // Empty string
  fc.constant(''),
  // Just a question mark
  fc.constant('?'),
  // Just a hash
  fc.constant('#'),
  // Common non-list query strings
  fc.constant('?page=home'),
  fc.constant('#section=top'),
  // Random query string with other params but no `list=`
  fc
    .array(
      fc.tuple(
        fc.stringMatching(/^[a-z]{1,10}$/).filter((k) => k !== 'list'),
        fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)
      ),
      { minLength: 1, maxLength: 3 }
    )
    .map((pairs) => '?' + pairs.map(([k, v]) => `${k}=${v}`).join('&')),
  // Random hash fragment with other params but no `list=`
  fc
    .array(
      fc.tuple(
        fc.stringMatching(/^[a-z]{1,10}$/).filter((k) => k !== 'list'),
        fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/)
      ),
      { minLength: 1, maxLength: 3 }
    )
    .map((pairs) => '#' + pairs.map(([k, v]) => `${k}=${v}`).join('&'))
);

// ─── Tests ───

describe('Preservation: URL Codec and Manifest Fields Unchanged', () => {
  /**
   * PBT: For all random serialized grocery list JSON strings,
   * decodeListFragment(encodeListUrl(json, origin).split('?')[1]) round-trips
   * to the original JSON.
   *
   * **Validates: Requirements 3.2**
   */
  it('PBT: encodeListUrl → decodeListFragment round-trips for all serialized grocery list JSON', () => {
    const origin = 'https://example.com';

    fc.assert(
      fc.property(arbSerializedListJson, (json) => {
        const url = encodeListUrl(json, origin);

        // URL should start with origin and contain ?list=
        expect(url).toContain('?list=');

        // Extract the query string portion (after the ?)
        const queryString = url.split('?')[1];

        // Decode should round-trip back to the original JSON
        const decoded = decodeListFragment('?' + queryString);

        expect(decoded).toBe(json);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * PBT: For all URL strings without a `list=` parameter,
   * decodeListFragment returns null.
   *
   * **Validates: Requirements 3.3**
   */
  it('PBT: decodeListFragment returns null for URLs without a list= parameter', () => {
    fc.assert(
      fc.property(arbNonListUrl, (urlFragment) => {
        const result = decodeListFragment(urlFragment);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Unit: Existing manifest fields remain unchanged after fix.
   * These are the fields that existed before the bugfix and must be preserved.
   *
   * **Validates: Requirements 3.1, 3.3, 3.4**
   */
  it('Unit: existing manifest fields are preserved', () => {
    expect(manifest.name).toBe('Grocery List');
    expect(manifest.short_name).toBe('Groceries');
    expect(manifest.description).toBe('Manage your grocery shopping list offline');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#1a1a1a');
    expect(manifest.theme_color).toBe('#2d2d2d');

    // Icons array should have exactly 2 entries with correct sizes
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>;
    expect(icons).toHaveLength(2);

    expect(icons[0].src).toBe('/icons/icon-192x192.png');
    expect(icons[0].sizes).toBe('192x192');
    expect(icons[0].type).toBe('image/png');
    expect(icons[0].purpose).toBe('any maskable');

    expect(icons[1].src).toBe('/icons/icon-512x512.png');
    expect(icons[1].sizes).toBe('512x512');
    expect(icons[1].type).toBe('image/png');
    expect(icons[1].purpose).toBe('any maskable');
  });
});
