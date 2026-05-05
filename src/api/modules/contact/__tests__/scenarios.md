# Análise e Bateria de Testes — Módulo Contact (Gestão de Clientes e Leads)

Análise completa da arquitetura do módulo `contact` e seu estado atual de cobertura. Diferente dos módulos `commerce` e `catalog` analisados recentemente, o **Contact utiliza forte Arquitetura Clean com Domain-Driven Design (DDD)**. Ele suporta a fundação do funil de vendas (CRM) e está excelente.

---

## Estrutura de Domínio e Arquitetura Base

| Camada | Artefatos |
|---|---|
| **Domain Entities (Rich)** | `Contact` (Aggregate Root rico contendo todas as regras do negócio e Domain Events), `ContactTimeline` (Extensão das iterações e atividades). |
| **Domain Value Objects** | `ContactName`, `ContactStage` (Blindando validações cruciais como tamanho do nome e fluxos da máquina de estado de CRM). |
| **Use Cases (8)** | `CreateContact`, `UpdateContact`, `DeleteContact`, `ListContacts`, `GetContact`, `IdentifyContact`, `ChangeContactStage`, `GetContactTimeline`. |
| **Application Services** | `ContactDomainEventPublisher` (Injeta Eventos do Domínio no Barramento de Mensageria do Sistema). |
| **Facade** | `ContactFacade` (Ponto de contato massivo usado por robôs do `Commerce` ou `Chat` sem precisar passar pelo HTTP Controller). |
| **Persistence** | `PrismaContactRepository` e `PrismaContactTimelineRepository` (Integration Layer perfeita isolando Prisma). |

---

## Cobertura Atual (A Mais Forte Até o Momento — 15 Arquivos)

Diferente do esperado, a suíte atual de testes do Contact já é massiva e segue o padrão desejado de arquitetura orientada a cenários de domínio. 

### ✅ Testes Unitários de Aplicação (Use Cases e Publishers)
Todos os 8 **Use Cases** possuem bateria de testes unitários isolada via mocks completos (`mockRepo`), testando exceções (`EntityNotFoundException`), gatilhos e integrações de domain events (`publisher.publishFromAggregate`). 
- 🟢 **Status:** Impecável. Cobertura da lógica de caso de uso está feita.

### ✅ Testes de Integração (Prisma)
Existem arquivos robustos testando as queries de alta complexidade:
- `PrismaContactRepository.integration.spec.ts` e `PrismaContactTimelineRepository.integration.spec.ts`. Eles testam soft-delete, paginação complexa (findAllByTenant com filtros de branch e tags) limitando queries cross-tenant (Vazamento de dados).
- 🟢 **Status:** Impecável.

### ✅ Testes E2E (Controllers REST)
Existem 3 suítes REST validando endpoints em `contact.e2e-spec.ts`, `contact-controller.e2e-spec.ts` e timeline.
- 🟢 **Status:** Ótimo.

---

## Lacunas Identificadas (Gaps Restantes)

Apesar da forte cobertura, a base piramidal (A camada puramente ligada ao **Domínio**) está sendo testada por tabela através da camada de Aplicação. Isso mascara falhas silenciosas em futuras expansões.

### 🟡 Testes Isolados de Domínio (Entities e Value Objects)
- `Contact.ts` (Entity): Agrega comportamentos massivos (`updateStage`, `addTag`, `removeTag`, `recordInteraction`, `updateDetails`). Não há testes nativos cobrindo o `clearEvents()` ou a garantia estrita do snapshot (`previousSnapshot !== currentSnapshot`) que gera as anotações do funil.
- Módulos `ContactStage` e `ContactName` não possuem suítes validadas para rejeitar nomes incorretos, stages não listados.

### 🔴 Facade Gateway 
- `ContactFacade.ts` é o core interno consumido pelo ChatBot e pelos pedidos do Commerce (exemplo: `upsertProspectContact`, `identifyContact`). Atualmente ele NÃO tem unit teste e sua lógica foge um pouco dos UCs (`ensureContact` implementa persistência crua direto no repositório com array unique sets).

---

## Proposta de Bateria Completa (Complementar)

Como o legado já resolveu 80% da demanda neste componente de negócio, os esforços propostos são para finalizar a blindagem da base limitando regressões e fechando a tampa.

### FASE 1 — Core Domain: Entities & VOs (Priority: 🟢 HIGH)
Foco isolado nos métodos do Aggregate root livre de mocks estruturais exógenos:
##### `Contact.spec.ts` (NEW)
- Validar criação (`Contact.create`) com tags padrão e estado "LEAD", garantindo que despacha o evento inicial interno `ContactCreatedDomainEvent`.
- Validar as trocas de estado (`updateStage`), garantindo inclusão na stack de eventos apenas quando modificado de fato (se Stage = igual, não emite evento de alteração).
- Testar métodos auxiliares de Tags (`addTag`, `removeTag`).
- Validar o `updateDetails` (onde a Snapshot Stringifiable validações detecta mudanças complexas antes de emitir um `ContactUpdatedDomainEvent`).

##### Values Objects: `ContactName.spec.ts` & `ContactStage.spec.ts` (NEW)
- Falhar instâncias se strings passarem dos limits (max len, empty length throw DomainException).

### FASE 2 — Gateway Integration Interna (Priority: 🔴 CRITICAL)
##### `ContactFacade.spec.ts` (NEW)
- `[NEW]` Validar repasse exato de Identificação via `identifyContactUseCase`.
- `[NEW]` Validar o construtor isolado "ensureContact" (que faz upsert baseando se ele existe pelo telefone, aplicando as tags extras enviadas preservando os logs).
- `[NEW]` Garantir que "upsertProspectContact" injeta coercitivamente o stage "PROSPECT" independentemente do payload original vindo de funis externos de captação de chumbo frio.

---

## Quadro Comparativo (Completo)

| Tipo | Existentes (Prontos) | Novos (Complementares) | Total |
|---|---|---|---|
| **Domain (Entities / VOs)** | 0 | ~15 | 15 |
| **Unit — Use Cases / App** | 9 | 0 | 9 |
| **Unit — Facades** | 0 | ~3 | 3 |
| **Integration (Prisma)** | 2 | 0 | 2 |
| **E2E (Controllers)** | 3 | 0 | 3 |
| **TOTAL** | **~14** | **~18** | **~32** |

---

## User Review Required

> [!NOTE]
> Essa é excelente notícia. O módulo base de "Agenda de clientes" já estava na estrutura esperada com cobertura altíssima de arquitetura de alta escala. O Gap complementar é muito prático e se limita à cerca de 18 testes granulares de domínio. Considera as adições na base aprovadas? Podemos partir em seguida para focar o motor principal e mais denso da suíte (`payment` ou a esteira do `bot`) ou qual seu próximo destino?

## Verification Plan

### Automated Tests
Rodaremos a bateria completa focando nas entidades:
```bash
npx jest --testPathPattern="src/modules/contact" --verbose
```
