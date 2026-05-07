output "amqp_endpoint" {
  description = "The AMQP connection endpoint"
  value       = aws_mq_broker.main.instances[0].endpoints[0]
}
