# Settings: Knowledge Base, Widget Config & Voice Config — Specification

## Problem Statement

Três áreas de configuração no painel de IA estão quebradas ou incompletas:

1. **Knowledge Base (Documentos)**: O frontend chama `POST /tenants/{id}/documents` que retorna 404. O backend tem a lógica de RAG em `/pdf-resumes` mas com rota errada, sem upload de arquivo, sem DELETE. A UI de upload de PDF duplicada em company settings deve ser removida.
2. **Widget Config**: O frontend chama `GET/PUT /tenants/{id}/widget-config` que não existe. A tabela `WidgetConfig` existe no Prisma mas nenhum controller autenticado foi criado. O embed não pode ser testado porque a configuração não salva. Falta campo de cor do background das mensagens e upload de avatar.
3. **Voice Settings**: O frontend chama `GET/PUT /tenants/{id}/voice/config` e `GET /tenants/{id}/voice/calls` — nenhuma rota existe. A página de voice está completamente não-funcional. Skeleton loading nas páginas novas difere do padrão.

## Goals

- [ ] `POST /tenants/{id}/documents` aceita multipart, faz upload S3 → TenantPDFResume → queue RAG
- [ ] `GET /tenants/{id}/documents` e `DELETE /tenants/{id}/documents/{docId}` funcionam
- [ ] PDF upload removido de company settings (contexto diferente)
- [ ] `GET/PUT /tenants/{id}/widget-config` salva e retorna widget config corretamente
- [ ] Widget config inclui `backgroundColor` (novo campo) e upload de avatar via S3
- [ ] Embed snippet gerado corretamente e comunicação widget↔backend verificada por Playwright
- [ ] `GET/PUT /tenants/{id}/voice/config` salva configuração de voice agent
- [ ] `GET /tenants/{id}/voice/calls` retorna histórico paginado
- [ ] Skeleton loading padronizado nas páginas novas

## Out of Scope

| Feature | Reason |
|---|---|
| Voice calls `POST /voice/calls` (iniciar chamada manual) | Fora do escopo MVP desta issue |
| Voice metrics endpoint | Sem dados suficientes para implementar agora |
| Notion/Google Drive ingestion UI | Já existe no backend, não foi pedido na issue |
| Widget multi-language | Não solicitado |
| Widget analytics/tracking | Não solicitado |

---

## User Stories

### P1: [DOC-01] Documentos da Base de Conhecimento (Backend + Frontend) ⭐ MVP

**User Story**: Como admin do tenant, quero fazer upload de PDFs na seção "Base de Conhecimento" em Settings → IA para que o agente de IA use esse conteúdo como contexto.

**Why P1**: A feature está 404ing — quebrada completamente.

**Acceptance Criteria**:

1. WHEN admin faz POST `/tenants/{id}/documents` com FormData (file + title) THEN sistema SHALL fazer upload para S3, criar TenantPDFResume com status PROCESSING, enfileirar job RAG e retornar 201 com `{id, title, status: "PROCESSING", chunksCount: 0}`
2. WHEN admin faz GET `/tenants/{id}/documents` THEN sistema SHALL retornar lista de TenantPDFResume mapeados para Document DTO `{id, title, status, chunksCount, fileUrl, createdAt}`
3. WHEN admin faz DELETE `/tenants/{id}/documents/{docId}` THEN sistema SHALL deletar arquivo do S3, deletar chunks, deletar registro e retornar 204
4. WHEN arquivo não é PDF THEN sistema SHALL retornar 422 com mensagem de validação
5. WHEN documento está sendo processado THEN sistema SHALL retornar status "PROCESSING" e chunksCount = 0

**Independent Test**: Upload PDF → lista mostra status PROCESSING → após processamento mostra chunksCount > 0.

---

### P1: [DOC-02] Remover PDF duplicado de Company Settings ⭐ MVP

**User Story**: Como dev, quero remover o upload de PDF da seção de Company Settings para eliminar a duplicação com Knowledge Base.

**Acceptance Criteria**:

1. WHEN admin acessa settings/company THEN sistema SHALL não exibir mais a seção de upload de PDF
2. WHEN endpoint `/tenants/{id}/pdf-resumes` existente for chamado THEN sistema SHALL continuar funcionando (sem breaking change — mantém para retrocompatibilidade)

**Independent Test**: Navegar para settings/company e confirmar ausência da seção PDF.

---

### P1: [WIDGET-01] Widget Config — Salvar e Carregar ⭐ MVP

**User Story**: Como admin, quero configurar o widget de chat (nome, cor, posição, saudação) e salvar via `/tenants/{id}/widget-config`.

**Acceptance Criteria**:

1. WHEN admin faz GET `/tenants/{id}/widget-config` THEN sistema SHALL retornar config atual com todos os campos incluindo `publicToken`
2. WHEN admin faz PUT `/tenants/{id}/widget-config` com campos válidos THEN sistema SHALL salvar via upsert e retornar config atualizada
3. WHEN config não existe THEN GET SHALL criar config padrão automaticamente (upsert)
4. WHEN admin atualiza `color` THEN widget preview SHALL refletir nova cor
5. WHEN admin atualiza `backgroundColor` THEN sistema SHALL persistir o campo (novo campo no schema)

