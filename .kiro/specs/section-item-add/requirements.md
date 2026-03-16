# Requirements Document

## Introduction

The grocery list PWA currently uses a single global input field at the top of the app to add items. Items are added to a `selectedSectionId` in state, which auto-selects the first section if none is chosen. This makes it unclear which section an item will land in. This feature replaces that pattern with per-section inline input fields so users can add items directly to the section they intend, removing ambiguity entirely.

## Glossary

- **Section_Component**: The UI component (`src/components/Section.ts`) that renders a collapsible grocery section with a header, controls, and a content area for items.
- **Inline_Add_Input**: A small text input rendered inside a Section_Component's content area, allowing the user to type and submit a new item directly into that section.
- **Global_Input**: The existing `InputField` component (`src/components/InputField.ts`) mounted at the top of the app, currently used for both searching and adding items.
- **AppShell**: The main application orchestrator (`src/index.ts`) that wires state, components, and rendering together.
- **StateManager**: The state management module (`src/state.ts`) that processes actions and notifies listeners.

## Requirements

### Requirement 1: Per-Section Inline Add Input

**User Story:** As a grocery list user, I want an input field inside each section so that I can add items directly to the section I'm looking at without guessing where the item will go.

#### Acceptance Criteria

1. WHEN a Section_Component is rendered and is not collapsed, THE Section_Component SHALL display an Inline_Add_Input at the bottom of its content area.
2. WHEN the Section_Component is collapsed, THE Section_Component SHALL hide the Inline_Add_Input along with the rest of the section content.
3. THE Inline_Add_Input SHALL include placeholder text indicating the section name (e.g., "Add to Produce...").
4. WHEN the user presses Enter in the Inline_Add_Input with non-empty trimmed text, THE Section_Component SHALL dispatch an ADD_ITEM action with the entered text and the section's ID.
5. WHEN the ADD_ITEM action is dispatched from the Inline_Add_Input, THE StateManager SHALL create a new item in the correct section with quantity 1 and isChecked false.
6. WHEN the user submits an item via the Inline_Add_Input, THE Inline_Add_Input SHALL clear its text content.
7. WHEN the user presses Enter in the Inline_Add_Input with empty or whitespace-only text, THE Section_Component SHALL not dispatch any action.

### Requirement 2: Inline Add Input Visual Design

**User Story:** As a user who prefers a clean interface, I want the per-section input to be subtle and unobtrusive so that it does not clutter the section when I'm not actively using it.

#### Acceptance Criteria

1. THE Inline_Add_Input SHALL use a visually subdued style that is less prominent than the Global_Input (e.g., no visible border until focused, reduced font size, muted placeholder text).
2. WHEN the Inline_Add_Input receives focus, THE Inline_Add_Input SHALL display a visible border or highlight to indicate active state.
3. THE Inline_Add_Input SHALL meet a minimum touch target size of 44×44 CSS pixels for mobile usability.
4. THE Inline_Add_Input SHALL have an accessible label that identifies the target section (e.g., aria-label="Add item to Produce").

### Requirement 3: Remove Global Input Add Behavior

**User Story:** As a developer, I want to simplify the Global_Input so that it only handles search/filter, removing the dual-purpose confusion of adding items from a single top-level field.

#### Acceptance Criteria

1. THE Global_Input SHALL function only as a search/filter field and SHALL NOT dispatch ADD_ITEM actions on Enter.
2. THE Global_Input placeholder text SHALL indicate search-only purpose (e.g., "Search items...").
3. WHEN the user types in the Global_Input, THE AppShell SHALL continue to filter displayed items by text match with debounce behavior.
4. THE AppState SHALL no longer require the selectedSectionId property for item addition purposes.

### Requirement 4: Mobile and Touch Usability

**User Story:** As a mobile user, I want the per-section input to work well on touch devices so that I can quickly add items while shopping.

#### Acceptance Criteria

1. WHEN the user taps the Inline_Add_Input on a touch device, THE Inline_Add_Input SHALL receive focus and display the on-screen keyboard.
2. WHEN the user submits an item on a mobile device, THE Inline_Add_Input SHALL retain focus so the user can add multiple items in succession without re-tapping.
3. THE Inline_Add_Input SHALL be reachable by scrolling within the section content area without overlapping other interactive elements.

### Requirement 5: Keyboard Accessibility

**User Story:** As a keyboard user, I want to be able to tab into a section's add input and submit items using only the keyboard.

#### Acceptance Criteria

1. THE Inline_Add_Input SHALL be reachable via sequential keyboard Tab navigation within the section.
2. WHEN the Inline_Add_Input has focus and the user presses Escape, THE Inline_Add_Input SHALL clear its text and blur (remove focus).
3. THE Inline_Add_Input SHALL have a role and label that screen readers can announce (e.g., "Add item to Dairy").
