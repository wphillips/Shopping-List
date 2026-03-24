import { readFile, readdir } from 'fs/promises';
import { resolve, join } from 'path';
import type { Finding } from './types';
import { createFinding } from './utils';

/**
 * Check tsconfig.json content for strict mode, noUnusedLocals, noUnusedParameters.
 * Pure function — operates on the tsconfig string content.
 */
export function checkTsConfig(tsconfigContent: string): Finding[] {
  const findings: Finding[] = [];

  let config: { compilerOptions?: Record<string, unknown> };
  try {
    // Strip single-line comments for JSONC support
    const stripped = tsconfigContent.replace(/\/\/.*$/gm, '');
    config = JSON.parse(stripped);
  } catch {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'High',
        title: 'Unable to parse tsconfig.json',
        description: 'tsconfig.json could not be parsed as valid JSON/JSONC.',
        filePaths: ['tsconfig.json'],
        recommendation: 'Fix the JSON syntax in tsconfig.json so it can be parsed.',
        requirementRef: 'Req 4.1',
      })
    );
    return findings;
  }

  const opts = config.compilerOptions ?? {};

  if (opts['strict'] !== true) {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'High',
        title: 'TypeScript strict mode is not enabled',
        description: 'tsconfig.json does not have "strict": true. Strict mode enables a suite of type-checking options that catch common errors.',
        filePaths: ['tsconfig.json'],
        recommendation: 'Set "strict": true in compilerOptions to enable strict type checking.',
        requirementRef: 'Req 4.1',
      })
    );
  }

  if (opts['noUnusedLocals'] !== true) {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'Medium',
        title: 'noUnusedLocals is not enabled',
        description: 'tsconfig.json does not have "noUnusedLocals": true. Unused local variables indicate dead code.',
        filePaths: ['tsconfig.json'],
        recommendation: 'Set "noUnusedLocals": true in compilerOptions to flag unused local variables.',
        requirementRef: 'Req 4.2',
      })
    );
  }

  if (opts['noUnusedParameters'] !== true) {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'Medium',
        title: 'noUnusedParameters is not enabled',
        description: 'tsconfig.json does not have "noUnusedParameters": true. Unused parameters indicate dead code or incomplete refactoring.',
        filePaths: ['tsconfig.json'],
        recommendation: 'Set "noUnusedParameters": true in compilerOptions to flag unused function parameters.',
        requirementRef: 'Req 4.2',
      })
    );
  }

  if (findings.length === 0) {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'Low',
        title: 'TypeScript strict configuration is correct',
        description: 'tsconfig.json has strict mode enabled along with noUnusedLocals and noUnusedParameters.',
        filePaths: ['tsconfig.json'],
        recommendation: 'No action needed. TypeScript strict settings are properly configured.',
        requirementRef: 'Req 4.1',
      })
    );
  }

  return findings;
}

/** Map of common `any` usage contexts to recommended typed alternatives. */
const ANY_TYPE_ALTERNATIVES: Record<string, string> = {
  catch: 'Use `unknown` for catch clause variables and narrow with type guards',
  'JSON.parse': 'Use a type assertion or validation function: `JSON.parse(str) as MyType` or use a schema validator like zod',
  parameter: 'Replace with a specific interface, union type, or generic type parameter',
  'return type': 'Add an explicit return type annotation with the actual return shape',
  variable: 'Replace with the specific type or use `unknown` with type narrowing',
  'array element': 'Use a typed array like `string[]`, `number[]`, or a specific interface array',
  default: 'Replace `any` with `unknown` and use type guards to narrow the type safely',
};

/**
 * Find `: any` type annotations in a file and recommend typed alternatives.
 * Pure function — operates on file content string.
 */
