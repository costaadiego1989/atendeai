locals {
  name_prefix = "/${var.project_name}/${var.environment}"

  # Prisma URL format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
  prisma_url = "postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}:${var.db_port}/${var.db_name}?schema=public"

  # RabbitMQ URL format: amqps://USER:PASSWORD@HOST:PORT
  # The endpoint from AWS MQ often includes the protocol. We strip it if needed, or just construct it.
  # For simplicity, assuming amqps:// prefix is standard for AWS MQ
  rabbitmq_url = replace(var.mq_endpoint, "amqps://", "amqps://${var.mq_username}:${var.mq_password}@")
}

resource "aws_ssm_parameter" "prisma_database_url" {
  name        = "${local.name_prefix}/PRISMA_DATABASE_URL"
  description = "Database connection string for Prisma"
  type        = "SecureString"
  value       = local.prisma_url

  tags = var.tags
}

resource "aws_ssm_parameter" "redis_host" {
  name        = "${local.name_prefix}/REDIS_HOST"
  description = "Redis host address"
  type        = "String"
  value       = var.redis_endpoint

  tags = var.tags
}

resource "aws_ssm_parameter" "redis_port" {
  name        = "${local.name_prefix}/REDIS_PORT"
  description = "Redis port"
  type        = "String"
  value       = tostring(var.redis_port)

  tags = var.tags
}

resource "aws_ssm_parameter" "rabbitmq_url" {
  name        = "${local.name_prefix}/RABBITMQ_URL"
  description = "RabbitMQ connection string"
  type        = "SecureString"
  value       = local.rabbitmq_url

  tags = var.tags
}

# Placeholder for manual secrets that Terraform shouldn't manage values for, but creates the parameter
resource "aws_ssm_parameter" "jwt_access_secret" {
  name        = "${local.name_prefix}/JWT_ACCESS_SECRET"
  description = "JWT Access Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"

  lifecycle {
    ignore_changes = [value]
  }

  tags = var.tags
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name        = "${local.name_prefix}/JWT_REFRESH_SECRET"
  description = "JWT Refresh Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"

  lifecycle {
    ignore_changes = [value]
  }

  tags = var.tags
}

resource "aws_ssm_parameter" "platform_admin_api_key" {
  name        = "${local.name_prefix}/PLATFORM_ADMIN_API_KEY"
  description = "Platform Admin API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"

  lifecycle {
    ignore_changes = [value]
  }

  tags = var.tags
}
