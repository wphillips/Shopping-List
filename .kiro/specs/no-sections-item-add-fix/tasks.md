# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Auto-create Default Section on Empty State
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that when sections array is empty AND user submits a valid item name, the system should create a default section and add the item (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design:
    - After submission, state.sections.length should equal 1
    - The created section should be named "Groceries"
    - The item should be added to the newly created section
    - Item should have correct properties (quantity: 1, isChecked: false)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "Item 'Milk' not added when sections array is empty, console shows warning")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Section Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (when sections exist)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - When sections exist and user adds item, item is added to selected section (or first if none selected)
    - Item properties remain correct (quantity: 1, isChecked: false, correct sectionId)
    - Section selection logic works as before
    - Multiple sequential item additions work correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for no sections item add bug

  - [x] 3.1 Implement the fix in handleItemSubmit
    - Add check for empty sections array before existing section selection logic
    - If state.sections.length === 0, dispatch ADD_SECTION action with name "Groceries"
    - Get updated state after section creation to retrieve new section ID
    - Dispatch SET_SELECTED_SECTION action with the new section's ID
    - Ensure existing logic for section selection and item addition remains unchanged
    - _Bug_Condition: isBugCondition(input) where input.currentState.sections.length === 0 AND input.itemName.trim().length > 0_
    - _Expected_Behavior: Create default section "Groceries", add item to it with correct properties (quantity: 1, isChecked: false)_
    - _Preservation: When sections exist, continue to add items to selected section or first section if none selected, with all existing properties and behavior unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Auto-create Default Section on Empty State
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Section Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
