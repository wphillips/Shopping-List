# Viewport Zoom Overflow Fix — Bugfix Design

## Overview

On mobile devices, the Grocery List PWA loads slightly zoomed in, allowing users to pan horizontally and vertically beyond the intended content area. The root cause is a combination of an insufficiently constrained viewport meta tag (missing `maximum-scale` and `user-scalable` directives) and the absence of `overflow-x: hidden` on the document root elements. Additionally, fixed-position elements (`.install-prompt-banner`, `.notification`) spanning the full viewport width may contribute to horizontal overflow. The fix is purely declarative — HTML meta tag update and CSS additions — with no JavaScript changes required.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the app is loaded on a mobile device where the viewport meta tag allows zoom drift and/or CSS does not constrain horizontal overflow
- **Property (P)**: The desired behavior — the app renders at exactly 100% scale with no horizontal or vertical panning beyond the content area
- **Preservation**: Existing desktop layout, vertical scrolling, install prompt banner functionality, notification toast display, and list selector dropdown behavior must remain unchanged
- **viewport meta tag**: The `<meta name="viewport">` element in `index.html` that controls mobile browser scaling behavior
- **overflow-x: hidden**: CSS property that clips content exceeding the element's horizontal boundary, preventing horizontal scroll

## Bug Details

### Bug Condition

The bug manifests when the app is loaded on a mobile device and the viewport meta tag does not include `maximum-scale=1.0` and `user-scalable=no`, allowing the browser to render the page at a scale slightly above 100%. Combined with the absence of `overflow-x: hidden` on `html` and `body`, any child element that exceeds the viewport width (e.g., fixed-position banners with padding/borders) causes the entire page to become horizontally scrollable.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PageLoadContext
  OUTPUT: boolean

  RETURN input.device == "mobile"
         AND (viewportMetaTag.maximumScale IS NOT SET OR viewportMetaTag.userScalable != "no")
         AND (htmlElement.overflowX != "hidden" OR bodyElement.overflowX != "hidden")
         AND (pageContentWidth > viewportWidth OR browserAppliesZoomDrift)
END FUNCTION
```

### Examples

- **Example 1**: User opens the PWA on an iPhone Safari. The page loads at ~101% zoom. The user can drag left/right to see a thin strip of background beyond the app content. Expected: page locked at 100%, no horizontal panning.
- **Example 2**: The install prompt banner renders at the bottom with `left: 0; right: 0; padding: 0.75rem 1rem`. On a 375px-wide device, the banner's total rendered width including padding may push past the viewport. Expected: banner contained within viewport, no overflow.
- **Example 3**: A notification toast uses `left: 50%; transform: translateX(-50%); max-width: calc(100% - 2rem)`. While this is generally safe, without `overflow-x: hidden` on the body, any sub-pixel rounding could contribute to overflow. Expected: no horizontal scroll regardless.
- **Edge case**: On desktop browsers, the viewport meta tag changes have no effect since desktop browsers ignore `user-scalable` and `maximum-scale`. Expected: no change in desktop behavior.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Desktop layout with `#app` max-width of 1024px must continue to render correctly
- Install prompt banner must continue to display at the bottom, respond to show/dismiss/install actions
- Notification toasts must continue to appear centered at the bottom with correct styling and fade-in animation
- Vertical scrolling through long grocery lists must remain fully functional
- List selector dropdown must continue to display with proper z-index stacking and positioning

