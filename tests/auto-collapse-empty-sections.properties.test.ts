/**
 * Property-based tests for auto-collapse empty sections
 * Feature: auto-collapse-empty-sections
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { StateManager, computeCollapsedSections } from '../src/state';
import { MultiListState, Item, Section, FilterMode } from '../src/types';

/** Helper: get the active list */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

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

/**
 * Arbitrary: generate a valid Section at a given order index
 */
function arbSection(index: number): fc.Arbitrary<Section> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    order: fc.constant(index),
    createdAt: fc.integer({ min: 1, max: 1e12 }),
  });
}

/**
 * Arbitrary: generate a valid Item belonging to a given section
 */
function arbItem(sectionId: string): fc.Arbitrary<Item> {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    quantity: fc.integer({ min: 1, max: 99 }),
    isChecked: fc.boolean(),
    sectionId: fc.constant(sectionId),
    createdAt: fc.integer({ min: 1, max: 1e12 }),
  });
}

/** Arbitrary: generate a FilterMode */
const arbFilterMode: fc.Arbitrary<FilterMode> = fc.constantFrom('all', 'checked', 'unchecked');

/**
 * Arbitrary: generate a valid MultiListState with 1-5 sections, each having 0-6 items.
 * Items have unique IDs. Sections have sequential order.
 */
const arbAppState: fc.Arbitrary<MultiListState> = fc
  .integer({ min: 1, max: 5 })
  .chain((numSections) =>
    fc
      .tuple(...Array.from({ length: numSections }, (_, i) => arbSection(i)))
      .chain((sections: Section[]) =>
        fc
          .tuple(
            ...sections.map((sec) =>
              fc.array(arbItem(sec.id), { minLength: 0, maxLength: 6 })
            )
          )
          .chain((itemGroups: Item[][]) => {
            const allItems = itemGroups.flat();
            const seen = new Set<string>();
            const uniqueItems = allItems.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });

            return arbFilterMode.map((filterMode) => ({
              lists: [{ id: 'list-1', name: 'Test', sections, items: uniqueItems, createdAt: 1 }],
              activeListId: 'list-1',
              filterMode,
              collapsedSections: new Set<string>(),
              version: 2,
            } as MultiListState));
          })
      )
  );

