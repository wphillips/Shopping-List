---
description: Data model reference for AppState, Section, Item types and action definitions
inclusion: manual
---

# Data Model Reference

Full data model defined in `src/types.ts`.

#[[file:src/types.ts]]

## State Schema

```typescript
interface MultiListState {
  lists: GroceryList[];           // All grocery lists
  activeListId: string;           // Currently selected list ID
  filterMode: FilterMode;         // 'all' | 'checked' | 'unchecked'
  collapsedSections: Set<string>; // Section IDs that are collapsed
  version: number;                // Schema version (2)
}

interface GroceryList {
  id: string;
  name: string;
  sections: Section[];
  items: Item[];
  createdAt: number;
}
```

## Entity Relationships

- Each GroceryList contains its own sections and items
- Each Item belongs to exactly one Section via `sectionId`
- Deleting a Section cascades to delete all its Items
- Deleting a GroceryList removes all its sections and items
- `activeListId` references a GroceryList ID
- `collapsedSections` contains Section IDs (auto-managed by `computeCollapsedSections` after visibility-changing actions)
- Item/section actions are scoped to the active list

## Constraints

- Item.quantity >= 1 (enforced by decrement logic)
- Section.order is 0-indexed, unique per section
- All IDs are UUID v4 strings
- createdAt is a Unix timestamp (Date.now())

## Auto-Collapse Behavior

`collapsedSections` is automatically recomputed by the `computeCollapsedSections` pure function after actions that change item visibility: `SET_FILTER_MODE`, `TOGGLE_ITEM_CHECK`, `ADD_ITEM`, `DELETE_ITEM`, `MOVE_ITEM_TO_SECTION`. A section is collapsed when it has zero items matching the current `filterMode`. Under `'all'` filter, only truly empty sections (no items at all) collapse. `TOGGLE_SECTION_COLLAPSE` bypasses auto-collapse for manual override. The constructor also runs auto-collapse on initial load.

## Storage

- Key: `grocery-list-state` in localStorage
- v2 multi-list schema with `GroceryList` array
- `collapsedSections` serialized as Array, deserialized as Set
- State validated on load; falls back to default on corruption
- v1→v2 migration wraps single list into `GroceryList` array

## Default State

```typescript
{
  lists: [{ id: '...', name: 'My Grocery List', sections: [], items: [], createdAt: ... }],
  activeListId: '...',
  filterMode: 'all',
  collapsedSections: new Set(),
  version: 2,
}
```

## Action Types

```typescript
type Action =
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
  | { type: 'RENAME_SECTION'; id: string; name: string }
  | { type: 'CREATE_LIST'; name: string }
  | { type: 'DELETE_LIST'; listId: string }
  | { type: 'RENAME_LIST'; listId: string; name: string }
  | { type: 'SWITCH_LIST'; listId: string }
  | { type: 'IMPORT_LIST'; list: GroceryList };
```
