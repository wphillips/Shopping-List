/**
 * Storage module for persisting application state to localStorage
 * Handles serialization, deserialization, validation, and error scenarios
 */

import { AppState, Section, Item, GroceryList, MultiListState } from './types';

const STORAGE_KEY = 'grocery-list-state';
const CURRENT_VERSION = 1;

/**
 * Error thrown when localStorage is unavailable (e.g., private browsing mode)
 */
export class StorageUnavailableError extends Error {
  constructor(message: string = 'localStorage is unavailable') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

/**
 * Error thrown when storage quota is exceeded
 */
export class StorageQuotaExceededError extends Error {
  constructor(message: string = 'Storage quota exceeded') {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

/**
 * Error thrown when stored state is corrupted or invalid
 */
export class StateValidationError extends Error {
  constructor(message: string = 'State validation failed') {
    super(message);
    this.name = 'StateValidationError';
  }
}

/**
 * Check if localStorage is available
 * @returns true if localStorage is available, false otherwise
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Validate that a value is a valid Section object
 */
function isValidSection(obj: any): obj is Section {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.order === 'number' &&
    typeof obj.createdAt === 'number'
  );
}

/**
 * Validate that a value is a valid Item object
 */
function isValidItem(obj: any): obj is Item {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.quantity === 'number' &&
    obj.quantity >= 1 &&
    typeof obj.isChecked === 'boolean' &&
    typeof obj.sectionId === 'string' &&
    typeof obj.createdAt === 'number'
  );
}

/**
 * Validate the structure of stored state
 * @param data - The parsed JSON data from localStorage
 * @throws StateValidationError if validation fails
 */
function validateState(data: any): void {
  if (typeof data !== 'object' || data === null) {
    throw new StateValidationError('State must be an object');
  }

  if (typeof data.version !== 'number') {
    throw new StateValidationError('State version must be a number');
  }

  if (!Array.isArray(data.sections)) {
    throw new StateValidationError('State sections must be an array');
  }

  if (!Array.isArray(data.items)) {
    throw new StateValidationError('State items must be an array');
  }

  // Validate each section
  for (let i = 0; i < data.sections.length; i++) {
    if (!isValidSection(data.sections[i])) {
      throw new StateValidationError(`Invalid section at index ${i}`);
    }
  }

  // Validate each item
  for (let i = 0; i < data.items.length; i++) {
    if (!isValidItem(data.items[i])) {
      throw new StateValidationError(`Invalid item at index ${i}`);
    }
  }

  if (
    data.filterMode !== 'all' &&
    data.filterMode !== 'checked' &&
    data.filterMode !== 'unchecked'
  ) {
    throw new StateValidationError('Invalid filterMode value');
  }

  if (!Array.isArray(data.collapsedSections)) {
    throw new StateValidationError('collapsedSections must be an array');
  }

  if (data.selectedSectionId !== null && typeof data.selectedSectionId !== 'string') {
    throw new StateValidationError('selectedSectionId must be string or null');
  }
}

/**
 * Create a default empty application state
 * @returns A new AppState with default values
 */
export function createDefaultState(): AppState {
  return {
    sections: [],
    items: [],
    filterMode: 'all',
    collapsedSections: new Set<string>(),
    selectedSectionId: null,
    version: CURRENT_VERSION,
  };
}

/**
 * Serialize and save application state to localStorage
 * @param state - The application state to save
 * @throws StorageUnavailableError if localStorage is not available
 * @throws StorageQuotaExceededError if storage quota is exceeded
 */
export function saveState(state: AppState): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageUnavailableError();
  }

  try {
    // Convert Set to Array for JSON serialization
    const serializable = {
      ...state,
      collapsedSections: Array.from(state.collapsedSections),
    };

    const json = JSON.stringify(serializable);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e: any) {
    // Check if it's a quota exceeded error
    if (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    ) {
      throw new StorageQuotaExceededError();
    }
    throw e;
  }
}

/**
 * Load and deserialize application state from localStorage
 * @returns The loaded AppState, or a default state if none exists or validation fails
 * @throws StorageUnavailableError if localStorage is not available
 */
export function loadState(): AppState {
  if (!isLocalStorageAvailable()) {
    throw new StorageUnavailableError();
  }

  try {
    const json = localStorage.getItem(STORAGE_KEY);

    // No saved state, return default
    if (json === null) {
      return createDefaultState();
    }

    const data = JSON.parse(json);

    // Validate the loaded state
    validateState(data);

    // Convert collapsedSections array back to Set
    const state: AppState = {
      ...data,
      collapsedSections: new Set<string>(data.collapsedSections),
    };

    return state;
  } catch (e) {
    if (e instanceof StateValidationError) {
      // State is corrupted, return default state
      console.warn('State validation failed, returning default state:', e.message);
      return createDefaultState();
    }
    throw e;
  }
}

/**
 * Clear all stored state from localStorage
 * @throws StorageUnavailableError if localStorage is not available
 */
