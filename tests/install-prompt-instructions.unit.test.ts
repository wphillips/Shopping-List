/**
 * Unit tests for install-prompt-instructions feature.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  detectBrowser,
  getInstallInstruction,
  DetectDeps,
  BrowserId,
  InstallPromptBanner,
  InstallPromptBannerConfig,
} from '../src/install-prompt';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(userAgent: string): DetectDeps {
  return {
    userAgent,
    maxTouchPoints: 1,
    matchMedia: () => ({ matches: false }),
    standalone: false,
  };
}

// ---------------------------------------------------------------------------
// detectBrowser
// ---------------------------------------------------------------------------

describe('detectBrowser', () => {
  it('returns "chrome-android" for Chrome on Android', () => {
    const deps = makeDeps(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    );
    expect(detectBrowser(deps)).toBe<BrowserId>('chrome-android');
  });

  it('returns "firefox-android" for Firefox on Android', () => {
    const deps = makeDeps(
      'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
    );
    expect(detectBrowser(deps)).toBe<BrowserId>('firefox-android');
  });

  it('returns "samsung-internet" for Samsung Internet', () => {
    const deps = makeDeps(
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    );
    expect(detectBrowser(deps)).toBe<BrowserId>('samsung-internet');
  });

  it('returns "ios-safari" for Safari on iOS', () => {
    const deps = makeDeps(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(detectBrowser(deps)).toBe<BrowserId>('ios-safari');
  });

  it('prioritises Samsung Internet over Chrome (both UAs contain "Chrome")', () => {
    const deps = makeDeps(
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    );
    expect(detectBrowser(deps)).toBe<BrowserId>('samsung-internet');
  });

  it('returns "unknown" for a desktop Chrome UA', () => {
    const deps = makeDeps(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    expect(detectBrowser(deps)).toBe<BrowserId>('unknown');
  });

  it('returns "unknown" for an empty user-agent string', () => {
    const deps = makeDeps('');
    expect(detectBrowser(deps)).toBe<BrowserId>('unknown');
  });
});

// ---------------------------------------------------------------------------
// getInstallInstruction
// ---------------------------------------------------------------------------

describe('getInstallInstruction', () => {
  it('returns instruction containing "⋮ menu" and "Add to Home Screen" for chrome-android', () => {
    const result = getInstallInstruction('chrome-android');
    expect(result).toContain('⋮ menu');
    expect(result).toContain('Add to Home Screen');
  });

  it('returns instruction containing "⋮ menu" and "Install" for firefox-android', () => {
    const result = getInstallInstruction('firefox-android');
    expect(result).toContain('⋮ menu');
    expect(result).toContain('Install');
  });

  it('returns instruction containing "menu button" and "Add page to" for samsung-internet', () => {
    const result = getInstallInstruction('samsung-internet');
    expect(result).toContain('menu button');
    expect(result).toContain('Add page to');
  });

  it('returns instruction containing "Share button" and "Add to Home Screen" for ios-safari', () => {
    const result = getInstallInstruction('ios-safari');
    expect(result).toContain('Share button');
    expect(result).toContain('Add to Home Screen');
  });

  it('returns instruction containing "browser menu" and "Add to Home Screen" for unknown', () => {
    const result = getInstallInstruction('unknown');
    expect(result).toContain('browser menu');
    expect(result).toContain('Add to Home Screen');
  });

  it('returns a non-empty string for every BrowserId', () => {
    const ids: BrowserId[] = [
      'chrome-android',
      'firefox-android',
      'samsung-internet',
      'ios-safari',
      'unknown',
    ];
    for (const id of ids) {
      const result = getInstallInstruction(id);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// InstallPromptBanner rendering
// ---------------------------------------------------------------------------

const mockDeferredPrompt = {
  prompt: async () => {},
  userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
  // Minimal Event stubs
  type: 'beforeinstallprompt',
  preventDefault: () => {},
} as any;

function makeBannerConfig(
  overrides: Partial<InstallPromptBannerConfig> = {},
): InstallPromptBannerConfig {
  return {
    deferredPrompt: null,
    isIOS: false,
    detectDeps: makeDeps(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    ),
    onDismiss: () => {},
    onInstallAccepted: () => {},
    ...overrides,
  };
}

describe('InstallPromptBanner rendering', () => {
  it('shows Install button and original message when deferredPrompt is provided', () => {
    const config = makeBannerConfig({ deferredPrompt: mockDeferredPrompt });
    const banner = new InstallPromptBanner(config);
    const el = banner.getElement();

    const installBtn = el.querySelector('button[aria-label="Install"]');
    expect(installBtn).not.toBeNull();

    const message = el.querySelector('.install-prompt-message');
    expect(message?.textContent).toContain('Save this grocery list app');
  });

  it.each([
    {
      name: 'Chrome Android',
      ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      isIOS: false,
    },
    {
      name: 'Firefox Android',
      ua: 'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
      isIOS: false,
    },
    {
      name: 'Samsung Internet',
      ua: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
      isIOS: false,
    },
    {
      name: 'iOS Safari',
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      isIOS: true,
    },
  ])(
    'shows browser-specific instruction for $name when deferredPrompt is null',
    ({ ua, isIOS }) => {
      const deps = makeDeps(ua);
      const config = makeBannerConfig({
        deferredPrompt: null,
        isIOS,
        detectDeps: deps,
      });
      const banner = new InstallPromptBanner(config);
      const el = banner.getElement();

      const message = el.querySelector('.install-prompt-message');
      const expectedText = getInstallInstruction(detectBrowser(deps));
      expect(message?.textContent).toBe(expectedText);
    },
  );

  it('renders dismiss button when deferredPrompt is null', () => {
    const config = makeBannerConfig({ deferredPrompt: null });
    const banner = new InstallPromptBanner(config);
    const el = banner.getElement();

    const dismissBtn = el.querySelector(
      'button[aria-label="Dismiss install prompt"]',
    );
    expect(dismissBtn).not.toBeNull();
  });

  it('renders dismiss button when deferredPrompt is provided', () => {
    const config = makeBannerConfig({ deferredPrompt: mockDeferredPrompt });
    const banner = new InstallPromptBanner(config);
    const el = banner.getElement();

    const dismissBtn = el.querySelector(
      'button[aria-label="Dismiss install prompt"]',
    );
    expect(dismissBtn).not.toBeNull();
  });
});
