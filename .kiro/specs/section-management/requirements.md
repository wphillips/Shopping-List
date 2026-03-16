# Requirements Document

## Introduction

The Grocery List PWA currently supports sections for organizing items, but section management is limited to programmatic operations. Users cannot add new sections or rename existing ones through the UI. This feature adds a complete section management UI: an "Add Section" button for creating new sections and inline rename capability on section headers. The delete, reorder, and collapse functionality already exists in the Section component and does not need to be reimplemented.

## Glossary

- **App_Shell**: The main application component (`AppShell` class) that orchestrates rendering and state management
- **Section_Component**: The UI component that renders a single grocery section with its header and controls
- **State_Manager**: The centralized state management class that handles dispatching actions and persisting state
- **Add_Section_Button**: A button in the main UI that allows users to create a new section
- **Section_Name_Input**: An inline text input that appears in the section header when the user initiates a rename
- **Section_Header**: The clickable header area of a section displaying the section name and control buttons

## Requirements

### Requirement 1: Add Section Button

**User Story:** As a grocery list user, I want an "Add Section" button in the app UI, so that I can create new sections to organize my items.

#### Acceptance Criteria

1. THE App_Shell SHALL render an Add_Section_Button below the existing sections in the sections container
2. WHEN the user clicks the Add_Section_Button, THE App_Shell SHALL create a new section with a default name of "New Section"
3. WHEN a new section is created via the Add_Section_Button, THE App_Shell SHALL immediately place the new section's header into rename mode so the user can type a custom name
4. WHEN a new section is created via the Add_Section_Button, THE State_Manager SHALL dispatch an ADD_SECTION action with the default name
5. THE Add_Section_Button SHALL display a "+" icon and the text "Add Section"
6. THE Add_Section_Button SHALL remain visible when no sections exist, providing a way to create the first section

### Requirement 2: Rename Section State Action

**User Story:** As a developer, I want a RENAME_SECTION action in the state manager, so that section name changes are persisted through the standard state management flow.

#### Acceptance Criteria

1. THE State_Manager SHALL support a RENAME_SECTION action that accepts a section ID and a new name
2. WHEN a RENAME_SECTION action is dispatched, THE State_Manager SHALL update the name of the section matching the provided ID
3. WHEN a RENAME_SECTION action is dispatched with an ID that does not match any section, THE State_Manager SHALL return the state unchanged
4. WHEN a RENAME_SECTION action is dispatched, THE State_Manager SHALL persist the updated state to localStorage

### Requirement 3: Inline Section Rename UI

**User Story:** As a grocery list user, I want to rename sections by clicking on the section name, so that I can organize my grocery list with meaningful category names.

#### Acceptance Criteria

1. WHEN the user double-clicks on a section name in the Section_Header, THE Section_Component SHALL replace the section name text with a Section_Name_Input pre-filled with the current name
2. WHEN the Section_Name_Input is displayed, THE Section_Component SHALL focus the input and select all text for easy replacement
3. WHEN the user presses Enter in the Section_Name_Input, THE Section_Component SHALL commit the new name by invoking the rename callback
4. WHEN the user presses Escape in the Section_Name_Input, THE Section_Component SHALL cancel the rename and restore the original section name
5. WHEN the Section_Name_Input loses focus, THE Section_Component SHALL commit the new name by invoking the rename callback
6. IF the user submits an empty or whitespace-only name, THEN THE Section_Component SHALL cancel the rename and restore the original section name
7. THE Section_Name_Input SHALL have a maximum length of 50 characters to prevent excessively long section names
8. WHILE the Section_Name_Input is active, THE Section_Header SHALL not trigger collapse/expand when the user interacts with the input

### Requirement 4: Section Component Rename Integration

**User Story:** As a developer, I want the Section component to accept a rename callback, so that rename events flow through the existing component architecture.

#### Acceptance Criteria

1. THE Section_Component SHALL accept an onRename callback in its configuration that receives the section ID and the new name
2. WHEN the user completes a rename, THE Section_Component SHALL invoke the onRename callback with the section ID and trimmed new name
3. WHEN the onRename callback is invoked, THE App_Shell SHALL dispatch a RENAME_SECTION action to the State_Manager

### Requirement 5: Accessibility for Section Management

**User Story:** As a user who relies on assistive technology, I want the section management controls to be accessible, so that I can manage sections using a keyboard or screen reader.

#### Acceptance Criteria

1. THE Add_Section_Button SHALL have an aria-label of "Add new section"
2. THE Section_Name_Input SHALL have an aria-label of "Rename section"
3. THE Add_Section_Button SHALL be focusable and activatable via keyboard (Enter and Space keys)
4. THE Section_Name_Input SHALL meet the minimum touch target size of 44x44 CSS pixels on mobile devices
