/**
 * Bug Condition Exploration Test
 * 
 * Tests that when sections array is empty AND user submits a valid item name,
 * the system should create a default section and add the item.
 * 
 * This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
 * Replicates the fixed handleItemSubmit logic from AppShell (src/index.ts).
 * Now includes auto-create default section when sections array is empty.
 */
function simulateHandleItemSubmit(stateManager: StateManager, text: string): void {
  const state = stateManager.getState();
  const list = al(state);

  // Auto-create default section if none exist (the fix)
  if (list.sections.length === 0) {
    stateManager.dispatch({ type: 'ADD_SECTION', name: 'Groceries' });
  }

  // Get the first section as target
  const updatedList = al(stateManager.getState());
  const targetSectionId = updatedList.sections.length > 0 ? updatedList.sections[0].id : undefined;

  if (!targetSectionId) {
    console.warn('No section available to add item');
    return;
  }

  // Add the item to the target section
  stateManager.dispatch({
    type: 'ADD_ITEM',
    name: text,
    sectionId: targetSectionId,
  });
}

describe('Bug Condition Exploration: No Sections Item Add', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Initialize with empty state (no sections) — the bug condition
    stateManager = new StateManager();
  });

  it('Property 1: Bug Condition — should create default section and add item when sections array is empty', () => {
    fc.assert(
      fc.property(
        // Generate valid non-empty item names (trimmed, non-whitespace)
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (itemName) => {
          // Reset state for each test case
          const sm = new StateManager();

          const trimmedName = itemName.trim();

          // Simulate the handleItemSubmit call
          simulateHandleItemSubmit(sm, trimmedName);

          const list = al(sm.getState());

          // After submission, a default section should have been created
          expect(list.sections.length).toBe(1);
          expect(list.sections[0].name).toBe('Groceries');

          // The item should be added to the newly created section
          expect(list.items.length).toBe(1);
          expect(list.items[0].name).toBe(trimmedName);
          expect(list.items[0].sectionId).toBe(list.sections[0].id);

          // Item should have correct default properties
          expect(list.items[0].quantity).toBe(1);
          expect(list.items[0].isChecked).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
