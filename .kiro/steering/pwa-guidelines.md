---
description: PWA guidelines for service worker, manifest, offline functionality, and responsive design
inclusion: fileMatch
fileMatchPattern: 'public/**,**/sw*,**/manifest*'
---

# Progressive Web App Guidelines

## PWA Overview

This app is a Progressive Web App (PWA) that provides a native app-like experience with offline functionality, installability, and responsive design.

## Web App Manifest

### Location and Structure

The manifest is located at `public/manifest.webmanifest`:

```json
{
  "name": "Grocery List",
  "short_name": "Grocery",
  "description": "Manage your grocery shopping list offline",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#2d2d2d",
  "theme_color": "#2d2d2d",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Manifest Properties

**name**: Full application name (shown on install prompt)
**short_name**: Abbreviated name (shown on home screen)
**description**: Brief description of the app
**start_url**: URL to load when app is launched
**display**: "standalone" removes browser UI for native feel
**background_color**: Splash screen background color
**theme_color**: Browser UI color (status bar on mobile)
**icons**: App icons for home screen and splash screen

### Icon Requirements

- **192x192**: Minimum size for home screen icon
- **512x512**: High-resolution icon for splash screen
- **Format**: PNG with transparency
- **Location**: `public/icons/`

## Service Worker

### Location and Registration

Service worker is located at `public/sw.js` and registered in `src/index.ts`:

```typescript
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('Service Worker registered:', registration.scope);

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
```

The returned `ServiceWorkerRegistration` is stored by `AppShell` and used by the Force Update feature to trigger manual update checks.
```

### Caching Strategy

The service worker uses a **cache-first** strategy:

1. **Install**: Cache all app resources
2. **Fetch**: Serve from cache if available, fallback to network
3. **Update**: Update cache when new version is available

### Cache Management

```javascript
// Cache name versioning
const CACHE_NAME = 'grocery-list-v1';

// Resources to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/src/index.ts',
  '/src/styles/main.css',
  // ... other resources
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

### Force Update Feature

The app includes a "Force Update" button in the header that lets users manually trigger a service worker update check, clear all caches, and hard-reload the page. The logic lives in `src/forceUpdate.ts` as a testable utility with dependency injection (`ForceUpdateDeps`). The AppShell wires the button click to `handleForceUpdate()`, which provides visual feedback (disabled state, "Updating..." text, toast notifications).

### Service Worker Updates

When deploying a new version:

1. Update `CACHE_NAME` in `sw.js` (e.g., 'grocery-list-v2')
2. Service worker detects change and installs new version
3. Old cache is cleaned up on activation
4. Users get new version on next visit
5. Users can also trigger a manual update via the "Update App" button in the header

### Testing Service Worker

**Development:**
```bash
# Build the app
npm run build

# Serve with a static server
npm run preview

# Open DevTools → Application → Service Workers
# Verify registration and cache contents
```

**Production:**
- Service workers only work over HTTPS (or localhost)
- Test on actual mobile devices
- Verify offline functionality
- Check install prompt appears

## Offline Functionality

### What Works Offline

- View all sections and items
- Add new items
- Check off items
- Modify quantities
- Delete items
- Filter and search
- All UI interactions

### What Requires Network

- Initial app load (first visit)
- Service worker installation
- App updates

### localStorage Persistence

All data is stored in localStorage, which works offline:

```typescript
// Save state on every change
export function saveState(state: AppState): void {
  const serializable = {
    ...state,
    collapsedSections: Array.from(state.collapsedSections),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

// Load state on app start
export function loadState(): AppState {
  const json = localStorage.getItem(STORAGE_KEY);
  if (json === null) {
    return createDefaultState();
  }
  return JSON.parse(json);
}
```

## Installation

### Install Criteria

Browser shows install prompt when:
- Valid manifest.webmanifest exists
- Service worker is registered
- App is served over HTTPS
- User has engaged with the app

### Install Prompt

The browser automatically shows the install prompt. To customize:

```typescript
let deferredPrompt: any;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent default prompt
  e.preventDefault();
  
  // Store event for later use
  deferredPrompt = e;
  
  // Show custom install button
  showInstallButton();
});

