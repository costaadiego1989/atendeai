# Webhook BubbleWhats — Referência QA

> Documento de referência para testes manuais e validação de contrato dos webhooks de mensagens inbound via BubbleWhats.

**Última atualização:** 2026-05-12

---

## Endpoint

```
POST /api/v1/webhooks/whatsapp
Content-Type: application/json
```

---

## Headers obrigatórios

| Header | Descrição |
|--------|-----------|
| `x-hub-signature` | HMAC-SHA256 do body (JSON stringificado) usando o `webhookSecret` do tenant |

> Se o tenant não tem `webhookSecret` configurado, a validação de assinatura é ignorada (aceita qualquer valor).

### Cálculo da assinatura

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', tenant.webhookSecret)
  .update(JSON.stringify(body))
  .digest('hex');
// Enviar no header: x-hub-signature: sha256=<signature>
```

---

## Formatos de Payload Aceitos

O adapter BubbleWhats reconhece 4 formatos distintos de payload inbound:

### 1. Event Payload (`event: "message.received"`)

```json
{
  "event": "message.received",
  "data": {
    "messageId": "msg-123",
    "from": "5511999990001",
    "to": "5511900001234",
    "deviceId": "bw-device-1",
    "type": "text",
    "content": { "text": "Olá, quero fazer um pedido" },
    "timestamp": "2026-01-01T12:00:00.000Z"
  }
}
```

**Campos obrigatórios:** `event`, `data.messageId`, `data.from`, `data.type`, `data.content`, `data.timestamp`
**Campos opcionais:** `data.to`, `data.deviceId`

### 2. Native Payload (Baileys/WA Web)

```json
{
  "deviceID": "bw-device-1",
  "messages": [
    {
      "key": {
        "remoteJid": "5511999990001@s.whatsapp.net",
        "id": "native-123",
        "fromMe": false
      },
      "message": { "conversation": "Oi, cheguei pelo formato nativo" },
      "messageTimestamp": 1710000000
    }
  ]
}
```

**Campos obrigatórios:** `deviceID`, `messages[].key.remoteJid`, `messages[].key.id`, `messages[].message`
**Nota:** O número é extraído do `remoteJid` (antes do `@`).

### 3. Simple Array Payload

```json
{
  "deviceID": "bw-device-1",
  "toNumber": "5511900001234",
  "messages": [
    {
      "id": "array-123",
      "from": "5511999990001",
      "body": "Mensagem simples"
    }
  ]
}
```

**Campos obrigatórios:** `deviceID`, `messages[].id`, `messages[].from`, `messages[].body`
**Campos opcionais:** `toNumber`

### 4. MessageContext Payload

```json
{
  "id": "ctx-123",
  "deviceID": "bw-device-1",
  "fromNumber": "5511999990001",
  "toNumber": "5511900001234",
  "messageContext": {
    "key": { "fromMe": false },
    "message": {
      "extendedTextMessage": { "text": "Oi, cheguei pelo messageContext" }
    }
  }
}
```

**Campos obrigatórios:** `id`, `deviceID`, `fromNumber`, `messageContext.message`
**Campos opcionais:** `toNumber`

---

## Tipos de mídia suportados

| Tipo | `content` esperado |
|------|-------------------|
| `text` | `{ "text": "..." }` |
| `image` | `{ "url": "https://..." }` |
| `audio` | `{ "url": "https://..." }` |
| `video` | `{ "url": "https://..." }` |
| `document` | `{ "url": "https://..." }` |

---

## Respostas

| HTTP | Body | Significado |
|------|------|-------------|
| `200` | `{ "status": "received" }` | Mensagem processada com sucesso |
| `200` | `{ "status": "ignored" }` | Payload duplicado ou não parseável |
| `401` | `Unauthorized` | Assinatura inválida ou tenant não encontrado |

---

## Idempotência

- Chave de deduplicação: `{provider}:{channel}:{externalMessageId}`
- Entregas duplicadas retornam `{ "status": "ignored" }` sem reprocessar
- Receipts armazenados em `messaging_schema.messaging_webhook_receipts`

---

## Lookup de Tenant

O sistema identifica o tenant pela combinação:
1. `toNumber` — número de destino configurado no tenant
2. `deviceId` / `deviceID` — identificador do dispositivo BubbleWhats vinculado ao tenant

Se nenhum tenant for encontrado, retorna `401 Unauthorized`.

---

## Fluxo completo

```
BubbleWhats → POST /api/v1/webhooks/whatsapp
  → WebhookController (extrai signature + body)
    → ProcessWebhookUseCase
      → BubbleWhatsAdapter.parse(body) → BubbleWhatsInboundData
      → Lookup tenant por toNumber/deviceId
      → Valida HMAC-SHA256
      → Verifica idempotência (messaging_webhook_receipts)
      → ProcessInboundMessageUseCase (persiste conversa + mensagem)
    → Response: { status: "received" | "ignored" }
```

---

## Cenários de teste QA

| # | Cenário | Payload | Resultado esperado |
|---|---------|---------|-------------------|
| 1 | Mensagem texto válida (event format) | Formato 1 com `type: "text"` | `200 { status: "received" }` |
| 2 | Mensagem imagem válida | Formato 1 com `type: "image"` | `200 { status: "received" }` |
| 3 | Formato nativo Baileys | Formato 2 | `200 { status: "received" }` |
| 4 | Formato array simples | Formato 3 | `200 { status: "received" }` |
| 5 | Formato messageContext | Formato 4 | `200 { status: "received" }` |
| 6 | Assinatura inválida | Qualquer formato, header errado | `401 Unauthorized` |
| 7 | Payload duplicado (mesmo messageId) | Reenviar cenário 1 | `200 { status: "ignored" }` |
| 8 | Tenant não encontrado | `toNumber` inexistente | `401 Unauthorized` |
| 9 | Body vazio/malformado | `{}` | `200 { status: "ignored" }` |
| 10 | Sem header de assinatura (tenant sem secret) | Formato 1, sem header | `200 { status: "received" }` |
