export interface ForceUpdateDeps {
  registration: ServiceWorkerRegistration | null;
  caches: CacheStorage;
  reload: () => void;
}

export interface ForceUpdateResult {
  status: 'reloading' | 'up-to-date' | 'unsupported' | 'error';
  message: string;
  cacheCleared: boolean;
}

export async function forceUpdate(deps: ForceUpdateDeps): Promise<ForceUpdateResult> {
  const { registration, caches, reload } = deps;

  // Phase 0: Check if service workers are supported
  if (registration === null) {
    return {
      status: 'unsupported',
      message: 'Service workers are not supported',
      cacheCleared: false,
    };
  }

  // Phase 1: Try calling registration.update()
  let updateError: Error | null = null;
  try {
    await registration.update();
  } catch (err) {
    updateError = err instanceof Error ? err : new Error(String(err));
  }

  // Phase 2: Try clearing all caches
  let cacheCleared = false;
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    cacheCleared = true;
  } catch {
    cacheCleared = false;
  }

  // Phase 3: Determine result and potentially reload
  if (updateError) {
    // Don't reload — we're likely offline and reloading would compound the crash
    return {
      status: 'error',
      message: 'You appear to be offline. Please check your connection and try again.',
      cacheCleared,
    };
  }

  // Update succeeded
  if (cacheCleared) {
    // Always reload after clearing caches — fresh assets will be fetched from network
    reload();

    if (registration.installing || registration.waiting) {
      return {
        status: 'reloading',
        message: 'Update found. Reloading...',
        cacheCleared: true,
      };
    }

    return {
      status: 'reloading',
      message: 'Caches cleared. Reloading...',
      cacheCleared: true,
    };
  }

  // Caches failed to clear but update succeeded — still reload with warning
  reload();
  return {
    status: 'reloading',
    message: 'Update found but cache clear failed. Reloading...',
    cacheCleared: false,
  };
}