function showInstallButton() {
  const installButton = document.getElementById('install-button');
  if (installButton) {
    installButton.style.display = 'block';
    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User ${outcome} the install prompt`);
        deferredPrompt = null;
      }
    });
  }
}
```

### Post-Install

After installation:
- App appears on home screen
- Launches in standalone mode (no browser UI)
- Has its own window in task switcher
- Can be uninstalled like native apps

## Responsive Design

### Mobile-First Approach

Design for mobile first, then enhance for larger screens:

```css
/* Mobile styles (default) */
.app-shell {
  padding: 16px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .app-shell {
    max-width: 768px;
    margin: 0 auto;
    padding: 24px;
  }
}
```

### Touch Targets

Minimum 44x44px for all interactive elements:

```css
.button {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
  touch-action: manipulation; /* Disable double-tap zoom */
}
```

### Viewport Configuration

Set in `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## Performance Optimization

### Bundle Size

Keep bundle small for fast loading:
- Minimize dependencies
- Use tree-shaking
- Code splitting for large features

### Lazy Loading

Load non-critical resources lazily:

```typescript
// Lazy load images
<img loading="lazy" src="..." alt="...">

// Lazy load components
const HeavyComponent = () => import('./HeavyComponent');
```

### Caching Headers

Configure server to send proper cache headers:

```
# Static assets (versioned)
Cache-Control: public, max-age=31536000, immutable

# HTML (always revalidate)
Cache-Control: no-cache

# Service worker (always revalidate)
Cache-Control: no-cache
```

## Testing PWA Features

### Lighthouse Audit

Run Lighthouse in Chrome DevTools:
1. Open DevTools → Lighthouse
2. Select "Progressive Web App" category
3. Run audit
4. Address any issues

### PWA Checklist

- [ ] Manifest is valid and linked
- [ ] Service worker registers successfully
- [ ] App works offline
- [ ] App is installable
- [ ] Icons are correct sizes
- [ ] Theme color matches design
- [ ] App loads fast (< 3s on 3G)
- [ ] Touch targets are adequate
- [ ] Content is readable without zooming
- [ ] HTTPS is enforced

### Mobile Testing

Test on actual devices:
- iOS Safari (iPhone/iPad)
- Chrome on Android
- Different screen sizes
- Different network conditions (3G, offline)

### Browser Compatibility

**Supported:**
- Chrome/Edge (Chromium)
- Safari (iOS/macOS)
- Firefox
- Samsung Internet

**Service Worker Support:**
- All modern browsers
- Not supported in IE11 (graceful degradation)

## Deployment Considerations

### HTTPS Requirement

Service workers require HTTPS:
- Use Let's Encrypt for free SSL
- Most hosting providers include SSL
- localhost works for development

### Server Configuration

Ensure proper MIME types:

```
.webmanifest → application/manifest+json
.js → application/javascript
.css → text/css
```

### Update Strategy

When deploying updates:
1. Increment cache version in service worker
2. Deploy new files
3. Service worker detects change
4. New version installs in background
5. Activates on next app launch

### Rollback Strategy

If issues occur:
1. Revert to previous version
2. Update service worker cache version
3. Old cache is cleaned up
4. Users get stable version

## Debugging PWA Issues

### Service Worker Not Registering

Check:
- HTTPS is enabled (or using localhost)
- Service worker file is at correct path
- No JavaScript errors preventing registration
- Browser supports service workers

### Install Prompt Not Showing

Check:
- Manifest is valid (use Chrome DevTools → Application → Manifest)
- Service worker is registered
- App is served over HTTPS
- User has engaged with the app
- Install criteria are met

### Offline Not Working

Check:
- Service worker is active
- Resources are cached (DevTools → Application → Cache Storage)
- Fetch events are being intercepted
- Network tab shows requests served from service worker

### Cache Not Updating

- Increment cache version in service worker
- Unregister old service worker
- Clear cache storage
- Hard refresh browser
