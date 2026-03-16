# Implementation Plan: Grocery List PWA

## Overview

This implementation plan breaks down the Grocery List PWA into discrete coding tasks. The app is a Progressive Web App with offline-first capabilities, built using TypeScript/JavaScript with a mobile-first responsive design. Each task builds incrementally, with property-based tests integrated throughout to validate correctness properties from the design document.

## Tasks

- [x] 1. Set up project structure and PWA foundation
  - Create project directory structure with src/, public/, and tests/ folders
  - Initialize package.json with dependencies (TypeScript, Webpack/Vite, fast-check for property testing)
  - Create tsconfig.json for TypeScript configuration
  - Set up build configuration for bundling
  - Create index.html as the single-page entry point
  - Create web app manifest.json with name, icons, theme_color, background_color, and display mode set to "standalone"
  - Include icon placeholders for 192x192 and 512x512 sizes
  - Link manifest in index.html
  - _Requirements: 1.1, 1.5, 10.4_


- [x] 2. Implement service worker for offline functionality
  - [x] 2.1 Create service worker file with cache-first strategy
    - Implement install event to cache app shell resources (HTML, CSS, JS, icons)
    - Implement fetch event to intercept requests and serve from cache
    - Define cache name and assets to cache
    - _Requirements: 1.2, 11.1_

  - [x] 2.2 Write unit tests for service worker
    - Test service worker registration succeeds
    - Test fetch interception returns cached resources
    - Test cache-first strategy behavior
    - _Requirements: 1.2_

  - [x] 2.3 Write property test for offline resource serving
    - **Property 25: Service worker serves cached resources offline**
    - **Validates: Requirements 11.1**

- [x] 3. Define core data models and TypeScript interfaces
  - [x] 3.1 Create data model interfaces
    - Define AppState interface with sections, items, filterMode, collapsedSections, selectedSectionId
    - Define Section interface with id, name, order, createdAt
    - Define Item interface with id, name, quantity, isChecked, sectionId, createdAt
    - Define FilterMode type ('all' | 'checked' | 'unchecked')
    - Define DragData interface for drag-and-drop operations
    - _Requirements: 3.1, 3.2, 4.1, 5.1, 6.1, 7.1_

  - [x] 3.2 Write unit tests for data model validation
    - Test interface type checking
    - Test default values for new items and sections
    - _Requirements: 3.1, 4.1_

- [x] 4. Implement storage layer for localStorage persistence
  - [x] 4.1 Create storage module with save and load functions
    - Implement saveState() to serialize AppState to localStorage as JSON
    - Implement loadState() to deserialize from localStorage and validate schema
    - Implement state validation to detect corruption
    - Handle localStorage unavailable scenario (private browsing)
    - Handle storage quota exceeded error
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 4.2 Write unit tests for storage layer
    - Test empty localStorage initializes default state
    - Test localStorage unavailable handling
    - Test storage quota exceeded handling
    - Test invalid state structure recovery
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 4.3 Write property test for persistence round trip
    - **Property 21: State persistence round trip**
    - **Validates: Requirements 3.10, 5.8, 6.5, 7.6, 9.1, 9.2, 9.3, 9.4, 9.5**


- [x] 5. Implement state management layer
  - [x] 5.1 Create state manager with action handlers
    - Initialize AppState with empty sections and items arrays
    - Implement action handlers for all user operations (add/delete/modify sections and items)
    - Implement state update notification mechanism for UI re-rendering
    - Trigger saveState() after every state modification
    - _Requirements: 3.1, 4.1, 9.1, 9.2_

  - [x] 5.2 Implement section management actions
    - Implement createSection(name) to add new section with unique ID and next order position
    - Implement deleteSection(id) to remove section and all its items
    - Implement toggleSectionCollapse(id) to toggle collapsed state
    - Implement moveSectionUp(id) to decrease order and swap with previous section
    - Implement moveSectionDown(id) to increase order and swap with next section
    - _Requirements: 3.1, 3.3, 3.6, 3.7, 3.8, 3.9_

  - [x] 5.3 Write property tests for section management
    - **Property 1: Section creation adds to state**
    - **Validates: Requirements 3.1**
    - **Property 3: Section toggle is idempotent**
    - **Validates: Requirements 3.3**
    - **Property 5: Move up decreases section order**
    - **Validates: Requirements 3.6**
    - **Property 6: Move down increases section order**
    - **Validates: Requirements 3.7**
    - **Property 7: Section deletion removes section and items**
    - **Validates: Requirements 3.8, 3.9**

  - [x] 5.4 Implement item management actions
    - Implement addItem(name, sectionId) to create new item with quantity 1 and isChecked false
    - Implement deleteItem(id) to remove item from state
    - Implement toggleItemCheck(id) to flip isChecked state
    - Implement incrementQuantity(id) to increase quantity by 1
    - Implement decrementQuantity(id) to decrease quantity by 1 (minimum 1)
    - Implement moveItemToSection(itemId, targetSectionId) for drag-and-drop
    - _Requirements: 4.5, 4.9, 5.5, 5.6, 5.7, 6.1, 6.2_

  - [x] 5.5 Write property tests for item management
    - **Property 9: Item submission creates new item**
    - **Validates: Requirements 4.5, 5.2**
    - **Property 10: Duplicate item names are allowed**
    - **Validates: Requirements 4.6**
    - **Property 11: Drag and drop changes item section**
    - **Validates: Requirements 4.7, 4.8**
    - **Property 12: Item deletion removes from state**
    - **Validates: Requirements 4.9**
    - **Property 18: Check toggle changes state**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 5.6 Write property tests for quantity management
    - **Property 14: Quantity increment increases by one**
    - **Validates: Requirements 5.5**
    - **Property 15: Quantity decrement decreases by one when greater than one**
    - **Validates: Requirements 5.6**
    - **Property 16: Quantity has minimum of one**
    - **Validates: Requirements 5.7**


