# Requirements Document

## Introduction

Upgrade all outdated dependencies in the Grocery List PWA project to their latest major versions, remove unused packages, and ensure the application continues to build and pass all 262 tests. The project currently runs Vite 5.4, Vitest 1.6, fast-check 3.x, jsdom 28, and @types/node 20.x. Two packages (vite-plugin-pwa and workbox-window) are installed but unused and should be removed. Steering documents must be updated to reflect the new dependency versions.

## Glossary

- **Build_Pipeline**: The `npm run build` command that runs TypeScript compilation (`tsc`) followed by Vite bundling to produce the `dist/` output
- **Test_Suite**: The full set of 262 tests across 20 test files executed by `npm test` (vitest --run)
- **Steering_Docs**: The markdown files under `.kiro/steering/` that document the project's architecture, testing guidelines, and development workflow
- **Package_JSON**: The `package.json` file that declares all project dependencies and their version ranges
- **Vite_Config**: The `vite.config.ts` file that configures the Vite build tool and Vitest test runner
- **Unused_Dependency**: A package listed in `package.json` that is not imported or referenced by any source file or configuration file

## Requirements

### Requirement 1: Remove Unused Dependencies

**User Story:** As a developer, I want unused dependencies removed from the project, so that the dependency tree is clean and does not include packages that add no value.

#### Acceptance Criteria

1. WHEN the dependency cleanup is performed, THE Build_Pipeline SHALL complete successfully without the `vite-plugin-pwa` package installed
2. WHEN the dependency cleanup is performed, THE Build_Pipeline SHALL complete successfully without the `workbox-window` package installed
3. WHEN the dependency cleanup is performed, THE Package_JSON SHALL not contain an entry for `vite-plugin-pwa` in devDependencies
4. WHEN the dependency cleanup is performed, THE Package_JSON SHALL not contain an entry for `workbox-window` in dependencies
5. WHEN the dependency cleanup is performed, THE Test_Suite SHALL pass all existing tests without the removed packages

### Requirement 2: Upgrade Vite to 8.x

**User Story:** As a developer, I want Vite upgraded to version 8.x, so that the project benefits from the Rolldown bundler, improved performance, and eliminates CJS deprecation warnings.

#### Acceptance Criteria

1. WHEN Vite is upgraded to 8.x, THE Package_JSON SHALL declare `vite` with a version range targeting 8.x in devDependencies
2. WHEN Vite is upgraded to 8.x, THE Build_Pipeline SHALL produce a working `dist/` output without errors
3. WHEN Vite is upgraded to 8.x, THE Vite_Config SHALL remain compatible with the Vite 8 configuration API
4. IF Vite 8 introduces breaking changes to the configuration format, THEN THE Vite_Config SHALL be updated to use the new API
5. WHEN Vite is upgraded to 8.x, THE Build_Pipeline SHALL not emit CJS-related deprecation warnings

### Requirement 3: Upgrade Vitest to 4.x

**User Story:** As a developer, I want Vitest upgraded to version 4.x, so that the test runner is compatible with Vite 8 and the project uses a supported testing framework version.

#### Acceptance Criteria

1. WHEN Vitest is upgraded to 4.x, THE Package_JSON SHALL declare `vitest` with a version range targeting 4.x in devDependencies
2. WHEN Vitest is upgraded to 4.x, THE Test_Suite SHALL pass all 262 existing tests
3. IF Vitest 4 changes the default mock restoration behavior, THEN THE Test_Suite SHALL be updated so that mock behavior remains correct across all test files
4. IF Vitest 4 changes the default value returned by `vi.fn().getMockName`, THEN THE Test_Suite SHALL be updated to expect the new default value
5. IF Vitest 4 changes the default thread pool or isolation behavior, THEN THE Vite_Config SHALL specify pool settings explicitly to maintain test isolation
6. WHEN Vitest is upgraded to 4.x, THE Vite_Config SHALL use the Vitest 4-compatible configuration format for test options

### Requirement 4: Upgrade fast-check to 4.x

**User Story:** As a developer, I want fast-check upgraded to version 4.x, so that property-based tests use the latest generator APIs and benefit from improved shrinking.

#### Acceptance Criteria

1. WHEN fast-check is upgraded to 4.x, THE Package_JSON SHALL declare `fast-check` with a version range targeting 4.x in devDependencies
2. WHEN fast-check is upgraded to 4.x, THE Test_Suite SHALL pass all property-based tests without modification to test logic
3. IF fast-check 4 removes or renames any arbitraries used in the test files, THEN THE Test_Suite SHALL be updated to use the replacement arbitraries
4. IF fast-check 4 changes the `fc.assert` or `fc.property` API, THEN THE Test_Suite SHALL be updated to use the new API

### Requirement 5: Upgrade jsdom to 29.x

**User Story:** As a developer, I want jsdom upgraded to version 29.x, so that the test environment uses a current DOM implementation.

#### Acceptance Criteria

1. WHEN jsdom is upgraded to 29.x, THE Package_JSON SHALL declare `jsdom` with a version range targeting 29.x in devDependencies
2. WHEN jsdom is upgraded to 29.x, THE Test_Suite SHALL pass all tests that rely on DOM APIs
3. IF jsdom 29 changes behavior of any DOM API used by the test files, THEN THE Test_Suite SHALL be updated to accommodate the new behavior

### Requirement 6: Upgrade @types/node to 25.x

**User Story:** As a developer, I want @types/node upgraded to version 25.x, so that TypeScript type definitions match the Node.js APIs available in the runtime environment.

#### Acceptance Criteria

1. WHEN @types/node is upgraded to 25.x, THE Package_JSON SHALL declare `@types/node` with a version range targeting 25.x in devDependencies
2. WHEN @types/node is upgraded to 25.x, THE Build_Pipeline SHALL compile without type errors

### Requirement 7: Full Regression Verification

**User Story:** As a developer, I want confidence that the upgraded dependencies do not break any existing functionality, so that the application remains correct after the upgrade.

#### Acceptance Criteria

1. WHEN all dependency upgrades are complete, THE Test_Suite SHALL pass all 262 tests across all 20 test files
2. WHEN all dependency upgrades are complete, THE Build_Pipeline SHALL produce a `dist/` output identical in structure to the pre-upgrade build
3. WHEN all dependency upgrades are complete, THE Build_Pipeline SHALL complete the `tsc` step without type errors
4. WHEN all dependency upgrades are complete, THE Build_Pipeline SHALL complete the `vite build` step without bundling errors

### Requirement 8: Update Steering Documentation

**User Story:** As a developer, I want the steering documents to reflect the new dependency versions, so that onboarding documentation and architecture references remain accurate.

#### Acceptance Criteria

1. WHEN the upgrades are complete, THE Steering_Docs SHALL list Vite 8.x as the build tool version in `architecture.md`
2. WHEN the upgrades are complete, THE Steering_Docs SHALL list fast-check 4.x as the property-based testing library version in `architecture.md`
3. WHEN the upgrades are complete, THE Steering_Docs SHALL not reference `vite-plugin-pwa` or `workbox-window` in any steering document
4. IF the minimum Node.js version requirement changes due to Vitest 4 requiring Node >= 20, THEN THE Steering_Docs SHALL update the prerequisites in `development-workflow.md` to specify Node.js 20+
