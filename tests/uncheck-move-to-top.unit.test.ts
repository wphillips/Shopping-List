/**
 * Unit tests for uncheck-move-to-top behavior
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/state';
import { MultiListState, Item } from '../src/types';
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

/** Helper: get the active list */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

/**
 * Helper: create an item with defaults
 */
function makeItem(overrides: Partial<Item> & { id: string; sectionId: string }): Item {
  return {
    name: overrides.id,
    quantity: 1,
    isChecked: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Helper: create a MultiListState with given items and sections
 */
function makeState(items: Item[], sectionIds: string[]): MultiListState {
  const listId = 'list-1';
  return {
    lists: [{
      id: listId,
      name: 'Test List',
      sections: sectionIds.map((id, i) => ({
        id,
        name: `Section ${id}`,
        order: i,
        createdAt: Date.now(),
      })),
      items,
      createdAt: Date.now(),
    }],
    activeListId: listId,
    filterMode: 'all',
    collapsedSections: new Set<string>(),
    version: 2,
  };
}

/** Helper: extract item ids for a given section from the active list's items array */
function sectionItemIds(state: Readonly<MultiListState>, sectionId: string): string[] {
  return al(state).items.filter((i) => i.sectionId === sectionId).map((i) => i.id);
}

describe('Uncheck Move to Top', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates: Requirement 1.1
  it('single checked item unchecked moves after last unchecked item in section', () => {
    const items: Item[] = [
      makeItem({ id: 'A', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'B', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'C', sectionId: 's1', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'C' });

    const state = sm.getState();
    const ids = sectionItemIds(state, 's1');
    expect(ids).toEqual(['A', 'B', 'C']);
    expect(al(state).items.find((i) => i.id === 'C')!.isChecked).toBe(false);
  });

  // Validates: Requirements 1.2, 1.3
  it("unchecking item in one section doesn't affect another section's order", () => {
    const items: Item[] = [
      makeItem({ id: 'A1', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'B1', sectionId: 's1', isChecked: true }),
      makeItem({ id: 'A2', sectionId: 's2', isChecked: false }),
      makeItem({ id: 'B2', sectionId: 's2', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1', 's2']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'B1' });

    const state = sm.getState();
    const s2Ids = sectionItemIds(state, 's2');
    expect(s2Ids).toEqual(['A2', 'B2']);
    expect(al(state).items.find((i) => i.id === 'A2')!.isChecked).toBe(false);
    expect(al(state).items.find((i) => i.id === 'B2')!.isChecked).toBe(true);
  });

  // Validates: Requirement 1.4
  it('checking an item keeps its position unchanged', () => {
    const items: Item[] = [
      makeItem({ id: 'A', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'B', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'C', sectionId: 's1', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'A' });

    const state = sm.getState();
    const ids = sectionItemIds(state, 's1');
    expect(ids).toEqual(['A', 'B', 'C']);
    expect(al(state).items.find((i) => i.id === 'A')!.isChecked).toBe(true);
  });

  // Validates: Requirement 1.1 (edge case)
  it('only item in section stays in place when unchecked', () => {
    const items: Item[] = [
      makeItem({ id: 'A', sectionId: 's1', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'A' });

    const state = sm.getState();
    expect(al(state).items).toHaveLength(1);
    expect(al(state).items[0].id).toBe('A');
    expect(al(state).items[0].isChecked).toBe(false);
  });

  // Validates: Requirement 1.1 (edge case — all checked)
  it('all items checked — unchecked item becomes first in section', () => {
    const items: Item[] = [
      makeItem({ id: 'A', sectionId: 's1', isChecked: true }),
      makeItem({ id: 'B', sectionId: 's1', isChecked: true }),
      makeItem({ id: 'C', sectionId: 's1', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'C' });

    const state = sm.getState();
    const ids = sectionItemIds(state, 's1');
    expect(ids).toEqual(['C', 'A', 'B']);
    expect(al(state).items.find((i) => i.id === 'C')!.isChecked).toBe(false);
  });

  // Validates: Requirement 1.1 (edge case — all unchecked after toggle)
  it('all items unchecked — unchecked item appears after all unchecked items', () => {
    const items: Item[] = [
      makeItem({ id: 'A', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'B', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'C', sectionId: 's1', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'C' });

    const state = sm.getState();
    const ids = sectionItemIds(state, 's1');
    expect(ids).toEqual(['A', 'B', 'C']);
    expect(al(state).items.find((i) => i.id === 'C')!.isChecked).toBe(false);
  });

  // Validates: Requirement 2.1
  it('persistence is called with reordered items array after uncheck', () => {
    const saveSpy = vi.spyOn(storage, 'saveMultiListState');

    const items: Item[] = [
      makeItem({ id: 'A', sectionId: 's1', isChecked: false }),
      makeItem({ id: 'B', sectionId: 's1', isChecked: true }),
      makeItem({ id: 'C', sectionId: 's1', isChecked: true }),
    ];
    const sm = new StateManager(makeState(items, ['s1']));

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'C' });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const savedState = saveSpy.mock.calls[0][0] as MultiListState;
    const savedIds = al(savedState).items
      .filter((i) => i.sectionId === 's1')
      .map((i) => i.id);
    expect(savedIds).toEqual(['A', 'C', 'B']);
  });
});
