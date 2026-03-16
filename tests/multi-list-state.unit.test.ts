/**
 * Unit tests for multi-list state management
 * Covers specific state transitions for DELETE_LIST, CREATE_LIST, RENAME_LIST,
 * SWITCH_LIST, IMPORT_LIST, and scoped actions on the active list.
 *
 * Requirements: 1.5, 1.6, 1.7
 */

import { describe, it, expect } from 'vitest';
import { reducer } from '../src/state';
import type { GroceryList, MultiListState, Section, Item } from '../src/types';

// --- Helpers ---

let idCounter = 0;
function nextId(prefix = 'id'): string {
  return `${prefix}-${++idCounter}`;
}

function makeSection(overrides: Partial<Section> = {}): Section {
  const id = overrides.id ?? nextId('section');
  return {
    id,
    name: overrides.name ?? `Section ${id}`,
    order: overrides.order ?? 0,
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

function makeItem(sectionId: string, overrides: Partial<Item> = {}): Item {
  const id = overrides.id ?? nextId('item');
  return {
    id,
    name: overrides.name ?? `Item ${id}`,
    quantity: overrides.quantity ?? 1,
    isChecked: overrides.isChecked ?? false,
    sectionId,
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

function makeList(overrides: Partial<GroceryList> = {}): GroceryList {
  const id = overrides.id ?? nextId('list');
  return {
    id,
    name: overrides.name ?? `List ${id}`,
    sections: overrides.sections ?? [],
    items: overrides.items ?? [],
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

function makeState(
  lists: GroceryList[],
  activeListId?: string,
  overrides: Partial<MultiListState> = {}
): MultiListState {
  return {
    lists,
    activeListId: activeListId ?? lists[0]?.id ?? 'missing',
    filterMode: overrides.filterMode ?? 'all',
    collapsedSections: overrides.collapsedSections ?? new Set<string>(),
    version: 2,
  };
}

// Reset counter before each describe block
beforeEach(() => {
  idCounter = 0;
});

import { beforeEach } from 'vitest';

// --- Tests ---

describe('Multi-List State Unit Tests', () => {
  // ── DELETE_LIST ──

  describe('DELETE_LIST when it is the only list', () => {
    it('should create a new default list named "My Grocery List"', () => {
      const onlyList = makeList({ id: 'only-list', name: 'Groceries' });
      const state = makeState([onlyList], 'only-list');

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'only-list' });

      expect(newState.lists).toHaveLength(1);
      expect(newState.lists[0].name).toBe('My Grocery List');
      expect(newState.lists[0].id).not.toBe('only-list');
      expect(newState.activeListId).toBe(newState.lists[0].id);
    });

    it('should create a default list with empty sections and items', () => {
      const section = makeSection();
      const item = makeItem(section.id);
      const onlyList = makeList({ id: 'only', sections: [section], items: [item] });
      const state = makeState([onlyList], 'only');

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'only' });

      expect(newState.lists[0].sections).toHaveLength(0);
      expect(newState.lists[0].items).toHaveLength(0);
    });

    it('should clear collapsedSections when creating the default list', () => {
      const onlyList = makeList({ id: 'only' });
      const state = makeState([onlyList], 'only', {
        collapsedSections: new Set(['sec-1', 'sec-2']),
      });

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'only' });

      expect(newState.collapsedSections.size).toBe(0);
    });
  });

  describe('DELETE_LIST when deleting the active list', () => {
    it('should fall back to the first remaining list', () => {
      const listA = makeList({ id: 'a', name: 'List A' });
      const listB = makeList({ id: 'b', name: 'List B' });
      const listC = makeList({ id: 'c', name: 'List C' });
      const state = makeState([listA, listB, listC], 'b');

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'b' });

      expect(newState.lists).toHaveLength(2);
      expect(newState.activeListId).toBe('a');
    });

    it('should fall back to the first remaining even when deleting the first list', () => {
      const listA = makeList({ id: 'a' });
      const listB = makeList({ id: 'b' });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'a' });

      expect(newState.lists).toHaveLength(1);
      expect(newState.activeListId).toBe('b');
    });
  });

  describe('DELETE_LIST when deleting a non-active list', () => {
    it('should keep activeListId unchanged', () => {
      const listA = makeList({ id: 'a' });
      const listB = makeList({ id: 'b' });
      const listC = makeList({ id: 'c' });
      const state = makeState([listA, listB, listC], 'a');

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'c' });

      expect(newState.lists).toHaveLength(2);
      expect(newState.activeListId).toBe('a');
      expect(newState.lists.find(l => l.id === 'c')).toBeUndefined();
    });

    it('should not modify the remaining lists', () => {
      const section = makeSection({ id: 'sec-1' });
      const item = makeItem('sec-1', { id: 'item-1', name: 'Apples' });
      const listA = makeList({ id: 'a', sections: [section], items: [item] });
      const listB = makeList({ id: 'b' });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'DELETE_LIST', listId: 'b' });

      const remaining = newState.lists.find(l => l.id === 'a')!;
      expect(remaining.sections).toEqual([section]);
      expect(remaining.items).toEqual([item]);
    });
  });

  // ── CREATE_LIST ──

  describe('CREATE_LIST', () => {
    it('should add a new list and set it as active', () => {
      const existing = makeList({ id: 'existing' });
      const state = makeState([existing], 'existing');

      const newState = reducer(state, { type: 'CREATE_LIST', name: 'Shopping Trip' });

      expect(newState.lists).toHaveLength(2);
      const created = newState.lists.find(l => l.id === newState.activeListId)!;
      expect(created.name).toBe('Shopping Trip');
      expect(created.sections).toHaveLength(0);
      expect(created.items).toHaveLength(0);
    });

    it('should preserve existing lists', () => {
      const listA = makeList({ id: 'a', name: 'A' });
      const listB = makeList({ id: 'b', name: 'B' });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'CREATE_LIST', name: 'C' });

      expect(newState.lists.find(l => l.id === 'a')!.name).toBe('A');
      expect(newState.lists.find(l => l.id === 'b')!.name).toBe('B');
    });
  });

  // ── RENAME_LIST ──

  describe('RENAME_LIST', () => {
    it('should update only the target list name', () => {
      const listA = makeList({ id: 'a', name: 'Old Name' });
      const listB = makeList({ id: 'b', name: 'Other List' });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'RENAME_LIST', listId: 'a', name: 'New Name' });

      expect(newState.lists.find(l => l.id === 'a')!.name).toBe('New Name');
      expect(newState.lists.find(l => l.id === 'b')!.name).toBe('Other List');
    });

    it('should not change activeListId', () => {
      const listA = makeList({ id: 'a' });
      const state = makeState([listA], 'a');

      const newState = reducer(state, { type: 'RENAME_LIST', listId: 'a', name: 'Renamed' });

      expect(newState.activeListId).toBe('a');
    });
  });

  // ── SWITCH_LIST ──

  describe('SWITCH_LIST', () => {
    it('should be a no-op when switching to a non-existent list', () => {
      const listA = makeList({ id: 'a' });
      const state = makeState([listA], 'a');

      const newState = reducer(state, { type: 'SWITCH_LIST', listId: 'non-existent' });

      expect(newState.activeListId).toBe('a');
      expect(newState.lists).toEqual(state.lists);
    });

    it('should update activeListId when switching to an existing list', () => {
      const listA = makeList({ id: 'a' });
      const listB = makeList({ id: 'b' });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'SWITCH_LIST', listId: 'b' });

      expect(newState.activeListId).toBe('b');
    });
  });

  // ── IMPORT_LIST ──

  describe('IMPORT_LIST', () => {
    it('should add the list and set it as active', () => {
      const existing = makeList({ id: 'existing' });
      const state = makeState([existing], 'existing');

      const imported = makeList({ id: 'imported', name: 'Shared List' });
      const newState = reducer(state, { type: 'IMPORT_LIST', list: imported });

      expect(newState.lists).toHaveLength(2);
      expect(newState.activeListId).toBe('imported');
      expect(newState.lists.find(l => l.id === 'imported')!.name).toBe('Shared List');
    });

    it('should not modify existing lists', () => {
      const section = makeSection({ id: 'sec' });
      const item = makeItem('sec', { name: 'Milk' });
      const existing = makeList({ id: 'existing', sections: [section], items: [item] });
      const state = makeState([existing], 'existing');

      const imported = makeList({ id: 'imported' });
      const newState = reducer(state, { type: 'IMPORT_LIST', list: imported });

      const orig = newState.lists.find(l => l.id === 'existing')!;
      expect(orig.sections).toEqual([section]);
      expect(orig.items).toEqual([item]);
    });
  });

  // ── Scoped actions on active list ──

  describe('Existing actions scoped to the active list', () => {
    it('ADD_ITEM should add an item only to the active list', () => {
      const sectionA = makeSection({ id: 'sec-a' });
      const listA = makeList({ id: 'a', sections: [sectionA] });
      const sectionB = makeSection({ id: 'sec-b' });
      const listB = makeList({ id: 'b', sections: [sectionB] });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'ADD_ITEM', name: 'Bananas', sectionId: 'sec-a' });

      const activeItems = newState.lists.find(l => l.id === 'a')!.items;
      const otherItems = newState.lists.find(l => l.id === 'b')!.items;
      expect(activeItems).toHaveLength(1);
      expect(activeItems[0].name).toBe('Bananas');
      expect(otherItems).toHaveLength(0);
    });

    it('DELETE_SECTION should remove a section only from the active list', () => {
      const sectionA = makeSection({ id: 'sec-a' });
      const sectionB = makeSection({ id: 'sec-b' });
      const listA = makeList({ id: 'a', sections: [sectionA] });
      const listB = makeList({ id: 'b', sections: [sectionB] });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'DELETE_SECTION', id: 'sec-a' });

      expect(newState.lists.find(l => l.id === 'a')!.sections).toHaveLength(0);
      expect(newState.lists.find(l => l.id === 'b')!.sections).toHaveLength(1);
    });

    it('ADD_SECTION should add a section only to the active list', () => {
      const listA = makeList({ id: 'a' });
      const listB = makeList({ id: 'b' });
      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'ADD_SECTION', name: 'Produce' });

      expect(newState.lists.find(l => l.id === 'a')!.sections).toHaveLength(1);
      expect(newState.lists.find(l => l.id === 'b')!.sections).toHaveLength(0);
    });

    it('TOGGLE_ITEM_CHECK should toggle only in the active list', () => {
      const sec = makeSection({ id: 'sec' });
      const item = makeItem('sec', { id: 'item-1', isChecked: false });
      const listA = makeList({ id: 'a', sections: [sec], items: [item] });

      const secB = makeSection({ id: 'sec-b' });
      const itemB = makeItem('sec-b', { id: 'item-2', isChecked: false });
      const listB = makeList({ id: 'b', sections: [secB], items: [itemB] });

      const state = makeState([listA, listB], 'a');

      const newState = reducer(state, { type: 'TOGGLE_ITEM_CHECK', id: 'item-1' });

      expect(newState.lists.find(l => l.id === 'a')!.items[0].isChecked).toBe(true);
      expect(newState.lists.find(l => l.id === 'b')!.items[0].isChecked).toBe(false);
    });
  });
});
