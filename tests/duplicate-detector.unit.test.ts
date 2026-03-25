import { describe, it, expect, beforeEach } from 'vitest';
import { parseJscpdOutput, checkGenerateIdDuplication } from '../src/audit/duplicate-detector';
import { resetCounters } from '../src/audit/utils';

describe('parseJscpdOutput', () => {
  beforeEach(() => resetCounters());

  it('should return empty array for empty duplicates', () => {
    const result = parseJscpdOutput({ duplicates: [] });
    expect(result).toEqual([]);
  });

  it('should return empty array when duplicates field is missing', () => {
    const result = parseJscpdOutput({});
    expect(result).toEqual([]);
  });

  it('should parse a single duplicate into a finding', () => {
    const report = {
      duplicates: [
        {
          format: 'typescript',
          lines: 8,
          tokens: 50,
          firstFile: {
            name: 'src/state.ts',
            start: 100,
            end: 200,
            startLoc: { line: 10, column: 0 },
            endLoc: { line: 17, column: 0 },
          },
          secondFile: {
            name: 'src/storage.ts',
            start: 300,
            end: 400,
            startLoc: { line: 50, column: 0 },
            endLoc: { line: 57, column: 0 },
          },
        },
      ],
    };

    const findings = parseJscpdOutput(report);
    expect(findings).toHaveLength(1);

    const f = findings[0];
    expect(f.category).toBe('Duplicate Code');
    expect(f.severity).toBe('Low');
    expect(f.filePaths).toEqual(['src/state.ts', 'src/storage.ts']);
    expect(f.lineRanges).toEqual(['10-17', '50-57']);
    expect(f.description).toContain('8 duplicated lines');
    expect(f.description).toContain('Similarity: 100%');
    expect(f.recommendation).toBeTruthy();
    expect(f.id).toMatch(/^DUP-\d{3}$/);
  });

  it('should assign Medium severity for blocks over 20 lines', () => {
    const report = {
      duplicates: [
        {
          format: 'typescript',
          lines: 25,
          tokens: 150,
          firstFile: {
            name: 'src/a.ts',
            start: 0,
            end: 500,
            startLoc: { line: 1, column: 0 },
            endLoc: { line: 25, column: 0 },
          },
          secondFile: {
            name: 'src/b.ts',
            start: 0,
            end: 500,
            startLoc: { line: 1, column: 0 },
            endLoc: { line: 25, column: 0 },
          },
        },
      ],
    };

    const findings = parseJscpdOutput(report);
    expect(findings[0].severity).toBe('Medium');
  });

  it('should parse multiple duplicates', () => {
    const report = {
      duplicates: [
        {
          format: 'typescript',
          lines: 6,
          tokens: 30,
          firstFile: { name: 'src/a.ts', start: 0, end: 100, startLoc: { line: 1, column: 0 }, endLoc: { line: 6, column: 0 } },
          secondFile: { name: 'src/b.ts', start: 0, end: 100, startLoc: { line: 1, column: 0 }, endLoc: { line: 6, column: 0 } },
        },
        {
          format: 'typescript',
          lines: 10,
          tokens: 60,
          firstFile: { name: 'src/c.ts', start: 0, end: 200, startLoc: { line: 5, column: 0 }, endLoc: { line: 14, column: 0 } },
          secondFile: { name: 'src/d.ts', start: 0, end: 200, startLoc: { line: 20, column: 0 }, endLoc: { line: 29, column: 0 } },
        },
      ],
    };

    const findings = parseJscpdOutput(report);
    expect(findings).toHaveLength(2);
    expect(findings[0].filePaths).toEqual(['src/a.ts', 'src/b.ts']);
    expect(findings[1].filePaths).toEqual(['src/c.ts', 'src/d.ts']);
  });
});

describe('checkGenerateIdDuplication', () => {
  beforeEach(() => resetCounters());

  it('should detect generateId() duplication across known files', async () => {
    const findings = await checkGenerateIdDuplication([
      'src/state.ts',
      'src/storage.ts',
      'src/serializer.ts',
      'src/merge-engine.ts',
    ]);

    expect(findings).toHaveLength(1);
    const f = findings[0];
    expect(f.category).toBe('Duplicate Code');
    expect(f.severity).toBe('Medium');
    expect(f.title).toContain('generateId()');
    expect(f.title).toContain('4 files');
    expect(f.filePaths).toHaveLength(4);
    expect(f.recommendation).toContain('shared utility');
    expect(f.requirementRef).toBe('Req 2.5');
  });

  it('should return empty when only one file has generateId', async () => {
    const findings = await checkGenerateIdDuplication(['src/state.ts']);
    expect(findings).toEqual([]);
  });

  it('should handle non-existent files gracefully', async () => {
    const findings = await checkGenerateIdDuplication([
      'src/nonexistent.ts',
      'src/also-missing.ts',
    ]);
    expect(findings).toEqual([]);
  });

  it('should handle mix of existing and non-existent files', async () => {
    const findings = await checkGenerateIdDuplication([
      'src/state.ts',
      'src/nonexistent.ts',
      'src/storage.ts',
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].filePaths).toHaveLength(2);
    expect(findings[0].filePaths).toContain('src/state.ts');
    expect(findings[0].filePaths).toContain('src/storage.ts');
  });
});
