/**
 * Browser Context Detector — determines whether the app is running inside
 * the installed PWA (standalone) or in a regular browser tab, and whether
 * the device is iOS.
 *
 * All detection functions accept injectable dependency objects so they can be
 * tested without a real browser environment (same pattern as install-prompt.ts).
 */

import { isStandaloneMode as _isStandaloneMode } from './install-prompt';

// Re-export for convenience so consumers can import from one place.
export { _isStandaloneMode as isStandaloneMode };

// ---------------------------------------------------------------------------
// Dependency interface
// ---------------------------------------------------------------------------

/** Dependencies for browser-context detection (injectable for testing). */
export interface BrowserContextDeps {
  userAgent: string;
  matchMedia: (query: string) => { matches: boolean };
  standalone?: boolean; // navigator.standalone (iOS)
  locationSearch: string; // window.location.search
  maxTouchPoints?: number; // navigator.maxTouchPoints (for iPadOS detection)
}

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the user-agent indicates an iOS device.
 *
 * Matches iPhone, iPad, or iPod combined with AppleWebKit, but excludes
 * Chrome on iOS (CriOS) and Firefox on iOS (FxiOS) since those browsers
 * cannot add PWAs to the home screen.
 *
 * Also detects iPadOS 13+ which reports a macOS desktop user-agent
 * ("Macintosh") — identified by AppleWebKit + touch support.
 */
export function isIOSDevice(deps: BrowserContextDeps): boolean {
  const ua = deps.userAgent;
  const isNotChromeIOS = !/CriOS/i.test(ua);
  const isNotFirefoxIOS = !/FxiOS/i.test(ua);

  if (!isNotChromeIOS || !isNotFirefoxIOS) return false;

  const hasWebKit = /AppleWebKit/i.test(ua);
  if (!hasWebKit) return false;

  // Classic iOS tokens (iPhone, iPod, older iPads)
  const hasIOSToken = /iPhone|iPad|iPod/i.test(ua);
  if (hasIOSToken) return true;

  // iPadOS 13+ reports a macOS UA — detect via Macintosh + touch support
  const isMacUA = /Macintosh/i.test(ua);
  const hasTouch = (deps.maxTouchPoints ?? 0) > 0;
  return isMacUA && hasTouch;
}

/**
 * Returns `true` when the PWA redirect banner should be shown.
 *
 * All three conditions must be met:
 * 1. The URL contains a `?list=` query parameter.
 * 2. The device is an iOS device (Safari).
 * 3. The app is running in a browser tab (not standalone mode).
 */
export function shouldShowRedirectBanner(deps: BrowserContextDeps): boolean {
  const params = new URLSearchParams(deps.locationSearch);
  const hasListParam = params.has('list');

  if (!hasListParam) return false;
  if (!isIOSDevice(deps)) return false;
  // isStandaloneMode expects DetectDeps (which includes maxTouchPoints).
  // BrowserContextDeps omits maxTouchPoints since it's not needed for
  // standalone detection — bridge the gap with a compatible object.
  const standaloneDeps = {
    ...deps,
    maxTouchPoints: 0, // unused by isStandaloneMode, satisfies DetectDeps
  };
  if (_isStandaloneMode(standaloneDeps)) return false;

  return true;
}
