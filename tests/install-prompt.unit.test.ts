/**
 * Unit tests for install-prompt detection utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  isMobileDevice,
  isStandaloneMode,
  isIOSSafari,
  isDismissed,
  setDismissed,
  shouldShowInstallPrompt,
  DetectDeps,
  DismissalDeps,
} from '../src/install-prompt';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetectDeps(overrides: Partial<DetectDeps> = {}): DetectDeps {
  return {
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120',
    maxTouchPoints: 5,
    matchMedia: () => ({ matches: false }),
    ...overrides,
  };
}

function makeDismissalDeps(store: Record<string, string> = {}): DismissalDeps {
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };
}

// ---------------------------------------------------------------------------
// isMobileDevice
// ---------------------------------------------------------------------------

describe('isMobileDevice', () => {
  it('returns true for Android UA with touch', () => {
    expect(isMobileDevice(makeDetectDeps())).toBe(true);
  });

  it('returns true for iPhone UA with touch', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    });
    expect(isMobileDevice(deps)).toBe(true);
  });

  it('returns true for iPad UA with touch', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    });
    expect(isMobileDevice(deps)).toBe(true);
  });

  it('returns false for desktop UA', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
      maxTouchPoints: 0,
    });
    expect(isMobileDevice(deps)).toBe(false);
  });

  it('returns false when UA contains Android but maxTouchPoints is 0 (DevTools emulation)', () => {
    const deps = makeDetectDeps({ maxTouchPoints: 0 });
    expect(isMobileDevice(deps)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isStandaloneMode
// ---------------------------------------------------------------------------

describe('isStandaloneMode', () => {
  it('returns true when matchMedia standalone matches', () => {
    const deps = makeDetectDeps({
      matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' }),
    });
    expect(isStandaloneMode(deps)).toBe(true);
  });

  it('returns true when navigator.standalone is true (iOS)', () => {
    const deps = makeDetectDeps({ standalone: true });
    expect(isStandaloneMode(deps)).toBe(true);
  });

  it('returns false when neither condition is met', () => {
    const deps = makeDetectDeps({ standalone: false });
    expect(isStandaloneMode(deps)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isIOSSafari
// ---------------------------------------------------------------------------

describe('isIOSSafari', () => {
  it('returns true for iOS Safari UA', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSSafari(deps)).toBe(true);
  });

  it('returns false for Chrome on iOS (CriOS)', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSSafari(deps)).toBe(false);
  });

  it('returns false for Firefox on iOS (FxiOS)', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1',
    });
    expect(isIOSSafari(deps)).toBe(false);
  });

  it('returns false for Android Chrome', () => {
    const deps = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120',
    });
    expect(isIOSSafari(deps)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDismissed / setDismissed
// ---------------------------------------------------------------------------

describe('isDismissed', () => {
  it('returns false when key is absent', () => {
    expect(isDismissed(makeDismissalDeps())).toBe(false);
  });

  it('returns true when key is present', () => {
    expect(isDismissed(makeDismissalDeps({ 'pwa-install-dismissed': '1' }))).toBe(true);
  });

  it('returns false when getItem throws', () => {
    const deps: DismissalDeps = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => {},
    };
    expect(isDismissed(deps)).toBe(false);
  });
});

describe('setDismissed', () => {
  it('writes the dismissal key', () => {
    const store: Record<string, string> = {};
    setDismissed(makeDismissalDeps(store));
    expect(store['pwa-install-dismissed']).toBe('1');
  });

  it('does not throw when setItem throws', () => {
    const deps: DismissalDeps = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
    };
    expect(() => setDismissed(deps)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// shouldShowInstallPrompt
// ---------------------------------------------------------------------------

describe('shouldShowInstallPrompt', () => {
  it('returns true when mobile, not standalone, not dismissed', () => {
    const detect = makeDetectDeps();
    const dismissal = makeDismissalDeps();
    expect(shouldShowInstallPrompt(detect, dismissal)).toBe(true);
  });

  it('returns false when not mobile', () => {
    const detect = makeDetectDeps({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      maxTouchPoints: 0,
    });
    expect(shouldShowInstallPrompt(detect, makeDismissalDeps())).toBe(false);
  });

  it('returns false when standalone', () => {
    const detect = makeDetectDeps({
      matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' }),
    });
    expect(shouldShowInstallPrompt(detect, makeDismissalDeps())).toBe(false);
  });

  it('returns false when dismissed', () => {
    const detect = makeDetectDeps();
    const dismissal = makeDismissalDeps({ 'pwa-install-dismissed': '1' });
    expect(shouldShowInstallPrompt(detect, dismissal)).toBe(false);
  });
});
