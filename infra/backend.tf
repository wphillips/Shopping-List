# Remote Backend Configuration
#
# This configures Terraform to store state in an S3 bucket with DynamoDB
# state locking. The backend S3 bucket and DynamoDB table must be
# pre-created before running `terraform init` with this backend enabled.
#
# To use this backend:
#   1. Create an S3 bucket for state storage (with versioning and encryption enabled)
#   2. Create a DynamoDB table for state locking (partition key: "LockID", type: String)
#   3. Uncomment the block below and replace placeholder values
#   4. Run `terraform init` to migrate state to the remote backend
#
# terraform {
#   backend "s3" {
#     bucket         = "<state-bucket-name>"
#     key            = "grocery-pwa/terraform.tfstate"
#     region         = "us-west-2"
#     encrypt        = true
#     dynamodb_table = "<lock-table-name>"
#   }
# }
