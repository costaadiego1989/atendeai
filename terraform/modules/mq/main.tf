locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_mq_broker" "main" {
  broker_name        = "${local.name_prefix}-rabbitmq"
  engine_type        = "RabbitMQ"
  engine_version     = "3.13"
  host_instance_type = "mq.t3.micro"
  security_groups    = [var.security_group_id]
  subnet_ids         = var.environment == "prod" ? var.private_subnets : [var.private_subnets[0]]

  deployment_mode = var.environment == "prod" ? "CLUSTER_MULTI_AZ" : "SINGLE_INSTANCE"

  user {
    username = var.mq_username
    password = var.mq_password
  }

  publicly_accessible = false

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-rabbitmq"
    }
  )
}
