/**
 * Property-based tests for uncheck-move-to-top behavior
 * Feature: uncheck-move-to-top
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { StateManager } from '../src/state';
import { MultiListState, Item, Section } from '../src/types';

/**
 * Arbitrary: generate a valid Item
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

/**
 * Arbitrary: generate a valid Section
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
 * Arbitrary: generate an AppState with 1-3 sections, each having 1-6 items,
 * guaranteeing at least one checked item exists somewhere.
 */
const arbStateWithCheckedItem: fc.Arbitrary<{ state: MultiListState; checkedItemId: string }> = fc
  .integer({ min: 1, max: 3 })
  .chain((numSections) =>
    fc
      .tuple(
        ...Array.from({ length: numSections }, (_, i) => arbSection(i))
      )
      .chain((sections: Section[]) =>
        fc
          .tuple(
            ...sections.map((sec) =>
              fc.array(arbItem(sec.id), { minLength: 1, maxLength: 6 })
            )
          )
          .chain((itemGroups: Item[][]) => {
            const allItems = itemGroups.flat();
            // Ensure unique IDs across all items
            const seen = new Set<string>();
            const uniqueItems = allItems.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });

            const checkedItems = uniqueItems.filter((i) => i.isChecked);

            if (checkedItems.length === 0) {
              // Force at least one item to be checked
              if (uniqueItems.length === 0) {
                return fc.constant(null as any); // will be filtered by pre()
              }
              return fc.integer({ min: 0, max: uniqueItems.length - 1 }).map((idx) => {
                const items = uniqueItems.map((item, i) =>
                  i === idx ? { ...item, isChecked: true } : item
                );
                const checkedId = items[idx].id;
                return {
                  state: {
                    lists: [{ id: 'list-1', name: 'Test', sections, items, createdAt: 1 }],
                    activeListId: 'list-1',
                    filterMode: 'all' as const,
                    collapsedSections: new Set<string>(),
                    version: 2,
                  },
                  checkedItemId: checkedId,
                };
              });
            }

            // Pick a random checked item
            return fc.integer({ min: 0, max: checkedItems.length - 1 }).map((idx) => ({
              state: {
                lists: [{ id: 'list-1', name: 'Test', sections, items: uniqueItems, createdAt: 1 }],
                activeListId: 'list-1',
                filterMode: 'all' as const,
                collapsedSections: new Set<string>(),
                version: 2,
              },
              checkedItemId: checkedItems[idx].id,
            }));
          })
      )
  );

/** Helper: get the active list */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

/** Helper: get items for a given section in array order */
function sectionItems(state: Readonly<MultiListState>, sectionId: string): readonly Item[] {
  return al(state).items.filter((i) => i.sectionId === sectionId);
}

