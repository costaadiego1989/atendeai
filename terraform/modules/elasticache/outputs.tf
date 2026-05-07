output "primary_endpoint_address" {
  description = "The primary endpoint address for Redis"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "port" {
  description = "The Redis port"
  value       = aws_elasticache_replication_group.main.port
}
