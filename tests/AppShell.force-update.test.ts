/**
 * Integration tests for Force Update button rendering and AppShell wiring
 * Feature: force-update-control
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the storage module before any imports that use it
vi.mock('../src/storage', () => ({
  saveMultiListState: vi.fn(),
  loadMultiListState: vi.fn(() => {
    const listId = 'test-list-id';
    return {
      lists: [{
        id: listId,
        name: 'My Grocery List',
        sections: [],
        items: [],
        createdAt: Date.now(),
      }],
      activeListId: listId,
      filterMode: 'all' as const,
      collapsedSections: new Set<string>(),
      version: 2,
    };
  }),
  createDefaultMultiListState: vi.fn(() => {
    const listId = 'default-list-id';
    return {
      lists: [{
        id: listId,
        name: 'My Grocery List',
        sections: [],
        items: [],
        createdAt: Date.now(),
      }],
      activeListId: listId,
      filterMode: 'all' as const,
      collapsedSections: new Set<string>(),
      version: 2,
    };
  }),
  StorageQuotaExceededError: class StorageQuotaExceededError extends Error {
    constructor(message = 'Storage quota exceeded') {
      super(message);
      this.name = 'StorageQuotaExceededError';
    }
  },
}));

// Mock forceUpdate so we can control its return value without touching real SW/caches
const mockForceUpdate = vi.fn();
vi.mock('../src/forceUpdate', () => ({
  forceUpdate: (...args: any[]) => mockForceUpdate(...args),
}));

/**
 * Helper: set up the DOM with an #app container and dynamically import
 * the index module so AppShell initialises against it.
 */
async function initAppShell(): Promise<{ appShell: any }> {
  // Mock navigator.serviceWorker so registerServiceWorker resolves
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        scope: '/',
        update: vi.fn().mockResolvedValue(undefined),
        installing: null,
        waiting: null,
        active: null,
      }),
      controller: null,
    },
    configurable: true,
    writable: true,
  });

  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);

  await import('../src/index');

  const appShell = (window as any).__appShell;
  return { appShell };
}

describe('AppShell Force Update Integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockForceUpdate.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).__appShell;
  });

  // Req 1.1: button is rendered inside the footer element
  it('renders the update button inside the footer element', async () => {
    await initAppShell();

    const footer = document.querySelector('#app-footer');
    expect(footer).toBeTruthy();

    const button = footer!.querySelector('.update-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();
  });

  // Req 1.2, 1.3: button has correct label text and aria-label
  it('update button has label "Check for updates" and correct aria-label', async () => {
    await initAppShell();

    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.textContent).toBe('Check for updates');
    expect(button.getAttribute('aria-label')).toBe('Check for application updates');
  });

  // Req 2.1: clicking button calls registration.update() via forceUpdate utility
  it('clicking the button calls forceUpdate with the stored registration', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'up-to-date',
      message: 'App is already up to date.',
      cacheCleared: true,
    });

    const { appShell } = await initAppShell();

    // Create a mock registration and store it
    const mockRegistration = {
      update: vi.fn().mockResolvedValue(undefined),
      installing: null,
      waiting: null,
      active: null,
    } as unknown as ServiceWorkerRegistration;
    appShell.setSwRegistration(mockRegistration);

    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    // Wait for the async handler to complete
    await vi.waitFor(() => {
      expect(mockForceUpdate).toHaveBeenCalledOnce();
    });

    // Verify forceUpdate was called with the stored registration
    const callArgs = mockForceUpdate.mock.calls[0][0];
    expect(callArgs.registration).toBe(mockRegistration);
  });

  // Req 2.2: when registration is null, notification is shown
  it('shows notification when registration is null (unsupported)', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'unsupported',
      message: 'Service workers are not supported',
      cacheCleared: false,
    });

    const { appShell } = await initAppShell();

    // Ensure registration is null
    appShell.setSwRegistration(null);

    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    // Wait for the async handler and notification to appear
    await vi.waitFor(() => {
      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      expect(notification!.textContent).toBe('Updates are not supported in this browser.');
    });
  });

  // Req 5.1: registerServiceWorker() returns the registration object on success
  it('registerServiceWorker returns registration on success', async () => {
    const mockReg = {
      addEventListener: vi.fn(),
      scope: '/',
      update: vi.fn(),
      installing: null,
      waiting: null,
      active: null,
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(mockReg),
        controller: null,
      },
      configurable: true,
      writable: true,
    });

    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    await import('../src/index');

    const appShell = (window as any).__appShell;

    // Wait for the async registerServiceWorker().then(reg => setSwRegistration(reg)) to settle
    await vi.waitFor(() => {
      // Access the stored registration via the public setter's effect
      // We verify by clicking the button and checking what forceUpdate receives
      mockForceUpdate.mockResolvedValue({
        status: 'up-to-date',
        message: 'ok',
        cacheCleared: true,
      });

      const button = document.querySelector('.update-btn') as HTMLButtonElement;
      button.click();
    });

    await vi.waitFor(() => {
      expect(mockForceUpdate).toHaveBeenCalled();
      const callArgs = mockForceUpdate.mock.calls[0][0];
      expect(callArgs.registration).toBe(mockReg);
    });
  });

  // Req 5.2: AppShell stores the registration
  it('AppShell stores the registration via setSwRegistration', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'up-to-date',
      message: 'ok',
      cacheCleared: true,
    });

    const { appShell } = await initAppShell();

    const mockReg = { update: vi.fn() } as unknown as ServiceWorkerRegistration;
    appShell.setSwRegistration(mockReg);

    // Trigger the button to verify the stored registration is passed to forceUpdate
    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      expect(mockForceUpdate).toHaveBeenCalledOnce();
      expect(mockForceUpdate.mock.calls[0][0].registration).toBe(mockReg);
    });
  });

  // Req 5.3: when registration fails, null is stored
  it('stores null when service worker registration fails', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'unsupported',
      message: 'Service workers are not supported',
      cacheCleared: false,
    });

    // Override navigator.serviceWorker.register to reject
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockRejectedValue(new Error('Registration failed')),
        controller: null,
      },
      configurable: true,
      writable: true,
    });

    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    await import('../src/index');

    const appShell = (window as any).__appShell;

    // Wait for the rejected registerServiceWorker promise to settle
    // and null to be stored via setSwRegistration(null)
    await new Promise((r) => setTimeout(r, 50));

    // Click the button — forceUpdate should receive null registration
    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      expect(mockForceUpdate).toHaveBeenCalledOnce();
      expect(mockForceUpdate.mock.calls[0][0].registration).toBeNull();
    });
  });
});