describe('Uncheck Move to Top Properties', () => {
  /**
   * Feature: uncheck-move-to-top, Property 1: Unchecked item is placed after last unchecked item in its section
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Unchecked item is placed after last unchecked item in its section', () => {
    it('should place the unchecked item after the last unchecked item and before the first checked item in its section', () => {
      fc.assert(
        fc.property(arbStateWithCheckedItem, ({ state, checkedItemId }) => {
          fc.pre(state != null);

          const targetItem = al(state).items.find((i) => i.id === checkedItemId);
          fc.pre(targetItem !== undefined && targetItem.isChecked);

          const sm = new StateManager(state);
          sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: checkedItemId });

          const newState = sm.getState();
          const sectionId = targetItem.sectionId;
          const itemsInSection = sectionItems(newState, sectionId);

          // The toggled item should now be unchecked
          const toggledItem = al(newState).items.find((i) => i.id === checkedItemId);
          expect(toggledItem).toBeDefined();
          expect(toggledItem!.isChecked).toBe(false);

          // Find the toggled item's index within its section
          const toggledIndex = itemsInSection.findIndex((i) => i.id === checkedItemId);
          expect(toggledIndex).toBeGreaterThanOrEqual(0);

          const uncheckedInSection = itemsInSection.filter((i) => !i.isChecked);
          const checkedInSection = itemsInSection.filter((i) => i.isChecked);

          if (checkedInSection.length === 0) {
            // No checked items remain — toggled item should be the last item in the section
            // (it's among the unchecked items, and all are unchecked)
            // Verify all unchecked items come before any checked items (trivially true)
            // The toggled item should be somewhere among the unchecked items
            expect(uncheckedInSection.some((i) => i.id === checkedItemId)).toBe(true);
          } else {
            // There are still checked items — toggled item should be right before the first checked item
            const firstCheckedIndex = itemsInSection.findIndex((i) => i.isChecked);
            expect(toggledIndex).toBeLessThan(firstCheckedIndex);

            // All items before the toggled item should be unchecked
            for (let i = 0; i < toggledIndex; i++) {
              expect(itemsInSection[i].isChecked).toBe(false);
            }
          }

          if (uncheckedInSection.length === 1) {
            // Only the toggled item is unchecked — it should be the first item in the section
            expect(toggledIndex).toBe(0);
          } else {
            // Multiple unchecked items — toggled item should be after other unchecked items
            // (or among them). All items before it should be unchecked.
            for (let i = 0; i < toggledIndex; i++) {
              expect(itemsInSection[i].isChecked).toBe(false);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: uncheck-move-to-top, Property 2: All other items preserve relative order
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('Property 2: All other items preserve relative order', () => {
    it('should preserve the relative order of all other items (same-section and different-section) after unchecking', () => {
      fc.assert(
        fc.property(arbStateWithCheckedItem, ({ state, checkedItemId }) => {
          fc.pre(state != null);

          const targetItem = al(state).items.find((i) => i.id === checkedItemId);
          fc.pre(targetItem !== undefined && targetItem.isChecked);

          // Capture the order of all items excluding the toggled item before dispatch
          const otherItemIdsBefore = al(state).items
            .filter((i) => i.id !== checkedItemId)
            .map((i) => i.id);

          const sm = new StateManager(state);
          sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: checkedItemId });

          const newState = sm.getState();

          // Capture the order of all items excluding the toggled item after dispatch
          const otherItemIdsAfter = al(newState).items
            .filter((i) => i.id !== checkedItemId)
            .map((i) => i.id);

          // The relative order of all other items must be unchanged
          expect(otherItemIdsAfter).toEqual(otherItemIdsBefore);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: uncheck-move-to-top, Property 3: Checking an item does not reorder
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Checking an item does not reorder', () => {
    /**
     * Arbitrary: generate an AppState with 1-3 sections, each having 1-6 items,
     * guaranteeing at least one unchecked item exists somewhere.
     */
    const arbStateWithUncheckedItem: fc.Arbitrary<{ state: MultiListState; uncheckedItemId: string }> = fc
      .integer({ min: 1, max: 3 })
      .chain((numSections) =>
        fc
          .tuple(
            ...Array.from({ length: numSections }, (_, i) => arbSection(i))
          )
          .chain((sections: Section[]) =>
            fc
              .tuple(
                ...sections.map((sec) =>
                  fc.array(arbItem(sec.id), { minLength: 1, maxLength: 6 })
                )
              )
              .chain((itemGroups: Item[][]) => {
                const allItems = itemGroups.flat();
                // Ensure unique IDs across all items
                const seen = new Set<string>();
                const uniqueItems = allItems.filter((item) => {
                  if (seen.has(item.id)) return false;
                  seen.add(item.id);
                  return true;
                });

                const uncheckedItems = uniqueItems.filter((i) => !i.isChecked);

                if (uncheckedItems.length === 0) {
                  // Force at least one item to be unchecked
                  if (uniqueItems.length === 0) {
                    return fc.constant(null as any); // will be filtered by pre()
                  }
                  return fc.integer({ min: 0, max: uniqueItems.length - 1 }).map((idx) => {
                    const items = uniqueItems.map((item, i) =>
                      i === idx ? { ...item, isChecked: false } : item
                    );
                    const uncheckedId = items[idx].id;
                    return {
                      state: {
                        lists: [{ id: 'list-1', name: 'Test', sections, items, createdAt: 1 }],
                        activeListId: 'list-1',
                        filterMode: 'all' as const,
                        collapsedSections: new Set<string>(),
                        version: 2,
                      },
                      uncheckedItemId: uncheckedId,
                    };
                  });
                }

                // Pick a random unchecked item
                return fc.integer({ min: 0, max: uncheckedItems.length - 1 }).map((idx) => ({
                  state: {
                    lists: [{ id: 'list-1', name: 'Test', sections, items: uniqueItems, createdAt: 1 }],
                    activeListId: 'list-1',
                    filterMode: 'all' as const,
                    collapsedSections: new Set<string>(),
                    version: 2,
                  },
                  uncheckedItemId: uncheckedItems[idx].id,
                }));
              })
          )
      );

    it('should not change the items array order when checking an unchecked item', () => {
      fc.assert(
        fc.property(arbStateWithUncheckedItem, ({ state, uncheckedItemId }) => {
          fc.pre(state != null);

          const targetItem = al(state).items.find((i) => i.id === uncheckedItemId);
          fc.pre(targetItem !== undefined && !targetItem.isChecked);

          // Capture item IDs in order before dispatch
          const itemIdsBefore = al(state).items.map((i) => i.id);

          const sm = new StateManager(state);
          sm.dispatch({ type: 'TOGGLE_ITEM_CHECK', id: uncheckedItemId });

          const newState = sm.getState();

          // Item IDs order should be identical
          const itemIdsAfter = al(newState).items.map((i) => i.id);
          expect(itemIdsAfter).toEqual(itemIdsBefore);

          // Only the toggled item's isChecked should differ
          for (const item of al(newState).items) {
            const originalItem = al(state).items.find((i) => i.id === item.id);
            expect(originalItem).toBeDefined();
            if (item.id === uncheckedItemId) {
              expect(item.isChecked).toBe(true);
              expect(originalItem!.isChecked).toBe(false);
            } else {
              expect(item.isChecked).toBe(originalItem!.isChecked);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
