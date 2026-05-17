locals {
  has_https    = var.https_listener_arn != ""
  has_domain   = var.domain_name != ""
  listener_arn = local.has_https ? var.https_listener_arn : var.http_listener_arn
}

resource "aws_ecs_capacity_provider" "ec2" {
  name = "${local.name_prefix}-capacity-provider"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs.arn
    managed_termination_protection = "DISABLED"

    managed_scaling {
      status          = "ENABLED"
      target_capacity = 100
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = [aws_ecs_capacity_provider.ec2.name]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = aws_ecs_capacity_provider.ec2.name
  }
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.project_name}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = toset(concat(["api", "app", "web"], keys(local.workers)))

  name              = "/ecs/${local.name_prefix}/${each.key}"
  retention_in_days = 7

  tags = var.tags
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api-tg"
  port        = var.api_container_port
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    interval            = 30
    path                = "/api/v1"
    matcher             = "200-404"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "app" {
  name        = "${local.name_prefix}-app-tg"
  port        = var.frontend_container_port
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    interval            = 30
    path                = "/"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = var.tags
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web-tg"
  port        = var.frontend_container_port
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    interval            = 30
    path                = "/"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = var.tags
}

# --- Listener Rules (host-based when domain is set, path-based as fallback) ---

resource "aws_lb_listener_rule" "api" {
  listener_arn = local.listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  dynamic "condition" {
    for_each = local.has_domain ? [1] : []
    content {
      host_header {
        values = ["api.${var.domain_name}"]
      }
    }
  }

  dynamic "condition" {
    for_each = local.has_domain ? [] : [1]
    content {
      path_pattern {
        values = ["/api/*"]
      }
    }
  }
}

resource "aws_lb_listener_rule" "app" {
  listener_arn = local.listener_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  dynamic "condition" {
    for_each = local.has_domain ? [1] : []
    content {
      host_header {
        values = ["app.${var.domain_name}"]
      }
    }
  }

  dynamic "condition" {
    for_each = local.has_domain ? [] : [1]
    content {
      path_pattern {
        values = ["/app", "/app/*"]
      }
    }
  }
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = local.listener_arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  dynamic "condition" {
    for_each = local.has_domain ? [1] : []
    content {
      host_header {
        values = [var.domain_name, "www.${var.domain_name}"]
      }
    }
  }

  dynamic "condition" {
    for_each = local.has_domain ? [] : [1]
    content {
      path_pattern {
        values = ["/*"]
      }
    }
  }
}
