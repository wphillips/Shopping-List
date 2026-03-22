/**
 * Preservation Property Tests — Non-Import Load and CRUD Behavior Unchanged
 *
 * These tests capture baseline behavior that MUST be preserved after the bugfix.
 * They verify that valid states round-trip correctly, import appends properly,
 * and edge cases (no data, invalid JSON) produce correct defaults.
 *
 * All tests MUST PASS on UNFIXED code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  saveMultiListState,
  loadMultiListState,
} from '../src/storage';
import { reducer } from '../src/state';
import type { MultiListState, GroceryList, Section, Item, FilterMode } from '../src/types';

const STORAGE_KEY = 'grocery-list-state';

// ─── Generators ───

/** Generate a valid Section */
const arbSection = (index: number): fc.Arbitrary<Section> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    order: fc.constant(index),
    createdAt: fc.integer({ min: 1, max: 2_000_000_000_000 }),
  });

/** Generate a valid Item tied to a given sectionId */
const arbItem = (sectionId: string): fc.Arbitrary<Item> =>
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 100 }),
    isChecked: fc.boolean(),
    sectionId: fc.constant(sectionId),
    createdAt: fc.integer({ min: 1, max: 2_000_000_000_000 }),
  });

/** Generate a valid GroceryList with 0-3 sections and 0-3 items per section */
const arbGroceryList: fc.Arbitrary<GroceryList> = fc
  .integer({ min: 0, max: 3 })
  .chain((numSections) => {
    const sectionArbs = Array.from({ length: numSections }, (_, i) => arbSection(i));
    return sectionArbs.length > 0
      ? fc.tuple(...(sectionArbs as [fc.Arbitrary<Section>, ...fc.Arbitrary<Section>[]]))
          .map((sections) => sections as Section[])
      : fc.constant([] as Section[]);
  })
  .chain((sections) => {
    const itemArbs = sections.flatMap((s) =>
      Array.from({ length: 1 }, () => arbItem(s.id))
    );
    const itemsArb =
      itemArbs.length > 0
        ? fc.tuple(...(itemArbs as [fc.Arbitrary<Item>, ...fc.Arbitrary<Item>[]]))
            .map((items) => items as Item[])
        : fc.constant([] as Item[]);
    return fc.tuple(fc.constant(sections), itemsArb);
  })
  .chain(([sections, items]) =>
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      sections: fc.constant(sections),
      items: fc.constant(items),
      createdAt: fc.integer({ min: 1, max: 2_000_000_000_000 }),
    })
  );

/** Generate a valid MultiListState with 1-3 lists */
const arbMultiListState: fc.Arbitrary<MultiListState> = fc
  .array(arbGroceryList, { minLength: 1, maxLength: 3 })
  .chain((lists) => {
    const activeIndex = fc.integer({ min: 0, max: lists.length - 1 });
    return fc.tuple(fc.constant(lists), activeIndex);
  })
  .chain(([lists, activeIdx]) =>
    fc.record({
      lists: fc.constant(lists),
      activeListId: fc.constant(lists[activeIdx].id),
      filterMode: fc.constantFrom<FilterMode>('all', 'checked', 'unchecked'),
      collapsedSections: fc.constant(new Set<string>()),
      version: fc.constant(2 as const),
    })
  );

// ─── Tests ───

