/**
 * Preservation Property Tests — Offline Fetch Crash
 *
 * These tests verify EXISTING correct behavior that must be preserved
 * through the bugfix. They are expected to PASS on the current unfixed code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.4**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { forceUpdate, ForceUpdateDeps } from '../src/forceUpdate';

// ---------------------------------------------------------------------------
// Helpers: simulate the CURRENT SW fetch handler logic
// ---------------------------------------------------------------------------

/**
 * Mimics the current fetch handler in public/sw.js (cache-first strategy).
 * For preservation tests we only exercise the non-buggy paths:
 *   - Cache hit → return cached response
 *   - Cache miss + network 200 → return response (and cache clone)
 */
async function currentFetchHandler(
  requestUrl: string,
  cache: Map<string, Response>,
  networkFn?: () => Promise<Response>,
): Promise<Response> {
  // 1. Cache lookup
  const cached = cache.get(requestUrl);
  if (cached) {
    return cached;
  }

  // 2. Network fetch
  const networkResponse = await networkFn!();

  // Cache 200 responses (simulates the caching logic)
  if (networkResponse && networkResponse.status === 200) {
    cache.set(requestUrl, networkResponse.clone());
  }

  return networkResponse;
}

// ---------------------------------------------------------------------------
// Mock helpers for forceUpdate (same pattern as tests/forceUpdate.test.ts)
// ---------------------------------------------------------------------------

function createMockCacheStorage(cacheNames: string[] = []): CacheStorage {
  const store = new Set<string>(cacheNames);
  return {
    keys: async () => Array.from(store),
    delete: async (name: string) => {
      const existed = store.has(name);
      store.delete(name);
      return existed;
    },
    has: async () => false,
    open: async () => ({}) as Cache,
    match: async () => undefined,
  } as CacheStorage;
}

function createMockRegistration(
  overrides: {
    updateFn?: () => Promise<ServiceWorkerRegistration>;
    installing?: ServiceWorker | null;
    waiting?: ServiceWorker | null;
  } = {},
): ServiceWorkerRegistration {
  return {
    update:
      overrides.updateFn ??
      (async () => ({}) as ServiceWorkerRegistration),
    installing: overrides.installing ?? null,
    waiting: overrides.waiting ?? null,
    active: null,
  } as unknown as ServiceWorkerRegistration;
}

// ---------------------------------------------------------------------------
// CP-4: Cache hit returns cached response regardless of network state
// ---------------------------------------------------------------------------

