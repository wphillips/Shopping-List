/**
 * Property-based tests for multi-list state management
 * Feature: multi-list-sharing
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { reducer } from '../src/state';
import { saveMultiListState, loadMultiListState } from '../src/storage';
import type { Section, Item, GroceryList, MultiListState } from '../src/types';

// --- Generators ---

/**
 * Generate a valid Item assigned to a given sectionId
 */
function arbItem(sectionId: string): fc.Arbitrary<Item> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 999 }),
    isChecked: fc.boolean(),
    sectionId: fc.constant(sectionId),
    createdAt: fc.nat({ max: 1e13 }),
  });
}

/**
 * Generate a valid GroceryList with 0-5 sections and 0-10 items per section
 */
function arbGroceryList(): fc.Arbitrary<GroceryList> {
  return fc
    .record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      createdAt: fc.nat({ max: 1e13 }),
    })
    .chain((base) =>
      fc
        .array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            createdAt: fc.nat({ max: 1e13 }),
          }),
          { minLength: 0, maxLength: 5 }
        )
        .chain((sectionBases) => {
          const sections: Section[] = sectionBases.map((s, i) => ({ ...s, order: i }));

          if (sections.length === 0) {
            return fc.constant({
              ...base,
              sections: [] as Section[],
              items: [] as Item[],
            });
          }

          const itemArbs = sections.map((section) =>
            fc.array(arbItem(section.id), { minLength: 0, maxLength: 10 })
          );

          return fc.tuple(...itemArbs).map((itemArrays) => ({
            ...base,
            sections,
            items: itemArrays.flat(),
          }));
        })
    );
}

/**
 * Generate a valid MultiListState with 1-5 lists and a valid activeListId
 */
function arbMultiListState(): fc.Arbitrary<MultiListState> {
  return fc
    .array(arbGroceryList(), { minLength: 1, maxLength: 5 })
    .chain((lists) => {
      const listIds = lists.map((l) => l.id);
      return fc
        .constantFrom(...listIds)
        .chain((activeListId) =>
          fc
            .record({
              filterMode: fc.constantFrom('all' as const, 'checked' as const, 'unchecked' as const),
              collapsedSections: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
            })
            .map(({ filterMode, collapsedSections }) => ({
              lists,
              activeListId,
              filterMode,
              collapsedSections: new Set<string>(collapsedSections),
              version: 2 as number,
            }))
        );
    });
}

/**
 * Generate a MultiListState with at least 2 lists (for switch/delete tests)
 */
function arbMultiListStateWithMultipleLists(): fc.Arbitrary<MultiListState> {
  return fc
    .array(arbGroceryList(), { minLength: 2, maxLength: 5 })
    .chain((lists) => {
      const listIds = lists.map((l) => l.id);
      return fc
        .constantFrom(...listIds)
        .chain((activeListId) =>
          fc
            .record({
              filterMode: fc.constantFrom('all' as const, 'checked' as const, 'unchecked' as const),
              collapsedSections: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
            })
            .map(({ filterMode, collapsedSections }) => ({
              lists,
              activeListId,
              filterMode,
              collapsedSections: new Set<string>(collapsedSections),
              version: 2 as number,
            }))
        );
    });
}

// --- Property Tests ---

