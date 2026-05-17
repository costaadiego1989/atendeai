output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.network.vpc_id
}

output "alb_dns_name" {
  description = "The DNS name of the ALB"
  value       = module.alb.alb_dns_name
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "rds_endpoint" {
  description = "The endpoint of the RDS instance"
  value       = "${module.rds.address}:${module.rds.port}"
}

output "redis_endpoint" {
  description = "The endpoint of the Redis cluster"
  value       = "${module.elasticache.primary_endpoint_address}:${module.elasticache.port}"
}

output "api_ecr_repository_url" {
  description = "API ECR repository URL"
  value       = module.ecs.api_ecr_repository_url
}

output "app_ecr_repository_url" {
  description = "App ECR repository URL"
  value       = module.ecs.app_ecr_repository_url
}

output "web_ecr_repository_url" {
  description = "Web ECR repository URL"
  value       = module.ecs.web_ecr_repository_url
}
