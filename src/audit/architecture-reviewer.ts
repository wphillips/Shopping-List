import { readFile, readdir } from 'fs/promises';
import { join, relative } from 'path';
import type { Finding } from './types';
import { createFinding } from './utils';

/** Threshold for flagging large files. */
const LARGE_FILE_THRESHOLD = 300;

/** Expected component patterns: constructor, createElement, attachEventListeners, getElement. */
const COMPONENT_PATTERNS = [
  { name: 'constructor', regex: /constructor\s*\(/ },
  { name: 'createElement', regex: /private\s+createElement\s*\(/ },
  { name: 'attachEventListeners', regex: /private\s+attachEventListeners\s*\(/ },
  { name: 'getElement', regex: /getElement\s*\(\)/ },
] as const;

/** Patterns that indicate state management logic in non-state files. */
const STATE_PATTERNS = [
  /new\s+Map\s*<.*,.*>\s*\(/,
  /\bstate\s*=\s*\{/,
  /dispatch\s*\(/,
  /\bsetState\s*\(/,
  /\breducer\s*\(/,
] as const;

/**
 * Identify files exceeding the line threshold.
 * Pure function — operates on pre-computed file metadata.
 */
export function checkLargeFiles(
  files: Array<{ path: string; lineCount: number }>
): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (file.lineCount > LARGE_FILE_THRESHOLD) {
      findings.push(
        createFinding({
          category: 'Architecture',
          severity: 'Medium',
          title: `Large file: ${file.path} (${file.lineCount} lines)`,
          description:
            `${file.path} has ${file.lineCount} lines, exceeding the ${LARGE_FILE_THRESHOLD}-line threshold. ` +
            'Large files often contain multiple responsibilities and are harder to maintain.',
          filePaths: [file.path],
          recommendation:
            'Evaluate whether this file contains multiple unrelated responsibilities. ' +
            'Consider splitting into focused modules (e.g., separate UI rendering, event handling, and business logic).',
          requirementRef: 'Req 8.2',
        })
      );
    }
  }

  return findings;
}

/**
 * Check component files for consistent patterns (constructor, createElement,
 * attachEventListeners, getElement).
 * Pure function — operates on file content strings.
 */
export function checkComponentConsistency(
  componentFiles: Array<{ path: string; content: string }>
): Finding[] {
  const findings: Finding[] = [];

  for (const file of componentFiles) {
    const missingPatterns: string[] = [];

    for (const pattern of COMPONENT_PATTERNS) {
      if (!pattern.regex.test(file.content)) {
        missingPatterns.push(pattern.name);
      }
    }

    if (missingPatterns.length > 0) {
      findings.push(
        createFinding({
          category: 'Architecture',
          severity: 'Low',
          title: `Component ${file.path} is missing expected patterns: ${missingPatterns.join(', ')}`,
          description:
            `The component file ${file.path} does not follow the standard component pattern. ` +
            `Missing: ${missingPatterns.join(', ')}. ` +
            'Consistent component structure improves readability and maintainability.',
          filePaths: [file.path],
          recommendation:
            'Align this component with the standard pattern: constructor that calls createElement() and ' +
            'attachEventListeners(), a private createElement() method, a private attachEventListeners() method, ' +
            'and a public getElement() accessor.',
          requirementRef: 'Req 8.3',
        })
      );
    }
  }

  return findings;
}

/**
 * Check that state management logic is centralized in src/state.ts
 * and not duplicated in component files.
 * Pure function — operates on file content strings.
 */
export function checkStateCentralization(
  files: Array<{ path: string; content: string }>
): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    // Only check component files (skip state.ts itself)
    const normalized = file.path.replace(/\\/g, '/');
    if (!normalized.includes('components/')) continue;

    for (const pattern of STATE_PATTERNS) {
      if (pattern.test(file.content)) {
        findings.push(
          createFinding({
            category: 'Architecture',
            severity: 'Medium',
            title: `State management logic found in component: ${file.path}`,
            description:
              `The component file ${file.path} contains state management patterns that should be centralized in src/state.ts. ` +
              'Duplicating state logic in components makes the application harder to reason about and maintain.',
            filePaths: [file.path, 'src/state.ts'],
            recommendation:
              'Move state management logic to src/state.ts and have the component interact with state through ' +
              'callbacks or a centralized state manager.',
            requirementRef: 'Req 8.4',
          })
        );
        break; // One finding per file is sufficient
      }
    }
  }

  return findings;
}

/**
 * Build an import graph from file contents.
 * Maps each file path to the list of local files it imports.
 * Pure function — operates on file content strings.
 */
export function buildImportGraph(
  files: Array<{ path: string; content: string }>
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const filePaths = new Set(files.map(f => normalizePath(f.path)));

  for (const file of files) {
    const imports: string[] = [];
    // Match: import ... from './something' or import ... from '../something'
    const importRegex = /(?:import|export)\s+.*?from\s+['"](\.[^'"]+)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(file.content)) !== null) {
      const importSpecifier = match[1];
      const resolved = resolveImportPath(file.path, importSpecifier);
      if (resolved && filePaths.has(resolved)) {
        imports.push(resolved);
      }
    }

    graph.set(normalizePath(file.path), imports);
  }

  return graph;
}

/**
 * Detect circular dependency chains in an import graph.
 * Returns a finding for each unique cycle found.
 * Pure function — operates on a pre-built import graph.
 */
export function detectCircularDependencies(
  importGraph: Map<string, string[]>
): Finding[] {
  const findings: Finding[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const reportedCycles = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      // Found a cycle — extract it
      const cycleStart = path.indexOf(node);
      if (cycleStart === -1) return;
      const cycle = path.slice(cycleStart);
      cycle.push(node); // close the cycle

      // Normalize cycle for deduplication: rotate so smallest element is first
      const normalized = normalizeCycle(cycle);
      const cycleKey = normalized.join(' → ');

      if (!reportedCycles.has(cycleKey)) {
        reportedCycles.add(cycleKey);
        findings.push(
          createFinding({
            category: 'Architecture',
            severity: 'High',
            title: `Circular dependency detected: ${cycleKey}`,
            description:
              `A circular dependency chain was found: ${cycleKey}. ` +
              'Circular dependencies can cause initialization issues, make the code harder to understand, ' +
              'and prevent effective tree-shaking.',
            filePaths: normalized.slice(0, -1), // all modules in the cycle (without the repeated closing node)
            recommendation:
              'Break the cycle by extracting shared types/interfaces into a separate module, ' +
              'using dependency injection, or restructuring the module boundaries.',
            requirementRef: 'Req 8.5',
          })
        );
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    const neighbors = importGraph.get(node) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, [...path, node]);
    }

    inStack.delete(node);
  }

  for (const node of importGraph.keys()) {
    dfs(node, []);
  }

  return findings;
}

/**
 * Normalize a file path to use forward slashes and strip leading './'.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Resolve a relative import specifier against a source file path.
 * Returns the normalized resolved path, or null if it can't be resolved.
 */
function resolveImportPath(fromFile: string, importSpecifier: string): string | null {
  const fromDir = normalizePath(fromFile).split('/').slice(0, -1).join('/');
  const parts = importSpecifier.split('/');
  const segments = fromDir ? fromDir.split('/') : [];

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }

  let resolved = segments.join('/');
  // Add .ts extension if not present
  if (!resolved.endsWith('.ts')) {
    resolved += '.ts';
  }
  return resolved;
}

/**
 * Normalize a cycle for deduplication by rotating so the lexicographically
 * smallest element is first.
 */
function normalizeCycle(cycle: string[]): string[] {
  // cycle is [A, B, C, A] — the last element repeats the first
  const nodes = cycle.slice(0, -1);
  if (nodes.length === 0) return cycle;

  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[minIdx]) {
      minIdx = i;
    }
  }

  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  rotated.push(rotated[0]); // close the cycle
  return rotated;
}

