import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../src/audit/utils';
import {
  checkTerraformBackend,
  checkGitignoreEntries,
  checkResourceTagging,
  checkProviderVersionPinning,
  checkHardcodedSecrets,
} from '../src/audit/infra-reviewer';

beforeEach(() => {
  resetCounters();
});

describe('checkTerraformBackend', () => {
  it('should flag when remote backend is commented out', () => {
    const content = `
# terraform {
#   backend "s3" {
#     bucket = "my-state-bucket"
#   }
# }
`;
    const findings = checkTerraformBackend(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('commented out');
    expect(findings[0].requirementRef).toBe('Req 7.1');
  });

  it('should pass when remote backend is active', () => {
    const content = `
terraform {
  backend "s3" {
    bucket = "my-state-bucket"
    key    = "terraform.tfstate"
    region = "us-west-2"
  }
}
`;
    const findings = checkTerraformBackend(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('remote state backend');
  });

  it('should flag when no backend config exists at all', () => {
    const content = `# Just a comment, no backend block`;
    const findings = checkTerraformBackend(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('No Terraform backend configuration found');
  });
});

describe('checkGitignoreEntries', () => {
  it('should pass when both *.tfvars and *.tfstate patterns exist', () => {
    const content = `node_modules/\n*.tfvars\n*.tfstate\n*.tfstate.*`;
    const findings = checkGitignoreEntries(content);
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].requirementRef).toBe('Req 7.2');
    expect(findings[1].severity).toBe('Low');
    expect(findings[1].requirementRef).toBe('Req 7.6');
  });

  it('should flag when tfvars pattern is missing', () => {
    const content = `node_modules/\n*.tfstate`;
    const findings = checkGitignoreEntries(content);
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('High');
    expect(findings[0].title).toContain('terraform.tfvars is not excluded');
    expect(findings[1].severity).toBe('Low');
  });

  it('should flag when tfstate pattern is missing', () => {
    const content = `node_modules/\n*.tfvars`;
    const findings = checkGitignoreEntries(content);
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('Low');
    expect(findings[1].severity).toBe('Critical');
    expect(findings[1].title).toContain('terraform.tfstate files are not excluded');
  });

  it('should flag both when gitignore has no terraform patterns', () => {
    const content = `node_modules/\ndist/`;
    const findings = checkGitignoreEntries(content);
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('High');
    expect(findings[1].severity).toBe('Critical');
  });
});

describe('checkResourceTagging', () => {
  it('should pass for resources with both Name and Environment tags', () => {
    const content = `
resource "aws_s3_bucket" "website" {
  bucket = "my-bucket"
  tags = {
    Name        = "my-bucket"
    Environment = "production"
  }
}
`;
    const findings = checkResourceTagging(content, 'infra/s3.tf');
    expect(findings).toHaveLength(0);
  });

  it('should flag resource missing tags block entirely', () => {
    const content = `
resource "aws_s3_bucket" "website" {
  bucket = "my-bucket"
}
`;
    const findings = checkResourceTagging(content, 'infra/s3.tf');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('missing tags');
  });

  it('should flag resource missing Name tag', () => {
    const content = `
resource "aws_s3_bucket" "website" {
  bucket = "my-bucket"
  tags = {
    Environment = "production"
  }
}
`;
    const findings = checkResourceTagging(content, 'infra/s3.tf');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('Name');
  });

  it('should flag resource missing Environment tag', () => {
    const content = `
resource "aws_s3_bucket" "website" {
  bucket = "my-bucket"
  tags = {
    Name = "my-bucket"
  }
}
`;
    const findings = checkResourceTagging(content, 'infra/s3.tf');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('Environment');
  });

  it('should skip resources that do not support tags', () => {
    const content = `
resource "aws_s3_bucket_versioning" "website" {
  bucket = "my-bucket"
  versioning_configuration {
    status = "Enabled"
  }
}
`;
    const findings = checkResourceTagging(content, 'infra/s3.tf');
    expect(findings).toHaveLength(0);
  });
});

describe('checkProviderVersionPinning', () => {
  it('should flag providers using >= instead of ~>', () => {
    const content = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}
`;
    const findings = checkProviderVersionPinning(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Medium');
    expect(findings[0].title).toContain('open-ended version constraint');
    expect(findings[0].requirementRef).toBe('Req 7.4');
  });

  it('should pass when providers use ~> pinning', () => {
    const content = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
`;
    const findings = checkProviderVersionPinning(content);
    expect(findings).toHaveLength(0);
  });

  it('should flag multiple providers with open-ended constraints', () => {
    const content = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}
`;
    const findings = checkProviderVersionPinning(content);
    expect(findings).toHaveLength(2);
    expect(findings[0].title).toContain('aws');
    expect(findings[1].title).toContain('random');
  });

  it('should flag when no version constraints are found', () => {
    const content = `# Empty providers file`;
    const findings = checkProviderVersionPinning(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('No provider version constraints found');
  });

  it('should flag exact version pinning with Low severity', () => {
    const content = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.0.0"
    }
  }
}
`;
    const findings = checkProviderVersionPinning(content);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('Low');
    expect(findings[0].title).toContain('exact version pinning');
  });
});

describe('checkHardcodedSecrets', () => {
  it('should flag hardcoded access_key values', () => {
    const content = `access_key = "AKIAIOSFODNN7EXAMPLE"`;
    const findings = checkHardcodedSecrets(content, 'infra/main.tf');
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Critical');
    expect(findings[0].requirementRef).toBe('Req 7.5');
  });

  it('should flag AWS access key ID patterns', () => {
    const content = `key = "AKIAIOSFODNN7EXAMPLE"`;
    const findings = checkHardcodedSecrets(content, 'infra/main.tf');
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('Critical');
  });

  it('should not flag variable references', () => {
    const content = `access_key = var.aws_access_key`;
    const findings = checkHardcodedSecrets(content, 'infra/main.tf');
    expect(findings).toHaveLength(0);
  });

  it('should not flag comment lines', () => {
    const content = `# access_key = "AKIAIOSFODNN7EXAMPLE"`;
    const findings = checkHardcodedSecrets(content, 'infra/main.tf');
    expect(findings).toHaveLength(0);
  });

  it('should return no findings for clean terraform files', () => {
    const content = `
resource "aws_s3_bucket" "website" {
  bucket = var.bucket_name
  tags = {
    Name        = var.name
    Environment = var.environment
  }
}
`;
    const findings = checkHardcodedSecrets(content, 'infra/s3.tf');
    expect(findings).toHaveLength(0);
  });
});
