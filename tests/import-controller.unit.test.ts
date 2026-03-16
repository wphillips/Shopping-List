/**
 * Unit tests for import controller module
 * Feature: multi-list-sharing
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect, vi } from 'vitest';
import { checkImportUrl, ImportDeps } from '../src/import-controller';
import { encodeListUrl } from '../src/url-codec';
import { serialize } from '../src/serializer';
import type { GroceryList } from '../src/types';

/** Helper: build a simple GroceryList for test data */
function makeList(overrides?: Partial<GroceryList>): GroceryList {
  const sectionId = 'sec-1';
  return {
    id: 'list-1',
    name: 'Weekly Groceries',
    sections: [{ id: sectionId, name: 'Produce', order: 0, createdAt: 1000 }],
    items: [
      { id: 'item-1', name: 'Apples', quantity: 3, isChecked: false, sectionId, createdAt: 1000 },
    ],
    createdAt: 1000,
    ...overrides,
  };
}

/** Helper: encode a GroceryList into a query string */
function queryForList(list: GroceryList): string {
  const json = serialize(list);
  const url = encodeListUrl(json, 'https://app.test');
  return url.slice(url.indexOf('?'));
}

describe('Import Controller Unit Tests', () => {
  // --- status: 'none' when no #list= fragment ---

  describe('no list fragment', () => {
    it('returns { status: "none" } when hash is empty', () => {
      const deps: ImportDeps = {
        getHash: vi.fn(() => ''),
        replaceState: vi.fn(),
      };
      expect(checkImportUrl(deps)).toEqual({ status: 'none' });
    });

    it('returns { status: "none" } for bare "#"', () => {
      const deps: ImportDeps = {
        getHash: vi.fn(() => '#'),
        replaceState: vi.fn(),
      };
      expect(checkImportUrl(deps)).toEqual({ status: 'none' });
    });

    it('returns { status: "none" } when hash has other params but no list=', () => {
      const deps: ImportDeps = {
        getHash: vi.fn(() => '#foo=bar&baz=qux'),
        replaceState: vi.fn(),
      };
      expect(checkImportUrl(deps)).toEqual({ status: 'none' });
    });
  });

  // --- status: 'decoded' for a valid encoded list ---

  describe('valid encoded list', () => {
    it('returns { status: "decoded", list } for a valid ?list= query string', () => {
      const original = makeList();
      const query = queryForList(original);

      const deps: ImportDeps = {
        getHash: vi.fn(() => query),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);

      expect(result.status).toBe('decoded');
      if (result.status !== 'decoded') return;

      expect(result.list.name).toBe('Weekly Groceries');
      expect(result.list.sections).toHaveLength(1);
      expect(result.list.sections[0].name).toBe('Produce');
      expect(result.list.items).toHaveLength(1);
      expect(result.list.items[0].name).toBe('Apples');
      expect(result.list.items[0].quantity).toBe(3);
      expect(result.list.items[0].isChecked).toBe(false);
    });
  });

  // --- status: 'error' for corrupted data ---

  describe('corrupted data', () => {
    it('returns { status: "error", message } for corrupted lz-string data', () => {
      const deps: ImportDeps = {
        getHash: vi.fn(() => '#list=AAAA'),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);

      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('returns { status: "error", message } for empty list= value', () => {
      const deps: ImportDeps = {
        getHash: vi.fn(() => '#list='),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);
      expect(result.status).toBe('error');
    });
  });

  // --- status: 'error' for invalid serialized JSON (valid lz-string but bad JSON structure) ---

  describe('invalid serialized JSON', () => {
    it('returns { status: "error", message } when decompressed data is valid JSON but not a valid SerializedList', () => {
      // Encode a JSON object that is NOT a valid SerializedList (missing sections)
      const badJson = JSON.stringify({ name: 'Bad', notSections: [] });
      const url = encodeListUrl(badJson, 'https://app.test');
      const query = url.slice(url.indexOf('?'));

      const deps: ImportDeps = {
        getHash: vi.fn(() => query),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);

      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(typeof result.message).toBe('string');
    });

    it('returns { status: "error", message } when decompressed data is a plain string, not JSON', () => {
      const url = encodeListUrl('not json at all', 'https://app.test');
      const query = url.slice(url.indexOf('?'));

      const deps: ImportDeps = {
        getHash: vi.fn(() => query),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);

      expect(result.status).toBe('error');
      if (result.status !== 'error') return;
      expect(result.message).toContain('Invalid JSON');
    });
  });

  // --- empty hash returns 'none' ---

  describe('empty hash edge case', () => {
    it('returns { status: "none" } for empty string hash', () => {
      const deps: ImportDeps = {
        getHash: vi.fn(() => ''),
        replaceState: vi.fn(),
      };
      expect(checkImportUrl(deps)).toEqual({ status: 'none' });
    });
  });

  // --- decoded list has fresh UUIDs ---

  describe('fresh UUIDs on import', () => {
    it('decoded list has IDs different from the original list', () => {
      const original = makeList();
      const query = queryForList(original);

      const deps: ImportDeps = {
        getHash: vi.fn(() => query),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);
      expect(result.status).toBe('decoded');
      if (result.status !== 'decoded') return;

      // List ID must differ
      expect(result.list.id).not.toBe(original.id);

      // Section IDs must differ
      for (const section of result.list.sections) {
        const originalIds = original.sections.map((s) => s.id);
        expect(originalIds).not.toContain(section.id);
      }

      // Item IDs must differ
      for (const item of result.list.items) {
        const originalIds = original.items.map((i) => i.id);
        expect(originalIds).not.toContain(item.id);
      }
    });

    it('all IDs in the decoded list are unique', () => {
      const original = makeList({
        sections: [
          { id: 's1', name: 'Produce', order: 0, createdAt: 1000 },
          { id: 's2', name: 'Dairy', order: 1, createdAt: 1000 },
        ],
        items: [
          { id: 'i1', name: 'Apples', quantity: 3, isChecked: false, sectionId: 's1', createdAt: 1000 },
          { id: 'i2', name: 'Milk', quantity: 1, isChecked: true, sectionId: 's2', createdAt: 1000 },
        ],
      });
      const query = queryForList(original);

      const deps: ImportDeps = {
        getHash: vi.fn(() => query),
        replaceState: vi.fn(),
      };

      const result = checkImportUrl(deps);
      expect(result.status).toBe('decoded');
      if (result.status !== 'decoded') return;

      const allIds = [
        result.list.id,
        ...result.list.sections.map((s) => s.id),
        ...result.list.items.map((i) => i.id),
      ];

      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });
});
