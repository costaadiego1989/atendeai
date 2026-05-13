# Módulo: Prospecting

## Rotas Testadas
- `/prospecting`
- `/prospecting/places`
- `/prospecting/campaigns`
- `/prospecting/ads`

## Pré-condições
- Usuário autenticado com tenant ativo
- Google Places API configurada
- Campanhas de prospecção criadas
- Google Ads conectado (para testes de ads)
- Leads importados no CRM

---

## Categorias de Teste

### 1. Smoke Tests (carregamento básico)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 1.1 | Acessar `/prospecting` | Página carrega |
| 1.2 | Verificar tabs (Places/Campaigns/Ads) | Tabs visíveis |
| 1.3 | Verificar campo de busca local | Input visível |
| 1.4 | Verificar lista de campanhas | Lista carrega |

### 2. Funcionalidade Principal (happy path)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 2.1 | Criar busca local (Google Places) | Resultados exibidos no mapa/lista |
| 2.2 | Visualizar resultados da busca | Empresas com dados (nome, telefone, rating) |
| 2.3 | Selecionar leads dos resultados | Checkbox funcional |
| 2.4 | Importar leads selecionados no CRM | Contatos criados |
| 2.5 | Preparar abordagem para lead | Template de mensagem gerado |
| 2.6 | Criar campanha de prospecção | Campanha criada |
| 2.7 | Pausar campanha | Status atualizado |
| 2.8 | Retomar campanha | Status atualizado |
| 2.9 | Conectar Google Ads | Fluxo OAuth |
| 2.10 | Visualizar leads importados | Lista com status |
| 2.11 | Visualizar insights de campanha | Métricas exibidas |
| 2.12 | Filtrar leads por estágio | Lista filtrada |

### 3. Validação de Formulários
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 3.1 | Busca local sem termo | Validação "Termo obrigatório" |
| 3.2 | Busca local sem localização | Validação "Localização obrigatória" |
| 3.3 | Criar campanha sem nome | Validação "Nome obrigatório" |
| 3.4 | Campanha sem mensagem template | Validação exige template |
| 3.5 | Template com variáveis inválidas | Mensagem de erro |

### 4. Filtros e Busca
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 4.1 | Filtrar leads por estágio (novo/contatado/qualificado) | Lista filtrada |
| 4.2 | Buscar lead por nome | Resultados corretos |
| 4.3 | Filtrar campanhas por status | Lista filtrada |
| 4.4 | Busca local por categoria (restaurante, salão) | Resultados relevantes |
| 4.5 | Busca local por raio | Resultados dentro do raio |

### 5. Paginação
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 5.1 | Resultados de busca com 50+ itens | Paginação funcional |
| 5.2 | Lista de leads com 100+ itens | Paginação funcional |
| 5.3 | Lista de campanhas com 20+ itens | Paginação funcional |

### 6. CRUD Completo
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 6.1 | Create: campanha | Persistida |
| 6.2 | Read: detalhes da campanha | Dados completos |
| 6.3 | Update: editar campanha | Dados atualizados |
| 6.4 | Delete: remover campanha | Removida |

### 7. Estados Vazios e Loading
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 7.1 | Sem buscas realizadas | Mensagem "Faça sua primeira busca" |
| 7.2 | Busca sem resultados | Mensagem "Nenhum resultado" |
| 7.3 | Sem campanhas | Mensagem vazia, CTA criar |
| 7.4 | Loading de busca | Spinner/skeleton |
| 7.5 | Google Ads não conectado | Card com CTA de conexão |

### 8. Tratamento de Erros (API 4xx/5xx)
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 8.1 | Google Places API falha | Mensagem de erro |
| 8.2 | Importação de leads falha | Mensagem com detalhes |
| 8.3 | Google Ads OAuth falha | Mensagem de erro, retry |
| 8.4 | Campanha não encontrada (404) | Mensagem "Campanha não encontrada" |
| 8.5 | Rate limit da API Google | Mensagem "Aguarde para nova busca" |
| 8.6 | Token expirado | Refresh ou redirect |

### 9. Edge Cases e Inputs Maliciosos
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 9.1 | Busca com termo XSS | HTML escapado |
| 9.2 | Busca com SQL injection | Input sanitizado |
| 9.3 | Importar lead já existente no CRM | Detecta duplicata, merge ou skip |
| 9.4 | Campanha com 1000+ leads | Performance aceitável |
| 9.5 | Busca com localização inválida | Mensagem de erro |
| 9.6 | Lead sem telefone | Importa sem telefone ou skip |
| 9.7 | Double-click em importar | Apenas uma importação |
| 9.8 | Selecionar todos + importar (500+ leads) | Processamento em batch |
| 9.9 | Template com {{variavel}} inexistente | Aviso ou placeholder |

### 10. Responsividade e Acessibilidade
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 10.1 | Prospecting em mobile (375px) | Layout adaptado |
| 10.2 | Prospecting em tablet (768px) | Layout adaptado |
| 10.3 | Prospecting em desktop (1440px) | Layout completo com mapa |
| 10.4 | Mapa com aria-labels | Acessível |
| 10.5 | Navegação por teclado | Focus em resultados |
| 10.6 | Checkboxes acessíveis | Label associado |

### 11. Concorrência e Race Conditions
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 11.1 | Duas buscas simultâneas | Última busca prevalece |
| 11.2 | Importar enquanto outra importação roda | Fila ou bloqueio |
| 11.3 | Pausar campanha durante envio | Envios em andamento completam |
| 11.4 | Double-click em criar campanha | Apenas uma criada |

### 12. Permissões e Segurança
| # | Cenário | Resultado Esperado |
|---|---------|-------------------|
| 12.1 | Viewer pode ver leads | Leitura permitida |
| 12.2 | Viewer tenta importar | Bloqueado |
| 12.3 | Operador pode gerenciar campanhas | Permitido |
| 12.4 | Leads de outro tenant | Nunca visíveis |
| 12.5 | API keys do Google protegidas | Não expostas no frontend |
