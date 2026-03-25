import { describe, it, expect, beforeEach } from 'vitest';
import { createFinding, compareSeverity, resetCounters } from '../src/audit/utils';
import type { Severity, AuditCategory } from '../src/audit/types';

describe('createFinding', () => {
  beforeEach(() => {
    resetCounters();
  });

  it('should generate an ID with the correct category prefix', () => {
    const finding = createFinding({
      category: 'Security',
      severity: 'High',
      title: 'innerHTML usage',
      description: 'Found innerHTML assignment',
      filePaths: ['src/index.ts'],
      recommendation: 'Use textContent instead',
      requirementRef: 'Req 3.2',
    });
    expect(finding.id).toBe('SEC-001');
  });

  it('should auto-increment IDs within the same category', () => {
    const base = {
      category: 'Dependencies' as AuditCategory,
      severity: 'Medium' as Severity,
      title: 'Outdated dep',
      description: 'Dep is outdated',
      filePaths: ['package.json'],
      recommendation: 'Upgrade',
      requirementRef: 'Req 1.1',
    };
    const f1 = createFinding(base);
    const f2 = createFinding(base);
    const f3 = createFinding(base);
    expect(f1.id).toBe('DEP-001');
    expect(f2.id).toBe('DEP-002');
    expect(f3.id).toBe('DEP-003');
  });

  it('should maintain separate counters per category', () => {
    const sec = createFinding({
      category: 'Security',
      severity: 'Critical',
      title: 'Vuln',
      description: 'desc',
      filePaths: ['src/a.ts'],
      recommendation: 'fix',
      requirementRef: 'Req 3.1',
    });
    const dep = createFinding({
      category: 'Dependencies',
      severity: 'Low',
      title: 'Old dep',
      description: 'desc',
      filePaths: ['package.json'],
      recommendation: 'upgrade',
      requirementRef: 'Req 1.1',
    });
    const sec2 = createFinding({
      category: 'Security',
      severity: 'High',
      title: 'Another vuln',
      description: 'desc',
      filePaths: ['src/b.ts'],
      recommendation: 'fix',
      requirementRef: 'Req 3.2',
    });
    expect(sec.id).toBe('SEC-001');
    expect(dep.id).toBe('DEP-001');
    expect(sec2.id).toBe('SEC-002');
  });

  it('should use correct prefixes for all categories', () => {
    const categories: Array<[AuditCategory, string]> = [
      ['Dependencies', 'DEP'],
      ['Duplicate Code', 'DUP'],
      ['Security', 'SEC'],
      ['TypeScript', 'TS'],
      ['PWA', 'PWA'],
      ['Build', 'BLD'],
      ['Infrastructure', 'INF'],
      ['Architecture', 'ARC'],
    ];
    for (const [category, prefix] of categories) {
      const finding = createFinding({
        category,
        severity: 'Low',
        title: 'test',
        description: 'test',
        filePaths: ['test.ts'],
        recommendation: 'test',
        requirementRef: 'Req 1.1',
      });
      expect(finding.id).toBe(`${prefix}-001`);
    }
  });

  it('should preserve all provided fields in the returned finding', () => {
    const params = {
      category: 'PWA' as AuditCategory,
      severity: 'Medium' as Severity,
      title: 'Missing field',
      description: 'Manifest missing theme_color',
      filePaths: ['public/manifest.webmanifest'],
      lineRanges: ['1-10'],
      recommendation: 'Add theme_color',
      requirementRef: 'Req 5.1',
    };
    const finding = createFinding(params);
    expect(finding.category).toBe(params.category);
    expect(finding.severity).toBe(params.severity);
    expect(finding.title).toBe(params.title);
    expect(finding.description).toBe(params.description);
    expect(finding.filePaths).toEqual(params.filePaths);
    expect(finding.lineRanges).toEqual(params.lineRanges);
    expect(finding.recommendation).toBe(params.recommendation);
    expect(finding.requirementRef).toBe(params.requirementRef);
  });
});

describe('compareSeverity', () => {
  it('should return negative when a is higher severity than b', () => {
    expect(compareSeverity('Critical', 'Low')).toBeLessThan(0);
    expect(compareSeverity('High', 'Medium')).toBeLessThan(0);
  });

  it('should return positive when b is higher severity than a', () => {
    expect(compareSeverity('Low', 'Critical')).toBeGreaterThan(0);
    expect(compareSeverity('Medium', 'High')).toBeGreaterThan(0);
  });

  it('should return 0 when severities are equal', () => {
    const levels: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
    for (const level of levels) {
      expect(compareSeverity(level, level)).toBe(0);
    }
  });

  it('should produce correct ordering when used with Array.sort', () => {
    const items: Severity[] = ['Low', 'Critical', 'Medium', 'High'];
    const sorted = [...items].sort(compareSeverity);
    expect(sorted).toEqual(['Critical', 'High', 'Medium', 'Low']);
  });
});

describe('resetCounters', () => {
  it('should reset all counters so IDs start from 001 again', () => {
    createFinding({
      category: 'Security',
      severity: 'High',
      title: 'test',
      description: 'test',
      filePaths: ['test.ts'],
      recommendation: 'test',
      requirementRef: 'Req 3.1',
    });
    resetCounters();
    const finding = createFinding({
      category: 'Security',
      severity: 'High',
      title: 'test',
      description: 'test',
      filePaths: ['test.ts'],
      recommendation: 'test',
      requirementRef: 'Req 3.1',
    });
    expect(finding.id).toBe('SEC-001');
  });
});
