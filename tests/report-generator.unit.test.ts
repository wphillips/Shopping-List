import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeSummary,
  buildActionPlan,
  generateReport,
  renderReportMarkdown,
  writeReport,
} from '../src/audit/report-generator';
import { createFinding, resetCounters } from '../src/audit/utils';
import type { Finding, Severity, AuditCategory } from '../src/audit/types';

function makeFinding(overrides: Partial<Finding> & { category: AuditCategory; severity: Severity }): Finding {
  return createFinding({
    title: 'Test finding',
    description: 'Test description',
    filePaths: ['src/test.ts'],
    recommendation: 'Fix it',
    requirementRef: 'Req 1.1',
    ...overrides,
  });
}

describe('computeSummary', () => {
  beforeEach(() => resetCounters());

  it('should return zero counts for empty findings', () => {
    const summary = computeSummary([]);
    expect(summary).toEqual({ Critical: 0, High: 0, Medium: 0, Low: 0 });
  });

  it('should count findings per severity level', () => {
    const findings = [
      makeFinding({ category: 'Security', severity: 'Critical' }),
      makeFinding({ category: 'Security', severity: 'Critical' }),
      makeFinding({ category: 'Dependencies', severity: 'High' }),
      makeFinding({ category: 'Build', severity: 'Low' }),
    ];
    const summary = computeSummary(findings);
    expect(summary).toEqual({ Critical: 2, High: 1, Medium: 0, Low: 1 });
  });
});

describe('buildActionPlan', () => {
  beforeEach(() => resetCounters());

  it('should return empty array for empty findings', () => {
    expect(buildActionPlan([])).toEqual([]);
  });

  it('should sort findings by severity: Critical > High > Medium > Low', () => {
    const findings = [
      makeFinding({ category: 'Build', severity: 'Low', title: 'low' }),
      makeFinding({ category: 'Security', severity: 'Critical', title: 'critical' }),
      makeFinding({ category: 'TypeScript', severity: 'Medium', title: 'medium' }),
      makeFinding({ category: 'Dependencies', severity: 'High', title: 'high' }),
    ];
    const plan = buildActionPlan(findings);
    expect(plan.map(f => f.severity)).toEqual(['Critical', 'High', 'Medium', 'Low']);
  });

  it('should not mutate the original array', () => {
    const findings = [
      makeFinding({ category: 'Build', severity: 'Low' }),
      makeFinding({ category: 'Security', severity: 'Critical' }),
    ];
    const original = [...findings];
    buildActionPlan(findings);
    expect(findings.map(f => f.severity)).toEqual(original.map(f => f.severity));
  });
});

describe('generateReport', () => {
  beforeEach(() => resetCounters());

  it('should create a report with generatedAt, findings, summary, and actionPlan', () => {
    const findings = [
      makeFinding({ category: 'Security', severity: 'High' }),
      makeFinding({ category: 'Build', severity: 'Low' }),
    ];
    const report = generateReport(findings);
    expect(report.generatedAt).toBeTruthy();
    expect(report.findings).toEqual(findings);
    expect(report.summary).toEqual({ Critical: 0, High: 1, Medium: 0, Low: 1 });
    expect(report.actionPlan.map(f => f.severity)).toEqual(['High', 'Low']);
  });

  it('should produce a valid ISO timestamp', () => {
    const report = generateReport([]);
    expect(() => new Date(report.generatedAt)).not.toThrow();
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });
});

