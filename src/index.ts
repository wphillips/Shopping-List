// Main entry point for the Grocery List PWA
import './styles/main.css';
import { createStateManager, StateManager } from './state';
import { InputField } from './components/InputField';
import { FilterControl } from './components/FilterControl';
import { ListSelector } from './components/ListSelector';
import { Section } from './components/Section';
import { Item } from './components/Item';
import { AppState, MultiListState, GroceryList } from './types';
import { forceUpdate } from './forceUpdate';
import { serialize } from './serializer';
import { encodeListUrl } from './url-codec';
import { shareList, ShareDeps } from './share-controller';
import { checkImportUrl, ImportDeps } from './import-controller';

/**
 * AppShell class - Main application component
 * Orchestrates all components and manages application state
 */
class AppShell {
  private stateManager: StateManager;
  private inputField: InputField;
  private filterControl: FilterControl;
  private listSelector: ListSelector;
  private shareButton: HTMLButtonElement;
  private currentFilterText = '';
  private sectionComponents: Map<string, Section> = new Map();
  private itemComponents: Map<string, Item> = new Map();
  private appContainer: HTMLElement;
  private lastAddSectionId: string | null = null;
  private pendingAddSection: boolean = false;
  private sectionCountBeforeAdd: number = 0;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private updateButton: HTMLButtonElement;

  constructor(appContainer: HTMLElement) {
    this.appContainer = appContainer;
    
    // Initialize state manager and load persisted state from localStorage
    this.stateManager = createStateManager();
    
    // Surface storage quota errors to the user
    this.stateManager.onStorageError = () => {
      this.showNotification('Storage full. Try removing checked items to free space.', 'warning');
    };
    
    // Create app structure
    this.createAppStructure();
    
    // Create update button and add to footer
    this.updateButton = this.createUpdateButton();
    this.updateButton.addEventListener('click', () => this.handleForceUpdate());
    const footer = this.appContainer.querySelector('#app-footer');
    if (footer) {
      footer.appendChild(this.updateButton);
    }
    
    // Initialize InputField component (search-only, no add behavior)
    this.inputField = new InputField({
      placeholder: 'Search items...',
      onInput: this.handleInputChange.bind(this),
      onSubmit: () => {},
    });
    
    // Initialize FilterControl component
    const state = this.stateManager.getState();
    this.filterControl = new FilterControl({
      currentFilter: state.filterMode,
      onFilterChange: this.handleFilterChange.bind(this),
    });

    // Initialize ListSelector component
    this.listSelector = new ListSelector({
      lists: state.lists.map(l => ({ id: l.id, name: l.name })),
      activeListId: state.activeListId,
      onSelect: (listId) => this.stateManager.dispatch({ type: 'SWITCH_LIST', listId }),
      onNew: () => this.stateManager.dispatch({ type: 'CREATE_LIST', name: 'New List' }),
      onRename: (listId, name) => this.stateManager.dispatch({ type: 'RENAME_LIST', listId, name }),
      onDelete: (listId) => this.stateManager.dispatch({ type: 'DELETE_LIST', listId }),
    });

    // Create Share button (icon only)
    this.shareButton = document.createElement('button');
    this.shareButton.className = 'share-btn icon-only';
    this.shareButton.innerHTML = '📤';
    this.shareButton.setAttribute('aria-label', 'Share active list');
    this.shareButton.addEventListener('click', () => this.handleShare());
    
    // Mount components
    this.mountComponents();
    
    // Subscribe to state changes for re-rendering
    this.stateManager.subscribe(this.handleStateChange.bind(this));

    // Check for shared list in URL on init
    this.handleImport();
    
    // Initial render
    this.render();
  }

  /**
   * Create the app structure with containers for all components
   */
  private createAppStructure(): void {
    this.appContainer.innerHTML = `
      <div class="app-shell">
        <div class="app-header">
          <div id="list-selector-container"></div>
          <div id="share-container"></div>
        </div>
        <div id="input-container"></div>
        <div id="filter-container"></div>
        <main id="sections-container" class="sections-container"></main>
        <footer id="app-footer" class="app-footer"></footer>
      </div>
    `;
  }

  /**
   * Mount InputField and FilterControl components
   */
  private mountComponents(): void {
    const listSelectorContainer = document.getElementById('list-selector-container');
    if (listSelectorContainer) {
      listSelectorContainer.appendChild(this.listSelector.getElement());
    }

    const inputContainer = document.getElementById('input-container');
    if (inputContainer) {
      inputContainer.appendChild(this.inputField.getElement());
    }

    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      filterContainer.appendChild(this.filterControl.getElement());
    }

