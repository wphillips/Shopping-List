/**
 * State management module for the Grocery List PWA
 * Handles application state, action dispatching, and state persistence
 * Operates on MultiListState — all item/section actions are scoped to the active list
 */

import { AppState, Section, Item, FilterMode, GroceryList, MultiListState } from './types';
import {
  saveMultiListState,
  loadMultiListState,
  createDefaultMultiListState,
  StorageQuotaExceededError,
} from './storage';

/**
 * Type definitions for all possible actions
 */
export type Action =
  | { type: 'ADD_SECTION'; name: string }
  | { type: 'DELETE_SECTION'; id: string }
  | { type: 'TOGGLE_SECTION_COLLAPSE'; id: string }
  | { type: 'MOVE_SECTION_UP'; id: string }
  | { type: 'MOVE_SECTION_DOWN'; id: string }
  | { type: 'ADD_ITEM'; name: string; sectionId: string }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'TOGGLE_ITEM_CHECK'; id: string }
  | { type: 'INCREMENT_QUANTITY'; id: string }
  | { type: 'DECREMENT_QUANTITY'; id: string }
  | { type: 'MOVE_ITEM_TO_SECTION'; itemId: string; targetSectionId: string }
  | { type: 'SET_FILTER_MODE'; mode: FilterMode }
  | { type: 'SET_SELECTED_SECTION'; sectionId: string | null }
  | { type: 'RENAME_SECTION'; id: string; name: string }
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'CREATE_LIST'; name: string }
  | { type: 'DELETE_LIST'; listId: string }
  | { type: 'RENAME_LIST'; listId: string; name: string }
  | { type: 'SWITCH_LIST'; listId: string }
  | { type: 'IMPORT_LIST'; list: GroceryList };

/**
 * Listener function type for state changes
 */
export type StateListener = (state: MultiListState) => void;

/**
 * Generate a unique ID (simple UUID v4 implementation)
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Compute which sections should be collapsed based on visible items.
 * A section is collapsed if it has zero items matching the current filterMode.
 */
export function computeCollapsedSections(
  sections: Section[],
  items: Item[],
  filterMode: FilterMode
): Set<string> {
  const collapsed = new Set<string>();
  for (const section of sections) {
    const sectionItems = items.filter(item => item.sectionId === section.id);
    const hasVisible = filterMode === 'all'
      ? sectionItems.length > 0
      : sectionItems.some(item =>
          filterMode === 'checked' ? item.isChecked : !item.isChecked
        );
    if (!hasVisible) {
      collapsed.add(section.id);
    }
  }
  return collapsed;
}

/**
 * Get the active list from a MultiListState
 */
function getActiveList(state: MultiListState): GroceryList | undefined {
  return state.lists.find(l => l.id === state.activeListId);
}

/**
 * Replace the active list in the state with an updated version
 */
function updateActiveList(state: MultiListState, updatedList: GroceryList): MultiListState {
  return {
    ...state,
    lists: state.lists.map(l => l.id === state.activeListId ? updatedList : l),
  };
}

/**
 * Pure reducer function that handles all actions on MultiListState.
 * Exported for direct testing.
 */
