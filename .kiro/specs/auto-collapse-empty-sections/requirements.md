# Requirements Document

## Introduction

This feature adds automatic collapse and expand behavior to grocery list sections based on whether they contain visible items in the current filter view. When a user switches between filter modes (all, unchecked, checked), sections that have no items matching the active filter automatically collapse, and sections that do have matching items automatically expand. This reduces visual clutter and helps users focus on relevant content.

## Glossary

- **Section**: A collapsible grouping of grocery items identified by a unique ID and user-defined name
- **Item**: An individual grocery product belonging to a Section, with a checked/unchecked state
- **Filter_Mode**: The active visibility filter — one of "all", "unchecked", or "checked"
- **Visible_Items**: The subset of Items within a Section that match the current Filter_Mode
- **Auto_Collapse_Engine**: The logic responsible for computing and applying automatic collapse/expand state to Sections based on Visible_Items
- **Collapsed_Sections**: The set of Section IDs currently in a collapsed (hidden content) state stored in AppState

## Requirements

### Requirement 1: Auto-collapse sections with no visible items on filter change

**User Story:** As a user, I want sections with no visible items to automatically collapse when I change the filter mode, so that I only see sections relevant to my current view.

#### Acceptance Criteria

1. WHEN the Filter_Mode changes, THE Auto_Collapse_Engine SHALL collapse each Section that has zero Visible_Items under the new Filter_Mode
2. WHEN the Filter_Mode changes, THE Auto_Collapse_Engine SHALL expand each Section that has one or more Visible_Items under the new Filter_Mode
3. THE Auto_Collapse_Engine SHALL apply collapse and expand changes to the Collapsed_Sections set in AppState before the UI re-renders

### Requirement 2: Auto-collapse on item state changes

**User Story:** As a user, I want sections to automatically collapse or expand when I check or uncheck items, so that sections stay collapsed when they become empty in my current view.

#### Acceptance Criteria

1. WHEN an Item's checked state is toggled, THE Auto_Collapse_Engine SHALL collapse the Item's Section if the Section has zero Visible_Items after the toggle
2. WHEN an Item's checked state is toggled, THE Auto_Collapse_Engine SHALL expand the Item's Section if the Section has one or more Visible_Items after the toggle
3. WHILE the Filter_Mode is "all", THE Auto_Collapse_Engine SHALL keep all Sections expanded after an Item check toggle, because all Items remain visible regardless of checked state

### Requirement 3: Auto-collapse on item addition and deletion

**User Story:** As a user, I want sections to automatically expand when items are added and collapse when the last visible item is removed, so that the view stays tidy.

#### Acceptance Criteria

1. WHEN an Item is added to a Section, THE Auto_Collapse_Engine SHALL expand that Section if the new Item is visible under the current Filter_Mode
2. WHEN an Item is deleted from a Section, THE Auto_Collapse_Engine SHALL collapse that Section if the Section has zero Visible_Items after the deletion
3. WHEN an Item is moved to a different Section, THE Auto_Collapse_Engine SHALL collapse the source Section if the source Section has zero Visible_Items after the move
4. WHEN an Item is moved to a different Section, THE Auto_Collapse_Engine SHALL expand the target Section if the target Section has one or more Visible_Items after the move

### Requirement 4: Manual toggle override

**User Story:** As a user, I want to still be able to manually collapse or expand sections regardless of the auto-collapse behavior, so that I retain full control over my view.

#### Acceptance Criteria

1. WHEN a user manually toggles a Section's collapse state, THE Section component SHALL apply the toggle immediately without interference from the Auto_Collapse_Engine
2. THE Auto_Collapse_Engine SHALL re-evaluate and override manual collapse state only when the Filter_Mode changes or an Item mutation occurs

### Requirement 5: Initial render auto-collapse

**User Story:** As a user, I want sections to reflect the correct auto-collapse state when the app first loads, so that the view is immediately tidy based on the persisted filter mode.

#### Acceptance Criteria

1. WHEN the application renders for the first time, THE Auto_Collapse_Engine SHALL collapse each Section that has zero Visible_Items under the persisted Filter_Mode
2. WHEN the application renders for the first time, THE Auto_Collapse_Engine SHALL expand each Section that has one or more Visible_Items under the persisted Filter_Mode
