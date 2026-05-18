locals {
  name_prefix = "${var.project_name}-${var.environment}"

  api_image = coalesce(var.api_image_uri, "${aws_ecr_repository.api.repository_url}:${var.image_tag}")
  app_image = coalesce(var.app_image_uri, "${aws_ecr_repository.app.repository_url}:${var.image_tag}")
  web_image = coalesce(var.web_image_uri, "${aws_ecr_repository.web.repository_url}:${var.image_tag}")

  shared_environment = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    {
      name  = "APP_PORT"
      value = "3000"
    },
    {
      name  = "APP_PUBLIC_BASE_URL"
      value = "https://api.atende-ai.tech"
    },
    {
      name  = "JWT_ACCESS_EXPIRATION"
      value = "15m"
    },
    {
      name  = "JWT_REFRESH_EXPIRATION"
      value = "7d"
    },
    {
      name  = "DEEPSEEK_BASE_URL"
      value = "https://api.deepseek.com/v1"
    },
    {
      name  = "BUBBLEWHATS_ID"
      value = "7071"
    },
    {
      name  = "BUBBLEWHATS_API_URL"
      value = "https://7071.bubblewhats.com"
    },
    {
      name  = "ASAAS_SANDBOX"
      value = "false"
    },
    {
      name  = "ASAAS_BASE_URL"
      value = "https://www.asaas.com/api/v3"
    },
    {
      name  = "ASAAS_SUCCESS_URL"
      value = "https://atende-ai.tech/payment/success"
    },
    {
      name  = "BREVO_SMTP_LOGIN"
      value = "no-reply@atende-ai.tech"
    },
    {
      name  = "BREVO_SMTP_SENDER_EMAIL"
      value = "no-reply@atende-ai.tech"
    },
    {
      name  = "GOOGLE_PLACES_BASE_URL"
      value = "https://places.googleapis.com/v1"
    },
    {
      name  = "GOOGLE_CALENDAR_OAUTH_REDIRECT_URI"
      value = "https://api.atende-ai.tech/api/v1/scheduling/google-calendar/connection/callback"
    },
    {
      name  = "META_GRAPH_API_VERSION"
      value = "v20.0"
    },
    {
      name  = "META_INSTAGRAM_OAUTH_REDIRECT_URI"
      value = "https://api.atende-ai.tech/api/v1/channels/instagram/meta/callback"
    },
    {
      name  = "META_PAGE_ID"
      value = ""
    },
    {
      name  = "TWILIO_AUTO_PROVISION_TENANTS"
      value = "true"
    },
    {
      name  = "TWILIO_WHATSAPP_WEBHOOK_URL"
      value = "https://api.atende-ai.tech/api/v1/webhooks/whatsapp"
    },
    {
      name  = "TWILIO_WHATSAPP_STATUS_CALLBACK_URL"
      value = "https://api.atende-ai.tech/api/v1/webhooks/whatsapp/status"
    },
    {
      name  = "AWS_REGION"
      value = "us-east-1"
    },
    {
      name  = "AWS_S3_BUCKET"
      value = "atende-ai"
    },
    {
      name  = "PLAN_PRICE_ESSENCIAL"
      value = "297"
    },
    {
      name  = "PLAN_PRICE_PROFISSIONAL"
      value = "597"
    },
    {
      name  = "PLAN_PRICE_ESCALA"
      value = "797"
    },
    {
      name  = "PROMO_DISCOUNT_PERCENT"
      value = var.promo_discount_percent
    },
    {
      name  = "PLAN_MESSAGES_QUOTA_ESSENCIAL"
      value = "5000"
    },
    {
      name  = "PLAN_AI_TOKENS_QUOTA_ESSENCIAL"
      value = "100000"
    },
    {
      name  = "PLAN_CONTACTS_QUOTA_ESSENCIAL"
      value = "250"
    },
    {
      name  = "PLAN_MESSAGES_QUOTA_PROFISSIONAL"
      value = "10000"
    },
    {
      name  = "PLAN_AI_TOKENS_QUOTA_PROFISSIONAL"
      value = "200000"
    },
    {
      name  = "PLAN_CONTACTS_QUOTA_PROFISSIONAL"
      value = "500"
    },
    {
      name  = "PLAN_MESSAGES_QUOTA_ESCALA"
      value = "10000"
    },
    {
      name  = "PLAN_AI_TOKENS_QUOTA_ESCALA"
      value = "1000000"
    },
    {
      name  = "PLAN_CONTACTS_QUOTA_ESCALA"
      value = "1000"
    },
    {
      name  = "TRIAL_WARNING_HOURS"
      value = "165"
    },
    {
      name  = "TRIAL_EXPIRATION_HOURS"
      value = "168"
    },
    {
      name  = "AUTH_THROTTLE_LIMIT"
      value = "12"
    },
    {
      name  = "AUTH_THROTTLE_TTL_SEC"
      value = "900"
    },
    {
      name  = "DEEPSEEK_HTTP_TIMEOUT_MS"
      value = "120000"
    },
    {
      name  = "AI_SAFETY_MODE"
      value = "false"
    },
    {
      name  = "SCHEDULING_REMINDER_TIMEZONE"
      value = "America/Sao_Paulo"
    },
    {
      name  = "SCHEDULING_PENDING_PAYMENT_TIMEOUT_HOURS"
      value = "3"
    },
    {
      name  = "RECOVERY_PLAYBOOKS_ENABLED"
      value = "false"
    },
    {
      name  = "ALERT_REMINDER_DEFAULT_TIMEZONE"
      value = "America/Sao_Paulo"
    },
    {
      name  = "ALERT_MAX_ACTIVE_REMINDERS_PER_USER"
      value = "0"
    },
    {
      name  = "ALERT_ANTI_SPAM_ROLLING_HOURS"
      value = "24"
    },
    {
      name  = "ALERT_MAX_DISPATCHES_PER_RECIPIENT_ROLLING"
      value = "0"
    },
    {
      name  = "ALERT_IDEMPOTENCY_RECENT_SECONDS"
      value = "90"
    },
  ]

  api_secrets = [
    {
      name      = "PRISMA_DATABASE_URL"
      valueFrom = "${var.ssm_parameter_prefix}/PRISMA_DATABASE_URL"
    },
    {
      name      = "REDIS_HOST"
      valueFrom = "${var.ssm_parameter_prefix}/REDIS_HOST"
    },
    {
      name      = "REDIS_PORT"
      valueFrom = "${var.ssm_parameter_prefix}/REDIS_PORT"
    },
    {
      name      = "JWT_ACCESS_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/JWT_ACCESS_SECRET"
    },
    {
      name      = "JWT_REFRESH_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/JWT_REFRESH_SECRET"
    },
    {
      name      = "PLATFORM_ADMIN_API_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/PLATFORM_ADMIN_API_KEY"
    },
    {
      name      = "DEEPSEEK_API_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/DEEPSEEK_API_KEY"
    },
    {
      name      = "OPENAI_API_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/OPENAI_API_KEY"
    },
    {
      name      = "BUBBLEWHATS_TOKEN"
      valueFrom = "${var.ssm_parameter_prefix}/BUBBLEWHATS_TOKEN"
    },
    {
      name      = "ASAAS_API_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/ASAAS_API_KEY"
    },
    {
      name      = "BREVO_SMTP_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/BREVO_SMTP_KEY"
    },
    {
      name      = "GOOGLE_PLACES_API_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/GOOGLE_PLACES_API_KEY"
    },
    {
      name      = "GOOGLE_CALENDAR_CLIENT_ID"
      valueFrom = "${var.ssm_parameter_prefix}/GOOGLE_CALENDAR_CLIENT_ID"
    },
    {
      name      = "GOOGLE_CALENDAR_CLIENT_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/GOOGLE_CALENDAR_CLIENT_SECRET"
    },
    {
      name      = "GOOGLE_CALENDAR_STATE_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/GOOGLE_CALENDAR_STATE_SECRET"
    },
    {
      name      = "META_APP_ID"
      valueFrom = "${var.ssm_parameter_prefix}/META_APP_ID"
    },
    {
      name      = "META_APP_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/META_APP_SECRET"
    },
    {
      name      = "META_INSTAGRAM_STATE_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/META_INSTAGRAM_STATE_SECRET"
    },
    {
      name      = "META_ACCESS_TOKEN"
      valueFrom = "${var.ssm_parameter_prefix}/META_ACCESS_TOKEN"
    },
    {
      name      = "META_WEBHOOK_VERIFY_TOKEN"
      valueFrom = "${var.ssm_parameter_prefix}/META_WEBHOOK_VERIFY_TOKEN"
    },
    {
      name      = "META_WEBHOOK_SECRET"
      valueFrom = "${var.ssm_parameter_prefix}/META_WEBHOOK_SECRET"
    },
    {
      name      = "TWILIO_ACCOUNT_SID"
      valueFrom = "${var.ssm_parameter_prefix}/TWILIO_ACCOUNT_SID"
    },
    {
      name      = "TWILIO_AUTH_TOKEN"
      valueFrom = "${var.ssm_parameter_prefix}/TWILIO_AUTH_TOKEN"
    },
    {
      name      = "AWS_ACCESS_KEY_ID"
      valueFrom = "${var.ssm_parameter_prefix}/AWS_ACCESS_KEY_ID"
    },
    {
      name      = "AWS_SECRET_ACCESS_KEY"
      valueFrom = "${var.ssm_parameter_prefix}/AWS_SECRET_ACCESS_KEY"
    },
  ]

  workers = {
    messaging = {
      command = ["node", "dist/messaging-worker"]
      cpu     = 256
      memory  = 384
    }
    prospect_search = {
      command = ["node", "dist/prospect-search-worker"]
      cpu     = 256
      memory  = 384
    }
    alerts = {
      command = ["node", "dist/alerts-worker"]
      cpu     = 128
      memory  = 256
    }
    scheduling = {
      command = ["node", "dist/scheduling-worker"]
      cpu     = 128
      memory  = 256
    }
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-cluster"
    }
  )
}

