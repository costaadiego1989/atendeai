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
  default     = "prod"
}

variable "db_password" {
  description = "Senha do banco de dados principal."
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Tag das imagens publicadas no ECR para api, app e web."
  type        = string
  default     = "latest"
}

variable "ec2_instance_type" {
  description = "Tipo da instancia EC2 usada pelo ECS. Para inicio barato, t3.medium."
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
  description = "Capacidade maxima do Auto Scaling Group. 1 = instancia unica (sem HA/scale-out)."
  type        = number
  default     = 1
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

# --- Domain & SSL ---

variable "domain_name" {
  description = "Dominio base para roteamento por host (ex: atende-ai.tech)."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN do certificado ACM para HTTPS. Se vazio, apenas HTTP."
  type        = string
  default     = ""
}

# --- Spot Instances ---

variable "use_spot_instances" {
  description = "Habilitar Spot Instances via mixed instances policy no ASG do ECS."
  type        = bool
  default     = true
}

variable "spot_instance_types" {
  description = "Lista de tipos de instancia para diversificacao Spot."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t2.medium"]
}

variable "on_demand_base_capacity" {
  description = "Quantidade de instancias On-Demand como base (0 = tudo Spot, On-Demand so como fallback)."
  type        = number
  default     = 0
}

# --- Scheduling ---

variable "enable_scheduling" {
  description = "Habilitar desligamento/ligamento automatico do ASG por horario."
  type        = bool
  default     = false
}

variable "schedule_stop_cron" {
  description = "Cron para desligar (timezone America/Sao_Paulo)."
  type        = string
  default     = "0 0 * * *"
}

variable "schedule_start_cron" {
  description = "Cron para ligar (timezone America/Sao_Paulo)."
  type        = string
  default     = "0 7 * * *"
}

variable "tags" {
  description = "Tags comuns para todos os recursos."
  type        = map(string)
  default = {
    Project      = "atendeai"
    Environment  = "prod"
    ManagedBy    = "terraform"
    CostStrategy = "spot-optimized"
    Scheduling   = "auto-stop-midnight"
    Team         = "engineering"
  }
}


