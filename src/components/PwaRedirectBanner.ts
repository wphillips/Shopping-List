/**
 * PWA Redirect Banner — shown when a shared list link is opened in a
 * browser on iOS, guiding the user to copy the link and open it in the
 * installed PWA.
 *
 * Follows the same class-based component pattern as InstallPromptBanner.
 */

import { copyToClipboard, CopyResult, ClipboardDeps } from '../clipboard-helper';

// ---------------------------------------------------------------------------
// Config interface
// ---------------------------------------------------------------------------

export interface PwaRedirectBannerConfig {
  pageUrl: string;
  onDismiss: () => void;
  onCopyResult: (result: CopyResult) => void;
}

// ---------------------------------------------------------------------------
// PwaRedirectBanner component
// ---------------------------------------------------------------------------

/**
 * A dismissible banner that explains the iOS browser/PWA gap and provides
 * step-by-step instructions plus a "Copy Link" button.
 */
export class PwaRedirectBanner {
  private element: HTMLElement;
  private config: PwaRedirectBannerConfig;

  constructor(config: PwaRedirectBannerConfig) {
    this.config = config;
    this.element = this.createElement();
  }

  /** Returns the banner DOM element. */
  getElement(): HTMLElement {
    return this.element;
  }

  /** Removes the banner from the DOM. */
  remove(): void {
    this.element.remove();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private createElement(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'pwa-redirect-banner';
    banner.setAttribute('role', 'alert');

    // Explanatory message
    const message = document.createElement('p');
    message.className = 'pwa-redirect-banner__message';
    message.textContent =
      'This shared list was opened in your browser and won\u2019t appear in your installed app. Follow these steps to import it:';
    banner.appendChild(message);

    // Numbered instruction list
    const list = document.createElement('ol');
    list.className = 'pwa-redirect-banner__instructions';
    const steps = [
      'Tap "Copy Link" below to copy the share URL.',
      'Open the installed app from your home screen.',
      'Tap "Import from Link" in the app.',
      'Paste the link and import.',
    ];
    for (const step of steps) {
      const li = document.createElement('li');
      li.textContent = step;
      list.appendChild(li);
    }
    banner.appendChild(list);

    // Button container
    const actions = document.createElement('div');
    actions.className = 'pwa-redirect-banner__actions';

    // Copy Link button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'pwa-redirect-banner__copy-btn';
    copyBtn.setAttribute('aria-label', 'Copy Link');
    copyBtn.textContent = 'Copy Link';
    copyBtn.addEventListener('click', () => this.handleCopyClick(copyBtn));
    actions.appendChild(copyBtn);

    // Dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'pwa-redirect-banner__dismiss-btn';
    dismissBtn.setAttribute('aria-label', 'Dismiss redirect banner');
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => this.config.onDismiss());
    actions.appendChild(dismissBtn);

    banner.appendChild(actions);

    return banner;
  }

  private async handleCopyClick(button: HTMLButtonElement): Promise<void> {
    const deps: ClipboardDeps = {
      clipboardWriteText: navigator.clipboard?.writeText
        ? (text: string) => navigator.clipboard.writeText(text)
        : undefined,
      document: {
        createElement: (tag: string) => document.createElement(tag),
        body: {
          appendChild: (el: HTMLElement) => document.body.appendChild(el),
          removeChild: (el: HTMLElement) => document.body.removeChild(el),
        },
        execCommand: (cmd: string) => document.execCommand(cmd),
      },
    };

    const result = await copyToClipboard(this.config.pageUrl, deps);

    if (result.status === 'copied') {
      button.textContent = 'Link copied \u2713';
    } else {
      button.textContent = 'Copy failed \u2013 try manually';
    }

    this.config.onCopyResult(result);
  }
}
