# Requirements Document

## Introduction

This feature adds collaborative list merging to the Grocery List PWA. When a user receives a shared list that matches an existing local list, the app merges the incoming list into the local copy instead of creating a duplicate. The merge follows additive-only semantics: new items are added, checked states are updated conservatively, and no items are ever removed. This enables a lightweight two-person collaboration workflow without requiring a database or real-time sync.

## Glossary

- **Merge_Engine**: The pure function that accepts a local GroceryList and an incoming GroceryList and produces a merged GroceryList according to the merge rules.
- **Item**: A grocery item with a unique ID, name, quantity, checked state, and section assignment.
- **Section**: A named grouping of items within a list (e.g., "Produce", "Dairy").
- **Local_List**: The GroceryList currently stored on the receiving user's device.
- **Incoming_List**: The GroceryList decoded from a shared URL sent by another user.
- **Import_Controller**: The module that detects shared list data in the URL and coordinates import or merge.
- **Serializer**: The module that converts a GroceryList to and from a portable JSON format for sharing.
- **Item_ID**: The stable unique identifier (UUID) assigned to each Item at creation time.
- **List_ID**: The unique identifier assigned to each GroceryList, used to determine if two lists represent the same list.

## Requirements

### Requirement 1: List Identity Matching

**User Story:** As a user receiving a shared list, I want the app to detect when the incoming list matches one I already have, so that the lists are merged instead of duplicated.

#### Acceptance Criteria

1. WHEN an incoming list is decoded from a shared URL, THE Import_Controller SHALL compare the Incoming_List name against all Local_List names to find a match.
2. WHEN exactly one Local_List name matches the Incoming_List name, THE Import_Controller SHALL invoke the Merge_Engine with the matched Local_List and the Incoming_List.
3. WHEN no Local_List name matches the Incoming_List name, THE Import_Controller SHALL import the Incoming_List as a new list (existing behavior).
4. WHEN multiple Local_List names match the Incoming_List name, THE Import_Controller SHALL present the user with a choice to select which list to merge into or to import as a new list.

### Requirement 2: Additive Item Merge

**User Story:** As a user, I want new items from the incoming list to appear in my local list after a merge, so that I see everything my collaborator added.

#### Acceptance Criteria

1. WHEN the Incoming_List contains an Item whose name does not match any Item name in the same Section of the Local_List, THE Merge_Engine SHALL add that Item to the Local_List in the corresponding Section.
2. THE Merge_Engine SHALL assign a new Item_ID to each newly added Item to avoid ID collisions with existing local items.
3. WHEN the Incoming_List contains a Section that does not exist in the Local_List, THE Merge_Engine SHALL create that Section in the Local_List and add all of the Section's items.
4. THE Merge_Engine SHALL append newly added Items after existing Items within their Section.

### Requirement 3: Unchecked-Wins Check-State Merge

**User Story:** As a user, I want the merge to treat "unchecked" as "still need to buy," so that if either my list or the incoming list says an item is still needed, the merged result keeps it unchecked — I'd rather accidentally buy something twice than miss it.

#### Acceptance Criteria

1. WHEN a matching Item is unchecked in the Local_List and checked in the Incoming_List, THE Merge_Engine SHALL keep the Item unchecked in the merged result.
2. WHEN a matching Item is checked in the Local_List and unchecked in the Incoming_List, THE Merge_Engine SHALL mark the Item as unchecked in the merged result.
3. WHEN a matching Item is checked in both the Local_List and the Incoming_List, THE Merge_Engine SHALL keep the Item checked in the merged result.
4. WHEN a matching Item is unchecked in both the Local_List and the Incoming_List, THE Merge_Engine SHALL keep the Item unchecked in the merged result.
5. IN SUMMARY, THE Merge_Engine SHALL mark a matching Item as checked ONLY WHEN the Item is checked in both the Local_List and the Incoming_List; otherwise the Item SHALL be unchecked.

