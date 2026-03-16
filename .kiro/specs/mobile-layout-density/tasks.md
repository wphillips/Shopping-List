# Implementation Plan: Mobile Layout Density

## Overview

Append compact CSS overrides to the existing `@media (max-width: 767px)` block in `src/styles/main.css`. All changes are CSS-only — no HTML, JS, or component modifications. Each task group targets a specific UI region and maps directly to requirements.

## Tasks

- [x] 1. Compact item rows and checkboxes
  - [x] 1.1 Add CSS overrides for `.item` row compactness
    - Override `.item` to `gap: 6px; padding: 4px 0.5rem` inside the mobile media query
    - Override `.item-checkbox` to `min-width: 36px; min-height: 36px`
    - Override `.item-checkbox input[type="checkbox"]` to `width: 20px; height: 20px`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write property test for item row compactness
    - **Property 1: Item row compactness**
    - Parse `main.css` mobile media query and verify `.item` padding and gap values
    - **Validates: Requirements 1.1, 1.4**

  - [x] 1.3 Write property test for checkbox compactness
    - **Property 2: Checkbox compactness**
    - Parse `main.css` mobile media query and verify `.item-checkbox` dimensions and checkbox input size
    - **Validates: Requirements 1.2, 1.3**

- [x] 2. Compact section headers and controls
  - [x] 2.1 Add CSS overrides for section header compactness
    - Override `.section-header` to `min-height: 36px; padding: 4px 0.5rem`
    - Override `.section-controls button` to `min-width: 36px; min-height: 36px`
    - Override `.section-title` to `font-size: 0.9375rem`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Write property test for section header compactness
    - **Property 3: Section header compactness**
    - Parse `main.css` mobile media query and verify `.section-header` padding and min-height
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.3 Write property test for section control button dimensions
    - **Property 4: Section control button dimensions**
    - Parse `main.css` mobile media query and verify `.section-controls button` dimensions
    - **Validates: Requirements 2.3**

  - [x] 2.4 Write property test for section title font size
    - **Property 5: Section title font size**
    - Parse `main.css` mobile media query and verify `.section-title` font-size
    - **Validates: Requirements 2.4**

- [x] 3. Compact add input, section spacing, and app container
  - [x] 3.1 Add CSS overrides for add input and section spacing
    - Override `.section-add-input` to `min-height: 36px; padding: 6px 0.75rem`
    - Override `.section` to `margin-bottom: 6px`
    - Override `#app` to `padding: 6px`
    - _Requirements: 3.1, 3.2, 4.1, 4.2_

  - [x] 3.2 Write property test for add input compactness
    - **Property 6: Add input compactness**
    - Parse `main.css` mobile media query and verify `.section-add-input` min-height and padding
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.3 Write property test for section spacing
    - **Property 7: Section spacing**
    - Parse `main.css` mobile media query and verify `.section` margin-bottom
    - **Validates: Requirements 4.1**

- [x] 4. Checkpoint - Verify core layout changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Compact quantity controls
  - [x] 5.1 Add CSS overrides for quantity controls
    - Override `.item-quantity` to `gap: 2px`
    - Override `.item-quantity button` to `min-width: 32px; min-height: 32px`
    - Override `.item-quantity-value` to `font-size: 0.8125rem`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Write property test for quantity controls compactness
    - **Property 8: Quantity controls compactness**
    - Parse `main.css` mobile media query and verify `.item-quantity` gap, button dimensions, and value font-size
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 6. Compact global controls (search input, filter bar)
  - [x] 6.1 Add CSS overrides for global controls
    - Override `input[type="text"], input[type="search"]` to `padding: 6px 0.75rem; margin-bottom: 6px`
    - Override `.filter-control` to `margin-bottom: 6px; padding: 4px`
    - Override `.filter-control button` to `min-height: 36px`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.2 Write property test for filter button height
    - **Property 9: Filter button height**
    - Parse `main.css` mobile media query and verify `.filter-control button` min-height
    - **Validates: Requirements 6.3**

- [x] 7. Set touch target floor and general button overrides
  - [x] 7.1 Add CSS overrides for general button and icon-only button touch targets
    - Override `button` to `min-width: 32px; min-height: 32px`
    - Override `button.icon-only` to `min-width: 32px; min-height: 32px; padding: 0.25rem`
    - _Requirements: 7.1_

  - [x] 7.2 Write property test for universal touch target floor
    - **Property 10: Universal touch target floor**
    - Parse `main.css` mobile media query and verify all interactive element selectors have min-width/min-height >= 32px
    - **Validates: Requirements 7.1**

- [x] 8. Validate no desktop/tablet regression and structural constraints
  - [x] 8.1 Write unit test: no compact overrides at 768px
    - Render at 768px viewport and verify buttons retain 44px min-height/min-width
    - _Requirements: 7.3_

  - [x] 8.2 Write unit test: all compact rules inside mobile media query
    - Parse `main.css` and verify all new compact rules exist within the `@media (max-width: 767px)` block
    - _Requirements: 8.1_

  - [x] 8.3 Write unit test: :root block unchanged
    - Parse `main.css` and verify the `:root` block contains no new or modified custom properties
    - _Requirements: 8.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All CSS changes go inside the existing `@media (max-width: 767px)` block in `src/styles/main.css`
- No `!important` is used; overrides rely on source order within the media query
- No new CSS custom properties, HTML changes, or JS changes
- Property tests use CSS parsing (e.g., postcss) to validate rule values rather than browser rendering
