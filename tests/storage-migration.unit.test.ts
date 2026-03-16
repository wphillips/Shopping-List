/**
 * Unit tests for storage migration
 * Tests specific v1 data shapes, edge cases, corrupt data, and round-trip behavior
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  migrateV1ToV2,
  loadMultiListState,
  saveMultiListState,
  createDefaultMultiListState,
} from '../src/storage';

const STORAGE_KEY = 'grocery-list-state';

describe('Storage Migration Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // --- migrateV1ToV2 ---

  describe('migrateV1ToV2', () => {
    it('should migrate a typical v1 state with sections and items', () => {
      const v1Data = {
        sections: [
          { id: 's1', name: 'Produce', order: 0, createdAt: 1000 },
          { id: 's2', name: 'Dairy', order: 1, createdAt: 2000 },
        ],
        items: [
          { id: 'i1', name: 'Apples', quantity: 3, isChecked: false, sectionId: 's1', createdAt: 1100 },
          { id: 'i2', name: 'Milk', quantity: 1, isChecked: true, sectionId: 's2', createdAt: 2100 },
        ],
        filterMode: 'all',
        collapsedSections: ['s1'],
        selectedSectionId: null,
        version: 1,
      };

      const result = migrateV1ToV2(v1Data);

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].name).toBe('My Grocery List');
      expect(result.lists[0].sections).toHaveLength(2);
      expect(result.lists[0].sections[0].name).toBe('Produce');
      expect(result.lists[0].sections[1].name).toBe('Dairy');
      expect(result.lists[0].items).toHaveLength(2);
      expect(result.lists[0].items[0].name).toBe('Apples');
      expect(result.lists[0].items[1].name).toBe('Milk');
      expect(result.activeListId).toBe(result.lists[0].id);
      expect(result.filterMode).toBe('all');
      expect(result.collapsedSections).toBeInstanceOf(Set);
      expect(result.collapsedSections.has('s1')).toBe(true);
    });

    it('should migrate an empty v1 state with no sections and no items', () => {
      const v1Data = {
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
        version: 1,
      };

      const result = migrateV1ToV2(v1Data);

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].sections).toHaveLength(0);
      expect(result.lists[0].items).toHaveLength(0);
      expect(result.activeListId).toBe(result.lists[0].id);
    });

    it('should migrate v1 state with special characters in names', () => {
      const v1Data = {
        sections: [
          { id: 's1', name: 'Fruits & Vegetables 🍎', order: 0, createdAt: 1000 },
          { id: 's2', name: '<script>alert("xss")</script>', order: 1, createdAt: 2000 },
        ],
        items: [
          { id: 'i1', name: 'Jalapeño Peppers™', quantity: 2, isChecked: false, sectionId: 's1', createdAt: 1100 },
          { id: 'i2', name: 'Crème fraîche "special"', quantity: 1, isChecked: false, sectionId: 's2', createdAt: 2100 },
        ],
        filterMode: 'unchecked',
        collapsedSections: [],
        selectedSectionId: null,
        version: 1,
      };

      const result = migrateV1ToV2(v1Data);

      expect(result.version).toBe(2);
      expect(result.lists[0].sections[0].name).toBe('Fruits & Vegetables 🍎');
      expect(result.lists[0].sections[1].name).toBe('<script>alert("xss")</script>');
      expect(result.lists[0].items[0].name).toBe('Jalapeño Peppers™');
      expect(result.lists[0].items[1].name).toBe('Crème fraîche "special"');
      expect(result.filterMode).toBe('unchecked');
    });
  });

  // --- loadMultiListState ---

  describe('loadMultiListState', () => {
    it('should return default state when no data is stored', () => {
      const result = loadMultiListState();

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].sections).toHaveLength(0);
      expect(result.lists[0].items).toHaveLength(0);
      expect(result.lists[0].name).toBe('My Grocery List');
      expect(result.activeListId).toBe(result.lists[0].id);
      expect(result.collapsedSections).toBeInstanceOf(Set);
      expect(result.filterMode).toBe('all');
    });

    it('should return default state for corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!!');

      const result = loadMultiListState();

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].sections).toHaveLength(0);
      expect(result.lists[0].items).toHaveLength(0);
      expect(result.activeListId).toBe(result.lists[0].id);
    });

    it('should return default state for missing required fields', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2 }));

      const result = loadMultiListState();

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].sections).toHaveLength(0);
      expect(result.lists[0].items).toHaveLength(0);
    });

    it('should return default state for wrong types in fields', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        lists: 'not-an-array',
        activeListId: 123,
        filterMode: true,
        collapsedSections: 'nope',
      }));

      const result = loadMultiListState();

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].sections).toHaveLength(0);
      expect(result.lists[0].items).toHaveLength(0);
    });

    it('should load valid v2 data directly', () => {
      const v2Data = {
        version: 2,
        lists: [{
          id: 'list-1',
          name: 'Weekly Shopping',
          sections: [{ id: 's1', name: 'Produce', order: 0, createdAt: 1000 }],
          items: [{ id: 'i1', name: 'Bananas', quantity: 6, isChecked: false, sectionId: 's1', createdAt: 1100 }],
          createdAt: 500,
        }],
        activeListId: 'list-1',
        filterMode: 'all',
        collapsedSections: ['s1'],
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(v2Data));

      const result = loadMultiListState();

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].id).toBe('list-1');
      expect(result.lists[0].name).toBe('Weekly Shopping');
      expect(result.lists[0].sections[0].name).toBe('Produce');
      expect(result.lists[0].items[0].name).toBe('Bananas');
      expect(result.activeListId).toBe('list-1');
      expect(result.collapsedSections).toBeInstanceOf(Set);
      expect(result.collapsedSections.has('s1')).toBe(true);
    });

    it('should migrate v1 data to v2 on load', () => {
      const v1Data = {
        sections: [
          { id: 's1', name: 'Bakery', order: 0, createdAt: 1000 },
        ],
        items: [
          { id: 'i1', name: 'Bread', quantity: 2, isChecked: false, sectionId: 's1', createdAt: 1100 },
        ],
        filterMode: 'unchecked',
        collapsedSections: [],
        selectedSectionId: null,
        version: 1,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Data));

      const result = loadMultiListState();

      expect(result.version).toBe(2);
      expect(result.lists).toHaveLength(1);
      expect(result.lists[0].sections[0].name).toBe('Bakery');
      expect(result.lists[0].items[0].name).toBe('Bread');
      expect(result.lists[0].items[0].quantity).toBe(2);
      expect(result.filterMode).toBe('unchecked');
      expect(result.activeListId).toBe(result.lists[0].id);
    });
  });

  // --- saveMultiListState + loadMultiListState round-trip ---

  describe('saveMultiListState / loadMultiListState round-trip', () => {
    it('should preserve state across save and load', () => {
      const state = createDefaultMultiListState();
      // Add some data to make it non-trivial
      state.lists[0].name = 'Test List';
      state.lists[0].sections = [
        { id: 'sec-1', name: 'Frozen', order: 0, createdAt: 5000 },
      ];
      state.lists[0].items = [
        { id: 'item-1', name: 'Ice Cream', quantity: 1, isChecked: true, sectionId: 'sec-1', createdAt: 5100 },
      ];
      state.filterMode = 'checked';
      state.collapsedSections = new Set(['sec-1']);

      saveMultiListState(state);
      const loaded = loadMultiListState();

      expect(loaded.version).toBe(2);
      expect(loaded.activeListId).toBe(state.activeListId);
      expect(loaded.filterMode).toBe('checked');
      expect(loaded.collapsedSections).toBeInstanceOf(Set);
      expect(loaded.collapsedSections.has('sec-1')).toBe(true);
      expect(loaded.lists).toHaveLength(1);
      expect(loaded.lists[0].name).toBe('Test List');
      expect(loaded.lists[0].sections[0].name).toBe('Frozen');
      expect(loaded.lists[0].items[0].name).toBe('Ice Cream');
      expect(loaded.lists[0].items[0].isChecked).toBe(true);
    });
  });
});
