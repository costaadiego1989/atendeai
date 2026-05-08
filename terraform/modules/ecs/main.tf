locals {
  name_prefix = "${var.project_name}-${var.environment}"

  api_image = coalesce(var.api_image_uri, "${aws_ecr_repository.api.repository_url}:${var.image_tag}")
  app_image = coalesce(var.app_image_uri, "${aws_ecr_repository.app.repository_url}:${var.image_tag}")
  web_image = coalesce(var.web_image_uri, "${aws_ecr_repository.web.repository_url}:${var.image_tag}")

  shared_environment = [
    {
      name  = "NODE_ENV"
      value = "production"
    }
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
      name      = "RABBITMQ_URL"
      valueFrom = "${var.ssm_parameter_prefix}/RABBITMQ_URL"
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
    }
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
    value = "enabled"
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
    security_groups = [var.security_group_id]
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
  vpc_zone_identifier = var.private_subnets
  desired_capacity    = var.asg_desired_capacity
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
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
  retention_in_days = 30

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

resource "aws_lb_listener_rule" "api" {
  listener_arn = var.http_listener_arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

resource "aws_lb_listener_rule" "app" {
  listener_arn = var.http_listener_arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/app", "/app/*"]
    }
  }
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = var.http_listener_arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = 512
  memory                   = 768
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.api_image
      essential = true
      command   = ["node", "dist/main"]
      portMappings = [
        {
          containerPort = var.api_container_port
          hostPort      = 0
          protocol      = "tcp"
        }
      ]
      environment = local.shared_environment
      secrets     = local.api_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service["api"].name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_task_definition" "worker" {
  for_each = local.workers

  family                   = "${local.name_prefix}-${replace(each.key, "_", "-")}"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name        = replace(each.key, "_", "-")
      image       = local.api_image
      essential   = true
      command     = each.value.command
      environment = local.shared_environment
      secrets     = local.api_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = replace(each.key, "_", "-")
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_task_definition" "frontend" {
  for_each = {
    app = {
      image = local.app_image
      port  = var.frontend_container_port
    }
    web = {
      image = local.web_image
      port  = var.frontend_container_port
    }
  }

  family                   = "${local.name_prefix}-${each.key}"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = 128
  memory                   = 128
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = each.value.image
      essential = true
      portMappings = [
        {
          containerPort = each.value.port
          hostPort      = 0
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service[each.key].name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = each.key
        }
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    weight            = 100
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.api_container_port
  }

  depends_on = [aws_lb_listener_rule.api]

  tags = var.tags
}

resource "aws_ecs_service" "worker" {
  for_each = local.workers

  name            = "${local.name_prefix}-${replace(each.key, "_", "-")}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker[each.key].arn
  desired_count   = var.worker_desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    weight            = 100
  }

  tags = var.tags
}

resource "aws_ecs_service" "frontend" {
  for_each = {
    app = {
      target_group_arn = aws_lb_target_group.app.arn
      desired_count    = var.app_desired_count
    }
    web = {
      target_group_arn = aws_lb_target_group.web.arn
      desired_count    = var.web_desired_count
    }
  }

  name            = "${local.name_prefix}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend[each.key].arn
  desired_count   = each.value.desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    weight            = 100
  }

  load_balancer {
    target_group_arn = each.value.target_group_arn
    container_name   = each.key
    container_port   = var.frontend_container_port
  }

  depends_on = [
    aws_lb_listener_rule.app,
    aws_lb_listener_rule.web
  ]

  tags = var.tags
}

resource "aws_appautoscaling_target" "api" {
  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name_prefix}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_target" "worker" {
  for_each = aws_ecs_service.worker

  max_capacity       = 3
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${each.value.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "worker_cpu" {
  for_each = aws_appautoscaling_target.worker

  name               = "${local.name_prefix}-${replace(each.key, "_", "-")}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension
  service_namespace  = each.value.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 65

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_target" "frontend" {
  for_each = aws_ecs_service.frontend

  max_capacity       = 2
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${each.value.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "frontend_cpu" {
  for_each = aws_appautoscaling_target.frontend

  name               = "${local.name_prefix}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension
  service_namespace  = each.value.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

data "aws_region" "current" {}
