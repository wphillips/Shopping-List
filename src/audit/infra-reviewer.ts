import { readFile, readdir } from 'fs/promises';
import { resolve, join } from 'path';
import type { Finding } from './types';
import { createFinding } from './utils';

/** Patterns that indicate hardcoded secrets or credentials in Terraform files. */
const SECRET_PATTERNS = [
  /(?:access_key|secret_key|password|secret)\s*=\s*"(?!var\.|local\.|data\.|module\.)[^"]{8,}"/i,
  /AKIA[0-9A-Z]{16}/,                          // AWS access key ID
  /(?:[A-Za-z0-9/+=]{40})/,                     // Potential AWS secret key (40-char base64)
  /(?:api[_-]?key|token)\s*=\s*"(?!var\.|local\.|data\.|module\.)[^"]{8,}"/i,
];

/**
 * Check Terraform backend configuration for remote vs local state.
 * Pure function — operates on the backend.tf content string.
 */
export function checkTerraformBackend(backendContent: string): Finding[] {
  const findings: Finding[] = [];

  // Check if there's an active (uncommented) backend block
  const hasActiveBackend = /^\s*backend\s+"(s3|gcs|azurerm|consul|remote|http)"/m.test(backendContent);
  const hasCommentedBackend = /^#\s*.*backend\s+"(s3|gcs|azurerm|consul|remote|http)"/m.test(backendContent);

  if (hasActiveBackend) {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'Terraform uses remote state backend',
        description:
          'Terraform is configured with a remote state backend, which is the recommended approach for team collaboration and state safety.',
        filePaths: ['infra/backend.tf'],
        recommendation: 'No action needed. Remote state backend is correctly configured.',
        requirementRef: 'Req 7.1',
      })
    );
  } else if (hasCommentedBackend) {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'High',
        title: 'Terraform remote backend is commented out — using local state',
        description:
          'The remote backend configuration in infra/backend.tf is commented out. Terraform is using local state, ' +
          'which risks state loss, prevents team collaboration, and may lead to state file being committed to version control.',
        filePaths: ['infra/backend.tf'],
        recommendation:
          'Uncomment and configure the remote backend (e.g., S3 + DynamoDB) for state storage and locking. ' +
          'Create the required backend resources first, then run `terraform init` to migrate state.',
        requirementRef: 'Req 7.1',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'High',
        title: 'No Terraform backend configuration found — using local state',
        description:
          'No backend block found in infra/backend.tf. Terraform defaults to local state storage, ' +
          'which is not recommended for production environments.',
        filePaths: ['infra/backend.tf'],
        recommendation:
          'Add a remote backend configuration (e.g., S3 with DynamoDB locking) to store state securely and enable team collaboration.',
        requirementRef: 'Req 7.1',
      })
    );
  }

  return findings;
}

/**
 * Check .gitignore content for terraform.tfvars and terraform.tfstate entries.
 * Pure function — operates on the .gitignore content string.
 */
export function checkGitignoreEntries(gitignoreContent: string): Finding[] {
  const findings: Finding[] = [];
  const lines = gitignoreContent.split('\n').map(l => l.trim());

  // Check for tfvars exclusion
  const hasTfvarsPattern = lines.some(
    l => l === '*.tfvars' || l === 'terraform.tfvars' || l === 'infra/terraform.tfvars' || l === 'infra/*.tfvars'
  );

  if (hasTfvarsPattern) {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'terraform.tfvars is excluded from version control',
        description:
          'The .gitignore file contains a pattern that excludes terraform.tfvars, preventing sensitive variable values from being committed.',
        filePaths: ['.gitignore'],
        recommendation: 'No action needed. Sensitive variable files are properly excluded.',
        requirementRef: 'Req 7.2',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'High',
        title: 'terraform.tfvars is not excluded from version control',
        description:
          'No .gitignore pattern found to exclude terraform.tfvars. Sensitive variable values (e.g., secrets, API keys) may be committed to the repository.',
        filePaths: ['.gitignore'],
        recommendation:
          'Add "*.tfvars" or "terraform.tfvars" to .gitignore to prevent sensitive variable files from being committed.',
        requirementRef: 'Req 7.2',
      })
    );
  }

  // Check for tfstate exclusion
  const hasTfstatePattern = lines.some(
    l => l === '*.tfstate' || l === '*.tfstate.*' || l === 'terraform.tfstate' || l === 'infra/terraform.tfstate'
  );

  if (hasTfstatePattern) {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'terraform.tfstate files are excluded from version control',
        description:
          'The .gitignore file contains a pattern that excludes Terraform state files, preventing sensitive state data from being committed.',
        filePaths: ['.gitignore'],
        recommendation: 'No action needed. State files are properly excluded.',
        requirementRef: 'Req 7.6',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Critical',
        title: 'terraform.tfstate files are not excluded from version control',
        description:
          'No .gitignore pattern found to exclude Terraform state files. State files contain sensitive information including resource IDs, ' +
          'IP addresses, and potentially secrets.',
        filePaths: ['.gitignore'],
        recommendation:
          'Add "*.tfstate" and "*.tfstate.*" to .gitignore to prevent state files from being committed to version control.',
        requirementRef: 'Req 7.6',
      })
    );
  }

  return findings;
}