**Scope:**
All inputs that do NOT involve mobile viewport scaling or horizontal overflow should be completely unaffected by this fix. This includes:
- All desktop browser rendering
- All vertical scrolling behavior
- All interactive element functionality (buttons, checkboxes, inputs, dropdowns)
- All animation and transition behavior

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Incomplete Viewport Meta Tag**: The current meta tag is `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. It lacks `maximum-scale=1.0` and `user-scalable=no`, which allows mobile browsers to apply slight zoom drift on page load or during touch interactions.

2. **Missing overflow-x Constraint on Document Root**: Neither `html` nor `body` has `overflow-x: hidden`. Any child element that renders even 1px wider than the viewport causes the entire page to become horizontally scrollable.

3. **Fixed-Position Elements Causing Overflow**: The `.install-prompt-banner` uses `left: 0; right: 0; padding: 0.75rem 1rem` with `box-sizing: border-box` (from the universal reset). While `border-box` should contain the padding, the combination of `position: fixed` spanning full width plus `border-top: 1px solid` could interact with sub-pixel rendering to cause overflow on some mobile browsers.

4. **Notification Toast Width Calculation**: The `.notification` uses `max-width: calc(100% - 2rem)` with `left: 50%; transform: translateX(-50%)`. This is generally safe but without root-level overflow clipping, edge cases in browser rendering could contribute to horizontal scroll.

## Correctness Properties

Property 1: Bug Condition — Mobile Viewport Renders at Exactly 100% Scale

_For any_ mobile page load where the bug condition holds (device is mobile, viewport previously allowed zoom drift, and root elements lacked overflow constraints), the fixed HTML and CSS SHALL render the page at exactly 100% scale with no ability to pan or scroll horizontally beyond the content area.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Existing Layout and Functionality Unchanged

_For any_ input where the bug condition does NOT hold (desktop browsers, vertical scrolling, interactive element usage, animation triggers), the fixed code SHALL produce exactly the same visual rendering and functional behavior as the original code, preserving desktop layout, install prompt functionality, notification display, vertical scrolling, and dropdown behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `index.html`

**Element**: `<meta name="viewport">`

**Specific Changes**:
1. **Update viewport meta tag**: Change from `width=device-width, initial-scale=1.0` to `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no` to prevent zoom drift on mobile devices.

**File**: `src/styles/main.css`

**Selectors**: `html`, `body`, `.install-prompt-banner`, `.notification`

**Specific Changes**:
2. **Add overflow-x: hidden to html and body**: Add a rule for `html, body` with `overflow-x: hidden` to prevent any horizontal scrolling caused by child elements exceeding viewport width.

3. **Constrain install-prompt-banner width**: Add `max-width: 100vw` and `overflow-x: hidden` to `.install-prompt-banner` to ensure the fixed-position banner cannot cause horizontal overflow even with padding and borders.

4. **Constrain notification width**: Add `overflow-x: hidden` to `.notification` as a defensive measure to ensure the toast cannot contribute to horizontal overflow.

5. **Add width: 100% to html and body**: Explicitly set `width: 100%` on both `html` and `body` to ensure they don't exceed the viewport width.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. Since this is a CSS/HTML-only fix, testing focuses on DOM structure validation and computed style assertions rather than behavioral JavaScript testing.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that parse `index.html` for the viewport meta tag content and inspect `main.css` for the presence of overflow constraints. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **Viewport Meta Tag Test**: Assert that the viewport meta tag includes `maximum-scale=1.0` and `user-scalable=no` (will fail on unfixed code)
2. **Root Overflow Test**: Assert that `html` and `body` have `overflow-x: hidden` in the CSS (will fail on unfixed code)
3. **Banner Overflow Test**: Assert that `.install-prompt-banner` has overflow constraints preventing horizontal overflow (will fail on unfixed code)
4. **Notification Overflow Test**: Assert that `.notification` has overflow constraints (may fail on unfixed code)

**Expected Counterexamples**:
- Viewport meta tag missing `maximum-scale` and `user-scalable` directives
- No `overflow-x: hidden` rule found for `html` or `body` elements
- Possible causes: incomplete viewport meta tag, missing CSS overflow constraints

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed HTML and CSS produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := parseFixedHTML(input)
  ASSERT viewportMetaContains(result, "maximum-scale=1.0")
  ASSERT viewportMetaContains(result, "user-scalable=no")
  ASSERT cssRuleExists(result, "html, body", "overflow-x", "hidden")
  ASSERT noElementExceedsViewportWidth(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderOriginal(input) = renderFixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It can generate many CSS property combinations to verify no regressions
- It catches edge cases in element sizing that manual tests might miss
- It provides strong guarantees that non-mobile behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for desktop rendering, vertical scrolling, and interactive elements, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Desktop Layout Preservation**: Verify that `#app` max-width of 1024px and centering behavior is unchanged after fix
2. **Install Prompt Preservation**: Verify that `.install-prompt-banner` still renders correctly with all child elements (message, install button, dismiss button) properly laid out
3. **Notification Preservation**: Verify that `.notification` still renders centered at bottom with correct max-width and animation
4. **Vertical Scroll Preservation**: Verify that `overflow-y` is not affected — vertical scrolling through long lists continues to work
5. **Dropdown Preservation**: Verify that `.list-selector__dropdown` z-index and positioning are unaffected

### Unit Tests

- Test that `index.html` viewport meta tag contains all required directives
- Test that `main.css` includes `overflow-x: hidden` on `html` and `body`
- Test that fixed-position elements have overflow constraints
- Test that no CSS rule inadvertently blocks vertical scrolling

### Property-Based Tests

- Generate random viewport widths and verify that the CSS rules prevent horizontal overflow for all widths
- Generate random content lengths and verify vertical scrolling is preserved
- Test that all fixed-position elements remain within viewport bounds across device sizes

### Integration Tests

- Test full page load on simulated mobile viewport to verify no horizontal scroll
- Test install prompt banner display and interaction after CSS changes
- Test notification toast appearance and animation after CSS changes
- Test list selector dropdown overlay positioning after CSS changes
