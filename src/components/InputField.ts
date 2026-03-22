/**
 * InputField component for adding items and filtering
 * Dual-purpose: triggers filtering on input and adds items on submit
 */

export interface InputFieldConfig {
  placeholder: string;
  onInput: (text: string) => void;
  onSubmit: (text: string) => void;
}

export class InputField {
  private wrapper: HTMLDivElement;
  private clearButton: HTMLButtonElement;
  private element: HTMLInputElement;
  private config: InputFieldConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_DELAY = 300;

  constructor(config: InputFieldConfig) {
    this.config = config;
    this.element = this.createElement();
    this.clearButton = this.createClearButton();
    this.wrapper = this.createWrapper();
    this.attachEventListeners();
  }

  /**
   * Create the input element
   */
  private createElement(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.config.placeholder;
    input.className = 'input-field';
    input.setAttribute('aria-label', 'Add or search items');
    return input;
  }

  /**
   * Create the wrapper div containing input and clear button
   */
  private createWrapper(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field-wrapper';
    wrapper.style.position = 'relative';
    wrapper.appendChild(this.element);
    wrapper.appendChild(this.clearButton);
    return wrapper;
  }

  /**
   * Create the clear button element
   */
  private createClearButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '✕';
    button.className = 'input-field-clear-btn';
    button.setAttribute('aria-label', 'Clear search');
    button.style.display = 'none';
    button.setAttribute('tabindex', '-1');
    return button;
  }

  /**
   * Attach event listeners for input, submit, and clear
   */
  private attachEventListeners(): void {
    // Handle input for filtering with debounce
    this.element.addEventListener('input', () => {
      const value = this.element.value;

      // Cancel any pending debounce timer
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      // Update clear button visibility based on current input
      this.updateClearButtonVisibility();

      // Empty input bypasses debounce for immediate feedback
      if (value === '') {
        this.config.onInput('');
        return;
      }

      // Start a new debounce timer
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.config.onInput(value);
      }, this.DEBOUNCE_DELAY);
    });

    // Handle Enter key for submission
    this.element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.handleSubmit();
      }
    });

    // Handle clear button click
    this.clearButton.addEventListener('click', () => {
      this.handleClearClick();
    });
  }

  /**
   * Update clear button visibility based on input content
   */
  private updateClearButtonVisibility(): void {
    if (this.element.value !== '') {
      this.clearButton.style.display = 'flex';
      this.clearButton.removeAttribute('tabindex');
    } else {
      this.clearButton.style.display = 'none';
      this.clearButton.setAttribute('tabindex', '-1');
    }
  }

  /**
   * Handle clear button click
   * Cancels debounce, clears input, invokes callback, focuses input
   */
  private handleClearClick(): void {
    // Cancel any pending debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.element.value = '';
    this.config.onInput('');
    this.element.focus();
    this.updateClearButtonVisibility();
  }

  /**
   * Handle form submission
   * Validates input and calls onSubmit callback
   */
  private handleSubmit(): void {
    const value = this.element.value.trim();

    // Cancel any pending debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Validate: reject empty or whitespace-only input
    if (value === '') {
      return;
    }

    // Call the submit callback
    this.config.onSubmit(value);

    // Clear the input field and invoke onInput immediately
    this.clear();
  }

  /**
   * Clear the input field
   */
  clear(): void {
    // Cancel any pending debounce timer
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.element.value = '';
    // Trigger input event to clear any active filtering
    this.config.onInput('');
    // Update clear button visibility
    this.updateClearButtonVisibility();
  }

  /**
   * Cancel any pending debounce timer for component cleanup
   */
  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Get the DOM element (wrapper containing input and clear button)
   */
  getElement(): HTMLDivElement {
    return this.wrapper;
  }

  /**
   * Get the underlying input element
   */
  getInputElement(): HTMLInputElement {
    return this.element;
  }

  /**
   * Get the current value
   */
  getValue(): string {
    return this.element.value;
  }

  /**
   * Set focus on the input field
   */
  focus(): void {
    this.element.focus();
  }
}
