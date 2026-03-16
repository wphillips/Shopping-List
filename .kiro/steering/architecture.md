---
description: Architecture guidelines covering tech stack, project structure, state management, and component patterns
inclusion: auto
---

# Architecture Guidelines

## Overview

This is a Progressive Web App (PWA) built with TypeScript, Vite, and vanilla JavaScript components. The architecture follows a component-based pattern with centralized state management and localStorage persistence.

## Tech Stack

- **Build Tool**: Vite 8.x
- **Language**: TypeScript 5.x (strict mode enabled)
- **Testing**: Vitest with jsdom environment
- **Property-Based Testing**: fast-check 4.x
- **PWA**: Custom service worker with cache-first strategy
- **Styling**: Vanilla CSS with dark theme
- **Dependencies**: lz-string (URL-safe compression for list sharing)
- **State Management**: Custom StateManager with action dispatching pattern (multi-list)

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── FilterControl.ts
│   ├── InputField.ts
│   ├── Item.ts
│   ├── ListSelector.ts # Dropdown-based list switcher
│   └── Section.ts
├── styles/
│   └── main.css        # Global styles
├── forceUpdate.ts       # Force-update utility (SW update + cache clear + reload)
├── import-controller.ts # URL import detection and decoding
├── index.ts             # AppShell — main orchestrator
├── serializer.ts        # List serialization/deserialization for sharing
├── share-controller.ts  # Web Share API + clipboard fallback
├── state.ts             # StateManager and action types (multi-list)
├── storage.ts           # localStorage persistence layer (v2 multi-list, v1→v2 migration)
├── types.ts             # Core data model interfaces
└── url-codec.ts         # lz-string URL encoding/decoding

tests/                   # Unit, integration, and property-based tests
public/                  # Static assets (icons, manifest, service worker)
vite-plugin-sw-cache-version.ts  # Custom Vite plugin for SW cache versioning
```

## Hosting

Static site hosted on S3 with CloudFront for HTTPS. The `dist/` output from Vite is deployed directly — no server-side runtime required.

## Core Architecture Patterns

### 1. Component-Based Architecture

All UI components follow a consistent class-based pattern:

```typescript
export class ComponentName {
  private element: HTMLElement;
  private config: ComponentConfig;

  constructor(config: ComponentConfig) {
    this.config = config;
    this.element = this.createElement();
    this.attachEventListeners();
  }

  private createElement(): HTMLElement { /* ... */ }
  private attachEventListeners(): void { /* ... */ }
  getElement(): HTMLElement { return this.element; }
}
```

**Key principles:**
- Components own their DOM elements
- Configuration passed via constructor
- Callbacks for parent communication
- No direct DOM manipulation outside component classes

### 2. Centralized State Management

The `StateManager` class provides Redux-like state management over `MultiListState`:

```typescript
// Action dispatching
stateManager.dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId: '...' });
stateManager.dispatch({ type: 'CREATE_LIST', name: 'Party Supplies' });
stateManager.dispatch({ type: 'SWITCH_LIST', listId: '...' });

