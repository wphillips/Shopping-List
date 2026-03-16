/**
 * Property-based tests for share controller module
 * Feature: multi-list-sharing
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { shareList, ShareDeps } from '../src/share-controller';

// --- Generators ---

/**
 * Generate arbitrary URL strings
 */
function arbUrl(): fc.Arbitrary<string> {
  return fc.webUrl();
}

/**
 * Generate arbitrary title strings
 */
function arbTitle(): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength: 100 });
}

// --- Property Tests ---

describe('Share Controller Properties', () => {
  // Feature: multi-list-sharing, Property 17: Share invokes navigator.share with correct parameters
  describe('Property 17: Share invokes navigator.share with correct parameters', () => {
    /**
     * **Validates: Requirements 5.2**
     */
    it('should call navigatorShare with { url, title } and return { status: "shared" }', async () => {
      await fc.assert(
        fc.asyncProperty(arbUrl(), arbTitle(), async (url, title) => {
          const navigatorShare = vi.fn().mockResolvedValue(undefined);
          const deps: ShareDeps = { navigatorShare };

          const result = await shareList(url, title, deps);

          expect(navigatorShare).toHaveBeenCalledOnce();
          expect(navigatorShare).toHaveBeenCalledWith({ url, title });
          expect(result).toEqual({ status: 'shared' });
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 18: Share falls back to clipboard when share is unavailable or fails
  describe('Property 18: Share falls back to clipboard when share is unavailable or fails', () => {
    /**
     * **Validates: Requirements 5.3, 5.5**
     */
    it('should call clipboardWriteText with the URL and return { status: "copied" } when navigatorShare is unavailable', async () => {
      await fc.assert(
        fc.asyncProperty(arbUrl(), arbTitle(), async (url, title) => {
          const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
          const deps: ShareDeps = { clipboardWriteText };

          const result = await shareList(url, title, deps);

          expect(clipboardWriteText).toHaveBeenCalledOnce();
          expect(clipboardWriteText).toHaveBeenCalledWith(url);
          expect(result).toEqual({ status: 'copied' });
        }),
        { numRuns: 100 }
      );
    });

    it('should fall back to clipboard when navigatorShare rejects with a non-AbortError', async () => {
      await fc.assert(
        fc.asyncProperty(arbUrl(), arbTitle(), async (url, title) => {
          const navigatorShare = vi.fn().mockRejectedValue(new TypeError('Share failed'));
          const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
          const deps: ShareDeps = { navigatorShare, clipboardWriteText };

          const result = await shareList(url, title, deps);

          expect(navigatorShare).toHaveBeenCalledOnce();
          expect(clipboardWriteText).toHaveBeenCalledOnce();
          expect(clipboardWriteText).toHaveBeenCalledWith(url);
          expect(result).toEqual({ status: 'copied' });
        }),
        { numRuns: 100 }
      );
    });
  });
});
