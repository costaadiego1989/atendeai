import { execSync } from 'child_process';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const PSQL = '"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5433 -U atendeai -d atendeai';
const ENV = { ...process.env, PGPASSWORD: 'atendeai_dev', PGCLIENTENCODING: 'UTF8' };

export interface SeedConversation {
  contactName: string;
  contactPhone: string;
  channel?: 'WHATSAPP' | 'INSTAGRAM';
  status?: 'ACTIVE' | 'PENDING_HUMAN' | 'PENDING_AI' | 'ARCHIVED';
  unreadCount?: number;
  lastMessagePreview?: string;
}

export interface SeedMessage {
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  contentType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';
  content: string;
  sentBy: 'USER' | 'CONTACT' | 'AI';
  deliveryStatus?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
}

function runSQL(sql: string): string {
  try {
    return execSync(`${PSQL} -c "${sql.replace(/"/g, '\\"')}"`, {
      env: ENV,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (e) {
    console.error('SQL Error:', (e as Error).message);
    return '';
  }
}

/**
 * Seed a contact in contact_schema (if not exists) and return its ID.
 */
export function seedMessagingContact(name: string, phone: string): string {
  const contactId = crypto.randomUUID();
  const fullPhone = phone.replace(/\D/g, '').startsWith('55')
    ? phone.replace(/\D/g, '')
    : `55${phone.replace(/\D/g, '')}`;

  const sql = `INSERT INTO contact_schema.contacts (id, tenant_id, name, phone, document, stage, tags, created_at, updated_at) VALUES ('${contactId}', '${TENANT_ID}', '${name.replace(/'/g, "''")}', '${fullPhone}', '', 'LEAD', '[]'::jsonb, NOW(), NOW()) ON CONFLICT (tenant_id, phone) DO UPDATE SET name = EXCLUDED.name RETURNING id;`;

  const result = runSQL(sql);
  // Parse the returned ID from psql output
  const match = result.match(/([0-9a-f-]{36})/);
  return match ? match[1] : contactId;
}

/**
 * Seed a conversation directly into the database.
 * Returns the conversation ID.
 */
export function seedConversation(data: SeedConversation): string {
  const contactId = seedMessagingContact(data.contactName, data.contactPhone);
  const conversationId = crypto.randomUUID();
  const channel = data.channel || 'WHATSAPP';
  const status = data.status || 'ACTIVE';
  const unread = data.unreadCount ?? 1;
  const preview = (data.lastMessagePreview || 'Olá, tudo bem?').replace(/'/g, "''");

  const sql = `INSERT INTO messaging_schema.conversations (id, tenant_id, contact_id, channel, status, unread_count, last_message_preview, last_message_at, last_inbound_at, started_at, updated_at) VALUES ('${conversationId}', '${TENANT_ID}', '${contactId}', '${channel}', '${status}', ${unread}, '${preview}', NOW(), NOW(), NOW(), NOW()) ON CONFLICT DO NOTHING;`;

  runSQL(sql);
  return conversationId;
}

/**
 * Seed a message into a conversation.
 * Returns the message ID.
 */
export function seedMessage(data: SeedMessage): string {
  const messageId = crypto.randomUUID();
  const contentType = data.contentType || 'TEXT';
  const deliveryStatus = data.deliveryStatus || 'DELIVERED';
  const contentJson = JSON.stringify({ text: data.content }).replace(/'/g, "''");

  const sql = `INSERT INTO messaging_schema.messages (id, conversation_id, direction, content_type, content, sent_by, delivery_status, sort_order, created_at) VALUES ('${messageId}', '${data.conversationId}', '${data.direction}', '${contentType}', '${contentJson}'::jsonb, '${data.sentBy}', '${deliveryStatus}', EXTRACT(EPOCH FROM NOW())::bigint * 1000, NOW());`;

  runSQL(sql);
  return messageId;
}

/**
 * Seed a full conversation with messages for testing.
 * Returns { conversationId, contactId }.
 */
export function seedConversationWithMessages(
  contactName: string,
  contactPhone: string,
  messages: Array<{ text: string; direction: 'INBOUND' | 'OUTBOUND'; sentBy: 'USER' | 'CONTACT' | 'AI' }>,
  options?: { channel?: 'WHATSAPP' | 'INSTAGRAM'; status?: string },
): { conversationId: string } {
  const conversationId = seedConversation({
    contactName,
    contactPhone,
    channel: (options?.channel as 'WHATSAPP' | 'INSTAGRAM') || 'WHATSAPP',
    status: (options?.status as SeedConversation['status']) || 'ACTIVE',
    lastMessagePreview: messages[messages.length - 1]?.text || '',
  });

  for (const msg of messages) {
    seedMessage({
      conversationId,
      direction: msg.direction,
      content: msg.text,
      sentBy: msg.sentBy,
    });
  }

  return { conversationId };
}

/**
 * Delete a conversation and its messages from the database.
 */
export function deleteConversation(conversationId: string): void {
  runSQL(`DELETE FROM messaging_schema.messages WHERE conversation_id = '${conversationId}';`);
  runSQL(`DELETE FROM messaging_schema.conversations WHERE id = '${conversationId}';`);
}

/**
 * Clean up all E2E test conversations (by contact name pattern).
 */
export function cleanupE2EConversations(): void {
  runSQL(`DELETE FROM messaging_schema.messages WHERE conversation_id IN (SELECT c.id FROM messaging_schema.conversations c JOIN contact_schema.contacts ct ON c.contact_id = ct.id WHERE ct.name LIKE '%E2E%' AND c.tenant_id = '${TENANT_ID}');`);
  runSQL(`DELETE FROM messaging_schema.conversations WHERE contact_id IN (SELECT id FROM contact_schema.contacts WHERE name LIKE '%E2E%' AND tenant_id = '${TENANT_ID}');`);
}

/**
 * Generate a unique phone number for messaging tests.
 */
export function uniqueMessagingPhone(): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `219${ts}${rand}`.slice(0, 11);
}

// ─── Agent Rules Seed ─────────────────────────────────────────────────────────

/**
 * Seed an agent rule for a specific module.
 * Returns the rule ID.
 */
export function seedAgentRule(
  moduleId: string,
  customPrompt: string,
  options?: { isActive?: boolean; fallbackToGlobal?: boolean },
): string {
  const ruleId = crypto.randomUUID();
  const isActive = options?.isActive ?? true;
  const fallbackToGlobal = options?.fallbackToGlobal ?? true;
  const prompt = customPrompt.replace(/'/g, "''");

  const sql = `INSERT INTO tenant_schema.tenant_agent_rules (id, tenant_id, module_id, custom_prompt, is_active, fallback_to_global, revision, created_at, updated_at) VALUES ('${ruleId}', '${TENANT_ID}', '${moduleId}', '${prompt}', ${isActive}, ${fallbackToGlobal}, 1, NOW(), NOW()) ON CONFLICT (tenant_id, module_id) DO UPDATE SET custom_prompt = EXCLUDED.custom_prompt, is_active = EXCLUDED.is_active, fallback_to_global = EXCLUDED.fallback_to_global, revision = tenant_schema.tenant_agent_rules.revision + 1, updated_at = NOW() RETURNING id;`;

  const result = runSQL(sql);
  const match = result.match(/([0-9a-f-]{36})/);
  return match ? match[1] : ruleId;
}

/**
 * Delete agent rule for a module.
 */
export function deleteAgentRule(moduleId: string): void {
  runSQL(`DELETE FROM tenant_schema.tenant_agent_rules WHERE tenant_id = '${TENANT_ID}' AND module_id = '${moduleId}';`);
}

/**
 * Clean up all E2E agent rules.
 */
export function cleanupE2EAgentRules(): void {
  runSQL(`DELETE FROM tenant_schema.tenant_agent_rules WHERE tenant_id = '${TENANT_ID}' AND custom_prompt LIKE '%E2E%';`);
}

// ─── Billing / Usage Seed ─────────────────────────────────────────────────────

/**
 * Seed a subscription for the test tenant.
 * Returns the subscription ID.
 */
export function seedSubscription(
  plan: 'TRIAL' | 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA',
  options?: { isActive?: boolean },
): string {
  const subId = crypto.randomUUID();
  const isActive = options?.isActive ?? true;
  const cycleStart = new Date();
  cycleStart.setDate(1);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  const sql = `INSERT INTO billing_schema.subscriptions (id, tenant_id, plan, status, billing_cycle_start, billing_cycle_end, created_at, updated_at) VALUES ('${subId}', '${TENANT_ID}', '${plan}', '${isActive ? 'ACTIVE' : 'CANCELLED'}', '${cycleStart.toISOString()}', '${cycleEnd.toISOString()}', NOW(), NOW()) ON CONFLICT (tenant_id) DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status, billing_cycle_start = EXCLUDED.billing_cycle_start, billing_cycle_end = EXCLUDED.billing_cycle_end, updated_at = NOW() RETURNING id;`;

  const result = runSQL(sql);
  const match = result.match(/([0-9a-f-]{36})/);
  return match ? match[1] : subId;
}

/**
 * Seed usage record to simulate token consumption.
 * Set aiTokensUsed to a value near or exceeding the plan quota to test limits.
 */
export function seedUsageRecord(aiTokensUsed: number): string {
  const usageId = crypto.randomUUID();
  const cycleStart = new Date();
  cycleStart.setDate(1);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  const sql = `INSERT INTO billing_schema.usage_records (id, tenant_id, ai_tokens_used, messages_used, contacts_used, billing_cycle_start, billing_cycle_end, created_at, updated_at) VALUES ('${usageId}', '${TENANT_ID}', ${aiTokensUsed}, 0, 0, '${cycleStart.toISOString()}', '${cycleEnd.toISOString()}', NOW(), NOW()) ON CONFLICT (tenant_id, billing_cycle_start) DO UPDATE SET ai_tokens_used = EXCLUDED.ai_tokens_used, updated_at = NOW() RETURNING id;`;

  const result = runSQL(sql);
  const match = result.match(/([0-9a-f-]{36})/);
  return match ? match[1] : usageId;
}

/**
 * Reset usage record to zero tokens.
 */
export function resetUsageRecord(): void {
  const cycleStart = new Date();
  cycleStart.setDate(1);
  runSQL(`UPDATE billing_schema.usage_records SET ai_tokens_used = 0, updated_at = NOW() WHERE tenant_id = '${TENANT_ID}' AND billing_cycle_start = '${cycleStart.toISOString()}';`);
}

// ─── Sale Attribution Seed ────────────────────────────────────────────────────

/**
 * Seed a sale attribution event for a conversation.
 */
export function seedSaleAttribution(
  conversationId: string,
  options?: {
    lifecycleStatus?: 'ACTIVE' | 'VOIDED';
    aiValidationStatus?: 'PENDING' | 'APPROVED';
    saleAmount?: number;
  },
): string {
  const saleId = crypto.randomUUID();
  const userId = 'a0000000-0000-0000-0000-000000000099'; // test user
  const lifecycle = options?.lifecycleStatus ?? 'ACTIVE';
  const validation = options?.aiValidationStatus ?? 'APPROVED';
  const amount = options?.saleAmount ?? 100.00;

  const sql = `INSERT INTO sales_schema.conversation_sale_events (id, tenant_id, conversation_id, attributed_user_id, sale_amount, currency, lifecycle_status, ai_validation_status, marked_by_user_id, marked_at, metadata, created_at, updated_at) VALUES ('${saleId}', '${TENANT_ID}', '${conversationId}', '${userId}', ${amount}, 'BRL', '${lifecycle}', '${validation}', '${userId}', NOW(), '{}'::jsonb, NOW(), NOW());`;

  runSQL(sql);
  return saleId;
}

/**
 * Delete sale attribution for a conversation.
 */
export function deleteSaleAttribution(conversationId: string): void {
  runSQL(`DELETE FROM sales_schema.conversation_sale_events WHERE conversation_id = '${conversationId}' AND tenant_id = '${TENANT_ID}';`);
}
