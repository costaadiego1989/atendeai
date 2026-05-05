import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '../domain/repositories/IContactRepository';
import { Contact } from '../domain/entities/Contact';
import { TenantId } from '@shared/domain/TenantId';
import { ContactName } from '../domain/value-objects/ContactName';

describe('PrismaContactRepository (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let repository: IContactRepository;
  let tenantId: string;
  let otherTenantId: string;
  const tenantCnpj = `cr${Date.now()}`;
  const otherTenantCnpj = `cr${Date.now() + 1}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    repository = app.get<IContactRepository>(CONTACT_REPOSITORY);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Contact Repository Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    const otherTenant = await prisma.tenant.create({
      data: {
        companyName: 'Other Contact Repository Store',
        cnpj: otherTenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    otherTenantId = otherTenant.id;
  });

  afterAll(async () => {
    await prisma.contact
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => {});
    await prisma.subscription
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: {
          tenantId: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => {});
    await prisma.tenant
      .deleteMany({
        where: {
          id: {
            in: [tenantId, otherTenantId].filter(Boolean),
          },
        },
      })
      .catch(() => {});

    if (app) {
      await app.close();
    }
  });

  function makeContact(phone: string, name: string) {
    return Contact.create({
      tenantId: TenantId.create(tenantId),
      name: ContactName.create(name),
      phone,
      email: `${name.toLowerCase().replace(/\s+/g, '-')}@test.com`,
      tags: ['vip'],
      notes: 'Contato importante',
    });
  }

  it('should save, find by id and find by phone inside the tenant', async () => {
    const contact = makeContact('5511999990001', 'Lead One');
    await repository.save(contact);

    const byId = await repository.findById(tenantId, contact.id.toString());
    const byPhone = await repository.findByPhone(tenantId, contact.phone);

    expect(byId?.name.value).toBe('Lead One');
    expect(byPhone?.id.toString()).toBe(contact.id.toString());
  });

  it('should paginate and filter contacts by stage and tag with tenant isolation', async () => {
    const contactA = makeContact('5511999990002', 'Lead Two');
    const contactB = makeContact('5511999990003', 'Lead Three');
    contactB.updateStage({ value: 'CUSTOMER' } as any);
    await repository.save(contactA);
    await repository.save(contactB);

    await prisma.contact.create({
      data: {
        tenantId: otherTenantId,
        name: 'Other Tenant Lead',
        phone: '5511999990004',
        stage: 'LEAD',
      },
    });

    const paged = await repository.findAllByTenant(tenantId, {
      page: 1,
      limit: 1,
      tag: 'vip',
    });
    const customers = await repository.findAllByTenant(tenantId, {
      stage: 'CUSTOMER',
    });

    expect(paged.total).toBeGreaterThanOrEqual(2);
    expect(paged.data).toHaveLength(1);
    expect(customers.data).toHaveLength(1);
    expect(customers.data[0]?.stage.value).toBe('CUSTOMER');
  });

  it('should delete contacts with their conversation history inside the tenant scope', async () => {
    const contact = makeContact('5511999990005', 'Lead Delete');
    await repository.save(contact);

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id.toString(),
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        contentType: 'TEXT',
        content: { type: 'TEXT', text: 'Historico antes da exclusao' },
        sentBy: 'CONTACT',
        externalId: `contact-delete-${Date.now()}`,
      },
    });

    await repository.delete(tenantId, contact.id.toString());

    await expect(
      repository.findById(tenantId, contact.id.toString()),
    ).resolves.toBeNull();
    await expect(
      prisma.conversation.findUnique({
        where: { id: conversation.id },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.message.findFirst({
        where: { conversationId: conversation.id },
      }),
    ).resolves.toBeNull();
  });
});
