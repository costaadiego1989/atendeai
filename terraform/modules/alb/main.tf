locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.security_group_id]
  subnets            = var.public_subnets

  enable_deletion_protection = false

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-alb"
    }
  )
}

# HTTP Listener - redirecting to HTTPS is best practice, 
# but for initial setup returning 404 or default action is common if TLS is not yet set
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

# Target groups will be created by the ECS module or here if preferred. 
# It's usually better to create them near the ECS service that uses them, 
# but we can create a default one here.
