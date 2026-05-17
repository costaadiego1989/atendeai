variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnets" {
  description = "List of public subnet IDs (ECS runs here to avoid NAT Gateway cost)"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for ECS instances"
  type        = string
}

variable "instance_profile_name" {
  description = "IAM instance profile name for ECS instances"
  type        = string
}

variable "task_execution_role_arn" {
  description = "IAM role ARN used by ECS to pull images, read secrets and write logs"
  type        = string
}

variable "task_role_arn" {
  description = "IAM role ARN assumed by the running containers"
  type        = string
}

variable "http_listener_arn" {
  description = "HTTP listener ARN used to route public services"
  type        = string
}

variable "https_listener_arn" {
  description = "HTTPS listener ARN used to route public services (empty if no certificate)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Base domain name for host-based routing (e.g. atende-ai.tech)"
  type        = string
  default     = ""
}

variable "ssm_parameter_prefix" {
  description = "SSM parameter prefix, for example /atendeai/prod"
  type        = string
}

variable "image_tag" {
  description = "Image tag used when explicit image URIs are not provided"
  type        = string
  default     = "latest"
}

variable "ec2_instance_type" {
  description = "EC2 instance type for the ECS Auto Scaling Group"
  type        = string
  default     = "t3.medium"
}

variable "asg_min_size" {
  description = "Minimum size for the ECS Auto Scaling Group"
  type        = number
  default     = 1
}

variable "asg_desired_capacity" {
  description = "Desired capacity for the ECS Auto Scaling Group"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum size for the ECS Auto Scaling Group"
  type        = number
  default     = 2
}

variable "api_image_uri" {
  description = "Full API image URI. Defaults to this module ECR repository URL plus image_tag"
  type        = string
  default     = null
}

variable "app_image_uri" {
  description = "Full app image URI. Defaults to this module ECR repository URL plus image_tag"
  type        = string
  default     = null
}

variable "web_image_uri" {
  description = "Full web image URI. Defaults to this module ECR repository URL plus image_tag"
  type        = string
  default     = null
}

variable "api_desired_count" {
  description = "Desired API task count"
  type        = number
  default     = 1
}

variable "app_desired_count" {
  description = "Desired app task count"
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Desired web task count"
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Desired task count for each worker service"
  type        = number
  default     = 1
}

variable "api_container_port" {
  description = "API container port"
  type        = number
  default     = 3000
}

variable "frontend_container_port" {
  description = "Frontend container port"
  type        = number
  default     = 80
}

variable "use_spot_instances" {
  description = "Enable Spot Instances via mixed instances policy"
  type        = bool
  default     = true
}

variable "spot_instance_types" {
  description = "List of instance types for Spot diversification (increases availability)"
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t2.medium"]
}

variable "on_demand_base_capacity" {
  description = "Number of On-Demand instances guaranteed as base (0 = all Spot, On-Demand only as fallback)"
  type        = number
  default     = 0
}

variable "spot_allocation_strategy" {
  description = "Spot allocation strategy: lowest-price or capacity-optimized"
  type        = string
  default     = "capacity-optimized"
}

variable "enable_scheduling" {
  description = "Enable scheduled start/stop of the ASG"
  type        = bool
  default     = false
}

variable "schedule_stop_cron" {
  description = "Cron expression to scale down. Uses America/Sao_Paulo timezone."
  type        = string
  default     = "0 0 * * *"
}

variable "schedule_start_cron" {
  description = "Cron expression to scale up. Uses America/Sao_Paulo timezone."
  type        = string
  default     = "0 7 * * *"
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

