/**
 * Integration tests for InputField with StateManager
 * Verifies Requirements 4.1, 4.2, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager } from '../src/state';
import { InputField } from '../src/components/InputField';
import { MultiListState } from '../src/types';

/** Helper: get the active list from a MultiListState */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

describe('InputField Integration with StateManager', () => {
  let stateManager: StateManager;
  let inputField: InputField;
  let filteredItems: any[];
  let sectionId: string;

  beforeEach(() => {
    vi.useFakeTimers();
    // Create state manager with a test section
    stateManager = new StateManager();
    stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });

    sectionId = al(stateManager.getState()).sections[0].id;

    // Add some test items
    stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
    stateManager.dispatch({ type: 'ADD_ITEM', name: 'Bananas', sectionId });
    stateManager.dispatch({ type: 'ADD_ITEM', name: 'Carrots', sectionId });

    // Create InputField with state manager integration
    inputField = new InputField({
      placeholder: 'Add item or search...',
      onInput: (text: string) => {
        filteredItems = stateManager.filterItemsByText(text);
      },
      onSubmit: (text: string) => {
        const list = al(stateManager.getState());
        if (list.sections.length > 0) {
          stateManager.dispatch({
            type: 'ADD_ITEM',
            name: text,
            sectionId: list.sections[0].id,
          });
        }
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Text-based Filtering (Requirement 4.2)', () => {
    it('should filter items when user types in input field', () => {
      const element = inputField.getElement();

      // Type "app" to filter
      element.value = 'app';
      element.dispatchEvent(new Event('input'));

      // Advance past debounce delay
      vi.advanceTimersByTime(300);

      expect(filteredItems).toHaveLength(1);
      expect(filteredItems[0].name).toBe('Apples');
    });

    it('should show all items when input is empty', () => {
      const element = inputField.getElement();

      element.value = '';
      element.dispatchEvent(new Event('input'));

      expect(filteredItems).toHaveLength(3);
    });

    it('should perform case-insensitive filtering (Requirement 4.3)', () => {
      const element = inputField.getElement();

      // Type "BANANA" in uppercase
      element.value = 'BANANA';
      element.dispatchEvent(new Event('input'));

      // Advance past debounce delay
      vi.advanceTimersByTime(300);

      expect(filteredItems).toHaveLength(1);
      expect(filteredItems[0].name).toBe('Bananas');
    });

    it('should show no items when filter matches nothing', () => {
      const element = inputField.getElement();

      element.value = 'xyz';
      element.dispatchEvent(new Event('input'));

      // Advance past debounce delay
      vi.advanceTimersByTime(300);

      expect(filteredItems).toHaveLength(0);
    });
  });

  describe('Item Addition (Requirement 4.5)', () => {
    it('should add new item to selected section on submit', () => {
      const element = inputField.getElement();
      const initialItemCount = al(stateManager.getState()).items.length;

      element.value = 'Oranges';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);

      const list = al(stateManager.getState());
      expect(list.items).toHaveLength(initialItemCount + 1);

      const newItem = list.items.find((item) => item.name === 'Oranges');
      expect(newItem).toBeDefined();
      expect(newItem?.quantity).toBe(1);
      expect(newItem?.isChecked).toBe(false);
    });

    it('should clear input after adding item', () => {
      const element = inputField.getElement();

      element.value = 'Grapes';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);

      expect(element.value).toBe('');
    });

    it('should allow duplicate item names (Requirement 4.6)', () => {
      const element = inputField.getElement();

      // Add "Apples" again (already exists)
      element.value = 'Apples';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);

      const list = al(stateManager.getState());
      const appleItems = list.items.filter((item) => item.name === 'Apples');

      expect(appleItems).toHaveLength(2);
      expect(appleItems[0].id).not.toBe(appleItems[1].id);
    });

    it('should not add empty items', () => {
      const element = inputField.getElement();
      const initialItemCount = al(stateManager.getState()).items.length;

      element.value = '';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);

      expect(al(stateManager.getState()).items).toHaveLength(initialItemCount);
    });

    it('should not add whitespace-only items', () => {
      const element = inputField.getElement();
      const initialItemCount = al(stateManager.getState()).items.length;

      element.value = '   ';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);

      expect(al(stateManager.getState()).items).toHaveLength(initialItemCount);
    });
  });

  describe('Combined Filtering and Addition', () => {
    it('should clear filter after adding item', () => {
      const element = inputField.getElement();

      // First, filter items
      element.value = 'app';
      element.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(300);
      expect(filteredItems).toHaveLength(1);

      // Then submit to add item
      element.value = 'Pineapple';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);

      // Filter should be cleared (onInput called with empty string)
      expect(filteredItems).toHaveLength(4); // All items visible
    });
  });
});
