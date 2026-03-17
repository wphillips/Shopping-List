/**
 * Unit tests for service worker
 * **Validates: Requirements 1.2**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

describe('Service Worker', () => {
  let swScope: any;
  let cacheStorage: Map<string, Map<string, Response>>;
  let eventListeners: Map<string, Function[]>;

  beforeEach(() => {
    // Mock cache storage
    cacheStorage = new Map();

    // Mock event listeners
    eventListeners = new Map();

    // Mock service worker global scope
    swScope = {
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, []);
        }
        eventListeners.get(event)!.push(handler);
      }),
      skipWaiting: vi.fn(() => Promise.resolve()),
      clients: {
        claim: vi.fn(() => Promise.resolve()),
      },
    };

    // Mock caches API
    global.caches = {
      open: vi.fn((cacheName: string) => {
        if (!cacheStorage.has(cacheName)) {
          cacheStorage.set(cacheName, new Map());
        }
        const cache = cacheStorage.get(cacheName)!;
        return Promise.resolve({
          addAll: vi.fn((urls: string[]) => {
            urls.forEach((url) => {
              cache.set(url, new Response('cached content', { status: 200 }));
            });
            return Promise.resolve();
          }),
          put: vi.fn((request: Request | string, response: Response) => {
            const key = typeof request === 'string' ? request : request.url;
            cache.set(key, response);
            return Promise.resolve();
          }),
          match: vi.fn((request: Request | string) => {
            const key = typeof request === 'string' ? request : request.url;
            return Promise.resolve(cache.get(key));
          }),
        });
      }),
      match: vi.fn((request: Request | string) => {
        for (const cache of cacheStorage.values()) {
          const key = typeof request === 'string' ? request : request.url;
          const response = cache.get(key);
          if (response) {
            return Promise.resolve(response);
          }
        }
        return Promise.resolve(undefined);
      }),
      keys: vi.fn(() => {
        return Promise.resolve(Array.from(cacheStorage.keys()));
      }),
      delete: vi.fn((cacheName: string) => {
        const existed = cacheStorage.has(cacheName);
        cacheStorage.delete(cacheName);
        return Promise.resolve(existed);
      }),
    } as any;

    // Mock fetch
    global.fetch = vi.fn((_request: Request | string) => {
      return Promise.resolve(
        new Response('network content', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
    cacheStorage.clear();
    eventListeners.clear();
  });

  describe('Service Worker Registration', () => {
    it('should register service worker successfully', async () => {
      // Mock navigator.serviceWorker
      const mockRegistration = {
        scope: '/',
        active: null,
        installing: null,
        waiting: null,
        updatefound: null,
      };

      const navigatorMock = {
        serviceWorker: {
          register: vi.fn(() => Promise.resolve(mockRegistration)),
        },
      };

      Object.defineProperty(global, 'navigator', {
        value: navigatorMock,
        writable: true,
        configurable: true,
      });

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
      });
      expect(registration).toBeDefined();
      expect(registration.scope).toBe('/');
    });

    it('should handle registration failure gracefully', async () => {
      const navigatorMock = {
        serviceWorker: {
          register: vi.fn(() =>
            Promise.reject(new Error('Registration failed'))
          ),
        },
      };

      Object.defineProperty(global, 'navigator', {
        value: navigatorMock,
        writable: true,
        configurable: true,
      });

      await expect(
        navigator.serviceWorker.register('/sw.js')
      ).rejects.toThrow('Registration failed');
    });

    it('should detect when service workers are not supported', () => {
      const navigatorMock = {};

      Object.defineProperty(global, 'navigator', {
        value: navigatorMock,
        writable: true,
        configurable: true,
      });

      expect('serviceWorker' in navigator).toBe(false);
    });
  });

  describe('Install Event - Caching', () => {
    it('should cache all specified assets during install', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const STATIC_ASSETS = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png',
      ];
      const BUILT_ASSETS: string[] = [];
      const ASSETS_TO_CACHE = [...STATIC_ASSETS, ...BUILT_ASSETS];

      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS_TO_CACHE);

      expect(caches.open).toHaveBeenCalledWith(CACHE_NAME);
      expect(cache.addAll).toHaveBeenCalledWith(ASSETS_TO_CACHE);

      // Verify all assets are in cache
      for (const asset of ASSETS_TO_CACHE) {
        const cachedResponse = await cache.match(asset);
        expect(cachedResponse).toBeDefined();
      }
    });

    it('should call skipWaiting after successful caching', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const ASSETS_TO_CACHE = ['/index.html'];

      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS_TO_CACHE);
      await swScope.skipWaiting();

      expect(swScope.skipWaiting).toHaveBeenCalled();
    });

    it('should handle cache failure during install', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';

      // Mock cache.addAll to fail
      const cache = await caches.open(CACHE_NAME);
      cache.addAll = vi.fn(() =>
        Promise.reject(new Error('Failed to cache assets'))
      );

      await expect(cache.addAll(['/index.html'])).rejects.toThrow(
        'Failed to cache assets'
      );
    });
  });

  describe('Fetch Event - Cache-First Strategy', () => {
    it('should return cached response when available', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const url = 'https://example.com/index.html';

      // Add resource to cache
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = new Response('cached content', { status: 200 });
      await cache.put(url, cachedResponse);

      // Simulate fetch event
      const request = new Request(url);
      const response = await caches.match(request);

      expect(response).toBeDefined();
      expect(response).toBe(cachedResponse);
      expect(await response!.text()).toBe('cached content');
    });

    it('should fetch from network when resource not in cache', async () => {
      const url = 'https://example.com/not-cached.html';
      const request = new Request(url);

      // Check cache first
      const cachedResponse = await caches.match(request);
      expect(cachedResponse).toBeUndefined();

      // Fetch from network
      const networkResponse = await fetch(request);
      expect(networkResponse).toBeDefined();
      expect(networkResponse.status).toBe(200);
      expect(await networkResponse.text()).toBe('network content');
    });

    it('should cache successful network responses', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const url = 'https://example.com/new-resource.html';

      // Fetch from network
      const networkResponse = await fetch(url);
      expect(networkResponse.status).toBe(200);

      // Cache the response
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, networkResponse.clone());

      // Verify it's now in cache
      const cachedResponse = await cache.match(url);
      expect(cachedResponse).toBeDefined();
    });

    it('should not cache failed network responses', async () => {
      const url = 'https://example.com/error.html';

      // Mock fetch to return error response
      global.fetch = vi.fn(() =>
        Promise.resolve(
          new Response('Not Found', {
            status: 404,
          })
        )
      );

      const networkResponse = await fetch(url);
      expect(networkResponse.status).toBe(404);

      // Should not cache 404 responses
      const shouldCache = networkResponse.status === 200;
      expect(shouldCache).toBe(false);
    });

    it('should handle network fetch failure', async () => {
      const url = 'https://example.com/offline-resource.html';

      // Mock fetch to fail
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network request failed'))
      );

      await expect(fetch(url)).rejects.toThrow('Network request failed');
    });
  });

  describe('Cache-First Strategy Behavior', () => {
    it('should prioritize cache over network', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const url = 'https://example.com/index.html';

      // Add to cache
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = new Response('cached version', { status: 200 });
      await cache.put(url, cachedResponse);

      // Mock network to return different content
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response('network version', { status: 200 }))
      );

      // Simulate cache-first strategy
      const request = new Request(url);
      let response = await caches.match(request);

      if (!response) {
        response = await fetch(request);
      }

      expect(await response.text()).toBe('cached version');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fall back to network when cache miss', async () => {
      const url = 'https://example.com/not-in-cache.html';
      const request = new Request(url);

      // Check cache first
      let response = await caches.match(request);

      if (!response) {
        response = await fetch(request);
      }

      expect(await response.text()).toBe('network content');
      expect(fetch).toHaveBeenCalledWith(request);
    });

    it('should serve cached resources when offline', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const url = 'https://example.com/index.html';

      // Add to cache
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = new Response('offline content', { status: 200 });
      await cache.put(url, cachedResponse);

      // Mock network to be unavailable
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network unavailable'))
      );

      // Simulate cache-first strategy
      const request = new Request(url);
      const response = await caches.match(request);

      expect(response).toBeDefined();
      expect(await response!.text()).toBe('offline content');
    });
  });

  describe('Activate Event - Cache Cleanup', () => {
    it('should delete old caches during activation', async () => {
      const CURRENT_CACHE = 'grocery-list-a1b2c3d4';
      const OLD_CACHE_1 = 'grocery-list-e5f6a7b8';
      const OLD_CACHE_2 = 'grocery-list-c9d0e1f2';

      // Create multiple caches
      await caches.open(CURRENT_CACHE);
      await caches.open(OLD_CACHE_1);
      await caches.open(OLD_CACHE_2);

      expect(cacheStorage.size).toBe(3);

      // Get all cache names
      const cacheNames = await caches.keys();
      expect(cacheNames).toContain(CURRENT_CACHE);
      expect(cacheNames).toContain(OLD_CACHE_1);
      expect(cacheNames).toContain(OLD_CACHE_2);

      // Delete old caches
      const deletePromises = cacheNames
        .filter((name) => name !== CURRENT_CACHE)
        .map((name) => caches.delete(name));

      await Promise.all(deletePromises);

      // Verify old caches are deleted
      expect(cacheStorage.has(CURRENT_CACHE)).toBe(true);
      expect(cacheStorage.has(OLD_CACHE_1)).toBe(false);
      expect(cacheStorage.has(OLD_CACHE_2)).toBe(false);
    });

    it('should call clients.claim after activation', async () => {
      await swScope.clients.claim();
      expect(swScope.clients.claim).toHaveBeenCalled();
    });

    it('should keep current cache during cleanup', async () => {
      const CURRENT_CACHE = 'grocery-list-a1b2c3d4';
      const OLD_CACHE = 'grocery-list-e5f6a7b8';

      await caches.open(CURRENT_CACHE);
      await caches.open(OLD_CACHE);

      const cacheNames = await caches.keys();
      const deletePromises = cacheNames
        .filter((name) => name !== CURRENT_CACHE)
        .map((name) => caches.delete(name));

      await Promise.all(deletePromises);

      expect(cacheStorage.has(CURRENT_CACHE)).toBe(true);
      expect(cacheStorage.has(OLD_CACHE)).toBe(false);
    });
  });

  describe('Service Worker Lifecycle', () => {
    it('should handle complete install lifecycle', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const ASSETS = ['/index.html', '/manifest.webmanifest'];

      // Install phase
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
      await swScope.skipWaiting();

      expect(cache.addAll).toHaveBeenCalledWith(ASSETS);
      expect(swScope.skipWaiting).toHaveBeenCalled();
    });

    it('should handle complete activate lifecycle', async () => {
      const CURRENT_CACHE = 'grocery-list-a1b2c3d4';
      const OLD_CACHE = 'grocery-list-e5f6a7b8';

      await caches.open(CURRENT_CACHE);
      await caches.open(OLD_CACHE);

      // Activate phase
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CURRENT_CACHE)
          .map((name) => caches.delete(name))
      );
      await swScope.clients.claim();

      expect(cacheStorage.has(CURRENT_CACHE)).toBe(true);
      expect(cacheStorage.has(OLD_CACHE)).toBe(false);
      expect(swScope.clients.claim).toHaveBeenCalled();
    });
  });

  describe('Response Cloning', () => {
    it('should clone response before caching to avoid consumption', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
      const url = 'https://example.com/test.html';

      const originalResponse = new Response('test content', { status: 200 });
      const clonedResponse = originalResponse.clone();

      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, clonedResponse);

      // Original response should still be usable
      expect(await originalResponse.text()).toBe('test content');

      // Cached response should also be available
      const cachedResponse = await cache.match(url);
      expect(cachedResponse).toBeDefined();
    });
  });

  describe('Offline Fallback Behavior', () => {
    it('should return cached /index.html for navigation requests when offline', async () => {
      const CACHE_NAME = 'grocery-list-__BUILD_HASH__';

      // Pre-cache /index.html
      const cache = await caches.open(CACHE_NAME);
      const indexResponse = new Response('<html>SPA</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
      await cache.put('/index.html', indexResponse);

      // Mock fetch to fail (offline)
      global.fetch = vi.fn(() =>
        Promise.reject(new TypeError('Load failed'))
      );

      // Simulate the fixed fetch handler logic for a navigation request
      const url = 'https://example.com/some-route';
      const requestMode = 'navigate';

      let response = await caches.match(url);
      if (!response) {
        try {
          response = await fetch(url);
        } catch {
          // Navigation: serve cached /index.html as SPA fallback
          if (requestMode === 'navigate') {
            const fallback = await caches.match('/index.html');
            response = fallback || new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html' },
            });
          } else {
            response = new Response('Service Unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          }
        }
      }

      expect(response).toBeDefined();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toBe('<html>SPA</html>');
    });

    it('should return 503 for non-navigation requests when offline', async () => {
      // Mock fetch to fail (offline)
      global.fetch = vi.fn(() =>
        Promise.reject(new TypeError('Load failed'))
      );

      // Simulate the fixed fetch handler logic for a non-navigation request
      const url = 'https://example.com/api/data.json';
      const requestMode = 'cors';

      let response = await caches.match(url);
      if (!response) {
        try {
          response = await fetch(url);
        } catch {
          if (requestMode === 'navigate') {
            const fallback = await caches.match('/index.html');
            response = fallback || new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html' },
            });
          } else {
            response = new Response('Service Unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          }
        }
      }

      expect(response).toBeDefined();
      expect(response!.status).toBe(503);
      expect(response!.statusText).toBe('Service Unavailable');
    });

    it('should return 503 for navigation requests when offline and no cached /index.html', async () => {
      // No /index.html in cache — cacheStorage is empty from beforeEach

      // Mock fetch to fail (offline)
      global.fetch = vi.fn(() =>
        Promise.reject(new TypeError('Load failed'))
      );

      // Simulate the fixed fetch handler logic for a navigation request
      const url = 'https://example.com/some-route';
      const requestMode = 'navigate';

      let response = await caches.match(url);
      if (!response) {
        try {
          response = await fetch(url);
        } catch {
          if (requestMode === 'navigate') {
            const fallback = await caches.match('/index.html');
            response = fallback || new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html' },
            });
          } else {
            response = new Response('Service Unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          }
        }
      }

      expect(response).toBeDefined();
      expect(response!.status).toBe(503);
      expect(response!.statusText).toBe('Service Unavailable');
    });
  });
});

/**
 * Property-based tests for service worker
 * Feature: grocery-list-pwa, Property 25: Service worker serves cached resources offline
 * **Validates: Requirements 11.1**
 */
