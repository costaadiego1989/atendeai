# --- Auto Scaling Policies ---

resource "aws_appautoscaling_target" "api" {
  max_capacity       = 2
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
    target_value = 70

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# --- Scheduled Actions (stop/start) ---

resource "aws_autoscaling_schedule" "stop" {
  count = var.enable_scheduling ? 1 : 0

  scheduled_action_name  = "${local.name_prefix}-stop-nightly"
  autoscaling_group_name = aws_autoscaling_group.ecs.name
  recurrence             = var.schedule_stop_cron
  min_size               = 0
  max_size               = 0
  desired_capacity       = 0
  time_zone              = "America/Sao_Paulo"
}

resource "aws_autoscaling_schedule" "start" {
  count = var.enable_scheduling ? 1 : 0

  scheduled_action_name  = "${local.name_prefix}-start-morning"
  autoscaling_group_name = aws_autoscaling_group.ecs.name
  recurrence             = var.schedule_start_cron
  min_size               = var.asg_min_size
  max_size               = var.asg_max_size
  desired_capacity       = var.asg_desired_capacity
  time_zone              = "America/Sao_Paulo"
}

data "aws_region" "current" {}
