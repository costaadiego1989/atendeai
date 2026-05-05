# AtendeAi

Monolito modular em NestJS com arquitetura orientada a eventos para atendimento via WhatsApp, billing e prospecção.

## Processos da aplicação

Hoje o sistema foi separado em processos com responsabilidades claras:

- `api`: expõe HTTP e orquestra os casos de uso síncronos
- `messaging-worker`: consome filas internas de `outbound-messages` e `follow-up`
- `prospect-search-worker`: consome a fila interna de `prospect-searches`

Isso é importante porque fila e worker separado resolvem problemas diferentes:

- fila: tira o trabalho pesado do request HTTP
- worker separado: tira o trabalho pesado do processo da API

## Infraestrutura usada

- PostgreSQL
- Redis
- RabbitMQ

## Rodando localmente sem Docker para a aplicação

Suba primeiro a infraestrutura:

```bash
docker compose up -d postgres redis rabbitmq
```

Depois rode os processos da aplicação em terminais separados:

```bash
npm run start:dev
npm run start:dev:worker:messaging
npm run start:dev:worker:prospect-search
```

## Rodando tudo com Docker Compose

Para subir infra, API e workers juntos:

```bash
npm run stack:up
```

Scripts uteis:

```bash
npm run stack:up
npm run stack:logs
npm run stack:ps
npm run stack:down
```

Serviços expostos:

- API: `http://localhost:3000/api/v1`
- PostgreSQL: `localhost:5434`
- Redis: `localhost:6377`
- RabbitMQ AMQP: `localhost:5672`
- RabbitMQ painel: `http://localhost:15672`

## Processos no Docker Compose

O `docker-compose.yml` sobe:

- `postgres`
- `redis`
- `rabbitmq`
- `migrate`
- `api`
- `messaging-worker`
- `prospect-search-worker`

O serviço `migrate` roda `prisma migrate deploy` antes da API e dos workers.

Os workers usam a mesma imagem da aplicação, mas com comandos diferentes:

- `npx prisma migrate deploy`
- `node dist/main`
- `node dist/messaging-worker`
- `node dist/prospect-search-worker`

## Variáveis importantes

As principais variáveis estão em [`.env.example`](/c:/Users/Admin/Desktop/AtendeAi/.env.example).

Para Docker Compose, prefira usar um arquivo dedicado como base:

- [`.env.compose.example`](/c:/Users/Admin/Desktop/AtendeAi/.env.compose.example)

No Docker Compose, alguns valores são sobrescritos para usar os nomes dos serviços internos:

- `postgres`
- `redis`
- `rabbitmq`

Isso evita o erro comum de usar `127.0.0.1` dentro do container.

Tambem evita warnings de interpolação do Compose quando alguma chave real tem caractere `$`.

## Build e testes

```bash
npm run build
npm run test
npm run test:e2e
```

## Operação e CI

Em CI, staging e produção, pense sempre em três processos:

1. `api`
2. `messaging-worker`
3. `prospect-search-worker`

Para build e testes unitários, você não precisa manter os três rodando ao mesmo tempo.

Para ambiente real, sim: API e workers devem ser orquestrados separadamente.

## Próximos passos naturais

- separar os outros workers seguindo o mesmo padrão
- consolidar bootstrap de workers
- ativar RabbitMQ como transporte principal de integration events em ambiente