/**
 * Check Terraform resource blocks for consistent Name and Environment tags.
 * Pure function — operates on a single .tf file content string.
 */
export function checkResourceTagging(tfContent: string, fileName: string): Finding[] {
  const findings: Finding[] = [];

  // Match resource blocks: resource "type" "name" { ... }
  // We look for resource blocks that support tags (aws_* resources generally do)
  const resourceRegex = /resource\s+"(aws_\w+)"\s+"(\w+)"\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = resourceRegex.exec(tfContent)) !== null) {
    const resourceType = match[1];
    const resourceName = match[2];
    const startIndex = match.index;

    // Find the matching closing brace for this resource block
    let braceCount = 0;
    let blockEnd = startIndex;
    let foundOpen = false;
    for (let i = startIndex; i < tfContent.length; i++) {
      if (tfContent[i] === '{') {
        braceCount++;
        foundOpen = true;
      } else if (tfContent[i] === '}') {
        braceCount--;
      }
      if (foundOpen && braceCount === 0) {
        blockEnd = i;
        break;
      }
    }

    const resourceBlock = tfContent.substring(startIndex, blockEnd + 1);

    // Skip resources that typically don't support tags
    const noTagResources = [
      'aws_s3_bucket_versioning',
      'aws_s3_bucket_server_side_encryption_configuration',
      'aws_s3_bucket_public_access_block',
      'aws_s3_bucket_lifecycle_configuration',
      'aws_s3_bucket_policy',
      'aws_cloudfront_origin_access_control',
    ];
    if (noTagResources.includes(resourceType)) {
      continue;
    }

    // Check if the resource block has a tags block
    const hasTagsBlock = /\btags\s*=\s*\{/.test(resourceBlock);

    if (!hasTagsBlock) {
      findings.push(
        createFinding({
          category: 'Infrastructure',
          severity: 'Medium',
          title: `Resource ${resourceType}.${resourceName} is missing tags`,
          description:
            `The resource ${resourceType}.${resourceName} in ${fileName} does not have a tags block. ` +
            'Consistent tagging is important for cost tracking, resource organization, and compliance.',
          filePaths: [fileName],
          recommendation:
            `Add a tags block with at least Name and Environment tags to ${resourceType}.${resourceName}.`,
          requirementRef: 'Req 7.3',
        })
      );
      continue;
    }

    // Check for Name tag
    const hasNameTag = /\bName\s*=/.test(resourceBlock);
    // Check for Environment tag
    const hasEnvTag = /\bEnvironment\s*=/.test(resourceBlock);

    const missingTags: string[] = [];
    if (!hasNameTag) missingTags.push('Name');
    if (!hasEnvTag) missingTags.push('Environment');

    if (missingTags.length > 0) {
      findings.push(
        createFinding({
          category: 'Infrastructure',
          severity: 'Medium',
          title: `Resource ${resourceType}.${resourceName} is missing required tags: ${missingTags.join(', ')}`,
          description:
            `The resource ${resourceType}.${resourceName} in ${fileName} is missing the following required tags: ${missingTags.join(', ')}. ` +
            'All taggable resources should have consistent Name and Environment tags.',
          filePaths: [fileName],
          recommendation:
            `Add the missing tags (${missingTags.join(', ')}) to ${resourceType}.${resourceName}.`,
          requirementRef: 'Req 7.3',
        })
      );
    }
  }

  return findings;
}

/**
 * Check provider version constraints for pessimistic pinning (~>).
 * Pure function — operates on the providers.tf content string.
 */
