variable "aws_region" {
  description = "Regiao AWS base para o ambiente."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nome base usado em recursos AWS."
  type        = string
  default     = "atendeai"
}

variable "environment" {
  description = "Nome do ambiente, como dev, staging ou prod."
  type        = string
  default     = "dev"
}

variable "db_password" {
  description = "Senha do banco de dados principal."
  type        = string
  sensitive   = true
}

variable "mq_password" {
  description = "Senha do RabbitMQ."
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Tag das imagens publicadas no ECR para api, app e web."
  type        = string
  default     = "latest"
}

variable "ec2_instance_type" {
  description = "Tipo da instancia EC2 usada pelo ECS. Para inicio barato, t3.medium; para mais folga, t3.large."
  type        = string
  default     = "t3.medium"
}

variable "asg_min_size" {
  description = "Capacidade minima do Auto Scaling Group."
  type        = number
  default     = 1
}

variable "asg_desired_capacity" {
  description = "Capacidade desejada inicial do Auto Scaling Group."
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Capacidade maxima do Auto Scaling Group."
  type        = number
  default     = 3
}

variable "api_image_uri" {
  description = "URI completa da imagem da API. Se vazio, usa o ECR criado pelo modulo ECS com image_tag."
  type        = string
  default     = null
}

variable "app_image_uri" {
  description = "URI completa da imagem do app. Se vazio, usa o ECR criado pelo modulo ECS com image_tag."
  type        = string
  default     = null
}

variable "web_image_uri" {
  description = "URI completa da imagem do web. Se vazio, usa o ECR criado pelo modulo ECS com image_tag."
  type        = string
  default     = null
}

variable "api_desired_count" {
  description = "Quantidade desejada de tasks da API."
  type        = number
  default     = 1
}

variable "app_desired_count" {
  description = "Quantidade desejada de tasks do app."
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Quantidade desejada de tasks do web."
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Quantidade desejada de tasks para cada worker."
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags comuns para todos os recursos."
  type        = map(string)
  default = {
    Project     = "atendeai"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
