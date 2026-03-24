import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../src/audit/utils';
import {
  checkManifestFields,
  checkServiceWorkerCacheVersioning,
  checkServiceWorkerPrecache,
  checkServiceWorkerOfflineFallback,
} from '../src/audit/pwa-reviewer';

beforeEach(() => {
  resetCounters();
});

describe('checkManifestFields', () => {
  it('should pass when all required fields are present', () => {
    const manifest = JSON.stringify({
      name: 'Grocery List',
      short_name: 'Groceries',
      start_url: '/',
      display: 'standalone',
      icons: [{ src: '/icon.png', sizes: '192x192' }],
      theme_color: '#2d2d2d',
      background_color: '#1a1a1a',
    });
    const findings = checkManifestFields(manifest);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('all required fields');
  });

  it('should flag missing fields', () => {
    const manifest = JSON.stringify({
      name: 'Grocery List',
      start_url: '/',
    });
    const findings = checkManifestFields(manifest);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('short_name');
    expect(findings[0].title).toContain('display');
    expect(findings[0].title).toContain('icons');
    expect(findings[0].title).toContain('theme_color');
    expect(findings[0].title).toContain('background_color');
  });

  it('should flag invalid JSON', () => {
    const findings = checkManifestFields('not valid json {{{');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('not valid JSON');
  });

  it('should flag a single missing field', () => {
    const manifest = JSON.stringify({
      name: 'App',
      short_name: 'A',
      start_url: '/',
      display: 'standalone',
      icons: [],
      background_color: '#fff',
      // theme_color missing
    });
    const findings = checkManifestFields(manifest);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('theme_color');
  });
});

describe('checkServiceWorkerCacheVersioning', () => {
  it('should pass when cache name is versioned and activate cleans up', () => {
    const sw = `
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((names) =>
            Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
          )
        );
      });
    `;
    const findings = checkServiceWorkerCacheVersioning(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('versioned cache');
  });

  it('should flag non-versioned cache name', () => {
    const sw = `
      const CACHE_NAME = 'my-cache';
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((names) =>
            Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
          )
        );
      });
    `;
    const findings = checkServiceWorkerCacheVersioning(sw);
    const versionFinding = findings.find(f => f.title.includes('not versioned'));
    expect(versionFinding).toBeDefined();
    expect(versionFinding!.severity).toBe('High');
  });

  it('should flag missing old cache cleanup', () => {
    const sw = `
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      self.addEventListener('activate', (event) => {
        console.log('activated');
      });
    `;
    const findings = checkServiceWorkerCacheVersioning(sw);
    const cleanupFinding = findings.find(f => f.title.includes('does not clean up'));
    expect(cleanupFinding).toBeDefined();
    expect(cleanupFinding!.severity).toBe('High');
  });
});

describe('checkServiceWorkerPrecache', () => {
  it('should pass when __PRECACHE_ASSETS__ is used with install handler', () => {
    const sw = `
      const BUILT_ASSETS = __PRECACHE_ASSETS__;
      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.addAll(BUILT_ASSETS))
        );
      });
    `;
    const findings = checkServiceWorkerPrecache(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('pre-caches critical assets');
  });

  it('should flag missing precache assets reference', () => {
    const sw = `
      const ASSETS = ['/', '/index.html'];
      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open('cache').then((cache) => cache.addAll(ASSETS))
        );
      });
    `;
    const findings = checkServiceWorkerPrecache(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('does not use build-injected');
  });

  it('should flag precache assets present but no install handler', () => {
    const sw = `const BUILT_ASSETS = __PRECACHE_ASSETS__;`;
    const findings = checkServiceWorkerPrecache(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('may not cache them');
  });
});

describe('checkServiceWorkerOfflineFallback', () => {
  it('should pass when fetch handler checks navigate and serves fallback', () => {
    const sw = `
      self.addEventListener('fetch', (event) => {
        event.respondWith(
          caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => {
              if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
              }
            });
          })
        );
      });
    `;
    const findings = checkServiceWorkerOfflineFallback(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('provides offline fallback');
  });

  it('should flag missing fetch handler', () => {
    const sw = `// no fetch handler`;
    const findings = checkServiceWorkerOfflineFallback(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('no fetch event handler');
  });

  it('should flag fetch handler without navigation check', () => {
    const sw = `
      self.addEventListener('fetch', (event) => {
        event.respondWith(caches.match(event.request));
      });
    `;
    const findings = checkServiceWorkerOfflineFallback(sw);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('may not provide offline fallback');
  });
});
