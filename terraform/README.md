# Terraform AWS - AtendeAi

Infraestrutura base para rodar o AtendeAi na AWS com ECS on EC2, comecando em 1 instancia e preparado para escalar para 2 ou 3 nos.

## O que este Terraform cria

- VPC com subnets publicas e privadas em 2 AZs.
- Internet Gateway, NAT Gateway e tabelas de rota.
- Security groups para ALB, ECS, RDS, Redis e RabbitMQ.
- ALB HTTP com roteamento inicial:
  - `/api/*` para a API.
  - `/app` e `/app/*` para o app.
  - `/*` para o web.
- ECS Cluster on EC2 com Auto Scaling Group de 1 a 3 instancias.
- Capacity Provider do ECS ligado ao Auto Scaling Group.
- ECR para imagens `api`, `app` e `web`.
- ECS services separados para:
  - `api`
  - `messaging-worker`
  - `prospect-search-worker`
  - `alerts-worker`
  - `scheduling-worker`
  - `app`
  - `web`
- CloudWatch Log Group por service.
- RDS PostgreSQL.
- ElastiCache Redis.
- Amazon MQ RabbitMQ.
- SSM Parameter Store para conexoes e segredos base.
- Autoscaling dos ECS services por CPU.

## Importante sobre API e workers

Subir a API nao sobe os workers automaticamente.

Cada worker tem uma task definition e um ECS service proprio. A API usa `node dist/main`, enquanto os workers usam entrypoints diferentes:

- `node dist/messaging-worker`
- `node dist/prospect-search-worker`
- `node dist/alerts-worker`
- `node dist/scheduling-worker`

## Fluxo recomendado de deploy

1. Inicializar Terraform.
2. Criar ECR e infra base.
3. Buildar e publicar as imagens.
4. Aplicar/atualizar os ECS services.
5. Rodar migrations no pipeline ou em task separada.
6. Fazer smoke test pelo ALB.

Como os repositorios ECR sao criados pelo Terraform, o primeiro deploy normalmente acontece em duas fases:

```bash
terraform init
terraform plan
terraform apply -target=module.ecs.aws_ecr_repository.api -target=module.ecs.aws_ecr_repository.app -target=module.ecs.aws_ecr_repository.web
```

Depois publique as imagens no ECR com a tag definida em `image_tag` e rode:

```bash
terraform plan
terraform apply
```

Se as imagens ja existirem em outro registry, preencha `api_image_uri`, `app_image_uri` e `web_image_uri` e aplique tudo direto.

## Variaveis sensiveis

Nao commite arquivos reais `.tfvars`. Use variaveis de ambiente, CI/CD ou SSM/Secrets Manager.

Exemplo local:

```bash
terraform plan \
  -var="db_password=CHANGE_ME" \
  -var="mq_password=CHANGE_ME" \
  -var="image_tag=2026-05-07"
```

## Escala

O Auto Scaling Group nasce com:

- `desired_capacity = 1`
- `min_size = 1`
- `max_size = 3`

Os ECS services tambem tem autoscaling por CPU. Para alta disponibilidade real, suba o ASG para pelo menos 2 instancias em AZs diferentes.

## Pendencias antes de producao

- Adicionar HTTPS com ACM.
- Adicionar Route53 e host-based routing (`api`, `app`, `www`).
- Revisar IAM para restringir ARNs de SSM/KMS.
- Criar task/pipeline de migration Prisma.
- Adicionar autoscaling de workers por profundidade de fila quando as metricas estiverem publicadas.
- Ajustar retention de logs por ambiente.
