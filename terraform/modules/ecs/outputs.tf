output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "api_ecr_repository_url" {
  description = "API ECR repository URL"
  value       = aws_ecr_repository.api.repository_url
}

output "app_ecr_repository_url" {
  description = "App ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "web_ecr_repository_url" {
  description = "Web ECR repository URL"
  value       = aws_ecr_repository.web.repository_url
}
