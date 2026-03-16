# Requirements Document

## Introduction

When a user unchecks a grocery item (marks it as not purchased), the item should automatically move to the position immediately after the last unchecked item (and before the first checked item) in its section's item list. This groups unchecked items at the top and checked items at the bottom, providing a better shopping experience by keeping items that still need to be picked up visually grouped together.

## Glossary

- **State_Manager**: The central state management module (`StateManager` class) that handles all application state mutations via dispatched actions.
- **Item**: An individual grocery product within a section, identified by a unique ID, with properties including name, quantity, isChecked status, and sectionId.
- **Section**: A categorized grouping of grocery items (e.g., "Produce", "Dairy").
- **Item_List**: The ordered array of `Item` objects stored in `AppState.items`, rendered within each section.
- **Unchecked_Item**: An item whose `isChecked` property has transitioned from `true` to `false`.

## Requirements

### Requirement 1: Reorder item on uncheck to group with other unchecked items

**User Story:** As a shopper, I want an unchecked item to move to the position after the last unchecked item in its section, so that unchecked and checked items are visually grouped.

#### Acceptance Criteria

1. WHEN a checked item is toggled to unchecked, THE State_Manager SHALL move the Unchecked_Item to the position immediately after the last unchecked item (and before the first checked item) among items belonging to the same Section in the Item_List.
2. WHEN a checked item is toggled to unchecked, THE State_Manager SHALL preserve the relative order of all other items in the same Section.
3. WHEN a checked item is toggled to unchecked, THE State_Manager SHALL preserve the order of items in all other Sections.
4. WHEN an unchecked item is toggled to checked, THE State_Manager SHALL keep the item at its current position in the Item_List.

### Requirement 2: Persist reordered state

**User Story:** As a shopper, I want the reordered list to be saved, so that the item positions are preserved when I reopen the app.

#### Acceptance Criteria

1. WHEN the Item_List order changes due to an uncheck reorder, THE State_Manager SHALL persist the updated Item_List to localStorage.

### Requirement 3: Visual rendering of reordered items

**User Story:** As a shopper, I want to see the unchecked item appear at the top of the section immediately, so that I get clear visual feedback.

#### Acceptance Criteria

1. WHEN the Item_List order changes due to an uncheck reorder, THE Section component SHALL re-render items in the updated order.
2. WHEN the Item_List order changes due to an uncheck reorder, THE Section component SHALL display the Unchecked_Item grouped with other unchecked items, before any checked items in the section content area.
