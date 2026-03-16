# Requirements Document

## Introduction

The Grocery List PWA has a dual-purpose input field that adds items (on Enter) and filters/searches items (on every keystroke). Currently, filtering fires immediately on every keystroke via the `onInput` callback, causing the item list to visually flash and disappear as the user types quickly. This feature adds a 300ms debounce delay to the filtering so the list remains stable while the user is actively typing, while preserving immediate behavior for item submission and input clearing.

## Glossary

- **InputField**: The text input component (`src/components/InputField.ts`) that handles both item addition and item filtering
- **Debounce_Timer**: A timer mechanism that delays execution of the filter callback until a specified period of inactivity (300ms) has elapsed since the last keystroke
- **Filter_Callback**: The `onInput` callback provided to InputField that triggers item list filtering based on the current input text
- **Submit_Callback**: The `onSubmit` callback provided to InputField that triggers item addition when the user presses Enter
- **Debounce_Delay**: The 300ms waiting period before the filter is applied after the user stops typing

## Requirements

### Requirement 1: Debounced Filtering on Keystroke

**User Story:** As a user, I want the item list to remain stable while I type quickly, so that the list does not flash or disappear during rapid input.

#### Acceptance Criteria

1. WHEN a user types in the InputField, THE InputField SHALL delay invoking the Filter_Callback until 300ms have elapsed since the last keystroke
2. WHEN a user types an additional character before the Debounce_Delay expires, THE InputField SHALL reset the Debounce_Timer to 300ms from the latest keystroke
3. WHEN the Debounce_Delay expires without further input, THE InputField SHALL invoke the Filter_Callback with the current input text
4. THE InputField SHALL use a Debounce_Delay of exactly 300 milliseconds

### Requirement 2: Immediate Submit Without Debounce Interference

**User Story:** As a user, I want to press Enter and have my item added immediately, so that item submission is never delayed by the debounce mechanism.

#### Acceptance Criteria

1. WHEN a user presses Enter, THE InputField SHALL invoke the Submit_Callback immediately without waiting for the Debounce_Timer
2. WHEN a user presses Enter while a Debounce_Timer is pending, THE InputField SHALL cancel the pending Debounce_Timer before invoking the Submit_Callback
3. WHEN a user presses Enter, THE InputField SHALL clear the input field and invoke the Filter_Callback with an empty string immediately (no debounce)

### Requirement 3: Immediate Filter Reset on Input Clear

**User Story:** As a user, I want the full item list to reappear immediately when I clear the input field, so that I do not have to wait 300ms to see all items again.

#### Acceptance Criteria

1. WHEN the input field value becomes an empty string, THE InputField SHALL invoke the Filter_Callback immediately without waiting for the Debounce_Timer
2. WHEN the input field value becomes an empty string while a Debounce_Timer is pending, THE InputField SHALL cancel the pending Debounce_Timer before invoking the Filter_Callback

### Requirement 4: Debounce Timer Cleanup

**User Story:** As a developer, I want the debounce timer to be properly managed, so that there are no memory leaks or stale callbacks.

#### Acceptance Criteria

1. THE InputField SHALL cancel any pending Debounce_Timer when a new input event occurs
2. THE InputField SHALL expose a `destroy` method that cancels any pending Debounce_Timer for component cleanup
3. WHEN the InputField is destroyed, THE InputField SHALL not invoke the Filter_Callback from a previously pending Debounce_Timer
