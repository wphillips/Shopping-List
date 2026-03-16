/**
 * Property-based tests for RENAME_SECTION action
 * Feature: section-management
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StateManager } from '../src/state';
import { MultiListState } from '../src/types';
import * as storage from '../src/storage';

/** Helper: get the active list from a MultiListState */
function activeList(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

/**
 * Feature: section-management, Property 1: Rename updates section name
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Property 1: Rename updates section name', () => {
  it('should update the targeted section name and leave all other sections and items unchanged', () => {
    fc.assert(
      fc.property(
        // Generate 1–5 section names, then pick one to rename
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.nat({ max: 100 }),
        (sectionNames, newName, targetIndexRaw) => {
          // Filter out whitespace-only new names
          fc.pre(newName.trim().length > 0);

          const stateManager = new StateManager();

          // Add sections
          sectionNames.forEach(name => {
            stateManager.dispatch({ type: 'ADD_SECTION', name });
          });

          // Add some items to each section
          const listBefore = activeList(stateManager.getState());
          listBefore.sections.forEach(section => {
            stateManager.dispatch({ type: 'ADD_ITEM', name: 'item-a', sectionId: section.id });
          });

          const listBeforeRename = activeList(stateManager.getState());
          const targetIndex = targetIndexRaw % listBeforeRename.sections.length;
          const targetSection = listBeforeRename.sections[targetIndex];

          // Dispatch RENAME_SECTION
          stateManager.dispatch({ type: 'RENAME_SECTION', id: targetSection.id, name: newName });

          const listAfter = activeList(stateManager.getState());

          // The targeted section's name should be updated
          const renamedSection = listAfter.sections.find(s => s.id === targetSection.id)!;
          expect(renamedSection.name).toBe(newName);

          // All other sections should be unchanged
          listAfter.sections.forEach(s => {
            if (s.id !== targetSection.id) {
              const original = listBeforeRename.sections.find(o => o.id === s.id)!;
              expect(s.name).toBe(original.name);
              expect(s.order).toBe(original.order);
              expect(s.createdAt).toBe(original.createdAt);
            }
          });

          // Items should be completely unchanged
          expect(listAfter.items).toEqual(listBeforeRename.items);

          // Section count should be unchanged
          expect(listAfter.sections.length).toBe(listBeforeRename.sections.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: section-management, Property 2: Rename with non-matching ID is a no-op
 * **Validates: Requirements 2.3**
 */
describe('Property 2: Rename with non-matching ID is a no-op', () => {
  it('should return identical sections array when ID does not match any section', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        (sectionNames, nonMatchingId, newName) => {
          const stateManager = new StateManager();

          // Add sections
          sectionNames.forEach(name => {
            stateManager.dispatch({ type: 'ADD_SECTION', name });
          });

          const listBefore = activeList(stateManager.getState());
          const existingIds = listBefore.sections.map(s => s.id);

          // Ensure the generated UUID doesn't match any existing section ID
          fc.pre(!existingIds.includes(nonMatchingId));

          // Dispatch RENAME_SECTION with non-matching ID
          stateManager.dispatch({ type: 'RENAME_SECTION', id: nonMatchingId, name: newName });

          const listAfter = activeList(stateManager.getState());

          // Sections array should be identical
          expect(listAfter.sections.length).toBe(listBefore.sections.length);
          listAfter.sections.forEach((section, i) => {
            expect(section.id).toBe(listBefore.sections[i].id);
            expect(section.name).toBe(listBefore.sections[i].name);
            expect(section.order).toBe(listBefore.sections[i].order);
            expect(section.createdAt).toBe(listBefore.sections[i].createdAt);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-management, Property 3: Rename round-trip persistence
 * **Validates: Requirements 2.4**
 */
describe('Property 3: Rename round-trip persistence', () => {
  it('should persist the renamed section name through localStorage round-trip', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (sectionName, newName) => {
          fc.pre(newName.trim().length > 0);

          // Use real localStorage (jsdom provides it)
          const stateManager = new StateManager();

          // Add a section
          stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
          const sectionId = activeList(stateManager.getState()).sections[0].id;

          // Rename the section — this triggers saveMultiListState internally
          stateManager.dispatch({ type: 'RENAME_SECTION', id: sectionId, name: newName });

          // Load state from localStorage
          const loadedState = storage.loadMultiListState();
          const loadedList = loadedState.lists.find(l => l.id === loadedState.activeListId)!;

          // The renamed section should have the new name
          const loadedSection = loadedList.sections.find(s => s.id === sectionId);
          expect(loadedSection).toBeDefined();
          expect(loadedSection!.name).toBe(newName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
