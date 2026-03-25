import { exec } from 'child_process';
import { promisify } from 'util';
import type { DependencyInfo, Finding, Severity } from './types';
import { createFinding } from './utils';

const execAsync = promisify(exec);

/** Shape of a single entry from `npm outdated --json`. */
interface NpmOutdatedEntry {
  current?: string;
  wanted?: string;
  latest?: string;
  dependent?: string;
  location?: string;
  deprecated?: string;
}

/** Shape of a single advisory from `npm audit --json`. */
interface NpmAuditVulnerability {
  severity: string;
  isDirect: boolean;
  via: unknown[];
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
}

interface NpmAuditOutput {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
}

/**
 * Classify the version difference between two semver strings.
 * Returns 'current' if versions match, otherwise 'major', 'minor', or 'patch'.
 */
export function classifyUpgrade(
  current: string,
  latest: string
): DependencyInfo['upgradeType'] {
  const cur = parseSemver(current);
  const lat = parseSemver(latest);

  if (!cur || !lat) return 'current';
  if (cur.major === lat.major && cur.minor === lat.minor && cur.patch === lat.patch) {
    return 'current';
  }
  if (cur.major !== lat.major) return 'major';
  if (cur.minor !== lat.minor) return 'minor';
  return 'patch';
}

/** Parse a semver string like "1.2.3" into its components. */
export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const cleaned = version.replace(/^[^0-9]*/, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/** Map npm audit severity strings to our Severity type. */
function mapVulnSeverity(npmSeverity: string): Severity {
  switch (npmSeverity.toLowerCase()) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'moderate':
    case 'medium': return 'Medium';
    default: return 'Low';
  }
}

/** Run a shell command and return stdout. Returns null on failure. */
async function runCommand(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error: unknown) {
    // npm outdated exits with code 1 when there are outdated packages — that's expected.
    // npm audit exits with non-zero when vulnerabilities are found — also expected.
    if (error && typeof error === 'object' && 'stdout' in error) {
      const stdout = (error as { stdout: string }).stdout;
      if (stdout && stdout.trim().length > 0) return stdout;
    }
    return null;
  }
}

/** Parse JSON safely, returning null on failure. */
function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Build DependencyInfo objects from npm outdated output and npm audit vulnerabilities.
 */
export function buildDependencyList(
  outdatedData: Record<string, NpmOutdatedEntry>,
  auditData: NpmAuditOutput
): DependencyInfo[] {
  const vulnMap = auditData.vulnerabilities ?? {};
  const deps: DependencyInfo[] = [];

  for (const [name, entry] of Object.entries(outdatedData)) {
    const current = entry.current ?? '0.0.0';
    const latest = entry.latest ?? current;
    const upgradeType = classifyUpgrade(current, latest);
    const isDeprecated = typeof entry.deprecated === 'string' && entry.deprecated.length > 0;
    const vuln = vulnMap[name];
    const hasVulnerability = vuln !== undefined;
    const vulnerabilitySeverity = hasVulnerability ? vuln.severity : undefined;

    deps.push({
      name,
      currentVersion: current,
      latestVersion: latest,
      upgradeType,
      isDeprecated,
      hasVulnerability,
      vulnerabilitySeverity,
    });
  }

  // Also include packages that appear only in audit (not in outdated)
  for (const [name, vuln] of Object.entries(vulnMap)) {
    if (!outdatedData[name]) {
      deps.push({
        name,
        currentVersion: 'unknown',
        latestVersion: 'unknown',
        upgradeType: 'current',
        isDeprecated: false,
        hasVulnerability: true,
        vulnerabilitySeverity: vuln.severity,
      });
    }
  }

  return deps;
}

/**
 * Create findings for outdated dependencies, deprecated packages, and vulnerabilities.
 */
