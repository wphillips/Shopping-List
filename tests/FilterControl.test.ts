/**
 * Unit tests for FilterControl component
 * Tests Requirements 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterControl } from '../src/components/FilterControl';
import { FilterMode } from '../src/types';
describe('FilterControl Component', () => {
  let filterControl: FilterControl;
  let onFilterChangeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFilterChangeMock = vi.fn();
    
    filterControl = new FilterControl({
      currentFilter: 'all',
      onFilterChange: onFilterChangeMock as (mode: FilterMode) => void,
    });
  });

  describe('Rendering (Requirement 7.1)', () => {
    it('should create filter control with three mode buttons', () => {
      const element = filterControl.getElement();
      
      expect(element.className).toBe('filter-control');
      expect(element.getAttribute('role')).toBe('group');
      expect(element.getAttribute('aria-label')).toBe('Filter items by status');
      
      const buttons = element.querySelectorAll('button');
      expect(buttons.length).toBe(3);
    });

    it('should render buttons with correct labels', () => {
      const element = filterControl.getElement();
      const buttons = Array.from(element.querySelectorAll('button'));
      
      expect(buttons[0].textContent).toBe('All');
      expect(buttons[1].textContent).toBe('Unchecked');
      expect(buttons[2].textContent).toBe('Checked');
    });

    it('should set correct data attributes on buttons', () => {
      const element = filterControl.getElement();
      const buttons = Array.from(element.querySelectorAll('button'));
      
      expect(buttons[0].getAttribute('data-filter-mode')).toBe('all');
      expect(buttons[1].getAttribute('data-filter-mode')).toBe('unchecked');
      expect(buttons[2].getAttribute('data-filter-mode')).toBe('checked');
    });

    it('should set correct aria-label on buttons', () => {
      const element = filterControl.getElement();
      const buttons = Array.from(element.querySelectorAll('button'));
      
      expect(buttons[0].getAttribute('aria-label')).toBe('Show all items');
      expect(buttons[1].getAttribute('aria-label')).toBe('Show unchecked items');
      expect(buttons[2].getAttribute('aria-label')).toBe('Show checked items');
    });
  });

  describe('Active Filter Highlighting (Requirement 7.1)', () => {
    it('should highlight currently active filter mode on initialization', () => {
      const element = filterControl.getElement();
      const allButton = element.querySelector('[data-filter-mode="all"]') as HTMLButtonElement;
      const uncheckedButton = element.querySelector('[data-filter-mode="unchecked"]') as HTMLButtonElement;
      const checkedButton = element.querySelector('[data-filter-mode="checked"]') as HTMLButtonElement;
      
      expect(allButton.classList.contains('active')).toBe(true);
      expect(allButton.getAttribute('aria-pressed')).toBe('true');
      expect(uncheckedButton.classList.contains('active')).toBe(false);
      expect(uncheckedButton.getAttribute('aria-pressed')).toBe('false');
      expect(checkedButton.classList.contains('active')).toBe(false);
      expect(checkedButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('should highlight unchecked filter when initialized with unchecked mode', () => {
      const uncheckedFilter = new FilterControl({
        currentFilter: 'unchecked',
        onFilterChange: vi.fn(),
      });
      
      const element = uncheckedFilter.getElement();
      const uncheckedButton = element.querySelector('[data-filter-mode="unchecked"]') as HTMLButtonElement;
      
      expect(uncheckedButton.classList.contains('active')).toBe(true);
      expect(uncheckedButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should highlight checked filter when initialized with checked mode', () => {
      const checkedFilter = new FilterControl({
        currentFilter: 'checked',
        onFilterChange: vi.fn(),
      });
      
      const element = checkedFilter.getElement();
      const checkedButton = element.querySelector('[data-filter-mode="checked"]') as HTMLButtonElement;
      
      expect(checkedButton.classList.contains('active')).toBe(true);
      expect(checkedButton.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('Filter Change Handler (Requirements 7.2, 7.3, 7.4)', () => {
    it('should call onFilterChange when unchecked button is clicked', () => {
      const element = filterControl.getElement();
      const uncheckedButton = element.querySelector('[data-filter-mode="unchecked"]') as HTMLButtonElement;
      
      uncheckedButton.click();
      
      expect(onFilterChangeMock).toHaveBeenCalledWith('unchecked');
      expect(onFilterChangeMock).toHaveBeenCalledTimes(1);
    });

    it('should call onFilterChange when checked button is clicked', () => {
      const element = filterControl.getElement();
      const checkedButton = element.querySelector('[data-filter-mode="checked"]') as HTMLButtonElement;
      
      checkedButton.click();
      
      expect(onFilterChangeMock).toHaveBeenCalledWith('checked');
      expect(onFilterChangeMock).toHaveBeenCalledTimes(1);
    });

    it('should call onFilterChange when all button is clicked from different mode', () => {
      // Start with unchecked filter
      const uncheckedFilter = new FilterControl({
        currentFilter: 'unchecked',
        onFilterChange: onFilterChangeMock as (mode: FilterMode) => void,
      });
      
      const element = uncheckedFilter.getElement();
      const allButton = element.querySelector('[data-filter-mode="all"]') as HTMLButtonElement;
      
      allButton.click();
      
      expect(onFilterChangeMock).toHaveBeenCalledWith('all');
    });

    it('should not call onFilterChange when clicking already active button', () => {
      const element = filterControl.getElement();
      const allButton = element.querySelector('[data-filter-mode="all"]') as HTMLButtonElement;
      
      // Click the already active button
      allButton.click();
      
      expect(onFilterChangeMock).not.toHaveBeenCalled();
    });
  });

  describe('Update Active Filter', () => {
    it('should update active state when updateActiveFilter is called', () => {
      const element = filterControl.getElement();
      
      filterControl.updateActiveFilter('checked');
      
      const allButton = element.querySelector('[data-filter-mode="all"]') as HTMLButtonElement;
      const checkedButton = element.querySelector('[data-filter-mode="checked"]') as HTMLButtonElement;
      
      expect(allButton.classList.contains('active')).toBe(false);
      expect(allButton.getAttribute('aria-pressed')).toBe('false');
      expect(checkedButton.classList.contains('active')).toBe(true);
      expect(checkedButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should update active state multiple times correctly', () => {
      const element = filterControl.getElement();
      
      filterControl.updateActiveFilter('unchecked');
      let uncheckedButton = element.querySelector('[data-filter-mode="unchecked"]') as HTMLButtonElement;
      expect(uncheckedButton.classList.contains('active')).toBe(true);
      
      filterControl.updateActiveFilter('checked');
      uncheckedButton = element.querySelector('[data-filter-mode="unchecked"]') as HTMLButtonElement;
      const checkedButton = element.querySelector('[data-filter-mode="checked"]') as HTMLButtonElement;
      expect(uncheckedButton.classList.contains('active')).toBe(false);
      expect(checkedButton.classList.contains('active')).toBe(true);
      
      filterControl.updateActiveFilter('all');
      const allButton = element.querySelector('[data-filter-mode="all"]') as HTMLButtonElement;
      expect(allButton.classList.contains('active')).toBe(true);
      expect(checkedButton.classList.contains('active')).toBe(false);
    });
  });

  describe('Public Methods', () => {
    it('should return current filter via getCurrentFilter()', () => {
      expect(filterControl.getCurrentFilter()).toBe('all');
      
      filterControl.updateActiveFilter('checked');
      expect(filterControl.getCurrentFilter()).toBe('checked');
    });

    it('should return the DOM element via getElement()', () => {
      const element = filterControl.getElement();
      
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.className).toBe('filter-control');
    });
  });

  describe('Edge Cases', () => {
    it('should handle clicking on container but not on buttons', () => {
      const element = filterControl.getElement();
      
      // Click on the container itself
      element.click();
      
      expect(onFilterChangeMock).not.toHaveBeenCalled();
    });

    it('should handle rapid filter changes', () => {
      const element = filterControl.getElement();
      const uncheckedButton = element.querySelector('[data-filter-mode="unchecked"]') as HTMLButtonElement;
      const checkedButton = element.querySelector('[data-filter-mode="checked"]') as HTMLButtonElement;
      
      uncheckedButton.click();
      filterControl.updateActiveFilter('unchecked'); // Simulate state update
      
      checkedButton.click();
      filterControl.updateActiveFilter('checked'); // Simulate state update
      
      expect(onFilterChangeMock).toHaveBeenCalledTimes(2);
      expect(onFilterChangeMock).toHaveBeenNthCalledWith(1, 'unchecked');
      expect(onFilterChangeMock).toHaveBeenNthCalledWith(2, 'checked');
    });

    it('should maintain only one active button at a time', () => {
      const element = filterControl.getElement();
      
      filterControl.updateActiveFilter('unchecked');
      
      const buttons = Array.from(element.querySelectorAll('button'));
      const activeButtons = buttons.filter(btn => btn.classList.contains('active'));
      
      expect(activeButtons.length).toBe(1);
      expect(activeButtons[0].getAttribute('data-filter-mode')).toBe('unchecked');
    });
  });
});
