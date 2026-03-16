---
description: Step-by-step guide for adding new features to the Grocery List PWA
inclusion: manual
---

# Feature Implementation Guide

Step-by-step guide for adding new features to the Grocery List PWA.

## 1. Define Requirements

Document requirements in `.kiro/specs/` following the existing format:
- User story
- Acceptance criteria
- Correctness properties (for property-based testing)

## 2. Update Type Definitions

Add or modify types in `src/types.ts`:

```typescript
export interface NewFeature {
  id: string;
  property: string;
}

// Update MultiListState or GroceryList if needed
export interface MultiListState {
  lists: GroceryList[];
  activeListId: string;
  // ... existing properties
}
```

## 3. Add State Actions

Update `src/state.ts`:

```typescript
export type Action =
  | { type: 'EXISTING_ACTION'; /* ... */ }
  | { type: 'NEW_ACTION'; property: string };

// Add handler in reducer — note: item/section actions are scoped to active list
private reduce(state: MultiListState, action: Action): MultiListState {
  switch (action.type) {
    case 'NEW_ACTION':
      return this.handleNewAction(state, action.property);
  }
}
```

## 4. Update Storage Layer

If state structure changes, update `src/storage.ts`:

```typescript
function validateV2State(data: any): void {
  // Add validation for new fields
  if (!Array.isArray(data.newFeature)) {
    throw new StateValidationError('newFeature must be an array');
  }
}

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
```

## 5. Create or Update Components

Add new component in `src/components/`:

```typescript
export interface NewComponentConfig {
  id: string;
  onAction: (id: string) => void;
}

export class NewComponent {
  private element: HTMLElement;
  private config: NewComponentConfig;

  constructor(config: NewComponentConfig) {
    this.config = config;
    this.element = this.createElement();
    this.attachEventListeners();
  }

  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'new-component';
    return element;
  }

  private attachEventListeners(): void { /* ... */ }
  getElement(): HTMLElement { return this.element; }
}
```

## 6. Integrate in AppShell

Update `src/index.ts`:

```typescript
class AppShell {
  private newComponent: NewComponent;

  constructor(appContainer: HTMLElement) {
    this.newComponent = new NewComponent({
      id: 'new-component',
      onAction: this.handleNewAction.bind(this),
    });
    this.mountNewComponent();
  }

  private handleNewAction(id: string): void {
    this.stateManager.dispatch({ type: 'NEW_ACTION', property: id });
  }
}
```

> **Note:** If your feature adds, deletes, or moves items, or changes filter mode, the auto-collapse engine in `StateManager.reduce` will automatically recompute `collapsedSections`. No extra wiring needed — just dispatch the action and the reducer handles it.
```

## 7. Add Styles

Update `src/styles/main.css`:

```css
.new-component {
  /* Component styles */
}
```

## 8. Write Tests

Create test file in `tests/`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NewComponent } from '../src/components/NewComponent';

describe('NewComponent', () => {
  it('should render correctly', () => {
    const component = new NewComponent({ id: 'test', onAction: vi.fn() });
    expect(component.getElement()).toBeDefined();
  });

  it('should call onAction when action is triggered', () => {
    const onAction = vi.fn();
    const component = new NewComponent({ id: 'test', onAction });
    // Trigger action...
    expect(onAction).toHaveBeenCalledWith('test');
  });
});
```
