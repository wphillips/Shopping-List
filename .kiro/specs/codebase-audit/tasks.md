# Implementation Plan: Codebase Audit

## Overview

Implement a comprehensive codebase audit for the Grocery List PWA. The audit is a one-shot analysis pass that reads the codebase, runs static analysis tools, performs code inspections, classifies findings, and generates a structured Markdown report (`audit-report.md`). Each audit area is implemented as a discrete module under `src/audit/`, with a report generator that aggregates all findings.

## Tasks

- [x] 1. Set up audit infrastructure and core types
  - [x] 1.1 Create `src/audit/types.ts` with `Finding`, `AuditCategory`, `DependencyInfo`, `AuditReport` interfaces and severity type
    - Define the shared data model used by all audit components
    - _Requirements: 9.1, 9.2_
  - [x] 1.2 Create `src/audit/utils.ts` with helper functions for creating findings (factory function with auto-incrementing IDs per category) and severity comparison
    - _Requirements: 9.2, 9.4_
  - [ ]* 1.3 Write property test for finding structure completeness
    - **Property 6: Finding structure completeness**
    - For any finding created by the factory, it must have non-empty severity, at least one file path, non-empty description, and non-empty recommendation
    - **Validates: Requirements 3.7, 9.2**

- [x] 2. Implement Dependency Auditor
  - [x] 2.1 Create `src/audit/dependency-auditor.ts`
    - Parse `npm outdated --json` and `npm audit --json` output
    - List every dependency with current version, latest version, deprecation flag
    - Classify upgrades as major/minor/patch/current
    - Produce prioritized upgrade plan (security-impacting first, then compatibility risk)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1_
  - [ ]* 2.2 Write property test for dependency listing completeness
    - **Property 1: Dependency listing completeness**
    - For any dependency entry in package.json, the audit output must contain an entry with name, current version, latest version, and deprecation flag
    - **Validates: Requirements 1.1, 1.4**
  - [ ]* 2.3 Write property test for version upgrade classification correctness
    - **Property 2: Version upgrade classification correctness**
    - For any dependency where latest differs from current, classify as major/minor/patch correctly; if equal, classify as current
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 2.4 Write property test for upgrade plan ordering
    - **Property 3: Upgrade plan ordering**
    - Security-impacting upgrades must appear before non-security upgrades; within each group, order by major > minor > patch
    - **Validates: Requirements 1.5**

- [x] 3. Implement Duplicate Code Detector
  - [x] 3.1 Create `src/audit/duplicate-detector.ts`
    - Configure and run `jscpd` with `--min-lines 5` against `src/`
    - Parse jscpd JSON output into findings with file paths, line ranges, similarity scores
    - Specifically check for `generateId()` duplication across `src/state.ts`, `src/storage.ts`, `src/serializer.ts`, `src/merge-engine.ts`
    - Provide consolidation recommendations for each duplicate
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 3.2 Write property test for duplicate code finding completeness
    - **Property 4: Duplicate code finding completeness**
    - For any duplicate finding, it must include file paths for all occurrences, line ranges, similarity score, and non-empty consolidation recommendation
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. Implement Security Inspector
  - [x] 4.1 Create `src/audit/security-inspector.ts`
    - Grep for `innerHTML` assignments in `src/**/*.ts` and classify injection risk
    - Verify service worker does not cache credentials/tokens
    - Verify CloudFront `viewer_protocol_policy = "redirect-to-https"` in `infra/cloudfront.tf`
    - Verify S3 public access block (all four flags true) in `infra/s3.tf`
    - Verify WAF rate-limiting rule in `infra/waf.tf`
    - Check `localStorage` usage for sensitive data in `src/storage.ts`
    - Assign severity and remediation for each finding
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [ ]* 4.2 Write property test for innerHTML detection
    - **Property 5: innerHTML detection**
    - For any TypeScript source file under `src/` containing an `innerHTML` assignment, the audit must produce a security finding referencing that file
    - **Validates: Requirements 3.2**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement TypeScript Practices Reviewer
  - [x] 6.1 Create `src/audit/typescript-reviewer.ts`
    - Verify `tsconfig.json` has `strict: true`, `noUnusedLocals`, `noUnusedParameters`
    - Grep for `: any` type annotations in `src/**/*.ts` and recommend typed alternatives
    - Check exported functions for explicit return type annotations
    - Check error handling patterns (typed catch clauses, no swallowed errors)
    - Flag `Math.random()`-based UUID generation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 6.2 Write property test for `any` type detection
    - **Property 7: `any` type detection**
    - For any TypeScript source file containing `: any`, the audit must produce a finding with file, line, and typed alternative recommendation
    - **Validates: Requirements 4.3**
  - [ ]* 6.3 Write property test for exported function return type check
    - **Property 8: Exported function return type check**
    - For any exported function lacking an explicit return type annotation, the audit must produce a finding identifying the function and file
    - **Validates: Requirements 4.4**

