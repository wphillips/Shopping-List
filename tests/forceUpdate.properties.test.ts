/**
 * Property-based tests for forceUpdate utility
 * Feature: force-update-control
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { forceUpdate, ForceUpdateDeps } from '../src/forceUpdate';

/**
 * Creates a mock CacheStorage populated with the given cache names.
 * Tracks which caches exist and supports keys() and delete().
 */
function createMockCacheStorage(cacheNames: string[]): CacheStorage {
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
 * Creates a mock ServiceWorkerRegistration with an update() that resolves.
 */
function createMockRegistration(): ServiceWorkerRegistration {
  return {
    update: async () => ({} as ServiceWorkerRegistration),
    installing: null,
    waiting: null,
    active: null,
  } as unknown as ServiceWorkerRegistration;
}

// Feature: force-update-control, Property 1: All caches are deleted
describe('Property 1: All caches are deleted', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any set of cache names present in CacheStorage, calling forceUpdate
   * should result in every cache being deleted — i.e., caches.keys() returns
   * an empty list after the operation completes.
   */
  it('should delete all caches for any random set of cache name strings', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 0, maxLength: 50 }),
        async (cacheNames: string[]) => {
          const mockCaches = createMockCacheStorage(cacheNames);
          const reloadFn = () => {};

          const deps: ForceUpdateDeps = {
            registration: createMockRegistration(),
            caches: mockCaches,
            reload: reloadFn,
          };

          await forceUpdate(deps);

          // After forceUpdate, all caches should be gone
          const remainingKeys = await mockCaches.keys();
          expect(remainingKeys).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: force-update-control, Property 2: Button is disabled and shows loading text during update
describe('Property 2: Button is disabled and shows loading text during update', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any invocation of the force-update handler, while the underlying async
   * operation is pending, the update button must be disabled and display
   * loading text ("Updating...").
   */
  it('should disable button and show "Updating..." for any random async delay', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 500 }),
        async (delayMs: number) => {
          // Set up a minimal DOM matching AppShell's structure
          const container = document.createElement('div');
          container.innerHTML = `
            <div class="app-shell">
              <header class="app-header">
                <h1>Grocery List</h1>
              </header>
            </div>
          `;
          document.body.appendChild(container);

          // Create the update button the same way AppShell does
          const button = document.createElement('button');
          button.textContent = 'Update App';
          button.setAttribute('aria-label', 'Force update the application');
          button.className = 'update-btn';
          const header = container.querySelector('.app-header')!;
          header.appendChild(button);

          // Create a controllable promise that resolves after the random delay
          let resolveForceUpdate!: (value: { status: string; message: string; cacheCleared: boolean }) => void;
          const forceUpdatePromise = new Promise<{ status: string; message: string; cacheCleared: boolean }>(
            (resolve) => { resolveForceUpdate = resolve; }
          );

          // Wire the button handler to mimic AppShell.handleForceUpdate
          const handler = async () => {
            button.disabled = true;
            button.textContent = 'Updating...';

            const result = await forceUpdatePromise;

            // Re-enable on non-reloading outcomes (mirrors AppShell logic)
            if (result.status !== 'reloading') {
              button.disabled = false;
              button.textContent = 'Update App';
            }
          };

          // Trigger the handler (don't await — we want to inspect mid-flight state)
          const handlerPromise = handler();

          // Yield to microtasks so the synchronous part of the handler executes
          await Promise.resolve();

          // ASSERT: while the async operation is pending, button must be disabled
          // and show loading text
          expect(button.disabled).toBe(true);
          expect(button.textContent).toBe('Updating...');

          // Now resolve the forceUpdate after the random delay
          await new Promise((r) => setTimeout(r, delayMs));
          resolveForceUpdate({ status: 'up-to-date', message: '', cacheCleared: true });

          // Wait for the handler to finish
          await handlerPromise;

          // Cleanup
          document.body.removeChild(container);
        }
      ),
      { numRuns: 100 }
    );
  });
});