### Requirement 4: No Item Removal

**User Story:** As a user, I want to be sure that merging never removes items from my list, so that I don't lose anything I've added locally.

#### Acceptance Criteria

1. THE Merge_Engine SHALL produce a merged list that contains every Item present in the Local_List before the merge.
2. THE Merge_Engine SHALL produce a merged list that contains every Item present in the Incoming_List (either matched to an existing local Item or added as a new Item).
3. THE Merge_Engine SHALL preserve the quantity of each local Item unchanged during a merge.

### Requirement 5: Section Handling During Merge

**User Story:** As a user, I want sections to be handled sensibly during a merge so that items stay organized.

#### Acceptance Criteria

1. WHEN the Incoming_List contains a Section that does not exist in the Local_List, THE Merge_Engine SHALL create that Section in the Local_List and preserve its order relative to other new Sections.
2. WHEN a matching Item exists in different Sections in the Local_List and the Incoming_List, THE Merge_Engine SHALL keep the Item in its Local_List Section.
3. THE Merge_Engine SHALL preserve all existing Sections in the Local_List, including Sections that have no matching counterpart in the Incoming_List.

### Requirement 6: Item Matching Strategy

**User Story:** As a user, I want items to be matched by name within their section so that the merge correctly identifies the same item even after IDs change during serialization.

#### Acceptance Criteria

1. THE Merge_Engine SHALL match Items between the Local_List and the Incoming_List by comparing Item name and Section name (case-insensitive).
2. WHEN two Items in the same Section of the Incoming_List have the same name, THE Merge_Engine SHALL treat each as a distinct Item and add duplicates that do not match an existing local Item.
3. WHEN an Item name matches in a different Section, THE Merge_Engine SHALL treat the Items as distinct (no cross-section matching).

### Requirement 7: Merge Convergence

**User Story:** As a user collaborating by sending lists back and forth, I want repeated merges to converge to a stable result so that ping-ponging doesn't create duplicates or conflicts.

#### Acceptance Criteria

1. WHEN a merged list is serialized, shared, and merged back into the original sender's list, THE Merge_Engine SHALL produce a result identical to the previously merged list (idempotent merge).
2. THE Merge_Engine SHALL produce the same merged result regardless of whether User A merges User B's list or User B merges User A's list (commutative merge), given the same starting states.

### Requirement 8: Merge Serialization Round-Trip

**User Story:** As a developer, I want the serialized form of a merged list to survive a round-trip through the Serializer so that sharing a merged list works correctly.

#### Acceptance Criteria

1. FOR ALL valid GroceryList objects produced by the Merge_Engine, serializing then deserializing the list SHALL produce a GroceryList with equivalent name, section names, item names, item quantities, and item checked states (round-trip property).
2. THE Serializer SHALL handle merged lists that contain newly added Sections and Items without validation errors.

### Requirement 9: Merge User Experience

**User Story:** As a user, I want clear feedback when a merge happens so that I understand what changed in my list.

#### Acceptance Criteria

1. WHEN a merge is completed, THE Import_Controller SHALL display a notification indicating the number of new Items added and the number of Items whose check state was updated.
2. WHEN a merge is completed, THE Import_Controller SHALL switch the active list to the merged list.
3. WHEN a merge produces no changes (the Incoming_List is a subset of the Local_List), THE Import_Controller SHALL display a notification indicating the lists are already in sync.

### Requirement 10: Error Handling During Merge

**User Story:** As a user, I want the merge to handle errors gracefully so that my local list is never corrupted.

#### Acceptance Criteria

1. IF the Incoming_List contains invalid or corrupted data, THEN THE Import_Controller SHALL display an error message and leave the Local_List unchanged.
2. IF the merge operation fails for any reason, THEN THE Import_Controller SHALL leave the Local_List in its pre-merge state.
3. IF the Incoming_List is empty (contains no Sections or Items), THEN THE Merge_Engine SHALL return the Local_List unchanged.
