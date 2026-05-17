locals {
  name_prefix = "/${var.project_name}/${var.environment}"

  # Prisma URL format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
  prisma_url = "postgresql://${var.db_username}:${var.db_password}@${var.db_endpoint}:${var.db_port}/${var.db_name}?schema=public"
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
  value       = var.redis_host

  tags = var.tags
}

resource "aws_ssm_parameter" "redis_port" {
  name        = "${local.name_prefix}/REDIS_PORT"
  description = "Redis port"
  type        = "String"
  value       = tostring(var.redis_port)

  tags = var.tags
}

# Placeholder for manual secrets that Terraform shouldn't manage values for
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

# ============================================================
# Application Secrets (set values manually in AWS Console)
# ============================================================

# --- AI / DeepSeek / OpenAI ---
resource "aws_ssm_parameter" "deepseek_api_key" {
  name        = "${local.name_prefix}/DEEPSEEK_API_KEY"
  description = "DeepSeek API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "openai_api_key" {
  name        = "${local.name_prefix}/OPENAI_API_KEY"
  description = "OpenAI API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- BubbleWhats ---
resource "aws_ssm_parameter" "bubblewhats_token" {
  name        = "${local.name_prefix}/BUBBLEWHATS_TOKEN"
  description = "BubbleWhats API Token"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- Asaas Payment ---
resource "aws_ssm_parameter" "asaas_api_key" {
  name        = "${local.name_prefix}/ASAAS_API_KEY"
  description = "Asaas Production API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- Brevo SMTP ---
resource "aws_ssm_parameter" "brevo_smtp_key" {
  name        = "${local.name_prefix}/BREVO_SMTP_KEY"
  description = "Brevo SMTP Key"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- Google Places ---
resource "aws_ssm_parameter" "google_places_api_key" {
  name        = "${local.name_prefix}/GOOGLE_PLACES_API_KEY"
  description = "Google Places API Key"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- Google Calendar ---
resource "aws_ssm_parameter" "google_calendar_client_id" {
  name        = "${local.name_prefix}/GOOGLE_CALENDAR_CLIENT_ID"
  description = "Google Calendar OAuth Client ID"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "google_calendar_client_secret" {
  name        = "${local.name_prefix}/GOOGLE_CALENDAR_CLIENT_SECRET"
  description = "Google Calendar OAuth Client Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "google_calendar_state_secret" {
  name        = "${local.name_prefix}/GOOGLE_CALENDAR_STATE_SECRET"
  description = "Google Calendar OAuth State HMAC Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- Meta / Instagram ---
resource "aws_ssm_parameter" "meta_app_id" {
  name        = "${local.name_prefix}/META_APP_ID"
  description = "Meta App ID"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "meta_app_secret" {
  name        = "${local.name_prefix}/META_APP_SECRET"
  description = "Meta App Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "meta_instagram_state_secret" {
  name        = "${local.name_prefix}/META_INSTAGRAM_STATE_SECRET"
  description = "Meta Instagram OAuth State Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "meta_access_token" {
  name        = "${local.name_prefix}/META_ACCESS_TOKEN"
  description = "Meta Page Access Token"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "meta_webhook_verify_token" {
  name        = "${local.name_prefix}/META_WEBHOOK_VERIFY_TOKEN"
  description = "Meta Webhook Verify Token"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "meta_webhook_secret" {
  name        = "${local.name_prefix}/META_WEBHOOK_SECRET"
  description = "Meta Webhook Signature Secret"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- Twilio ---
resource "aws_ssm_parameter" "twilio_account_sid" {
  name        = "${local.name_prefix}/TWILIO_ACCOUNT_SID"
  description = "Twilio Account SID"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "twilio_auth_token" {
  name        = "${local.name_prefix}/TWILIO_AUTH_TOKEN"
  description = "Twilio Auth Token"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

# --- AWS S3 (for media/uploads) ---
resource "aws_ssm_parameter" "aws_s3_access_key_id" {
  name        = "${local.name_prefix}/AWS_ACCESS_KEY_ID"
  description = "AWS Access Key for S3"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}

resource "aws_ssm_parameter" "aws_s3_secret_access_key" {
  name        = "${local.name_prefix}/AWS_SECRET_ACCESS_KEY"
  description = "AWS Secret Key for S3"
  type        = "SecureString"
  value       = "CHANGE_ME_MANUALLY"
  lifecycle { ignore_changes = [value] }
  tags = var.tags
}
