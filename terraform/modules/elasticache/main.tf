locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = var.private_subnets

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-redis-subnet-group"
    }
  )
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis for AtendeAi"
  node_type            = "cache.t4g.micro"
  port                 = 6379
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [var.security_group_id]

  automatic_failover_enabled = var.environment == "prod" ? true : false
  num_cache_clusters         = var.environment == "prod" ? 2 : 1

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-redis"
    }
  )
}
