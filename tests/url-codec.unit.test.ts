/**
 * Unit tests for URL codec module
 * Feature: multi-list-sharing
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import { describe, it, expect } from 'vitest';
import { compressToEncodedURIComponent } from 'lz-string';
import { encodeListUrl, decodeListFragment } from '../src/url-codec';

describe('URL Codec Unit Tests', () => {
  // --- encodeListUrl ---

  describe('encodeListUrl', () => {
    it('produces a URL in the format <origin>/?list=<encoded>', () => {
      const json = JSON.stringify({ name: 'Groceries', sections: [] });
      const url = encodeListUrl(json, 'https://example.com');

      expect(url).toMatch(/^https:\/\/example\.com\/\?list=.+$/);
    });

    it('uses lz-string compressToEncodedURIComponent for the encoded portion', () => {
      const json = '{"name":"Test","sections":[]}';
      const url = encodeListUrl(json, 'https://app.test');

      const expected = compressToEncodedURIComponent(json);
      expect(url).toBe(`https://app.test/?list=${expected}`);
    });

    it('produces URL-safe encoded data (no #, &, or = in the data portion)', () => {
      const json = JSON.stringify({
        name: 'Big List',
        sections: [{ name: 'Produce', order: 0, items: [{ name: 'Apples', quantity: 3, isChecked: false }] }],
      });
      const url = encodeListUrl(json, 'https://example.com');
      const encoded = url.slice('https://example.com/?list='.length);

      expect(encoded).not.toContain('#');
      expect(encoded).not.toContain('&');
      expect(encoded).not.toContain('=');
    });
  });

  // --- decodeListFragment ---

  describe('decodeListFragment', () => {
    it('extracts and decompresses a valid #list= fragment', () => {
      const json = '{"name":"Weekly","sections":[]}';
      const encoded = compressToEncodedURIComponent(json);
      const hash = `#list=${encoded}`;

      const result = decodeListFragment(hash);
      expect(result).toBe(json);
    });

    it('returns null for an empty string', () => {
      expect(decodeListFragment('')).toBeNull();
    });

    it('returns null for a bare hash "#"', () => {
      expect(decodeListFragment('#')).toBeNull();
    });

    it('returns null for hash without list= parameter', () => {
      expect(decodeListFragment('#other=value')).toBeNull();
    });

    it('returns null for hash with only non-list params', () => {
      expect(decodeListFragment('#foo=bar&baz=qux')).toBeNull();
    });

    it('returns null for hash with key starting with "list" but not "list="', () => {
      expect(decodeListFragment('#listing=something')).toBeNull();
      expect(decodeListFragment('#listof=items')).toBeNull();
    });

    it('returns error object for corrupted/invalid lz-string data', () => {
      const result = decodeListFragment('#list=AAAA');

      expect(result).not.toBeNull();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Decompression failed');
    });

    it('returns error object for empty list= value', () => {
      const result = decodeListFragment('#list=');

      expect(result).not.toBeNull();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Decompression failed');
    });

    it('handles hash with list= and other params together', () => {
      const json = '{"name":"Shared","sections":[]}';
      const encoded = compressToEncodedURIComponent(json);
      const hash = `#list=${encoded}&source=friend&ref=abc`;

      const result = decodeListFragment(hash);
      expect(result).toBe(json);
    });

    it('handles hash with other params before list=', () => {
      const json = '{"name":"Mixed","sections":[]}';
      const encoded = compressToEncodedURIComponent(json);
      const hash = `#source=app&list=${encoded}`;

      const result = decodeListFragment(hash);
      expect(result).toBe(json);
    });
  });

  // --- round-trip ---

  describe('round-trip: encode then decode', () => {
    it('returns the original JSON string after encoding and decoding', () => {
      const json = JSON.stringify({
        name: 'Weekly Groceries',
        sections: [
          { name: 'Produce', order: 0, items: [{ name: 'Apples', quantity: 3, isChecked: false }] },
          { name: 'Dairy', order: 1, items: [{ name: 'Milk', quantity: 1, isChecked: true }] },
        ],
      });

      const url = encodeListUrl(json, 'https://grocery.app');
      const query = url.slice(url.indexOf('?'));
      const decoded = decodeListFragment(query);

      expect(decoded).toBe(json);
    });

    it('round-trips a minimal empty list', () => {
      const json = JSON.stringify({ name: 'Empty', sections: [] });

      const url = encodeListUrl(json, 'https://example.com');
      const query = url.slice(url.indexOf('?'));
      const decoded = decodeListFragment(query);

      expect(decoded).toBe(json);
    });

    it('round-trips JSON with special characters (emoji, unicode)', () => {
      const json = JSON.stringify({
        name: '🛒 Épicerie spéciale',
        sections: [{ name: '日本語', order: 0, items: [{ name: 'Ñoquis', quantity: 2, isChecked: false }] }],
      });

      const url = encodeListUrl(json, 'https://example.com');
      const query = url.slice(url.indexOf('?'));
      const decoded = decodeListFragment(query);

      expect(decoded).toBe(json);
    });
  });
});
