/**
 * Preservation Property Tests — Existing Section Behavior Unchanged
 *
 * These tests capture the baseline behavior of handleItemSubmit when sections
 * already exist (non-buggy inputs). They MUST PASS on unfixed code to establish
 * the behavior we need to preserve after the bugfix.
 *
 * Updated for MultiListState: selectedSectionId no longer exists; items are
 * added directly to a section via ADD_ITEM with an explicit sectionId.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect, vi } from 'vitest';
import { StateManager } from '../src/state';
import { MultiListState } from '../src/types';
import * as fc from 'fast-check';

// Mock the storage module so StateManager doesn't hit localStorage
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
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

/**
 * Replicates the handleItemSubmit logic from AppShell (src/index.ts)
 * In multi-list mode, items are added directly to a section via ADD_ITEM.
 * The caller picks the section (first section if none specified).
 */
function simulateHandleItemSubmit(stateManager: StateManager, text: string, sectionId?: string): void {
  const state = stateManager.getState();
  const list = al(state);

  const targetSectionId = sectionId || (list.sections.length > 0 ? list.sections[0].id : undefined);

  if (!targetSectionId) {
    console.warn('No section available to add item');
    return;
  }

  stateManager.dispatch({
    type: 'ADD_ITEM',
    name: text,
    sectionId: targetSectionId,
  });
}

/**
 * Helper: create a StateManager with a given number of sections pre-populated.
 */
function createStateWithSections(sectionNames: string[]): StateManager {
  const sm = new StateManager();

  for (const name of sectionNames) {
    sm.dispatch({ type: 'ADD_SECTION', name });
  }

  return sm;
}

describe('Preservation: Existing Section Behavior Unchanged', () => {
  /**
   * Property 2a: When sections exist, item is added to the first section.
   *
   * **Validates: Requirements 3.1**
   */
  it('should add item to first section when no section is specified', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (sectionNames, itemName) => {
          const sm = createStateWithSections(sectionNames);
          const firstSectionId = al(sm.getState()).sections[0].id;

          simulateHandleItemSubmit(sm, itemName);

          const list = al(sm.getState());

          // Item should be added
          expect(list.items.length).toBe(1);

          // Item should be in the first section
          expect(list.items[0].sectionId).toBe(firstSectionId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2b: When sections exist and a specific section is targeted,
   * item is added to that section.
   *
   * **Validates: Requirements 3.1**
   */
  it('should add item to specified section', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 0, max: 4 }),
        (sectionNames, itemName, selectedIndexRaw) => {
          const sm = createStateWithSections(sectionNames);
          const sections = al(sm.getState()).sections;
          const selectedIndex = selectedIndexRaw % sections.length;
          const selectedId = sections[selectedIndex].id;

          simulateHandleItemSubmit(sm, itemName, selectedId);

          const list = al(sm.getState());

          expect(list.items.length).toBe(1);
          expect(list.items[0].sectionId).toBe(selectedId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2c: Item properties are correct — quantity: 1, isChecked: false,
   * correct sectionId, and name matches input.
   *
   * **Validates: Requirements 3.2**
   */
  it('should create item with correct default properties', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (sectionName, itemName) => {
          const sm = createStateWithSections([sectionName]);
          const sectionId = al(sm.getState()).sections[0].id;

          simulateHandleItemSubmit(sm, itemName);

          const list = al(sm.getState());
          const item = list.items[0];

          expect(item.name).toBe(itemName);
          expect(item.quantity).toBe(1);
          expect(item.isChecked).toBe(false);
          expect(item.sectionId).toBe(sectionId);
          expect(typeof item.id).toBe('string');
          expect(item.id.length).toBeGreaterThan(0);
          expect(typeof item.createdAt).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2d: Multiple sequential item additions all go to the correct section
   * and accumulate properly.
   *
   * **Validates: Requirements 3.4**
   */
  it('should handle multiple sequential item additions correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          { minLength: 2, maxLength: 10 }
        ),
        (sectionName, itemNames) => {
          const sm = createStateWithSections([sectionName]);
          const sectionId = al(sm.getState()).sections[0].id;

          for (const name of itemNames) {
            simulateHandleItemSubmit(sm, name);
          }

          const list = al(sm.getState());

          // All items should be added
          expect(list.items.length).toBe(itemNames.length);

          // Each item should be in the correct section with correct properties
          for (let i = 0; i < itemNames.length; i++) {
            expect(list.items[i].name).toBe(itemNames[i]);
            expect(list.items[i].sectionId).toBe(sectionId);
            expect(list.items[i].quantity).toBe(1);
            expect(list.items[i].isChecked).toBe(false);
          }

          // All item IDs should be unique
          const ids = list.items.map(item => item.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2e: Items added without explicit section go to first section consistently.
   *
   * **Validates: Requirements 3.3**
   */
  it('should consistently add items to first section for subsequent adds', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (sectionNames, itemName1, itemName2) => {
          const sm = createStateWithSections(sectionNames);
          const firstSectionId = al(sm.getState()).sections[0].id;

          // First add — should go to first section
          simulateHandleItemSubmit(sm, itemName1);
          expect(al(sm.getState()).items[0].sectionId).toBe(firstSectionId);

          // Second add — should also go to first section
          simulateHandleItemSubmit(sm, itemName2);
          expect(al(sm.getState()).items[1].sectionId).toBe(firstSectionId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