/**
 * Read a file safely, returning null if it doesn't exist or can't be read.
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Recursively find all .ts files under a directory.
 */
async function findTsFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, dist, coverage, .git, audit directory
        if (['node_modules', 'dist', 'coverage', '.git', 'audit'].includes(entry.name)) continue;
        results.push(...await findTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory not readable — skip
  }

  return results;
}

/**
 * Evaluate module structure for separation of concerns.
 * Checks that src/ has a reasonable structure with types, state, storage,
 * components, and other modules separated.
 */
function evaluateModuleStructure(
  files: Array<{ path: string }>
): Finding[] {
  const findings: Finding[] = [];
  const normalized = files.map(f => normalizePath(f.path));

  // Check for basic separation: types file, state file, components directory
  const hasTypesFile = normalized.some(f => f.endsWith('types.ts') && !f.includes('audit/'));
  const hasStateFile = normalized.some(f => f === 'src/state.ts');
  const hasStorageFile = normalized.some(f => f === 'src/storage.ts');
  const hasComponentsDir = normalized.some(f => f.includes('src/components/'));

  const missingConcerns: string[] = [];
  if (!hasTypesFile) missingConcerns.push('types module');
  if (!hasStateFile) missingConcerns.push('state module');
  if (!hasStorageFile) missingConcerns.push('storage module');
  if (!hasComponentsDir) missingConcerns.push('components directory');

  if (missingConcerns.length > 0) {
    findings.push(
      createFinding({
        category: 'Architecture',
        severity: 'Medium',
        title: `Missing separation of concerns: ${missingConcerns.join(', ')}`,
        description:
          `The source directory is missing expected structural elements: ${missingConcerns.join(', ')}. ` +
          'A well-organized codebase should separate types, state management, storage, and UI components.',
        filePaths: ['src/'],
        recommendation:
          'Organize the codebase with clear separation: types in a types module, state management in state.ts, ' +
          'persistence in storage.ts, and UI components in a components/ directory.',
        requirementRef: 'Req 8.1',
      })
    );
  }

  return findings;
}

