import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../src/audit/utils';
import {
  checkLargeFiles,
  checkComponentConsistency,
  checkStateCentralization,
  buildImportGraph,
  detectCircularDependencies,
} from '../src/audit/architecture-reviewer';

beforeEach(() => {
  resetCounters();
});

describe('checkLargeFiles', () => {
  it('should flag files exceeding 300 lines', () => {
    const files = [
      { path: 'src/index.ts', lineCount: 1077 },
      { path: 'src/state.ts', lineCount: 600 },
      { path: 'src/types.ts', lineCount: 50 },
    ];
    const findings = checkLargeFiles(files);
    expect(findings).toHaveLength(2);
    expect(findings[0].title).toContain('src/index.ts');
    expect(findings[0].title).toContain('1077');
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].requirementRef).toBe('Req 8.2');
    expect(findings[1].title).toContain('src/state.ts');
  });

  it('should not flag files at or below 300 lines', () => {
    const files = [
      { path: 'src/types.ts', lineCount: 300 },
      { path: 'src/utils.ts', lineCount: 100 },
    ];
    const findings = checkLargeFiles(files);
    expect(findings).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    const findings = checkLargeFiles([]);
    expect(findings).toHaveLength(0);
  });
});

describe('checkComponentConsistency', () => {
  const consistentComponent = `
export class FilterControl {
  private element: HTMLElement;
  constructor(config: FilterControlConfig) {
    this.element = this.createElement();
    this.attachEventListeners();
  }
  private createElement(): HTMLElement { return document.createElement('div'); }
  private attachEventListeners(): void {}
  getElement(): HTMLElement { return this.element; }
}`;

  it('should not flag components following the standard pattern', () => {
    const files = [{ path: 'src/components/FilterControl.ts', content: consistentComponent }];
    const findings = checkComponentConsistency(files);
    expect(findings).toHaveLength(0);
  });

  it('should flag components missing expected patterns', () => {
    const incomplete = `
export class Broken {
  constructor() {}
  getElement(): HTMLElement { return document.createElement('div'); }
}`;
    const files = [{ path: 'src/components/Broken.ts', content: incomplete }];
    const findings = checkComponentConsistency(files);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('createElement');
    expect(findings[0].title).toContain('attachEventListeners');
    expect(findings[0].requirementRef).toBe('Req 8.3');
  });

  it('should return empty array for empty input', () => {
    const findings = checkComponentConsistency([]);
    expect(findings).toHaveLength(0);
  });
});

describe('checkStateCentralization', () => {
  it('should flag component files containing state management patterns', () => {
    const files = [
      {
        path: 'src/components/BadComponent.ts',
        content: 'const state = { items: [] };\nfunction render() {}',
      },
      {
        path: 'src/state.ts',
        content: 'const state = { items: [] };',
      },
    ];
    const findings = checkStateCentralization(files);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('BadComponent');
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].requirementRef).toBe('Req 8.4');
  });

  it('should not flag state.ts itself', () => {
    const files = [
      { path: 'src/state.ts', content: 'const state = { items: [] };' },
    ];
    const findings = checkStateCentralization(files);
    expect(findings).toHaveLength(0);
  });

  it('should not flag non-component files', () => {
    const files = [
      { path: 'src/storage.ts', content: 'dispatch(action);' },
    ];
    const findings = checkStateCentralization(files);
    expect(findings).toHaveLength(0);
  });

  it('should not flag components without state patterns', () => {
    const files = [
      {
        path: 'src/components/CleanComponent.ts',
        content: 'export class CleanComponent { getElement() { return this.el; } }',
      },
    ];
    const findings = checkStateCentralization(files);
    expect(findings).toHaveLength(0);
  });
});

describe('buildImportGraph', () => {
  it('should build a graph from import statements', () => {
    const files = [
      {
        path: 'src/index.ts',
        content: "import { foo } from './state';\nimport { bar } from './storage';",
      },
      { path: 'src/state.ts', content: "import { baz } from './types';" },
      { path: 'src/storage.ts', content: '' },
      { path: 'src/types.ts', content: '' },
    ];
    const graph = buildImportGraph(files);
    expect(graph.get('src/index.ts')).toEqual(['src/state.ts', 'src/storage.ts']);
    expect(graph.get('src/state.ts')).toEqual(['src/types.ts']);
    expect(graph.get('src/storage.ts')).toEqual([]);
    expect(graph.get('src/types.ts')).toEqual([]);
  });

  it('should handle relative parent imports', () => {
    const files = [
      {
        path: 'src/components/Item.ts',
        content: "import { AppState } from '../types';",
      },
      { path: 'src/types.ts', content: '' },
    ];
    const graph = buildImportGraph(files);
    expect(graph.get('src/components/Item.ts')).toEqual(['src/types.ts']);
  });

  it('should ignore non-local imports', () => {
    const files = [
      {
        path: 'src/index.ts',
        content: "import { readFile } from 'fs/promises';\nimport React from 'react';",
      },
    ];
    const graph = buildImportGraph(files);
    expect(graph.get('src/index.ts')).toEqual([]);
  });

  it('should return empty graph for empty input', () => {
    const graph = buildImportGraph([]);
    expect(graph.size).toBe(0);
  });
});

describe('detectCircularDependencies', () => {
  it('should detect a simple A → B → A cycle', () => {
    const graph = new Map<string, string[]>([
      ['src/a.ts', ['src/b.ts']],
      ['src/b.ts', ['src/a.ts']],
    ]);
    const findings = detectCircularDependencies(graph);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('src/a.ts');
    expect(findings[0].title).toContain('src/b.ts');
    expect(findings[0].requirementRef).toBe('Req 8.5');
  });

  it('should detect a longer cycle A → B → C → A', () => {
    const graph = new Map<string, string[]>([
      ['src/a.ts', ['src/b.ts']],
      ['src/b.ts', ['src/c.ts']],
      ['src/c.ts', ['src/a.ts']],
    ]);
    const findings = detectCircularDependencies(graph);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('→');
  });

  it('should not report cycles in acyclic graphs', () => {
    const graph = new Map<string, string[]>([
      ['src/a.ts', ['src/b.ts']],
      ['src/b.ts', ['src/c.ts']],
      ['src/c.ts', []],
    ]);
    const findings = detectCircularDependencies(graph);
    expect(findings).toHaveLength(0);
  });

  it('should deduplicate the same cycle found from different starting nodes', () => {
    const graph = new Map<string, string[]>([
      ['src/a.ts', ['src/b.ts']],
      ['src/b.ts', ['src/a.ts']],
    ]);
    const findings = detectCircularDependencies(graph);
    // Should only report one finding, not two
    expect(findings).toHaveLength(1);
  });

  it('should return empty array for empty graph', () => {
    const graph = new Map<string, string[]>();
    const findings = detectCircularDependencies(graph);
    expect(findings).toHaveLength(0);
  });
});
