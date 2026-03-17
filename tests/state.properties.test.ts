/**
 * Property-based tests for section management
 * Feature: grocery-list-pwa
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StateManager } from '../src/state';
import { MultiListState } from '../src/types';

/** Helper: get the active list from a MultiListState */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

describe('Section Management Properties', () => {
  /**
   * Property 1: Section creation adds to state
   * **Validates: Requirements 3.1**
   */
  describe('Property 1: Section creation adds to state', () => {
    it('should add any valid section name to state with unique ID and correct order', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (sectionName) => {
            const stateManager = new StateManager();
            const initialState = stateManager.getState();
            const initialCount = al(initialState).sections.length;

            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const newState = stateManager.getState();

            // Section should be added
            expect(al(newState).sections.length).toBe(initialCount + 1);

            // New section should have the provided name
            const newSection = al(newState).sections[al(newState).sections.length - 1];
            expect(newSection.name).toBe(sectionName);

            // New section should have a unique ID
            expect(newSection.id).toBeDefined();
            expect(typeof newSection.id).toBe('string');
            expect(newSection.id.length).toBeGreaterThan(0);

            // New section should have correct order (next available position)
            expect(newSection.order).toBe(initialCount);

            // New section should have a timestamp
            expect(newSection.createdAt).toBeDefined();
            expect(typeof newSection.createdAt).toBe('number');
            expect(newSection.createdAt).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain unique IDs across multiple section additions', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          (sectionNames) => {
            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            const state = stateManager.getState();
            const ids = al(state).sections.map(s => s.id);

            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // All sections should have correct sequential order
            al(state).sections.forEach((section, index) => {
              expect(section.order).toBe(index);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Section toggle is idempotent
   * **Validates: Requirements 3.3**
   */
  describe('Property 3: Section toggle is idempotent', () => {
    it('should return section to original collapsed state after two toggles', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.boolean(),
          (sectionName, initiallyCollapsed) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Set initial collapsed state
            if (initiallyCollapsed) {
              stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });
            }

            const initialState = stateManager.getState();
            const wasCollapsed = initialState.collapsedSections.has(sectionId);

            // Toggle twice
            stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });
            stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });

            const finalState = stateManager.getState();
            const isCollapsed = finalState.collapsedSections.has(sectionId);

            // Should return to original state
            expect(isCollapsed).toBe(wasCollapsed);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent for any even number of toggles', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (sectionName, togglePairs) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            const initialState = stateManager.getState();
            const initialCollapsed = initialState.collapsedSections.has(sectionId);

            // Toggle an even number of times (togglePairs * 2)
            for (let i = 0; i < togglePairs * 2; i++) {
              stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });
            }

            const finalState = stateManager.getState();
            const finalCollapsed = finalState.collapsedSections.has(sectionId);

            // Should return to original state
            expect(finalCollapsed).toBe(initialCollapsed);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Move up decreases section order
   * **Validates: Requirements 3.6**
   */
  describe('Property 5: Move up decreases section order', () => {
    it('should decrease order by 1 for any section not at position 0', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1, max: 9 }),
          (sectionNames, targetIndexRaw) => {
            // Ensure we have at least 2 sections
            fc.pre(sectionNames.length >= 2);

            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            // Select a section that's not at position 0
            const targetIndex = targetIndexRaw % sectionNames.length;
            fc.pre(targetIndex > 0);

            const beforeState = stateManager.getState();
            const targetSection = al(beforeState).sections[targetIndex];
            const previousSection = al(beforeState).sections[targetIndex - 1];
            const targetId = targetSection.id;
            const previousId = previousSection.id;
            const targetOrderBefore = targetSection.order;
            const previousOrderBefore = previousSection.order;

            // Move section up
            stateManager.dispatch({ type: 'MOVE_SECTION_UP', id: targetId });

            const afterState = stateManager.getState();
            const targetAfter = al(afterState).sections.find(s => s.id === targetId)!;
            const previousAfter = al(afterState).sections.find(s => s.id === previousId)!;

            // Target section order should decrease by 1
            expect(targetAfter.order).toBe(targetOrderBefore - 1);

            // Previous section order should increase by 1
            expect(previousAfter.order).toBe(previousOrderBefore + 1);

            // Sections should be swapped in the array
            expect(al(afterState).sections[targetIndex - 1].id).toBe(targetId);
            expect(al(afterState).sections[targetIndex].id).toBe(previousId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not change state when moving top section up', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (sectionNames) => {
            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            const beforeState = stateManager.getState();
            const topSectionId = al(beforeState).sections[0].id;
            const topSectionOrder = al(beforeState).sections[0].order;

            // Try to move top section up
            stateManager.dispatch({ type: 'MOVE_SECTION_UP', id: topSectionId });

            const afterState = stateManager.getState();
            const topSectionAfter = al(afterState).sections.find(s => s.id === topSectionId)!;

            // Order should remain the same
            expect(topSectionAfter.order).toBe(topSectionOrder);
            expect(topSectionAfter.order).toBe(0);

            // Section should still be at position 0
            expect(al(afterState).sections[0].id).toBe(topSectionId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Move down increases section order
   * **Validates: Requirements 3.7**
   */
  describe('Property 6: Move down increases section order', () => {
    it('should increase order by 1 for any section not at last position', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 8 }),
          (sectionNames, targetIndexRaw) => {
            // Ensure we have at least 2 sections
            fc.pre(sectionNames.length >= 2);

            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            // Select a section that's not at last position
            const targetIndex = targetIndexRaw % (sectionNames.length - 1);
            fc.pre(targetIndex < sectionNames.length - 1);

            const beforeState = stateManager.getState();
            const targetSection = al(beforeState).sections[targetIndex];
            const nextSection = al(beforeState).sections[targetIndex + 1];
            const targetId = targetSection.id;
            const nextId = nextSection.id;
            const targetOrderBefore = targetSection.order;
            const nextOrderBefore = nextSection.order;

            // Move section down
            stateManager.dispatch({ type: 'MOVE_SECTION_DOWN', id: targetId });

            const afterState = stateManager.getState();
            const targetAfter = al(afterState).sections.find(s => s.id === targetId)!;
            const nextAfter = al(afterState).sections.find(s => s.id === nextId)!;

            // Target section order should increase by 1
            expect(targetAfter.order).toBe(targetOrderBefore + 1);

            // Next section order should decrease by 1
            expect(nextAfter.order).toBe(nextOrderBefore - 1);

            // Sections should be swapped in the array
            expect(al(afterState).sections[targetIndex].id).toBe(nextId);
            expect(al(afterState).sections[targetIndex + 1].id).toBe(targetId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not change state when moving bottom section down', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (sectionNames) => {
            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            const beforeState = stateManager.getState();
            const lastIndex = al(beforeState).sections.length - 1;
            const bottomSectionId = al(beforeState).sections[lastIndex].id;
            const bottomSectionOrder = al(beforeState).sections[lastIndex].order;

            // Try to move bottom section down
            stateManager.dispatch({ type: 'MOVE_SECTION_DOWN', id: bottomSectionId });

            const afterState = stateManager.getState();
            const bottomSectionAfter = al(afterState).sections.find(s => s.id === bottomSectionId)!;

            // Order should remain the same
            expect(bottomSectionAfter.order).toBe(bottomSectionOrder);
            expect(bottomSectionAfter.order).toBe(lastIndex);

            // Section should still be at last position
            expect(al(afterState).sections[lastIndex].id).toBe(bottomSectionId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Section deletion removes section and items
   * **Validates: Requirements 3.8, 3.9**
   */
  describe('Property 7: Section deletion removes section and items', () => {
    it('should remove section and all its items from state', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
          (sectionName, itemNames) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add items to the section
            itemNames.forEach(itemName => {
              stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            });

            const beforeState = stateManager.getState();
            expect(al(beforeState).sections.length).toBe(1);
            expect(al(beforeState).items.length).toBe(itemNames.length);

            // Delete the section
            stateManager.dispatch({ type: 'DELETE_SECTION', id: sectionId });

            const afterState = stateManager.getState();

            // Section should be removed
            expect(al(afterState).sections.length).toBe(0);
            expect(al(afterState).sections.find(s => s.id === sectionId)).toBeUndefined();

            // All items should be removed
            expect(al(afterState).items.length).toBe(0);
            expect(al(afterState).items.filter(item => item.sectionId === sectionId).length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only remove items from deleted section, not other sections', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          fc.array(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }), { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 0, max: 4 }),
          (sectionNames, itemNamesPerSection, deleteIndexRaw) => {
            // Ensure we have matching sections and item arrays
            fc.pre(sectionNames.length >= 2);
            fc.pre(itemNamesPerSection.length >= 2);

            const stateManager = new StateManager();

            // Add sections and their items
            const sectionIds: string[] = [];
            sectionNames.forEach((sectionName, index) => {
              stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
              const sectionId = al(stateManager.getState()).sections[index].id;
              sectionIds.push(sectionId);

              // Add items to this section
              const itemNames = itemNamesPerSection[index % itemNamesPerSection.length];
              itemNames.forEach(itemName => {
                stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
              });
            });

            // Select a section to delete
            const deleteIndex = deleteIndexRaw % sectionIds.length;
            const sectionToDelete = sectionIds[deleteIndex];

            const beforeState = stateManager.getState();
            const itemsInOtherSections = al(beforeState).items.filter(item => item.sectionId !== sectionToDelete).length;

            // Delete the section
            stateManager.dispatch({ type: 'DELETE_SECTION', id: sectionToDelete });

            const afterState = stateManager.getState();

            // Deleted section should be removed
            expect(al(afterState).sections.find(s => s.id === sectionToDelete)).toBeUndefined();

            // Items from deleted section should be removed
            expect(al(afterState).items.filter(item => item.sectionId === sectionToDelete).length).toBe(0);

            // Items from other sections should remain
            expect(al(afterState).items.length).toBe(itemsInOtherSections);

            // Other sections should remain
            expect(al(afterState).sections.length).toBe(sectionIds.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reorder remaining sections after deletion', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (sectionNames, deleteIndexRaw) => {
            fc.pre(sectionNames.length >= 2);

            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            const beforeState = stateManager.getState();
            const deleteIndex = deleteIndexRaw % sectionNames.length;
            const sectionToDelete = al(beforeState).sections[deleteIndex].id;

            // Delete the section
            stateManager.dispatch({ type: 'DELETE_SECTION', id: sectionToDelete });

            const afterState = stateManager.getState();

            // Remaining sections should have sequential order starting from 0
            al(afterState).sections.forEach((section, index) => {
              expect(section.order).toBe(index);
            });

            // Should have one less section
            expect(al(afterState).sections.length).toBe(sectionNames.length - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove section from collapsedSections set when deleted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (sectionName) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Collapse the section
            stateManager.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: sectionId });
            expect(stateManager.getState().collapsedSections.has(sectionId)).toBe(true);

            // Delete the section
            stateManager.dispatch({ type: 'DELETE_SECTION', id: sectionId });

            const afterState = stateManager.getState();

            // Section should be removed from collapsedSections
            expect(afterState.collapsedSections.has(sectionId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Item Management Properties
 */
describe('Item Management Properties', () => {
  /**
   * Property 9: Item submission creates new item
   * **Validates: Requirements 4.5, 5.2**
   */
  describe('Property 9: Item submission creates new item', () => {
    it('should create new item with quantity 1 and isChecked false', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (itemName, sectionName) => {
            const stateManager = new StateManager();

            // Add section first
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            const beforeState = stateManager.getState();
            const initialItemCount = al(beforeState).items.length;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });

            const afterState = stateManager.getState();
            const newItem = al(afterState).items[al(afterState).items.length - 1];

            // Item should be added
            expect(al(afterState).items.length).toBe(initialItemCount + 1);

            // New item should have correct properties
            expect(newItem.name).toBe(itemName);
            expect(newItem.quantity).toBe(1);
            expect(newItem.isChecked).toBe(false);
            expect(newItem.sectionId).toBe(sectionId);

            // New item should have a unique ID
            expect(newItem.id).toBeDefined();
            expect(typeof newItem.id).toBe('string');
            expect(newItem.id.length).toBeGreaterThan(0);

            // New item should have a timestamp
            expect(newItem.createdAt).toBeDefined();
            expect(typeof newItem.createdAt).toBe('number');
            expect(newItem.createdAt).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain unique IDs across multiple item additions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 20 }),
          (sectionName, itemNames) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            const state = stateManager.getState();
            const ids = al(state).items.map(item => item.id);

            // All IDs should be unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);

            // All items should belong to the section
            al(state).items.forEach(item => {
              expect(item.sectionId).toBe(sectionId);
              expect(item.quantity).toBe(1);
              expect(item.isChecked).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Duplicate item names are allowed
   * **Validates: Requirements 4.6**
   */
  describe('Property 10: Duplicate item names are allowed', () => {
    it('should allow creating multiple items with the same name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2, max: 10 }),
          (sectionName, itemName, duplicateCount) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add the same item name multiple times
            for (let i = 0; i < duplicateCount; i++) {
              stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            }

            const state = stateManager.getState();

            // Should have created all items
            expect(al(state).items.length).toBe(duplicateCount);

            // All items should have the same name
            const itemsWithName = al(state).items.filter(item => item.name === itemName);
            expect(itemsWithName.length).toBe(duplicateCount);

            // All items should have unique IDs
            const ids = al(state).items.map(item => item.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(duplicateCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create distinct items even with identical names', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (sectionName, itemName) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add first item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const firstItem = al(stateManager.getState()).items[0];

            // Add second item with same name
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const secondItem = al(stateManager.getState()).items[1];

            // Both items should exist
            expect(al(stateManager.getState()).items.length).toBe(2);

            // Both should have the same name
            expect(firstItem.name).toBe(itemName);
            expect(secondItem.name).toBe(itemName);

            // But different IDs
            expect(firstItem.id).not.toBe(secondItem.id);

            // And different timestamps (or same if created in same millisecond)
            expect(secondItem.createdAt).toBeGreaterThanOrEqual(firstItem.createdAt);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: Drag and drop changes item section
   * **Validates: Requirements 4.7, 4.8**
   */
  describe('Property 11: Drag and drop changes item section', () => {
    it('should move item to target section when dragged', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 4 }),
          fc.integer({ min: 0, max: 4 }),
          (sectionNames, itemName, sourceSectionIndexRaw, targetSectionIndexRaw) => {
            fc.pre(sectionNames.length >= 2);

            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            const sections = al(stateManager.getState()).sections;
            const sourceSectionIndex = sourceSectionIndexRaw % sections.length;
            const targetSectionIndex = targetSectionIndexRaw % sections.length;

            // Ensure source and target are different
            fc.pre(sourceSectionIndex !== targetSectionIndex);

            const sourceSectionId = sections[sourceSectionIndex].id;
            const targetSectionId = sections[targetSectionIndex].id;

            // Add item to source section
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId: sourceSectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Verify item is in source section
            const beforeState = stateManager.getState();
            const itemBefore = al(beforeState).items.find(item => item.id === itemId)!;
            expect(itemBefore.sectionId).toBe(sourceSectionId);

            // Move item to target section
            stateManager.dispatch({ type: 'MOVE_ITEM_TO_SECTION', itemId, targetSectionId });

            // Verify item is now in target section
            const afterState = stateManager.getState();
            const itemAfter = al(afterState).items.find(item => item.id === itemId)!;
            expect(itemAfter.sectionId).toBe(targetSectionId);

            // Item should still exist and have same properties except sectionId
            expect(itemAfter.id).toBe(itemBefore.id);
            expect(itemAfter.name).toBe(itemBefore.name);
            expect(itemAfter.quantity).toBe(itemBefore.quantity);
            expect(itemAfter.isChecked).toBe(itemBefore.isChecked);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle moving multiple items between sections', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          (sectionNames, itemNames) => {
            fc.pre(sectionNames.length >= 2);
            fc.pre(itemNames.length >= 2);

            const stateManager = new StateManager();

            // Add all sections
            sectionNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_SECTION', name });
            });

            const sections = al(stateManager.getState()).sections;
            const sourceSectionId = sections[0].id;
            const targetSectionId = sections[1].id;

            // Add all items to source section
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId: sourceSectionId });
            });

            const beforeState = stateManager.getState();
            const itemsInSource = al(beforeState).items.filter(item => item.sectionId === sourceSectionId).length;
            expect(itemsInSource).toBe(itemNames.length);

            // Move all items to target section
            al(beforeState).items.forEach(item => {
              stateManager.dispatch({ type: 'MOVE_ITEM_TO_SECTION', itemId: item.id, targetSectionId });
            });

            const afterState = stateManager.getState();
            const itemsInSourceAfter = al(afterState).items.filter(item => item.sectionId === sourceSectionId).length;
            const itemsInTargetAfter = al(afterState).items.filter(item => item.sectionId === targetSectionId).length;

            // All items should now be in target section
            expect(itemsInSourceAfter).toBe(0);
            expect(itemsInTargetAfter).toBe(itemNames.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Item deletion removes from state
   * **Validates: Requirements 4.9**
   */
  describe('Property 12: Item deletion removes from state', () => {
    it('should remove item from state when deleted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (sectionName, itemName) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            const beforeState = stateManager.getState();
            expect(al(beforeState).items.length).toBe(1);
            expect(al(beforeState).items.find(item => item.id === itemId)).toBeDefined();

            // Delete item
            stateManager.dispatch({ type: 'DELETE_ITEM', id: itemId });

            const afterState = stateManager.getState();

            // Item should be removed
            expect(al(afterState).items.length).toBe(0);
            expect(al(afterState).items.find(item => item.id === itemId)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only remove the specified item, not others', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          (sectionName, itemNames, deleteIndexRaw) => {
            fc.pre(itemNames.length >= 2);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            const beforeState = stateManager.getState();
            expect(al(beforeState).items.length).toBe(itemNames.length);

            // Select an item to delete
            const deleteIndex = deleteIndexRaw % itemNames.length;
            const itemToDelete = al(beforeState).items[deleteIndex];

            // Delete the item
            stateManager.dispatch({ type: 'DELETE_ITEM', id: itemToDelete.id });

            const afterState = stateManager.getState();

            // Should have one less item
            expect(al(afterState).items.length).toBe(itemNames.length - 1);

            // Deleted item should not exist
            expect(al(afterState).items.find(item => item.id === itemToDelete.id)).toBeUndefined();

            // Other items should still exist
            al(beforeState).items.forEach(item => {
              if (item.id !== itemToDelete.id) {
                expect(al(afterState).items.find(i => i.id === item.id)).toBeDefined();
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle deleting all items one by one', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (sectionName, itemNames) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            const initialState = stateManager.getState();
            expect(al(initialState).items.length).toBe(itemNames.length);

            // Delete all items one by one
            const itemIds = al(initialState).items.map(item => item.id);
            itemIds.forEach(id => {
              stateManager.dispatch({ type: 'DELETE_ITEM', id });
            });

            const finalState = stateManager.getState();

            // All items should be removed
            expect(al(finalState).items.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Check toggle changes state
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 18: Check toggle changes state', () => {
    it('should toggle isChecked from false to true and back', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (sectionName, itemName) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item (starts unchecked)
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            const initialState = stateManager.getState();
            const initialItem = al(initialState).items[0];
            expect(initialItem.isChecked).toBe(false);

            // Toggle to checked
            stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: itemId });
            const afterFirstToggle = stateManager.getState();
            const itemAfterFirstToggle = al(afterFirstToggle).items.find(item => item.id === itemId)!;
            expect(itemAfterFirstToggle.isChecked).toBe(true);

            // Toggle back to unchecked
            stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: itemId });
            const afterSecondToggle = stateManager.getState();
            const itemAfterSecondToggle = al(afterSecondToggle).items.find(item => item.id === itemId)!;
            expect(itemAfterSecondToggle.isChecked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent for any even number of toggles', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (sectionName, itemName, togglePairs) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            const initialState = stateManager.getState();
            const initialChecked = al(initialState).items[0].isChecked;

            // Toggle an even number of times (togglePairs * 2)
            for (let i = 0; i < togglePairs * 2; i++) {
              stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: itemId });
            }

            const finalState = stateManager.getState();
            const finalItem = al(finalState).items.find(item => item.id === itemId)!;

            // Should return to original state
            expect(finalItem.isChecked).toBe(initialChecked);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should toggle only the specified item, not others', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (sectionName, itemNames, toggleIndexRaw) => {
            fc.pre(itemNames.length >= 2);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            const beforeState = stateManager.getState();
            const toggleIndex = toggleIndexRaw % itemNames.length;
            const itemToToggle = al(beforeState).items[toggleIndex];

            // Toggle one item
            stateManager.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: itemToToggle.id });

            const afterState = stateManager.getState();

            // Only the toggled item should have changed
            al(afterState).items.forEach(item => {
              if (item.id === itemToToggle.id) {
                expect(item.isChecked).toBe(!itemToToggle.isChecked);
              } else {
                const originalItem = al(beforeState).items.find(i => i.id === item.id)!;
                expect(item.isChecked).toBe(originalItem.isChecked);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Quantity Management Properties
 */
describe('Quantity Management Properties', () => {
  /**
   * Property 14: Quantity increment increases by one
   * **Validates: Requirements 5.5**
   */
  describe('Property 14: Quantity increment increases by one', () => {
    it('should increase quantity by exactly 1 for any item', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          (sectionName, itemName, initialQuantity) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Set initial quantity by incrementing
            for (let i = 1; i < initialQuantity; i++) {
              stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
            }

            const beforeState = stateManager.getState();
            const itemBefore = al(beforeState).items.find(item => item.id === itemId)!;
            const quantityBefore = itemBefore.quantity;

            // Increment quantity
            stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });

            const afterState = stateManager.getState();
            const itemAfter = al(afterState).items.find(item => item.id === itemId)!;

            // Quantity should increase by exactly 1
            expect(itemAfter.quantity).toBe(quantityBefore + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increment only the specified item, not others', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (sectionName, itemNames, incrementIndexRaw) => {
            fc.pre(itemNames.length >= 2);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            const beforeState = stateManager.getState();
            const incrementIndex = incrementIndexRaw % itemNames.length;
            const itemToIncrement = al(beforeState).items[incrementIndex];

            // Increment one item
            stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemToIncrement.id });

            const afterState = stateManager.getState();

            // Only the incremented item should have changed
            al(afterState).items.forEach(item => {
              if (item.id === itemToIncrement.id) {
                expect(item.quantity).toBe(itemToIncrement.quantity + 1);
              } else {
                const originalItem = al(beforeState).items.find(i => i.id === item.id)!;
                expect(item.quantity).toBe(originalItem.quantity);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple consecutive increments', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (sectionName, itemName, incrementCount) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item (starts at quantity 1)
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            const initialState = stateManager.getState();
            const initialQuantity = al(initialState).items[0].quantity;

            // Increment multiple times
            for (let i = 0; i < incrementCount; i++) {
              stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
            }

            const finalState = stateManager.getState();
            const finalItem = al(finalState).items.find(item => item.id === itemId)!;

            // Quantity should increase by exactly incrementCount
            expect(finalItem.quantity).toBe(initialQuantity + incrementCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15: Quantity decrement decreases by one when greater than one
   * **Validates: Requirements 5.6**
   */
  describe('Property 15: Quantity decrement decreases by one when greater than one', () => {
    it('should decrease quantity by exactly 1 when quantity > 1', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2, max: 100 }),
          (sectionName, itemName, initialQuantity) => {
            fc.pre(initialQuantity > 1);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Set initial quantity by incrementing
            for (let i = 1; i < initialQuantity; i++) {
              stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
            }

            const beforeState = stateManager.getState();
            const itemBefore = al(beforeState).items.find(item => item.id === itemId)!;
            const quantityBefore = itemBefore.quantity;
            expect(quantityBefore).toBeGreaterThan(1);

            // Decrement quantity
            stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });

            const afterState = stateManager.getState();
            const itemAfter = al(afterState).items.find(item => item.id === itemId)!;

            // Quantity should decrease by exactly 1
            expect(itemAfter.quantity).toBe(quantityBefore - 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should decrement only the specified item, not others', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (sectionName, itemNames, decrementIndexRaw) => {
            fc.pre(itemNames.length >= 2);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items and increment their quantities to 2
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            const items = al(stateManager.getState()).items;
            items.forEach(item => {
              stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: item.id });
            });

            const beforeState = stateManager.getState();
            const decrementIndex = decrementIndexRaw % itemNames.length;
            const itemToDecrement = al(beforeState).items[decrementIndex];
            expect(itemToDecrement.quantity).toBeGreaterThan(1);

            // Decrement one item
            stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemToDecrement.id });

            const afterState = stateManager.getState();

            // Only the decremented item should have changed
            al(afterState).items.forEach(item => {
              if (item.id === itemToDecrement.id) {
                expect(item.quantity).toBe(itemToDecrement.quantity - 1);
              } else {
                const originalItem = al(beforeState).items.find(i => i.id === item.id)!;
                expect(item.quantity).toBe(originalItem.quantity);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple consecutive decrements until reaching 1', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 2, max: 20 }),
          (sectionName, itemName, initialQuantity) => {
            fc.pre(initialQuantity > 1);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Set initial quantity by incrementing
            for (let i = 1; i < initialQuantity; i++) {
              stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
            }

            const beforeState = stateManager.getState();
            const quantityBefore = al(beforeState).items[0].quantity;
            expect(quantityBefore).toBe(initialQuantity);

            // Decrement until we reach 1 (initialQuantity - 1 times)
            for (let i = 0; i < initialQuantity - 1; i++) {
              stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });
            }

            const afterState = stateManager.getState();
            const itemAfter = al(afterState).items.find(item => item.id === itemId)!;

            // Quantity should be 1
            expect(itemAfter.quantity).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: Quantity has minimum of one
   * **Validates: Requirements 5.7**
   */
  describe('Property 16: Quantity has minimum of one', () => {
    it('should keep quantity at 1 when decrementing at minimum', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (sectionName, itemName) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item (starts at quantity 1)
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            const beforeState = stateManager.getState();
            const itemBefore = al(beforeState).items[0];
            expect(itemBefore.quantity).toBe(1);

            // Try to decrement
            stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });

            const afterState = stateManager.getState();
            const itemAfter = al(afterState).items.find(item => item.id === itemId)!;

            // Quantity should remain at 1
            expect(itemAfter.quantity).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain minimum of 1 across multiple decrement attempts', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (sectionName, itemName, decrementAttempts) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item (starts at quantity 1)
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Try to decrement multiple times
            for (let i = 0; i < decrementAttempts; i++) {
              stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });
            }

            const finalState = stateManager.getState();
            const finalItem = al(finalState).items.find(item => item.id === itemId)!;

            // Quantity should still be 1 (never goes below)
            expect(finalItem.quantity).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce minimum of 1 after increment and decrement sequence', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 20 }),
          (sectionName, itemName, incrementCount, decrementCount) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item (starts at quantity 1)
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Increment
            for (let i = 0; i < incrementCount; i++) {
              stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
            }

            // Decrement (possibly more times than we incremented)
            for (let i = 0; i < decrementCount; i++) {
              stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });
            }

            const finalState = stateManager.getState();
            const finalItem = al(finalState).items.find(item => item.id === itemId)!;

            // Quantity should never be less than 1
            expect(finalItem.quantity).toBeGreaterThanOrEqual(1);

            // Calculate expected quantity
            const expectedQuantity = Math.max(1, 1 + incrementCount - decrementCount);
            expect(finalItem.quantity).toBe(expectedQuantity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain invariant: quantity >= 1 always holds', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.constantFrom('INCREMENT', 'DECREMENT'), { minLength: 1, maxLength: 50 }),
          (sectionName, itemName, operations) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Perform random sequence of increments and decrements
            operations.forEach(operation => {
              if (operation === 'INCREMENT') {
                stateManager.dispatch({ type: 'INCREMENT_QUANTITY', id: itemId });
              } else {
                stateManager.dispatch({ type: 'DECREMENT_QUANTITY', id: itemId });
              }

              // Check invariant after each operation
              const currentState = stateManager.getState();
              const currentItem = al(currentState).items.find(item => item.id === itemId)!;
              expect(currentItem.quantity).toBeGreaterThanOrEqual(1);
            });

            // Final check
            const finalState = stateManager.getState();
            const finalItem = al(finalState).items.find(item => item.id === itemId)!;
            expect(finalItem.quantity).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Filtering Properties
 */
describe('Filtering Properties', () => {
  /**
   * Property 8: Text filtering shows matching items only
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 8: Text filtering shows matching items only', () => {
    it('should show only items whose names contain the search text (case-insensitive)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 3, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (sectionName, itemNames, searchText) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            // Filter items by text
            const filteredItems = stateManager.filterItemsByText(searchText);

            // All filtered items should contain the search text (case-insensitive)
            const normalizedSearch = searchText.toLowerCase().trim();
            filteredItems.forEach(item => {
              expect(item.name.toLowerCase()).toContain(normalizedSearch);
            });

            // All items that contain the search text should be in the filtered results
            const visibleItems = stateManager.getVisibleItems();
            const expectedMatches = visibleItems.filter(item =>
              item.name.toLowerCase().includes(normalizedSearch)
            );

            expect(filteredItems.length).toBe(expectedMatches.length);

            // Verify each expected match is in the filtered results
            expectedMatches.forEach(expectedItem => {
              expect(filteredItems.find(item => item.id === expectedItem.id)).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return all visible items when search text is empty', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }),
          (sectionName, itemNames) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            // Filter with empty string
            const filteredWithEmpty = stateManager.filterItemsByText('');
            const filteredWithWhitespace = stateManager.filterItemsByText('   ');
            const visibleItems = stateManager.getVisibleItems();

            // Should return all visible items
            expect(filteredWithEmpty.length).toBe(visibleItems.length);
            expect(filteredWithWhitespace.length).toBe(visibleItems.length);

            // All visible items should be in the filtered results
            visibleItems.forEach(item => {
              expect(filteredWithEmpty.find(i => i.id === item.id)).toBeDefined();
              expect(filteredWithWhitespace.find(i => i.id === item.id)).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should perform case-insensitive matching', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (sectionName, itemName) => {
            // Ensure itemName has at least one letter
            fc.pre(itemName.match(/[a-zA-Z]/) !== null);

            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add item
            stateManager.dispatch({ type: 'ADD_ITEM', name: itemName, sectionId });
            const itemId = al(stateManager.getState()).items[0].id;

            // Extract a substring from the item name
            const substringLength = Math.max(1, Math.floor(itemName.length / 2));
            const substring = itemName.substring(0, substringLength);

            // Test with different cases
            const lowerCase = substring.toLowerCase();
            const upperCase = substring.toUpperCase();
            const mixedCase = substring.split('').map((char, i) =>
              i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()
            ).join('');

            const filteredLower = stateManager.filterItemsByText(lowerCase);
            const filteredUpper = stateManager.filterItemsByText(upperCase);
            const filteredMixed = stateManager.filterItemsByText(mixedCase);

            // All should find the item
            expect(filteredLower.find(item => item.id === itemId)).toBeDefined();
            expect(filteredUpper.find(item => item.id === itemId)).toBeDefined();
            expect(filteredMixed.find(item => item.id === itemId)).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no items match', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (sectionName, itemNames) => {
            const stateManager = new StateManager();

            // Add section
            stateManager.dispatch({ type: 'ADD_SECTION', name: sectionName });
            const sectionId = al(stateManager.getState()).sections[0].id;

            // Add all items
            itemNames.forEach(name => {
              stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId });
            });

            // Search for something that definitely won't match
            // Use a UUID-like string that's extremely unlikely to appear in random item names
            const impossibleSearch = 'ZZZZZ_IMPOSSIBLE_MATCH_99999';
            const filtered = stateManager.filterItemsByText(impossibleSearch);

            // Should return empty array
            expect(filtered.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});