// @vitest-environment jsdom

/**
 * Property-based tests for install-prompt-instructions
 * Feature: install-prompt-instructions
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectBrowser,
  getInstallInstruction,
  DetectDeps,
  BrowserId,
} from '../src/install-prompt';

const VALID_BROWSER_IDS: BrowserId[] = [
  'chrome-android',
  'firefox-android',
  'samsung-internet',
  'ios-safari',
  'unknown',
];

function makeDeps(userAgent: string): DetectDeps {
  return {
    userAgent,
    maxTouchPoints: 1,
    matchMedia: () => ({ matches: false }),
    standalone: false,
  };
}

describe('Feature: install-prompt-instructions, Property 1: Detection-to-instruction round-trip completeness', () => {
  /**
   * **Validates: Requirements 1.4, 2.6, 4.3**
   *
   * For any arbitrary string used as a user agent, `detectBrowser` should
   * return a value that is a member of the `BrowserId` union, and
   * `getInstallInstruction` called with that value should return a non-empty
   * string.
   */
  it('should always produce a valid BrowserId and a non-empty instruction for any user agent string', () => {
    fc.assert(
      fc.property(fc.string(), (ua) => {
        const deps = makeDeps(ua);
        const browserId = detectBrowser(deps);

        // The intermediate value must be a valid BrowserId
        expect(VALID_BROWSER_IDS).toContain(browserId);

        // The instruction must be a non-empty string
        const instruction = getInstallInstruction(browserId);
        expect(typeof instruction).toBe('string');
        expect(instruction.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Browser classification correctness
// ---------------------------------------------------------------------------

// Structured UA generators per browser family

/** Chrome Android UA generator — random major version and build number */
const chromeAndroidUA = fc
  .tuple(fc.integer({ min: 50, max: 200 }), fc.integer({ min: 0, max: 9999 }))
  .map(
    ([major, build]) =>
      `Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.${build}.0 Mobile Safari/537.36`,
  );

/** Firefox Android UA generator — random major version */
const firefoxAndroidUA = fc.integer({ min: 50, max: 200 }).map(
  (major) =>
    `Mozilla/5.0 (Android 13; Mobile; rv:${major}.0) Gecko/${major}.0 Firefox/${major}.0`,
);

/** Samsung Internet UA generator — random Samsung and Chrome version numbers */
const samsungInternetUA = fc
  .tuple(fc.integer({ min: 5, max: 30 }), fc.integer({ min: 50, max: 200 }))
  .map(
    ([sVer, cVer]) =>
      `Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/${sVer}.0 Chrome/${cVer}.0.0.0 Mobile Safari/537.36`,
  );

/** iOS Safari UA generator — random major and minor OS versions */
const iosSafariUA = fc
  .tuple(fc.integer({ min: 10, max: 20 }), fc.integer({ min: 0, max: 9 }))
  .map(
    ([major, minor]) =>
      `Mozilla/5.0 (iPhone; CPU iPhone OS ${major}_${minor} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${major}.${minor} Mobile/15E148 Safari/604.1`,
  );

describe('Feature: install-prompt-instructions, Property 2: Browser classification correctness', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any user agent string drawn from a pool of known UA patterns for each
   * browser family, `detectBrowser` should return the corresponding `BrowserId`.
   */

  it('classifies Chrome Android UAs correctly', () => {
    fc.assert(
      fc.property(chromeAndroidUA, (ua) => {
        expect(detectBrowser(makeDeps(ua))).toBe('chrome-android');
      }),
      { numRuns: 100 },
    );
  });

  it('classifies Firefox Android UAs correctly', () => {
    fc.assert(
      fc.property(firefoxAndroidUA, (ua) => {
        expect(detectBrowser(makeDeps(ua))).toBe('firefox-android');
      }),
      { numRuns: 100 },
    );
  });

  it('classifies Samsung Internet UAs correctly', () => {
    fc.assert(
      fc.property(samsungInternetUA, (ua) => {
        expect(detectBrowser(makeDeps(ua))).toBe('samsung-internet');
      }),
      { numRuns: 100 },
    );
  });

  it('classifies iOS Safari UAs correctly', () => {
    fc.assert(
      fc.property(iosSafariUA, (ua) => {
        expect(detectBrowser(makeDeps(ua))).toBe('ios-safari');
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Banner displays resolved instruction when no deferredPrompt
// ---------------------------------------------------------------------------

import { InstallPromptBanner } from '../src/install-prompt';

describe('Feature: install-prompt-instructions, Property 3: Banner displays resolved instruction when no deferredPrompt', () => {
  /**
   * **Validates: Requirements 3.2, 3.3**
   *
   * For any DetectDeps object (with arbitrary user agent strings), when
   * InstallPromptBanner is created with deferredPrompt: null, the banner's
   * message text content should equal getInstallInstruction(detectBrowser(deps)).
   */
  it('should render the resolved instruction as the banner message for any UA', () => {
    fc.assert(
      fc.property(fc.string(), (ua) => {
        const deps = makeDeps(ua);
        const config = {
          deferredPrompt: null,
          isIOS: false,
          detectDeps: deps,
          onDismiss: () => {},
          onInstallAccepted: () => {},
        };

        const banner = new InstallPromptBanner(config);
        const messageText = banner.getElement().querySelector('.install-prompt-message')?.textContent;
        const expected = getInstallInstruction(detectBrowser(deps));

        expect(messageText).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Dismiss button always present
// ---------------------------------------------------------------------------

describe('Feature: install-prompt-instructions, Property 4: Dismiss button always present', () => {
  /**
   * **Validates: Requirements 5.2**
   *
   * For any configuration of InstallPromptBanner (any combination of
   * deferredPrompt presence and any DetectDeps), the banner element should
   * always contain a dismiss button with aria-label="Dismiss install prompt".
   */

  const mockDeferredPrompt = {
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    type: 'beforeinstallprompt',
    preventDefault: () => {},
  } as any;

  const deferredPromptArb = fc.oneof(
    fc.constant(null),
    fc.constant(mockDeferredPrompt),
  );

  it('should always contain a dismiss button with correct aria-label regardless of config', () => {
    fc.assert(
      fc.property(fc.tuple(deferredPromptArb, fc.string()), ([deferredPrompt, ua]) => {
        const deps = makeDeps(ua);
        const config = {
          deferredPrompt,
          isIOS: false,
          detectDeps: deps,
          onDismiss: () => {},
          onInstallAccepted: () => {},
        };

        const banner = new InstallPromptBanner(config);
        const el = banner.getElement();
        const dismissBtn = el.querySelector('button[aria-label="Dismiss install prompt"]');

        expect(dismissBtn).not.toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
