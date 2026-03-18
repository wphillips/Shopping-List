# Bugfix Requirements Document

## Introduction

When a user who already has multiple grocery lists in the app imports a shared list via a `?list=` URL, the import process overwrites or loses the user's existing lists instead of appending the imported list alongside them. The user ends up with only the imported list (and possibly a fresh default list), while their previously created lists and all their contents are gone. This is a data-loss bug that undermines trust in the multi-list feature.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user has multiple existing lists in localStorage and navigates to an import URL (`?list=...`), THEN the system loses the user's existing lists during the import process, resulting in only the imported list (and possibly a default empty list) being present after import.

1.2 WHEN a user has a single existing list with sections and items and imports a shared list via URL, THEN the system replaces the user's existing list data instead of preserving it alongside the imported list.

1.3 WHEN the app initializes on a page load triggered by an import URL and `loadMultiListState()` encounters a validation edge case, THEN the system silently falls back to a default empty state, discarding all previously persisted lists before the import is processed.

### Expected Behavior (Correct)

2.1 WHEN a user has multiple existing lists in localStorage and imports a shared list via URL, THEN the system SHALL append the imported list to the existing lists array, preserving all previously stored lists and their contents intact.

2.2 WHEN a user has a single existing list with sections and items and imports a shared list via URL, THEN the system SHALL keep the existing list unchanged and add the imported list as an additional list entry.

2.3 WHEN the app initializes on a page load triggered by an import URL, THEN the system SHALL reliably load all existing lists from localStorage before processing the import, ensuring no data is lost during the load-then-import sequence.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user imports a shared list and no prior lists exist in localStorage (fresh install), THEN the system SHALL CONTINUE TO create a default list and add the imported list alongside it.

3.2 WHEN a user imports a shared list, THEN the system SHALL CONTINUE TO set the imported list as the active list after import.

3.3 WHEN a user imports a shared list, THEN the system SHALL CONTINUE TO remove the `?list=` query parameter from the URL without triggering a page reload.

3.4 WHEN a user declines the import confirmation prompt, THEN the system SHALL CONTINUE TO load normally without adding the shared list and without modifying existing lists.

3.5 WHEN the import URL contains invalid or corrupted data, THEN the system SHALL CONTINUE TO display the "Could not load shared list: invalid link" notification and load all existing lists normally.

3.6 WHEN a user creates, deletes, renames, or switches between lists without importing, THEN the system SHALL CONTINUE TO persist and load all list data correctly.