describe('Preservation: Non-Import Load and CRUD Behavior Unchanged', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * PBT 1: For all valid MultiListState objects, saveMultiListState(state) then
   * loadMultiListState() returns a state with the same lists, activeListId, and
   * filterMode (modulo Set ↔ Array conversion for collapsedSections).
   *
   * **Validates: Requirements 3.1, 3.6**
   */
  it('PBT 1: valid MultiListState round-trips through save → load', () => {
    fc.assert(
      fc.property(arbMultiListState, (state) => {
        saveMultiListState(state);
        const loaded = loadMultiListState();

        // Same number of lists
        expect(loaded.lists.length).toBe(state.lists.length);

        // Same activeListId
        expect(loaded.activeListId).toBe(state.activeListId);

        // Same filterMode
        expect(loaded.filterMode).toBe(state.filterMode);

        // Same version
        expect(loaded.version).toBe(2);

        // Each list matches by id, name, sections, items
        for (let i = 0; i < state.lists.length; i++) {
          const orig = state.lists[i];
          const roundTripped = loaded.lists[i];

          expect(roundTripped.id).toBe(orig.id);
          expect(roundTripped.name).toBe(orig.name);
          expect(roundTripped.createdAt).toBe(orig.createdAt);
          expect(roundTripped.sections.length).toBe(orig.sections.length);
          expect(roundTripped.items.length).toBe(orig.items.length);

          for (let s = 0; s < orig.sections.length; s++) {
            expect(roundTripped.sections[s].id).toBe(orig.sections[s].id);
            expect(roundTripped.sections[s].name).toBe(orig.sections[s].name);
          }

          for (let j = 0; j < orig.items.length; j++) {
            expect(roundTripped.items[j].id).toBe(orig.items[j].id);
            expect(roundTripped.items[j].name).toBe(orig.items[j].name);
            expect(roundTripped.items[j].quantity).toBe(orig.items[j].quantity);
            expect(roundTripped.items[j].isChecked).toBe(orig.items[j].isChecked);
            expect(roundTripped.items[j].sectionId).toBe(orig.items[j].sectionId);
          }
        }

        // collapsedSections: Set → Array → Set round-trip
        expect(loaded.collapsedSections).toBeInstanceOf(Set);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * PBT 2: For all valid MultiListState objects + a valid imported GroceryList,
   * dispatching IMPORT_LIST appends the list and sets it as active, preserving
   * all existing lists.
   *
   * **Validates: Requirements 3.2, 3.6**
   */
  it('PBT 2: IMPORT_LIST appends list and preserves all existing lists', () => {
    fc.assert(
      fc.property(arbMultiListState, arbGroceryList, (state, importedList) => {
        // Ensure imported list has a unique id
        const usedIds = new Set(state.lists.map((l) => l.id));
        if (usedIds.has(importedList.id)) return; // skip collision

        const result = reducer(state, { type: 'IMPORT_LIST', list: importedList });

        // All original lists are preserved
        for (const orig of state.lists) {
          const found = result.lists.find((l) => l.id === orig.id);
          expect(found).toBeDefined();
          expect(found!.name).toBe(orig.name);
          expect(found!.sections.length).toBe(orig.sections.length);
          expect(found!.items.length).toBe(orig.items.length);
        }

        // Imported list is appended
        const imported = result.lists.find((l) => l.id === importedList.id);
        expect(imported).toBeDefined();
        expect(imported!.name).toBe(importedList.name);

        // Imported list is set as active
        expect(result.activeListId).toBe(importedList.id);

        // Total list count = original + 1
        expect(result.lists.length).toBe(state.lists.length + 1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Unit: Normal loadMultiListState() with no localStorage data returns
   * default state with 1 empty list.
   *
   * **Validates: Requirements 3.1**
   */
  it('Unit: loadMultiListState with no localStorage returns default state with 1 empty list', () => {
    // localStorage is already cleared in beforeEach
    const state = loadMultiListState();

    expect(state.lists.length).toBe(1);
    expect(state.lists[0].sections.length).toBe(0);
    expect(state.lists[0].items.length).toBe(0);
    expect(state.lists[0].name).toBe('My Grocery List');
    expect(state.activeListId).toBe(state.lists[0].id);
    expect(state.filterMode).toBe('all');
    expect(state.version).toBe(2);
  });

  /**
   * Unit: loadMultiListState with completely invalid JSON returns default state.
   *
   * **Validates: Requirements 3.5**
   */
  it('Unit: loadMultiListState with invalid JSON returns default state', () => {
    localStorage.setItem(STORAGE_KEY, 'not json at all!!!');
    const state = loadMultiListState();

    expect(state.lists.length).toBe(1);
    expect(state.lists[0].sections.length).toBe(0);
    expect(state.lists[0].items.length).toBe(0);
    expect(state.activeListId).toBe(state.lists[0].id);
    expect(state.filterMode).toBe('all');
    expect(state.version).toBe(2);
  });
});
