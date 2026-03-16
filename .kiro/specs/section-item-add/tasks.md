# Implementation Plan: Section Item Add

## Overview

Replace the dual-purpose global input with per-section inline add inputs. Each expanded section gets a subtle text input at the bottom of its content area. The global input becomes search-only. Changes span `Section.ts`, `index.ts`, and `main.css`.

## Tasks

- [x] 1. Add inline add input to Section component
  - [x] 1.1 Extend `SectionConfig` with `onAddItem` callback
    - In `src/components/Section.ts`, add `onAddItem: (name: string) => void` to the `SectionConfig` interface
    - _Requirements: 1.4_
  - [x] 1.2 Create inline input element in `createElement()`
    - Create an `<input>` element with `type='text'`, `className='section-add-input'`, `placeholder='Add to ${name}...'`, and `aria-label='Add item to ${name}'`
    - Store a reference to the input as `this.addInputElement`
    - Append the input as the last child of the `.section-content` div
    - _Requirements: 1.1, 1.3, 2.4, 5.3_
  - [x] 1.3 Attach event listeners on the inline input
    - On `keydown` with `Enter`: trim value, if non-empty call `this.config.onAddItem(trimmedValue)` and clear the input; if empty/whitespace do nothing
    - On `keydown` with `Escape`: clear the input value and call `blur()`
    - _Requirements: 1.4, 1.6, 1.7, 5.2_
  - [x] 1.4 Expose `getAddInputElement()` public method
    - Return the stored inline input element so AppShell can re-append it after rendering items
    - _Requirements: 1.1_

- [x] 2. Add CSS styles for inline add input
  - [x] 2.1 Add `.section-add-input` styles to `src/styles/main.css`
    - `background-color: transparent`, `border: 1px solid transparent`, `border-radius: 4px`, `font-size: 0.8125rem`, `min-height: 44px`, `color: var(--text-primary)`, `outline: none`
    - On `:focus`: `border-color: var(--accent)`, `background-color: var(--bg-tertiary)`
    - `::placeholder`: `color: var(--text-disabled)`, `font-style: italic`
    - `width: 100%`, `padding: 0.5rem 0.75rem`, `box-sizing: border-box`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Update AppShell to wire inline inputs and remove global add behavior
  - [x] 3.1 Change global input to search-only
    - In `src/index.ts`, change the `InputField` placeholder from `'Add item or search...'` to `'Search items...'`
    - Change the `onSubmit` callback to a no-op: `() => {}`
    - _Requirements: 3.1, 3.2_
  - [x] 3.2 Add `onAddItem` callback when creating Section components in `render()`
    - Pass `onAddItem: (name) => this.stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId: section.id })` to each Section config
    - _Requirements: 1.4, 1.5_
  - [x] 3.3 Append inline input after rendering items in each section
    - After rendering items into `contentElement`, call `contentElement.appendChild(sectionComponent.getAddInputElement())`
    - This ensures the input appears after items and is hidden when collapsed (via existing `.section.collapsed .section-content { display: none }`)
    - _Requirements: 1.1, 1.2_
  - [x] 3.4 Re-focus inline input after re-render for multi-add flow
    - Track the section ID of the last add action (e.g., `this.lastAddSectionId`)
    - After render completes, if `lastAddSectionId` is set, find the corresponding section component and call `getAddInputElement().focus()`, then clear the tracking variable
    - _Requirements: 4.2_
  - [x] 3.5 Remove `handleItemSubmit` method and related `selectedSectionId` logic
    - Delete or empty the `handleItemSubmit` method body
    - Remove the auto-create default section logic that was tied to global input submission
    - _Requirements: 3.1, 3.4_

- [x] 4. Write unit tests
  - [x] 4.1 Create `tests/Section.add-input.test.ts`
    - Test: inline input is present in section content when not collapsed
    - Test: inline input has correct placeholder containing section name
    - Test: inline input has correct aria-label containing section name
    - Test: inline input has `section-add-input` CSS class
    - Test: global input placeholder is "Search items..."
    - Test: global input Enter does not dispatch ADD_ITEM
    - Test: inline input is not reachable (hidden) when section is collapsed
    - Test: Escape key clears input and blurs
    - _Requirements: 1.1, 1.2, 1.3, 2.4, 3.1, 3.2, 5.1, 5.2, 5.3_

- [x] 5. Write property-based tests
  - [x] 5.1 Create `tests/Section.add-input.properties.test.ts` with Property 1
    - Feature: section-item-add, Property 1: Inline input visibility matches collapsed state
    - Generate random section configs with random boolean collapsed state; verify input is inside a visible content area when not collapsed and hidden when collapsed
    - Minimum 100 iterations
    - _Requirements: 1.1, 1.2_
  - [x] 5.2 Add Property 2: Inline input attributes contain section name
    - Feature: section-item-add, Property 2: Inline input attributes contain section name
    - Generate random non-empty section name strings; create Section; verify placeholder contains name and aria-label contains name
    - Minimum 100 iterations
    - _Requirements: 1.3, 2.4, 5.3_
  - [x] 5.3 Add Property 3: Valid submission dispatches callback, clears input, and retains focus
    - Feature: section-item-add, Property 3: Valid submission dispatches callback, clears input, and retains focus
    - Generate random non-whitespace strings; set as input value; simulate Enter keydown; verify onAddItem called with trimmed value, input value is empty, input is focused
    - Minimum 100 iterations
    - _Requirements: 1.4, 1.6, 4.2_
  - [x] 5.4 Add Property 4: Whitespace-only input is rejected
    - Feature: section-item-add, Property 4: Whitespace-only input is rejected
    - Generate random whitespace-only strings (spaces, tabs, newlines); set as input value; simulate Enter keydown; verify onAddItem NOT called
    - Minimum 100 iterations
    - _Requirements: 1.7_
  - [x] 5.5 Add Property 5: Escape clears and blurs
    - Feature: section-item-add, Property 5: Escape clears and blurs
    - Generate random strings; set as input value; focus input; simulate Escape keydown; verify value is empty and input is not the active element
    - Minimum 100 iterations
    - _Requirements: 5.2_

- [x] 6. Verify build and all tests pass
  - [x] 6.1 Run `npx vite build 2>&1` and confirm no build errors
    - _Requirements: all_
  - [x] 6.2 Run `npm test` and confirm all tests pass (existing + new)
    - _Requirements: all_