**Independent Test**: PUT config → GET config → campos retornam iguais.

---

### P1: [WIDGET-02] Upload de Avatar do Widget ⭐ MVP

**User Story**: Como admin, quero fazer upload de uma imagem para o avatar do widget.

**Acceptance Criteria**:

1. WHEN admin faz POST `/tenants/{id}/widget-config/avatar` com imagem THEN sistema SHALL fazer upload S3, salvar URL em `avatarUrl` e retornar URL
2. WHEN arquivo não é imagem (jpg/png/gif/webp) THEN sistema SHALL retornar 422
3. WHEN avatar é salvo THEN widget preview SHALL exibir imagem

**Independent Test**: Upload imagem → GET config → `avatarUrl` preenchida.

---

### P1: [WIDGET-03] Embed e Comunicação do Widget (Playwright) ⭐ MVP

**User Story**: Como dev, quero verificar que o embed script gerado funciona corretamente em uma página e estabelece comunicação com o backend.

**Acceptance Criteria**:

1. WHEN admin visualiza embed snippet THEN sistema SHALL gerar código JavaScript correto com `publicToken`
2. WHEN embed script carrega numa página THEN SHALL fazer GET `/widget/{publicToken}/config` e renderizar widget
3. WHEN visitante envia mensagem no widget THEN SHALL criar sessão e entregar mensagem
4. WHEN Playwright test roda THEN SHALL verificar: widget renderiza, sessão cria, mensagem é enviada e recebida

**Independent Test**: Playwright abre página com embed → widget aparece → envia mensagem → response recebida.

---

### P1: [VOICE-01] Voice Config — Salvar e Carregar ⭐ MVP

**User Story**: Como admin, quero configurar o agente de voz (habilitado, voiceId, janela de chamadas, saudação) em Settings → Voice.

**Acceptance Criteria**:

1. WHEN admin faz GET `/tenants/{id}/voice/config` THEN sistema SHALL retornar VoiceAgentConfig atual (criando padrão se não existir)
2. WHEN admin faz PUT `/tenants/{id}/voice/config` THEN sistema SHALL salvar via upsert e retornar config atualizada
3. WHEN voice está disabled THEN UI SHALL mostrar estado desabilitado claramente

**Independent Test**: PUT voice config → GET config → campos persistem.

---

### P2: [VOICE-02] Histórico de Chamadas

**User Story**: Como admin, quero ver o histórico de chamadas do agente de voz.

**Acceptance Criteria**:

1. WHEN admin faz GET `/tenants/{id}/voice/calls?page=1&limit=20` THEN sistema SHALL retornar lista paginada de VoiceCall com `{id, contactId, status, duration, outcome, createdAt}`
2. WHEN não há chamadas THEN sistema SHALL retornar lista vazia (não 404)

**Independent Test**: GET calls → retorna array (vazio ou com itens).

---

### P2: [UX-01] Skeleton Loading Padronizado

**User Story**: Como usuário, quero ver skeleton loading consistente com o resto do app nas páginas de Voice e Widget settings.

**Acceptance Criteria**:

1. WHEN página Voice ou Widget carrega THEN skeleton SHALL usar o mesmo componente/padrão das outras páginas de settings
2. WHEN dados carregam THEN skeleton desaparece e conteúdo exibe corretamente

**Independent Test**: Comparar skeleton de Voice/Widget com AISettingsPage — mesmo padrão visual.

---

## Edge Cases

- WHEN tenant não tem WidgetConfig THEN GET SHALL criar uma com defaults e retornar (upsert)
- WHEN tenant não tem VoiceAgentConfig THEN GET SHALL criar uma com defaults e retornar (upsert)
- WHEN arquivo PDF excede 10MB THEN sistema SHALL retornar 413
- WHEN documento já existe (mesmo checksum) THEN sistema SHALL retornar o existente sem duplicar
- WHEN `publicToken` não existe em widget embed THEN widget SHALL falhar graciosamente (sem JS error)
- WHEN voice calls list está vazia THEN GET SHALL retornar `{ data: [], total: 0, page: 1 }`

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| DOC-01 | P1: Knowledge Base Upload | Design | Pending |
| DOC-02 | P1: Remove PDF from Company | Design | Pending |
| WIDGET-01 | P1: Widget Config CRUD | Design | Pending |
| WIDGET-02 | P1: Avatar Upload | Design | Pending |
| WIDGET-03 | P1: Embed + Playwright | Design | Pending |
| VOICE-01 | P1: Voice Config CRUD | Design | Pending |
| VOICE-02 | P2: Voice Calls List | Design | Pending |
| UX-01 | P2: Skeleton Standardized | Design | Pending |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped ⚠️

---

## Success Criteria

- [ ] `POST /tenants/{id}/documents` retorna 201 com documento criado (não 404)
- [ ] `GET/PUT /tenants/{id}/widget-config` salva e retorna dados corretamente
- [ ] `GET/PUT /tenants/{id}/voice/config` salva e retorna dados corretamente
- [ ] Playwright test: widget embed carrega em página e envia mensagem com sucesso
- [ ] Zero erros TypeScript (npm run build passa)
- [ ] Testes de integração passam para todos os 3 módulos
