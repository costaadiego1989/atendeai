variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "private_subnets" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for Amazon MQ"
  type        = string
}

variable "mq_username" {
  description = "RabbitMQ username"
  type        = string
  default     = "atendeai_admin"
}

variable "mq_password" {
  description = "RabbitMQ password"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
