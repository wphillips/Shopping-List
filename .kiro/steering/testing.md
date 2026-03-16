---
description: Testing guidelines for unit tests, property-based tests, and test file conventions
inclusion: auto
---

# Testing Guidelines

## Framework

- Vitest with jsdom environment
- fast-check for property-based testing
- Test files in `tests/` directory

## Test File Naming

```
tests/{ComponentName}.test.ts          # Unit tests
tests/{ComponentName}.integration.test.ts  # Integration tests
tests/{module}.properties.test.ts      # Property-based tests
tests/{feature-name}.properties.test.ts     # Feature property-based tests
tests/{feature-name}.unit.test.ts          # Feature unit tests
tests/{bugfix-name}.exploration.test.ts    # Bug exploration tests
tests/{bugfix-name}.preservation.test.ts   # Preservation tests
tests/AppShell.{feature-name}.test.ts      # AppShell integration tests per feature
tests/{module-name}.unit.test.ts           # Module-specific unit tests (e.g., serializer, url-codec)
tests/{module-name}.properties.test.ts     # Module-specific property tests
```

## Running Tests

```bash
npm test                              # Run all tests once
npm run test:watch                    # Watch mode
npm test -- tests/state.test.ts       # Single file
npm test -- InputField                # Pattern match
npm test -- --coverage                # With coverage
npm test -- --reporter=verbose        # Verbose output
```

## Test Structure

Use Arrange-Act-Assert pattern with descriptive names:

```typescript
describe('ComponentName', () => {
  it('should [expected behavior] when [condition]', () => {
    // Arrange
    const onSubmit = vi.fn();
    const component = new Component({ onSubmit });

    // Act
    component.getElement().dispatchEvent(new Event('click'));

    // Assert
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

## Property-Based Testing with fast-check

Use fast-check for testing state invariants and generating many test cases:

```typescript
import fc from 'fast-check';

it('should maintain invariant across random inputs', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      (input) => {
        // Setup
        const sm = new StateManager(initialState);

        // Action
        simulateAction(sm, input);

        // Invariant check
        const state = sm.getState();
        expect(state.items.every(i => i.quantity >= 1)).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

## Bugfix Testing Methodology

### Exploration Tests
- Written BEFORE the fix
- Encode the expected (correct) behavior
- MUST FAIL on unfixed code to confirm the bug exists
- Use scoped PBT for deterministic bugs

### Preservation Tests
- Written BEFORE the fix
- Capture existing correct behavior for non-buggy inputs
- MUST PASS on unfixed code to establish baseline
- Use property-based testing for stronger guarantees

### Verification
- After fix: exploration tests should PASS (bug is fixed)
- After fix: preservation tests should still PASS (no regressions)

## Mocking

Mock the storage module in state-related tests:

```typescript
vi.mock('../src/storage', () => ({
  saveState: vi.fn(),
  loadState: vi.fn(() => createDefaultState()),
  createDefaultState: vi.fn(() => ({
    sections: [],
    items: [],
    filterMode: 'all' as const,
    collapsedSections: new Set<string>(),
    selectedSectionId: null,
    version: 1,
  })),
}));
```

## Testing Checklist

When adding new functionality:

- [ ] Unit tests for component behavior
- [ ] Integration tests for state interactions
- [ ] Property-based tests for invariants (if applicable)
- [ ] Edge case coverage (empty states, boundaries)
- [ ] Error handling tests
- [ ] All existing tests still pass
