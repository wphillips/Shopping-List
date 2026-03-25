import type { AuditReport, Finding } from './types';
import { auditDependencies } from './dependency-auditor';
import { detectDuplicates } from './duplicate-detector';
import { inspectSecurity } from './security-inspector';
import { reviewTypeScript } from './typescript-reviewer';
import { reviewPwa } from './pwa-reviewer';
import { reviewBuild } from './build-reviewer';
import { reviewInfrastructure } from './infra-reviewer';
import { reviewArchitecture } from './architecture-reviewer';
import { generateReport, writeReport } from './report-generator';

interface AuditModule {
  name: string;
  run: () => Promise<Finding[]>;
}

const auditModules: AuditModule[] = [
  {
    name: 'dependency audit',
    run: async () => {
      const { findings } = await auditDependencies();
      return findings;
    },
  },
  { name: 'duplicate detection', run: detectDuplicates },
  { name: 'security inspection', run: inspectSecurity },
  { name: 'TypeScript review', run: reviewTypeScript },
  { name: 'PWA review', run: reviewPwa },
  { name: 'build review', run: reviewBuild },
  { name: 'infrastructure review', run: reviewInfrastructure },
  { name: 'architecture review', run: reviewArchitecture },
];

/**
 * Run the full codebase audit pipeline.
 *
 * Executes each audit module in sequence, collects all findings,
 * generates a report, and writes it to `audit-report.md`.
 * Individual module failures are caught and logged — the audit
 * continues with the remaining modules.
 */
export async function runAudit(): Promise<AuditReport> {
  const allFindings: Finding[] = [];

  for (const mod of auditModules) {
    console.log(`Running ${mod.name}...`);
    try {
      const findings = await mod.run();
      allFindings.push(...findings);
      console.log(`  ✓ ${mod.name} complete (${findings.length} findings)`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  ⚠ ${mod.name} failed: ${message}`);
    }
  }

  const report = generateReport(allFindings);
  await writeReport(report);
  console.log(`Audit complete — ${allFindings.length} findings written to audit-report.md`);

  return report;
}
