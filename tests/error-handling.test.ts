/**
 * Unit tests for error handling features in the Grocery List PWA
 * Tests orphaned item recovery and storage quota error surfacing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/state';
import { MultiListState } from '../src/types';

// Mock the storage module
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

/** Helper: get the active list */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

/** Helper: create a MultiListState */
function makeMultiListState(sections: any[], items: any[]): MultiListState {
  const listId = 'list-1';
  return {
    lists: [{ id: listId, name: 'Test', sections, items, createdAt: 1 }],
    activeListId: listId,
    filterMode: 'all',
    collapsedSections: new Set<string>(),
    version: 2,
  };
}

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Orphaned items moved to Uncategorized section', () => {
    it('should create an Uncategorized section and move orphaned items into it', () => {
      const initialState = makeMultiListState(
        [{ id: 'section-1', name: 'Produce', order: 0, createdAt: 1000 }],
        [
          { id: 'item-1', name: 'Apples', quantity: 1, isChecked: false, sectionId: 'section-1', createdAt: 2000 },
          { id: 'item-2', name: 'Milk', quantity: 2, isChecked: false, sectionId: 'deleted-section', createdAt: 3000 },
          { id: 'item-3', name: 'Bread', quantity: 1, isChecked: true, sectionId: 'gone-section', createdAt: 4000 },
        ]
      );

      const manager = new StateManager(initialState);
      const list = al(manager.getState());

      const uncategorized = list.sections.find(s => s.name === 'Uncategorized');
      expect(uncategorized).toBeDefined();

      const item2 = list.items.find(i => i.id === 'item-2')!;
      const item3 = list.items.find(i => i.id === 'item-3')!;
      expect(item2.sectionId).toBe(uncategorized!.id);
      expect(item3.sectionId).toBe(uncategorized!.id);

      const item1 = list.items.find(i => i.id === 'item-1')!;
      expect(item1.sectionId).toBe('section-1');
    });
  });

  describe('Orphaned items use existing Uncategorized section', () => {
    it('should reuse an existing Uncategorized section instead of creating a duplicate', () => {
      const initialState = makeMultiListState(
        [
          { id: 'section-1', name: 'Produce', order: 0, createdAt: 1000 },
          { id: 'uncat-1', name: 'Uncategorized', order: 1, createdAt: 1500 },
        ],
        [
          { id: 'item-1', name: 'Apples', quantity: 1, isChecked: false, sectionId: 'section-1', createdAt: 2000 },
          { id: 'item-2', name: 'Mystery Item', quantity: 1, isChecked: false, sectionId: 'nonexistent', createdAt: 3000 },
        ]
      );

      const manager = new StateManager(initialState);
      const list = al(manager.getState());

      const uncategorizedSections = list.sections.filter(s => s.name === 'Uncategorized');
      expect(uncategorizedSections).toHaveLength(1);

      const item2 = list.items.find(i => i.id === 'item-2')!;
      expect(item2.sectionId).toBe('uncat-1');
    });
  });

  describe('No orphaned items — no Uncategorized section created', () => {
    it('should not add an Uncategorized section when all items have valid sectionIds', () => {
      const initialState = makeMultiListState(
        [
          { id: 'section-1', name: 'Produce', order: 0, createdAt: 1000 },
          { id: 'section-2', name: 'Dairy', order: 1, createdAt: 1500 },
        ],
        [
          { id: 'item-1', name: 'Apples', quantity: 1, isChecked: false, sectionId: 'section-1', createdAt: 2000 },
          { id: 'item-2', name: 'Milk', quantity: 1, isChecked: false, sectionId: 'section-2', createdAt: 3000 },
        ]
      );

      const manager = new StateManager(initialState);
      const list = al(manager.getState());

      const uncategorized = list.sections.find(s => s.name === 'Uncategorized');
      expect(uncategorized).toBeUndefined();
      expect(list.sections).toHaveLength(2);
    });
  });

  describe('Storage quota error surfaces via onStorageError callback', () => {
    it('should invoke onStorageError when saveMultiListState throws StorageQuotaExceededError', async () => {
      const { StorageQuotaExceededError } = await import('../src/storage');
      const saveMock = (await import('../src/storage')).saveMultiListState as ReturnType<typeof vi.fn>;

      saveMock.mockImplementation(() => {
        throw new StorageQuotaExceededError('Storage quota exceeded');
      });

      const manager = new StateManager();
      const errorCallback = vi.fn();
      manager.onStorageError = errorCallback;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(errorCallback).toHaveBeenCalledWith(expect.objectContaining({
        name: 'StorageQuotaExceededError',
      }));

      consoleSpy.mockRestore();
    });
  });
});
