/**
 * Bug Condition Exploration Test — List Import Overwrite
 *
 * Tests that when localStorage contains existing lists with minor validation
 * issues, `loadMultiListState()` should recover valid lists rather than
 * silently discarding everything and falling back to default state.
 *
 * This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMultiListState } from '../src/storage';
import { StateManager } from '../src/state';
import { GroceryList } from '../src/types';

const STORAGE_KEY = 'grocery-list-state';

/** Helper: build a valid GroceryList */
function makeValidList(id: string, name: string): GroceryList {
  const sectionId = `section-${id}`;
  return {
    id,
    name,
    sections: [
      { id: sectionId, name: 'Produce', order: 0, createdAt: 1000 },
    ],
    items: [
      {
        id: `item-${id}`,
        name: 'Apples',
        quantity: 3,
        isChecked: false,
        sectionId,
        createdAt: 1000,
      },
    ],
    createdAt: 1000,
  };
}

/** Helper: build a valid imported GroceryList */
function makeImportedList(): GroceryList {
  return {
    id: 'imported-list-id',
    name: 'Shared Party List',
    sections: [
      { id: 'imp-section-1', name: 'Drinks', order: 0, createdAt: 2000 },
    ],
    items: [
      {
        id: 'imp-item-1',
        name: 'Soda',
        quantity: 2,
        isChecked: false,
        sectionId: 'imp-section-1',
        createdAt: 2000,
      },
    ],
    createdAt: 2000,
  };
}

