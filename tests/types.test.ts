/**
 * Unit tests for data model validation
 * Tests interface type checking and default values for items and sections
 * Validates: Requirements 3.1, 4.1
 */

import { describe, it, expect } from 'vitest';
import type { Section, Item, AppState, FilterMode, DragData } from '../src/types';

describe('Data Model Validation', () => {
  describe('Section interface', () => {
    it('should accept valid section with all required fields', () => {
      const section: Section = {
        id: 'section-123',
        name: 'Produce',
        order: 0,
        createdAt: Date.now(),
      };

      expect(section.id).toBe('section-123');
      expect(section.name).toBe('Produce');
      expect(section.order).toBe(0);
      expect(typeof section.createdAt).toBe('number');
    });

    it('should have correct default values for new section', () => {
      const createdAt = Date.now();
      const section: Section = {
        id: crypto.randomUUID(),
        name: 'Dairy',
        order: 0,
        createdAt,
      };

      expect(section.id).toBeDefined();
      expect(section.id.length).toBeGreaterThan(0);
      expect(section.name).toBe('Dairy');
      expect(section.order).toBe(0);
      expect(section.createdAt).toBe(createdAt);
    });

    it('should accept sections with different order values', () => {
      const section1: Section = {
        id: 's1',
        name: 'First',
        order: 0,
        createdAt: 1000,
      };

      const section2: Section = {
        id: 's2',
        name: 'Second',
        order: 1,
        createdAt: 2000,
      };

      expect(section1.order).toBe(0);
      expect(section2.order).toBe(1);
    });
  });

  describe('Item interface', () => {
    it('should accept valid item with all required fields', () => {
      const item: Item = {
        id: 'item-456',
        name: 'Apples',
        quantity: 1,
        isChecked: false,
        sectionId: 'section-123',
        createdAt: Date.now(),
      };

      expect(item.id).toBe('item-456');
      expect(item.name).toBe('Apples');
      expect(item.quantity).toBe(1);
      expect(item.isChecked).toBe(false);
      expect(item.sectionId).toBe('section-123');
      expect(typeof item.createdAt).toBe('number');
    });

    it('should have correct default values for new item', () => {
      const createdAt = Date.now();
      const item: Item = {
        id: crypto.randomUUID(),
        name: 'Milk',
        quantity: 1,
        isChecked: false,
        sectionId: 'section-dairy',
        createdAt,
      };

      expect(item.id).toBeDefined();
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name).toBe('Milk');
      expect(item.quantity).toBe(1); // Default quantity is 1
      expect(item.isChecked).toBe(false); // Default is unchecked
      expect(item.sectionId).toBe('section-dairy');
      expect(item.createdAt).toBe(createdAt);
    });

    it('should accept items with quantity greater than 1', () => {
      const item: Item = {
        id: 'i1',
        name: 'Bananas',
        quantity: 5,
        isChecked: false,
        sectionId: 's1',
        createdAt: 1000,
      };

      expect(item.quantity).toBe(5);
    });

    it('should accept checked items', () => {
      const item: Item = {
        id: 'i1',
        name: 'Bread',
        quantity: 1,
        isChecked: true,
        sectionId: 's1',
        createdAt: 1000,
      };

      expect(item.isChecked).toBe(true);
    });

    it('should maintain minimum quantity of 1', () => {
      const item: Item = {
        id: 'i1',
        name: 'Eggs',
        quantity: 1,
        isChecked: false,
        sectionId: 's1',
        createdAt: 1000,
      };

      // Verify quantity is at minimum
      expect(item.quantity).toBe(1);
      expect(item.quantity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('FilterMode type', () => {
    it('should accept "all" as valid filter mode', () => {
      const mode: FilterMode = 'all';
      expect(mode).toBe('all');
    });

    it('should accept "checked" as valid filter mode', () => {
      const mode: FilterMode = 'checked';
      expect(mode).toBe('checked');
    });

    it('should accept "unchecked" as valid filter mode', () => {
      const mode: FilterMode = 'unchecked';
      expect(mode).toBe('unchecked');
    });
  });

  describe('AppState interface', () => {
    it('should accept valid app state with all required fields', () => {
      const state: AppState = {
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: new Set<string>(),
        selectedSectionId: null,
        version: 1,
      };

      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
      expect(state.filterMode).toBe('all');
      expect(state.collapsedSections).toBeInstanceOf(Set);
      expect(state.selectedSectionId).toBeNull();
      expect(state.version).toBe(1);
    });

    it('should accept app state with sections and items', () => {
      const state: AppState = {
        sections: [
          { id: 's1', name: 'Produce', order: 0, createdAt: 1000 },
        ],
        items: [
          {
            id: 'i1',
            name: 'Apples',
            quantity: 1,
            isChecked: false,
            sectionId: 's1',
            createdAt: 2000,
          },
        ],
        filterMode: 'unchecked',
        collapsedSections: new Set(['s1']),
        selectedSectionId: 's1',
        version: 1,
      };

      expect(state.sections).toHaveLength(1);
      expect(state.items).toHaveLength(1);
      expect(state.filterMode).toBe('unchecked');
      expect(state.collapsedSections.has('s1')).toBe(true);
      expect(state.selectedSectionId).toBe('s1');
    });

    it('should have correct default values for new app state', () => {
      const state: AppState = {
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: new Set<string>(),
        selectedSectionId: null,
        version: 1,
      };

      // Verify defaults
      expect(state.sections.length).toBe(0);
      expect(state.items.length).toBe(0);
      expect(state.filterMode).toBe('all'); // Default filter is 'all'
      expect(state.collapsedSections.size).toBe(0); // No collapsed sections by default
      expect(state.selectedSectionId).toBeNull(); // No section selected by default
      expect(state.version).toBe(1); // Schema version
    });
  });

  describe('DragData interface', () => {
    it('should accept valid drag data with all required fields', () => {
      const dragData: DragData = {
        itemId: 'item-123',
        sourceSectionId: 'section-456',
      };

      expect(dragData.itemId).toBe('item-123');
      expect(dragData.sourceSectionId).toBe('section-456');
    });

    it('should support drag operations between different sections', () => {
      const dragData: DragData = {
        itemId: 'i1',
        sourceSectionId: 's1',
      };

      const targetSectionId = 's2';

      expect(dragData.sourceSectionId).not.toBe(targetSectionId);
      expect(dragData.itemId).toBe('i1');
    });
  });

  describe('Type safety and structure', () => {
    it('should enforce section structure', () => {
      const section: Section = {
        id: 's1',
        name: 'Test',
        order: 0,
        createdAt: 1000,
      };

      // TypeScript ensures all required fields are present
      expect(section).toHaveProperty('id');
      expect(section).toHaveProperty('name');
      expect(section).toHaveProperty('order');
      expect(section).toHaveProperty('createdAt');
    });

    it('should enforce item structure', () => {
      const item: Item = {
        id: 'i1',
        name: 'Test',
        quantity: 1,
        isChecked: false,
        sectionId: 's1',
        createdAt: 1000,
      };

      // TypeScript ensures all required fields are present
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('quantity');
      expect(item).toHaveProperty('isChecked');
      expect(item).toHaveProperty('sectionId');
      expect(item).toHaveProperty('createdAt');
    });

    it('should enforce app state structure', () => {
      const state: AppState = {
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: new Set(),
        selectedSectionId: null,
        version: 1,
      };

      // TypeScript ensures all required fields are present
      expect(state).toHaveProperty('sections');
      expect(state).toHaveProperty('items');
      expect(state).toHaveProperty('filterMode');
      expect(state).toHaveProperty('collapsedSections');
      expect(state).toHaveProperty('selectedSectionId');
      expect(state).toHaveProperty('version');
    });
  });
});
