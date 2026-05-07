# Estrutura inicial da infraestrutura do AtendeAi.


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
  tags         = local.common_tags
}

module "security_groups" {
  source = "./modules/security_groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.network.vpc_id
  tags         = local.common_tags
}

module "iam" {
  source = "./modules/iam"

  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.network.vpc_id
  public_subnets    = module.network.public_subnet_ids
  security_group_id = module.security_groups.alb_sg_id
  tags              = local.common_tags
}

module "ecs" {
  source = "./modules/ecs"

  project_name            = var.project_name
  environment             = var.environment
  vpc_id                  = module.network.vpc_id
  private_subnets         = module.network.private_subnet_ids
  security_group_id       = module.security_groups.ecs_sg_id
  instance_profile_name   = module.iam.ecs_instance_profile_name
  task_execution_role_arn = module.iam.ecs_task_execution_role_arn
  task_role_arn           = module.iam.ecs_task_role_arn
  http_listener_arn       = module.alb.listener_http_arn
  ssm_parameter_prefix    = module.secrets.parameter_prefix
  image_tag               = var.image_tag
  api_image_uri           = var.api_image_uri
  app_image_uri           = var.app_image_uri
  web_image_uri           = var.web_image_uri
  api_desired_count       = var.api_desired_count
  app_desired_count       = var.app_desired_count
  web_desired_count       = var.web_desired_count
  worker_desired_count    = var.worker_desired_count
  tags                    = local.common_tags

  depends_on = [module.secrets]
}

module "rds" {
  source = "./modules/rds"

  project_name      = var.project_name
  environment       = var.environment
  private_subnets   = module.network.private_subnet_ids
  security_group_id = module.security_groups.rds_sg_id
  db_password       = var.db_password
  tags              = local.common_tags
}

module "elasticache" {
  source = "./modules/elasticache"

  project_name      = var.project_name
  environment       = var.environment
  private_subnets   = module.network.private_subnet_ids
  security_group_id = module.security_groups.redis_sg_id
  tags              = local.common_tags
}

module "mq" {
  source = "./modules/mq"

  project_name      = var.project_name
  environment       = var.environment
  private_subnets   = module.network.private_subnet_ids
  security_group_id = module.security_groups.mq_sg_id
  mq_password       = var.mq_password
  tags              = local.common_tags
}

module "secrets" {
  source = "./modules/secrets"

  project_name   = var.project_name
  environment    = var.environment
  db_endpoint    = module.rds.address
  db_port        = module.rds.port
  db_name        = module.rds.db_name
  db_username    = "postgres"
  db_password    = var.db_password
  redis_endpoint = module.elasticache.primary_endpoint_address
  redis_port     = module.elasticache.port
  mq_endpoint    = module.mq.amqp_endpoint
  mq_username    = "atendeai_admin"
  mq_password    = var.mq_password
  tags           = local.common_tags
}