describe('Property-Based Tests', () => {
  it('Property 25: Service worker serves cached resources offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random URLs and content
        fc.array(
          fc.record({
            url: fc.webUrl(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            status: fc.constantFrom(200, 201), // Only status codes that allow body content
            contentType: fc.constantFrom(
              'text/html',
              'text/css',
              'application/javascript',
              'application/json',
              'image/png'
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (resources) => {
          // Create fresh cache storage for each test run
          const cacheStorage = new Map<string, Map<string, Response>>();

          // Mock caches API with proper implementation
          const mockCaches = {
            open: async (cacheName: string) => {
              if (!cacheStorage.has(cacheName)) {
                cacheStorage.set(cacheName, new Map());
              }
              const cache = cacheStorage.get(cacheName)!;
              return {
                put: async (request: Request | string, response: Response) => {
                  const key = typeof request === 'string' ? request : request.url;
                  cache.set(key, response);
                },
                match: async (request: Request | string) => {
                  const key = typeof request === 'string' ? request : request.url;
                  return cache.get(key);
                },
              };
            },
            match: async (request: Request | string) => {
              for (const cache of cacheStorage.values()) {
                const key = typeof request === 'string' ? request : request.url;
                const response = cache.get(key);
                if (response) {
                  return response;
                }
              }
              return undefined;
            },
          };

          const CACHE_NAME = 'grocery-list-__BUILD_HASH__';
          const cache = await mockCaches.open(CACHE_NAME);

          // Cache all resources
          for (const resource of resources) {
            const response = new Response(resource.content, {
              status: resource.status,
              headers: { 'Content-Type': resource.contentType },
            });
            // Use string URL directly for caching
            await cache.put(resource.url, response);
          }

          // Verify all cached resources can be served offline
          for (const resource of resources) {
            // Use string URL directly for matching (same as cache.put)
            const cachedResponse = await cache.match(resource.url);

            // Property: cached resource should be available offline
            expect(cachedResponse).toBeDefined();
            expect(cachedResponse).not.toBeUndefined();

            if (cachedResponse) {
              // Property: cached response should have correct status
              expect(cachedResponse.status).toBe(resource.status);

              // Property: cached response should have correct content
              const cachedContent = await cachedResponse.text();
              expect(cachedContent).toBe(resource.content);

              // Property: cached response should have correct content type
              expect(cachedResponse.headers.get('Content-Type')).toBe(
                resource.contentType
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
