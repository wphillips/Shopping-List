import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../src/audit/utils';
import {
  checkTsConfig,
  checkAnyTypes,
  checkExportedReturnTypes,
  checkErrorHandling,
  checkMathRandomUuid,
} from '../src/audit/typescript-reviewer';

beforeEach(() => {
  resetCounters();
});

describe('checkTsConfig', () => {
  it('should pass when strict, noUnusedLocals, and noUnusedParameters are all true', () => {
    const tsconfig = JSON.stringify({
      compilerOptions: { strict: true, noUnusedLocals: true, noUnusedParameters: true },
    });
    const findings = checkTsConfig(tsconfig);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('correct');
  });

  it('should flag missing strict mode', () => {
    const tsconfig = JSON.stringify({
      compilerOptions: { noUnusedLocals: true, noUnusedParameters: true },
    });
    const findings = checkTsConfig(tsconfig);
    const strictFinding = findings.find(f => f.title.includes('strict mode'));
    expect(strictFinding).toBeDefined();
    expect(strictFinding!.severity).toBe('High');
    expect(strictFinding!.requirementRef).toBe('Req 4.1');
  });

  it('should flag missing noUnusedLocals', () => {
    const tsconfig = JSON.stringify({
      compilerOptions: { strict: true, noUnusedParameters: true },
    });
    const findings = checkTsConfig(tsconfig);
    const finding = findings.find(f => f.title.includes('noUnusedLocals'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('Medium');
    expect(finding!.requirementRef).toBe('Req 4.2');
  });

  it('should flag missing noUnusedParameters', () => {
    const tsconfig = JSON.stringify({
      compilerOptions: { strict: true, noUnusedLocals: true },
    });
    const findings = checkTsConfig(tsconfig);
    const finding = findings.find(f => f.title.includes('noUnusedParameters'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('Medium');
    expect(finding!.requirementRef).toBe('Req 4.2');
  });

  it('should handle invalid JSON gracefully', () => {
    const findings = checkTsConfig('{ invalid json }}}');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('Unable to parse');
  });

  it('should handle JSONC with comments', () => {
    const tsconfig = `{
      // This is a comment
      "compilerOptions": {
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true
      }
    }`;
    const findings = checkTsConfig(tsconfig);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
  });

  it('should flag all three missing options', () => {
    const tsconfig = JSON.stringify({ compilerOptions: {} });
    const findings = checkTsConfig(tsconfig);
    expect(findings.length).toBe(3);
  });

  it('should handle missing compilerOptions', () => {
    const tsconfig = JSON.stringify({});
    const findings = checkTsConfig(tsconfig);
    expect(findings.length).toBe(3);
  });
});

describe('checkAnyTypes', () => {
  it('should detect `: any` type annotation', () => {
    const content = 'function foo(x: any): void {}';
    const findings = checkAnyTypes('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].category).toBe('TypeScript');
    expect(findings[0].requirementRef).toBe('Req 4.3');
  });

  it('should not flag `: any` in comments', () => {
    const content = '// This is a comment with : any type';
    const findings = checkAnyTypes('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should not flag `: any` in JSDoc comments', () => {
    const content = ' * @param {any} x - some param';
    const findings = checkAnyTypes('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should detect multiple `: any` on different lines', () => {
    const content = 'let a: any;\nlet b: any;\n';
    const findings = checkAnyTypes('src/test.ts', content);
    expect(findings).toHaveLength(2);
  });

  it('should return empty array for file with no any types', () => {
    const content = 'const x: string = "hello";\nconst y: number = 42;\n';
    const findings = checkAnyTypes('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should recommend catch-specific alternative for catch clause context', () => {
    const content = 'catch (e: any) {\n  console.error(e);\n}';
    const findings = checkAnyTypes('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].recommendation).toContain('unknown');
  });

  it('should include file path and line range in finding', () => {
    const content = 'const x = 1;\nlet val: any = null;\n';
    const findings = checkAnyTypes('src/storage.ts', content);
    expect(findings[0].filePaths).toContain('src/storage.ts');
    expect(findings[0].lineRanges).toEqual(['2']);
  });
});

describe('checkExportedReturnTypes', () => {
  it('should flag exported function without return type', () => {
    const content = 'export function doSomething(x: string) {\n  return x;\n}';
    const findings = checkExportedReturnTypes('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('doSomething');
    expect(findings[0].requirementRef).toBe('Req 4.4');
  });

  it('should not flag exported function with return type', () => {
    const content = 'export function doSomething(x: string): string {\n  return x;\n}';
    const findings = checkExportedReturnTypes('src/test.ts', content);
    // The regex matches `(params) {` — with `: string` before `{`, the regex won't match
    expect(findings).toHaveLength(0);
  });

  it('should flag exported async function without return type', () => {
    const content = 'export async function fetchData(url: string) {\n  return fetch(url);\n}';
    const findings = checkExportedReturnTypes('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('fetchData');
  });

  it('should not flag non-exported functions', () => {
    const content = 'function helper(x: string) {\n  return x;\n}';
    const findings = checkExportedReturnTypes('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should flag exported arrow function without return type', () => {
    const content = 'export const process = (data: string) => {\n  return data;\n};';
    const findings = checkExportedReturnTypes('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain('process');
  });

  it('should not flag exported arrow function with return type', () => {
    const content = 'export const process = (data: string): string => {\n  return data;\n};';
    const findings = checkExportedReturnTypes('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });
});

describe('checkErrorHandling', () => {
  it('should flag untyped catch clause', () => {
    const content = 'try {\n  doSomething();\n} catch (e) {\n  console.error(e);\n}';
    const findings = checkErrorHandling('src/test.ts', content);
    const untypedFinding = findings.find(f => f.title.includes('Untyped catch'));
    expect(untypedFinding).toBeDefined();
    expect(untypedFinding!.severity).toBe('Medium');
    expect(untypedFinding!.requirementRef).toBe('Req 4.5');
  });

  it('should not flag catch clause with unknown type', () => {
    const content = 'try {\n  doSomething();\n} catch (e: unknown) {\n  console.error(e);\n}';
    const findings = checkErrorHandling('src/test.ts', content);
    const untypedFinding = findings.find(f => f.title.includes('Untyped catch'));
    expect(untypedFinding).toBeUndefined();
  });

  it('should flag empty catch block as swallowed error', () => {
    const content = 'try {\n  doSomething();\n} catch (e) {\n}';
    const findings = checkErrorHandling('src/test.ts', content);
    const swallowedFinding = findings.find(f => f.title.includes('Swallowed error'));
    expect(swallowedFinding).toBeDefined();
    expect(swallowedFinding!.severity).toBe('High');
  });

  it('should not flag catch block with error handling', () => {
    const content = 'try {\n  doSomething();\n} catch (e: unknown) {\n  console.error(e);\n}';
    const findings = checkErrorHandling('src/test.ts', content);
    const swallowedFinding = findings.find(f => f.title.includes('Swallowed error'));
    expect(swallowedFinding).toBeUndefined();
  });
});

describe('checkMathRandomUuid', () => {
  it('should flag Math.random() in generateId context', () => {
    const content = 'function generateId() {\n  return Math.random().toString(36).substring(2);\n}';
    const findings = checkMathRandomUuid('src/state.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].requirementRef).toBe('Req 4.6');
  });

  it('should flag Math.random() with toString(36) pattern', () => {
    const content = 'const id = Math.random().toString(36).substring(2, 9);';
    const findings = checkMathRandomUuid('src/test.ts', content);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should not flag Math.random() in non-UUID context', () => {
    const content = 'const delay = Math.random() * 1000;';
    const findings = checkMathRandomUuid('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should not flag Math.random() in comments', () => {
    const content = '// Math.random().toString(36).substring(2)';
    const findings = checkMathRandomUuid('src/test.ts', content);
    expect(findings).toHaveLength(0);
  });

  it('should include recommendation for crypto.randomUUID', () => {
    const content = 'function generateId() {\n  return Math.random().toString(36).substring(2);\n}';
    const findings = checkMathRandomUuid('src/state.ts', content);
    expect(findings[0].recommendation).toContain('crypto.randomUUID');
  });
});
