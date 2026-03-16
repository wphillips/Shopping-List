/**
 * Unit tests for serializer module
 * Feature: multi-list-sharing
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../src/serializer';
import type { GroceryList } from '../src/types';

/** Helper to build a GroceryList for testing */
function makeList(overrides: Partial<GroceryList> = {}): GroceryList {
  const sectionId = 'sec-1';
  return {
    id: 'list-1',
    name: 'Weekly Groceries',
    createdAt: 1700000000000,
    sections: [
      { id: sectionId, name: 'Produce', order: 0, createdAt: 1700000000000 },
      { id: 'sec-2', name: 'Dairy', order: 1, createdAt: 1700000000000 },
    ],
    items: [
      { id: 'item-1', name: 'Apples', quantity: 3, isChecked: false, sectionId, createdAt: 1700000000000 },
      { id: 'item-2', name: 'Milk', quantity: 1, isChecked: true, sectionId: 'sec-2', createdAt: 1700000000000 },
    ],
    ...overrides,
  };
}

describe('Serializer Unit Tests', () => {
  // --- serialize ---

  describe('serialize', () => {
    it('produces correct JSON structure with sections and nested items', () => {
      const list = makeList();
      const json = serialize(list);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('Weekly Groceries');
      expect(parsed.sections).toHaveLength(2);

      // Produce section with its item
      expect(parsed.sections[0].name).toBe('Produce');
      expect(parsed.sections[0].order).toBe(0);
      expect(parsed.sections[0].items).toHaveLength(1);
      expect(parsed.sections[0].items[0]).toEqual({ name: 'Apples', quantity: 3, isChecked: false });

      // Dairy section with its item
      expect(parsed.sections[1].name).toBe('Dairy');
      expect(parsed.sections[1].order).toBe(1);
      expect(parsed.sections[1].items).toHaveLength(1);
      expect(parsed.sections[1].items[0]).toEqual({ name: 'Milk', quantity: 1, isChecked: true });
    });

    it('serializes an empty list (no sections, no items)', () => {
      const list = makeList({ sections: [], items: [] });
      const json = serialize(list);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('Weekly Groceries');
      expect(parsed.sections).toEqual([]);
    });

    it('excludes IDs, timestamps, and UI state from output', () => {
      const list = makeList();
      const json = serialize(list);
      const parsed = JSON.parse(json);

      // Top-level: only name and sections
      expect(Object.keys(parsed).sort()).toEqual(['name', 'sections']);

      // Section level: only name, order, items
      for (const section of parsed.sections) {
        expect(Object.keys(section).sort()).toEqual(['items', 'name', 'order']);
      }

      // Item level: only name, quantity, isChecked
      for (const section of parsed.sections) {
        for (const item of section.items) {
          expect(Object.keys(item).sort()).toEqual(['isChecked', 'name', 'quantity']);
        }
      }
    });

    it('handles special characters: emoji, HTML, accented chars', () => {
      const list = makeList({
        name: '🛒 Épicerie <b>spéciale</b>',
        sections: [
          { id: 'sec-sp', name: 'Légumes & Früchte 🥕', order: 0, createdAt: 1700000000000 },
        ],
        items: [
          { id: 'item-sp', name: 'Ñoquis <script>alert("xss")</script>', quantity: 2, isChecked: false, sectionId: 'sec-sp', createdAt: 1700000000000 },
        ],
      });

      const json = serialize(list);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('🛒 Épicerie <b>spéciale</b>');
      expect(parsed.sections[0].name).toBe('Légumes & Früchte 🥕');
      expect(parsed.sections[0].items[0].name).toBe('Ñoquis <script>alert("xss")</script>');
    });
  });

  // --- deserialize ---

  describe('deserialize', () => {
    it('deserializes valid JSON and produces a GroceryList with fresh IDs', () => {
      const validJson = JSON.stringify({
        name: 'Test List',
        sections: [
          {
            name: 'Produce',
            order: 0,
            items: [{ name: 'Bananas', quantity: 5, isChecked: false }],
          },
        ],
      });

      const result = deserialize(validJson);
      expect(result).not.toHaveProperty('error');

      const list = result as GroceryList;
      expect(list.name).toBe('Test List');
      expect(list.sections).toHaveLength(1);
      expect(list.sections[0].name).toBe('Produce');
      expect(list.items).toHaveLength(1);
      expect(list.items[0].name).toBe('Bananas');
      expect(list.items[0].quantity).toBe(5);
      expect(list.items[0].isChecked).toBe(false);

      // Fresh IDs — should be UUID-shaped
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(list.id).toMatch(uuidPattern);
      expect(list.sections[0].id).toMatch(uuidPattern);
      expect(list.items[0].id).toMatch(uuidPattern);

      // Item should reference the section
      expect(list.items[0].sectionId).toBe(list.sections[0].id);
    });

    it('returns error for invalid JSON', () => {
      const result = deserialize('not valid json {{{');
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Invalid JSON');
    });

    it('returns error for JSON missing required "name" field', () => {
      const result = deserialize(JSON.stringify({ sections: [] }));
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('name');
    });

    it('returns error for JSON missing required "sections" field', () => {
      const result = deserialize(JSON.stringify({ name: 'Test' }));
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('sections');
    });

    it('returns error for section missing required "items" field', () => {
      const json = JSON.stringify({
        name: 'Test',
        sections: [{ name: 'S', order: 0 }],
      });
      const result = deserialize(json);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('items');
    });

    it('returns error for item with invalid quantity (zero)', () => {
      const json = JSON.stringify({
        name: 'Test',
        sections: [
          { name: 'S', order: 0, items: [{ name: 'I', quantity: 0, isChecked: false }] },
        ],
      });
      const result = deserialize(json);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('quantity');
    });

    it('returns error for item with invalid quantity (negative)', () => {
      const json = JSON.stringify({
        name: 'Test',
        sections: [
          { name: 'S', order: 0, items: [{ name: 'I', quantity: -3, isChecked: false }] },
        ],
      });
      const result = deserialize(json);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('quantity');
    });

    it('returns error for item with non-numeric quantity', () => {
      const json = JSON.stringify({
        name: 'Test',
        sections: [
          { name: 'S', order: 0, items: [{ name: 'I', quantity: 'two', isChecked: false }] },
        ],
      });
      const result = deserialize(json);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('quantity');
    });
  });

  // --- round-trip ---

  describe('round-trip: serialize then deserialize', () => {
    it('preserves list content through a round-trip', () => {
      const original = makeList();
      const json = serialize(original);
      const result = deserialize(json);

      expect(result).not.toHaveProperty('error');
      const restored = result as GroceryList;

      expect(restored.name).toBe(original.name);
      expect(restored.sections).toHaveLength(original.sections.length);

      // Section names and order preserved
      for (let i = 0; i < original.sections.length; i++) {
        expect(restored.sections[i].name).toBe(original.sections[i].name);
        expect(restored.sections[i].order).toBe(original.sections[i].order);
      }

      // Items per section preserved
      for (let i = 0; i < original.sections.length; i++) {
        const origItems = original.items
          .filter((it) => it.sectionId === original.sections[i].id)
          .map(({ name, quantity, isChecked }) => ({ name, quantity, isChecked }));
        const restoredItems = restored.items
          .filter((it) => it.sectionId === restored.sections[i].id)
          .map(({ name, quantity, isChecked }) => ({ name, quantity, isChecked }));

        expect(restoredItems).toEqual(origItems);
      }
    });

    it('round-trips an empty list', () => {
      const original = makeList({ sections: [], items: [] });
      const json = serialize(original);
      const result = deserialize(json);

      expect(result).not.toHaveProperty('error');
      const restored = result as GroceryList;

      expect(restored.name).toBe(original.name);
      expect(restored.sections).toHaveLength(0);
      expect(restored.items).toHaveLength(0);
    });

    it('round-trips a list with special characters', () => {
      const original = makeList({
        name: '🎉 Fête des crêpes',
        sections: [
          { id: 'sec-u', name: 'Ünïcödé & <tags>', order: 0, createdAt: 1700000000000 },
        ],
        items: [
          { id: 'item-u', name: '日本語テスト', quantity: 7, isChecked: true, sectionId: 'sec-u', createdAt: 1700000000000 },
        ],
      });

      const json = serialize(original);
      const result = deserialize(json);

      expect(result).not.toHaveProperty('error');
      const restored = result as GroceryList;

      expect(restored.name).toBe('🎉 Fête des crêpes');
      expect(restored.sections[0].name).toBe('Ünïcödé & <tags>');
      expect(restored.items[0].name).toBe('日本語テスト');
      expect(restored.items[0].quantity).toBe(7);
      expect(restored.items[0].isChecked).toBe(true);
    });
  });
});
