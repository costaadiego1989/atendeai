terraform {
  backend "s3" {
    bucket         = "atendeai-terraform-state"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "atendeai-terraform-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}
