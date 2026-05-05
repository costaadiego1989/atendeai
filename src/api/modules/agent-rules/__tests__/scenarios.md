# Análise e Bateria de Testes — Módulo Agent Rules (Diretrizes de IA)

O módulo `agent-rules` gerencia as instruções customizadas (System Prompts) que os lojistas definem para seus bots. Ele permite que uma regra seja definida em nível global (Tenant) ou específica para uma unidade (Branch).

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Ports/Enums)** | `ITenantAgentRuleRepository`, `AgentModule` (Módulos suportados: Messaging, Catalog, etc). |
| **Logic (Use Cases)** | `GetTenantAgentRule` (Lógica de resolução), `UpsertTenantAgentRule`. |
| **Infrastructure** | `PrismaTenantAgentRuleRepository` (Usa Raw SQL e DDL dinâmico). |
| **Auditoria** | Estrutura de `History` para revisões de prompt. |

---

## Cobertura Atual (Apenas 1 Arquivo E2E - Risco Técnico)

O módulo carece de testes granulares, o que é perigoso dada a sua natureza de infraestrutura dinâmica.

### 🔴 Infraestrutura Automática (Dynamic DDL)
O repositório executa comandos `ALTER TABLE` e `CREATE INDEX` em tempo de execução via `ensureInfrastructure()`. Esta é uma prática agressiva que pode causar locks em produção se não for exaustivamente testada em cenários de concorrência.

### 🔴 Lógica de Herança (Scope Resolution)
A lógica que decide: "Se não houver regra na Filial X, use a regra do Tenant Y" está implementada diretamente no repositório. Isso deve ser validado para evitar que a IA receba instruções erradas ou vazias.

### 🔴 Raw SQL e Performance
O uso de `$queryRaw` com filtros de `branch_id IS NULL` requer índices parciais corretos. Sem testes de integração, não há garantia de que os índices criados dinamicamente estão sendo utilizados.

---

## Proposta de Bateria de Testes

### FASE 1 — Resolução de Escopo (Priority: 🔴 CRITICAL)

##### `GetTenantAgentRuleUseCase.spec.ts` (NEW)
- **Hierarchy Test**: Salvar uma regra no Tenant e validar que a busca pela Filial (que não tem regra própria) retorna a do Tenant com a flag `inheritedFromTenant: true`.
- **Override Test**: Salvar uma regra no Tenant e outra na Filial. Validar que a da Filial vence com `inheritedFromTenant: false`.
- **Security Test**: Garantir que um Tenant A não consiga ler regras do Tenant B (`ForbiddenException`).

### FASE 2 — Integridade de Esquema (Priority: 🔴 HIGH)

##### `PrismaTenantAgentRuleRepository.integration.spec.ts` (NEW)
- **Idempotency Test**: Rodar o repositório múltiplas vezes e garantir que o `ensureInfrastructure` não quebra ao tentar recriar colunas ou índices já existentes.
- **Persistence Test**: Salvar e buscar regras com `notes` nulos e `updatedByUserId` preenchidos, validando o mapeamento Raw SQL -> Domain.
- **History Test**: Validar se a gravação de histórico de revisões está persistindo os prompts antigos corretamente.

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes | Novos (Previstos) | Total |
|---|---|---|---|
| **Unit — Use Cases** | 0 | ~4 | 4 |
| **Integration (Prisma/DDL)** | **0** | **~6** | **6** |
| **E2E (Controllers)** | 1 | 0 | 1 |
| **TOTAL** | **~1** | **~10** | **~11** |

---

## User Review Required

> [!WARNING]
> O repositório deste módulo faz **modificações no esquema do banco de dados (DDL)** toda vez que é inicializado. Esta é uma prática incomum em NestJS (onde normalmente usamos migrações). Minha proposta inclui testes de concorrência para garantir que dois processos tentando rodar o `ALTER TABLE` simultaneamente não travem sua aplicação. Além disso, a lógica de herança (Filial vs Tenant) é a base do comportamento do bot. Concorda em priorizar a validação dessa herança?

## Verification Plan

### Automated Tests
```bash
npx jest --testPathPattern="src/modules/agent-rules" --verbose
```
