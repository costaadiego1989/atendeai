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
