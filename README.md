# Grocery List PWA

A Progressive Web App for managing grocery shopping lists with offline functionality.

## Features

- Progressive Web App (installable on mobile devices)
- Offline-first architecture with service worker caching
- Multiple grocery lists with create, rename, delete, and switch
- Section-based organization with drag-and-drop between sections
- Item quantity management (increment/decrement)
- Check-off functionality with uncheck-move-to-top behavior
- Text-based search filtering
- Filter by checked/unchecked status
- Auto-collapse empty sections based on active filter
- List sharing via URL (lz-string compression) with Web Share API and clipboard fallback
- List import from shared URLs
- Force update button for service worker cache clearing
- Dark theme UI
- Responsive design for mobile and tablet
- Storage quota error handling with user notifications

## Build Timestamp

The app displays a build timestamp in the footer so you can verify which build is running. The timestamp is injected at build time via Vite's `define` config, which replaces the `__BUILD_TIMESTAMP__` global constant in the bundle.

- Production builds show the full timestamp (e.g. "Built Mar 16, 2026 9:45 PM")
- In development mode the timestamp shows "Built dev"

The "up to date" notification also includes a short-form timestamp (without the year) when the app confirms it is current.

## Development

### Prerequisites

- Node.js 20+ and npm

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

## Project Structure

```
grocery-list-pwa/
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   └── icon-512x512.png
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── components/
│   │   ├── FilterControl.ts    # Filter mode toggle (all/checked/unchecked)
│   │   ├── InputField.ts       # Search input with debounce
│   │   ├── Item.ts             # Grocery item row (check, quantity, delete, drag)
│   │   ├── ListSelector.ts     # Dropdown list switcher with rename/delete
│   │   └── Section.ts          # Collapsible section with inline add, reorder, rename
│   ├── styles/
│   │   └── main.css            # Global styles (dark theme)
│   ├── forceUpdate.ts          # SW update + cache clear + reload utility
│   ├── import-controller.ts    # URL import detection and decoding
│   ├── index.ts                # AppShell — main orchestrator
│   ├── serializer.ts           # GroceryList ↔ portable JSON for sharing
│   ├── share-controller.ts     # Web Share API + clipboard fallback
│   ├── state.ts                # StateManager with reducer (multi-list)
│   ├── storage.ts              # localStorage persistence (v2 multi-list, v1→v2 migration)
│   ├── types.ts                # Core data model interfaces
│   └── url-codec.ts            # lz-string URL encoding/decoding
├── tests/                      # Unit, integration, and property-based tests
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vite-plugin-sw-cache-version.ts
```

## Architecture

The app follows a component-based architecture using vanilla TypeScript (no framework):

- **AppShell** (`src/index.ts`): Main application component that orchestrates all other components, handles rendering, and wires up event handlers
- **StateManager** (`src/state.ts`): Centralized state management with action dispatching over `MultiListState`. Item/section actions are scoped to the active list. Includes auto-collapse engine for sections with no visible items.
- **Components**: Reusable class-based UI components (InputField, FilterControl, Section, Item, ListSelector). Each owns its DOM element and communicates via callbacks.
- **Storage Layer** (`src/storage.ts`): localStorage persistence with v2 multi-list schema, v1→v2 migration, validation, and error handling
- **Sharing Pipeline**: Four pure-logic modules handle zero-backend list sharing via URL:
  - `serializer.ts` — converts `GroceryList` ↔ portable JSON (no IDs/timestamps)
  - `url-codec.ts` — compresses JSON via lz-string into a URL query parameter
  - `share-controller.ts` — Web Share API with clipboard fallback (dependency-injected)
  - `import-controller.ts` — detects `?list=` on page load, decodes, returns result
- **Force Update** (`src/forceUpdate.ts`): Pure-logic utility for SW update check → cache clear → reload
- **Service Worker** (`public/sw.js`): Offline functionality with cache-first strategy

### Testing the App

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser (usually http://localhost:5173)

3. To test with sample data, open the browser console and run:
   ```javascript
   // Add a section
   __appShell.getStateManager().dispatch({ type: 'ADD_SECTION', name: 'Produce' });
   
   // Get the section ID from the state
   const state = __appShell.getStateManager().getState();
   const activeList = state.lists.find(l => l.id === state.activeListId);
   const sectionId = activeList.sections[0].id;
   
   // Add some items
   __appShell.getStateManager().dispatch({ type: 'ADD_ITEM', name: 'Apples', sectionId });
   __appShell.getStateManager().dispatch({ type: 'ADD_ITEM', name: 'Bananas', sectionId });
   ```

4. Test the features:
   - Create and switch between multiple lists using the dropdown
   - Add sections and items within each list
   - Filter items by typing in the search field
   - Toggle item check status by clicking the checkbox
   - Increment/decrement quantities using +/- buttons
   - Drag and drop items between sections
   - Collapse/expand sections
   - Use filter controls to show all/checked/unchecked items
   - Share a list via the share button (copies URL to clipboard)
   - Import a shared list by opening a shared URL
   - Refresh the page to verify data persistence

## Credits

App icon by [Flaticon](https://www.flaticon.com) — free for personal and commercial use with attribution.

## Requirements

See `.kiro/specs/grocery-list-pwa/requirements.md` for detailed requirements.