export function createDependencyFindings(deps: DependencyInfo[]): Finding[] {
  const findings: Finding[] = [];

  for (const dep of deps) {
    if (dep.upgradeType !== 'current') {
      const severity: Severity = dep.upgradeType === 'major' ? 'Medium' : 'Low';
      findings.push(
        createFinding({
          category: 'Dependencies',
          severity,
          title: `Outdated dependency: ${dep.name}`,
          description: `${dep.name} is at version ${dep.currentVersion}, latest is ${dep.latestVersion} (${dep.upgradeType} upgrade).`,
          filePaths: ['package.json'],
          recommendation: `Upgrade ${dep.name} from ${dep.currentVersion} to ${dep.latestVersion}.`,
          requirementRef: dep.upgradeType === 'major' ? 'Req 1.2' : 'Req 1.3',
        })
      );
    }

    if (dep.isDeprecated) {
      findings.push(
        createFinding({
          category: 'Dependencies',
          severity: 'High',
          title: `Deprecated dependency: ${dep.name}`,
          description: `${dep.name} has been deprecated by its maintainer.`,
          filePaths: ['package.json'],
          recommendation: `Find a replacement for ${dep.name} and migrate away from it.`,
          requirementRef: 'Req 1.4',
        })
      );
    }

    if (dep.hasVulnerability) {
      const severity = mapVulnSeverity(dep.vulnerabilitySeverity ?? 'low');
      findings.push(
        createFinding({
          category: 'Security',
          severity,
          title: `Vulnerability in ${dep.name}`,
          description: `${dep.name} has a known ${dep.vulnerabilitySeverity ?? 'unknown'}-severity vulnerability.`,
          filePaths: ['package.json'],
          recommendation: `Run \`npm audit fix\` or upgrade ${dep.name} to a patched version.`,
          requirementRef: 'Req 3.1',
        })
      );
    }
  }

  return findings;
}

/** Upgrade type priority for sorting (higher risk first). */
const upgradeTypePriority: Record<DependencyInfo['upgradeType'], number> = {
  major: 0,
  minor: 1,
  patch: 2,
  current: 3,
};

/**
 * Produce a prioritized upgrade plan: security-impacting first, then by compatibility risk.
 */
export function prioritizeUpgradePlan(findings: Finding[], deps: DependencyInfo[]): Finding[] {
  const depMap = new Map(deps.map(d => [d.name, d]));

  const getDepName = (f: Finding): string => {
    const match = f.title.match(/:\s*(.+)$/);
    return match ? match[1] : '';
  };

  const isSecurityImpacting = (f: Finding): boolean => {
    const name = getDepName(f);
    const dep = depMap.get(name);
    return f.category === 'Security' || (dep?.hasVulnerability ?? false);
  };

  const getUpgradeTypeOrder = (f: Finding): number => {
    const name = getDepName(f);
    const dep = depMap.get(name);
    return dep ? upgradeTypePriority[dep.upgradeType] : 3;
  };

  return [...findings].sort((a, b) => {
    const aSecure = isSecurityImpacting(a) ? 0 : 1;
    const bSecure = isSecurityImpacting(b) ? 0 : 1;
    if (aSecure !== bSecure) return aSecure - bSecure;
    return getUpgradeTypeOrder(a) - getUpgradeTypeOrder(b);
  });
}

/**
 * Main entry point: audit all dependencies.
 * Runs `npm outdated --json` and `npm audit --json`, parses results,
 * and returns findings and dependency info.
 */
export async function auditDependencies(): Promise<{
  findings: Finding[];
  dependencies: DependencyInfo[];
}> {
  const [outdatedRaw, auditRaw] = await Promise.all([
    runCommand('npm outdated --json'),
    runCommand('npm audit --json'),
  ]);

  if (outdatedRaw === null && auditRaw === null) {
    return {
      findings: [
        createFinding({
          category: 'Dependencies',
          severity: 'Low',
          title: 'Unable to check dependencies',
          description:
            'Both `npm outdated` and `npm audit` failed. This may be due to network issues or missing node_modules.',
          filePaths: ['package.json'],
          recommendation:
            'Ensure node_modules are installed and network is available, then re-run the audit.',
          requirementRef: 'Req 1.1',
        }),
      ],
      dependencies: [],
    };
  }

  const outdatedData = outdatedRaw
    ? safeJsonParse<Record<string, NpmOutdatedEntry>>(outdatedRaw) ?? {}
    : {};
  const auditData = auditRaw
    ? safeJsonParse<NpmAuditOutput>(auditRaw) ?? {}
    : {};

  const dependencies = buildDependencyList(outdatedData, auditData);
  const findings = createDependencyFindings(dependencies);
  const prioritized = prioritizeUpgradePlan(findings, dependencies);

  return { findings: prioritized, dependencies };
}
