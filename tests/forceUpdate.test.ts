/**
 * Unit tests for forceUpdate utility
 * Feature: force-update-control
 */

import { describe, it, expect, vi } from 'vitest';
import { forceUpdate, ForceUpdateDeps } from '../src/forceUpdate';

/**
 * Creates a mock CacheStorage with the given cache names.
 */
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

/**
 * Creates a mock ServiceWorkerRegistration.
 * By default update() resolves and no new SW is installing/waiting.
 */
function createMockRegistration(
  overrides: {
    updateFn?: () => Promise<ServiceWorkerRegistration>;
    installing?: ServiceWorker | null;
    waiting?: ServiceWorker | null;
  } = {}
): ServiceWorkerRegistration {
  return {
    update: overrides.updateFn ?? (async () => ({} as ServiceWorkerRegistration)),
    installing: overrides.installing ?? null,
    waiting: overrides.waiting ?? null,
    active: null,
  } as unknown as ServiceWorkerRegistration;
}

describe('forceUpdate', () => {
  // Req 2.2: null registration → unsupported
  it('returns unsupported status when registration is null', async () => {
    const reload = vi.fn();
    const deps: ForceUpdateDeps = {
      registration: null,
      caches: createMockCacheStorage(),
      reload,
    };

    const result = await forceUpdate(deps);

    expect(result.status).toBe('unsupported');
    expect(result.cacheCleared).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  // Req 2.3: update() rejects → error status with message, no reload
  it('returns error status with message when update() rejects', async () => {
    const reload = vi.fn();
    const registration = createMockRegistration({
      updateFn: async () => { throw new Error('Network failure'); },
    });
    const deps: ForceUpdateDeps = {
      registration,
      caches: createMockCacheStorage(),
      reload,
    };

    const result = await forceUpdate(deps);

    expect(result.status).toBe('error');
    expect(result.message).toBe('You appear to be offline. Please check your connection and try again.');
    expect(reload).not.toHaveBeenCalled();
  });

  // Req 3.3: cache deletion fails → still calls reload, cacheCleared: false
  it('calls reload and sets cacheCleared false when cache deletion fails', async () => {
    const reload = vi.fn();
    const failingCaches = {
      keys: async () => { throw new Error('Cache access denied'); },
      delete: async () => false,
      has: async () => false,
      open: async () => ({}) as Cache,
      match: async () => undefined,
    } as CacheStorage;

    const registration = createMockRegistration();
    const deps: ForceUpdateDeps = {
      registration,
      caches: failingCaches,
      reload,
    };

    const result = await forceUpdate(deps);

    expect(result.cacheCleared).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });

  // Req 3.1, 3.2: all succeeds with new SW → reloading
  it('calls reload and returns reloading when update finds a new version', async () => {
    const reload = vi.fn();
    const mockWorker = {} as ServiceWorker;
    const registration = createMockRegistration({
      installing: mockWorker,
    });
    const deps: ForceUpdateDeps = {
      registration,
      caches: createMockCacheStorage(['cache-v1', 'cache-v2']),
      reload,
    };

    const result = await forceUpdate(deps);

    expect(result.status).toBe('reloading');
    expect(result.cacheCleared).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  // Req 4.3: no new version, caches cleared → reload with fresh assets
  it('reloads after clearing caches even when no new service worker is found', async () => {
    const reload = vi.fn();
    const registration = createMockRegistration(); // no installing/waiting
    const deps: ForceUpdateDeps = {
      registration,
      caches: createMockCacheStorage(['old-cache']),
      reload,
    };

    const result = await forceUpdate(deps);

    expect(result.status).toBe('reloading');
    expect(result.message).toBe('Caches cleared. Reloading...');
    expect(result.cacheCleared).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
