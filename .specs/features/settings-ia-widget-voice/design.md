# Design: Settings IA / Widget / Voice

## Architecture Overview

Três controllers novos/atualizados no backend, reusando infraestrutura existente (S3, BullMQ, Prisma).

```
Frontend (App) → API Routes → Controllers → Use Cases → Infrastructure
                                                ↓
                                    S3StorageService (upload)
                                    BullMQ pdf-processing (RAG)
                                    Prisma (CRUD)
```

---

## Feature 1: Documents API (DOC-01, DOC-02)

### Decisão Arquitetural

**Opção A**: Reutilizar `/pdf-resumes` endpoint adicionando aliases.
**Opção B**: Criar `DocumentsController` dedicado em módulo `ai` ou `tenant`.

→ **Escolha: Opção B** — `DocumentsController` no módulo `tenant` (onde TenantPDFResume já vive). O endpoint antigo `/pdf-resumes` continua existindo (retrocompatibilidade interna) mas o novo `/documents` é o canônico.

### Backend — Novos Endpoints

```
POST   /api/v1/tenants/:tenantId/documents   → UploadDocumentUseCase
GET    /api/v1/tenants/:tenantId/documents   → ListDocumentsUseCase (wrapper do existente)
DELETE /api/v1/tenants/:tenantId/documents/:docId → DeleteDocumentUseCase
```

### UploadDocumentUseCase

```
Input: tenantId, file (Buffer), fileName, mimeType, title?
Flow:
  1. Validate mimeType (application/pdf, text/plain)
  2. Compute SHA-256 checksum
  3. Check duplicate (tenantId + checksum) → return existing if found
  4. S3StorageService.upload(buffer, fileName, mimeType, { folder: 'documents/{tenantId}' })
  5. UpsertTenantPDFResumeUseCase.execute({ tenantId, fileName: title || fileName, fileUrl, checksum })
     → já enfileira o job RAG na fila 'pdf-processing'
  6. Return DocumentDTO
Output: DocumentDTO
```

### DeleteDocumentUseCase

```
Input: tenantId, documentId
Flow:
  1. Find TenantPDFResume by (id, tenantId) → 404 se não encontrado
  2. S3StorageService.delete(fileUrl) se fileUrl existe
  3. Delete TenantDocumentChunk[] where documentId (cascata)
  4. Delete TenantPDFResume
Output: void (204)
```

### Document DTO (mapeamento de TenantPDFResume)

```typescript
{
  id: string
  title: string          // fileName field
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED'  // map de TenantPDFResume.status
  chunksCount: number    // count of TenantDocumentChunk[]
  fileUrl: string | null
  createdAt: string
  updatedAt: string
}
```

### Frontend — Remover PDF de Company Settings

- Localizar e remover componente/seção de PDF upload em `src/app/src/modules/settings/` que chama `/pdf-resumes`
- Nenhuma mudança de backend necessária (rota mantida)

---

## Feature 2: Widget Config (WIDGET-01, WIDGET-02, WIDGET-03)

### Schema Change — backgroundColor

Adicionar campo `backgroundColor` em `WidgetConfig`:

```prisma
backgroundColor  String?  @db.VarChar(20)  // background das mensagens
```

Migração: `add_widget_config_background_color`

### Backend — Novos Endpoints

Criar `WidgetConfigController` no módulo `messaging`:

```
GET  /api/v1/tenants/:tenantId/widget-config         → GetWidgetConfigUseCase
PUT  /api/v1/tenants/:tenantId/widget-config         → UpdateWidgetConfigUseCase
POST /api/v1/tenants/:tenantId/widget-config/avatar  → UploadWidgetAvatarUseCase
```

### GetWidgetConfigUseCase

```
Input: tenantId
Flow:
  1. findUnique WidgetConfig where tenantId
  2. If null → create with defaults (upsert)
  3. Return WidgetConfigDTO
```

### UpdateWidgetConfigUseCase

```
Input: tenantId, UpdateWidgetConfigDTO { name?, greeting?, color?, backgroundColor?, position?, collectName?, collectPhone?, proactiveDelay?, proactiveMsg?, enabled? }
Flow:
  1. upsert WidgetConfig (create if not exists)
  2. updatedAt = now()
  3. Return updated WidgetConfigDTO
```

### UploadWidgetAvatarUseCase

```
Input: tenantId, file (Buffer), mimeType
Flow:
  1. Validate mimeType in [image/jpeg, image/png, image/gif, image/webp]
  2. S3StorageService.upload(buffer, 'avatar.{ext}', mimeType, { folder: 'widget-avatars/{tenantId}', isPublic: true })
  3. Update WidgetConfig.avatarUrl = url
  4. Return { avatarUrl }
```

### WidgetConfigDTO

