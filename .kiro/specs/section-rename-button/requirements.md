# Requirements Document

## Introduction

This feature adds a visible rename button (✏️) to section controls in the Grocery List PWA. On touch devices (mobile), the existing double-click rename gesture does not work reliably. The rename button provides an explicit, accessible alternative that works across all input modalities — touch, mouse, and keyboard.

## Glossary

- **Section_Component**: The `Section` class in `src/components/Section.ts` that renders a collapsible section with header controls and a content area for grocery items.
- **Section_Controls**: The group of action buttons (rename, move-up, move-down, delete) rendered in the section header.
- **Rename_Mode**: An inline editing state where the section title span is replaced by a text input, allowing the user to change the section name.
- **Rename_Button**: A button element with `data-action="rename"` and the ✏️ icon, positioned as the first button in the Section_Controls.

## Requirements

### Requirement 1: Visible Rename Button

**User Story:** As a mobile user, I want a visible rename button on each section, so that I can rename sections without relying on double-click.

#### Acceptance Criteria

1. THE Section_Component SHALL render a Rename_Button as the first button in the Section_Controls, before the move-up, move-down, and delete buttons.
2. THE Rename_Button SHALL display the ✏️ emoji as its text content.
3. THE Rename_Button SHALL have `data-action="rename"` as an attribute.
4. THE Rename_Button SHALL use the existing `icon-only` CSS class for consistent styling with other control buttons.

### Requirement 2: Rename Button Activates Rename Mode

**User Story:** As a user, I want clicking the rename button to let me edit the section name inline, so that renaming is intuitive and consistent.

#### Acceptance Criteria

1. WHEN the Rename_Button is clicked, THE Section_Component SHALL enter Rename_Mode by calling the `enterRenameMode()` method.
2. WHEN the Rename_Button is clicked, THE Section_Component SHALL NOT trigger the section collapse/expand toggle.
3. WHILE in Rename_Mode, THE Section_Component SHALL display a text input pre-filled with the current section name, with the text fully selected and focused.

### Requirement 3: Preserve Existing Double-Click Rename

**User Story:** As a desktop user, I want to keep the double-click rename shortcut, so that my existing workflow is not disrupted.

#### Acceptance Criteria

1. WHEN the section title span is double-clicked, THE Section_Component SHALL enter Rename_Mode.
2. THE Section_Component SHALL support both the Rename_Button and double-click as entry points to Rename_Mode.

### Requirement 4: Accessibility

**User Story:** As a user relying on assistive technology, I want the rename button to be properly labeled, so that I can understand its purpose.

#### Acceptance Criteria

1. THE Rename_Button SHALL have `aria-label="Rename section"`.
2. THE Rename_Button SHALL be keyboard-focusable and activatable via Enter or Space keys (default button behavior).
