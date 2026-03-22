# Requirements Document

## Introduction

Add a clear ("✕") button inside the search input field of the grocery list app. The button appears on the right side of the input when text is present, and clicking it clears the search text and resets filtering. This is a standard UX pattern for search inputs that gives users a quick, discoverable way to reset their search without manually selecting and deleting text.

## Glossary

- **InputField**: The existing search/add input component (`InputField.ts`) that handles text entry, filtering, and item submission.
- **Clear_Button**: A clickable "✕" button rendered inside the InputField wrapper, positioned on the right side of the input area.
- **Input_Wrapper**: A container element that wraps the HTMLInputElement and the Clear_Button, visually presenting them as a single input control.
- **Filter_Callback**: The `onInput` callback provided to InputField that triggers item filtering based on the current search text.

## Requirements

### Requirement 1: Clear Button Visibility

**User Story:** As a user, I want the clear button to appear only when there is text in the search field, so that the interface stays clean when I am not searching.

#### Acceptance Criteria

1. WHILE the InputField contains one or more characters, THE Clear_Button SHALL be visible inside the Input_Wrapper on the right side of the input area.
2. WHILE the InputField is empty, THE Clear_Button SHALL be hidden.
3. WHEN the user types text into the InputField, THE Clear_Button SHALL become visible.
4. WHEN the InputField text becomes empty (by any means), THE Clear_Button SHALL become hidden.

### Requirement 2: Clear Button Behavior

**User Story:** As a user, I want to click the clear button to instantly clear my search text and reset filtering, so that I can quickly return to viewing all items.

#### Acceptance Criteria

1. WHEN the user clicks the Clear_Button, THE InputField SHALL set its text value to an empty string.
2. WHEN the user clicks the Clear_Button, THE InputField SHALL invoke the Filter_Callback with an empty string to reset filtering.
3. WHEN the user clicks the Clear_Button, THE InputField SHALL cancel any pending debounce timer before clearing.
4. WHEN the user clicks the Clear_Button, THE InputField SHALL move keyboard focus to the HTMLInputElement.

### Requirement 3: Wrapper Structure and Backward Compatibility

**User Story:** As a developer, I want the InputField component to wrap the input and clear button in a container element, so that they can be positioned together while maintaining backward compatibility with existing code.

#### Acceptance Criteria

1. THE InputField SHALL render an Input_Wrapper element that contains both the HTMLInputElement and the Clear_Button.
2. THE InputField `getElement()` method SHALL return the Input_Wrapper element instead of the bare HTMLInputElement.
3. THE InputField SHALL expose a method to access the underlying HTMLInputElement directly for test and integration compatibility.
4. THE InputField `clear()` method SHALL continue to clear the text, invoke the Filter_Callback with an empty string, and hide the Clear_Button.

### Requirement 4: Clear Button Styling

**User Story:** As a user, I want the clear button to look like a standard inline clear control, so that it is recognizable and does not disrupt the input field appearance.

#### Acceptance Criteria

1. THE Clear_Button SHALL be rendered as a "✕" character centered inside a small circular gray background, consistent with the app's dark theme.
2. THE Clear_Button SHALL be positioned on the right side of the input area using absolute positioning within the Input_Wrapper.
3. THE Input_Wrapper SHALL visually appear as a single input field, matching the existing `.input-field` styling (border, background, border-radius).
4. THE HTMLInputElement inside the Input_Wrapper SHALL have right padding sufficient to prevent text from overlapping the Clear_Button.
5. THE Clear_Button SHALL have a visible hover state to indicate interactivity.

### Requirement 5: Accessibility

**User Story:** As a user relying on assistive technology, I want the clear button to be accessible, so that I can use it with a keyboard or screen reader.

#### Acceptance Criteria

1. THE Clear_Button SHALL have an `aria-label` attribute with the value "Clear search".
2. THE Clear_Button SHALL be a `<button>` element with `type="button"`.
3. WHEN the Clear_Button is hidden, THE Clear_Button SHALL not be focusable via keyboard navigation.
4. THE Clear_Button SHALL be operable via keyboard (Enter and Space keys) when visible and focused.
