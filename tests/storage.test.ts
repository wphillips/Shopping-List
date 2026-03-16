/**
 * Unit tests for storage module
 * Tests save/load functionality, validation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  saveState,
  loadState,
  clearState,
  createDefaultState,
  StorageUnavailableError,
  StorageQuotaExceededError,
} from '../src/storage';
import { AppState, FilterMode } from '../src/types';

describe('Storage Module', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe('createDefaultState', () => {
    it('should create a valid default state', () => {
      const state = createDefaultState();

      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
      expect(state.filterMode).toBe('all');
      expect(state.collapsedSections).toBeInstanceOf(Set);
      expect(state.collapsedSections.size).toBe(0);
      expect(state.selectedSectionId).toBeNull();
      expect(state.version).toBe(1);
    });
  });

  describe('saveState', () => {
    it('should save state to localStorage', () => {
      const state = createDefaultState();
      state.sections = [
        { id: 'section-1', name: 'Produce', order: 0, createdAt: Date.now() },
      ];

      saveState(state);

      const stored = localStorage.getItem('grocery-list-state');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.sections).toHaveLength(1);
      expect(parsed.sections[0].name).toBe('Produce');
    });

    it('should serialize collapsedSections Set to array', () => {
      const state = createDefaultState();
      state.collapsedSections.add('section-1');
      state.collapsedSections.add('section-2');

      saveState(state);

      const stored = localStorage.getItem('grocery-list-state');
      const parsed = JSON.parse(stored!);

      expect(Array.isArray(parsed.collapsedSections)).toBe(true);
      expect(parsed.collapsedSections).toContain('section-1');
      expect(parsed.collapsedSections).toContain('section-2');
    });
  });

  describe('loadState', () => {
    it('should return default state when localStorage is empty', () => {
      const state = loadState();

      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
      expect(state.filterMode).toBe('all');
      expect(state.collapsedSections).toBeInstanceOf(Set);
      expect(state.selectedSectionId).toBeNull();
    });

    it('should load saved state from localStorage', () => {
      const originalState = createDefaultState();
      originalState.sections = [
        { id: 'section-1', name: 'Dairy', order: 0, createdAt: 1234567890 },
      ];
      originalState.items = [
        {
          id: 'item-1',
          name: 'Milk',
          quantity: 2,
          isChecked: false,
          sectionId: 'section-1',
          createdAt: 1234567891,
        },
      ];
      originalState.filterMode = 'unchecked';
      originalState.collapsedSections.add('section-1');
      originalState.selectedSectionId = 'section-1';

      saveState(originalState);
      const loadedState = loadState();

      expect(loadedState.sections).toHaveLength(1);
      expect(loadedState.sections[0].name).toBe('Dairy');
      expect(loadedState.items).toHaveLength(1);
      expect(loadedState.items[0].name).toBe('Milk');
      expect(loadedState.items[0].quantity).toBe(2);
      expect(loadedState.filterMode).toBe('unchecked');
      expect(loadedState.collapsedSections).toBeInstanceOf(Set);
      expect(loadedState.collapsedSections.has('section-1')).toBe(true);
      expect(loadedState.selectedSectionId).toBe('section-1');
    });

    it('should deserialize collapsedSections array to Set', () => {
      const state = createDefaultState();
      state.collapsedSections.add('section-1');
      state.collapsedSections.add('section-2');

      saveState(state);
      const loadedState = loadState();

      expect(loadedState.collapsedSections).toBeInstanceOf(Set);
      expect(loadedState.collapsedSections.has('section-1')).toBe(true);
      expect(loadedState.collapsedSections.has('section-2')).toBe(true);
    });

    it('should return default state when stored state is invalid', () => {
      // Store invalid JSON - but valid enough to not throw on parse
      localStorage.setItem('grocery-list-state', '{"version": "not a number"}');

      const state = loadState();

      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
    });

    it('should return default state when state validation fails', () => {
      // Store state with invalid structure
      const invalidState = {
        version: 1,
        sections: 'not an array', // Invalid
        items: [],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
    });

    it('should return default state when section is invalid', () => {
      const invalidState = {
        version: 1,
        sections: [{ id: 'section-1', name: 'Test' }], // Missing required fields
        items: [],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.sections).toEqual([]);
    });

    it('should return default state when item is invalid', () => {
      const invalidState = {
        version: 1,
        sections: [],
        items: [{ id: 'item-1', name: 'Test' }], // Missing required fields
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.items).toEqual([]);
    });

    it('should return default state when filterMode is invalid', () => {
      const invalidState = {
        version: 1,
        sections: [],
        items: [],
        filterMode: 'invalid', // Invalid filter mode
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.filterMode).toBe('all');
    });
  });

  describe('clearState', () => {
    it('should remove state from localStorage', () => {
      const state = createDefaultState();
      saveState(state);

      expect(localStorage.getItem('grocery-list-state')).not.toBeNull();

      clearState();

      expect(localStorage.getItem('grocery-list-state')).toBeNull();
    });
  });

  describe('localStorage unavailable handling', () => {
    it('should throw StorageUnavailableError when localStorage is not available', () => {
      const state = createDefaultState();
      
      // Mock localStorage to throw an error
      const originalSetItem = Storage.prototype.setItem;
      const originalRemoveItem = Storage.prototype.removeItem;
      
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('localStorage is disabled');
      });
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('localStorage is disabled');
      });

      expect(() => saveState(state)).toThrow(StorageUnavailableError);

      // Restore original
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    });
  });

  describe('storage quota exceeded handling', () => {
    it('should throw StorageQuotaExceededError when quota is exceeded', () => {
      const state = createDefaultState();
      
      // Mock localStorage.setItem to throw QuotaExceededError after availability check
      const originalSetItem = Storage.prototype.setItem;
      let callCount = 0;
      Storage.prototype.setItem = vi.fn((_key: string, _value: string) => {
        callCount++;
        // First call is the availability check, let it succeed
        if (callCount === 1) {
          return;
        }
        // Second call is the actual save, throw quota error
        const error: any = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      expect(() => saveState(state)).toThrow(StorageQuotaExceededError);

      // Restore original
      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('persistence round trip', () => {
    it('should maintain state integrity through save and load cycle', () => {
      const originalState = createDefaultState();
      originalState.sections = [
        { id: 's1', name: 'Produce', order: 0, createdAt: 1000 },
        { id: 's2', name: 'Dairy', order: 1, createdAt: 2000 },
      ];
      originalState.items = [
        {
          id: 'i1',
          name: 'Apples',
          quantity: 3,
          isChecked: false,
          sectionId: 's1',
          createdAt: 3000,
        },
        {
          id: 'i2',
          name: 'Milk',
          quantity: 1,
          isChecked: true,
          sectionId: 's2',
          createdAt: 4000,
        },
      ];
      originalState.filterMode = 'checked';
      originalState.collapsedSections.add('s1');
      originalState.selectedSectionId = 's2';

      saveState(originalState);
      const loadedState = loadState();

      // Verify all fields match
      expect(loadedState.sections).toEqual(originalState.sections);
      expect(loadedState.items).toEqual(originalState.items);
      expect(loadedState.filterMode).toBe(originalState.filterMode);
      expect(loadedState.collapsedSections).toEqual(originalState.collapsedSections);
      expect(loadedState.selectedSectionId).toBe(originalState.selectedSectionId);
      expect(loadedState.version).toBe(originalState.version);
    });
  });

  describe('edge cases', () => {
    it('should handle empty localStorage initialization', () => {
      // Ensure localStorage is empty
      localStorage.clear();
      
      const state = loadState();
      
      // Should return default state
      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
      expect(state.filterMode).toBe('all');
      expect(state.collapsedSections.size).toBe(0);
      expect(state.selectedSectionId).toBeNull();
      expect(state.version).toBe(1);
    });

    it('should handle malformed JSON in localStorage', () => {
      // Store invalid JSON
      localStorage.setItem('grocery-list-state', '{invalid json}');
      
      // Should throw but be caught and return default state
      expect(() => loadState()).toThrow();
    });

    it('should handle null values in state fields', () => {
      const invalidState = {
        version: 1,
        sections: null, // Invalid
        items: null, // Invalid
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
    });

    it('should handle missing collapsedSections field', () => {
      const invalidState = {
        version: 1,
        sections: [],
        items: [],
        filterMode: 'all',
        // collapsedSections missing
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.collapsedSections).toBeInstanceOf(Set);
      expect(state.collapsedSections.size).toBe(0);
    });

    it('should handle invalid selectedSectionId type', () => {
      const invalidState = {
        version: 1,
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: 123, // Should be string or null
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.selectedSectionId).toBeNull();
    });

    it('should handle item with quantity less than 1', () => {
      const invalidState = {
        version: 1,
        sections: [{ id: 's1', name: 'Test', order: 0, createdAt: 1000 }],
        items: [
          {
            id: 'i1',
            name: 'Test Item',
            quantity: 0, // Invalid - must be >= 1
            isChecked: false,
            sectionId: 's1',
            createdAt: 2000,
          },
        ],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      // Should reject the invalid item
      expect(state.items).toEqual([]);
    });

    it('should handle item with negative quantity', () => {
      const invalidState = {
        version: 1,
        sections: [{ id: 's1', name: 'Test', order: 0, createdAt: 1000 }],
        items: [
          {
            id: 'i1',
            name: 'Test Item',
            quantity: -5, // Invalid
            isChecked: false,
            sectionId: 's1',
            createdAt: 2000,
          },
        ],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.items).toEqual([]);
    });

    it('should handle collapsedSections as non-array', () => {
      const invalidState = {
        version: 1,
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: 'not-an-array', // Invalid
        selectedSectionId: null,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(invalidState));

      const state = loadState();

      expect(state.collapsedSections).toBeInstanceOf(Set);
      expect(state.collapsedSections.size).toBe(0);
    });

    it('should handle state with extra unknown fields', () => {
      const stateWithExtra = {
        version: 1,
        sections: [],
        items: [],
        filterMode: 'all',
        collapsedSections: [],
        selectedSectionId: null,
        unknownField: 'should be ignored',
        anotherField: 123,
      };

      localStorage.setItem('grocery-list-state', JSON.stringify(stateWithExtra));

      const state = loadState();

      // Should load successfully, ignoring extra fields
      expect(state.sections).toEqual([]);
      expect(state.items).toEqual([]);
      expect(state.filterMode).toBe('all');
    });

    it('should handle localStorage unavailable on load', () => {
      const originalSetItem = Storage.prototype.setItem;
      const originalRemoveItem = Storage.prototype.removeItem;
      
      // Mock the availability check to fail
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('localStorage is disabled');
      });
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('localStorage is disabled');
      });

      expect(() => loadState()).toThrow(StorageUnavailableError);

      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    });

    it('should handle localStorage unavailable on clear', () => {
      const originalRemoveItem = Storage.prototype.removeItem;
      
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('localStorage is disabled');
      });

      expect(() => clearState()).toThrow(StorageUnavailableError);

      Storage.prototype.removeItem = originalRemoveItem;
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 21: State persistence round trip
     * **Validates: Requirements 3.10, 5.8, 6.5, 7.6, 9.1, 9.2, 9.3, 9.4, 9.5**
     * 
     * For any application state (sections, items, filterMode, collapsedSections),
     * serializing to localStorage and then deserializing should produce an equivalent state.
     */
    it('property: state persistence round trip preserves all data', () => {
      // Arbitrary for generating valid Section objects
      const sectionArbitrary = fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        order: fc.nat({ max: 1000 }),
        createdAt: fc.integer({ min: 0, max: Date.now() }),
      });

      // Arbitrary for generating valid Item objects
      const itemArbitrary = (sectionIds: string[]) => {
        if (sectionIds.length === 0) {
          // If no sections, generate items with arbitrary section IDs
          return fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            quantity: fc.integer({ min: 1, max: 100 }),
            isChecked: fc.boolean(),
            sectionId: fc.uuid(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
          });
        }
        // Generate items that reference existing sections
        return fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          quantity: fc.integer({ min: 1, max: 100 }),
          isChecked: fc.boolean(),
          sectionId: fc.constantFrom(...sectionIds),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
        });
      };

      // Arbitrary for generating FilterMode
      const filterModeArbitrary: fc.Arbitrary<FilterMode> = fc.constantFrom('all', 'checked', 'unchecked');

      // Arbitrary for generating complete AppState
      const appStateArbitrary = fc
        .array(sectionArbitrary, { minLength: 0, maxLength: 20 })
        .chain((sections) => {
          const sectionIds = sections.map((s) => s.id);
          return fc.record({
            sections: fc.constant(sections),
            items: fc.array(itemArbitrary(sectionIds), { minLength: 0, maxLength: 50 }),
            filterMode: filterModeArbitrary,
            collapsedSections: fc.array(fc.constantFrom(...(sectionIds.length > 0 ? sectionIds : ['dummy'])), { maxLength: sectionIds.length }),
            selectedSectionId: sectionIds.length > 0 
              ? fc.option(fc.constantFrom(...sectionIds), { nil: null })
              : fc.constant(null),
            version: fc.constant(1),
          });
        })
        .map((state) => ({
          ...state,
          collapsedSections: new Set(state.collapsedSections),
        })) as fc.Arbitrary<AppState>;

      fc.assert(
        fc.property(appStateArbitrary, (originalState) => {
          // Clear localStorage before each test
          localStorage.clear();

          // Save the state
          saveState(originalState);

          // Load the state back
          const loadedState = loadState();

          // Verify all fields match
          expect(loadedState.sections).toEqual(originalState.sections);
          expect(loadedState.items).toEqual(originalState.items);
          expect(loadedState.filterMode).toBe(originalState.filterMode);
          expect(loadedState.collapsedSections).toEqual(originalState.collapsedSections);
          expect(loadedState.selectedSectionId).toBe(originalState.selectedSectionId);
          expect(loadedState.version).toBe(originalState.version);
        }),
        { numRuns: 100 }
      );
    });
  });
});
