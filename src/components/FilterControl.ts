/**
 * FilterControl component for filtering items by checked status
 * Provides toggle buttons for 'all', 'checked', and 'unchecked' filter modes
 */

import { FilterMode } from '../types';

export interface FilterControlConfig {
  currentFilter: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
}

export class FilterControl {
  private element: HTMLElement;
  private config: FilterControlConfig;
  private buttons: Map<FilterMode, HTMLButtonElement>;

  constructor(config: FilterControlConfig) {
    this.config = config;
    this.buttons = new Map();
    this.element = this.createElement();
    this.attachEventListeners();
  }

  /**
   * Create the filter control element with three toggle buttons
   */
  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'filter-control';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Filter items by status');

    // Create buttons for each filter mode
    const modes: Array<{ mode: FilterMode; label: string }> = [
      { mode: 'all', label: 'All' },
      { mode: 'unchecked', label: 'Unchecked' },
      { mode: 'checked', label: 'Checked' },
    ];

    modes.forEach(({ mode, label }) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.setAttribute('data-filter-mode', mode);
      button.setAttribute('aria-label', `Show ${label.toLowerCase()} items`);
      
      // Set active class for current filter
      if (mode === this.config.currentFilter) {
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
      } else {
        button.setAttribute('aria-pressed', 'false');
      }

      this.buttons.set(mode, button);
      container.appendChild(button);
    });

    return container;
  }

  /**
   * Attach event listeners for button clicks
   */
  private attachEventListeners(): void {
    this.element.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      
      if (!button) return;

      const mode = button.getAttribute('data-filter-mode') as FilterMode;
      
      if (mode && mode !== this.config.currentFilter) {
        this.config.onFilterChange(mode);
      }
    });
  }

  /**
   * Update the active filter mode
   */
  updateActiveFilter(mode: FilterMode): void {
    this.config.currentFilter = mode;

    // Update button states
    this.buttons.forEach((button, buttonMode) => {
      if (buttonMode === mode) {
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
      } else {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
      }
    });
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Get the current filter mode
   */
  getCurrentFilter(): FilterMode {
    return this.config.currentFilter;
  }
}
