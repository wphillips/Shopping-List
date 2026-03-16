/**
 * Unit tests for auto-collapse empty sections
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/state';
import { MultiListState, Item, Section, FilterMode } from '../src/types';

vi.mock('../src/storage', () => ({
  saveMultiListState: vi.fn(),
  loadMultiListState: vi.fn(() => {
    const listId = 'test-list-id';
    return {
      lists: [{ id: listId, name: 'My Grocery List', sections: [], items: [], createdAt: Date.now() }],
      activeListId: listId,
      filterMode: 'all' as const,
      collapsedSections: new Set<string>(),
      version: 2,
    };
  }),
  createDefaultMultiListState: vi.fn(() => {
    const listId = 'default-list-id';
    return {
      lists: [{ id: listId, name: 'My Grocery List', sections: [], items: [], createdAt: Date.now() }],
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

/** Helper: create a Section */
function makeSection(id: string, order: number): Section {
  return { id, name: `Section ${id}`, order, createdAt: Date.now() };
}

/** Helper: create an Item */
function makeItem(id: string, sectionId: string, isChecked: boolean): Item {
  return { id, name: `Item ${id}`, quantity: 1, isChecked, sectionId, createdAt: Date.now() };
}

/** Helper: create a MultiListState with given sections, items, and filterMode */
function makeState(
  sections: Section[],
  items: Item[],
  filterMode: FilterMode = 'all',
  collapsedSections = new Set<string>()
): MultiListState {
  const listId = 'list-1';
  return {
    lists: [{ id: listId, name: 'Test', sections, items, createdAt: 1 }],
    activeListId: listId,
    filterMode,
    collapsedSections,
    version: 2,
  };
}

describe('Auto-Collapse Empty Sections – Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Validates: Requirements 1.1, 1.2
  it('filter to "checked" collapses section with only unchecked items', () => {
    const sections = [makeSection('section-a', 0), makeSection('section-b', 1)];
    const items = [
      makeItem('i1', 'section-a', false),
      makeItem('i2', 'section-a', false),
      makeItem('i3', 'section-b', true),
    ];
    const sm = new StateManager(makeState(sections, items, 'all'));

    sm.dispatch({ type: 'SET_FILTER_MODE', mode: 'checked' });

    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(true);
    expect(state.collapsedSections.has('section-b')).toBe(false);
  });

  // Validates: Requirements 1.1, 1.2
  it('filter to "all" expands all sections with items', () => {
    const sections = [makeSection('section-a', 0), makeSection('section-b', 1)];
    const items = [
      makeItem('i1', 'section-a', false),
      makeItem('i2', 'section-b', true),
    ];
    // Start with "checked" filter so section-a is collapsed
    const sm = new StateManager(makeState(sections, items, 'checked'));
    expect(sm.getState().collapsedSections.has('section-a')).toBe(true);

    sm.dispatch({ type: 'SET_FILTER_MODE', mode: 'all' });

    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(false);
    expect(state.collapsedSections.has('section-b')).toBe(false);
  });

  // Validates: Requirements 2.1, 2.2
  it('checking last unchecked item collapses section under "unchecked" filter', () => {
    const sections = [makeSection('section-a', 0)];
    const items = [makeItem('i1', 'section-a', false)];
    const sm = new StateManager(makeState(sections, items, 'unchecked'));

    // Section-a has one unchecked item, should be expanded
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);

    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'i1' });

    // Now the item is checked, no unchecked items remain → section collapses
    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(true);
  });

  // Validates: Requirements 3.1
  it('adding item to collapsed section expands it', () => {
    const sections = [makeSection('section-a', 0)];
    // No items → section-a is collapsed under "all" filter
    const sm = new StateManager(makeState(sections, [], 'all'));
    expect(sm.getState().collapsedSections.has('section-a')).toBe(true);

    sm.dispatch({ type: 'ADD_ITEM', name: 'Milk', sectionId: 'section-a' });

    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(false);
  });

  // Validates: Requirements 3.2
  it('deleting last visible item collapses section', () => {
    const sections = [makeSection('section-a', 0)];
    const items = [makeItem('i1', 'section-a', true)];
    const sm = new StateManager(makeState(sections, items, 'checked'));

    // Section-a has one checked item visible under "checked" filter
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);

    sm.dispatch({ type: 'DELETE_ITEM', id: 'i1' });

    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(true);
  });

  // Validates: Requirements 3.3, 3.4
  it('moving item collapses source, expands target', () => {
    const sections = [makeSection('section-a', 0), makeSection('section-b', 1)];
    const items = [makeItem('i1', 'section-a', false)];
    // Under "all" filter: section-a has one item (expanded), section-b has none (collapsed)
    const sm = new StateManager(makeState(sections, items, 'all'));
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);
    expect(sm.getState().collapsedSections.has('section-b')).toBe(true);

    sm.dispatch({ type: 'MOVE_ITEM_TO_SECTION', itemId: 'i1', targetSectionId: 'section-b' });

    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(true);
    expect(state.collapsedSections.has('section-b')).toBe(false);
  });

  // Validates: Requirements 4.1, 4.2
  it('manual toggle is not overridden until next visibility-changing action', () => {
    const sections = [makeSection('section-a', 0)];
    const items = [makeItem('i1', 'section-a', false)];
    const sm = new StateManager(makeState(sections, items, 'all'));

    // Section-a has items → expanded
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);

    // Manually collapse it
    sm.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: 'section-a' });
    expect(sm.getState().collapsedSections.has('section-a')).toBe(true);

    // Next visibility-changing action re-evaluates and overrides
    sm.dispatch({ type: 'SET_FILTER_MODE', mode: 'all' });
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);
  });

  // Validates: Requirements 2.3
  it('toggle item under "all" filter never collapses sections with items', () => {
    const sections = [makeSection('section-a', 0)];
    const items = [
      makeItem('i1', 'section-a', false),
      makeItem('i2', 'section-a', true),
    ];
    const sm = new StateManager(makeState(sections, items, 'all'));

    // Toggle i1 (unchecked → checked)
    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'i1' });
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);

    // Toggle i2 (checked → unchecked)
    sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: 'i2' });
    expect(sm.getState().collapsedSections.has('section-a')).toBe(false);
  });

  // Edge case
  it('section with zero items is always collapsed regardless of filter mode', () => {
    const sections = [makeSection('section-a', 0)];
    const items: Item[] = [];

    for (const mode of ['all', 'checked', 'unchecked'] as const) {
      const sm = new StateManager(makeState(sections, items, mode));
      expect(sm.getState().collapsedSections.has('section-a')).toBe(true);
    }
  });

  // Validates: Requirements 5.1, 5.2
  it('initial load computes correct collapse state', () => {
    const sections = [makeSection('section-a', 0), makeSection('section-b', 1)];
    const items = [
      makeItem('i1', 'section-a', true),
      makeItem('i2', 'section-b', false),
    ];
    // Provide stale collapsedSections (empty) with "checked" filter
    // section-b has only unchecked items → should be collapsed on load
    const sm = new StateManager(makeState(sections, items, 'checked', new Set<string>()));

    const state = sm.getState();
    expect(state.collapsedSections.has('section-a')).toBe(false);
    expect(state.collapsedSections.has('section-b')).toBe(true);
  });
});