export function reducer(state: MultiListState, action: Action): MultiListState {
  let newState: MultiListState;

  switch (action.type) {
    // --- Multi-list actions ---
    case 'CREATE_LIST':
      newState = handleCreateList(state, action.name);
      break;

    case 'DELETE_LIST':
      newState = handleDeleteList(state, action.listId);
      break;

    case 'RENAME_LIST':
      newState = handleRenameList(state, action.listId, action.name);
      break;

    case 'SWITCH_LIST':
      newState = handleSwitchList(state, action.listId);
      break;

    case 'IMPORT_LIST':
      newState = handleImportList(state, action.list);
      break;

    // --- Actions scoped to the active list ---
    case 'ADD_SECTION':
      newState = scopedAction(state, list => handleAddSection(list, action.name));
      break;

    case 'DELETE_SECTION':
      newState = scopedAction(state, list => handleDeleteSection(list, action.id));
      // Also remove from collapsedSections
      newState = removeFromCollapsed(newState, action.id);
      break;

    case 'RENAME_SECTION':
      newState = scopedAction(state, list => handleRenameSection(list, action.id, action.name));
      break;

    case 'TOGGLE_SECTION_COLLAPSE': {
      const collapsed = new Set(state.collapsedSections);
      if (collapsed.has(action.id)) {
        collapsed.delete(action.id);
      } else {
        collapsed.add(action.id);
      }
      newState = { ...state, collapsedSections: collapsed };
      break;
    }

    case 'MOVE_SECTION_UP':
      newState = scopedAction(state, list => handleMoveSectionUp(list, action.id));
      break;

    case 'MOVE_SECTION_DOWN':
      newState = scopedAction(state, list => handleMoveSectionDown(list, action.id));
      break;

    case 'ADD_ITEM':
      newState = scopedAction(state, list => handleAddItem(list, action.name, action.sectionId));
      break;

    case 'DELETE_ITEM':
      newState = scopedAction(state, list => handleDeleteItem(list, action.id));
      break;

    case 'TOGGLE_ITEM_CHECK':
      newState = scopedAction(state, list => handleToggleItemCheck(list, action.id));
      break;

    case 'INCREMENT_QUANTITY':
      newState = scopedAction(state, list => handleIncrementQuantity(list, action.id));
      break;

    case 'DECREMENT_QUANTITY':
      newState = scopedAction(state, list => handleDecrementQuantity(list, action.id));
      break;

    case 'MOVE_ITEM_TO_SECTION':
      newState = scopedAction(state, list => handleMoveItemToSection(list, action.itemId, action.targetSectionId));
      break;

    case 'SET_FILTER_MODE':
      newState = { ...state, filterMode: action.mode };
      break;

    case 'SET_SELECTED_SECTION':
      // No-op in multi-list (kept for backward compat)
      newState = state;
      break;

    case 'LOAD_STATE':
      // Legacy: wrap AppState into the active list
      newState = handleLoadState(state, action.state);
      break;

    default:
      newState = state;
      break;
  }

  // Auto-collapse: recompute collapsedSections after visibility-changing actions
  const autoCollapseActions = [
    'SET_FILTER_MODE',
    'TOGGLE_ITEM_CHECK',
    'ADD_ITEM',
    'DELETE_ITEM',
    'MOVE_ITEM_TO_SECTION',
  ];
  if (autoCollapseActions.includes(action.type)) {
    const activeList = getActiveList(newState);
    if (activeList) {
      newState = {
        ...newState,
        collapsedSections: computeCollapsedSections(
          activeList.sections,
          activeList.items,
          newState.filterMode
        ),
      };
    }
  }

  return newState;
}

// ─── Helper: apply a transform to the active list ───

function scopedAction(
  state: MultiListState,
  transform: (list: GroceryList) => GroceryList
): MultiListState {
  const activeList = getActiveList(state);
  if (!activeList) return state;
  return updateActiveList(state, transform(activeList));
}

function removeFromCollapsed(state: MultiListState, sectionId: string): MultiListState {
  const collapsed = new Set(state.collapsedSections);
  collapsed.delete(sectionId);
  return { ...state, collapsedSections: collapsed };
}

// ─── Multi-list action handlers ───

function handleCreateList(state: MultiListState, name: string): MultiListState {
  const newList: GroceryList = {
    id: generateId(),
    name,
    sections: [],
    items: [],
    createdAt: Date.now(),
  };
  return {
    ...state,
    lists: [...state.lists, newList],
    activeListId: newList.id,
  };
}

function handleDeleteList(state: MultiListState, listId: string): MultiListState {
  const remaining = state.lists.filter(l => l.id !== listId);

  // If no lists remain, create a default
  if (remaining.length === 0) {
    const defaultList: GroceryList = {
      id: generateId(),
      name: 'My Grocery List',
      sections: [],
      items: [],
      createdAt: Date.now(),
    };
    return {
      ...state,
      lists: [defaultList],
      activeListId: defaultList.id,
      collapsedSections: new Set<string>(),
    };
  }

  // If the deleted list was active, fall back to the first remaining
  const newActiveId = state.activeListId === listId
    ? remaining[0].id
    : state.activeListId;

  return {
    ...state,
    lists: remaining,
    activeListId: newActiveId,
  };
}

function handleRenameList(state: MultiListState, listId: string, name: string): MultiListState {
  return {
    ...state,
    lists: state.lists.map(l => l.id === listId ? { ...l, name } : l),
  };
}

function handleSwitchList(state: MultiListState, listId: string): MultiListState {
  // Only switch if the list exists
  const exists = state.lists.some(l => l.id === listId);
  if (!exists) return state;
  return { ...state, activeListId: listId };
}

function handleImportList(state: MultiListState, list: GroceryList): MultiListState {
  return {
    ...state,
    lists: [...state.lists, list],
    activeListId: list.id,
  };
}