export function checkProviderVersionPinning(providersContent: string): Finding[] {
  const findings: Finding[] = [];

  // Match version constraints in required_providers blocks
  const versionRegex = /(\w+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  let foundAny = false;

  while ((match = versionRegex.exec(providersContent)) !== null) {
    foundAny = true;
    const providerName = match[1];
    const versionConstraint = match[2];

    if (versionConstraint.startsWith('~>')) {
      // Pessimistic pinning — good
      continue;
    }

    if (versionConstraint.startsWith('>=')) {
      findings.push(
        createFinding({
          category: 'Infrastructure',
          severity: 'Medium',
          title: `Provider "${providerName}" uses open-ended version constraint: "${versionConstraint}"`,
          description:
            `The provider "${providerName}" uses version constraint "${versionConstraint}" which allows any future major version. ` +
            'This can lead to unexpected breaking changes when providers release new major versions.',
          filePaths: ['infra/providers.tf'],
          recommendation:
            `Change the version constraint to use pessimistic pinning, e.g., "~> ${versionConstraint.replace('>= ', '')}" ` +
            'to allow minor/patch updates while preventing major version jumps.',
          requirementRef: 'Req 7.4',
        })
      );
    } else if (versionConstraint.startsWith('=')) {
      findings.push(
        createFinding({
          category: 'Infrastructure',
          severity: 'Low',
          title: `Provider "${providerName}" uses exact version pinning: "${versionConstraint}"`,
          description:
            `The provider "${providerName}" is pinned to an exact version. While safe, this prevents automatic minor/patch updates.`,
          filePaths: ['infra/providers.tf'],
          recommendation:
            `Consider using pessimistic pinning "~>" to allow compatible updates while preventing breaking changes.`,
          requirementRef: 'Req 7.4',
        })
      );
    }
  }

  if (!foundAny) {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Medium',
        title: 'No provider version constraints found',
        description:
          'No version constraints were found in the providers configuration. Without version constraints, ' +
          'Terraform may download any version of a provider, leading to unpredictable behavior.',
        filePaths: ['infra/providers.tf'],
        recommendation:
          'Add version constraints using pessimistic pinning (~>) for all providers in the required_providers block.',
        requirementRef: 'Req 7.4',
      })
    );
  }

  return findings;
}

/**
 * Check a Terraform file for hardcoded secrets or credentials.
 * Pure function — operates on a single .tf file content string.
 */
export function checkHardcodedSecrets(tfContent: string, fileName: string): Finding[] {
  const findings: Finding[] = [];
  const lines = tfContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment lines
    if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
      continue;
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push(
          createFinding({
            category: 'Infrastructure',
            severity: 'Critical',
            title: `Potential hardcoded secret in ${fileName}`,
            description:
              `Line ${i + 1}: A pattern matching a hardcoded secret or credential was detected. ` +
              'Hardcoded secrets in infrastructure code are a critical security risk.',
            filePaths: [fileName],
            lineRanges: [`${i + 1}`],
            recommendation:
              'Remove hardcoded secrets and use Terraform variables with sensitive = true, ' +
              'environment variables, or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault).',
            requirementRef: 'Req 7.5',
          })
        );
        break; // One finding per line is enough
      }
    }
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

/**
 * Find all .tf files in the infra/ directory.
 */
async function findTfFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.tf')) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}

/**
 * Main entry point: run all infrastructure checks and return findings.
 * Checks backend config, .gitignore entries, resource tagging,
 * provider version pinning, and hardcoded secrets.
 */
export async function reviewInfrastructure(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Check Terraform backend configuration (Req 7.1)
  const backendContent = await safeReadFile(resolve('infra/backend.tf'));
  if (backendContent) {
    findings.push(...checkTerraformBackend(backendContent));
  } else {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'Unable to read Terraform backend configuration',
        description: 'Could not read infra/backend.tf. Backend configuration check was skipped.',
        filePaths: ['infra/backend.tf'],
        recommendation: 'Verify that infra/backend.tf exists and is readable.',
        requirementRef: 'Req 7.1',
      })
    );
  }

  // 2. Check .gitignore for tfvars and tfstate (Req 7.2, 7.6)
  const gitignoreContent = await safeReadFile(resolve('.gitignore'));
  if (gitignoreContent) {
    findings.push(...checkGitignoreEntries(gitignoreContent));
  } else {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'Unable to read .gitignore',
        description: 'Could not read .gitignore. Gitignore entry checks were skipped.',
        filePaths: ['.gitignore'],
        recommendation: 'Verify that .gitignore exists and is readable.',
        requirementRef: 'Req 7.2',
      })
    );
  }

  // 3. Check provider version pinning (Req 7.4)
  const providersContent = await safeReadFile(resolve('infra/providers.tf'));
  if (providersContent) {
    findings.push(...checkProviderVersionPinning(providersContent));
  } else {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'Unable to read Terraform providers configuration',
        description: 'Could not read infra/providers.tf. Provider version pinning check was skipped.',
        filePaths: ['infra/providers.tf'],
        recommendation: 'Verify that infra/providers.tf exists and is readable.',
        requirementRef: 'Req 7.4',
      })
    );
  }

  // 4. Check resource tagging and hardcoded secrets across all .tf files (Req 7.3, 7.5)
  try {
    const tfFiles = await findTfFiles('infra');
    for (const filePath of tfFiles) {
      const content = await safeReadFile(filePath);
      if (content) {
        findings.push(...checkResourceTagging(content, filePath));
        findings.push(...checkHardcodedSecrets(content, filePath));
      }
    }
  } catch {
    findings.push(
      createFinding({
        category: 'Infrastructure',
        severity: 'Low',
        title: 'Unable to scan Terraform files',
        description: 'Failed to read Terraform files under infra/. Resource tagging and secrets checks were skipped.',
        filePaths: ['infra/'],
        recommendation: 'Verify that the infra/ directory exists and is readable, then re-run the audit.',
        requirementRef: 'Req 7.3',
      })
    );
  }

  return findings;
}