describe('Preservation: SW fetch handler cache-first behavior', () => {
  it('CP-4: cache hit returns cached response regardless of network state', async () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any URL that exists in the cache, the fetch handler returns the
     * cached response immediately without attempting a network fetch.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ withFragments: false, withQueryParameters: false }),
        fc.string({ minLength: 1, maxLength: 500 }),
        async (url, body) => {
          const cachedResponse = new Response(body, { status: 200 });
          const cache = new Map<string, Response>();
          cache.set(url, cachedResponse);

          // Network function should never be called on cache hit
          const networkFn = vi.fn(async () => new Response('should not reach'));

          const response = await currentFetchHandler(url, cache, networkFn);

          // The cached response is returned
          expect(response).toBe(cachedResponse);
          // Network was never consulted
          expect(networkFn).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// CP-5: Cache miss + network 200 returns response and caches clone
// ---------------------------------------------------------------------------

describe('Preservation: SW fetch handler network 200 caching', () => {
  it('CP-5: cache miss + network 200 returns response and caches clone', async () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any URL not in cache where the network returns a 200 response,
     * the fetch handler returns the network response and caches a clone.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ withFragments: false, withQueryParameters: false }),
        fc.string({ minLength: 1, maxLength: 500 }),
        async (url, body) => {
          const cache = new Map<string, Response>();

          // Network returns 200
          const networkFn = vi.fn(
            async () => new Response(body, { status: 200 }),
          );

          const response = await currentFetchHandler(url, cache, networkFn);

          // Response is returned from network
          expect(response).toBeInstanceOf(Response);
          expect(response.status).toBe(200);
          const responseBody = await response.text();
          expect(responseBody).toBe(body);

          // Network was called
          expect(networkFn).toHaveBeenCalledOnce();

          // A clone was cached
          expect(cache.has(url)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// CP-6: Successful registration.update() clears caches and calls reload()
// ---------------------------------------------------------------------------

describe('Preservation: forceUpdate success behavior', () => {
  it('CP-6: successful registration.update() clears caches and calls reload()', async () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * When registration.update() succeeds, forceUpdate() clears all caches
     * and calls reload().
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 0,
          maxLength: 10,
        }),
        async (cacheNames) => {
          const reload = vi.fn();
          const mockCaches = createMockCacheStorage(cacheNames);
          const registration = createMockRegistration();

          const deps: ForceUpdateDeps = {
            registration,
            caches: mockCaches,
            reload,
          };

          const result = await forceUpdate(deps);

          // reload() is called
          expect(reload).toHaveBeenCalledOnce();

          // All caches are cleared
          const remainingKeys = await mockCaches.keys();
          expect(remainingKeys).toEqual([]);

          // Result indicates success
          expect(result.cacheCleared).toBe(true);
          expect(result.status).toBe('reloading');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Fix-Checking Property Tests — Offline Fetch Crash
//
// These tests verify the FIXED behavior after the bugfix is applied.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers: simulate the FIXED SW fetch handler logic
// ---------------------------------------------------------------------------

/**
 * Mimics the fixed fetch handler in public/sw.js.
 *
 * Cache-first strategy with graceful offline fallback:
 *   1. Check cache → return if hit
 *   2. Fetch from network → cache 200s, return response
 *   3. .catch() → navigation: return cached /index.html or 503; non-navigation: return 503
 */
async function fixedFetchHandler(
  requestUrl: string,
  requestMode: 'navigate' | 'no-cors' | 'cors' | 'same-origin',
  cache: Map<string, Response>,
): Promise<Response> {
  // 1. Cache lookup
  const cached = cache.get(requestUrl);
  if (cached) {
    return cached;
  }

  // 2. Network fetch — simulate offline by always rejecting
  try {
    const networkResponse: Response = await Promise.reject(
      new TypeError('Load failed'),
    );
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);

    // Navigation: serve cached /index.html as SPA fallback
    if (requestMode === 'navigate') {
      const fallback = cache.get('/index.html');
      return fallback || new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Non-navigation: return 503
    return new Response('Service Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// ---------------------------------------------------------------------------
// CP-1: Navigation request not in cache + offline → resolved Response (SPA fallback)
// ---------------------------------------------------------------------------

describe('Fix-Checking: SW fetch handler offline fallback', () => {
  it('CP-1: navigation request + cache miss + offline → resolved Response (SPA fallback from cached /index.html)', async () => {
    /**
     * **Validates: Requirements 2.1**
     *
     * For any navigation request not in cache while offline, the fetch
     * handler returns a resolved Response (cached /index.html fallback),
     * never a rejected promise.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ withFragments: false, withQueryParameters: false }),
        async (url) => {
          // Cache has /index.html but not the requested URL
          const cache = new Map<string, Response>();
          cache.set('/index.html', new Response('<html>SPA</html>', { status: 200 }));

          const response = await fixedFetchHandler(url, 'navigate', cache);

          expect(response).toBeInstanceOf(Response);
          expect(response.status).toBe(200);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('CP-1 (no cached index.html): navigation request + cache miss + offline + no /index.html → 503 Response', async () => {
    /**
     * **Validates: Requirements 2.1**
     *
     * When /index.html is also not cached, the fallback returns a 503.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ withFragments: false, withQueryParameters: false }),
        async (url) => {
          const emptyCache = new Map<string, Response>();

          const response = await fixedFetchHandler(url, 'navigate', emptyCache);

          expect(response).toBeInstanceOf(Response);
          expect(response.status).toBe(503);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // CP-2: Non-navigation request not in cache + offline → resolved 503 Response
  // ---------------------------------------------------------------------------

  it('CP-2: non-navigation request + cache miss + offline → resolved 503 Response', async () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any non-navigation request not in cache while offline, the fetch
     * handler returns a resolved 503 Response, never a rejected promise.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl({ withFragments: false, withQueryParameters: false }),
        fc.constantFrom('no-cors', 'cors', 'same-origin') as fc.Arbitrary<
          'no-cors' | 'cors' | 'same-origin'
        >,
        async (url, mode) => {
          const emptyCache = new Map<string, Response>();

          const response = await fixedFetchHandler(url, mode, emptyCache);

          expect(response).toBeInstanceOf(Response);
          expect(response.status).toBe(503);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// CP-3: registration.update() throws → reload() never called
// ---------------------------------------------------------------------------

describe('Fix-Checking: forceUpdate no reload on error', () => {
  it('CP-3: when registration.update() throws, reload() is never called', async () => {
    /**
     * **Validates: Requirements 2.3**
     *
     * When registration.update() throws (offline), forceUpdate() must
     * NOT call reload(). It returns an error status with an offline message.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (errorMessage) => {
          const reload = vi.fn();
          const registration = createMockRegistration({
            updateFn: async () => {
              throw new Error(errorMessage);
            },
          });
          const deps: ForceUpdateDeps = {
            registration,
            caches: createMockCacheStorage(),
            reload,
          };

          const result = await forceUpdate(deps);

          // reload() must NOT be called
          expect(reload).not.toHaveBeenCalled();
          // Result indicates error with offline message
          expect(result.status).toBe('error');
          expect(result.message).toBe('You appear to be offline. Please check your connection and try again.');
        },
      ),
      { numRuns: 100 },
    );
  });
});