export function clearState(): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageUnavailableError();
  }

  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Generate a unique ID (UUID v4)
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate that a value is a valid GroceryList object
 */
function isValidGroceryList(obj: any): obj is GroceryList {
  if (typeof obj !== 'object' || obj === null) return false;
  if (typeof obj.id !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.createdAt !== 'number') return false;
  if (!Array.isArray(obj.sections)) return false;
  if (!Array.isArray(obj.items)) return false;

  for (const section of obj.sections) {
    if (!isValidSection(section)) return false;
  }
  for (const item of obj.items) {
    if (!isValidItem(item)) return false;
  }

  return true;
}

/**
 * Validate a section with relaxed rules for the load/recovery path.
 * Tolerates missing createdAt by providing a default.
 */
function isValidSectionForLoad(obj: any): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.order === 'number'
  );
}

/**
 * Validate an item with relaxed rules for the load/recovery path.
 * Tolerates quantity < 1 (will be clamped to 1 during recovery).
 */
function isValidItemForLoad(obj: any): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.quantity === 'number' &&
    typeof obj.isChecked === 'boolean' &&
    typeof obj.sectionId === 'string' &&
    typeof obj.createdAt === 'number'
  );
}

/**
 * Attempt to recover a single GroceryList from raw data using relaxed validation.
 * Clamps item quantities to Math.max(1, quantity) and provides default createdAt for sections.
 * Returns the recovered list, or null if the list is too corrupted to recover.
 */
function tryRecoverList(obj: any): GroceryList | null {
  if (typeof obj !== 'object' || obj === null) return null;
  if (typeof obj.id !== 'string') return null;
  if (typeof obj.name !== 'string') return null;
  if (typeof obj.createdAt !== 'number') return null;
  if (!Array.isArray(obj.sections)) return null;
  if (!Array.isArray(obj.items)) return null;

  // Recover sections: keep valid ones, provide default createdAt if missing
  const recoveredSections: Section[] = [];
  for (const section of obj.sections) {
    if (isValidSection(section)) {
      recoveredSections.push(section);
    } else if (isValidSectionForLoad(section)) {
      recoveredSections.push({
        ...section,
        createdAt: typeof section.createdAt === 'number' ? section.createdAt : Date.now(),
      });
    }
    // Skip sections that are too corrupted
  }

  // Recover items: keep valid ones, clamp quantity to Math.max(1, quantity)
  const sectionIds = new Set(recoveredSections.map(s => s.id));
  const recoveredItems: Item[] = [];
  for (const item of obj.items) {
    if (isValidItem(item)) {
      recoveredItems.push(item);
    } else if (isValidItemForLoad(item)) {
      recoveredItems.push({
        ...item,
        quantity: Math.max(1, item.quantity),
      });
    }
    // Skip items that are too corrupted
  }

  // Filter out items whose sectionId doesn't reference a recovered section
  const validItems = recoveredItems.filter(item => sectionIds.has(item.sectionId));

  return {
    id: obj.id,
    name: obj.name,
    sections: recoveredSections,
    items: validItems,
    createdAt: obj.createdAt,
  };
}

/**
 * Attempt partial recovery of v2 state when strict validation fails.
 * Iterates over data.lists, recovers individually valid lists, and
 * returns a MultiListState with the surviving lists.
 * Returns null if zero lists survive recovery.
 */
function tryRecoverV2State(data: any): MultiListState | null {
  if (typeof data !== 'object' || data === null) return null;
  if (!Array.isArray(data.lists)) return null;

  const recoveredLists: GroceryList[] = [];
  let discardedCount = 0;

  for (const rawList of data.lists) {
    const recovered = tryRecoverList(rawList);
    if (recovered) {
      recoveredLists.push(recovered);
    } else {
      discardedCount++;
    }
  }

  if (recoveredLists.length === 0) {
    console.warn(`Partial recovery failed: all ${discardedCount} lists were too corrupted to recover`);
    return null;
  }

  // Determine filterMode
  const filterMode =
    data.filterMode === 'all' || data.filterMode === 'checked' || data.filterMode === 'unchecked'
      ? data.filterMode
      : 'all';

  // Determine collapsedSections
  const collapsedSections = Array.isArray(data.collapsedSections)
    ? new Set<string>(data.collapsedSections)
    : new Set<string>();

  // Fix activeListId: if it doesn't reference a surviving list, use the first one
  const survivingIds = new Set(recoveredLists.map(l => l.id));
  const activeListId =
    typeof data.activeListId === 'string' && survivingIds.has(data.activeListId)
      ? data.activeListId
      : recoveredLists[0].id;

  console.warn(
    `Partial recovery: recovered ${recoveredLists.length} list(s), discarded ${discardedCount} corrupted list(s)`
  );

  return {
    lists: recoveredLists,
    activeListId,
    filterMode,
    collapsedSections,
    version: 2,
  };
}

/**
 * Validate the structure of a v2 MultiListState (serialized form with arrays)
 * @throws StateValidationError if validation fails
 */
