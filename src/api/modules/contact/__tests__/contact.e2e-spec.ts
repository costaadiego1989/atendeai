import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { randomUUID } from 'crypto';
import { ICreateTenantUseCase } from '@modules/tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import {
  IDENTIFY_CONTACT_USE_CASE,
  IIdentifyContactUseCase,
} from '../application/use-cases/interfaces/IIdentifyContactUseCase';
import { IChangeContactStageUseCase } from '../application/use-cases/interfaces/IChangeContactStageUseCase';

describe('ContactModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identifyContact: IIdentifyContactUseCase;
  let changeStage: IChangeContactStageUseCase;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    identifyContact = app.get<IIdentifyContactUseCase>(
      IDENTIFY_CONTACT_USE_CASE,
    );
    changeStage = app.get<IChangeContactStageUseCase>(
      IChangeContactStageUseCase,
    );

    const createTenant = app.get<ICreateTenantUseCase>(ICreateTenantUseCase);
    const tenant = await createTenant.execute({
      companyName: 'Contact Test Store',
      cnpj: '11.222.333/0001-81',
      ownerName: 'Contact Test Owner',
      ownerEmail: 'contact-test@test.com',
      ownerPhone: '11966665555',
      ownerPassword: 'SenhaForte123!',
      plan: 'ESSENCIAL',
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.contact.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  describe('Cenário 1: Identificação Automática de Contato', () => {
    const phone = '5511999998888';

    it('deve criar um novo contato quando ele não existe (stage = LEAD)', async () => {
      const result = await identifyContact.execute({
        tenantId,
        phone,
        name: 'Novo Lead',
      });

      expect(result.id).toBeDefined();
      expect(result.phone).toBe(phone);
      expect(result.stage).toBe('LEAD');

      const contact = await prisma.contact.findUnique({
        where: { tenantId_id: { tenantId, id: result.id } },
      });
      expect(contact).toBeDefined();
      expect(contact?.name).toBe('Novo Lead');
    });

    it('deve atualizar lastInteraction quando o contato já existe', async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await identifyContact.execute({
        tenantId,
        phone,
        name: 'Novo Lead Alterado',
      });

      expect(result.lastInteraction).toBeDefined();

      const contact = await prisma.contact.findUnique({
        where: { tenantId_id: { tenantId, id: result.id } },
      });
      expect(contact?.lastInteraction).toBeDefined();
      expect(contact?.name).toBe('Novo Lead');
    });
  });

  describe('Cenário 2: Evolução no Funil de Vendas (CRM)', () => {
    it('deve permitir mudar o estágio do contato (ex: OPPORTUNITY)', async () => {
      const contact = await identifyContact.execute({
        tenantId,
        phone: '5511988887777',
        name: 'Lead para Evolução',
      });

      const result = await changeStage.execute({
        tenantId,
        contactId: contact.id,
        newStage: 'OPPORTUNITY',
      });

      expect(result.stage).toBe('OPPORTUNITY');
      expect(result.previousStage).toBe('LEAD');

      const updatedContact = await prisma.contact.findUnique({
        where: { tenantId_id: { tenantId, id: contact.id } },
      });
      expect(updatedContact?.stage).toBe('OPPORTUNITY');
    });

    it('deve retornar erro ao tentar usar um estágio inexistente', async () => {
      const contact = await identifyContact.execute({
        tenantId,
        phone: '5511977776666',
        name: 'Lead Erro',
      });

      await expect(
        changeStage.execute({
          tenantId,
          contactId: contact.id,
          newStage: 'ESTAGIO_INVALIDO' as any,
        }),
      ).rejects.toThrow();
    });
  });
});