describe('Multi-List State Properties', () => {
  // Feature: multi-list-sharing, Property 1: Creating a list adds it and sets it active
  describe('Property 1: Creating a list adds it and sets it active', () => {
    /**
     * **Validates: Requirements 1.2**
     */
    it('should increase list count by one and set the new list as active with empty sections and items', () => {
      fc.assert(
        fc.property(
          arbMultiListState(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (state, listName) => {
            const originalCount = state.lists.length;
            const newState = reducer(state, { type: 'CREATE_LIST', name: listName });

            // List count increased by 1
            expect(newState.lists.length).toBe(originalCount + 1);

            // The new active list ID should differ from the old one (new list is active)
            const newList = newState.lists.find((l) => l.id === newState.activeListId);
            expect(newList).toBeDefined();

            // The new list should have the given name
            expect(newList!.name).toBe(listName);

            // The new list should have empty sections and items
            expect(newList!.sections).toHaveLength(0);
            expect(newList!.items).toHaveLength(0);

            // All original lists should still be present
            for (const originalList of state.lists) {
              expect(newState.lists.find((l) => l.id === originalList.id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 2: Switching lists updates the active list ID
  describe('Property 2: Switching lists updates the active list ID', () => {
    /**
     * **Validates: Requirements 1.3**
     */
    it('should set activeListId to the given ID without modifying any list contents', () => {
      fc.assert(
        fc.property(
          arbMultiListStateWithMultipleLists(),
          (state) => {
            // Pick a random list ID from the state to switch to
            const targetId = fc.sample(fc.constantFrom(...state.lists.map((l) => l.id)), 1)[0];

            const newState = reducer(state, { type: 'SWITCH_LIST', listId: targetId });

            // activeListId should be updated
            expect(newState.activeListId).toBe(targetId);

            // No list contents should be modified
            expect(newState.lists.length).toBe(state.lists.length);
            for (let i = 0; i < state.lists.length; i++) {
              const original = state.lists[i];
              const updated = newState.lists[i];
              expect(updated.id).toBe(original.id);
              expect(updated.name).toBe(original.name);
              expect(updated.sections).toEqual(original.sections);
              expect(updated.items).toEqual(original.items);
              expect(updated.createdAt).toBe(original.createdAt);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 3: Renaming a list updates only the target list's name
  describe('Property 3: Renaming a list updates only the target list\'s name', () => {
    /**
     * **Validates: Requirements 1.4**
     */
    it('should update only the target list name, leaving all other lists and items unchanged', () => {
      fc.assert(
        fc.property(
          arbMultiListState(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (state, newName) => {
            // Pick a random list to rename
            const targetId = fc.sample(fc.constantFrom(...state.lists.map((l) => l.id)), 1)[0];

            const newState = reducer(state, { type: 'RENAME_LIST', listId: targetId, name: newName });

            // Same number of lists
            expect(newState.lists.length).toBe(state.lists.length);

            for (let i = 0; i < state.lists.length; i++) {
              const original = state.lists[i];
              const updated = newState.lists[i];

              if (original.id === targetId) {
                // Target list: name should be updated
                expect(updated.name).toBe(newName);
              } else {
                // Other lists: name should be unchanged
                expect(updated.name).toBe(original.name);
              }

              // All lists: id, sections, items, createdAt should be unchanged
              expect(updated.id).toBe(original.id);
              expect(updated.sections).toEqual(original.sections);
              expect(updated.items).toEqual(original.items);
              expect(updated.createdAt).toBe(original.createdAt);
            }

            // activeListId should not change
            expect(newState.activeListId).toBe(state.activeListId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 4: Deleting a list removes it and falls back to the first remaining list
  describe('Property 4: Deleting a list removes it and falls back to the first remaining list', () => {
    /**
     * **Validates: Requirements 1.5, 1.6**
     */
    it('should remove the list and set activeListId to the first remaining list if the deleted list was active', () => {
      fc.assert(
        fc.property(
          arbMultiListStateWithMultipleLists(),
          (state) => {
            // Pick a random list to delete
            const targetId = fc.sample(fc.constantFrom(...state.lists.map((l) => l.id)), 1)[0];

            const newState = reducer(state, { type: 'DELETE_LIST', listId: targetId });

            // List count decreased by 1
            expect(newState.lists.length).toBe(state.lists.length - 1);

            // The deleted list should not be present
            expect(newState.lists.find((l) => l.id === targetId)).toBeUndefined();

            // All remaining lists should be unchanged
            const remaining = state.lists.filter((l) => l.id !== targetId);
            for (let i = 0; i < remaining.length; i++) {
              const original = remaining[i];
              const updated = newState.lists.find((l) => l.id === original.id);
              expect(updated).toBeDefined();
              expect(updated!.name).toBe(original.name);
              expect(updated!.sections).toEqual(original.sections);
              expect(updated!.items).toEqual(original.items);
            }

            // If the deleted list was the active list, activeListId should be the first remaining
            if (state.activeListId === targetId) {
              expect(newState.activeListId).toBe(remaining[0].id);
            } else {
              // Otherwise activeListId should be unchanged
              expect(newState.activeListId).toBe(state.activeListId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 5: Active list ID persists across save and load
  describe('Property 5: Active list ID persists across save and load', () => {
    /**
     * **Validates: Requirements 1.8**
     */
    it('should preserve activeListId after saving and loading', () => {
      fc.assert(
        fc.property(arbMultiListState(), (state) => {
          // Save the state
          saveMultiListState(state);

          // Load it back
          const loaded = loadMultiListState();

          // activeListId should be the same
          expect(loaded.activeListId).toBe(state.activeListId);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 19: Importing a list adds it and sets it as active
  describe('Property 19: Importing a list adds it and sets it as active', () => {
    /**
     * **Validates: Requirements 6.2**
     */
    it('should add the imported list and set it as active without modifying existing lists', () => {
      fc.assert(
        fc.property(
          arbMultiListState(),
          arbGroceryList(),
          (state, importedList) => {
            const originalCount = state.lists.length;

            const newState = reducer(state, { type: 'IMPORT_LIST', list: importedList });

            // List count increased by 1
            expect(newState.lists.length).toBe(originalCount + 1);

            // The imported list should be the active list
            expect(newState.activeListId).toBe(importedList.id);

            // The imported list should be present in the state
            const found = newState.lists.find((l) => l.id === importedList.id);
            expect(found).toBeDefined();
            expect(found!.name).toBe(importedList.name);
            expect(found!.sections).toEqual(importedList.sections);
            expect(found!.items).toEqual(importedList.items);

            // All original lists should be unchanged
            for (const originalList of state.lists) {
              const updated = newState.lists.find((l) => l.id === originalList.id);
              expect(updated).toBeDefined();
              expect(updated!.name).toBe(originalList.name);
              expect(updated!.sections).toEqual(originalList.sections);
              expect(updated!.items).toEqual(originalList.items);
              expect(updated!.createdAt).toBe(originalList.createdAt);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