- [x] 6. Implement filtering logic
  - [x] 6.1 Create filter functions for item visibility
    - Implement setFilterMode(mode) to update filterMode in state
    - Implement getVisibleItems() to return items based on current filterMode ('all', 'checked', 'unchecked')
    - Implement text-based filtering with case-insensitive matching on item names
    - _Requirements: 4.2, 4.3, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Write property tests for filtering
    - **Property 8: Text filtering shows matching items only**
    - **Validates: Requirements 4.2, 4.3**
    - **Property 20: Filter mode controls visibility**
    - **Validates: Requirements 7.5**

  - [x] 6.3 Write unit tests for filtering edge cases
    - Test filtering with no matches shows empty state
    - Test empty input field displays all items
    - Test case-insensitive matching
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 7. Checkpoint - Ensure core logic is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create dark theme CSS with responsive layouts
  - [x] 8.1 Implement base styles and dark theme
    - Define CSS variables for dark color scheme (background, text, accent colors)
    - Ensure sufficient contrast between text and background for readability
    - Apply dark theme as default
    - Create consistent styling for all UI components
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.2 Implement responsive layouts
    - Create mobile layout for screens < 768px using CSS Grid/Flexbox
    - Create tablet layout for screens 768px-1024px
    - Use CSS media queries to adapt layout based on viewport size
    - Ensure all interactive elements have minimum 44x44px tap targets
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.3 Write unit tests for responsive layout
    - Test mobile layout applies at 767px width
    - Test tablet layout applies at 768px width
    - Test dark theme CSS variables are defined
    - _Requirements: 2.1, 2.2, 8.1_

  - [x] 8.4 Write property test for touch target sizes
    - **Property 22: Touch targets meet minimum size**
    - **Validates: Requirements 2.4**


- [x] 9. Implement UI components
  - [x] 9.1 Create InputField component
    - Render input field at top of app with placeholder text
    - Implement onInput handler to trigger text-based filtering
    - Implement onSubmit handler to add new item to selected section
    - Clear input field after submission
    - Validate input (reject empty or whitespace-only submissions)
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 9.2 Write unit tests for InputField
    - Test empty input submission is rejected
    - Test whitespace-only input submission is rejected
    - Test input field clears after successful submission
    - _Requirements: 4.1, 4.5_

  - [x] 9.3 Create Section component
    - Render section header with name and collapse/expand toggle
    - Render move up/down buttons for reordering
    - Render delete button
    - Implement collapse/expand toggle to show/hide items
    - Implement drag-and-drop drop zone for items
    - Persist collapsed state in AppState
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.10_

  - [x] 9.4 Write property tests for section rendering
    - **Property 2: All sections are rendered**
    - **Validates: Requirements 3.2**
    - **Property 4: Collapsed sections hide items**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 9.5 Write unit tests for section edge cases
    - Test moving top section up has no effect
    - Test moving bottom section down has no effect
    - Test deleting last section in list
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 9.6 Create Item component
    - Render item name with quantity prefix if quantity >= 2 (format: "2x Item Name")
    - Hide quantity prefix when quantity is 1
    - Render increment (+) and decrement (-) buttons for quantity
    - Render checkbox or tap area for check-off functionality
    - Display checkmark icon and distinct styling for checked items
    - Implement drag-and-drop draggable functionality
    - Render delete button
    - _Requirements: 4.10, 5.1, 5.3, 5.4, 6.3, 6.4_

  - [x] 9.7 Write property tests for item rendering
    - **Property 13: Items render in their parent section**
    - **Validates: Requirements 4.10**
    - **Property 17: Quantity prefix display rule**
    - **Validates: Requirements 5.3, 5.4**
    - **Property 19: Checked items show visual indicator**
    - **Validates: Requirements 6.3, 6.4**
    - **Property 27: All interactive elements have increment/decrement controls**
    - **Validates: Requirements 5.1**

  - [x] 9.8 Create FilterControl component
    - Render toggle buttons for 'all', 'checked', and 'unchecked' filter modes
    - Highlight currently active filter mode
    - Implement onFilterChange handler to update filterMode in state
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.9 Write unit tests for FilterControl
    - Test filter control exists with three modes
    - Test active filter mode is highlighted
    - _Requirements: 7.1_


