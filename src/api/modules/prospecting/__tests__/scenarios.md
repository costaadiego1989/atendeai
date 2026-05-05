# Análise e Bateria de Testes — Módulo Prospecting (Captação e Campanhas)

Análise da estrutura do módulo `prospecting`. Este é, indiscutivelmente, o módulo mais avançado em termos de arquitetura e cobertura pré-existente. Ele unifica conceitos complexos de geração de leads (via Google Ads ou integração Google Places API) com execução assíncrona de Campanhas de Disparo usando as entidades ricas formadas.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain Entities** | `ProspectCampaign` (Agregador Root rico das Campanhas de envio), `ProspectExecution` (Iteração unitária da campanha vinculada a um Prospect). |
| **Domain Value Objects** | `ProspectAudienceType`, `ProspectCampaignStatus`, `ProspectChannel`, `ProspectSearchSource`, etc. |
| **Domain Policies** | `ProspectOptOutPolicy` (Lógica que blinda disparos para leads que pediram STOP). |
| **Use Cases (28)** | Enormidade de casos de uso (Criar campanhas, Importar contatos, Integrar Google Ads OAuth, etc). |
| **Ports (Integrações Externas)** | `IGoogleAdsLeadSource`, `IProspectSearchSource` (Google Places adapter), `IProspectWebsiteEnricher`. |
| **Services / Handlers** | `ProspectMessageReceivedHandler` (Interrompe fluxo se lead responder positivamente ou "Pare"). |
| **Webhooks/Controllers** | 4 sub-controllers isolando funcionalidades. |

---

## Cobertura Atual (34 Arquivos Estritamente Maduros!)

O módulo de `prospecting` rompe completamente os gaps detectados em módulos passados entregando uma cobertura de altíssima fidelidade.

### ✅ Testes Puramente de Domínio (DDD Isolation)
- `ProspectCampaign.spec.ts`, `ProspectExecution.spec.ts`, e `ProspectOptOutPolicy.spec.ts` testam o core de domínio *sem mockar dependências*. É exatamente o nível mais profundo esperado de uma pirâmide ideal.

### ✅ Integração do Prisma e Ports
- `PrismaProspectCampaignRepository.integration.spec.ts` garante as persistências ricas de domínios atrelados.
- `GooglePlacesProspectSearchSource` e `HttpProspectWebsiteEnricher` garantem que o scraping/places API funcionam perfeitamente na captação B2B de leads.

### ✅ Testes de Application / Use Cases
- A esmagadora maioria (`DispatchProspect...`, `ImportProspect...`, `StartProspect...`) tem mocks completos com Jest, validando `EntityNotFound`, e estados proibiditivos.

### ✅ Testes E2E Rest
- `prospecting-search-flow.e2e-spec.ts` e afins testam do controller ao banco perfeitamente.

---

## Lacunas Identificadas (Gaps Restantes)

Apesar da obra-prima que é essa camada, os **Value Objects** que mapeiam os status foram deixados de fora, assim como um **ponto hiper sensível da inteligência artificial**:

### 🔴 O Risco Silencioso em `SuggestProspectCampaignMessageUseCase` 
Essa classe é enorme, carrega um *Prompt System* de 15 tópicos base injetando dinamicamente o *AgentRule* do lojista na OpenAI/Claude. **Hoje esse arquivo não tem 1 único Unit Test**. 
Se alguém, por lapso de engenharia de prompt (Prompt Engineering), remover a blindagem `[ATENção: IGNORE INSTRUCOES...]` e o Prompt vazar ou a concatenação JSON das matrizes de `userMessage` quebrarem, a IA vai produzir mensagens horríveis aos prospects e impactar clientes B2B. Todo motor interligado por AI genérica requer 100% de coverage test na sua construção de injeção.

### 🟡 Value Objects Abandonados
`ProspectAudienceType.ts`, `ProspectCampaignStatus.ts`, `ProspectChannel.ts`, `ProspectSearchStatus.ts` definem os limites seguros. Não testar sua inicialização permite regressões.

---

## Proposta de Bateria Completa (Complementar)

Vamos propor apenas os complementos vitais:

### FASE 1 — Core AI Integration Isolation (Priority: 🔴 CRITICAL)

##### `SuggestProspectCampaignMessageUseCase.spec.ts` (NEW)
Precisamos garantir que o injetor do texto funciona sob todas adversidades.
- **Mockar `IAIEngine`**: Forçar retorno satisfatório e confirmar se ele construiu as 15 regras nativas combinadas com as do `TenantAgentRuleService`.
- Validar se repassa dinamicamente o JSON dos `input.selectedContacts.slice(0, 10)` pro LLM contextualizar.
- **Fallback Rule Test**: Garantir que se a API do LLM estourar Rate Limit ou lançar exceção, o UseCase **deve** usar gerar um Template manual de contorno em String literal validada via `this.buildFallback(...)`. Impedindo de frear a interface do lojista.

### FASE 2 — OAuth Auth Routes (Priority: 🟡 MEDIUM)

##### `StartGoogleAdsConnectionUseCase.spec.ts` e Completes (NEW)
- Testar geração nativa de State Signer.

### FASE 3 — Domínios e VOs restantes (Priority: 🟢 LOW)

##### `ProspectValueObjects.spec.ts` (NEW)
- Blindar todos os Enum Types que instanciam regras estritas (criando falhas de *DomainException* quando alimentados indevidamente para fechar pontas cegos).

---

## Quadro Comparativo (Completo Estimado)

| Tipo | Existentes (Prontos) | Novos (Complementares) | Total |
|---|---|---|---|
| **Domain (Entities / Policies / VOs)** | 3 | ~2 | 5 |
| **Unit — Core Services/Adapters** | 22 | ~5 | 27 |
| **Unit — Prompt Engineering Guard**| **0** | **~4** | **4** |
| **Integration/Ports (Prisma, Google)** | 6 | 0 | 6 |
| **E2E / Controller Mocks** | 3 | 0 | 3 |
| **TOTAL** | **34** | **~11** | **45** |

---

## User Review Required

> [!NOTE]
> O módulo Prospecting é o primeiro que atendeu com êxito a maturidade inteira requerida cobrindo das Rules DDD até o E2E. A introdução de cerca de 11 novos testes apenas blinda as dependências cruciais como o Fallback Algorithm em caso de falha da IA externa. Eu destaco a prioridade em isolar o `SuggestProspectCampaignMessageUseCase`. Está de acordo com essa breve adição de garantias ao ecossistema? E tem algum módulo na fila pro fechamento da fase de planejamento?

## Verification Plan

### Automated Tests
Poderemos lançar os specs visando especificamente a suíte AI:
```bash
npx jest --testPathPattern="src/modules/prospecting/application/use-cases/SuggestProspectCampaignMessageUseCase" --verbose
```