function validateV2State(data: any): void {
  if (typeof data !== 'object' || data === null) {
    throw new StateValidationError('State must be an object');
  }

  if (data.version !== 2) {
    throw new StateValidationError('State version must be 2');
  }

  if (!Array.isArray(data.lists)) {
    throw new StateValidationError('State lists must be an array');
  }

  if (data.lists.length === 0) {
    throw new StateValidationError('State must have at least one list');
  }

  for (let i = 0; i < data.lists.length; i++) {
    if (!isValidGroceryList(data.lists[i])) {
      throw new StateValidationError(`Invalid list at index ${i}`);
    }
  }

  if (typeof data.activeListId !== 'string') {
    throw new StateValidationError('activeListId must be a string');
  }

  // Verify activeListId references an existing list
  const listIds = data.lists.map((l: any) => l.id);
  if (!listIds.includes(data.activeListId)) {
    throw new StateValidationError('activeListId does not reference an existing list');
  }

  if (
    data.filterMode !== 'all' &&
    data.filterMode !== 'checked' &&
    data.filterMode !== 'unchecked'
  ) {
    throw new StateValidationError('Invalid filterMode value');
  }

  if (!Array.isArray(data.collapsedSections)) {
    throw new StateValidationError('collapsedSections must be an array');
  }
}

/**
 * Create a default empty multi-list state (v2)
 * @returns A new MultiListState with one empty list
 */
export function createDefaultMultiListState(): MultiListState {
  const listId = generateId();
  return {
    lists: [{
      id: listId,
      name: 'My Grocery List',
      sections: [],
      items: [],
      createdAt: Date.now(),
    }],
    activeListId: listId,
    filterMode: 'all',
    collapsedSections: new Set<string>(),
    version: 2,
  };
}

/**
 * Migrate a v1 AppState to a v2 MultiListState
 * Wraps the existing single-list data into a GroceryList inside MultiListState
 * @param v1Data - The v1 state data (parsed JSON)
 * @returns A new MultiListState containing the migrated data
 */
export function migrateV1ToV2(v1Data: any): MultiListState {
  const listId = generateId();
  return {
    lists: [{
      id: listId,
      name: 'My Grocery List',
      sections: v1Data.sections ?? [],
      items: v1Data.items ?? [],
      createdAt: Date.now(),
    }],
    activeListId: listId,
    filterMode: v1Data.filterMode ?? 'all',
    collapsedSections: new Set<string>(v1Data.collapsedSections ?? []),
    version: 2,
  };
}

/**
 * Serialize and save multi-list state to localStorage
 * @param state - The multi-list state to save
 * @throws StorageUnavailableError if localStorage is not available
 * @throws StorageQuotaExceededError if storage quota is exceeded
 */
export function saveMultiListState(state: MultiListState): void {
  if (!isLocalStorageAvailable()) {
    throw new StorageUnavailableError();
  }

  try {
    const serializable = {
      ...state,
      collapsedSections: Array.from(state.collapsedSections),
    };

    const json = JSON.stringify(serializable);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e: any) {
    if (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014
    ) {
      throw new StorageQuotaExceededError();
    }
    throw e;
  }
}

/**
 * Load and deserialize multi-list state from localStorage
 * Handles version detection and migration:
 * - Missing or version 1 → migrate v1 to v2
 * - Version 2 → load directly
 * - Invalid → return default state
 * @returns The loaded MultiListState
 * @throws StorageUnavailableError if localStorage is not available
 */
export function loadMultiListState(): MultiListState {
  if (!isLocalStorageAvailable()) {
    throw new StorageUnavailableError();
  }

  try {
    const json = localStorage.getItem(STORAGE_KEY);

    // No saved state, return default
    if (json === null) {
      return createDefaultMultiListState();
    }

    const data = JSON.parse(json);

    if (typeof data !== 'object' || data === null) {
      console.warn('Stored state is not an object, returning default state');
      return createDefaultMultiListState();
    }

    const version = data.version;

    // Missing version or version 1 → migrate
    if (version === undefined || version === 1) {
      try {
        // Validate v1 structure before migrating
        validateState(data);
        return migrateV1ToV2(data);
      } catch (e) {
        console.warn('V1 state validation failed during migration, returning default state:', e);
        return createDefaultMultiListState();
      }
    }

    // Version 2 → validate and load directly
    if (version === 2) {
      try {
        validateV2State(data);
        return {
          ...data,
          collapsedSections: new Set<string>(data.collapsedSections),
        };
      } catch (e) {
        // Strict validation failed — attempt partial recovery of individual lists
        console.warn('V2 state strict validation failed, attempting partial recovery:', e);
        const recovered = tryRecoverV2State(data);
        if (recovered) {
          return recovered;
        }
        return createDefaultMultiListState();
      }
    }

    // Invalid version → default state
    console.warn(`Unknown state version: ${version}, returning default state`);
    return createDefaultMultiListState();
  } catch (e) {
    if (e instanceof StorageUnavailableError) {
      throw e;
    }
    console.warn('Failed to load multi-list state, returning default state:', e);
    return createDefaultMultiListState();
  }
}
