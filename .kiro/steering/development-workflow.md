---
description: Development workflow covering prerequisites, setup, build, test, and deployment commands
inclusion: auto
---

# Development Workflow

## Getting Started

### Prerequisites

- Node.js 20+ and npm (see `package.json` for exact dependency versions)
- Modern browser with service worker support

### Initial Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Development Commands

### Development Server

```bash
npm run dev
```

Starts Vite dev server with:
- Hot module replacement (HMR)
- TypeScript compilation
- Instant feedback on changes
- Usually runs on http://localhost:5173

### Building for Production

```bash
npm run build
```

Creates optimized production build:
1. TypeScript compilation (`tsc`)
2. Vite bundling and minification
3. Output to `dist/` directory

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally for testing before deployment.

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

## Testing

See the dedicated `testing.md` steering doc for testing guidelines, property-based testing patterns, and bugfix methodology.

## Adding New Features

For the step-by-step guide on adding new features (types → state → storage → components → AppShell → styles → tests), reference the `#feature-guide` steering doc.

The general flow is: types.ts → state.ts → storage.ts → pure-logic modules → components/ → index.ts → main.css → tests/

## Requirements Reference

#[[file:.kiro/specs/grocery-list-pwa/requirements.md]]

## Debugging

### Browser DevTools

Use browser console to access the app instance:

```javascript
// Access state manager (available in development)
const state = __appShell.getStateManager().getState()

// Get the active list
const activeList = state.lists.find(l => l.id === state.activeListId)

// Dispatch actions manually
__appShell.getStateManager().dispatch({
  type: 'ADD_SECTION',
  name: 'Test Section'
})
```

### Common Issues

**Service Worker Caching**

If changes aren't appearing:
1. Open DevTools → Application → Service Workers
2. Click "Unregister" or "Update"
3. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

**localStorage Issues**

Clear stored state:
```javascript
localStorage.removeItem('grocery-list-state')
location.reload()
```

**TypeScript Errors**

Run type checking:
```bash
npx tsc --noEmit
```

## Git Workflow

### Branching

- ALWAYS create a feature branch BEFORE starting any spec work (including requirements): `feat/{spec-name}` (e.g., `feat/aws-terraform-iac`)
- For bugfix specs, use `fix/{spec-name}` (e.g., `fix/quantity-zero-crash`)
- This is the FIRST step — before creating any files or documents
- Branch from `main` unless the user specifies otherwise

### Spec Files

- Spec files (`.kiro/specs/`) are committed to the repo for documentation purposes
- Include spec files (`requirements.md`, `design.md`, `tasks.md`) in the feature/fix branch commits
- `.kiro/specs/*/.config.kiro` files are gitignored (internal config, not documentation)
- `.kiro/settings/` is gitignored (local settings)

### Commits

- Offer commits at logical milestones during spec task execution (e.g., after checkpoint tasks or completing a group of related tasks)
- Use conventional commit messages:
  - `feat: <description>` for new features
  - `fix: <description>` for bug fixes
  - `chore: <description>` for infrastructure, tooling, or maintenance
  - `test: <description>` for test-only changes
- Keep commits atomic — one logical change per commit when possible
- Include the spec name or task reference in the commit body when relevant

### Pushing

- After all spec tasks are complete and committed, offer to push to the remote (`git push origin <branch>`)
- Remind the user that commits are local-only until pushed

### Merge and Deploy

After all spec tasks are complete, tests pass, and the branch is pushed:

1. **Prompt the user** to merge into `main` and deploy
2. If approved:
   - Checkout `main`, merge the feature/fix branch with `--no-ff`, and push `main` to origin
   - Build for production: `npx vite build`
   - Deploy to S3: `aws s3 sync dist/ s3://shopping-app-pwa-8f1e306a --delete --region us-west-2`
   - Invalidate CloudFront: `aws cloudfront create-invalidation --distribution-id E1GNSB6NAC6Z1Q --paths "/*" --region us-west-2`
3. Confirm deployment succeeded and the site is live

This is the FINAL step of every spec — do not skip it or leave the user without a prompt.

## Code Review Checklist

Before submitting changes:

- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Code follows style guidelines
- [ ] New code has test coverage
- [ ] Documentation updated if needed
- [ ] No console.log statements (use console.warn/error for intentional logging)
- [ ] Accessibility considerations addressed
- [ ] Mobile responsiveness verified

## Performance Considerations

### Rendering Performance

- Full re-render is acceptable for this app size
- If performance becomes an issue, consider:
  - Virtual DOM library (React, Preact)
  - Incremental rendering
  - Component memoization

### Bundle Size

Monitor bundle size:
```bash
npm run build
# Check dist/ folder size
```

Keep dependencies minimal:
- Avoid large libraries for simple tasks
- Use tree-shaking friendly imports
- Consider code splitting for large features

### Service Worker Updates

Test service worker updates:
1. Make changes to app code
2. Build: `npm run build`
3. Deploy new version
4. Verify service worker updates on client
5. Test that new version loads correctly

## Deployment

### Build Process

```bash
# 1. Run tests
npm test

# 2. Build for production
npm run build

# 3. Preview build locally
npm run preview

# 4. Deploy dist/ folder to hosting service
```

### Hosting Target

This app is hosted as a static site on S3 with CloudFront in front for HTTPS (required by service workers). The `dist/` folder produced by `npm run build` is deployed directly to the S3 bucket.

Key constraints this imposes:
- No server-side logic — all state lives in localStorage on the client
- CloudFront must be configured to serve `index.html` for all routes (SPA fallback)
- Proper MIME types for `.webmanifest` and `.js` files must be set on the S3 objects or via CloudFront response headers
- Cache invalidation on CloudFront after each deploy to ensure users get the latest version

### Post-Deployment Verification

- [ ] App loads correctly
- [ ] Service worker registers successfully
- [ ] App is installable on mobile devices
- [ ] Offline functionality works
- [ ] All features work as expected
- [ ] No console errors

## Troubleshooting

### Tests Failing

```bash
# Clear test cache
npm test -- --clearCache

# Run tests with verbose output
npm test -- --reporter=verbose

# Run single test file
npm test -- tests/specific-test.test.ts
```

### Build Errors

```bash
# Clean build artifacts
rm -rf dist node_modules/.vite

# Reinstall dependencies
npm install

# Try build again
npm run build
```

### Service Worker Issues

```bash
# Unregister all service workers in DevTools
# Application → Service Workers → Unregister

# Clear all caches
# Application → Cache Storage → Delete all

# Hard refresh
# Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```
