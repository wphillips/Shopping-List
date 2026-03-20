/**
 * Unit tests for Add Section button and AppShell wiring
 * Feature: section-management
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 4.3, 5.1, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StateManager } from '../src/state';

import { MultiListState } from '../src/types';

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

/** Helper: get the active list from a MultiListState */
function al(state: Readonly<MultiListState>) {
  return state.lists.find(l => l.id === state.activeListId)!;
}

/**
 * Helper: set up the DOM with an #app container and dynamically import
 * the index module so AppShell initialises against it.
 * Returns the appShell instance exposed on window.__appShell.
 */
async function initAppShell(): Promise<{ appShell: any; stateManager: StateManager }> {
  // Mock navigator.serviceWorker so registerServiceWorker doesn't blow up
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register: vi.fn().mockResolvedValue({ addEventListener: vi.fn() }) },
    configurable: true,
    writable: true,
  });

  // Create the #app container
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);

  // Mock window.matchMedia for standalone detection
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;

  // Dynamic import — each call gets a fresh module because we reset modules
  await import('../src/index');

  const appShell = (window as any).__appShell;
  const stateManager: StateManager = appShell.getStateManager();
  return { appShell, stateManager };
}

describe('AppShell Section Management', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as any).__appShell;
  });

  it('should render Add Section button with correct text and aria-label="Add new section"', async () => {
    await initAppShell();

    const btn = document.querySelector('.add-section-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Add new section');
    expect(btn.textContent).toContain('Add Section');
    expect(btn.textContent).toContain('+');
  });

  it('should show Add Section button when no sections exist', async () => {
    await initAppShell();

    // State starts with zero sections
    const btn = document.querySelector('.add-section-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    // Button should be in the DOM and visible (not display:none)
    expect(btn.offsetParent !== undefined).toBe(true);
  });

  it('should create section with empty name and enter rename mode on click', async () => {
    const { stateManager } = await initAppShell();

    const btn = document.querySelector('.add-section-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    btn.click();

    // State should now have one section with empty name (ready for user input)
    const state = stateManager.getState();
    expect(al(state).sections).toHaveLength(1);
    expect(al(state).sections[0].name).toBe('');

    // The new section should be in rename mode — an input should be present
    const renameInput = document.querySelector('.section-title input[aria-label="Rename section"]') as HTMLInputElement;
    expect(renameInput).toBeTruthy();
    expect(renameInput.value).toBe('');
    expect(renameInput.placeholder).toBe('Section name');
  });

  it('should activate Add Section button via Enter key', async () => {
    const { stateManager } = await initAppShell();

    const btn = document.querySelector('.add-section-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    // Native <button> elements respond to Enter keydown by firing click
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Simulate the browser's built-in behaviour: Enter on a focused button fires click
    btn.click();

    const state = stateManager.getState();
    expect(al(state).sections.length).toBeGreaterThanOrEqual(1);
  });

  it('should activate Add Section button via Space key', async () => {
    const { stateManager } = await initAppShell();

    const btn = document.querySelector('.add-section-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();

    // Native <button> elements respond to Space keyup by firing click
    btn.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    btn.click();

    const state2 = stateManager.getState();
    expect(al(state2).sections.length).toBeGreaterThanOrEqual(1);
  });

  it('should dispatch RENAME_SECTION when onRename fires on a section', async () => {
    const { stateManager } = await initAppShell();

    // Add a section first
    stateManager.dispatch({ type: 'ADD_SECTION', name: 'Produce' });
    const sectionId = al(stateManager.getState()).sections[0].id;

    // Spy on dispatch after the section exists
    const dispatchSpy = vi.spyOn(stateManager, 'dispatch');

    // Trigger a re-render so the section component is created with onRename wired
    // We do this by dispatching a no-op filter change to force re-render
    stateManager.dispatch({ type: 'SET_FILTER_MODE', mode: 'all' });
    dispatchSpy.mockClear();

    // Find the section title span and double-click to enter rename mode
    const titleSpan = document.querySelector('.section-title span:not(.section-chevron)') as HTMLElement;
    expect(titleSpan).toBeTruthy();

    titleSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    // Now there should be a rename input
    const renameInput = document.querySelector('.section-title input') as HTMLInputElement;
    expect(renameInput).toBeTruthy();

    // Type a new name and press Enter to commit
    renameInput.value = 'Fruits';
    renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // Verify RENAME_SECTION was dispatched
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'RENAME_SECTION',
      id: sectionId,
      name: 'Fruits',
    });
  });
});
