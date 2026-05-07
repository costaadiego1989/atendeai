output "cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecr_repository_api_url" {
  description = "The URL of the API ECR repository"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_repository_app_url" {
  description = "The URL of the App ECR repository"
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_web_url" {
  description = "The URL of the Web ECR repository"
  value       = aws_ecr_repository.web.repository_url
}

output "api_service_name" {
  description = "The ECS service name for the API"
  value       = aws_ecs_service.api.name
}

output "worker_service_names" {
  description = "ECS service names for background workers"
  value = {
    for key, service in aws_ecs_service.worker : key => service.name
  }
}

output "frontend_service_names" {
  description = "ECS service names for app and web"
  value = {
    for key, service in aws_ecs_service.frontend : key => service.name
  }
}
