import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../src/audit/utils';
import {
  checkViteHashedFilenames,
  checkTreeShaking,
  checkEslintConfig,
  checkPrettierConfig,
  checkTestCoverage,
} from '../src/audit/build-reviewer';

beforeEach(() => {
  resetCounters();
});

describe('checkViteHashedFilenames', () => {
  it('should pass when config uses default hashed filenames', () => {
    const config = `
      export default defineConfig({
        build: {
          rollupOptions: {
            input: { main: './index.html' }
          }
        }
      });
    `;
    const findings = checkViteHashedFilenames(config);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('hashed asset filenames');
    expect(findings[0].requirementRef).toBe('Req 6.1');
  });

  it('should flag entryFileNames without hash', () => {
    const config = `
      export default defineConfig({
        build: {
          rollupOptions: {
            output: {
              entryFileNames: 'assets/[name].js'
            }
          }
        }
      });
    `;
    const findings = checkViteHashedFilenames(config);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('may not include content hashes');
  });

  it('should pass when entryFileNames includes [hash]', () => {
    const config = `
      export default defineConfig({
        build: {
          rollupOptions: {
            output: {
              entryFileNames: 'assets/[name]-[hash].js'
            }
          }
        }
      });
    `;
    const findings = checkViteHashedFilenames(config);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
  });

  it('should flag assetFileNames without hash', () => {
    const config = `
      export default defineConfig({
        build: {
          rollupOptions: {
            output: {
              assetFileNames: 'assets/[name].[ext]'
            }
          }
        }
      });
    `;
    const findings = checkViteHashedFilenames(config);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].description).toContain('assetFileNames');
  });
});

describe('checkTreeShaking', () => {
  const esmPackageJson = JSON.stringify({ type: 'module' });
  const cjsPackageJson = JSON.stringify({ name: 'test' });
  const defaultViteConfig = `export default defineConfig({});`;

  it('should pass when ESM and no treeshake override', () => {
    const findings = checkTreeShaking(defaultViteConfig, esmPackageJson);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('Tree-shaking is enabled');
    expect(findings[0].requirementRef).toBe('Req 6.2');
  });

  it('should flag when treeshake is explicitly disabled', () => {
    const config = `export default defineConfig({ build: { rollupOptions: { treeshake: false } } });`;
    const findings = checkTreeShaking(config, esmPackageJson);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('explicitly disabled');
  });

  it('should flag when project is not ESM', () => {
    const findings = checkTreeShaking(defaultViteConfig, cjsPackageJson);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('does not use ESM');
  });

  it('should handle invalid package.json', () => {
    const findings = checkTreeShaking(defaultViteConfig, 'not json');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('Unable to parse');
  });
});

describe('checkEslintConfig', () => {
  it('should pass when ESLint config exists', () => {
    const findings = checkEslintConfig(true);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('ESLint configuration is present');
    expect(findings[0].requirementRef).toBe('Req 6.3');
  });

  it('should flag when no ESLint config exists', () => {
    const findings = checkEslintConfig(false);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('No ESLint configuration found');
  });
});

describe('checkPrettierConfig', () => {
  it('should pass when Prettier config exists', () => {
    const findings = checkPrettierConfig(true);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('Prettier configuration is present');
    expect(findings[0].requirementRef).toBe('Req 6.4');
  });

  it('should flag when no Prettier config exists', () => {
    const findings = checkPrettierConfig(false);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('No Prettier configuration found');
  });
});

describe('checkTestCoverage', () => {
  it('should pass when @vitest/coverage-v8 is in devDependencies', () => {
    const pkg = JSON.stringify({
      devDependencies: { '@vitest/coverage-v8': '^4.1.0' },
    });
    const findings = checkTestCoverage(pkg);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('coverage reporting is configured');
    expect(findings[0].requirementRef).toBe('Req 6.5');
  });

  it('should flag when @vitest/coverage-v8 is missing', () => {
    const pkg = JSON.stringify({
      devDependencies: { vitest: '^4.1.0' },
    });
    const findings = checkTestCoverage(pkg);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('not configured');
  });

  it('should handle missing devDependencies key', () => {
    const pkg = JSON.stringify({ name: 'test' });
    const findings = checkTestCoverage(pkg);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('not configured');
  });

  it('should handle invalid package.json', () => {
    const findings = checkTestCoverage('not json');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('Unable to parse');
  });
});
