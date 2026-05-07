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

output "api_service_name" {
  description = "The ECS service name for the API"
  value       = module.ecs.api_service_name
}

output "worker_service_names" {
  description = "The ECS service names for background workers"
  value       = module.ecs.worker_service_names
}

output "frontend_service_names" {
  description = "The ECS service names for app and web"
  value       = module.ecs.frontend_service_names
}

output "rds_endpoint" {
  description = "The endpoint of the RDS instance"
  value       = "${module.rds.address}:${module.rds.port}"
}

output "redis_endpoint" {
  description = "The endpoint of the Redis cluster"
  value       = "${module.elasticache.primary_endpoint_address}:${module.elasticache.port}"
}

output "rabbitmq_endpoint" {
  description = "The endpoint of the RabbitMQ broker"
  value       = module.mq.amqp_endpoint
}
