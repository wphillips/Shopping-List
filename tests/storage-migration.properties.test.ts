/**
 * Property-based tests for storage migration
 * Feature: multi-list-sharing
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { migrateV1ToV2, saveMultiListState, loadMultiListState } from '../src/storage';
import type { Section, Item, AppState, GroceryList, MultiListState } from '../src/types';

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
 * Generate a valid v1 AppState with 0-5 sections and 0-10 items per section
 */
function arbV1AppState(): fc.Arbitrary<AppState> {
  return fc
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
          sections: [] as Section[],
          items: [] as Item[],
          filterMode: 'all' as const,
          collapsedSections: new Set<string>(),
          selectedSectionId: null,
          version: 1,
        });
      }

      const itemArbs = sections.map((section) =>
        fc.array(arbItem(section.id), { minLength: 0, maxLength: 10 })
      );

      return fc.tuple(...itemArbs).map((itemArrays) => {
        const items: Item[] = itemArrays.flat();
        return {
          sections,
          items,
          filterMode: 'all' as const,
          collapsedSections: new Set<string>(),
          selectedSectionId: null,
          version: 1,
        };
      });
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

// --- Property Tests ---

describe('Storage Migration Properties', () => {
  // Feature: multi-list-sharing, Property 6: V1 to V2 migration preserves all sections and items
  describe('Property 6: V1 to V2 migration preserves all sections and items', () => {
    /**
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should produce a MultiListState with version 2, one list, and all original sections and items preserved', () => {
      fc.assert(
        fc.property(arbV1AppState(), (v1State) => {
          const v2State = migrateV1ToV2(v1State);

          // Version must be 2
          expect(v2State.version).toBe(2);

          // Must have exactly one list
          expect(v2State.lists).toHaveLength(1);

          const list = v2State.lists[0];

          // List must have a valid id and activeListId must match
          expect(typeof list.id).toBe('string');
          expect(list.id.length).toBeGreaterThan(0);
          expect(v2State.activeListId).toBe(list.id);

          // All sections preserved: same count
          expect(list.sections).toHaveLength(v1State.sections.length);

          // Sections have same names in same order
          for (let i = 0; i < v1State.sections.length; i++) {
            expect(list.sections[i].name).toBe(v1State.sections[i].name);
            expect(list.sections[i].order).toBe(v1State.sections[i].order);
          }

          // All items preserved: same count
          expect(list.items).toHaveLength(v1State.items.length);

          // Items have same names, quantities, checked states, and section assignments
          // Sort both by id for stable comparison
          const originalItems = [...v1State.items].sort((a, b) => a.id.localeCompare(b.id));
          const migratedItems = [...list.items].sort((a, b) => a.id.localeCompare(b.id));

          for (let i = 0; i < originalItems.length; i++) {
            expect(migratedItems[i].name).toBe(originalItems[i].name);
            expect(migratedItems[i].quantity).toBe(originalItems[i].quantity);
            expect(migratedItems[i].isChecked).toBe(originalItems[i].isChecked);
            expect(migratedItems[i].sectionId).toBe(originalItems[i].sectionId);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 7: Loading a valid V2 state is idempotent
  describe('Property 7: Loading a valid V2 state is idempotent', () => {
    /**
     * **Validates: Requirements 2.3**
     */
    it('should produce an equivalent state after saving then loading a valid V2 state', () => {
      fc.assert(
        fc.property(arbMultiListState(), (state) => {
          // Save the state to localStorage
          saveMultiListState(state);

          // Load it back
          const loaded = loadMultiListState();

          // Version must be preserved
          expect(loaded.version).toBe(2);

          // Same number of lists
          expect(loaded.lists).toHaveLength(state.lists.length);

          // Same active list
          expect(loaded.activeListId).toBe(state.activeListId);

          // Same filter mode
          expect(loaded.filterMode).toBe(state.filterMode);

          // Each list should have the same content
          for (let i = 0; i < state.lists.length; i++) {
            const original = state.lists[i];
            const roundTripped = loaded.lists[i];

            expect(roundTripped.id).toBe(original.id);
            expect(roundTripped.name).toBe(original.name);
            expect(roundTripped.createdAt).toBe(original.createdAt);

            // Sections preserved
            expect(roundTripped.sections).toHaveLength(original.sections.length);
            for (let j = 0; j < original.sections.length; j++) {
              expect(roundTripped.sections[j].id).toBe(original.sections[j].id);
              expect(roundTripped.sections[j].name).toBe(original.sections[j].name);
              expect(roundTripped.sections[j].order).toBe(original.sections[j].order);
              expect(roundTripped.sections[j].createdAt).toBe(original.sections[j].createdAt);
            }

            // Items preserved
            expect(roundTripped.items).toHaveLength(original.items.length);
            const originalItems = [...original.items].sort((a, b) => a.id.localeCompare(b.id));
            const loadedItems = [...roundTripped.items].sort((a, b) => a.id.localeCompare(b.id));
            for (let j = 0; j < originalItems.length; j++) {
              expect(loadedItems[j].id).toBe(originalItems[j].id);
              expect(loadedItems[j].name).toBe(originalItems[j].name);
              expect(loadedItems[j].quantity).toBe(originalItems[j].quantity);
              expect(loadedItems[j].isChecked).toBe(originalItems[j].isChecked);
              expect(loadedItems[j].sectionId).toBe(originalItems[j].sectionId);
              expect(loadedItems[j].createdAt).toBe(originalItems[j].createdAt);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 8: Invalid stored data falls back to a default state
  describe('Property 8: Invalid stored data falls back to a default state', () => {
    /**
     * **Validates: Requirements 2.4**
     */
    it('should return a default state with version 2 and one empty list for invalid stored data', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Strings that are not valid JSON
            fc.string({ minLength: 1 }).filter((s) => {
              try { JSON.parse(s); return false; } catch { return true; }
            }),
            // Valid JSON but not an object (numbers, arrays, booleans, strings)
            fc.oneof(
              fc.integer().map((n) => JSON.stringify(n)),
              fc.boolean().map((b) => JSON.stringify(b)),
              fc.array(fc.integer(), { minLength: 0, maxLength: 3 }).map((a) => JSON.stringify(a)),
              fc.constant('null'),
            ),
            // Objects missing required fields
            fc.record({
              version: fc.constant(2),
            }).map((obj) => JSON.stringify(obj)),
            // Objects with wrong types for required fields
            fc.record({
              version: fc.constant(2),
              lists: fc.constant('not-an-array'),
              activeListId: fc.integer(),
              filterMode: fc.constant(42),
              collapsedSections: fc.constant('nope'),
            }).map((obj) => JSON.stringify(obj)),
            // Objects with version 2 but empty lists array
            fc.constant(JSON.stringify({ version: 2, lists: [], activeListId: 'x', filterMode: 'all', collapsedSections: [] })),
            // Objects with unknown version
            fc.integer({ min: 3, max: 999 }).map((v) =>
              JSON.stringify({ version: v, lists: [], activeListId: 'x', filterMode: 'all', collapsedSections: [] })
            ),
          ),
          (invalidData) => {
            // Write invalid data directly to localStorage
            localStorage.setItem('grocery-list-state', invalidData);

            const result = loadMultiListState();

            // Must return version 2
            expect(result.version).toBe(2);

            // Must have exactly one list
            expect(result.lists).toHaveLength(1);

            // The single list must have empty sections and items
            expect(result.lists[0].sections).toHaveLength(0);
            expect(result.lists[0].items).toHaveLength(0);

            // activeListId must reference the single list
            expect(result.activeListId).toBe(result.lists[0].id);

            // collapsedSections must be a Set
            expect(result.collapsedSections).toBeInstanceOf(Set);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