data "aws_ssm_parameter" "ecs_optimized_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id"
}

resource "aws_launch_template" "ecs" {
  name_prefix   = "${local.name_prefix}-ecs-lt-"
  image_id      = data.aws_ssm_parameter.ecs_optimized_ami.value
  instance_type = var.ec2_instance_type

  iam_instance_profile {
    name = var.instance_profile_name
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [var.security_group_id]
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo ECS_CLUSTER=${aws_ecs_cluster.main.name} >> /etc/ecs/ecs.config
  EOF
  )

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-ecs-lt"
    }
  )
}

resource "aws_autoscaling_group" "ecs" {
  name                = "${local.name_prefix}-ecs-asg"
  vpc_zone_identifier = var.public_subnets
  desired_capacity    = var.asg_desired_capacity
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size
  capacity_rebalance  = var.use_spot_instances

  dynamic "mixed_instances_policy" {
    for_each = var.use_spot_instances ? [1] : []
    content {
      instances_distribution {
        on_demand_base_capacity                  = var.on_demand_base_capacity
        on_demand_percentage_above_base_capacity = 0
        spot_allocation_strategy                 = var.spot_allocation_strategy
      }

      launch_template {
        launch_template_specification {
          launch_template_id = aws_launch_template.ecs.id
          version            = "$Latest"
        }

        dynamic "override" {
          for_each = var.spot_instance_types
          content {
            instance_type = override.value
          }
        }
      }
    }
  }

  dynamic "launch_template" {
    for_each = var.use_spot_instances ? [] : [1]
    content {
      id      = aws_launch_template.ecs.id
      version = "$Latest"
    }
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = true
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = var.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}