    const shareContainer = document.getElementById('share-container');
    if (shareContainer) {
      shareContainer.appendChild(this.shareButton);
    }
  }

  /**
   * Handle input change for text-based filtering
   */
  private handleInputChange(text: string): void {
    this.currentFilterText = text;
    this.render();
  }

  /**
   * Handle filter mode change from FilterControl
   */
  private handleFilterChange(mode: 'all' | 'checked' | 'unchecked'): void {
    this.stateManager.dispatch({
      type: 'SET_FILTER_MODE',
      mode,
    });
  }

  /**
   * Handle Share button click: serialize active list → encode URL → share
   */
  private async handleShare(): Promise<void> {
    const state = this.stateManager.getState();
    const activeList = state.lists.find(l => l.id === state.activeListId);
    if (!activeList) return;

    const json = serialize(activeList);
    const url = encodeListUrl(json, window.location.origin);

    const deps: ShareDeps = {
      navigatorShare: navigator.share ? (data) => navigator.share(data) : undefined,
      clipboardWriteText: navigator.clipboard?.writeText
        ? (text) => navigator.clipboard.writeText(text)
        : undefined,
    };

    const result = await shareList(url, activeList.name, deps);

    switch (result.status) {
      case 'copied':
        this.showNotification('Link copied to clipboard', 'info');
        break;
      case 'unsupported':
        // Clipboard API unavailable (non-HTTPS) — copy via a hidden textarea as fallback
        this.copyFallback(url);
        this.showNotification('Link copied to clipboard', 'info');
        break;
      // 'shared' — native share sheet handled it, no notification needed
    }
  }

  /**
   * Check URL for shared list on init and handle import flow
   */
  private handleImport(): void {
    const deps: ImportDeps = {
      getHash: () => window.location.search || window.location.hash,
      replaceState: (url) => history.replaceState(null, '', url),
    };

    const result = checkImportUrl(deps);

    if (result.status === 'none') return;

    if (result.status === 'error') {
      console.error('Import error:', result.message, 'Search:', window.location.search.substring(0, 100));
      this.showNotification('Could not load shared list: invalid link', 'error');
      // Remove the query parameter
      history.replaceState(null, '', window.location.pathname);
      return;
    }

    // result.status === 'decoded'
    const confirmed = confirm(`Import shared list "${result.list.name}"?`);

    // Always remove the query parameter
    history.replaceState(null, '', window.location.pathname);

    if (confirmed) {
      this.stateManager.dispatch({ type: 'IMPORT_LIST', list: result.list });
    }
  }

  /**
   * Handle state changes and trigger re-render
   */
  private handleStateChange(state: MultiListState): void {
    // Update FilterControl to reflect current filter mode
    this.filterControl.updateActiveFilter(state.filterMode);

    // Update ListSelector with current lists and active list
    this.listSelector.update({
      lists: state.lists.map(l => ({ id: l.id, name: l.name })),
      activeListId: state.activeListId,
      onSelect: (listId) => this.stateManager.dispatch({ type: 'SWITCH_LIST', listId }),
      onNew: () => this.stateManager.dispatch({ type: 'CREATE_LIST', name: 'New List' }),
      onRename: (listId, name) => this.stateManager.dispatch({ type: 'RENAME_LIST', listId, name }),
      onDelete: (listId) => this.stateManager.dispatch({ type: 'DELETE_LIST', listId }),
    });
    
    // Re-render the UI
    this.render();
  }

  /**
   * Render all sections and items based on current state
   */
  private render(): void {
    const state = this.stateManager.getState();
    const activeList = state.lists.find(l => l.id === state.activeListId);
    const sections = activeList ? activeList.sections : [];
    const sectionsContainer = document.getElementById('sections-container');
    
    if (!sectionsContainer) return;

    // Get filtered items based on text search and filter mode
    const filteredItems = this.currentFilterText
      ? this.stateManager.filterItemsByText(this.currentFilterText)
      : this.stateManager.getVisibleItems();

    // Clear existing components
    sectionsContainer.innerHTML = '';
    this.sectionComponents.clear();
    this.itemComponents.clear();

    // Detect newly added section if an add was pending
    let newlyAddedSectionId: string | null = null;
    if (this.pendingAddSection && sections.length > this.sectionCountBeforeAdd) {
      newlyAddedSectionId = sections[sections.length - 1].id;
      this.pendingAddSection = false;
      this.sectionCountBeforeAdd = 0;
    }

    // Handle empty state message when no sections exist
    if (sections.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-state';
      emptyMsg.textContent = 'No sections yet. Add a section to get started.';
      sectionsContainer.appendChild(emptyMsg);
    } else if (filteredItems.length === 0 && this.currentFilterText) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-state';
      emptyMsg.textContent = 'No items match your search.';
      sectionsContainer.appendChild(emptyMsg);
    } else {
      // Render sections in order
      const sortedSections = [...sections].sort((a, b) => a.order - b.order);
      
      sortedSections.forEach((section) => {
        // Get items for this section
        const sectionItems = filteredItems.filter(item => item.sectionId === section.id);
        
        const isNewlyAdded = newlyAddedSectionId === section.id;

        // Create Section component
        const sectionComponent = new Section({
          id: section.id,
          name: section.name,
          isCollapsed: state.collapsedSections.has(section.id),
          initialRenameMode: isNewlyAdded,
          onToggle: () => this.handleSectionToggle(section.id),
          onMoveUp: () => this.handleSectionMoveUp(section.id),
          onMoveDown: () => this.handleSectionMoveDown(section.id),
          onDelete: () => this.handleSectionDelete(section.id),
          onRename: (id, newName) => this.stateManager.dispatch({ type: 'RENAME_SECTION', id, name: newName }),
          onItemDrop: (itemId) => this.handleItemDrop(itemId, section.id),
          onAddItem: (name) => {
            this.lastAddSectionId = section.id;
            this.stateManager.dispatch({ type: 'ADD_ITEM', name, sectionId: section.id });
          },
        });

        this.sectionComponents.set(section.id, sectionComponent);
        sectionsContainer.appendChild(sectionComponent.getElement());

        // Render items within the section if not collapsed
        if (!state.collapsedSections.has(section.id)) {
          const contentElement = sectionComponent.getContentElement();
          
          if (sectionItems.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'empty-state';
            emptyMsg.textContent = 'No items in this section.';
            contentElement.appendChild(emptyMsg);
          } else {
            sectionItems.forEach((item) => {
              const itemComponent = new Item({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                isChecked: item.isChecked,
                sectionId: item.sectionId,
                onToggleCheck: () => this.handleItemToggleCheck(item.id),
                onIncrement: () => this.handleItemIncrement(item.id),
                onDecrement: () => this.handleItemDecrement(item.id),
                onDelete: () => this.handleItemDelete(item.id),
                onDragStart: (itemId, sectionId) => this.handleItemDragStart(itemId, sectionId),
                onDragEnd: () => this.handleItemDragEnd(),
              });

              this.itemComponents.set(item.id, itemComponent);
              contentElement.appendChild(itemComponent.getElement());
            });
          }

          // Append inline add input after items (hidden when collapsed via CSS)
          contentElement.appendChild(sectionComponent.getAddInputElement());
        }
      });
    }

    // Always render the "Add Section" button
    const addSectionBtn = document.createElement('button');
    addSectionBtn.className = 'add-section-btn';
    addSectionBtn.setAttribute('aria-label', 'Add new section');
    addSectionBtn.innerHTML = '<span aria-hidden="true">+</span> Add Section';
    addSectionBtn.addEventListener('click', () => this.handleAddSection());
    sectionsContainer.appendChild(addSectionBtn);

    // Re-focus inline input after re-render for multi-add flow
    if (this.lastAddSectionId) {
      const sectionComponent = this.sectionComponents.get(this.lastAddSectionId);
      if (sectionComponent) {
        sectionComponent.getAddInputElement().focus();
      }
      this.lastAddSectionId = null;
    }
  }

  /**
   * Handle Add Section button click
   */
  private handleAddSection(): void {
    const state = this.stateManager.getState();
    const activeList = state.lists.find(l => l.id === state.activeListId);
    const sectionCountBefore = activeList ? activeList.sections.length : 0;

    // Dispatch ADD_SECTION — this triggers notifyListeners → handleStateChange → render()
    // We need to identify the new section ID inside the render cycle.
    // Set a flag so the next render knows a section was just added.
    this.pendingAddSection = true;
    this.sectionCountBeforeAdd = sectionCountBefore;
    this.stateManager.dispatch({ type: 'ADD_SECTION', name: 'New Section' });
  }

  // Section action handlers

  private handleSectionToggle(sectionId: string): void {
    this.stateManager.dispatch({
      type: 'TOGGLE_SECTION_COLLAPSE',
      id: sectionId,
    });
  }

  private handleSectionMoveUp(sectionId: string): void {
    this.stateManager.dispatch({
      type: 'MOVE_SECTION_UP',
      id: sectionId,
    });
  }

  private handleSectionMoveDown(sectionId: string): void {
    this.stateManager.dispatch({
      type: 'MOVE_SECTION_DOWN',
      id: sectionId,
    });
  }

  private handleSectionDelete(sectionId: string): void {
    this.stateManager.dispatch({
      type: 'DELETE_SECTION',
      id: sectionId,
    });
  }

  // Item action handlers

  private handleItemToggleCheck(itemId: string): void {
    this.stateManager.dispatch({
      type: 'TOGGLE_ITEM_CHECK',
      id: itemId,
    });
  }

  private handleItemIncrement(itemId: string): void {
    this.stateManager.dispatch({
      type: 'INCREMENT_QUANTITY',
      id: itemId,
    });
  }

  private handleItemDecrement(itemId: string): void {
    this.stateManager.dispatch({
      type: 'DECREMENT_QUANTITY',
      id: itemId,
    });
  }

  private handleItemDelete(itemId: string): void {
    this.stateManager.dispatch({
      type: 'DELETE_ITEM',
      id: itemId,
    });
  }

  // Drag and drop handlers

  private handleItemDragStart(itemId: string, sectionId: string): void {
    // Could add visual feedback here if needed
    console.log(`Dragging item ${itemId} from section ${sectionId}`);
  }

  private handleItemDragEnd(): void {
    // Clean up any drag-related visual feedback
  }

  private handleItemDrop(itemId: string, targetSectionId: string): void {
    this.stateManager.dispatch({
      type: 'MOVE_ITEM_TO_SECTION',
      itemId,
      targetSectionId,
    });
  }

  /**
   * Get the state manager (for debugging/testing)
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Create the force-update button element
   */
  private createUpdateButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = 'Check for updates';
    button.setAttribute('aria-label', 'Check for application updates');
    button.className = 'update-btn';
    return button;
  }

  /**
   * Store the service worker registration for use by the update handler
   */
  setSwRegistration(reg: ServiceWorkerRegistration | null): void {
    this.swRegistration = reg;
  }

  /**
   * Show a notification that offline mode may not be available
   */
  notifyOfflineUnavailable(): void {
    this.showNotification('Offline mode may not be available.', 'info');
  }

  /**
   * Handle force update button click: disable button, call forceUpdate utility,
   * and handle the result with appropriate notifications.
   */
  private async handleForceUpdate(): Promise<void> {
    // Disable button and show loading state
    this.updateButton.disabled = true;
    this.updateButton.textContent = 'Updating...';

    const result = await forceUpdate({
      registration: this.swRegistration,
      caches: window.caches,
      reload: () => location.reload(),
    });

    switch (result.status) {
      case 'unsupported':
        this.showNotification('Updates are not supported in this browser.', 'info');
        this.updateButton.disabled = false;
        this.updateButton.textContent = 'Update App';
        break;
      case 'error':
        this.showNotification(result.message, 'error');
        this.updateButton.disabled = false;
        this.updateButton.textContent = 'Update App';
        break;
      case 'up-to-date':
        this.showNotification('App is already up to date.', 'info');
        this.updateButton.disabled = false;
        this.updateButton.textContent = 'Update App';
        break;
      case 'reloading':
        // Page will reload, no need to re-enable
        break;
    }
  }

  /**
   * Fallback clipboard copy using a temporary textarea (works without HTTPS).
   */
  private copyFallback(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  /**
   * Show a temporary toast notification appended to the app shell.
   */
  private showNotification(message: string, type: 'info' | 'warning' | 'error'): void {
    const appShell = this.appContainer.querySelector('.app-shell');
    if (!appShell) return;

    const toast = document.createElement('div');
    toast.className = `notification notification-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    appShell.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
}

// Initialize the application
function init() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found');
    return;
  }

  // Create AppShell instance
  const appShell = new AppShell(app);
  
  // Register service worker and store registration in AppShell
  registerServiceWorker().then(reg => {
    appShell.setSwRegistration(reg);
    if (!reg && 'serviceWorker' in navigator) {
      // SW API exists but registration failed — notify user
      appShell.notifyOfflineUnavailable();
    }
  });
  
  // For development: Add a default section if none exists
  // This can be removed in production
  if (typeof window !== 'undefined') {
    (window as any).__appShell = appShell;
  }
}

// Register the custom service worker
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered successfully:', registration.scope);
    
    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker available');
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
