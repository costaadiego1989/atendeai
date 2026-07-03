# Plano de Testes Massivos — Frontend Admin AtendeAi

## Objetivo
Testar TODOS os módulos do painel admin via Playwright MCP: screenshots, interações, listas, CRUD, filtros, paginação, loading states, empty states, error states. Corrigir tudo que falhar → production-ready.

## Pré-requisitos
- Dev server rodando (`npm run dev:web` — porta 8080 ou 4200)
- API backend rodando (`npm run dev:api` — porta 3000)
- Platform admin key válida para autenticação
- MCP Playwright conectado

## Autenticação
Todo teste inicia em `/admin/login`:
1. Input API key
2. Click "Entrar"
3. Redirect para `/admin/support`
4. Navegar para módulo-alvo

---

## Módulos (19 total)

### Fase 1 — Core (fundação)
| # | Módulo | Rota | Testes |
|---|--------|------|--------|
| 1 | Login/Auth | `/admin/login` | login válido, inválido, campo vazio, erro API |
| 2 | Dashboard | `/admin/dashboard` | KPIs render, charts render, period selector, responsive |
| 3 | Tenants | `/admin/tenants` | lista, paginação, filtros, detalhes drawer |

### Fase 2 — Comunicação
| # | Módulo | Rota | Testes |
|---|--------|------|--------|
| 4 | Messaging | `/admin/messaging` | KPIs, tabela conversas, filtro canal/status, paginação, busca |
| 5 | Social | `/admin/social` | KPIs, lista posts, filtros plataforma |
| 6 | AI | `/admin/ai` | métricas tokens, lista sessões |

### Fase 3 — CRM & Vendas
| # | Módulo | Rota | Testes |
|---|--------|------|--------|
| 7 | Contacts | `/admin/contacts` | KPIs, tabela, paginação, estágios |
| 8 | Sales | `/admin/sales` | métricas receita, lista pedidos |
| 9 | Prospecting | `/admin/prospecting` | campanhas, métricas envio |
| 10 | Recovery | `/admin/recovery` | fluxos recuperação, taxas |
| 11 | Proposals | `/admin/proposals` | lista propostas, status |

### Fase 4 — Comércio
| # | Módulo | Rota | Testes |
|---|--------|------|--------|
| 12 | Commerce | `/admin/commerce` | pedidos, métricas, status |
| 13 | Catalog | `/admin/catalog` | produtos, categorias |
| 14 | Inventory | `/admin/inventory` | estoque, alertas |
| 15 | Payment | `/admin/payment` | transações, métodos |
| 16 | Billing | `/admin/billing` | subscriptions, usage, filtros plano/status |

### Fase 5 — Operações
| # | Módulo | Rota | Testes |
|---|--------|------|--------|
| 17 | Scheduling | `/admin/scheduling` | agendamentos, calendário |
| 18 | Support | `/admin/support` | feedbacks, drawer detalhes |
| 19 | Auth/Permissions | `/admin/auth` | sessões, permissões |

---

## Checklist por Módulo

Cada módulo será testado com:

### A. Carregamento & Exibição
- [ ] Página carrega sem erros no console
- [ ] Loading state exibido durante fetch
- [ ] KPIs renderizam com valores
- [ ] Tabela/lista renderiza dados
- [ ] Empty state quando sem dados
- [ ] Screenshot do estado completo

### B. Interações
- [ ] Period selector (1d/7d/30d/90d) troca dados
- [ ] Paginação funciona (next/prev/jump)
- [ ] Filtros aplicam corretamente
- [ ] Busca filtra resultados
- [ ] Hover states nos rows
- [ ] Click em item abre detalhes (se aplicável)

### C. Responsividade
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x812)

### D. Edge Cases
- [ ] API retorna erro 500 — mostra erro amigável
- [ ] API retorna vazio — mostra empty state
- [ ] Perda de conexão — feedback visual
- [ ] Token expirado — redirect login

### E. Integração End-to-End
- [ ] Fluxo completo: login → navegar → interagir → dados consistentes
- [ ] Cross-module: dados referenciados entre módulos batem

---

## Execução

Ordem: abrir browser via MCP → login → testar módulo → screenshot → reportar → próximo.

Cada módulo gera:
1. Screenshots (success + error + empty + responsive)
2. Lista de bugs encontrados
3. Fixes aplicados
4. Status final: PASS / FAIL + motivo

---

## Critérios de Aceite (Production-Ready)
- Zero console errors em todos módulos
- Todos loading/empty/error states implementados
- Paginação funcional em todas tabelas
- Period selector funcional em todos KPIs
- Screenshots limpos sem overflow/broken layout
- Mobile responsive sem scroll horizontal
