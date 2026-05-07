output "alb_arn" {
  description = "The ARN of the ALB"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "The DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "listener_http_arn" {
  description = "The ARN of the HTTP listener"
  value       = aws_lb_listener.http.arn
}