function handleLoadState(state: MultiListState, appState: AppState): MultiListState {
  const activeList = getActiveList(state);
  if (!activeList) return state;
  const updatedList: GroceryList = {
    ...activeList,
    sections: appState.sections,
    items: appState.items,
  };
  return {
    ...updateActiveList(state, updatedList),
    filterMode: appState.filterMode,
    collapsedSections: appState.collapsedSections,
  };
}

// ─── Section action handlers (operate on a single GroceryList) ───

function handleAddSection(list: GroceryList, name: string): GroceryList {
  const newSection: Section = {
    id: generateId(),
    name,
    order: list.sections.length,
    createdAt: Date.now(),
  };
  return { ...list, sections: [...list.sections, newSection] };
}

function handleDeleteSection(list: GroceryList, id: string): GroceryList {
  const sections = list.sections.filter(s => s.id !== id);
  const reorderedSections = sections.map((s, index) => ({ ...s, order: index }));
  const items = list.items.filter(item => item.sectionId !== id);
  return { ...list, sections: reorderedSections, items };
}

function handleRenameSection(list: GroceryList, id: string, name: string): GroceryList {
  const exists = list.sections.some(s => s.id === id);
  if (!exists) return list;
  return {
    ...list,
    sections: list.sections.map(s => s.id === id ? { ...s, name } : s),
  };
}

function handleMoveSectionUp(list: GroceryList, id: string): GroceryList {
  const index = list.sections.findIndex(s => s.id === id);
  if (index <= 0) return list;
  const sections = [...list.sections];
  [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
  const reordered = sections.map((s, i) => ({ ...s, order: i }));
  return { ...list, sections: reordered };
}

function handleMoveSectionDown(list: GroceryList, id: string): GroceryList {
  const index = list.sections.findIndex(s => s.id === id);
  if (index < 0 || index >= list.sections.length - 1) return list;
  const sections = [...list.sections];
  [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
  const reordered = sections.map((s, i) => ({ ...s, order: i }));
  return { ...list, sections: reordered };
}

// ─── Item action handlers (operate on a single GroceryList) ───

function handleAddItem(list: GroceryList, name: string, sectionId: string): GroceryList {
  const newItem: Item = {
    id: generateId(),
    name,
    quantity: 1,
    isChecked: false,
    sectionId,
    createdAt: Date.now(),
  };
  return { ...list, items: [...list.items, newItem] };
}

function handleDeleteItem(list: GroceryList, id: string): GroceryList {
  return { ...list, items: list.items.filter(item => item.id !== id) };
}

function handleToggleItemCheck(list: GroceryList, id: string): GroceryList {
  const targetIndex = list.items.findIndex(item => item.id === id);
  if (targetIndex === -1) return list;

  const targetItem = list.items[targetIndex];
  const toggledItem: Item = { ...targetItem, isChecked: !targetItem.isChecked };

  // If the item was previously unchecked (now checked): no reorder
  if (!targetItem.isChecked) {
    return {
      ...list,
      items: list.items.map(item => item.id === id ? toggledItem : item),
    };
  }

  // Item was previously checked (now unchecked): move after last unchecked item in its section
  const newItems = list.items.filter(item => item.id !== id);
  const firstCheckedInSection = newItems.findIndex(
    item => item.sectionId === targetItem.sectionId && item.isChecked
  );

  if (firstCheckedInSection !== -1) {
    newItems.splice(firstCheckedInSection, 0, toggledItem);
  } else {
    let lastSectionIndex = -1;
    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].sectionId === targetItem.sectionId) {
        lastSectionIndex = i;
      }
    }
    if (lastSectionIndex === -1) {
      newItems.push(toggledItem);
    } else {
      newItems.splice(lastSectionIndex + 1, 0, toggledItem);
    }
  }

  return { ...list, items: newItems };
}

function handleIncrementQuantity(list: GroceryList, id: string): GroceryList {
  return {
    ...list,
    items: list.items.map(item =>
      item.id === id ? { ...item, quantity: item.quantity + 1 } : item
    ),
  };
}

function handleDecrementQuantity(list: GroceryList, id: string): GroceryList {
  return {
    ...list,
    items: list.items.map(item =>
      item.id === id && item.quantity > 1
        ? { ...item, quantity: item.quantity - 1 }
        : item
    ),
  };
}