describe('Bug Condition Exploration: Existing Lists Lost on Import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Case 1: localStorage has 2 valid lists but one item has `quantity: 0`.
   * `isValidItem()` rejects it → `validateV2State()` throws → entire state discarded.
   *
   * Expected (post-fix): valid lists are recovered, imported list appended.
   * On UNFIXED code: loadMultiListState() returns default state, losing both lists.
   *
   * **Validates: Requirements 1.1, 1.3, 2.1**
   */
  it('Case 1: item with quantity:0 should not cause all existing lists to be lost on import', () => {
    const list1 = makeValidList('list-1', 'Weekly Groceries');
    const list2 = makeValidList('list-2', 'Party Supplies');

    // Corrupt list2: set one item's quantity to 0
    const corruptedList2 = {
      ...list2,
      items: list2.items.map(item => ({ ...item, quantity: 0 })),
    };

    const storedState = {
      version: 2,
      lists: [list1, corruptedList2],
      activeListId: 'list-1',
      filterMode: 'all',
      collapsedSections: [],
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

    // Load state and create StateManager
    const loaded = loadMultiListState();
    const sm = new StateManager(loaded);

    // Dispatch IMPORT_LIST
    const importedList = makeImportedList();
    sm.dispatch({ type: 'IMPORT_LIST', list: importedList });

    const result = sm.getState();

    // Assert: list1 (the valid list) should still be present
    const list1Present = result.lists.some(l => l.id === 'list-1');
    expect(list1Present).toBe(true);

    // Assert: imported list should be present
    const importedPresent = result.lists.some(l => l.id === 'imported-list-id');
    expect(importedPresent).toBe(true);

    // Assert: we should have at least 2 lists (list1 + imported), not just default + imported
    expect(result.lists.length).toBeGreaterThanOrEqual(2);

    // Assert: the valid list1 should retain its original data
    const recoveredList1 = result.lists.find(l => l.id === 'list-1');
    expect(recoveredList1).toBeDefined();
    expect(recoveredList1!.name).toBe('Weekly Groceries');
    expect(recoveredList1!.sections.length).toBe(1);
    expect(recoveredList1!.items.length).toBe(1);
  });

  /**
   * Case 2: localStorage has valid lists but a section is missing `createdAt`.
   * `isValidSection()` fails → `isValidGroceryList()` fails → `validateV2State()` throws → entire state discarded.
   *
   * Expected (post-fix): the list with the valid section is recovered, imported list appended.
   * On UNFIXED code: loadMultiListState() returns default state, losing all lists.
   *
   * **Validates: Requirements 1.2, 1.3, 2.2**
   */
  it('Case 2: section missing createdAt should not cause all existing lists to be lost on import', () => {
    const list1 = makeValidList('list-a', 'Camping Trip');

    // list2 has a section missing createdAt
    const list2 = {
      id: 'list-b',
      name: 'BBQ Supplies',
      sections: [
        { id: 'sec-b1', name: 'Meats', order: 0 }, // missing createdAt!
      ],
      items: [
        {
          id: 'item-b1',
          name: 'Burgers',
          quantity: 5,
          isChecked: false,
          sectionId: 'sec-b1',
          createdAt: 1500,
        },
      ],
      createdAt: 1500,
    };

    const storedState = {
      version: 2,
      lists: [list1, list2],
      activeListId: 'list-a',
      filterMode: 'all',
      collapsedSections: [],
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

    const loaded = loadMultiListState();
    const sm = new StateManager(loaded);

    const importedList = makeImportedList();
    sm.dispatch({ type: 'IMPORT_LIST', list: importedList });

    const result = sm.getState();

    // Assert: list-a (the fully valid list) should still be present
    const listAPresent = result.lists.some(l => l.id === 'list-a');
    expect(listAPresent).toBe(true);

    // Assert: imported list should be present
    const importedPresent = result.lists.some(l => l.id === 'imported-list-id');
    expect(importedPresent).toBe(true);

    // Assert: the valid list-a should retain its original data
    const recoveredListA = result.lists.find(l => l.id === 'list-a');
    expect(recoveredListA).toBeDefined();
    expect(recoveredListA!.name).toBe('Camping Trip');
    expect(recoveredListA!.sections.length).toBe(1);
    expect(recoveredListA!.items.length).toBe(1);
  });

  /**
   * Case 3: localStorage has valid lists but `activeListId` references a non-existent list.
   * `validateV2State()` throws "activeListId does not reference an existing list" → entire state discarded.
   *
   * Expected (post-fix): valid lists are recovered with activeListId corrected, imported list appended.
   * On UNFIXED code: loadMultiListState() returns default state, losing all lists.
   *
   * **Validates: Requirements 1.1, 1.3, 2.1, 2.3**
   */
  it('Case 3: invalid activeListId should not cause all existing lists to be lost on import', () => {
    const list1 = makeValidList('list-x', 'Weekly Shopping');
    const list2 = makeValidList('list-y', 'Holiday Prep');

    const storedState = {
      version: 2,
      lists: [list1, list2],
      activeListId: 'non-existent-list-id', // references a list that doesn't exist!
      filterMode: 'all',
      collapsedSections: [],
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

    const loaded = loadMultiListState();
    const sm = new StateManager(loaded);

    const importedList = makeImportedList();
    sm.dispatch({ type: 'IMPORT_LIST', list: importedList });

    const result = sm.getState();

    // Assert: both original valid lists should still be present
    const listXPresent = result.lists.some(l => l.id === 'list-x');
    const listYPresent = result.lists.some(l => l.id === 'list-y');
    expect(listXPresent).toBe(true);
    expect(listYPresent).toBe(true);

    // Assert: imported list should be present
    const importedPresent = result.lists.some(l => l.id === 'imported-list-id');
    expect(importedPresent).toBe(true);

    // Assert: should have all 3 lists (list-x, list-y, imported)
    expect(result.lists.length).toBe(3);

    // Assert: original lists retain their data
    const recoveredX = result.lists.find(l => l.id === 'list-x');
    expect(recoveredX!.name).toBe('Weekly Shopping');
    expect(recoveredX!.items.length).toBe(1);

    const recoveredY = result.lists.find(l => l.id === 'list-y');
    expect(recoveredY!.name).toBe('Holiday Prep');
    expect(recoveredY!.items.length).toBe(1);
  });
});
