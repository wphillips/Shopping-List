export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type AuditCategory =
  | 'Dependencies'
  | 'Duplicate Code'
  | 'Security'
  | 'TypeScript'
  | 'PWA'
  | 'Build'
  | 'Infrastructure'
  | 'Architecture';

export interface Finding {
  id: string;
  category: AuditCategory;
  severity: Severity;
  title: string;
  description: string;
  filePaths: string[];
  lineRanges?: string[];
  recommendation: string;
  requirementRef: string;
}

export interface DependencyInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: 'major' | 'minor' | 'patch' | 'current';
  isDeprecated: boolean;
  hasVulnerability: boolean;
  vulnerabilitySeverity?: string;
}

export interface AuditReport {
  generatedAt: string;
  findings: Finding[];
  summary: Record<Severity, number>;
  actionPlan: Finding[];
}
