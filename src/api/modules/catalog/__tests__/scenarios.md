# Análise e Bateria de Testes — Módulo Catalog (Catálogo de Produtos e Serviços)

Análise completa do domínio, cobertura atual e proposta de testes para o módulo `catalog`. Este módulo atua focado em **Gestão de Inventário Básico (Nome, Tipo de Venda, Categoria e Preço Base)** que alimentará outros módulos (como `inventory` e `commerce`). Ele tem características CRUD, mas possui regras de negócio cruciais de deleção (soft-delete vs hard-delete) e triggers de eventos globais.

---

## Resumo do Domínio e Arquitetura

| Camada | Artefatos |
|---|---|
| **Domain (Data Structures/Ports)** | `CatalogCategoryRecord`, `CatalogItemRecord`, `ICatalogRepository`. |
| **Domain Errors** | `CatalogCategoryInUseError`, `CatalogCategoryNotFoundError`, `CatalogInvalidPriceError`, `CatalogItemNotFoundError`. |
| **Integration Events** | 3 grandes eventos publicáveis: `CatalogItemCreated`, `CatalogItemUpdated`, `CatalogItemDeactivated`. |
| **Facade** | `CatalogFacade` (Para uso de outros módulos caso precisem não passar via HTTP). |
| **Use Cases (8)** | `CreateCatalogCategory`, `CreateCatalogItem`, `DeactivateCatalogCategory`, `DeactivateCatalogItem`, `ListCatalogCategories`, `ListCatalogItems`, `UpdateCatalogCategory`, `UpdateCatalogItem`. |
| **Controllers** | `CatalogController` (REST API). |
| **Persistence** | `PrismaCatalogRepository`. |

---

## Cobertura Atual (1 Arquivo de Teste Existente)

Atualmente **NÃO EXISTE NENHUM TESTE UNITÁRIO** isolado para NENHUMA peça do Módulo Catalog. A estrutura toda se sustenta com 1 teste E2E:

### 🟡 Teste Rest E2E (`catalog.e2e-spec.ts`)
| Cenário | Status |
|---|---|
| 1 fluxo gigante de "Criar categorias -> Ler Categorias -> Atualizar Categoria -> Criar itemProduto -> Criar itemService -> Atualizar Item -> Impedir Delete Categoria com Items -> Filtrar -> Desativar -> SoftDelete". | 🟡 Garante integração das pontas do HTTP até o banco de dados e cobre happy-paths de soft-delete, porém esconde exceções (errors domain) e torna debugar uma falha bastante complexo e lento. |

---

## Lacunas Identificadas (Gaps)

### 🔴 Core Use Cases (Grau Crítico por disparar Eventos)
Sem testes, corremos o risco de faturar serviços errados se houver malformação.
1. **`CreateCatalogItemUseCase` & `Update...`:** Não testa se lança `CatalogCategoryNotFoundError` adequadamente; Trims de strings (para evitar produtos idênticos com espaços) não são testados; não captura se publicam corretamente o Payload JSON do Evento `CatalogItemCreatedIntegrationEvent`. 
2. **`DeactivateCatalogCategoryUseCase`:** Lança `CatalogCategoryInUseError` se tentar desativar categoria que tem Items *Ativos*, mas esse catch de domínio na exception não é valiado diretamente no motor do UseCase isolado (pois é delegado ao Repo, mas a interceptação é vital).
3. **Cálculos e Parsing Incorretos:** O parse de preço (moeda) no banco não tem cobertura se inserir lixo ou valores `undefined`.

### 🟡 Repositório (Persistence Layer)
- O `PrismaCatalogRepository` suporta um feature forte: "hasActiveItemsInCategory". Se o filtro `includeInactive` for omitido/mal configurado em uma issue futura do PrismaClient, o sistema deixará deletar categorias que têm produtos ativos porque o Query Filter não foi isolado em testes.

### 🟡 Facade 
- `CatalogFacade` será consumido diretamente pelo Bot/NLU no futuro, e é vital seu teste local.

---

## Proposta de Bateria de Testes

Abaixo, os cenários específicos divididos por camadas:

### FASE 1 — Domain Errors e Eventos (Priority: 🟢 LOW)
Não costumamos testar plain objects arduamente, mas podemos testar exceptions que mapeiam códigos e extends (DomainException).
- `[NEW]` Validar code/messages dos 4 Custom Errors.