// State subscription
stateManager.subscribe((state: MultiListState) => {
  // React to state changes
});
```

**State flow:**
1. User interaction triggers callback
2. AppShell dispatches action to StateManager
3. StateManager reduces action to new state (scoped to active list for item/section actions)
4. Auto-collapse engine recomputes `collapsedSections` if the action affects item visibility
5. StateManager notifies all subscribers
6. AppShell re-renders affected components

### 3. Persistence Layer

The `storage.ts` module handles all localStorage operations:

- **Automatic serialization**: Converts Sets to Arrays for JSON
- **Validation**: Validates loaded state structure
- **Error handling**: Graceful fallback to default state on corruption
- **Version management**: v2 multi-list schema with v1→v2 migration
- **Multi-list support**: `loadMultiListState` / `saveMultiListState` for the v2 format

### 4. AppShell Orchestration

The `AppShell` class in `src/index.ts` is the main application orchestrator:

- Creates and mounts all components (ListSelector, InputField, FilterControl, Share button)
- Subscribes to state changes
- Handles all user interactions
- Coordinates rendering logic scoped to the active list
- Manages component lifecycle
- Stores the `ServiceWorkerRegistration` and wires the Force Update button
- Handles list sharing (serialize → encode → share/clipboard)
- Handles list import on page load (detect URL param → decode → confirm → dispatch)

### 5. Force Update Utility

The `forceUpdate` function in `src/forceUpdate.ts` is a pure-logic module extracted for testability:

- Accepts dependencies via `ForceUpdateDeps` (registration, caches, reload) for easy mocking
- Orchestrates: update check → cache clear → reload
- Returns a `ForceUpdateResult` with status (`reloading`, `up-to-date`, `unsupported`, `error`)
- Handles errors at each phase independently so a failure in one phase does not block subsequent phases

## Data Model

### Core Entities

**GroceryList**: A named grocery list containing sections and items
- `id`: UUID string
- `name`: User-defined label
- `sections`: Array of Section objects
- `items`: Array of Item objects
- `createdAt`: Timestamp

**Section**: Categorized grouping of items
- `id`: UUID string
- `name`: User-defined label
- `order`: Position in list (0-indexed)
- `createdAt`: Timestamp

**Item**: Individual grocery product
- `id`: UUID string
- `name`: Product name
- `quantity`: Number of units (minimum 1)
- `isChecked`: Purchase status
- `sectionId`: Parent section reference
- `createdAt`: Timestamp

**MultiListState**: Complete application state (v2)
- `lists`: Array of GroceryList objects
- `activeListId`: Currently selected list ID
- `filterMode`: 'all' | 'checked' | 'unchecked'
- `collapsedSections`: Set of collapsed section IDs
- `version`: Schema version number (2)

### 6. Sharing Pipeline

Four pure-logic modules handle zero-backend list sharing via URL:

- **serializer.ts**: Converts `GroceryList` ↔ portable JSON (no IDs/timestamps)
- **url-codec.ts**: Compresses JSON via lz-string into a URL query parameter (`?list=...`)
- **share-controller.ts**: Uses Web Share API with clipboard fallback (dependency-injected)
- **import-controller.ts**: Detects `?list=` on page load, decodes, returns result for AppShell to handle

All modules accept dependencies via parameters for full testability without mocks.

### 7. Auto-Collapse Engine

The `computeCollapsedSections` pure function in `src/state.ts` automatically collapses sections with zero visible items under the current filter mode. It runs:

- Inside the reducer after `SET_FILTER_MODE`, `TOGGLE_ITEM_CHECK`, `ADD_ITEM`, `DELETE_ITEM`, and `MOVE_ITEM_TO_SECTION`
- In the `StateManager` constructor on initial load

It does NOT run after `TOGGLE_SECTION_COLLAPSE` (manual override), `ADD_SECTION`, `DELETE_SECTION`, `RENAME_SECTION`, or section reorder actions. Manual toggles are respected until the next visibility-changing action.

## Component Communication

Components communicate through callbacks, never directly:

```typescript
// Parent creates component with callbacks
const item = new Item({
  id: item.id,
  name: item.name,
  onToggleCheck: () => this.handleItemToggleCheck(item.id),
  onDelete: () => this.handleItemDelete(item.id),
});

// Parent handles callback and dispatches action
private handleItemDelete(itemId: string): void {
  this.stateManager.dispatch({ type: 'DELETE_ITEM', id: itemId });
}
```

## Rendering Strategy

The app uses a full re-render approach on state changes:

1. State changes trigger `handleStateChange()`
2. `render()` clears and rebuilds the entire sections container
3. Components are recreated from current state
4. Event listeners are reattached

**Trade-offs:**
- Simple and predictable
- No complex diffing logic
- Acceptable performance for this app size
- Consider virtual DOM if performance becomes an issue

## Service Worker Strategy

Custom service worker with cache-first strategy:

- Caches all app resources on install
- Serves from cache when available
- Falls back to network if not cached
- Enables full offline functionality

## Testing Strategy

### Unit Tests
- Test individual components in isolation
- Mock dependencies and callbacks
- Focus on component behavior and edge cases

### Integration Tests
- Test component interactions
- Test state management flows
- Verify persistence layer

### Property-Based Tests
- Use fast-check for state invariants
- Test action sequences for correctness
- Validate state transitions maintain consistency

## TypeScript Configuration

Strict mode enabled with:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

Target: ES2020 with DOM libraries
Module resolution: bundler mode (Vite)
