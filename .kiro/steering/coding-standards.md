---
description: Coding standards for TypeScript, naming conventions, and code style
inclusion: auto
---

# Coding Standards

## TypeScript Guidelines

### Strict Type Safety

Always leverage TypeScript's strict mode:

```typescript
// ✅ Good - Explicit types
function addItem(name: string, sectionId: string): void {
  // ...
}

// ❌ Bad - Implicit any
function addItem(name, sectionId) {
  // ...
}
```

### Interface Over Type for Objects

Use `interface` for object shapes, `type` for unions and primitives:

```typescript
// ✅ Good
export interface Item {
  id: string;
  name: string;
  quantity: number;
}

export type FilterMode = 'all' | 'checked' | 'unchecked';

// ❌ Bad
export type Item = {
  id: string;
  name: string;
  quantity: number;
};
```

### Readonly State

State should be immutable from consumer perspective:

```typescript
// ✅ Good
getState(): Readonly<AppState> {
  return this.state;
}

// ❌ Bad - Allows external mutation
getState(): AppState {
  return this.state;
}
```

## Component Patterns

### Component Structure

All components follow this structure:

```typescript
export interface ComponentConfig {
  // Configuration properties
  id: string;
  name: string;
  // Callbacks for parent communication
  onAction: () => void;
}

export class Component {
  private element: HTMLElement;
  private config: ComponentConfig;

  constructor(config: ComponentConfig) {
    this.config = config;
    this.element = this.createElement();
    this.attachEventListeners();
  }

  private createElement(): HTMLElement {
    // Create and return DOM element
  }

  private attachEventListeners(): void {
    // Attach event listeners
  }

  getElement(): HTMLElement {
    return this.element;
  }
}
```

### Private by Default

Make methods and properties private unless they need to be public:

```typescript
// ✅ Good
export class InputField {
  private element: HTMLInputElement;
  private config: InputFieldConfig;

  constructor(config: InputFieldConfig) { /* ... */ }

  private createElement(): HTMLInputElement { /* ... */ }
  private attachEventListeners(): void { /* ... */ }

  // Only expose what's needed
  getElement(): HTMLInputElement { return this.element; }
  getValue(): string { return this.element.value; }
}
```

### Event Handling

Use arrow functions for event handlers to preserve `this` context:

```typescript
// ✅ Good
private attachEventListeners(): void {
  this.element.addEventListener('click', () => {
    this.handleClick();
  });
}

// ❌ Bad - loses 'this' context
private attachEventListeners(): void {
  this.element.addEventListener('click', this.handleClick);
}
```

## State Management Patterns

### Action Types

Define all actions as discriminated unions:

```typescript
export type Action =
  | { type: 'ADD_ITEM'; name: string; sectionId: string }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'TOGGLE_ITEM_CHECK'; id: string };
```

### Immutable State Updates

Always return new state objects, never mutate:

```typescript
// ✅ Good - Immutable update
private handleAddItem(state: AppState, name: string, sectionId: string): AppState {
  const newItem: Item = {
    id: generateId(),
    name,
    quantity: 1,
    isChecked: false,
    sectionId,
    createdAt: Date.now(),
  };

  return {
    ...state,
    items: [...state.items, newItem],
  };
}

// ❌ Bad - Mutates state
private handleAddItem(state: AppState, name: string, sectionId: string): AppState {
  state.items.push(newItem);
  return state;
}
```

### State Validation

Validate state at boundaries (loading from storage):

```typescript
function validateState(data: any): void {
  if (typeof data !== 'object' || data === null) {
    throw new StateValidationError('State must be an object');
  }
  
  if (!Array.isArray(data.sections)) {
    throw new StateValidationError('State sections must be an array');
  }
  
  // Validate each section
  for (let i = 0; i < data.sections.length; i++) {
    if (!isValidSection(data.sections[i])) {
      throw new StateValidationError(`Invalid section at index ${i}`);
    }
  }
}
```

## Naming Conventions

### Variables and Functions

- Use camelCase for variables and functions
- Use descriptive names that indicate purpose
- Boolean variables should start with `is`, `has`, `should`

```typescript
// ✅ Good
const selectedSectionId = state.selectedSectionId;
const isCollapsed = state.collapsedSections.has(sectionId);
const hasItems = items.length > 0;

function handleItemToggleCheck(itemId: string): void { /* ... */ }

// ❌ Bad
const id = state.selectedSectionId;
const collapsed = state.collapsedSections.has(sectionId);
const items_exist = items.length > 0;

function toggle(id: string): void { /* ... */ }
```

### Classes and Interfaces

- Use PascalCase for classes and interfaces
- Interface names should describe the shape, not implementation

```typescript
// ✅ Good
export interface InputFieldConfig { /* ... */ }
export class InputField { /* ... */ }

// ❌ Bad
export interface IInputFieldConfig { /* ... */ }
export class inputField { /* ... */ }
```

### Constants

Use UPPER_SNAKE_CASE for true constants:

```typescript
const STORAGE_KEY = 'grocery-list-state';
const CURRENT_VERSION = 1;
const MIN_QUANTITY = 1;
```

## Error Handling

### Custom Error Classes

Create specific error types for different failure modes:

```typescript
export class StorageUnavailableError extends Error {
  constructor(message: string = 'localStorage is unavailable') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export class StateValidationError extends Error {
  constructor(message: string = 'State validation failed') {
    super(message);
    this.name = 'StateValidationError';
  }
}
```

### Graceful Degradation

Handle errors gracefully with fallbacks:

```typescript
export function loadState(): AppState {
  if (!isLocalStorageAvailable()) {
    throw new StorageUnavailableError();
  }

  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json === null) {
      return createDefaultState();
    }

    const data = JSON.parse(json);
    validateState(data);
    return data;
  } catch (e) {
    if (e instanceof StateValidationError) {
      console.warn('State validation failed, returning default state:', e.message);
      return createDefaultState();
    }
    throw e;
  }
}
```

## Documentation

### JSDoc Comments

Document all public APIs and complex logic:

```typescript
/**
 * StateManager class
 * Manages application state, handles actions, and notifies listeners
 */
export class StateManager {
  /**
   * Get the current state (read-only)
   * @returns The current application state
   */
  getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Dispatch an action to update state
   * @param action - The action to dispatch
   */
  dispatch(action: Action): void {
    // ...
  }
}
```

### Inline Comments

Use inline comments for non-obvious logic:

```typescript
// Convert Set to Array for JSON serialization
const serializable = {
  ...state,
  collapsedSections: Array.from(state.collapsedSections),
};

// Auto-select first section if none selected
if (!selectedSectionId && state.sections.length > 0) {
  selectedSectionId = state.sections[0].id;
}
```

## Testing Standards

See the dedicated `testing.md` steering doc for comprehensive testing guidelines, including property-based testing patterns, bugfix methodology, and mocking strategies.

## Accessibility

### ARIA Labels

Provide ARIA labels for interactive elements:

```typescript
input.setAttribute('aria-label', 'Add or search items');
button.setAttribute('aria-label', 'Delete item');
```

### Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```typescript
element.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    this.handleAction();
  }
});
```

### Touch Targets

Maintain minimum 44x44px touch targets for mobile:

```css
.button {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
}
```
