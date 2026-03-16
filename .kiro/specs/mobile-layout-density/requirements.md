# Requirements Document

## Introduction

The grocery list PWA currently uses generous padding, 44px minimum touch targets, and wide spacing throughout the mobile layout. This results in fewer visible items on screen compared to native list apps like iPhone Notes. This feature introduces a denser mobile layout that maximizes visible content while preserving usability on touch devices. Changes apply only within the mobile breakpoint (< 768px).

## Glossary

- **Mobile_Layout**: The CSS layout applied when the viewport width is below 768px
- **Item_Row**: A single grocery item row containing a checkbox, name, quantity controls, and a delete button
- **Section_Header**: The collapsible header bar for a grocery section containing the title, chevron, and control buttons
- **Add_Input**: The inline text input at the bottom of each section used to add new items
- **Touch_Target**: The minimum tappable area for interactive elements, measured in CSS pixels
- **Visible_Item_Count**: The number of Item_Rows fully visible on screen without scrolling
- **Checkbox_Area**: The container wrapping the checkbox input inside an Item_Row
- **Section_Controls**: The group of action buttons (rename, move up, move down, delete) in the Section_Header
- **Quantity_Controls**: The increment/decrement buttons and quantity value display within an Item_Row

## Requirements

### Requirement 1: Reduce Item Row Height

**User Story:** As a mobile user, I want grocery items to take up less vertical space, so that I can see more items on screen without scrolling.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render each Item_Row with vertical padding no greater than 4px.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render each Checkbox_Area with a minimum height of 36px and a minimum width of 36px.
3. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the checkbox input at 20px by 20px.
4. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the horizontal gap between Item_Row child elements at no more than 6px.

### Requirement 2: Compact Section Headers

**User Story:** As a mobile user, I want section headers to be slimmer, so that sections take up less space and I can see more content.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render each Section_Header with vertical padding no greater than 4px.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render each Section_Header with a minimum height no greater than 36px.
3. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render Section_Controls buttons with a minimum height of 36px and a minimum width of 36px.
4. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the section title at a font size between 0.9rem and 1rem.

### Requirement 3: Compact Add Input

**User Story:** As a mobile user, I want the add-item input field to be slimmer, so that it does not consume excessive vertical space within each section.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render each Add_Input with a minimum height no greater than 36px.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render each Add_Input with vertical padding no greater than 6px.

### Requirement 4: Reduce Section Spacing

**User Story:** As a mobile user, I want less space between sections, so that more sections and items are visible at once.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the gap between consecutive sections at no more than 6px.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the app container with top and bottom padding no greater than 6px.

### Requirement 5: Compact Quantity Controls

**User Story:** As a mobile user, I want the quantity increment and decrement buttons to be smaller on mobile, so that item rows remain compact.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render Quantity_Controls buttons with a minimum height of 32px and a minimum width of 32px.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the gap between Quantity_Controls elements at no more than 2px.
3. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the quantity value font size at 0.8125rem.

### Requirement 6: Compact Global Controls

**User Story:** As a mobile user, I want the search input and filter bar to take up less vertical space, so that more list content is visible.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the search input with vertical padding no greater than 6px and a bottom margin no greater than 6px.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render the filter control bar with padding no greater than 4px and a bottom margin no greater than 6px.
3. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render filter buttons with a minimum height of 36px.

### Requirement 7: Maintain Touch Usability

**User Story:** As a mobile user, I want all interactive elements to remain easy to tap, so that the denser layout does not cause accidental taps or missed inputs.

#### Acceptance Criteria

1. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL render all interactive elements (buttons, checkboxes, inputs) with a minimum touch target of 32px in both width and height.
2. WHILE the viewport width is below 768px, THE Mobile_Layout SHALL preserve hover and active state visual feedback on all interactive elements.
3. IF the viewport width is 768px or above, THEN THE Mobile_Layout SHALL not apply any compact layout overrides, preserving the existing tablet and desktop styles.

### Requirement 8: Preserve Desktop and Tablet Layouts

**User Story:** As a tablet or desktop user, I want the existing layout to remain unchanged, so that the mobile density changes do not affect my experience.

#### Acceptance Criteria

1. THE Mobile_Layout SHALL apply compact style overrides exclusively within the existing mobile media query (max-width: 767px).
2. THE Mobile_Layout SHALL not modify any CSS custom properties defined in :root.
3. THE Mobile_Layout SHALL not alter the HTML structure or component class names.
