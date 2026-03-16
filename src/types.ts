/**
 * Data model interfaces for the Grocery List PWA
 * Defines the core types for application state, sections, items, and drag-and-drop operations
 */

/**
 * Filter mode for controlling item visibility
 * - 'all': Show all items regardless of checked state
 * - 'checked': Show only checked items
 * - 'unchecked': Show only unchecked items
 */
export type FilterMode = 'all' | 'checked' | 'unchecked';

/**
 * Section interface representing a categorized grouping of grocery items
 */
export interface Section {
  /** Unique identifier (UUID) */
  id: string;
  /** User-defined section name (e.g., "Produce", "Dairy") */
  name: string;
  /** Position in the section list (0-indexed) */
  order: number;
  /** Timestamp when the section was created */
  createdAt: number;
}

/**
 * Item interface representing an individual grocery product
 */
export interface Item {
  /** Unique identifier (UUID) */
  id: string;
  /** Item name (e.g., "Apples") */
  name: string;
  /** Number of units needed (minimum 1) */
  quantity: number;
  /** Whether the item has been purchased/checked off */
  isChecked: boolean;
  /** ID of the parent section */
  sectionId: string;
  /** Timestamp when the item was created */
  createdAt: number;
}

/**
 * Application state interface containing all app data
 */
export interface AppState {
  /** Array of all sections */
  sections: Section[];
  /** Array of all items */
  items: Item[];
  /** Current filter mode for item visibility */
  filterMode: FilterMode;
  /** Set of section IDs that are currently collapsed */
  collapsedSections: Set<string>;
  /** ID of the currently selected section for adding new items */
  selectedSectionId: string | null;
  /** Schema version for data migration */
  version: number;
}

/**
 * A named grocery list containing sections and items
 */
export interface GroceryList {
  /** Unique identifier (UUID) */
  id: string;
  /** User-defined list name (e.g., "Weekly Groceries") */
  name: string;
  /** Array of all sections in this list */
  sections: Section[];
  /** Array of all items in this list */
  items: Item[];
  /** Timestamp when the list was created */
  createdAt: number;
}

/**
 * Top-level multi-list application state
 */
export interface MultiListState {
  /** Array of all grocery lists */
  lists: GroceryList[];
  /** ID of the currently active list */
  activeListId: string;
  /** Current filter mode for item visibility */
  filterMode: FilterMode;
  /** Set of section IDs that are currently collapsed */
  collapsedSections: Set<string>;
  /** Schema version for data migration (2) */
  version: number;
}

/**
 * Drag data interface for drag-and-drop operations between sections
 */
export interface DragData {
  /** ID of the item being dragged */
  itemId: string;
  /** ID of the section the item is being dragged from */
  sourceSectionId: string;
}