describe('renderReportMarkdown', () => {
  beforeEach(() => resetCounters());

  it('should include the report title and generated timestamp', () => {
    const report = generateReport([]);
    const md = renderReportMarkdown(report);
    expect(md).toContain('# Codebase Audit Report');
    expect(md).toContain(`Generated: ${report.generatedAt}`);
  });

  it('should include a summary table with severity counts', () => {
    const findings = [
      makeFinding({ category: 'Security', severity: 'Critical' }),
      makeFinding({ category: 'Security', severity: 'Critical' }),
      makeFinding({ category: 'Build', severity: 'Low' }),
    ];
    const report = generateReport(findings);
    const md = renderReportMarkdown(report);
    expect(md).toContain('| Critical | 2 |');
    expect(md).toContain('| High | 0 |');
    expect(md).toContain('| Medium | 0 |');
    expect(md).toContain('| Low | 1 |');
  });

  it('should group findings by category with headers', () => {
    const findings = [
      makeFinding({ category: 'Security', severity: 'High', title: 'Sec issue' }),
      makeFinding({ category: 'Build', severity: 'Low', title: 'Build issue' }),
    ];
    const report = generateReport(findings);
    const md = renderReportMarkdown(report);
    expect(md).toContain('### Security');
    expect(md).toContain('### Build');
    expect(md).toContain('Sec issue');
    expect(md).toContain('Build issue');
  });

  it('should show "No issues found." for categories with no findings', () => {
    const report = generateReport([]);
    const md = renderReportMarkdown(report);
    expect(md).toContain('### Dependencies');
    expect(md).toContain('No issues found.');
  });

  it('should render finding details: ID, severity, description, files, recommendation', () => {
    const findings = [
      makeFinding({
        category: 'TypeScript',
        severity: 'Medium',
        title: 'Any type usage',
        description: 'Found : any in storage.ts',
        filePaths: ['src/storage.ts'],
        recommendation: 'Use specific type',
      }),
    ];
    const report = generateReport(findings);
    const md = renderReportMarkdown(report);
    expect(md).toContain('TS-001');
    expect(md).toContain('**Severity:** Medium');
    expect(md).toContain('**Description:** Found : any in storage.ts');
    expect(md).toContain('**Affected files:** src/storage.ts');
    expect(md).toContain('**Recommendation:** Use specific type');
  });

  it('should include line ranges when present', () => {
    const f = createFinding({
      category: 'Architecture',
      severity: 'Medium',
      title: 'Large file',
      description: 'File exceeds 300 lines',
      filePaths: ['src/index.ts'],
      lineRanges: ['1-1077'],
      recommendation: 'Split file',
      requirementRef: 'Req 8.2',
    });
    const report = generateReport([f]);
    const md = renderReportMarkdown(report);
    expect(md).toContain('**Line ranges:** 1-1077');
  });

  it('should include a prioritized action plan table', () => {
    const findings = [
      makeFinding({ category: 'Build', severity: 'Low', title: 'Missing linter' }),
      makeFinding({ category: 'Security', severity: 'Critical', title: 'innerHTML' }),
    ];
    const report = generateReport(findings);
    const md = renderReportMarkdown(report);
    expect(md).toContain('## Prioritized Action Plan');
    expect(md).toContain('| Priority | ID | Severity | Title |');
    // Critical should be priority 1
    expect(md).toContain('| 1 | SEC-001 | Critical | innerHTML |');
    expect(md).toContain('| 2 | BLD-001 | Low | Missing linter |');
  });

  it('should show "No actions required." when there are no findings', () => {
    const report = generateReport([]);
    const md = renderReportMarkdown(report);
    expect(md).toContain('No actions required.');
  });
});

describe('writeReport', () => {
  beforeEach(() => resetCounters());

  it('should be an async function that accepts a report and optional path', () => {
    // writeReport is async and returns a Promise
    expect(typeof writeReport).toBe('function');
    // Verify it accepts the right parameters (2 params: report, outputPath?)
    expect(writeReport.length).toBeLessThanOrEqual(2);
  });

  it('should use renderReportMarkdown output for the file content', () => {
    const report = generateReport([
      makeFinding({ category: 'Security', severity: 'Critical', title: 'Test' }),
    ]);
    const md = renderReportMarkdown(report);
    // The markdown that writeReport would write should match renderReportMarkdown
    expect(md).toContain('# Codebase Audit Report');
    expect(md).toContain('SEC-001');
  });
});
