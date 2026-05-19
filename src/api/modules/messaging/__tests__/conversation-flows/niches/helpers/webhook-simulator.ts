/**
 * Webhook Simulator
 *
 * Simula inbound messages via HTTP POST no endpoint de webhook,
 * usando o formato Twilio ou BubbleWhats dependendo do provider configurado.
 */

import { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

const request = require('supertest');

export interface SendInboundOptions {
  app: INestApplication;
  prisma: PrismaService;
  tenantId: string;
  phone: string;
  text: string;
  externalId: string;
}

export async function sendInboundMessage(
  options: SendInboundOptions,
): Promise<void> {
  const { app, prisma, tenantId, phone, text, externalId } = options;

  const config = await prisma.whatsAppConfig.findUnique({
    where: { tenantId },
  });

  if (!config) {
    throw new Error(`WhatsApp config not found for tenant ${tenantId}`);
  }

  if (config.provider === 'TWILIO') {
    const messageSid = `SM${crypto
      .createHash('sha1')
      .update(externalId)
      .digest('hex')}`;
    const requestUrl = 'https://atendeai-e2e.test/api/v1/webhooks/whatsapp';
    const body = {
      MessageSid: messageSid,
      SmsMessageSid: messageSid,
      WaId: phone,
      From: `whatsapp:+${phone}`,
      To: `whatsapp:+${config.whatsappNumber.replace(/\D/g, '')}`,
      Body: text,
      NumMedia: '0',
    };
    const signature = makeTwilioSignature(
      requestUrl,
      body,
      readAuthToken(config.credentials),
    );

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp')
      .set('x-forwarded-proto', 'https')
      .set('x-forwarded-host', 'atendeai-e2e.test')
      .set('x-twilio-signature', signature)
      .type('form')
      .send(body)
      .expect(200);

    return;
  }

  // BubbleWhats format (default)
  await request(app.getHttpServer())
    .post('/api/v1/webhooks/whatsapp')
    .send({
      id: externalId,
      fromNumber: phone,
      toNumber: config.whatsappNumber,
      body: text,
      messageContext: {
        key: {
          fromMe: false,
          id: externalId,
        },
        message: {
          extendedTextMessage: {
            text,
          },
        },
      },
    })
    .expect(200);
}

/**
 * Envia múltiplas mensagens sequenciais simulando uma conversa.
 * Aguarda a resposta da IA entre cada turno.
 */
export async function sendConversationTurns(options: {
  app: INestApplication;
  prisma: PrismaService;
  tenantId: string;
  phone: string;
  turns: string[];
  baseExternalId: string;
}): Promise<void> {
  const { app, prisma, tenantId, phone, turns, baseExternalId } = options;

  for (const [index, turn] of turns.entries()) {
    await sendInboundMessage({
      app,
      prisma,
      tenantId,
      phone,
      text: turn,
      externalId: `${baseExternalId}-${index}`,
    });

    // Aguarda a conversa ser criada e a IA responder
    const persisted = await waitForConversation(prisma, tenantId, phone);
    if (!persisted) {
      throw new Error(
        `Conversation not created after turn ${index}: "${turn}"`,
      );
    }

    await waitForAIResponse(prisma, persisted.conversationId, index + 1);
  }
}

export async function waitForConversation(
  prisma: PrismaService,
  tenantId: string,
  phone: string,
): Promise<{ contactId: string; conversationId: string } | null> {
  for (let i = 0; i < 30; i++) {
    const contact = await prisma.contact.findFirst({
      where: { tenantId, phone },
    });

    if (contact) {
      const conversation = await prisma.conversation.findFirst({
        where: { tenantId, contactId: contact.id },
        orderBy: { updatedAt: 'desc' },
      });

      if (conversation) {
        return { contactId: contact.id, conversationId: conversation.id };
      }
    }

    await sleep(500);
  }

  return null;
}

export async function waitForAIResponse(
  prisma: PrismaService,
  conversationId: string,
  expectedCount: number,
): Promise<any[] | null> {
  for (let i = 0; i < 60; i++) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const aiMessages = messages.filter(
      (m) => m.direction === 'OUTBOUND' && m.sentBy === 'AI',
    );

    if (aiMessages.length >= expectedCount) {
      return messages;
    }

    await sleep(500);
  }

  return null;
}

export function getOutboundAIText(messages: any[]): string {
  return messages
    .filter((m) => m.direction === 'OUTBOUND' && m.sentBy === 'AI')
    .map((m) => readMessageText(m.content))
    .join('\n');
}

export function makePhone(nicheKey: string, scenarioKey: string): string {
  const hash = crypto
    .createHash('sha1')
    .update(`${nicheKey}-${scenarioKey}-${Date.now()}`)
    .digest('hex')
    .replace(/\D/g, '')
    .padEnd(10, '0')
    .slice(0, 10);

  return `5511${hash.slice(0, 9)}`;
}

function makeTwilioSignature(
  requestUrl: string,
  body: Record<string, string>,
  authToken: string,
): string {
  const payload = Object.keys(body)
    .sort()
    .reduce((acc, key) => `${acc}${key}${body[key]}`, requestUrl);

  return crypto.createHmac('sha1', authToken).update(payload).digest('base64');
}

function readAuthToken(credentials: Prisma.JsonValue): string {
  const value = credentials as Record<string, string>;
  const token = value?.authToken || process.env.TWILIO_AUTH_TOKEN;

  if (!token) {
    throw new Error(
      'Twilio authToken is required to sign live webhook input.',
    );
  }

  return token;
}

function readMessageText(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }
  const text = (content as { text?: unknown }).text;
  return typeof text === 'string' ? text : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
