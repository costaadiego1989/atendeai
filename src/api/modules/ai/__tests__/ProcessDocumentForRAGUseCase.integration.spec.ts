import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ProcessDocumentForRAGUseCase } from '../application/use-cases/ProcessDocumentForRAGUseCase';
import { EMBEDDING_PROVIDER } from '../application/ports/IEmbeddingProvider';

jest.mock('axios');
jest.mock('pdf-parse', () => jest.fn());

const mockPdfParse = require('pdf-parse') as jest.Mock;

const FAKE_PDF_TEXT = `
  AtendeAi é uma plataforma de atendimento inteligente para pequenas e médias empresas.
  Oferece suporte a WhatsApp, Instagram e múltiplos canais de mensagem.
  Sistema integrado de IA para respostas automáticas e gestão de clientes.
  Funcionalidades incluem agendamento, catálogo de produtos e recuperação de pagamentos.
  Integração com sistemas de billing e controle de estoque em tempo real.
`;

const fakeEmbedding = (dim = 1536) => Array.from({ length: dim }, (_, i) => (i % 10) / 100);

describe('ProcessDocumentForRAGUseCase (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let useCase: ProcessDocumentForRAGUseCase;
  let tenantId: string;
  let documentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue({
        generateEmbedding: jest.fn().mockResolvedValue(fakeEmbedding()),
        generateEmbeddings: jest
          .fn()
          .mockImplementation((texts: string[]) =>
            Promise.resolve(texts.map(() => fakeEmbedding())),
          ),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    useCase = app.get(ProcessDocumentForRAGUseCase);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'RAG Integration Test',
        cnpj: `rg${Date.now()}`.slice(-14),
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO tenant_schema.tenant_pdf_resumes (tenant_id, file_name, status)
      VALUES (${tenantId}::uuid, 'manual.pdf', 'PROCESSING')
      RETURNING id
    `;
    documentId = rows[0].id;
  });

  beforeEach(() => {
    (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from('fake-pdf-bytes') });
    mockPdfParse.mockResolvedValue({ text: FAKE_PDF_TEXT });
  });

  afterAll(async () => {
    await prisma.tenantDocumentChunk.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.$executeRaw`
      DELETE FROM tenant_schema.tenant_pdf_resumes WHERE tenant_id = ${tenantId}::uuid
    `.catch(() => {});
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    await app.close();
  });

  it('saves chunks to DB and sets document status to READY', async () => {
    await useCase.execute({
      tenantId,
      documentId,
      fileUrl: 'https://storage.example.com/manual.pdf',
      fileName: 'manual.pdf',
    });

    const chunkCount = await prisma.tenantDocumentChunk.count({ where: { tenantId } });
    expect(chunkCount).toBeGreaterThan(0);

    const rows = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM tenant_schema.tenant_pdf_resumes WHERE id = ${documentId}::uuid
    `;
    expect(rows[0].status).toBe('READY');
  });

  it('scopes chunks strictly to tenantId — no cross-tenant leakage', async () => {
    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Tenant RAG',
        cnpj: `ot${Date.now()}`.slice(-14),
        plan: 'ESSENCIAL',
      },
    });

    try {
      const ourChunks = await prisma.tenantDocumentChunk.count({ where: { tenantId } });
      const otherChunks = await prisma.tenantDocumentChunk.count({
        where: { tenantId: otherTenant.id },
      });

      expect(ourChunks).toBeGreaterThan(0);
      expect(otherChunks).toBe(0);
    } finally {
      await prisma.tenant.delete({ where: { id: otherTenant.id } }).catch(() => {});
    }
  });

  it('replaces old chunks on reprocessing — count stays the same', async () => {
    const countBefore = await prisma.tenantDocumentChunk.count({ where: { documentId } });
    expect(countBefore).toBeGreaterThan(0);

    await useCase.execute({
      tenantId,
      documentId,
      fileUrl: 'https://storage.example.com/manual.pdf',
      fileName: 'manual.pdf',
    });

    const countAfter = await prisma.tenantDocumentChunk.count({ where: { documentId } });
    expect(countAfter).toBe(countBefore);
  });

  it('sets status to ERROR and saves no chunks when PDF text is empty', async () => {
    mockPdfParse.mockResolvedValue({ text: '' });

    const emptyDocRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO tenant_schema.tenant_pdf_resumes (tenant_id, file_name, status)
      VALUES (${tenantId}::uuid, 'empty.pdf', 'PROCESSING')
      RETURNING id
    `;
    const emptyDocId = emptyDocRows[0].id;

    await useCase.execute({
      tenantId,
      documentId: emptyDocId,
      fileUrl: 'https://storage.example.com/empty.pdf',
      fileName: 'empty.pdf',
    });

    const statusRows = await prisma.$queryRaw<{ status: string; error: string }[]>`
      SELECT status, error FROM tenant_schema.tenant_pdf_resumes WHERE id = ${emptyDocId}::uuid
    `;
    expect(statusRows[0].status).toBe('ERROR');
    expect(statusRows[0].error).toContain('sem texto');

    const emptyChunks = await prisma.tenantDocumentChunk.count({
      where: { documentId: emptyDocId },
    });
    expect(emptyChunks).toBe(0);
  });

  it('sets status to ERROR when download fails and saves no chunks', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const failDocRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO tenant_schema.tenant_pdf_resumes (tenant_id, file_name, status)
      VALUES (${tenantId}::uuid, 'fail.pdf', 'PROCESSING')
      RETURNING id
    `;
    const failDocId = failDocRows[0].id;

    await useCase.execute({
      tenantId,
      documentId: failDocId,
      fileUrl: 'https://storage.example.com/fail.pdf',
      fileName: 'fail.pdf',
    });

    const statusRows = await prisma.$queryRaw<{ status: string }[]>`
      SELECT status FROM tenant_schema.tenant_pdf_resumes WHERE id = ${failDocId}::uuid
    `;
    expect(statusRows[0].status).toBe('ERROR');

    const failChunks = await prisma.tenantDocumentChunk.count({
      where: { documentId: failDocId },
    });
    expect(failChunks).toBe(0);
  });
});