/**
 * Main entry point: run all architecture checks and return findings.
 */
export async function reviewArchitecture(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Find all TypeScript source files under src/
  let tsFiles: string[];
  try {
    tsFiles = await findTsFiles('src');
  } catch {
    findings.push(
      createFinding({
        category: 'Architecture',
        severity: 'Low',
        title: 'Unable to scan source directory',
        description: 'Could not read the src/ directory. Architecture review was skipped.',
        filePaths: ['src/'],
        recommendation: 'Verify that the src/ directory exists and is readable.',
        requirementRef: 'Req 8.1',
      })
    );
    return findings;
  }

  // 2. Read all files
  const fileContents: Array<{ path: string; content: string }> = [];
  for (const filePath of tsFiles) {
    const content = await safeReadFile(filePath);
    if (content !== null) {
      const relPath = normalizePath(relative(process.cwd(), filePath));
      fileContents.push({ path: relPath, content });
    } else {
      findings.push(
        createFinding({
          category: 'Architecture',
          severity: 'Low',
          title: `Unable to read file: ${filePath}`,
          description: `Could not read ${filePath}. This file was skipped during architecture review.`,
          filePaths: [filePath],
          recommendation: 'Verify that the file exists and is readable.',
          requirementRef: 'Req 8.1',
        })
      );
    }
  }

  // 3. Evaluate module structure (Req 8.1)
  findings.push(...evaluateModuleStructure(fileContents));

  // 4. Check for large files (Req 8.2)
  const fileSizes = fileContents.map(f => ({
    path: f.path,
    lineCount: f.content.split('\n').length,
  }));
  findings.push(...checkLargeFiles(fileSizes));

  // 5. Check component consistency (Req 8.3)
  const componentFiles = fileContents.filter(f =>
    normalizePath(f.path).includes('src/components/')
  );
  findings.push(...checkComponentConsistency(componentFiles));

  // 6. Check state centralization (Req 8.4)
  findings.push(...checkStateCentralization(fileContents));

  // 7. Check for circular dependencies (Req 8.5)
  const importGraph = buildImportGraph(fileContents);
  findings.push(...detectCircularDependencies(importGraph));

  return findings;
}
