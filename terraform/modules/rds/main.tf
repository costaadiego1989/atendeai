locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-rds-subnet-group"
  subnet_ids = var.private_subnets

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-rds-subnet-group"
    }
  )
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-postgres16-params"
  family = "postgres16"

  parameter {
    name         = "rds.allowed_extensions"
    value        = "vector,uuid-ossp,pg_trgm"
    apply_method = "pending-reboot"
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-postgres16-params"
    }
  )
}

resource "aws_db_instance" "main" {
  identifier        = "${local.name_prefix}-postgres"
  engine            = "postgres"
  engine_version    = "16" # Choose a version compatible with Prisma
  instance_class    = "db.t4g.micro"
  allocated_storage = 20

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  parameter_group_name   = aws_db_parameter_group.main.name
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]

  backup_retention_period = var.environment == "prod" ? 7 : 0
  backup_window           = "03:00-04:00"
  deletion_protection     = var.environment == "prod" ? true : false

  skip_final_snapshot = var.environment == "prod" ? false : true
  publicly_accessible = false
  multi_az            = var.environment == "prod" ? true : false

  tags = merge(
    var.tags,
    {
      Name = "${local.name_prefix}-postgres"
    }
  )
}