export function checkAnyTypes(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match `: any` but not inside comments or strings
    // Look for `: any` that is a type annotation (preceded by identifier, `)`, or `]`)
    if (/:\s*any\b/.test(line) && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
      let context = 'default';
      if (/catch\s*\(/.test(line) || (i > 0 && /catch\s*\(/.test(lines[i - 1]))) {
        context = 'catch';
      } else if (/JSON\.parse/.test(line)) {
        context = 'JSON.parse';
      } else if (/\(.*:\s*any\b/.test(line)) {
        context = 'parameter';
      } else if (/\[\]/.test(line) || /Array<any>/.test(line)) {
        context = 'array element';
      }

      const recommendation = ANY_TYPE_ALTERNATIVES[context] ?? ANY_TYPE_ALTERNATIVES['default'];

      findings.push(
        createFinding({
          category: 'TypeScript',
          severity: 'Medium',
          title: `\`any\` type usage in ${filePath}`,
          description: `Line ${i + 1}: Found \`: any\` type annotation. Using \`any\` disables type checking and defeats the purpose of TypeScript.`,
          filePaths: [filePath],
          lineRanges: [`${i + 1}`],
          recommendation,
          requirementRef: 'Req 4.3',
        })
      );
    }
  }

  return findings;
}

/**
 * Check exported functions for explicit return type annotations.
 * Pure function — operates on file content string.
 */
export function checkExportedReturnTypes(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  // Regex patterns for exported functions without return types
  // Matches: export function name(params) {  (no `: ReturnType` before `{`)
  // Matches: export async function name(params) {
  // Matches: export const name = (params) => {
  // Matches: export const name = async (params) => {

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

    // Check `export function` and `export async function`
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    if (funcMatch) {
      // This line has no return type — the pattern matches `(params) {` with no `:` between `)` and `{`
      findings.push(
        createFinding({
          category: 'TypeScript',
          severity: 'Medium',
          title: `Exported function \`${funcMatch[1]}\` missing return type`,
          description: `Line ${i + 1}: Exported function \`${funcMatch[1]}\` does not have an explicit return type annotation. Explicit return types improve readability and catch unintended return value changes.`,
          filePaths: [filePath],
          lineRanges: [`${i + 1}`],
          recommendation: `Add an explicit return type annotation to \`${funcMatch[1]}\`, e.g., \`function ${funcMatch[1]}(...): ReturnType\`.`,
          requirementRef: 'Req 4.4',
        })
      );
      continue;
    }

    // Check `export const name = (params) =>` and `export const name = async (params) =>`
    const arrowMatch = line.match(/export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/);
    if (arrowMatch) {
      // Check if there's a type annotation between `)` and `=>`
      const afterParen = line.substring(line.indexOf(')') + 1, line.indexOf('=>'));
      if (!afterParen.includes(':')) {
        findings.push(
          createFinding({
            category: 'TypeScript',
            severity: 'Medium',
            title: `Exported arrow function \`${arrowMatch[1]}\` missing return type`,
            description: `Line ${i + 1}: Exported arrow function \`${arrowMatch[1]}\` does not have an explicit return type annotation.`,
            filePaths: [filePath],
            lineRanges: [`${i + 1}`],
            recommendation: `Add an explicit return type annotation to \`${arrowMatch[1]}\`, e.g., \`const ${arrowMatch[1]} = (...): ReturnType =>\`.`,
            requirementRef: 'Req 4.4',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Check error handling patterns: typed catch clauses and swallowed errors.
 * Pure function — operates on file content string.
 */
export function checkErrorHandling(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for untyped catch clauses: `catch (e)` without type annotation
    // Good: `catch (e: unknown)` or `catch (error: unknown)`
    // Bad: `catch (e)` or `catch (error)`
    const catchMatch = line.match(/catch\s*\(\s*(\w+)\s*\)/);
    if (catchMatch && !line.includes(': unknown') && !line.includes(': any')) {
      findings.push(
        createFinding({
          category: 'TypeScript',
          severity: 'Medium',
          title: `Untyped catch clause in ${filePath}`,
          description: `Line ${i + 1}: Catch clause variable \`${catchMatch[1]}\` has no type annotation. TypeScript 4.4+ supports \`catch (e: unknown)\` for type-safe error handling.`,
          filePaths: [filePath],
          lineRanges: [`${i + 1}`],
          recommendation: `Type the catch variable as \`unknown\`: \`catch (${catchMatch[1]}: unknown)\` and use type guards to narrow the error type.`,
          requirementRef: 'Req 4.5',
        })
      );
    }

    // Check for swallowed errors: empty catch blocks
    // Pattern: `catch { }` or `catch (e) { }` followed by closing brace with nothing in between
    if (/catch\s*(\([^)]*\))?\s*\{/.test(line)) {
      // Look ahead for empty catch body (next non-whitespace line is `}`)
      let j = i + 1;
      let bodyContent = '';
      while (j < lines.length && !lines[j].includes('}')) {
        bodyContent += lines[j].trim();
        j++;
      }
      if (bodyContent.trim() === '' && j < lines.length && lines[j].trim().startsWith('}')) {
        findings.push(
          createFinding({
            category: 'TypeScript',
            severity: 'High',
            title: `Swallowed error in ${filePath}`,
            description: `Line ${i + 1}: Empty catch block swallows the error silently. This makes debugging difficult and can hide real issues.`,
            filePaths: [filePath],
            lineRanges: [`${i + 1}-${j + 1}`],
            recommendation: 'At minimum, log the error with console.error(). Better yet, handle the error appropriately or re-throw it.',
            requirementRef: 'Req 4.5',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Flag Math.random()-based UUID generation.
 * Pure function — operates on file content string.
 */
export function checkMathRandomUuid(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

    // Check for Math.random() used in ID/UUID generation context
    if (/Math\.random\(\)/.test(line)) {
      // Look at surrounding context for UUID/ID generation patterns
      const contextStart = Math.max(0, i - 3);
      const contextEnd = Math.min(lines.length, i + 4);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      const isUuidGeneration =
        /generateId|uuid|uniqueId|createId|makeId/i.test(context) ||
        /\.toString\(36\)/.test(line) ||
        /\.substring\(|\.slice\(|\.substr\(/.test(line);

      if (isUuidGeneration) {
        findings.push(
          createFinding({
            category: 'TypeScript',
            severity: 'High',
            title: `Math.random()-based UUID generation in ${filePath}`,
            description: `Line ${i + 1}: Math.random() is used for ID/UUID generation. Math.random() is not cryptographically secure and can produce collisions.`,
            filePaths: [filePath],
            lineRanges: [`${i + 1}`],
            recommendation: 'Use crypto.randomUUID() (available in modern browsers and Node 19+) or the `uuid` package for cryptographically secure unique identifiers.',
            requirementRef: 'Req 4.6',
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Recursively find all .ts files under a directory.
 */
async function findTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
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
 * Main entry point: run all TypeScript best practices checks and return findings.
 */
export async function reviewTypeScript(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Check tsconfig.json
  const tsconfigContent = await safeReadFile(resolve('tsconfig.json'));
  if (tsconfigContent) {
    findings.push(...checkTsConfig(tsconfigContent));
  } else {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'Low',
        title: 'Unable to read tsconfig.json',
        description: 'Could not read tsconfig.json. TypeScript configuration checks were skipped.',
        filePaths: ['tsconfig.json'],
        recommendation: 'Verify that tsconfig.json exists and is readable.',
        requirementRef: 'Req 4.1',
      })
    );
  }

  // 2. Scan all TypeScript files under src/ for any types, return types, error handling, Math.random UUID
  try {
    const tsFiles = await findTsFiles('src');
    for (const filePath of tsFiles) {
      const content = await safeReadFile(filePath);
      if (content) {
        findings.push(...checkAnyTypes(filePath, content));
        findings.push(...checkExportedReturnTypes(filePath, content));
        findings.push(...checkErrorHandling(filePath, content));
        findings.push(...checkMathRandomUuid(filePath, content));
      }
    }
  } catch {
    findings.push(
      createFinding({
        category: 'TypeScript',
        severity: 'Low',
        title: 'Unable to scan source files for TypeScript best practices',
        description: 'Failed to read TypeScript source files under src/.',
        filePaths: ['src/'],
        recommendation: 'Verify that the src/ directory exists and is readable, then re-run the audit.',
        requirementRef: 'Req 4.3',
      })
    );
  }

  return findings;
}
