output "alb_arn" {
  description = "The ARN of the ALB"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "The DNS name of the ALB"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "The hosted zone ID of the ALB"
  value       = aws_lb.main.zone_id
}

output "listener_http_arn" {
  description = "The ARN of the HTTP listener (used when no certificate)"
  value       = local.has_certificate ? aws_lb_listener.http_redirect[0].arn : aws_lb_listener.http[0].arn
}

output "listener_https_arn" {
  description = "The ARN of the HTTPS listener (empty if no certificate)"
  value       = local.has_certificate ? aws_lb_listener.https[0].arn : ""
}