### FASE 2 — Core Use Cases (Priority: 🔴 CRITICAL)

##### `CreateCatalogCategoryUseCase.spec.ts` (NEW)
- Garantir Trim no nome e descarte de nulls desnecessários.
- Garantir trigger de `saveAuditLog` de criação.

##### `CreateCatalogItemUseCase.spec.ts` (NEW)
- `[NEW]` Lança `CatalogCategoryNotFoundError` isolado se o mock de repository responder `null`.
- `[NEW]` Valida se basePrice, currency e source tem defaults configurados ("MANUAL").
- `[NEW]` Valida se despacha corretamente `eventBus.publish(new CatalogItemCreatedIntegrationEvent(...))` com o payload perfeito (vital para Módulo Commerce).

##### `DeactivateCatalogCategoryUseCase.spec.ts` (NEW)
- Lança erro customizado se Categoria não existir.
- Lança `CatalogCategoryInUseError` se `hasActiveItemsInCategory` for verídico.
- Executa fluxo limpo de soft-delete e emite `AuditLog`.

##### `DeactivateCatalogItemUseCase` & `UpdateCatalogItemUseCase` (NEW)
- Checam de forma análoga a Existência antes de agir.
- `UpdateCatalogItem` verifica a categoria alvo (`CatalogCategoryNotFoundError`), não só o item em si.
- Atualizam as entidades, disparam `saveAuditLog` e despacham seus Integration Events apropriados (`CatalogItemUpdated`, `CatalogItemDeactivated`).

### FASE 3 — Queries & List Read UCs (Priority: 🟡 MEDIUM)
- Testes limpos garantindo mapeamento (`ListCatalogCategoriesUseCase.spec.ts`, `ListCatalogItemsUseCase.spec.ts`). Mock do repositório deve retornar as listas corretas.

### FASE 4 — Infraestrutura Prisma & Facade (Priority: 🔴 HIGH)

##### `PrismaCatalogRepository.integration.spec.ts` (NEW)
Como o mapeamento Decimal->Price (parse de banco) fica aqui, esse teste é essencial:
- `[NEW]` Testar `createItem` injetando strings e verificando se `basePrice` persiste adequadamente e volta parseado string.
- `[NEW]` Testar o filtro Multi-busca do `listItems`: "OR (name contains query, description contains query) + Active filters".
- `[NEW]` Testar o método booleano de retenção de chave `hasActiveItemsInCategory`.

##### `CatalogFacade.spec.ts` (NEW)
- Apenas mocka o `FindItemById` confirmando que transfere os argumentos perfeitamente.

---

## Quadro Comparativo Sugerido

| Tipo | Existentes | Novos (Previstos) | Total |
|---|---|---|---|
| **Errors / Domain** | 0 | ~4 | 4 |
| **Unit — Core/CRUD Use Cases** | 0 | ~25 | 25 |
| **Unit — Facade** | 0 | ~2 | 2 |
| **Integration (Prisma)** | 0 | ~10 | 10 |
| **E2E (Controllers)** | 1 (Mega File) | 0 | 1 |
| **TOTAL** | **~1** | **~41** | **~42** |

---

## User Review Required

> [!WARNING]
> No Prisma Repository do Catalog (`src/modules/catalog/infrastructure/persistence/repositories/PrismaCatalogRepository.ts`), o método Privado de Mapping (`mapItem`) possui um parser bruto manual: 
> `const basePrice = item.basePrice == null ? null : Number(item.basePrice.toString()).toFixed(2);`
> Isso pode mascarar falhas silenciosas de precisão. Eu irei blindar isso com testes de Integração isolados focando os boundary points monetários para ter a devida certeza de que "R$ 0,00" ou "R$ 10.999,99" não enlouquece pelo `toString` do Type Prisma-Decimal. Está de acordo que o foco principal de Testes deste módulo transacionalmente sensível seja o parser Repositório/Gateway?

## Verification Plan

### Automated Tests
Rodaremos a bateria para garantir cobertura ponta a ponta na raiz do path e validação do fluxo:
```bash
npx jest --testPathPattern="src/modules/catalog" --verbose
```
