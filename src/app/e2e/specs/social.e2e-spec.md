# Módulo: Social

## Rotas Testadas
- `/social`

## Pré-condições
- Usuário autenticado com tenant ativo
- Conta Instagram conectada (para testes de integração)
- Posts publicados com métricas
- Comentários e DMs de teste

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/social` | Página carrega |
| 1.2 | Verificar status da conexão Instagram | Indicador visível |
| 1.3 | Verificar métricas de engajamento | Cards visíveis |
| 1.4 | Verificar lista de posts | Lista carrega |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Conectar conta Instagram | Fluxo OAuth completo |
| 2.2 | Visualizar posts | Lista com imagem, caption, métricas |
| 2.3 | Visualizar métricas de engajamento | Likes, comments, shares, reach |
| 2.4 | Visualizar comentários de um post | Lista de comentários |
| 2.5 | Responder comentário | Resposta enviada |
| 2.6 | Visualizar DMs | Lista de mensagens diretas |
| 2.7 | Desconectar conta | Conta removida |
| 2.8 | Reconectar conta | Fluxo OAuth novamente |
| 2.9 | Métricas por período | Dados filtrados |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Responder comentário vazio | Validação impede |
| 3.2 | Resposta com mais de 2200 caracteres (limite IG) | Validação de tamanho |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar posts por período | Posts filtrados |
| 4.2 | Buscar post por caption | Resultados corretos |
| 4.3 | Filtrar DMs por status (lida/não lida) | Lista filtrada |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Lista de posts com 20+ itens | Paginação funcional |
| 5.2 | Lista de comentários com 50+ itens | Scroll ou paginação |
| 5.3 | Lista de DMs com 50+ itens | Paginação funcional |

### 6. CRUD Completo
N/A (social é integração read-mostly, ações limitadas a responder).

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Instagram não conectado | CTA de conexão |
| 7.2 | Sem posts | Mensagem "Nenhum post encontrado" |
| 7.3 | Loading de posts | Skeletons |
| 7.4 | Loading de métricas | Skeletons nos cards |
| 7.5 | Conta conectada sem posts | Mensagem informativa |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | Instagram OAuth falha | Mensagem de erro, retry |
| 8.2 | Token Instagram expirado | Mensagem "Reconecte sua conta" |
| 8.3 | API do Instagram retorna 500 | Mensagem de erro |
| 8.4 | Rate limit do Instagram | Mensagem "Aguarde para tentar novamente" |
| 8.5 | Responder comentário falha | Mensagem de erro |
| 8.6 | Token da sessão expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | XSS em resposta de comentário | HTML escapado |
| 9.2 | Post com caption muito longa | Truncada com "ver mais" |
| 9.3 | Post sem imagem (carrossel vazio) | Placeholder |
| 9.4 | Métricas com valores muito altos (1M+) | Formatação abreviada (1M, 500K) |
| 9.5 | Desconectar durante sync | Sync cancelada limpo |
| 9.6 | Conta Instagram deletada externamente | Mensagem de reconexão |
| 9.7 | Double-click em conectar | Apenas um fluxo OAuth |
| 9.8 | Resposta com emojis | Aceita e enviada |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Social em mobile (375px) | Layout adaptado |
| 10.2 | Social em tablet (768px) | Layout adaptado |
| 10.3 | Social em desktop (1440px) | Layout completo |
| 10.4 | Imagens com alt text | Screen reader descreve |
| 10.5 | Navegação por teclado | Focus em posts e ações |
| 10.6 | Métricas com aria-labels | Valores anunciados |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Novo post publicado durante visualização | Refresh mostra novo post |
| 11.2 | Responder mesmo comentário duas vezes | Apenas uma resposta |
| 11.3 | Desconectar enquanto carrega posts | Estado limpo |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver posts e métricas | Leitura permitida |
| 12.2 | Viewer tenta responder comentário | Bloqueado |
| 12.3 | Apenas admin/owner pode conectar/desconectar | Ação restrita |
| 12.4 | Dados de outro tenant | Nunca visíveis |
| 12.5 | Token Instagram armazenado seguramente | Não exposto no frontend |
