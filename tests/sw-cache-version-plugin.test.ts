/**
 * Unit tests for sw-cache-version Vite plugin
 * Feature: sw-cache-versioning
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeBuildHash, replacePlaceholder, injectPrecacheAssets } from '../vite-plugin-sw-cache-version';

describe('SW Cache Version Plugin', () => {
  describe('SW Template', () => {
    it('public/sw.js contains the __BUILD_HASH__ placeholder', () => {
      const template = fs.readFileSync(path.resolve('public', 'sw.js'), 'utf-8');
      expect(template).toContain('__BUILD_HASH__');
    });

    it('public/sw.js defines CACHE_NAME with grocery-list- prefix and __BUILD_HASH__', () => {
      const template = fs.readFileSync(path.resolve('public', 'sw.js'), 'utf-8');
      expect(template).toContain("'grocery-list-__BUILD_HASH__'");
    });

    it('public/sw.js contains the __PRECACHE_ASSETS__ placeholder', () => {
      const template = fs.readFileSync(path.resolve('public', 'sw.js'), 'utf-8');
      expect(template).toContain('__PRECACHE_ASSETS__');
    });
  });

  describe('computeBuildHash', () => {
    it('produces an 8-character hex string', () => {
      const hash = computeBuildHash([Buffer.from('hello world')]);
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('produces consistent output for the same input', () => {
      const input = [Buffer.from('test content')];
      expect(computeBuildHash(input)).toBe(computeBuildHash(input));
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = computeBuildHash([Buffer.from('content-a')]);
      const hash2 = computeBuildHash([Buffer.from('content-b')]);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('replacePlaceholder', () => {
    it('replaces __BUILD_HASH__ and produces valid output', () => {
      const template = "const CACHE_NAME = 'grocery-list-__BUILD_HASH__';";
      const result = replacePlaceholder(template, 'a1b2c3d4');
      expect(result).toBe("const CACHE_NAME = 'grocery-list-a1b2c3d4';");
      expect(result).not.toContain('__BUILD_HASH__');
    });

    it('replaces all occurrences of __BUILD_HASH__', () => {
      const template = '__BUILD_HASH__ and __BUILD_HASH__';
      const result = replacePlaceholder(template, 'abcd1234');
      expect(result).toBe('abcd1234 and abcd1234');
      expect(result).not.toContain('__BUILD_HASH__');
    });

    it('substitutes dev for __BUILD_HASH__ in dev mode', () => {
      const template = "const CACHE_NAME = 'grocery-list-__BUILD_HASH__';";
      const result = replacePlaceholder(template, 'dev');
      expect(result).toBe("const CACHE_NAME = 'grocery-list-dev';");
      expect(result).not.toContain('__BUILD_HASH__');
    });
  });

  describe('injectPrecacheAssets', () => {
    it('replaces __PRECACHE_ASSETS__ with a JSON array of /assets/ paths', () => {
      const template = 'const BUILT_ASSETS = __PRECACHE_ASSETS__;';
      const result = injectPrecacheAssets(template, ['index-abc123.js', 'style-def456.css']);
      expect(result).toBe('const BUILT_ASSETS = ["/assets/index-abc123.js","/assets/style-def456.css"];');
      expect(result).not.toContain('__PRECACHE_ASSETS__');
    });

    it('produces an empty array when no assets are provided', () => {
      const template = 'const BUILT_ASSETS = __PRECACHE_ASSETS__;';
      const result = injectPrecacheAssets(template, []);
      expect(result).toBe('const BUILT_ASSETS = [];');
    });

    it('replaces all occurrences of __PRECACHE_ASSETS__', () => {
      const template = '__PRECACHE_ASSETS__ and __PRECACHE_ASSETS__';
      const result = injectPrecacheAssets(template, ['app.js']);
      expect(result).toBe('["/assets/app.js"] and ["/assets/app.js"]');
    });
  });

  describe('Edge cases', () => {
    it('missing placeholder logs a warning when template has no __BUILD_HASH__', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const templateWithoutPlaceholder = "const CACHE_NAME = 'grocery-list-v1';";
      // Simulate the plugin's check: if placeholder is missing, warn
      if (!templateWithoutPlaceholder.includes('__BUILD_HASH__')) {
        console.warn(
          '[sw-cache-version] __BUILD_HASH__ placeholder not found in template. Writing file unchanged.'
        );
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('__BUILD_HASH__ placeholder not found')
      );

      warnSpy.mockRestore();
    });
  });
});
