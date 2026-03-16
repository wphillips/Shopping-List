/**
 * Unit tests for share controller module
 * Feature: multi-list-sharing
 * Requirements: 5.2, 5.3, 5.5, 5.6
 */

import { describe, it, expect, vi } from 'vitest';
import { shareList, ShareDeps } from '../src/share-controller';

describe('Share Controller Unit Tests', () => {
  // --- navigatorShare success ---

  describe('navigatorShare succeeds', () => {
    it('returns { status: "shared" } when navigatorShare resolves', async () => {
      const navigatorShare = vi.fn().mockResolvedValue(undefined);
      const deps: ShareDeps = { navigatorShare };

      const result = await shareList('https://app.test/#list=abc', 'Weekly Groceries', deps);

      expect(result).toEqual({ status: 'shared' });
    });

    it('passes correct { url, title } to navigatorShare', async () => {
      const navigatorShare = vi.fn().mockResolvedValue(undefined);
      const deps: ShareDeps = { navigatorShare };

      const url = 'https://grocery.app/#list=encoded123';
      const title = 'My Shopping List';

      await shareList(url, title, deps);

      expect(navigatorShare).toHaveBeenCalledOnce();
      expect(navigatorShare).toHaveBeenCalledWith({ url, title });
    });
  });

  // --- AbortError handling ---

  describe('AbortError handling', () => {
    it('returns { status: "shared" } when navigatorShare throws AbortError (user cancelled)', async () => {
      const abortError = new DOMException('Share cancelled', 'AbortError');
      const navigatorShare = vi.fn().mockRejectedValue(abortError);
      const deps: ShareDeps = { navigatorShare };

      const result = await shareList('https://app.test/#list=abc', 'Groceries', deps);

      expect(result).toEqual({ status: 'shared' });
    });
  });

  // --- Fallback to clipboard on non-AbortError ---

  describe('clipboard fallback on non-AbortError', () => {
    it('falls back to clipboard when navigatorShare throws a non-AbortError', async () => {
      const navigatorShare = vi.fn().mockRejectedValue(new TypeError('Not allowed'));
      const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
      const deps: ShareDeps = { navigatorShare, clipboardWriteText };

      const result = await shareList('https://app.test/#list=abc', 'Groceries', deps);

      expect(clipboardWriteText).toHaveBeenCalledOnce();
      expect(clipboardWriteText).toHaveBeenCalledWith('https://app.test/#list=abc');
      expect(result).toEqual({ status: 'copied' });
    });
  });

  // --- Clipboard-only scenario ---

  describe('clipboard only (no navigatorShare)', () => {
    it('returns { status: "copied" } when only clipboard is available', async () => {
      const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
      const deps: ShareDeps = { clipboardWriteText };

      const result = await shareList('https://app.test/#list=data', 'List', deps);

      expect(clipboardWriteText).toHaveBeenCalledOnce();
      expect(clipboardWriteText).toHaveBeenCalledWith('https://app.test/#list=data');
      expect(result).toEqual({ status: 'copied' });
    });
  });

  // --- Unsupported browser ---

  describe('unsupported browser (neither API available)', () => {
    it('returns { status: "unsupported" } when neither share nor clipboard is available', async () => {
      const deps: ShareDeps = {};

      const result = await shareList('https://app.test/#list=data', 'List', deps);

      expect(result).toEqual({ status: 'unsupported' });
    });
  });
});