```typescript
{
  id: string
  tenantId: string
  publicToken: string    // necessário para gerar embed snippet
  enabled: boolean
  name: string
  greeting: string | null
  color: string
  backgroundColor: string | null   // novo campo
  position: 'bottom-right' | 'bottom-left'
  avatarUrl: string | null
  collectName: boolean
  collectPhone: boolean
  proactiveDelay: number | null
  proactiveMsg: string | null
  createdAt: string
  updatedAt: string
}
```

### Embed Snippet

O embed snippet é gerado no frontend usando o `publicToken` retornado pela API:

```html
<script>
  (function(w,d,s,t){
    w.AtendeAiConfig = { token: 't' };
    var e = d.createElement(s);
    e.async = true;
    e.src = 'https://app.atende-ai.tech/widget.js';
    d.head.appendChild(e);
  })(window, document, 'script', '{{publicToken}}');
</script>
```

O `WidgetEmbedSnippet.tsx` já existe — verificar se usa o `publicToken` correto da API.

### Playwright Test Strategy (WIDGET-03)

```
Test file: src/app/e2e/widget-embed.spec.ts
Flow:
  1. Criar tenant + widget config via API seed
  2. Playwright abre página HTML simples com embed script injetado
  3. Assert: widget iframe/div renderiza
  4. Assert: GET /widget/{publicToken}/config retorna 200
  5. Playwright preenche nome/telefone no widget
  6. Assert: POST /widget/{publicToken}/sessions retorna sessionId
  7. Playwright digita mensagem e envia
  8. Assert: POST /widget/{publicToken}/messages retorna 200
  9. Assert: mensagem aparece na UI do widget
```

---

## Feature 3: Voice Config (VOICE-01, VOICE-02)

### Backend — Novos Endpoints

Criar `VoiceConfigController` no módulo `voice`:

```
GET /api/v1/tenants/:tenantId/voice/config      → GetVoiceConfigUseCase
PUT /api/v1/tenants/:tenantId/voice/config      → UpdateVoiceConfigUseCase
GET /api/v1/tenants/:tenantId/voice/calls       → ListVoiceCallsUseCase
```

**Nota**: Separar do `VoiceWebhookController` (public, sem auth). O novo controller tem `JwtCookieGuard + RolesGuard + TenantGuard`.

### GetVoiceConfigUseCase

```
Input: tenantId
Flow:
  1. findUnique VoiceAgentConfig where tenantId
  2. If null → create with defaults (upsert)
  3. Return VoiceConfigDTO
```

### UpdateVoiceConfigUseCase

```
Input: tenantId, UpdateVoiceConfigDTO { enabled?, voiceId?, language?, maxDiscount?, maxInstallments?, minInstallmentValue?, callWindowStart?, callWindowEnd?, blockedDays?, greeting?, transferPhone? }
Flow:
  1. upsert VoiceAgentConfig
  2. Return updated VoiceConfigDTO
```

### ListVoiceCallsUseCase

```
Input: tenantId, page, limit, status?, period?
Flow:
  1. Query VoiceCall where tenantId (with filters)
  2. Return paginated { data: VoiceCallDTO[], total, page, limit }
Note: VoiceCall table must exist in schema — verify before implementing
```

### VoiceConfigDTO

```typescript
{
  id: string
  tenantId: string
  enabled: boolean
  voiceId: string
  language: string
  maxDiscount: number
  maxInstallments: number
  minInstallmentValue: number
  callWindowStart: string   // "09:00"
  callWindowEnd: string     // "18:00"
  blockedDays: string[]
  greeting: string | null
  transferPhone: string | null
  createdAt: string
  updatedAt: string
}
```

---

## Feature 4: Skeleton Loading (UX-01)

### Padrão existente

Verificar o padrão em `AISettingsPage.tsx` ou outra página de settings que já está correta. Replicar o mesmo componente Skeleton nas páginas:
- `VoiceSettingsPage.tsx`
- `WidgetSettingsPage.tsx`

---

## Module Registration

### tenant.module.ts
- Adicionar: `DocumentsController`, `UploadDocumentUseCase`, `DeleteDocumentUseCase`
- Adicionar: `FILE_STORAGE_SERVICE` injection (já deve existir no módulo)

### messaging.module.ts
- Adicionar: `WidgetConfigController`, `GetWidgetConfigUseCase`, `UpdateWidgetConfigUseCase`, `UploadWidgetAvatarUseCase`

### voice.module.ts
- Adicionar: `VoiceConfigController`, `GetVoiceConfigUseCase`, `UpdateVoiceConfigUseCase`, `ListVoiceCallsUseCase`

---

## Test Strategy

| Scope | Type | Tool | Count |
|---|---|---|---|
| DocumentsController | Integration (e2e) | Jest supertest | 5 |
| WidgetConfigController | Integration (e2e) | Jest supertest | 6 |
| VoiceConfigController | Integration (e2e) | Jest supertest | 4 |
| Widget embed | E2E browser | Playwright | 3 |

TDD: escrever testes de integração ANTES da implementação dos controllers.
