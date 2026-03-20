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
 */
export function isIOSDevice(deps: BrowserContextDeps): boolean {
  const ua = deps.userAgent;
  const hasIOSToken = /iPhone|iPad|iPod/i.test(ua);
  const hasWebKit = /AppleWebKit/i.test(ua);
  const isNotChromeIOS = !/CriOS/i.test(ua);
  const isNotFirefoxIOS = !/FxiOS/i.test(ua);
  return hasIOSToken && hasWebKit && isNotChromeIOS && isNotFirefoxIOS;
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
