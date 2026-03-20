/**
 * Unit tests for browser-context-detector module.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3
 */

import { describe, it, expect } from 'vitest';
import {
  BrowserContextDeps,
  isIOSDevice,
  shouldShowRedirectBanner,
} from '../src/browser-context-detector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<BrowserContextDeps> = {}): BrowserContextDeps {
  return {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    matchMedia: () => ({ matches: false }),
    locationSearch: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isIOSDevice
// ---------------------------------------------------------------------------

describe('isIOSDevice', () => {
  it('returns true for iOS Safari (iPhone)', () => {
    const deps = makeDeps();
    expect(isIOSDevice(deps)).toBe(true);
  });

  it('returns true for iOS Safari (iPad)', () => {
    const deps = makeDeps({
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSDevice(deps)).toBe(true);
  });

  it('returns true for iOS Safari (iPod)', () => {
    const deps = makeDeps({
      userAgent:
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSDevice(deps)).toBe(true);
  });

  it('returns false for Chrome on iOS (CriOS)', () => {
    const deps = makeDeps({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSDevice(deps)).toBe(false);
  });

  it('returns false for Firefox on iOS (FxiOS)', () => {
    const deps = makeDeps({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSDevice(deps)).toBe(false);
  });

  it('returns false for Android Chrome', () => {
    const deps = makeDeps({
      userAgent:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    });
    expect(isIOSDevice(deps)).toBe(false);
  });

  it('returns false for desktop Chrome', () => {
    const deps = makeDeps({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });
    expect(isIOSDevice(deps)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldShowRedirectBanner
// ---------------------------------------------------------------------------

describe('shouldShowRedirectBanner', () => {
  /** Helper that builds deps for the "all conditions met" scenario. */
  function makeRedirectDeps(
    overrides: Partial<BrowserContextDeps> = {},
  ): BrowserContextDeps {
    return makeDeps({
      locationSearch: '?list=abc123',
      // iOS Safari UA is the default from makeDeps
      // matchMedia returns false (not standalone) by default
      ...overrides,
    });
  }

  it('returns true when all three conditions are met (iOS + browser + ?list= param)', () => {
    expect(shouldShowRedirectBanner(makeRedirectDeps())).toBe(true);
  });

  it('returns false when URL has no ?list= param', () => {
    const deps = makeRedirectDeps({ locationSearch: '' });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false when URL has unrelated query params', () => {
    const deps = makeRedirectDeps({ locationSearch: '?foo=bar' });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false in standalone mode (matchMedia)', () => {
    const deps = makeRedirectDeps({
      matchMedia: (q: string) => ({
        matches: q === '(display-mode: standalone)',
      }),
    });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false in standalone mode (navigator.standalone)', () => {
    const deps = makeRedirectDeps({ standalone: true });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false on Android device', () => {
    const deps = makeRedirectDeps({
      userAgent:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false on desktop device', () => {
    const deps = makeRedirectDeps({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false for Chrome on iOS (CriOS) even with ?list= param', () => {
    const deps = makeRedirectDeps({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
    });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });

  it('returns false for Firefox on iOS (FxiOS) even with ?list= param', () => {
    const deps = makeRedirectDeps({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1',
    });
    expect(shouldShowRedirectBanner(deps)).toBe(false);
  });
});
