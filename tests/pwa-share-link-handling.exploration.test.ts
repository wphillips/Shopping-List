/**
 * Bug Condition Exploration Test — PWA Share Link Handling
 *
 * Tests that the PWA manifest declares `share_target`, `handle_links`, and
 * `scope` so the OS can route shared `?list=` links to the installed PWA.
 *
 * This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * **Validates: Requirements 1.1, 1.3, 2.1, 2.3**
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as fc from 'fast-check';

// Parse the manifest once for all tests
const manifestPath = resolve(__dirname, '..', 'public', 'manifest.webmanifest');
const manifestRaw = readFileSync(manifestPath, 'utf-8');
const manifest: Record<string, unknown> = JSON.parse(manifestRaw);

describe('Bug Condition Exploration: Missing PWA URL Handling Declarations', () => {
  it('Bug Condition 1 — manifest should declare share_target with correct action, method, and params', () => {
    fc.assert(
      fc.property(fc.constant(manifest), (m) => {
        const shareTarget = m.share_target as
          | { action: string; method: string; params: { url: string } }
          | undefined;

        // share_target must be defined
        expect(shareTarget).toBeDefined();

        // share_target must have the correct structure
        expect(shareTarget!.action).toBe('/');
        expect(shareTarget!.method).toBe('GET');
        expect(shareTarget!.params).toBeDefined();
        expect(shareTarget!.params.url).toBe('list');
      }),
      { numRuns: 1 }
    );
  });

  it('Bug Condition 2 — manifest should declare handle_links as "preferred"', () => {
    fc.assert(
      fc.property(fc.constant(manifest), (m) => {
        expect(m.handle_links).toBe('preferred');
      }),
      { numRuns: 1 }
    );
  });

  it('Bug Condition 3 — manifest should declare scope as "/"', () => {
    fc.assert(
      fc.property(fc.constant(manifest), (m) => {
        expect(m.scope).toBe('/');
      }),
      { numRuns: 1 }
    );
  });

  it('Bug Condition 4 — share_target.params.url should match the "list" query key used by decodeListFragment', () => {
    fc.assert(
      fc.property(fc.constant(manifest), (m) => {
        const shareTarget = m.share_target as
          | { params: { url: string } }
          | undefined;

        // share_target must exist and its params.url must equal "list",
        // matching the query key parsed by decodeListFragment in src/url-codec.ts
        expect(shareTarget).toBeDefined();
        expect(shareTarget!.params.url).toBe('list');
      }),
      { numRuns: 1 }
    );
  });
});
