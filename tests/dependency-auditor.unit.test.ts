import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyUpgrade,
  parseSemver,
  buildDependencyList,
  createDependencyFindings,
  prioritizeUpgradePlan,
} from '../src/audit/dependency-auditor';
import { resetCounters } from '../src/audit/utils';

describe('parseSemver', () => {
  it('should parse a standard semver string', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('should strip leading caret/tilde', () => {
    expect(parseSemver('^4.6.0')).toEqual({ major: 4, minor: 6, patch: 0 });
    expect(parseSemver('~1.5.0')).toEqual({ major: 1, minor: 5, patch: 0 });
  });

  it('should return null for invalid strings', () => {
    expect(parseSemver('')).toBeNull();
    expect(parseSemver('not-a-version')).toBeNull();
  });
});

describe('classifyUpgrade', () => {
  it('should return current when versions match', () => {
    expect(classifyUpgrade('1.2.3', '1.2.3')).toBe('current');
  });

  it('should return major when major version differs', () => {
    expect(classifyUpgrade('1.2.3', '2.0.0')).toBe('major');
  });

  it('should return minor when only minor differs', () => {
    expect(classifyUpgrade('1.2.3', '1.3.0')).toBe('minor');
  });

  it('should return patch when only patch differs', () => {
    expect(classifyUpgrade('1.2.3', '1.2.4')).toBe('patch');
  });

  it('should return current for unparseable versions', () => {
    expect(classifyUpgrade('bad', 'worse')).toBe('current');
  });
});

describe('buildDependencyList', () => {
  beforeEach(() => resetCounters());

  it('should build dependency info from outdated data', () => {
    const outdated = {
      vite: { current: '4.0.0', latest: '5.0.0' },
      typescript: { current: '5.3.3', latest: '5.3.3' },
    };
    const deps = buildDependencyList(outdated, {});
    expect(deps).toHaveLength(2);

    const vite = deps.find(d => d.name === 'vite')!;
    expect(vite.upgradeType).toBe('major');
    expect(vite.currentVersion).toBe('4.0.0');
    expect(vite.latestVersion).toBe('5.0.0');
    expect(vite.hasVulnerability).toBe(false);

    const ts = deps.find(d => d.name === 'typescript')!;
    expect(ts.upgradeType).toBe('current');
  });

  it('should flag deprecated packages', () => {
    const outdated = {
      'old-pkg': { current: '1.0.0', latest: '1.0.1', deprecated: 'Use new-pkg instead' },
    };
    const deps = buildDependencyList(outdated, {});
    expect(deps[0].isDeprecated).toBe(true);
  });

  it('should merge vulnerability info from audit data', () => {
    const outdated = {
      lodash: { current: '4.17.20', latest: '4.17.21' },
    };
    const audit = {
      vulnerabilities: {
        lodash: {
          severity: 'high',
          isDirect: true,
          via: [],
          effects: [],
          range: '<4.17.21',
          nodes: ['node_modules/lodash'],
          fixAvailable: true,
        },
      },
    };
    const deps = buildDependencyList(outdated, audit);
    expect(deps[0].hasVulnerability).toBe(true);
    expect(deps[0].vulnerabilitySeverity).toBe('high');
  });

  it('should include audit-only packages not in outdated', () => {
    const audit = {
      vulnerabilities: {
        'hidden-pkg': {
          severity: 'critical',
          isDirect: false,
          via: [],
          effects: [],
          range: '*',
          nodes: [],
          fixAvailable: false,
        },
      },
    };
    const deps = buildDependencyList({}, audit);
    expect(deps).toHaveLength(1);
    expect(deps[0].name).toBe('hidden-pkg');
    expect(deps[0].hasVulnerability).toBe(true);
  });
});

describe('createDependencyFindings', () => {
  beforeEach(() => resetCounters());

  it('should create findings for outdated deps', () => {
    const deps = [
      {
        name: 'vite',
        currentVersion: '4.0.0',
        latestVersion: '5.0.0',
        upgradeType: 'major' as const,
        isDeprecated: false,
        hasVulnerability: false,
      },
    ];
    const findings = createDependencyFindings(deps);
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('Dependencies');
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('vite');
  });

  it('should create findings for deprecated deps', () => {
    const deps = [
      {
        name: 'old-pkg',
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        upgradeType: 'current' as const,
        isDeprecated: true,
        hasVulnerability: false,
      },
    ];
    const findings = createDependencyFindings(deps);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('Deprecated');
  });

  it('should create security findings for vulnerable deps', () => {
    const deps = [
      {
        name: 'lodash',
        currentVersion: '4.17.20',
        latestVersion: '4.17.21',
        upgradeType: 'patch' as const,
        isDeprecated: false,
        hasVulnerability: true,
        vulnerabilitySeverity: 'high',
      },
    ];
    const findings = createDependencyFindings(deps);
    const secFinding = findings.find(f => f.category === 'Security');
    expect(secFinding).toBeDefined();
    expect(secFinding!.severity).toBe('High');
  });

  it('should not create findings for current, non-deprecated, non-vulnerable deps', () => {
    const deps = [
      {
        name: 'ok-pkg',
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        upgradeType: 'current' as const,
        isDeprecated: false,
        hasVulnerability: false,
      },
    ];
    const findings = createDependencyFindings(deps);
    expect(findings).toHaveLength(0);
  });
});

describe('prioritizeUpgradePlan', () => {
  beforeEach(() => resetCounters());

  it('should place security-impacting findings before non-security', () => {
    const deps = [
      {
        name: 'safe-pkg',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        upgradeType: 'major' as const,
        isDeprecated: false,
        hasVulnerability: false,
      },
      {
        name: 'vuln-pkg',
        currentVersion: '1.0.0',
        latestVersion: '1.0.1',
        upgradeType: 'patch' as const,
        isDeprecated: false,
        hasVulnerability: true,
        vulnerabilitySeverity: 'high',
      },
    ];
    const findings = createDependencyFindings(deps);
    const plan = prioritizeUpgradePlan(findings, deps);

    // The security finding for vuln-pkg should come first
    const firstSecIdx = plan.findIndex(f => f.title.includes('vuln-pkg'));
    const safePkgIdx = plan.findIndex(f => f.title.includes('safe-pkg'));
    expect(firstSecIdx).toBeLessThan(safePkgIdx);
  });

  it('should order by upgrade type within same security group', () => {
    const deps = [
      {
        name: 'minor-pkg',
        currentVersion: '1.0.0',
        latestVersion: '1.1.0',
        upgradeType: 'minor' as const,
        isDeprecated: false,
        hasVulnerability: false,
      },
      {
        name: 'major-pkg',
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
        upgradeType: 'major' as const,
        isDeprecated: false,
        hasVulnerability: false,
      },
    ];
    const findings = createDependencyFindings(deps);
    const plan = prioritizeUpgradePlan(findings, deps);

    const majorIdx = plan.findIndex(f => f.title.includes('major-pkg'));
    const minorIdx = plan.findIndex(f => f.title.includes('minor-pkg'));
    expect(majorIdx).toBeLessThan(minorIdx);
  });
});
