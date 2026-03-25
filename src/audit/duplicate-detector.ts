import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import type { Finding } from './types';
import { createFinding } from './utils';

const execAsync = promisify(exec);

/** Shape of a single clone entry from jscpd JSON output. */
interface JscpdDuplicate {
  format: string;
  lines: number;
  tokens: number;
  firstFile: { name: string; start: number; end: number; startLoc: { line: number; column: number }; endLoc: { line: number; column: number } };
  secondFile: { name: string; start: number; end: number; startLoc: { line: number; column: number }; endLoc: { line: number; column: number } };
  fragment?: string;
}

interface JscpdReport {
  duplicates?: JscpdDuplicate[];
  statistics?: {
    total?: { percentage?: number; lines?: number; sources?: number; clones?: number };
  };
}

/**
 * Parse jscpd JSON output into Finding objects.
 * Pure function for testability.
 */
export function parseJscpdOutput(jsonData: JscpdReport): Finding[] {
  const duplicates = jsonData.duplicates ?? [];
  const findings: Finding[] = [];

  for (const dup of duplicates) {
    const firstPath = dup.firstFile.name;
    const secondPath = dup.secondFile.name;
    const firstRange = `${dup.firstFile.startLoc.line}-${dup.firstFile.endLoc.line}`;
    const secondRange = `${dup.secondFile.startLoc.line}-${dup.secondFile.endLoc.line}`;
    const lines = dup.lines;
    const similarity = 100; // jscpd reports exact clones; near-duplicates are token-matched

    findings.push(
      createFinding({
        category: 'Duplicate Code',
        severity: lines > 20 ? 'Medium' : 'Low',
        title: `Duplicate code block (${lines} lines)`,
        description:
          `Duplicate code found between ${firstPath} (lines ${firstRange}) and ${secondPath} (lines ${secondRange}). ` +
          `Similarity: ${similarity}%. ${lines} duplicated lines.`,
        filePaths: [firstPath, secondPath],
        lineRanges: [firstRange, secondRange],
        recommendation:
          `Extract the duplicated logic into a shared utility function and import it in both ${firstPath} and ${secondPath}.`,
        requirementRef: 'Req 2.1, 2.2, 2.3, 2.4',
      })
    );
  }

  return findings;
}

/**
 * Check for generateId() duplication across the four known files.
 * Reads each file and checks if it contains a `generateId` function definition.
 * Pure-ish function (reads filesystem but logic is deterministic).
 */
export async function checkGenerateIdDuplication(
  filePaths: string[]
): Promise<Finding[]> {
  const filesWithGenerateId: string[] = [];

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath, 'utf-8');
      // Match function declarations like: function generateId()
      if (/function\s+generateId\s*\(/.test(content)) {
        filesWithGenerateId.push(filePath);
      }
    } catch {
      // File not found or unreadable — skip silently
    }
  }

  if (filesWithGenerateId.length <= 1) {
    return [];
  }

  return [
    createFinding({
      category: 'Duplicate Code',
      severity: 'Medium',
      title: `generateId() duplicated across ${filesWithGenerateId.length} files`,
      description:
        `The generateId() function is duplicated in: ${filesWithGenerateId.join(', ')}. ` +
        `All implementations use the same Math.random()-based UUID v4 pattern.`,
      filePaths: filesWithGenerateId,
      recommendation:
        'Extract generateId() into a shared utility module (e.g., src/utils/id.ts) and import it in all consuming modules. ' +
        'Also consider replacing Math.random() with crypto.randomUUID() for better uniqueness guarantees.',
      requirementRef: 'Req 2.5',
    }),
  ];
}

/** Known files that may contain duplicated generateId() implementations. */
const GENERATE_ID_FILES = [
  'src/state.ts',
  'src/storage.ts',
  'src/serializer.ts',
  'src/merge-engine.ts',
];

/**
 * Main entry point: detect duplicate code across the codebase.
 * Runs jscpd for general duplicate detection and performs a targeted
 * check for generateId() duplication.
 */
export async function detectDuplicates(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Run jscpd for general duplicate detection
  try {
    await execAsync(
      'npx jscpd src/ --min-lines 5 --reporters json --output .jscpd-output',
      { maxBuffer: 10 * 1024 * 1024, timeout: 60_000 }
    );
  } catch (error: unknown) {
    // jscpd may exit with non-zero if duplicates are found — check if output exists
    const hasOutput = await readFile('.jscpd-output/jscpd-report.json', 'utf-8').catch(() => null);
    if (!hasOutput) {
      findings.push(
        createFinding({
          category: 'Duplicate Code',
          severity: 'Low',
          title: 'Unable to run jscpd duplicate detection',
          description:
            'jscpd could not be executed. This may be because it is not installed or the command timed out. ' +
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          filePaths: ['src/'],
          recommendation:
            'Install jscpd globally (`npm install -g jscpd`) or as a dev dependency, then re-run the audit.',
          requirementRef: 'Req 2.1',
        })
      );
    }
  }

  // 2. Parse jscpd output if available
  try {
    const reportJson = await readFile('.jscpd-output/jscpd-report.json', 'utf-8');
    const report = JSON.parse(reportJson) as JscpdReport;
    findings.push(...parseJscpdOutput(report));
  } catch {
    // No report file — jscpd either failed or produced no output; warning already added above
  }

  // 3. Targeted check for generateId() duplication
  const generateIdFindings = await checkGenerateIdDuplication(GENERATE_ID_FILES);
  findings.push(...generateIdFindings);

  return findings;
}