function handleMoveItemToSection(
  list: GroceryList,
  itemId: string,
  targetSectionId: string
): GroceryList {
  return {
    ...list,
    items: list.items.map(item =>
      item.id === itemId ? { ...item, sectionId: targetSectionId } : item
    ),
  };
}

// ─── Exported query helpers (scoped to active list) ───

/**
 * Get visible items from the active list based on filter mode
 */
export function getVisibleItems(state: MultiListState): Item[] {
  const activeList = getActiveList(state);
  if (!activeList) return [];

  const { items } = activeList;
  const { filterMode } = state;

  switch (filterMode) {
    case 'checked':
      return items.filter(item => item.isChecked);
    case 'unchecked':
      return items.filter(item => !item.isChecked);
    case 'all':
    default:
      return items;
  }
}

/**
 * Filter items by text search (case-insensitive), scoped to active list
 */
export function filterItemsByText(state: MultiListState, searchText: string): Item[] {
  if (!searchText || searchText.trim() === '') {
    return getVisibleItems(state);
  }

  const normalizedSearch = searchText.toLowerCase().trim();
  const visibleItems = getVisibleItems(state);

  return visibleItems.filter(item =>
    item.name.toLowerCase().includes(normalizedSearch)
  );
}

// ─── StateManager class ───

/**
 * StateManager class
 * Manages multi-list application state, handles actions, and notifies listeners.
 * Provides backward-compatible getState() that returns an AppState-like view
 * of the active list for existing UI code.
 */
export class StateManager {
  private state: MultiListState;
  private listeners: Set<StateListener> = new Set();
  private _onStorageError?: (error: StorageQuotaExceededError) => void;

  constructor(initialState?: MultiListState) {
    this.state = initialState || createDefaultMultiListState();

    // Auto-collapse on initial load
    const activeList = getActiveList(this.state);
    if (activeList) {
      this.state = {
        ...this.state,
        collapsedSections: computeCollapsedSections(
          activeList.sections,
          activeList.items,
          this.state.filterMode
        ),
      };
    }

    // Handle orphaned items in the active list
    if (activeList) {
      const sectionIds = new Set(activeList.sections.map(s => s.id));
      const orphanedItems = activeList.items.filter(item => !sectionIds.has(item.sectionId));

      if (orphanedItems.length > 0) {
        let sections = [...activeList.sections];
        let uncategorized = sections.find(s => s.name === 'Uncategorized');

        if (!uncategorized) {
          uncategorized = {
            id: generateId(),
            name: 'Uncategorized',
            order: sections.length,
            createdAt: Date.now(),
          };
          sections = [...sections, uncategorized];
        }

        const uncategorizedId = uncategorized.id;
        const orphanedIds = new Set(orphanedItems.map(item => item.id));
        const items = activeList.items.map(item =>
          orphanedIds.has(item.id) ? { ...item, sectionId: uncategorizedId } : item
        );

        console.warn(`Moved ${orphanedItems.length} orphaned item(s) to Uncategorized section`);

        const updatedList: GroceryList = { ...activeList, sections, items };
        this.state = updateActiveList(this.state, updatedList);
      }
    }
  }

  /**
   * Get the full multi-list state
   */
  getState(): Readonly<MultiListState> {
    return this.state;
  }

  /**
   * Set callback for storage quota exceeded errors
   */
  set onStorageError(callback: ((error: StorageQuotaExceededError) => void) | undefined) {
    this._onStorageError = callback;
  }

  /**
   * Get visible items based on current filter mode (scoped to active list)
   */
  getVisibleItems(): Item[] {
    return getVisibleItems(this.state);
  }

  /**
   * Filter items by text search (case-insensitive), scoped to active list
   */
  filterItemsByText(searchText: string): Item[] {
    return filterItemsByText(this.state, searchText);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Dispatch an action to update state
   */
  dispatch(action: Action): void {
    this.state = reducer(this.state, action);

    // Persist state after every modification
    try {
      saveMultiListState(this.state);
    } catch (error) {
      console.error('Failed to save state:', error);
      if (error instanceof StorageQuotaExceededError && this._onStorageError) {
        this._onStorageError(error);
      }
    }

    // Notify listeners for UI re-rendering
    this.notifyListeners();
  }
}

/**
 * Create and initialize the global state manager
 */
export function createStateManager(): StateManager {
  try {
    const loadedState = loadMultiListState();
    return new StateManager(loadedState);
  } catch (error) {
    console.error('Failed to load state, using default:', error);
    return new StateManager();
  }
}