- [x] 10. Implement AppShell component and wire everything together
  - [x] 10.1 Create AppShell component
    - Initialize state manager and load state from localStorage on mount
    - Render InputField component at top
    - Render FilterControl component
    - Render all Section components with their items
    - Subscribe to state changes and trigger re-renders
    - Implement client-side rendering without page reloads
    - _Requirements: 3.2, 4.1, 7.1, 10.1, 10.3_

  - [x] 10.2 Implement drag-and-drop integration
    - Wire up Item component drag events (onDragStart, onDragEnd)
    - Wire up Section component drop events (onDrop, onDragOver)
    - Transfer itemId and sourceSectionId via DataTransfer API
    - Call moveItemToSection action on successful drop
    - _Requirements: 4.7, 4.8_

  - [x] 10.3 Write unit tests for drag-and-drop integration
    - Test drag and drop data transfer between sections
    - Test drag and drop fallback if API unavailable
    - _Requirements: 4.7, 4.8_

  - [x] 10.4 Write property tests for UI behavior
    - **Property 23: UI updates without page reload**
    - **Validates: Requirements 10.1, 10.3**
    - **Property 24: UI update performance**
    - **Validates: Requirements 10.2**

- [x] 11. Checkpoint - Ensure UI is functional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement error handling and edge cases
  - [x] 12.1 Add error handling for storage operations
    - Display error message when localStorage quota exceeded
    - Suggest clearing checked items or old sections
    - Prevent further additions until space is available
    - _Requirements: 9.1, 9.2_

  - [x] 12.2 Handle orphaned items
    - Detect items with non-existent sectionIds on state load
    - Move orphaned items to a default "Uncategorized" section
    - Log warning for debugging
    - _Requirements: 9.3_

  - [x] 12.3 Handle service worker registration failure
    - Log error if service worker registration fails
    - Display subtle notification that offline mode may not work
    - Allow app to continue functioning with localStorage only
    - _Requirements: 1.2, 11.1_

  - [x] 12.4 Write unit tests for error handling
    - Test orphaned items moved to default section
    - Test service worker registration failure handling
    - _Requirements: 1.2, 9.3_


- [x] 13. Register service worker and finalize PWA setup
  - [x] 13.1 Register service worker in main application file
    - Check if service worker API is available
    - Register service worker on page load
    - Handle registration success and failure
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 13.2 Write unit tests for PWA manifest
    - Test manifest contains required fields (name, icons, theme_color, display)
    - Test manifest includes 192x192 and 512x512 icon sizes
    - _Requirements: 1.1, 1.5_

  - [x] 13.3 Write property test for offline functionality equivalence
    - **Property 26: Offline functionality equivalence**
    - **Validates: Requirements 11.3, 11.4, 11.5**

- [x] 14. Final integration and validation
  - [x] 14.1 Verify all requirements are implemented
    - Test PWA installation on mobile device
    - Test app launches in standalone mode
    - Test all CRUD operations for sections and items
    - Test filtering by text and status
    - Test quantity management
    - Test check-off functionality
    - Test drag-and-drop between sections
    - Test data persistence across app restarts
    - Test offline functionality
    - _Requirements: 1.3, 1.4, 3.1-3.10, 4.1-4.10, 5.1-5.8, 6.1-6.5, 7.1-7.6, 9.1-9.5, 11.1-11.5_

  - [x] 14.2 Write integration tests for full workflows
    - Test complete user workflow: add section, add items, check off, filter
    - Test PWA installation flow
    - Test offline mode with all operations
    - _Requirements: 1.3, 1.4, 11.1-11.5_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check with minimum 100 iterations
- All property tests are tagged with property number and validated requirements
- Checkpoints ensure incremental validation at key milestones
- TypeScript is used throughout for type safety
- Service worker enables offline-first architecture
- localStorage provides data persistence without backend