describe('Auto-Collapse Empty Sections Properties', () => {
  /**
   * Feature: auto-collapse-empty-sections, Property 1: Filter change collapse invariant
   * **Validates: Requirements 1.1, 1.2**
   *
   * For any AppState with any number of sections and items, when the filterMode
   * is changed via SET_FILTER_MODE, the resulting collapsedSections set should
   * contain exactly the section IDs that have zero items matching the new filter
   * mode, and should not contain any section ID that has one or more matching items.
   */
  describe('Property 1: Filter change collapse invariant', () => {
    it('should collapse exactly the sections with zero matching items after SET_FILTER_MODE', () => {
      fc.assert(
        fc.property(
          arbAppState,
          arbFilterMode,
          (initialState, newFilterMode) => {
            const sm = new StateManager(initialState);
            sm.dispatch({ type: 'SET_FILTER_MODE', mode: newFilterMode });

            const resultState = sm.getState();

            // Use computeCollapsedSections as the oracle
            const expected = computeCollapsedSections(
              al(resultState).sections,
              al(resultState).items,
              newFilterMode
            );

            // collapsedSections should contain exactly the expected section IDs
            for (const sectionId of expected) {
              expect(
                resultState.collapsedSections.has(sectionId),
                `Section ${sectionId} should be collapsed (zero matching items)`
              ).toBe(true);
            }

            // No section with matching items should be in collapsedSections
            for (const section of al(resultState).sections) {
              if (!expected.has(section.id)) {
                expect(
                  resultState.collapsedSections.has(section.id),
                  `Section ${section.id} should NOT be collapsed (has matching items)`
                ).toBe(false);
              }
            }

            // Sizes should match
            expect(resultState.collapsedSections.size).toBe(expected.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: auto-collapse-empty-sections, Property 2: Item check toggle collapse invariant
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any AppState and any item within it, when that item's checked state is
   * toggled via TOGGLE_ITEM_CHECK, the resulting collapsedSections set should
   * contain exactly the section IDs that have zero visible items under the current
   * filterMode. In particular, when filterMode is 'all', no section that contains
   * at least one item should be collapsed, because all items are visible regardless
   * of checked state.
   */
  describe('Property 2: Item check toggle collapse invariant', () => {
    it('should collapse exactly the sections with zero visible items after TOGGLE_ITEM_CHECK', () => {
      fc.assert(
        fc.property(
          arbAppState,
          fc.nat(),
          (initialState, rawIndex) => {
            // Precondition: state must have at least one item
            fc.pre(al(initialState).items.length > 0);

            // Pick a random item using the generated index
            const itemIndex = rawIndex % al(initialState).items.length;
            const targetItem = al(initialState).items[itemIndex];

            const sm = new StateManager(initialState);
            sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: targetItem.id });

            const resultState = sm.getState();

            // Oracle: compute expected collapsedSections
            const expected = computeCollapsedSections(
              al(resultState).sections,
              al(resultState).items,
              resultState.filterMode
            );

            // collapsedSections should contain exactly the expected section IDs
            for (const sectionId of expected) {
              expect(
                resultState.collapsedSections.has(sectionId),
                `Section ${sectionId} should be collapsed (zero visible items)`
              ).toBe(true);
            }

            for (const section of al(resultState).sections) {
              if (!expected.has(section.id)) {
                expect(
                  resultState.collapsedSections.has(section.id),
                  `Section ${section.id} should NOT be collapsed (has visible items)`
                ).toBe(false);
              }
            }

            expect(resultState.collapsedSections.size).toBe(expected.size);

            // Specific invariant for "all" filter: no section with items is collapsed
            if (resultState.filterMode === 'all') {
              for (const section of al(resultState).sections) {
                const hasItems = al(resultState).items.some(
                  (item) => item.sectionId === section.id
                );
                if (hasItems) {
                  expect(
                    resultState.collapsedSections.has(section.id),
                    `Under "all" filter, section ${section.id} with items should NOT be collapsed`
                  ).toBe(false);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: auto-collapse-empty-sections, Property 3: Item add/delete/move collapse invariant
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * For any AppState, when an item is added (ADD_ITEM), deleted (DELETE_ITEM),
   * or moved to a different section (MOVE_ITEM_TO_SECTION), the resulting
   * collapsedSections set should contain exactly the section IDs that have zero
   * visible items under the current filterMode.
   */
  describe('Property 3: Item add/delete/move collapse invariant', () => {
    it('ADD_ITEM: should collapse exactly the sections with zero visible items after adding an item', () => {
      fc.assert(
        fc.property(
          arbAppState,
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.nat(),
          (initialState, itemName, rawIndex) => {
            // Precondition: state must have at least one section
            fc.pre(al(initialState).sections.length > 0);

            // Pick a random section to add the item to
            const sectionIndex = rawIndex % al(initialState).sections.length;
            const targetSection = al(initialState).sections[sectionIndex];

            const sm = new StateManager(initialState);
            sm.dispatch({
              type: 'ADD_ITEM',
              name: itemName,
              sectionId: targetSection.id,
            });

            const resultState = sm.getState();

            // Oracle: compute expected collapsedSections
            const expected = computeCollapsedSections(
              al(resultState).sections,
              al(resultState).items,
              resultState.filterMode
            );

            // collapsedSections should match the oracle exactly
            for (const sectionId of expected) {
              expect(
                resultState.collapsedSections.has(sectionId),
                `Section ${sectionId} should be collapsed (zero visible items)`
              ).toBe(true);
            }

            for (const section of al(resultState).sections) {
              if (!expected.has(section.id)) {
                expect(
                  resultState.collapsedSections.has(section.id),
                  `Section ${section.id} should NOT be collapsed (has visible items)`
                ).toBe(false);
              }
            }

            expect(resultState.collapsedSections.size).toBe(expected.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('DELETE_ITEM: should collapse exactly the sections with zero visible items after deleting an item', () => {
      fc.assert(
        fc.property(
          arbAppState,
          fc.nat(),
          (initialState, rawIndex) => {
            // Precondition: state must have at least one item
            fc.pre(al(initialState).items.length > 0);

            // Pick a random item to delete
            const itemIndex = rawIndex % al(initialState).items.length;
            const targetItem = al(initialState).items[itemIndex];

            const sm = new StateManager(initialState);
            sm.dispatch({ type: 'DELETE_ITEM', id: targetItem.id });

            const resultState = sm.getState();

            // Oracle: compute expected collapsedSections
            const expected = computeCollapsedSections(
              al(resultState).sections,
              al(resultState).items,
              resultState.filterMode
            );

            // collapsedSections should match the oracle exactly
            for (const sectionId of expected) {
              expect(
                resultState.collapsedSections.has(sectionId),
                `Section ${sectionId} should be collapsed (zero visible items)`
              ).toBe(true);
            }

            for (const section of al(resultState).sections) {
              if (!expected.has(section.id)) {
                expect(
                  resultState.collapsedSections.has(section.id),
                  `Section ${section.id} should NOT be collapsed (has visible items)`
                ).toBe(false);
              }
            }

            expect(resultState.collapsedSections.size).toBe(expected.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('MOVE_ITEM_TO_SECTION: should collapse exactly the sections with zero visible items after moving an item', () => {
      fc.assert(
        fc.property(
          arbAppState,
          fc.nat(),
          fc.nat(),
          (initialState, rawItemIndex, rawSectionIndex) => {
            // Precondition: state must have at least 2 sections and at least one item
            fc.pre(al(initialState).sections.length >= 2);
            fc.pre(al(initialState).items.length > 0);

            // Pick a random item to move
            const itemIndex = rawItemIndex % al(initialState).items.length;
            const targetItem = al(initialState).items[itemIndex];

            // Pick a different section to move the item to
            const otherSections = al(initialState).sections.filter(
              (s) => s.id !== targetItem.sectionId
            );
            fc.pre(otherSections.length > 0);

            const targetSectionIndex = rawSectionIndex % otherSections.length;
            const targetSection = otherSections[targetSectionIndex];

            const sm = new StateManager(initialState);
            sm.dispatch({
              type: 'MOVE_ITEM_TO_SECTION',
              itemId: targetItem.id,
              targetSectionId: targetSection.id,
            });

            const resultState = sm.getState();

            // Oracle: compute expected collapsedSections
            const expected = computeCollapsedSections(
              al(resultState).sections,
              al(resultState).items,
              resultState.filterMode
            );

            // collapsedSections should match the oracle exactly
            for (const sectionId of expected) {
              expect(
                resultState.collapsedSections.has(sectionId),
                `Section ${sectionId} should be collapsed (zero visible items)`
              ).toBe(true);
            }

            for (const section of al(resultState).sections) {
              if (!expected.has(section.id)) {
                expect(
                  resultState.collapsedSections.has(section.id),
                  `Section ${section.id} should NOT be collapsed (has visible items)`
                ).toBe(false);
              }
            }

            expect(resultState.collapsedSections.size).toBe(expected.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: auto-collapse-empty-sections, Property 4: Manual toggle independence
   * **Validates: Requirements 4.1**
   *
   * For any AppState and any section within it, when the user dispatches
   * TOGGLE_SECTION_COLLAPSE, the resulting collapsedSections should differ from
   * the previous state only in the toggled section's membership — no other
   * section's collapse state should change, and the auto-collapse engine should
   * not run.
   */
  describe('Property 4: Manual toggle independence', () => {
    it('should only flip the toggled section and leave all other sections unchanged', () => {
      fc.assert(
        fc.property(
          arbAppState,
          fc.nat(),
          (initialState, rawIndex) => {
            // Precondition: state must have at least one section
            fc.pre(al(initialState).sections.length > 0);

            // Pick a random section to toggle
            const sectionIndex = rawIndex % al(initialState).sections.length;
            const targetSection = al(initialState).sections[sectionIndex];

            const sm = new StateManager(initialState);

            // Record collapsedSections BEFORE the toggle (after constructor auto-collapse)
            const stateBefore = sm.getState();
            const collapsedBefore = new Set(stateBefore.collapsedSections);
            const wasCollapsed = collapsedBefore.has(targetSection.id);

            // Dispatch manual toggle
            sm.dispatch({ type: 'TOGGLE_SECTION_COLLAPSE', id: targetSection.id });

            const stateAfter = sm.getState();

            // Verify: the toggled section's membership flipped
            expect(
              stateAfter.collapsedSections.has(targetSection.id),
              `Section ${targetSection.id} collapse state should have flipped`
            ).toBe(!wasCollapsed);

            // Verify: all OTHER sections' membership is unchanged
            for (const section of al(stateAfter).sections) {
              if (section.id !== targetSection.id) {
                expect(
                  stateAfter.collapsedSections.has(section.id),
                  `Section ${section.id} should not have changed collapse state`
                ).toBe(collapsedBefore.has(section.id));
              }
            }

            // Verify: the auto-collapse engine did NOT run
            // The only change should be the toggled section, so the total size
            // should differ by exactly 1 (added or removed)
            const expectedSize = wasCollapsed
              ? collapsedBefore.size - 1
              : collapsedBefore.size + 1;
            expect(stateAfter.collapsedSections.size).toBe(expectedSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: auto-collapse-empty-sections, Property 5: Initial load collapse invariant
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any valid persisted AppState (with any combination of sections, items,
   * filterMode, and possibly stale/incorrect collapsedSections), when a
   * StateManager is constructed with that state, the resulting collapsedSections
   * should contain exactly the section IDs that have zero visible items under
   * the persisted filterMode. This proves the constructor corrects any stale
   * collapse state on load.
   */
  describe('Property 5: Initial load collapse invariant', () => {
    /**
     * Arbitrary: generate an AppState with arbitrary (possibly stale) collapsedSections.
     * This variant picks a random subset of section IDs to pre-populate collapsedSections,
     * simulating persisted state that may not match the current items/filterMode.
     */
    const arbAppStateWithStaleCollapsed: fc.Arbitrary<MultiListState> = arbAppState.chain(
      (state) =>
        fc
          .subarray(al(state).sections.map((s) => s.id), { minLength: 0 })
          .map((staleIds) => ({
            ...state,
            collapsedSections: new Set<string>(staleIds),
          }))
    );

    it('should correct stale collapsedSections to match computeCollapsedSections on construction', () => {
      fc.assert(
        fc.property(
          arbAppStateWithStaleCollapsed,
          (initialState) => {
            // Construct a new StateManager — the constructor should auto-correct collapsedSections
            const sm = new StateManager(initialState);
            const resultState = sm.getState();

            // Oracle: compute expected collapsedSections from the initial data
            const expected = computeCollapsedSections(
              al(initialState).sections,
              al(initialState).items,
              initialState.filterMode
            );

            // Every section that should be collapsed IS collapsed
            for (const sectionId of expected) {
              expect(
                resultState.collapsedSections.has(sectionId),
                `Section ${sectionId} should be collapsed (zero visible items on load)`
              ).toBe(true);
            }

            // No section with visible items is collapsed
            for (const section of al(resultState).sections) {
              if (!expected.has(section.id)) {
                expect(
                  resultState.collapsedSections.has(section.id),
                  `Section ${section.id} should NOT be collapsed (has visible items on load)`
                ).toBe(false);
              }
            }

            // Sizes must match exactly
            expect(resultState.collapsedSections.size).toBe(expected.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
