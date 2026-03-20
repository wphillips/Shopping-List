/**
 * Unit tests for build timestamp display: footer DOM structure and notification messages
 * Feature: build-timestamp-display
 * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toShortTimestamp } from '../src/build-timestamp';

// Provide the __BUILD_TIMESTAMP__ global that Vite normally injects
(globalThis as any).__BUILD_TIMESTAMP__ = 'Built Mar 16, 2026 9:45 PM';

// Mock storage module before any imports that use it
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

// Mock forceUpdate so we can control its return value
const mockForceUpdate = vi.fn();
vi.mock('../src/forceUpdate', () => ({
  forceUpdate: (...args: any[]) => mockForceUpdate(...args),
}));

/**
 * Helper: set up the DOM with an #app container and dynamically import
 * the index module so AppShell initialises against it.
 */
async function initAppShell(): Promise<{ appShell: any }> {
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

  // Mock window.matchMedia for standalone detection
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;

  await import('../src/index');

  const appShell = (window as any).__appShell;
  return { appShell };
}

describe('Build Timestamp Display — Footer DOM Structure', () => {
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

  // Req 2.5: footer no longer contains .build-timestamp (moved to About page)
  it('main footer does not contain .build-timestamp span', async () => {
    await initAppShell();

    const footer = document.querySelector('#app-footer');
    expect(footer).toBeTruthy();

    const timestampSpan = footer!.querySelector('.build-timestamp');
    expect(timestampSpan).toBeNull();
  });

  // Req 2.6: footer no longer contains .github-link (moved to About page)
  it('main footer does not contain .github-link anchor', async () => {
    await initAppShell();

    const footer = document.querySelector('#app-footer');
    expect(footer).toBeTruthy();

    const githubLink = footer!.querySelector('.github-link');
    expect(githubLink).toBeNull();
  });

  // Footer contains .about-link after the update button
  it('footer contains .about-link element', async () => {
    await initAppShell();

    const footer = document.querySelector('#app-footer');
    expect(footer).toBeTruthy();

    const aboutLink = footer!.querySelector('.about-link');
    expect(aboutLink).toBeTruthy();
    expect(aboutLink!.textContent).toBe('About');
    expect(aboutLink!.getAttribute('aria-label')).toBe('About this app');
  });
});

describe('Build Timestamp Display — Notification Messages', () => {
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

  // Req 3.1: up-to-date notification includes short timestamp
  it('up-to-date notification includes the short timestamp', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'up-to-date',
      message: 'App is already up to date.',
      cacheCleared: true,
    });

    const { appShell } = await initAppShell();
    appShell.setSwRegistration({
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration);

    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      // Should contain the short timestamp derived from __BUILD_TIMESTAMP__
      const expected = `App is up to date (${toShortTimestamp('Built Mar 16, 2026 9:45 PM')})`;
      expect(notification!.textContent).toBe(expected);
    });
  });

  // Req 3.2: unsupported status excludes timestamp
  it('unsupported notification does not include the build timestamp', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'unsupported',
      message: 'Service workers are not supported',
      cacheCleared: false,
    });

    const { appShell } = await initAppShell();
    appShell.setSwRegistration(null);

    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      expect(notification!.textContent).toBe('Updates are not supported in this browser.');
      expect(notification!.textContent).not.toContain('built');
    });
  });

  // Req 3.2: error status excludes timestamp
  it('error notification does not include the build timestamp', async () => {
    mockForceUpdate.mockResolvedValue({
      status: 'error',
      message: 'Something went wrong',
      cacheCleared: false,
    });

    const { appShell } = await initAppShell();
    appShell.setSwRegistration({
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration);

    const button = document.querySelector('.update-btn') as HTMLButtonElement;
    button.click();

    await vi.waitFor(() => {
      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      expect(notification!.textContent).toBe('Something went wrong');
      expect(notification!.textContent).not.toContain('built');
    });
  });
});

describe('Build Timestamp Display — toShortTimestamp', () => {
  // Req 3.1: graceful fallback for dev mode value
  it('toShortTimestamp("Built dev") returns "built dev"', () => {
    expect(toShortTimestamp('Built dev')).toBe('built dev');
  });

  // Req 3.1: standard full timestamp is shortened correctly
  it('toShortTimestamp strips year and lowercases "Built"', () => {
    expect(toShortTimestamp('Built Mar 16, 2026 9:45 PM')).toBe('built Mar 16 9:45 PM');
  });
});
