# Bugfix Requirements Document

## Introduction

On mobile devices, the Grocery List PWA sometimes loads slightly zoomed in (not at 100% viewport scale). This causes the page to have "play" — users can pan/scroll horizontally and vertically beyond the intended content area. Pinch-zooming out to minimum resolves the issue, indicating that certain elements overflow the viewport width and the viewport meta tag does not sufficiently constrain the initial scale. This is a classic mobile viewport overflow bug that degrades the native-app feel of the PWA.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the app loads on a mobile device THEN the viewport may render slightly zoomed in beyond 100%, allowing the user to pan left/right and up/down beyond the content area

1.2 WHEN the viewport meta tag is set to `width=device-width, initial-scale=1.0` without `maximum-scale` or `user-scalable` constraints THEN the browser may allow accidental zoom drift on load, resulting in the page not being locked at 100% scale

1.3 WHEN full-width fixed-position elements (e.g., `.install-prompt-banner`, `.notification`) are rendered THEN they may contribute to horizontal overflow because they span `left: 0` to `right: 0` (or use `100%` width plus padding/borders) without `overflow-x: hidden` on the document root

1.4 WHEN the `html` and `body` elements have no explicit overflow constraints THEN any child element that exceeds the viewport width causes the entire page to become horizontally scrollable

### Expected Behavior (Correct)

2.1 WHEN the app loads on a mobile device THEN the system SHALL render at exactly 100% scale with no ability to pan or scroll beyond the content area

2.2 WHEN the viewport meta tag is configured THEN the system SHALL include `maximum-scale=1.0` and `user-scalable=no` to prevent accidental zoom drift on mobile devices

2.3 WHEN full-width fixed-position elements are rendered THEN the system SHALL ensure they do not cause horizontal overflow beyond the viewport width

2.4 WHEN the `html` and `body` elements are styled THEN the system SHALL include `overflow-x: hidden` to prevent any horizontal scrolling caused by child elements

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the app is viewed on desktop browsers THEN the system SHALL CONTINUE TO render the layout correctly with the existing max-width constraint on `#app`

3.2 WHEN the user interacts with the install prompt banner at the bottom of the screen THEN the system SHALL CONTINUE TO display and function correctly (show, dismiss, install actions)

3.3 WHEN notification toasts appear THEN the system SHALL CONTINUE TO display centered at the bottom of the viewport with correct styling and animation

3.4 WHEN the user scrolls vertically through a long grocery list THEN the system SHALL CONTINUE TO allow normal vertical scrolling

3.5 WHEN the list selector dropdown is opened THEN the system SHALL CONTINUE TO display the dropdown overlay correctly with proper z-index stacking
