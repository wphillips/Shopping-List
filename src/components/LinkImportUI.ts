/**
 * Link Import UI — shown inside the installed PWA (standalone mode) to let
 * the user paste a shared list URL and import it.
 *
 * Follows the same class-based component pattern as InstallPromptBanner
 * and PwaRedirectBanner.
 */

// ---------------------------------------------------------------------------
// Config interface
// ---------------------------------------------------------------------------

export interface LinkImportUIConfig {
  onImport: (url: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// LinkImportUI component
// ---------------------------------------------------------------------------

/**
 * An inline panel with a text input, Import button, Cancel button, and a
 * hidden error message area. The user pastes a shared list URL and taps
 * Import to trigger the import flow.
 */
export class LinkImportUI {
  private element: HTMLElement;
  private config: LinkImportUIConfig;
  private input: HTMLInputElement;
  private errorEl: HTMLParagraphElement;

  constructor(config: LinkImportUIConfig) {
    this.config = config;
    this.input = document.createElement('input');
    this.errorEl = document.createElement('p');
    this.element = this.createElement();
  }

  /** Returns the component DOM element. */
  getElement(): HTMLElement {
    return this.element;
  }

  /** Shows an error message below the input. */
  showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.hidden = false;
  }

  /** Removes the component from the DOM. */
  remove(): void {
    this.element.remove();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'link-import-ui';

    // Text input for pasting a shared list URL
    this.input.type = 'text';
    this.input.className = 'link-import-ui__input';
    this.input.setAttribute('aria-label', 'Paste a shared list link');
    this.input.placeholder = 'Paste a shared list link';
    container.appendChild(this.input);

    // Button container
    const actions = document.createElement('div');
    actions.className = 'link-import-ui__actions';

    // Import button (primary style)
    const importBtn = document.createElement('button');
    importBtn.className = 'link-import-ui__import-btn';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => {
      this.config.onImport(this.input.value);
    });
    actions.appendChild(importBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'link-import-ui__cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.config.onCancel());
    actions.appendChild(cancelBtn);

    container.appendChild(actions);

    // Error message (hidden by default)
    this.errorEl.className = 'link-import-ui__error';
    this.errorEl.hidden = true;
    container.appendChild(this.errorEl);

    return container;
  }
}
