/**
 * Unit tests for state management module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager, createStateManager } from '../src/state';
import { MultiListState } from '../src/types';
import * as storage from '../src/storage';

// Mock the storage module
vi.mock('../src/storage', () => ({
  saveMultiListState: vi.fn(),
  loadMultiListState: vi.fn(() => {
    const listId = 'test-list-id';
    return {
      lists: [{
        id: listId,
        name: 'My Grocery List',
        sections: [],
        items: [],
        createdAt: Date.now(),
      }],
      activeListId: listId,
      filterMode: 'all' as const,
      collapsedSections: new Set<string>(),
      version: 2,
    };
  }),
  createDefaultMultiListState: vi.fn(() => {
    const listId = 'default-list-id';
    return {
      lists: [{
        id: listId,
        name: 'My Grocery List',
        sections: [],
        items: [],
        createdAt: Date.now(),
      }],
      activeListId: listId,
      filterMode: 'all' as const,
      collapsedSections: new Set<string>(),
      version: 2,
    };
  }),
  StorageQuotaExceededError: class StorageQuotaExceededError extends Error {
    constructor(message = 'Storage quota exceeded') {
      super(message);
      this.name = 'StorageQuotaExceededError';
    }
  },
}));

/** Helper: get the active list from a MultiListState */
function activeList(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager();
  });

  describe('Initialization', () => {
    it('should initialize with empty state', () => {
      const state = stateManager.getState();
      const list = activeList(state);
      expect(list.sections).toEqual([]);
      expect(list.items).toEqual([]);
      expect(state.filterMode).toBe('all');
      expect(state.collapsedSections.size).toBe(0);
    });

    it('should initialize with provided state', () => {
      const listId = 'custom-list';
      const initialState: MultiListState = {
        lists: [{
          id: listId,
          name: 'Test List',
          sections: [{ id: '1', name: 'Test', order: 0, createdAt: Date.now() }],
          items: [],
          createdAt: Date.now(),
        }],
        activeListId: listId,
        filterMode: 'checked',
        collapsedSections: new Set(['1']),
        version: 2,
      };
      const manager = new StateManager(initialState);
      const state = manager.getState();
      const list = activeList(state);
      expect(list.sections).toHaveLength(1);
      expect(state.filterMode).toBe('checked');
    });
  });

  describe('Section Management', () => {
    it('should add a new section', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const list = activeList(stateManager.getState());

      expect(list.sections).toHaveLength(1);
      expect(list.sections[0].name).toBe('Produce');
      expect(list.sections[0].order).toBe(0);
      expect(list.sections[0].id).toBeDefined();
      expect(list.sections[0].createdAt).toBeDefined();
    });

    it('should add multiple sections with correct order', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Bakery' });

      const list = activeList(stateManager.getState());
      expect(list.sections).toHaveLength(3);
      expect(list.sections[0].order).toBe(0);
      expect(list.sections[1].order).toBe(1);
      expect(list.sections[2].order).toBe(2);
    });

    it('should delete a section', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const sectionId = activeList(stateManager.getState()).sections[0].id;

      stateManager.dispatch({ type: 'DELETE_SECTION', id: sectionId });
      const list = activeList(stateManager.getState());

      expect(list.sections).toHaveLength(0);
    });

    it('should delete section and all its items', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const sectionId = activeList(stateManager.getState()).sections[0].id;

      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Bananas', sectionId });

      expect(activeList(stateManager.getState()).items).toHaveLength(2);

      stateManager.dispatch({ type: 'DELETE_SECTION', id: sectionId });
      const list = activeList(stateManager.getState());

      expect(list.sections).toHaveLength(0);
      expect(list.items).toHaveLength(0);
    });

    it('should reorder sections after deletion', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Bakery' });

      const middleSectionId = activeList(stateManager.getState()).sections[1].id;
      stateManager.dispatch({ type: 'DELETE_SECTION', id: middleSectionId });

      const list = activeList(stateManager.getState());
      expect(list.sections).toHaveLength(2);
      expect(list.sections[0].order).toBe(0);
      expect(list.sections[1].order).toBe(1);
    });

    it('should toggle section collapse state', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const sectionId = activeList(stateManager.getState()).sections[0].id;

      stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });
      expect(stateManager.getState().collapsedSections.has(sectionId)).toBe(true);

      stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });
      expect(stateManager.getState().collapsedSections.has(sectionId)).toBe(false);
    });

    it('should move section up', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });

      const dairyId = activeList(stateManager.getState()).sections[1].id;
      stateManager.dispatch({ type: 'MOVE_SECTION_UP', id: dairyId });

      const list = activeList(stateManager.getState());
      expect(list.sections[0].name).toBe('Dairy');
      expect(list.sections[1].name).toBe('Produce');
      expect(list.sections[0].order).toBe(0);
      expect(list.sections[1].order).toBe(1);
    });

    it('should not move top section up', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const produceId = activeList(stateManager.getState()).sections[0].id;

      stateManager.dispatch({ type: 'MOVE_SECTION_UP', id: produceId });

      const list = activeList(stateManager.getState());
      expect(list.sections[0].name).toBe('Produce');
      expect(list.sections[0].order).toBe(0);
    });

    it('should move section down', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });

      const produceId = activeList(stateManager.getState()).sections[0].id;
      stateManager.dispatch({ type: 'MOVE_SECTION_DOWN', id: produceId });

      const list = activeList(stateManager.getState());
      expect(list.sections[0].name).toBe('Dairy');
      expect(list.sections[1].name).toBe('Produce');
      expect(list.sections[0].order).toBe(0);
      expect(list.sections[1].order).toBe(1);
    });

    it('should not move bottom section down', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });

      const dairyId = activeList(stateManager.getState()).sections[1].id;
      stateManager.dispatch({ type: 'MOVE_SECTION_DOWN', id: dairyId });

      const list = activeList(stateManager.getState());
      expect(list.sections[1].name).toBe('Dairy');
      expect(list.sections[1].order).toBe(1);
    });

    it('should rename a section', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const sectionId = activeList(stateManager.getState()).sections[0].id;

      stateManager.dispatch({ type: 'RENAME_SECTION', id: sectionId, name: 'Fruits' });
      const list = activeList(stateManager.getState());

      expect(list.sections[0].name).toBe('Fruits');
    });

    it('should return state unchanged when renaming with non-existent ID', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      const listBefore = activeList(stateManager.getState());

      stateManager.dispatch({ type: 'RENAME_SECTION', id: 'non-existent-id', name: 'Fruits' });
      const listAfter = activeList(stateManager.getState());

      expect(listAfter.sections).toEqual(listBefore.sections);
    });

    it('should only rename the targeted section', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });
      const produceId = activeList(stateManager.getState()).sections[0].id;

      stateManager.dispatch({ type: 'RENAME_SECTION', id: produceId, name: 'Fruits' });
      const list = activeList(stateManager.getState());

      expect(list.sections[0].name).toBe('Fruits');
      expect(list.sections[1].name).toBe('Dairy');
    });
  });

  describe('Item Management', () => {
    let sectionId: string;

    beforeEach(() => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      sectionId = activeList(stateManager.getState()).sections[0].id;
    });

    it('should add a new item', () => {
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const list = activeList(stateManager.getState());

      expect(list.items).toHaveLength(1);
      expect(list.items[0].name).toBe('Apples');
      expect(list.items[0].quantity).toBe(1);
      expect(list.items[0].isChecked).toBe(false);
      expect(list.items[0].sectionId).toBe(sectionId);
      expect(list.items[0].id).toBeDefined();
      expect(list.items[0].createdAt).toBeDefined();
    });

    it('should delete an item', () => {
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const itemId = activeList(stateManager.getState()).items[0].id;

      stateManager.dispatch({ type: 'DELETE_ITEM', id: itemId });
      const list = activeList(stateManager.getState());

      expect(list.items).toHaveLength(0);
    });

    it('should toggle item check state', () => {
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const itemId = activeList(stateManager.getState()).items[0].id;

      stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: itemId });
      expect(activeList(stateManager.getState()).items[0].isChecked).toBe(true);

      stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: itemId });
      expect(activeList(stateManager.getState()).items[0].isChecked).toBe(false);
    });

    it('should increment item quantity', () => {
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const itemId = activeList(stateManager.getState()).items[0].id;

      stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
      expect(activeList(stateManager.getState()).items[0].quantity).toBe(2);

      stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
      expect(activeList(stateManager.getState()).items[0].quantity).toBe(3);
    });

    it('should decrement item quantity', () => {
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const itemId = activeList(stateManager.getState()).items[0].id;

      stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
      stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
      expect(activeList(stateManager.getState()).items[0].quantity).toBe(3);

      stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });
      expect(activeList(stateManager.getState()).items[0].quantity).toBe(2);
    });

    it('should not decrement quantity below 1', () => {
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const itemId = activeList(stateManager.getState()).items[0].id;

      expect(activeList(stateManager.getState()).items[0].quantity).toBe(1);

      stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });
      expect(activeList(stateManager.getState()).items[0].quantity).toBe(1);
    });

    it('should move item to different section', () => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });
      const dairyId = activeList(stateManager.getState()).sections[1].id;

      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      const itemId = activeList(stateManager.getState()).items[0].id;

      stateManager.dispatch({
        type: 'MOVE_ITEM_TO_SECTION',
        itemId,
        targetSectionId: dairyId
      });

      const list = activeList(stateManager.getState());
      expect(list.items[0].sectionId).toBe(dairyId);
    });
  });

  describe('Filter and UI State', () => {
    it('should set filter mode', () => {
      stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'checked' });
      expect(stateManager.getState().filterMode).toBe('checked');

      stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'unchecked' });
      expect(stateManager.getState().filterMode).toBe('unchecked');

      stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'all' });
      expect(stateManager.getState().filterMode).toBe('all');
    });
  });

  describe('Item Filtering', () => {
    let sectionId: string;

    beforeEach(() => {
      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      sectionId = activeList(stateManager.getState()).sections[0].id;

      // Add test items
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Bananas', sectionId });
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Carrots', sectionId });
      stateManager.dispatch({ type: 'ADD_ITEM', name: 'Dates', sectionId });
    });

    describe('getVisibleItems', () => {
      it('should return all items when filter mode is "all"', () => {
        stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'all' });
        const visibleItems = stateManager.getVisibleItems();
        expect(visibleItems).toHaveLength(4);
      });

      it('should return only checked items when filter mode is "checked"', () => {
        const items = activeList(stateManager.getState()).items;
        stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: items[0].id });
        stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: items[2].id });

        stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'checked' });
        const visibleItems = stateManager.getVisibleItems();

        expect(visibleItems).toHaveLength(2);
        expect(visibleItems.every(item => item.isChecked)).toBe(true);
        expect(visibleItems.map(item => item.name)).toEqual(['Apples', 'Carrots']);
      });

      it('should return only unchecked items when filter mode is "unchecked"', () => {
        const items = activeList(stateManager.getState()).items;
        stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: items[0].id });
        stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: items[2].id });

        stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'unchecked' });
        const visibleItems = stateManager.getVisibleItems();

        expect(visibleItems).toHaveLength(2);
        expect(visibleItems.every(item => !item.isChecked)).toBe(true);
        expect(visibleItems.map(item => item.name)).toEqual(['Bananas', 'Dates']);
      });

      it('should return empty array when no items match filter', () => {
        const items = activeList(stateManager.getState()).items;
        items.forEach(item => {
          stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: item.id });
        });

        stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'unchecked' });
        const visibleItems = stateManager.getVisibleItems();

        expect(visibleItems).toHaveLength(0);
      });
    });

    describe('filterItemsByText', () => {
      it('should return all visible items when search text is empty', () => {
        const filteredItems = stateManager.filterItemsByText('');
        expect(filteredItems).toHaveLength(4);
      });

      it('should return all visible items when search text is whitespace', () => {
        const filteredItems = stateManager.filterItemsByText('   ');
        expect(filteredItems).toHaveLength(4);
      });

      it('should filter items by text (case-insensitive)', () => {
        const filteredItems = stateManager.filterItemsByText('app');
        expect(filteredItems).toHaveLength(1);
        expect(filteredItems[0].name).toBe('Apples');
      });

      it('should perform case-insensitive matching', () => {
        const filteredItems1 = stateManager.filterItemsByText('APPLES');
        expect(filteredItems1).toHaveLength(1);
        expect(filteredItems1[0].name).toBe('Apples');

        const filteredItems2 = stateManager.filterItemsByText('bAnAnAs');
        expect(filteredItems2).toHaveLength(1);
        expect(filteredItems2[0].name).toBe('Bananas');
      });

      it('should match partial text', () => {
        const filteredItems = stateManager.filterItemsByText('a');
        expect(filteredItems).toHaveLength(4);
        expect(filteredItems.map(item => item.name)).toEqual(['Apples', 'Bananas', 'Carrots', 'Dates']);
      });

      it('should return empty array when no items match', () => {
        const filteredItems = stateManager.filterItemsByText('xyz');
        expect(filteredItems).toHaveLength(0);
      });

      it('should combine text filtering with filter mode', () => {
        const items = activeList(stateManager.getState()).items;
        stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: items[0].id });
        stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: items[2].id });

        stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'checked' });

        const filteredItems = stateManager.filterItemsByText('a');

        expect(filteredItems).toHaveLength(2);
        expect(filteredItems.map(item => item.name)).toEqual(['Apples', 'Carrots']);
        expect(filteredItems.every(item => item.isChecked)).toBe(true);
      });

      it('should trim search text', () => {
        const filteredItems = stateManager.filterItemsByText('  apples  ');
        expect(filteredItems).toHaveLength(1);
        expect(filteredItems[0].name).toBe('Apples');
      });
    });
  });

  describe('State Persistence', () => {
    it('should call saveMultiListState after every action', () => {
      const saveSpy = vi.spyOn(storage, 'saveMultiListState');

      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      expect(saveSpy).toHaveBeenCalledTimes(1);

      stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'checked' });
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle saveMultiListState errors gracefully', () => {
      const saveSpy = vi.spyOn(storage, 'saveMultiListState').mockImplementation(() => {
        throw new Error('Storage error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() => {
        stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();

      saveSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('State Listeners', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      stateManager.subscribe(listener);

      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(stateManager.getState());
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      stateManager.subscribe(listener1);
      stateManager.subscribe(listener2);

      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe(listener);

      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      stateManager.dispatch({ type: 'ADD_SECTION', name: 'Dairy' });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('createStateManager', () => {
    it('should load state from storage', () => {
      const loadSpy = vi.spyOn(storage, 'loadMultiListState');
      createStateManager();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should handle load errors gracefully', () => {
      const loadSpy = vi.spyOn(storage, 'loadMultiListState').mockImplementation(() => {
        throw new Error('Load error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const manager = createStateManager();
      expect(manager).toBeDefined();
      expect(manager.getState()).toBeDefined();

      loadSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
