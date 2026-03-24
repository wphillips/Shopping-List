# Requirements Document

## Introduction

This feature improves the visual hierarchy of the grocery list PWA so that section headers visually recede into quiet category dividers while grocery items become the primary visual focus. Currently, section headers and items share similar visual weight (comparable background colors, font sizes, and styling), making long lists with multiple sections hard to scan. The goal is to make items the dominant elements and sections the subordinate, muted labels.

## Glossary

- **Section_Header**: The clickable header bar of a grocery list section (`.section-header`), containing the section name, collapse chevron, and control buttons (rename, reorder, delete). Currently styled with `--bg-tertiary` background, 1rem font, font-weight 500.
- **Item_Row**: An individual grocery item row (`.item`) within a section, containing a checkbox, item name, quantity controls, and a delete button. Currently styled with `--bg-secondary` background, 0.9375rem font.
- **Section_Container**: The outer wrapper (`.section`) that groups a Section_Header and its Item_Rows together.
- **Visual_Weight**: The perceived prominence of a UI element determined by its background color contrast, font size, font weight, spacing, and color intensity relative to surrounding elements.
- **Dark_Theme**: The application's color scheme using CSS custom properties (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, etc.) on a `#1a1a1a` base.

## Requirements

### Requirement 1: Reduce Section Header Visual Weight

**User Story:** As a grocery list user, I want section headers to appear as quiet, muted category labels, so that my attention naturally focuses on the items rather than the section names.

#### Acceptance Criteria

1. THE Section_Header SHALL use a background color that is closer to the page background (`--bg-primary`) than to the Item_Row background, reducing its visual prominence.
2. THE Section_Header SHALL use a font size smaller than the Item_Row font size.
3. THE Section_Header SHALL use a font weight no greater than 400.
4. THE Section_Header SHALL use a muted text color (such as `--text-secondary`) for the section name instead of `--text-primary`.
5. THE Section_Header SHALL use uppercase or small-caps letter-spacing to differentiate the section name as a category label without increasing visual weight.

### Requirement 2: Preserve Item Row Styling

**User Story:** As a grocery list user, I want item rows to remain unchanged, so that the visual hierarchy improvement comes solely from muting the section headers.

#### Acceptance Criteria

1. THE Item_Row SHALL retain its existing font size (0.9375rem) without modification.
2. THE Item_Row SHALL retain its existing font weight without modification (no explicit font-weight added).
3. THE Item_Row SHALL retain its existing background color (`--bg-secondary`) without modification.
4. THE Item_Row SHALL maintain the existing `--text-primary` color for unchecked item names.

### Requirement 3: Maintain Visual Separation Between Sections

**User Story:** As a grocery list user, I want sections to remain visually distinct from each other, so that I can still identify where one category ends and another begins.

#### Acceptance Criteria

1. THE Section_Header SHALL include a visible bottom border or divider line that separates the header from the Item_Rows below.
2. THE Section_Container SHALL maintain vertical spacing (margin) between consecutive sections to preserve visual grouping.
3. WHEN a Section_Header is hovered, THE Section_Header SHALL provide a subtle hover state that remains less prominent than the Item_Row default state.

### Requirement 4: Preserve Section Header Interactive Affordances

**User Story:** As a grocery list user, I want section control buttons (rename, reorder, delete) to remain accessible and usable, so that I can still manage my sections without difficulty.

#### Acceptance Criteria

1. THE Section_Header control buttons SHALL maintain a minimum touch target size of 44x44 CSS pixels on tablet and desktop, and 36x36 CSS pixels on mobile.
2. WHEN a Section_Header control button is hovered, THE control button SHALL display a visible hover state.
3. THE Section_Header collapse chevron SHALL remain visible and distinguishable from the section name text.

### Requirement 5: Maintain Checked Item Visual Distinction

**User Story:** As a grocery list user, I want checked-off items to remain visually distinct from unchecked items, so that I can tell at a glance what I have already picked up.

#### Acceptance Criteria

1. WHILE an Item_Row is in the checked state, THE Item_Row SHALL continue to use the existing checked styling (`--checked-bg` background, `--checked-text` color, strikethrough text).
2. WHILE an Item_Row is in the checked state, THE Item_Row SHALL appear less prominent than unchecked Item_Rows.

### Requirement 6: Responsive Consistency

**User Story:** As a grocery list user on any device, I want the visual hierarchy between sections and items to remain consistent across mobile, tablet, and desktop layouts.

#### Acceptance Criteria

1. THE Section_Header reduced visual weight SHALL apply consistently across mobile (< 768px), tablet (768px–1024px), and desktop (> 1024px) breakpoints.
2. THE Item_Row styling SHALL remain unchanged across all breakpoints.
3. WHEN the mobile breakpoint is active, THE Section_Header font size SHALL scale proportionally while remaining smaller than the Item_Row font size.

### Requirement 7: WCAG Contrast Compliance

**User Story:** As a grocery list user, I want all text to remain readable against its background, so that the visual hierarchy changes do not reduce accessibility.

#### Acceptance Criteria

1. THE Section_Header muted text color SHALL maintain a minimum contrast ratio of 4.5:1 against the Section_Header background color per WCAG 2.1 AA.
2. THE Item_Row text color SHALL maintain a minimum contrast ratio of 4.5:1 against the Item_Row background color per WCAG 2.1 AA.
3. IF a color combination fails to meet the 4.5:1 contrast ratio, THEN THE Dark_Theme SHALL use an adjusted color value that meets the ratio.

### Requirement 9: Reduce Section Header Padding

**User Story:** As a grocery list user, I want section headers to be more compact, so that more items are visible on screen and the headers feel like lightweight dividers.

#### Acceptance Criteria

1. THE Section_Header vertical padding SHALL be reduced to 0.25rem (from 0.5rem on default, 4px on mobile, 0.625rem on desktop).
2. THE Section_Header min-height constraint SHALL be removed or reduced to allow the header to shrink naturally.
3. THE Section_Header horizontal padding SHALL remain unchanged to keep controls aligned with item content.

### Requirement 10: Preserve Item Row Density

**User Story:** As a grocery list user, I want the visual hierarchy changes to not reduce the number of items visible on screen, so that I can still scan my list efficiently without extra scrolling.

#### Acceptance Criteria

1. THE Item_Row rendered height SHALL NOT exceed its current rendered height.
2. THE vertical spacing (margin) between Section_Containers SHALL NOT increase beyond the current value (0.625rem on mobile/tablet, 0.75rem on desktop).
