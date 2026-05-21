# --- Task Definitions ---

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
      name         = "api"
      image        = local.api_image
      essential    = true
      command      = ["node", "dist/main"]
      stopTimeout  = 120
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

# --- Services ---

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
