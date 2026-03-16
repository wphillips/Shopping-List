/**
 * Property-based tests for serializer module
 * Feature: multi-list-sharing
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serialize, deserialize } from '../src/serializer';
import type { Section, Item, GroceryList } from '../src/types';

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
 * Generate strings that are not valid JSON or don't match the SerializedList schema
 */
function arbInvalidJson(): fc.Arbitrary<string> {
  return fc.oneof(
    // Not valid JSON at all
    fc.string({ minLength: 1, maxLength: 100 }).filter((s) => {
      try { JSON.parse(s); return false; } catch { return true; }
    }),
    // Valid JSON but wrong type (number, string, array, null, boolean)
    fc.constant('42'),
    fc.constant('"just a string"'),
    fc.constant('null'),
    fc.constant('true'),
    fc.constant('[]'),
    // Object missing required fields
    fc.constant('{}'),
    fc.constant('{"name": "Test"}'),
    fc.constant('{"sections": []}'),
    // Sections not an array
    fc.constant('{"name": "Test", "sections": "not-array"}'),
    // Section missing fields
    fc.constant('{"name": "Test", "sections": [{}]}'),
    fc.constant('{"name": "Test", "sections": [{"name": "S", "order": 0}]}'),
    // Item with invalid quantity
    fc.constant('{"name": "Test", "sections": [{"name": "S", "order": 0, "items": [{"name": "I", "quantity": -1, "isChecked": false}]}]}'),
    fc.constant('{"name": "Test", "sections": [{"name": "S", "order": 0, "items": [{"name": "I", "quantity": 0, "isChecked": false}]}]}'),
    // Item with wrong types
    fc.constant('{"name": "Test", "sections": [{"name": "S", "order": 0, "items": [{"name": "I", "quantity": "two", "isChecked": false}]}]}'),
    fc.constant('{"name": "Test", "sections": [{"name": "S", "order": 0, "items": [{"name": "I", "quantity": 1, "isChecked": "yes"}]}]}'),
    // Name is not a string
    fc.constant('{"name": 123, "sections": []}'),
  );
}

// --- Forbidden fields that should never appear in serialized output ---
const FORBIDDEN_FIELDS = ['id', 'createdAt', 'filterMode', 'collapsedSections', 'sectionId'];

/**
 * Recursively check that no forbidden fields exist at any level of an object
 */
function containsForbiddenField(obj: any): string | null {
  if (obj === null || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = containsForbiddenField(item);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_FIELDS.includes(key)) return key;
    const found = containsForbiddenField(obj[key]);
    if (found) return found;
  }
  return null;
}

// --- Property Tests ---

describe('Serializer Properties', () => {
  // Feature: multi-list-sharing, Property 9: Serialized output contains exactly the portable fields
  describe('Property 9: Serialized output contains exactly the portable fields', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     */
    it('should produce JSON with only name, sections (name, order, items), and items (name, quantity, isChecked)', () => {
      fc.assert(
        fc.property(arbGroceryList(), (list) => {
          const json = serialize(list);
          const parsed = JSON.parse(json);

          // Top-level should only have 'name' and 'sections'
          const topKeys = Object.keys(parsed).sort();
          expect(topKeys).toEqual(['name', 'sections']);
          expect(typeof parsed.name).toBe('string');
          expect(Array.isArray(parsed.sections)).toBe(true);

          for (const section of parsed.sections) {
            // Each section should only have 'name', 'order', 'items'
            const sectionKeys = Object.keys(section).sort();
            expect(sectionKeys).toEqual(['items', 'name', 'order']);
            expect(typeof section.name).toBe('string');
            expect(typeof section.order).toBe('number');
            expect(Array.isArray(section.items)).toBe(true);

            for (const item of section.items) {
              // Each item should only have 'name', 'quantity', 'isChecked'
              const itemKeys = Object.keys(item).sort();
              expect(itemKeys).toEqual(['isChecked', 'name', 'quantity']);
              expect(typeof item.name).toBe('string');
              expect(typeof item.quantity).toBe('number');
              expect(typeof item.isChecked).toBe('boolean');
            }
          }

          // No forbidden fields at any level
          const forbidden = containsForbiddenField(parsed);
          expect(forbidden).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 10: Serialization round-trip preserves list content
  describe('Property 10: Serialization round-trip preserves list content', () => {
    /**
     * **Validates: Requirements 3.6**
     */
    it('should preserve name, section names/order, and item names/quantities/checked states after serialize then deserialize', () => {
      fc.assert(
        fc.property(arbGroceryList(), (list) => {
          const json = serialize(list);
          const result = deserialize(json);

          // Should not be an error
          expect(result).not.toHaveProperty('error');
          const restored = result as GroceryList;

          // Same list name
          expect(restored.name).toBe(list.name);

          // Same number of sections with same names and order
          expect(restored.sections.length).toBe(list.sections.length);
          for (let i = 0; i < list.sections.length; i++) {
            expect(restored.sections[i].name).toBe(list.sections[i].name);
            expect(restored.sections[i].order).toBe(list.sections[i].order);
          }

          // Same items per section with same names, quantities, checked states
          for (let i = 0; i < list.sections.length; i++) {
            const originalItems = list.items
              .filter((item) => item.sectionId === list.sections[i].id)
              .map(({ name, quantity, isChecked }) => ({ name, quantity, isChecked }));
            const restoredItems = restored.items
              .filter((item) => item.sectionId === restored.sections[i].id)
              .map(({ name, quantity, isChecked }) => ({ name, quantity, isChecked }));

            expect(restoredItems).toEqual(originalItems);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 11: Deserialization generates fresh unique IDs
  describe('Property 11: Deserialization generates fresh unique IDs', () => {
    /**
     * **Validates: Requirements 3.4, 6.6**
     */
    it('should produce unique UUIDs for all sections and items, none matching the original list IDs', () => {
      fc.assert(
        fc.property(arbGroceryList(), (list) => {
          const json = serialize(list);
          const result = deserialize(json);

          expect(result).not.toHaveProperty('error');
          const restored = result as GroceryList;

          // Collect all IDs from the deserialized list
          const allNewIds = [
            restored.id,
            ...restored.sections.map((s) => s.id),
            ...restored.items.map((i) => i.id),
          ];

          // All IDs should be unique
          const uniqueIds = new Set(allNewIds);
          expect(uniqueIds.size).toBe(allNewIds.length);

          // Collect all IDs from the original list
          const originalIds = new Set([
            list.id,
            ...list.sections.map((s) => s.id),
            ...list.items.map((i) => i.id),
          ]);

          // No new ID should match any original ID
          for (const newId of allNewIds) {
            expect(originalIds.has(newId)).toBe(false);
          }

          // All IDs should look like UUIDs (8-4-4-4-12 hex pattern)
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          for (const id of allNewIds) {
            expect(id).toMatch(uuidPattern);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: multi-list-sharing, Property 12: Deserialization rejects invalid input
  describe('Property 12: Deserialization rejects invalid input', () => {
    /**
     * **Validates: Requirements 3.5**
     */
    it('should return { error: string } for invalid JSON or non-conforming objects', () => {
      fc.assert(
        fc.property(arbInvalidJson(), (input) => {
          const result = deserialize(input);

          // Should be an error object
          expect(result).toHaveProperty('error');
          expect(typeof (result as { error: string }).error).toBe('string');
          expect((result as { error: string }).error.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
