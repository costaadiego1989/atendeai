# Infraestrutura otimizada do AtendeAi (custo minimo com Spot).
# Removidos: NAT Gateway, Amazon MQ.
# Redis: ElastiCache (persistente).
# RDS Free Tier (db.t4g.micro, 750h/mes gratis no 1o ano).
# HTTPS via ACM + ALB com roteamento por subdominio.

locals {
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
    }
  )
}

module "network" {
  source = "./modules/network"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = "10.0.0.0/16"
  tags = merge(local.common_tags, {
    ResourceType = "network"
    Component    = "vpc"
  })
}

module "security_groups" {
  source = "./modules/security_groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.network.vpc_id
  tags = merge(local.common_tags, {
    ResourceType = "security"
    Component    = "firewall"
  })
}

module "iam" {
  source = "./modules/iam"

  project_name = var.project_name
  environment  = var.environment
  tags = merge(local.common_tags, {
    ResourceType = "security"
    Component    = "iam"
  })
}

module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.network.vpc_id
  public_subnets    = module.network.public_subnet_ids
  security_group_id = module.security_groups.alb_sg_id
  certificate_arn   = var.certificate_arn
  tags = merge(local.common_tags, {
    ResourceType = "networking"
    Component    = "load-balancer"
    CostCenter   = "traffic"
  })
}

module "rds" {
  source = "./modules/rds"

  project_name      = var.project_name
  environment       = var.environment
  private_subnets   = module.network.private_subnet_ids
  security_group_id = module.security_groups.rds_sg_id
  db_password       = var.db_password
  tags = merge(local.common_tags, {
    ResourceType = "database"
    Component    = "postgresql"
    CostCenter   = "data"
    FreeTier     = "yes"
  })
}

module "elasticache" {
  source = "./modules/elasticache"

  project_name      = var.project_name
  environment       = var.environment
  private_subnets   = module.network.private_subnet_ids
  security_group_id = module.security_groups.redis_sg_id
  tags = merge(local.common_tags, {
    ResourceType = "cache"
    Component    = "redis"
    CostCenter   = "data"
  })
}

import {
  to = module.secrets.aws_ssm_parameter.inventory_config_encryption_key
  id = "/atendeai/prod/INVENTORY_CONFIG_ENCRYPTION_KEY"
}

module "secrets" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment
  db_endpoint  = module.rds.address
  db_port      = module.rds.port
  db_name      = module.rds.db_name
  db_username  = "postgres"
  db_password  = var.db_password
  redis_host   = module.elasticache.primary_endpoint_address
  redis_port   = module.elasticache.port
  tags = merge(local.common_tags, {
    ResourceType = "security"
    Component    = "secrets"
  })
}

module "ecs" {
  source = "./modules/ecs"

  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.network.vpc_id
  public_subnets          = module.network.public_subnet_ids
  security_group_id       = module.security_groups.ecs_sg_id
  instance_profile_name   = module.iam.ecs_instance_profile_name
  task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  task_role_arn           = module.iam.ecs_task_role_arn
  http_listener_arn       = module.alb.listener_http_arn
  https_listener_arn      = module.alb.listener_https_arn
  domain_name             = var.domain_name
  ssm_parameter_prefix    = module.secrets.parameter_prefix
  image_tag               = var.image_tag
  ec2_instance_type       = var.ec2_instance_type
  asg_min_size            = var.asg_min_size
  asg_desired_capacity    = var.asg_desired_capacity
  asg_max_size            = var.asg_max_size
  api_image_uri           = var.api_image_uri
  app_image_uri           = var.app_image_uri
  web_image_uri           = var.web_image_uri
  api_desired_count       = var.api_desired_count
  app_desired_count       = var.app_desired_count
  web_desired_count       = var.web_desired_count
  worker_desired_count    = var.worker_desired_count

  # Spot Instances
  use_spot_instances      = var.use_spot_instances
  spot_instance_types     = var.spot_instance_types
  on_demand_base_capacity = var.on_demand_base_capacity

  # Scheduling (desligar/ligar automatico)
  enable_scheduling   = var.enable_scheduling
  schedule_stop_cron  = var.schedule_stop_cron
  schedule_start_cron = var.schedule_start_cron

  tags = merge(local.common_tags, {
    ResourceType = "compute"
    Component    = "ecs"
    CostCenter   = "compute"
    Optimized    = "spot-instances"
  })

  depends_on = [module.secrets]
}