- [x] 7. Implement PWA Configuration Reviewer
  - [x] 7.1 Create `src/audit/pwa-reviewer.ts`
    - Verify `manifest.webmanifest` has all required fields: `name`, `short_name`, `start_url`, `display`, `icons`, `theme_color`, `background_color`
    - Verify service worker uses versioned cache name and cleans up old caches in activate handler
    - Verify service worker pre-caches critical assets via `__PRECACHE_ASSETS__`
    - Verify service worker provides offline fallback for navigation requests
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Implement Build Configuration Reviewer
  - [x] 8.1 Create `src/audit/build-reviewer.ts`
    - Verify Vite produces hashed filenames (check config or dist output)
    - Verify tree-shaking is enabled (ESM + Rollup default)
    - Check for ESLint configuration presence
    - Check for Prettier configuration presence
    - Verify test coverage reporting (`@vitest/coverage-v8` in devDependencies)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Implement Infrastructure Code Reviewer
  - [x] 9.1 Create `src/audit/infra-reviewer.ts`
    - Verify Terraform state backend configuration (remote vs local)
    - Verify `terraform.tfvars` is in `.gitignore`
    - Verify consistent resource tagging (`Name` and `Environment`)
    - Verify provider version constraints use pessimistic pinning (`~>`)
    - Grep for hardcoded secrets/credentials in `infra/**/*.tf`
    - Verify `terraform.tfstate` files are in `.gitignore`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 9.2 Write property test for Terraform resource tagging consistency
    - **Property 9: Terraform resource tagging consistency**
    - For any Terraform resource that supports tags, it must include `Name` and `Environment` tags; missing tags produce a finding
    - **Validates: Requirements 7.3**
  - [ ]* 9.3 Write property test for Terraform provider version pinning
    - **Property 10: Terraform provider version pinning**
    - For any provider version constraint using `>=` instead of `~>`, the audit must produce a finding
    - **Validates: Requirements 7.4**
  - [ ]* 9.4 Write property test for no hardcoded secrets
    - **Property 11: No hardcoded secrets in infrastructure code**
    - For any Terraform file containing patterns matching hardcoded secrets, the audit must produce a Critical finding
    - **Validates: Requirements 7.5**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Architecture Reviewer
  - [x] 11.1 Create `src/audit/architecture-reviewer.ts`
    - Evaluate module structure under `src/` for separation of concerns
    - Identify files exceeding 300 lines and assess multiple responsibilities
    - Verify component files follow consistent patterns
    - Verify state management is centralized in `src/state.ts`
    - Check for circular dependency chains via import graph analysis
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ]* 11.2 Write property test for large file detection
    - **Property 12: Large file detection**
    - For any source file under `src/` with more than 300 lines, the audit must produce a finding recommending evaluation for splitting
    - **Validates: Requirements 8.2**
  - [ ]* 11.3 Write property test for circular dependency detection
    - **Property 13: Circular dependency detection**
    - For any import graph cycle (A → B → ... → A), the audit must produce a finding listing the modules in the cycle
    - **Validates: Requirements 8.5**

- [x] 12. Implement Report Generator and wire everything together
  - [x] 12.1 Create `src/audit/report-generator.ts`
    - Accept all findings from audit components
    - Group findings by category: Dependencies, Duplicate Code, Security, TypeScript, PWA, Build, Infrastructure, Architecture
    - Generate summary section with count per severity level
    - Generate prioritized action plan ordered by severity (Critical → High → Medium → Low)
    - Render final `audit-report.md` Markdown file
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 12.2 Create `src/audit/index.ts` as the main audit orchestrator
    - Wire all audit components into the linear pipeline: Gather Context → Run Tool Checks → Run Code Inspections → Classify Findings → Generate Report
    - Handle error scenarios (tool failures, missing files) with graceful degradation
    - _Requirements: 9.1_
  - [ ]* 12.3 Write property test for report summary accuracy
    - **Property 14: Report summary accuracy**
    - For any audit report, the summary count per severity must exactly equal the number of findings with that severity
    - **Validates: Requirements 9.3**
  - [ ]* 12.4 Write property test for action plan severity ordering
    - **Property 15: Action plan severity ordering**
    - The action plan must list all Critical before High, all High before Medium, all Medium before Low
    - **Validates: Requirements 9.4**

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in devDependencies)
- The audit does not introduce new runtime dependencies — all audit modules are dev/analysis tooling
- Checkpoints ensure incremental validation at natural breakpoints
- All audit modules produce `Finding[]` arrays consumed by the report generator
