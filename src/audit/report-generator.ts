import { writeFile } from 'node:fs/promises';
import type { AuditCategory, AuditReport, Finding, Severity } from './types';
import { compareSeverity } from './utils';

const SEVERITY_LEVELS: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

const CATEGORY_ORDER: AuditCategory[] = [
  'Dependencies',
  'Duplicate Code',
  'Security',
  'TypeScript',
  'PWA',
  'Build',
  'Infrastructure',
  'Architecture',
];

/**
 * Counts findings per severity level.
 */
export function computeSummary(findings: Finding[]): Record<Severity, number> {
  const summary: Record<Severity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  for (const f of findings) {
    summary[f.severity]++;
  }
  return summary;
}

/**
 * Sorts findings by severity (Critical first) for the action plan.
 */
export function buildActionPlan(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => compareSeverity(a.severity, b.severity));
}

/**
 * Creates an AuditReport from a list of findings.
 */
export function generateReport(findings: Finding[]): AuditReport {
  return {
    generatedAt: new Date().toISOString(),
    findings,
    summary: computeSummary(findings),
    actionPlan: buildActionPlan(findings),
  };
}

/**
 * Renders an AuditReport as a Markdown string.
 */
export function renderReportMarkdown(report: AuditReport): string {
  const lines: string[] = [];

  lines.push('# Codebase Audit Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const level of SEVERITY_LEVELS) {
    lines.push(`| ${level} | ${report.summary[level]} |`);
  }
  lines.push('');

  // Findings grouped by category
  lines.push('## Findings');
  lines.push('');

  const grouped = groupByCategory(report.findings);
  for (const category of CATEGORY_ORDER) {
    lines.push(`### ${category}`);
    lines.push('');
    const categoryFindings = grouped.get(category);
    if (!categoryFindings || categoryFindings.length === 0) {
      lines.push('No issues found.');
      lines.push('');
      continue;
    }
    for (const f of categoryFindings) {
      lines.push(`#### ${f.id}: ${f.title}`);
      lines.push('');
      lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Description:** ${f.description}`);
      lines.push(`- **Affected files:** ${f.filePaths.join(', ')}`);
      if (f.lineRanges && f.lineRanges.length > 0) {
        lines.push(`- **Line ranges:** ${f.lineRanges.join(', ')}`);
      }
      lines.push(`- **Recommendation:** ${f.recommendation}`);
      lines.push('');
    }
  }

  // Prioritized action plan
  lines.push('## Prioritized Action Plan');
  lines.push('');
  if (report.actionPlan.length === 0) {
    lines.push('No actions required.');
    lines.push('');
  } else {
    lines.push('| Priority | ID | Severity | Title |');
    lines.push('|----------|----|----------|-------|');
    for (let i = 0; i < report.actionPlan.length; i++) {
      const f = report.actionPlan[i];
      lines.push(`| ${i + 1} | ${f.id} | ${f.severity} | ${f.title} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function groupByCategory(findings: Finding[]): Map<AuditCategory, Finding[]> {
  const map = new Map<AuditCategory, Finding[]>();
  for (const f of findings) {
    const list = map.get(f.category);
    if (list) {
      list.push(f);
    } else {
      map.set(f.category, [f]);
    }
  }
  return map;
}

/**
 * Renders the report to Markdown and writes it to disk.
 */
export async function writeReport(
  report: AuditReport,
  outputPath: string = 'audit-report.md'
): Promise<void> {
  const markdown = renderReportMarkdown(report);
  await writeFile(outputPath, markdown, 'utf-8');
}
