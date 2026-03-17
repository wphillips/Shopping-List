/**
 * PWA Install Prompt — detection utilities and banner component.
 *
 * All detection functions accept injectable dependency objects so they can be
 * tested without a real browser environment.
 */

// ---------------------------------------------------------------------------
// Ambient type for the non-standard BeforeInstallPromptEvent
// ---------------------------------------------------------------------------

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ---------------------------------------------------------------------------
// Dependency interfaces
// ---------------------------------------------------------------------------

/** Dependencies for device / context detection (injectable for testing). */
export interface DetectDeps {
  userAgent: string;
  maxTouchPoints: number;
  matchMedia: (query: string) => { matches: boolean };
  standalone?: boolean; // navigator.standalone (iOS)
}

/** Dependencies for dismissal persistence. */
export interface DismissalDeps {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Config for the InstallPromptBanner component. */
export interface InstallPromptBannerConfig {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isIOS: boolean;
  onDismiss: () => void;
  onInstallAccepted: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISSAL_KEY = 'pwa-install-dismissed';

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the user-agent contains a mobile platform identifier
 * (Android, iPhone, iPad) **and** the device reports touch capability.
 */
export function isMobileDevice(deps: DetectDeps): boolean {
  const ua = deps.userAgent;
  const hasMobileUA = /Android|iPhone|iPad/i.test(ua);
  return hasMobileUA && deps.maxTouchPoints > 0;
}

/**
 * Returns `true` when the app is running in standalone (installed) mode.
 * Checks the `display-mode: standalone` media query and the iOS-specific
 * `navigator.standalone` property.
 */
export function isStandaloneMode(deps: DetectDeps): boolean {
  const mediaMatch = deps.matchMedia('(display-mode: standalone)').matches;
  return mediaMatch || deps.standalone === true;
}

/**
 * Returns `true` when the user-agent indicates iOS Safari.
 * iOS Safari UAs contain "iPhone" or "iPad" (or "iPod") together with
 * "AppleWebKit" but do **not** contain "CriOS" or "FxiOS" (Chrome/Firefox
 * on iOS use those tokens).
 */
export function isIOSSafari(deps: DetectDeps): boolean {
  const ua = deps.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWebKit = /AppleWebKit/i.test(ua);
  const isNotChrome = !/CriOS/i.test(ua);
  const isNotFirefox = !/FxiOS/i.test(ua);
  return isIOS && isWebKit && isNotChrome && isNotFirefox;
}

/**
 * Returns `true` when the dismissal flag exists in storage.
 */
export function isDismissed(deps: DismissalDeps): boolean {
  try {
    return deps.getItem(DISMISSAL_KEY) !== null;
  } catch {
    // localStorage may throw in private browsing — treat as not dismissed.
    return false;
  }
}

/**
 * Persists the dismissal flag so the banner won't appear again.
 */
export function setDismissed(deps: DismissalDeps): void {
  try {
    deps.setItem(DISMISSAL_KEY, '1');
  } catch {
    // Silently ignore — banner may reappear next visit, which is acceptable.
  }
}

/**
 * Top-level gate: should the install-prompt banner be shown?
 *
 * Returns `true` only when the device is mobile, the app is **not** running
 * in standalone mode, and the user has **not** previously dismissed the banner.
 */
export function shouldShowInstallPrompt(
  detectDeps: DetectDeps,
  dismissalDeps: DismissalDeps,
): boolean {
  return (
    isMobileDevice(detectDeps) &&
    !isStandaloneMode(detectDeps) &&
    !isDismissed(dismissalDeps)
  );
}

// ---------------------------------------------------------------------------
// InstallPromptBanner component
// ---------------------------------------------------------------------------

/**
 * A dismissible banner that prompts the user to install the PWA.
 *
 * - When `deferredPrompt` is provided, renders an "Install" button that
 *   triggers the native install dialog.
 * - When `deferredPrompt` is null and `isIOS` is true, renders manual
 *   instructions for iOS Safari.
 * - When `deferredPrompt` is null and `isIOS` is false, renders a generic
 *   "Add to Home Screen" message.
 */
export class InstallPromptBanner {
  private element: HTMLElement;
  private config: InstallPromptBannerConfig;

  constructor(config: InstallPromptBannerConfig) {
    this.config = config;
    this.element = this.createElement();
  }

  /**
   * Returns the banner DOM element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Removes the banner from the DOM.
   */
  remove(): void {
    this.element.remove();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private createElement(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'install-prompt-banner';
    banner.setAttribute('role', 'banner');

    // Message text
    const message = document.createElement('p');
    message.className = 'install-prompt-message';

    if (this.config.deferredPrompt) {
      message.textContent =
        'Save this grocery list app to your home screen for quick access.';

      // Install button (native flow)
      const installBtn = document.createElement('button');
      installBtn.className = 'install-prompt-install';
      installBtn.setAttribute('aria-label', 'Install');
      installBtn.textContent = 'Install';
      installBtn.addEventListener('click', () => this.handleInstallClick());

      banner.appendChild(message);
      banner.appendChild(installBtn);
    } else if (this.config.isIOS) {
      message.textContent =
        'To install this app, tap Share then "Add to Home Screen".';
      banner.appendChild(message);
    } else {
      message.textContent =
        'Add this app to your home screen for quick access.';
      banner.appendChild(message);
    }

    // Dismiss button (always present)
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'install-prompt-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss install prompt');
    dismissBtn.textContent = '\u00d7'; // × character
    dismissBtn.addEventListener('click', () => this.config.onDismiss());

    banner.appendChild(dismissBtn);

    return banner;
  }

  private async handleInstallClick(): Promise<void> {
    const { deferredPrompt } = this.config;
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.config.onInstallAccepted();
      }
      // If dismissed, banner stays visible so the user can try again.
    } catch (error) {
      // Log and leave banner visible so the user can dismiss manually.
      console.error('Install prompt error:', error);
    }
  }
}
