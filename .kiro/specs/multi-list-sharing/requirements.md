# Requirements Document

## Introduction

This feature extends the Grocery List PWA from a single-list model to a multi-list model with zero-backend sharing. Users can create, switch between, and manage multiple independent grocery lists. Any list can be shared with another person by encoding the list data into a URL fragment (compressed and base64url-encoded) and sharing that URL via the Web Share API or clipboard. The recipient opens the URL and imports the list into their own local storage. No server infrastructure is required; all data stays client-side.

## Glossary

- **App**: The Grocery List PWA application
- **List**: A named collection of sections and items representing a single grocery list
- **Active_List**: The list currently displayed and editable in the App
- **List_Selector**: The UI component that displays all lists and allows switching between them
- **List_Store**: The localStorage persistence layer that stores all lists
- **Serializer**: The module that converts a List into a compact string representation
- **Deserializer**: The module that reconstructs a List from a compact string representation
- **URL_Encoder**: The module that compresses a serialized List using lz-string and encodes it as a base64url string for use in a URL fragment
- **URL_Decoder**: The module that decodes a base64url URL fragment, decompresses it, and passes the result to the Deserializer
- **Share_Controller**: The module that orchestrates sharing a List via the Web Share API or clipboard fallback
- **Import_Controller**: The module that detects a shared list in the URL fragment on page load and orchestrates importing it

## Requirements

### Requirement 1: Multiple List Management

**User Story:** As a user, I want to create and manage multiple grocery lists, so that I can organize shopping for different stores, occasions, or household members.

#### Acceptance Criteria

1. THE App SHALL display a List_Selector that shows all lists stored in the List_Store.
2. WHEN the user taps "New List" in the List_Selector, THE App SHALL create a new empty List with a default name and set it as the Active_List.
3. WHEN the user selects a list in the List_Selector, THE App SHALL set the selected list as the Active_List and display its sections and items.
4. WHEN the user renames a list, THE App SHALL update the list name in the List_Store.
5. WHEN the user deletes a list, THE App SHALL remove the list and all its sections and items from the List_Store.
6. WHEN the user deletes the Active_List and other lists exist, THE App SHALL set the first remaining list as the Active_List.
7. WHEN the user deletes the only remaining list, THE App SHALL create a new empty default list and set it as the Active_List.
8. THE App SHALL persist the identifier of the Active_List in the List_Store so that the same list is active on next launch.

### Requirement 2: Data Model Migration

**User Story:** As a returning user, I want my existing grocery data preserved when the app upgrades to multi-list support, so that I do not lose any items.

#### Acceptance Criteria

1. WHEN the App loads and detects a version-1 single-list state in localStorage, THE List_Store SHALL migrate the data into a multi-list structure with one list containing the existing sections and items.
2. WHEN migration completes, THE List_Store SHALL update the schema version to the new version number.
3. WHEN the App loads and detects a current-version multi-list state, THE List_Store SHALL load the state without migration.
4. IF the stored state fails validation during migration, THEN THE List_Store SHALL log a warning and create a fresh default state with one empty list.

### Requirement 3: List Serialization and Pretty Printing

**User Story:** As a developer, I want a well-defined serialization format for lists, so that lists can be reliably encoded into URLs and decoded back.

#### Acceptance Criteria

1. THE Serializer SHALL convert a List (name, sections, and items) into a JSON string representation.
2. THE Serializer SHALL exclude transient UI state (filterMode, collapsedSections, selectedSectionId) from the serialized output.
3. THE Serializer SHALL include only the fields necessary to reconstruct the list: list name, and for each section its name and order, and for each item its name, quantity, isChecked, and parent section reference.
4. THE Deserializer SHALL reconstruct a List from a valid JSON string, generating new UUIDs and timestamps for all sections and items.
5. IF the Deserializer receives an invalid or malformed JSON string, THEN THE Deserializer SHALL return a descriptive error.
6. FOR ALL valid List objects, serializing then deserializing SHALL produce a list with equivalent name, section names, section order, item names, item quantities, item checked states, and item-to-section assignments (round-trip property).

### Requirement 4: URL Fragment Encoding and Decoding

**User Story:** As a user, I want my shared list encoded in the URL so that no server is needed to transfer the data.

#### Acceptance Criteria

1. THE URL_Encoder SHALL compress the serialized list string using lz-string and encode the result as a base64url string.
2. THE URL_Encoder SHALL produce a URL in the format `<origin>/#list=<encoded_data>`.
3. THE URL_Decoder SHALL extract the encoded data from a URL fragment matching the pattern `#list=<encoded_data>`.
4. THE URL_Decoder SHALL decode the base64url string, decompress it using lz-string, and pass the result to the Deserializer.
5. IF the URL fragment does not contain a `list=` parameter, THEN THE URL_Decoder SHALL return null to indicate no shared list is present.
6. IF the URL_Decoder encounters invalid base64url data or decompression failure, THEN THE URL_Decoder SHALL return a descriptive error.
7. FOR ALL valid List objects, encoding then decoding SHALL produce an equivalent serialized string (round-trip property).

### Requirement 5: Share via Web Share API with Clipboard Fallback

**User Story:** As a mobile user, I want to share a grocery list using my phone's native share sheet, so that I can send it via text, AirDrop, WhatsApp, or any other app.

#### Acceptance Criteria

1. THE App SHALL display a "Share" button for the Active_List.
2. WHEN the user taps the "Share" button and `navigator.share` is available, THE Share_Controller SHALL invoke `navigator.share()` with the encoded URL as the `url` parameter and the list name as the `title` parameter.
3. WHEN the user taps the "Share" button and `navigator.share` is not available, THE Share_Controller SHALL copy the encoded URL to the clipboard using `navigator.clipboard.writeText()`.
4. WHEN the Share_Controller successfully copies the URL to the clipboard, THE App SHALL display a confirmation notification with the text "Link copied to clipboard".
5. IF `navigator.share()` rejects with an error that is not an AbortError, THEN THE Share_Controller SHALL fall back to copying the URL to the clipboard.
6. IF both `navigator.share()` and `navigator.clipboard.writeText()` are unavailable, THEN THE App SHALL display a notification with the text "Sharing is not supported in this browser".

### Requirement 6: Import Shared List from URL

**User Story:** As a recipient, I want to open a shared URL and have the grocery list added to my app, so that I can view and use the shared list.

#### Acceptance Criteria

1. WHEN the App loads and the URL contains a valid `#list=` fragment, THE Import_Controller SHALL decode the fragment and present the user with a confirmation prompt showing the list name.
2. WHEN the user confirms the import, THE Import_Controller SHALL add the decoded list to the List_Store and set it as the Active_List.
3. WHEN the user cancels the import, THE App SHALL load normally without adding the shared list.
4. WHEN the import completes, THE App SHALL remove the `#list=` fragment from the URL without triggering a page reload.
5. IF the URL fragment contains invalid or corrupted data, THEN THE App SHALL display a notification with the text "Could not load shared list: invalid link" and load normally.
6. THE Import_Controller SHALL generate new unique IDs for all imported sections and items to avoid collisions with existing data.
