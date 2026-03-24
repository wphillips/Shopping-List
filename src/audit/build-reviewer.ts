import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { Finding } from './types';
import { createFinding } from './utils';

/**
 * Check whether the Vite config produces hashed asset filenames for cache-busting.
 * Vite defaults to content-hashed filenames unless explicitly overridden with
 * `build.rollupOptions.output.entryFileNames` / `assetFileNames` that strip the hash.
 * Pure function — operates on the raw vite config string.
 */
export function checkViteHashedFilenames(viteConfigContent: string): Finding[] {
  const findings: Finding[] = [];

  // Vite defaults to hashed filenames. Only flag if the config explicitly removes hashes
  // by setting entryFileNames or assetFileNames to a pattern without [hash].
  const entryMatch = viteConfigContent.match(/entryFileNames\s*:\s*['"`]([^'"`]+)['"`]/);
  const assetMatch = viteConfigContent.match(/assetFileNames\s*:\s*['"`]([^'"`]+)['"`]/);
  const chunkMatch = viteConfigContent.match(/chunkFileNames\s*:\s*['"`]([^'"`]+)['"`]/);

  const unhashed: string[] = [];
  if (entryMatch && !entryMatch[1].includes('[hash]') && !entryMatch[1].includes('hash')) {
    unhashed.push('entryFileNames');
  }
  if (assetMatch && !assetMatch[1].includes('[hash]') && !assetMatch[1].includes('hash')) {
    unhashed.push('assetFileNames');
  }
  if (chunkMatch && !chunkMatch[1].includes('[hash]') && !chunkMatch[1].includes('hash')) {
    unhashed.push('chunkFileNames');
  }

  if (unhashed.length > 0) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'Vite output filenames may not include content hashes',
        description:
          `The Vite config overrides ${unhashed.join(', ')} with a pattern that does not include a hash. ` +
          'Without content hashes, browsers may serve stale cached assets after deployments.',
        filePaths: ['vite.config.ts'],
        recommendation:
          'Ensure entryFileNames, chunkFileNames, and assetFileNames include [hash] in their patterns for cache-busting.',
        requirementRef: 'Req 6.1',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Low',
        title: 'Vite produces hashed asset filenames',
        description:
          'The Vite configuration uses the default content-hashed filenames (or explicitly includes [hash]). ' +
          'This ensures proper cache-busting on deployments.',
        filePaths: ['vite.config.ts'],
        recommendation: 'No action needed. Hashed filenames are correctly configured.',
        requirementRef: 'Req 6.1',
      })
    );
  }

  return findings;
}

/**
 * Check that tree-shaking is enabled. Vite uses Rollup which tree-shakes by default
 * when the project uses ESM ("type": "module" in package.json).
 * Pure function — operates on the vite config and package.json strings.
 */
export function checkTreeShaking(
  viteConfigContent: string,
  packageJsonContent: string
): Finding[] {
  const findings: Finding[] = [];

  let packageJson: Record<string, unknown>;
  try {
    packageJson = JSON.parse(packageJsonContent);
  } catch {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'Unable to parse package.json for tree-shaking check',
        description: 'package.json could not be parsed as JSON. Tree-shaking verification was skipped.',
        filePaths: ['package.json'],
        recommendation: 'Fix the JSON syntax in package.json.',
        requirementRef: 'Req 6.2',
      })
    );
    return findings;
  }

  const isEsm = packageJson.type === 'module';

  // Check if tree-shaking is explicitly disabled in the Vite config
  const treeShakeDisabled =
    /treeshake\s*:\s*false/.test(viteConfigContent) ||
    /treeshake\s*:\s*['"]false['"]/.test(viteConfigContent);

  if (treeShakeDisabled) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'High',
        title: 'Tree-shaking is explicitly disabled in Vite config',
        description:
          'The Vite/Rollup configuration explicitly disables tree-shaking. ' +
          'Dead code will be included in the production bundle, increasing bundle size.',
        filePaths: ['vite.config.ts'],
        recommendation:
          'Remove the `treeshake: false` setting to re-enable Rollup tree-shaking.',
        requirementRef: 'Req 6.2',
      })
    );
  } else if (!isEsm) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'Project does not use ESM — tree-shaking may be limited',
        description:
          'package.json does not set "type": "module". While Vite/Rollup can still tree-shake, ' +
          'ESM is the recommended module format for optimal dead-code elimination.',
        filePaths: ['package.json'],
        recommendation:
          'Set "type": "module" in package.json to ensure full ESM tree-shaking support.',
        requirementRef: 'Req 6.2',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Low',
        title: 'Tree-shaking is enabled via ESM + Rollup defaults',
        description:
          'The project uses ESM ("type": "module") and Vite/Rollup tree-shakes by default. ' +
          'Dead code is eliminated from the production bundle.',
        filePaths: ['vite.config.ts', 'package.json'],
        recommendation: 'No action needed. Tree-shaking is correctly configured.',
        requirementRef: 'Req 6.2',
      })
    );
  }

  return findings;
}

/**
 * Check for ESLint configuration presence.
 * Pure function — takes a boolean indicating whether any ESLint config file exists.
 */
export function checkEslintConfig(fileExists: boolean): Finding[] {
  const findings: Finding[] = [];

  if (!fileExists) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'No ESLint configuration found',
        description:
          'No ESLint configuration file was found in the project root ' +
          '(e.g., .eslintrc.*, eslint.config.*, or eslintConfig in package.json). ' +
          'Without a linter, code quality issues may go undetected.',
        filePaths: ['(project root)'],
        recommendation:
          'Add an ESLint configuration (e.g., eslint.config.js) with TypeScript support. ' +
          'Consider using @typescript-eslint/eslint-plugin for type-aware linting.',
        requirementRef: 'Req 6.3',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Low',
        title: 'ESLint configuration is present',
        description: 'An ESLint configuration file was found in the project.',
        filePaths: ['(project root)'],
        recommendation: 'No action needed. ESLint is configured.',
        requirementRef: 'Req 6.3',
      })
    );
  }

  return findings;
}

/**
 * Check for Prettier configuration presence.
 * Pure function — takes a boolean indicating whether any Prettier config file exists.
 */
export function checkPrettierConfig(fileExists: boolean): Finding[] {
  const findings: Finding[] = [];

  if (!fileExists) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'No Prettier configuration found',
        description:
          'No Prettier configuration file was found in the project root ' +
          '(e.g., .prettierrc, prettier.config.*, or prettier key in package.json). ' +
          'Without a formatter, code style inconsistencies may accumulate.',
        filePaths: ['(project root)'],
        recommendation:
          'Add a Prettier configuration (e.g., .prettierrc.json) and integrate it with your editor and CI pipeline.',
        requirementRef: 'Req 6.4',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Low',
        title: 'Prettier configuration is present',
        description: 'A Prettier configuration file was found in the project.',
        filePaths: ['(project root)'],
        recommendation: 'No action needed. Prettier is configured.',
        requirementRef: 'Req 6.4',
      })
    );
  }

  return findings;
}

/**
 * Check for @vitest/coverage-v8 in devDependencies for test coverage reporting.
 * Pure function — operates on the raw package.json string.
 */
export function checkTestCoverage(packageJsonContent: string): Finding[] {
  const findings: Finding[] = [];

  let packageJson: Record<string, unknown>;
  try {
    packageJson = JSON.parse(packageJsonContent);
  } catch {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'Unable to parse package.json for coverage check',
        description: 'package.json could not be parsed as JSON. Test coverage verification was skipped.',
        filePaths: ['package.json'],
        recommendation: 'Fix the JSON syntax in package.json.',
        requirementRef: 'Req 6.5',
      })
    );
    return findings;
  }

  const devDeps = (packageJson.devDependencies ?? {}) as Record<string, string>;
  const hasCoverageV8 = '@vitest/coverage-v8' in devDeps;

  if (!hasCoverageV8) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'Test coverage reporting is not configured',
        description:
          '@vitest/coverage-v8 is not listed in devDependencies. ' +
          'Without a coverage provider, test coverage metrics cannot be generated.',
        filePaths: ['package.json'],
        recommendation:
          'Install @vitest/coverage-v8 as a dev dependency: npm install -D @vitest/coverage-v8',
        requirementRef: 'Req 6.5',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Low',
        title: 'Test coverage reporting is configured',
        description:
          '@vitest/coverage-v8 is present in devDependencies, enabling code coverage reporting.',
        filePaths: ['package.json'],
        recommendation: 'No action needed. Test coverage provider is installed.',
        requirementRef: 'Req 6.5',
      })
    );
  }

  return findings;
}

/**
 * Read a file safely, returning null if it doesn't exist or can't be read.
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

const ESLINT_CONFIG_PATTERNS = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
];

const PRETTIER_CONFIG_PATTERNS = [
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.toml',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts',
];

/**
 * Check if any file from a list of patterns exists in the project root.
 */
async function anyFileExists(patterns: string[]): Promise<boolean> {
  for (const pattern of patterns) {
    const content = await safeReadFile(resolve(pattern));
    if (content !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Check if package.json contains a given key (e.g., "eslintConfig", "prettier").
 */
function packageJsonHasKey(packageJsonContent: string, key: string): boolean {
  try {
    const pkg = JSON.parse(packageJsonContent);
    return key in pkg;
  } catch {
    return false;
  }
}

/**
 * Main entry point: run all build configuration checks and return findings.
 */
export async function reviewBuild(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Read required files
  const viteConfigContent = await safeReadFile(resolve('vite.config.ts'));
  const packageJsonContent = await safeReadFile(resolve('package.json'));

  if (!packageJsonContent) {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'High',
        title: 'Unable to read package.json',
        description: 'Could not read package.json. All build checks that depend on it were skipped.',
        filePaths: ['package.json'],
        recommendation: 'Verify that package.json exists and is readable.',
        requirementRef: 'Req 6.1',
      })
    );
    return findings;
  }

  // 1. Check Vite hashed filenames (Req 6.1)
  if (viteConfigContent) {
    findings.push(...checkViteHashedFilenames(viteConfigContent));
  } else {
    findings.push(
      createFinding({
        category: 'Build',
        severity: 'Medium',
        title: 'Unable to read vite.config.ts',
        description:
          'Could not read vite.config.ts. Hashed filename and tree-shaking checks were skipped.',
        filePaths: ['vite.config.ts'],
        recommendation: 'Verify that vite.config.ts exists and is readable.',
        requirementRef: 'Req 6.1',
      })
    );
  }

  // 2. Check tree-shaking (Req 6.2)
  if (viteConfigContent) {
    findings.push(...checkTreeShaking(viteConfigContent, packageJsonContent));
  }

  // 3. Check ESLint config (Req 6.3)
  const eslintExists =
    (await anyFileExists(ESLINT_CONFIG_PATTERNS)) ||
    packageJsonHasKey(packageJsonContent, 'eslintConfig');
  findings.push(...checkEslintConfig(eslintExists));

  // 4. Check Prettier config (Req 6.4)
  const prettierExists =
    (await anyFileExists(PRETTIER_CONFIG_PATTERNS)) ||
    packageJsonHasKey(packageJsonContent, 'prettier');
  findings.push(...checkPrettierConfig(prettierExists));

  // 5. Check test coverage (Req 6.5)
  findings.push(...checkTestCoverage(packageJsonContent));

  return findings;
}
