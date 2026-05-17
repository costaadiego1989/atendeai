import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../../app.module';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GlobalExceptionFilter } from '@shared/infrastructure/http/filters/GlobalExceptionFilter';
import { CatalogAsyncJobStatus } from '../application/services/CatalogAsyncJobsService';

describe('CatalogController (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let authCookie: string;

  const ownerEmail = `catalog-owner-${Date.now()}@test.com`;
  const password = 'SenhaForte123!';
  const tenantCnpj = `ct${Date.now()}`;

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(200);

    const cookies = response.get('Set-Cookie');
    expect(cookies).toBeDefined();
    return cookies![0];
  }

  async function waitForJobCompletion(jobId: string): Promise<any> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenantId}/catalog/jobs/${jobId}`)
        .set('Cookie', [authCookie])
        .expect(200);

      const status = response.body.status as CatalogAsyncJobStatus;
      if (status === 'COMPLETED' || status === 'FAILED') {
        return response.body;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for catalog job ${jobId}`);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user
      .deleteMany({ where: { email: ownerEmail } })
      .catch(() => {});

    const passwordHash = await bcrypt.hash(password, 10);

    const tenant = await prisma.tenant.create({
      data: {
        companyName: 'Catalog Store',
        cnpj: tenantCnpj,
        plan: 'ESSENCIAL',
      },
    });
    tenantId = tenant.id;

    await prisma.user.create({
      data: {
        tenantId,
        name: 'Catalog Owner',
        email: ownerEmail,
        phone: '11970000060',
        passwordHash,
        role: 'OWNER',
      },
    });

    authCookie = await login();
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM inventory_schema.inventory_items
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM catalog_schema.catalog_async_jobs
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM catalog_schema.catalog_items
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma
        .$executeRaw(
          Prisma.sql`
        DELETE FROM catalog_schema.catalog_categories
        WHERE tenant_id = ${tenantId}::uuid
      `,
        )
        .catch(() => {});
      await prisma.subscription
        .deleteMany({ where: { tenantId } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant
        .deleteMany({ where: { id: tenantId } })
        .catch(() => {});
    }

    if (app) {
      await app.close();
    }
  });

  it('should manage catalog categories and items for products and services', async () => {
    const servicesCategoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'serviços',
        description: 'Atendimentos e procedimentos',
      })
      .expect(201);

    const productsCategoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Produtos',
      })
      .expect(201);

    const servicesCategoryId = servicesCategoryResponse.body.id;
    const productsCategoryId = productsCategoryResponse.body.id;

    expect(servicesCategoryResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: 'serviços',
        active: true,
      }),
    );

    const categoriesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(categoriesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: servicesCategoryId,
          name: 'serviços',
        }),
        expect.objectContaining({
          id: productsCategoryId,
          name: 'Produtos',
        }),
      ]),
    );

    const updatedServicesCategory = await request(app.getHttpServer())
      .put(
        `/api/v1/tenants/${tenantId}/catalog/categories/${servicesCategoryId}`,
      )
      .set('Cookie', [authCookie])
      .send({
        name: 'serviços premium',
        description: 'Atendimentos atualizados',
      })
      .expect(200);

    expect(updatedServicesCategory.body).toEqual(
      expect.objectContaining({
        id: servicesCategoryId,
        name: 'serviços premium',
        description: 'Atendimentos atualizados',
      }),
    );

    const serviceItemResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'SERVICE',
        name: 'Hidratação capilar',
        description: 'Tratamento profundo para cabelos ressecados',
        basePrice: '120.00',
        categoryId: servicesCategoryId,
        tags: ['hidratação', 'salão'],
      })
      .expect(201);

    const productItemResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Shampoo premium 300ml',
        description: 'Uso profissional com fragrancia suave',
        basePrice: '54.90',
        categoryId: productsCategoryId,
        tags: ['shampoo', 'premium'],
      })
      .expect(201);

    expect(serviceItemResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'SERVICE',
        name: 'Hidratação capilar',
        active: true,
        source: 'MANUAL',
        basePrice: '120.00',
      }),
    );

    const updatedProductItemResponse = await request(app.getHttpServer())
      .put(
        `/api/v1/tenants/${tenantId}/catalog/items/${productItemResponse.body.id}`,
      )
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Shampoo premium 500ml',
        description: 'Uso profissional com fragrancia suave',
        basePrice: '64.90',
        categoryId: productsCategoryId,
        tags: ['shampoo', 'premium', 'varejo'],
      })
      .expect(200);

    expect(updatedProductItemResponse.body).toEqual(
      expect.objectContaining({
        id: productItemResponse.body.id,
        name: 'Shampoo premium 500ml',
        basePrice: '64.90',
      }),
    );

    await request(app.getHttpServer())
      .delete(
        `/api/v1/tenants/${tenantId}/catalog/categories/${servicesCategoryId}`,
      )
      .set('Cookie', [authCookie])
      .expect(422);

    const listAllItemsResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(listAllItemsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: serviceItemResponse.body.id,
          type: 'SERVICE',
        }),
        expect.objectContaining({
          id: productItemResponse.body.id,
          type: 'PRODUCT',
        }),
      ]),
    );

    const listServiceItemsResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/items?type=SERVICE`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(listServiceItemsResponse.body).toEqual([
      expect.objectContaining({
        id: serviceItemResponse.body.id,
        name: 'Hidratação capilar',
        type: 'SERVICE',
      }),
    ]);

    const searchItemsResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/items?query=shampoo`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(searchItemsResponse.body).toEqual([
      expect.objectContaining({
        id: productItemResponse.body.id,
        name: 'Shampoo premium 500ml',
      }),
    ]);

    const filterByCategoryResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/catalog/items?categoryId=${servicesCategoryId}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(filterByCategoryResponse.body).toEqual([
      expect.objectContaining({
        id: serviceItemResponse.body.id,
        categoryId: servicesCategoryId,
      }),
    ]);

    await request(app.getHttpServer())
      .post(
        `/api/v1/tenants/${tenantId}/catalog/items/${productItemResponse.body.id}/deactivate`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const activeItemsAfterDeactivation = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(activeItemsAfterDeactivation.body).toEqual([
      expect.objectContaining({
        id: serviceItemResponse.body.id,
        active: true,
      }),
    ]);

    const allItemsIncludingInactive = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/items?includeInactive=true`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(allItemsIncludingInactive.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: serviceItemResponse.body.id,
          active: true,
        }),
        expect.objectContaining({
          id: productItemResponse.body.id,
          active: false,
        }),
      ]),
    );

    await request(app.getHttpServer())
      .delete(
        `/api/v1/tenants/${tenantId}/catalog/items/${serviceItemResponse.body.id}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/tenants/${tenantId}/catalog/categories/${servicesCategoryId}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    const categoriesAfterDeletion = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(categoriesAfterDeletion.body).toEqual([
      expect.objectContaining({
        id: productsCategoryId,
        name: 'Produtos',
      }),
    ]);
  });

  it('should support category trees and complex product custom fields', async () => {
    const apparelResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Moda',
        description: 'Itens de vestuario',
      })
      .expect(201);

    const shirtsResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .send({
        parentCategoryId: apparelResponse.body.id,
        name: 'Camisetas',
        description: 'Camisetas masculinas e femininas',
      })
      .expect(201);

    expect(shirtsResponse.body).toEqual(
      expect.objectContaining({
        parentCategoryId: apparelResponse.body.id,
        parentCategoryName: 'Moda',
        path: ['Moda', 'Camisetas'],
        level: 1,
      }),
    );

    const categoriesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(categoriesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: apparelResponse.body.id,
          path: ['Moda'],
          level: 0,
        }),
        expect.objectContaining({
          id: shirtsResponse.body.id,
          parentCategoryId: apparelResponse.body.id,
          path: ['Moda', 'Camisetas'],
          level: 1,
        }),
      ]),
    );

    const complexProductResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Camiseta oversized',
        description: 'Produto com variações por cor e tamanho',
        basePrice: '79.90',
        categoryId: shirtsResponse.body.id,
        tags: ['moda', 'camiseta'],
        attributes: {
          tecido: 'algodao',
          genero: 'unissex',
          tabelaMedidas: {
            P: '68x52',
            M: '72x55',
          },
        },
        variants: [
          {
            sku: 'CAM-OVR-P-PRETO',
            size: 'P',
            color: 'Preto',
            price: '79.90',
            stock: 8,
          },
          {
            sku: 'CAM-OVR-M-AZUL',
            size: 'M',
            color: 'Azul',
            price: '84.90',
            stock: 5,
          },
        ],
        optionGroups: [
          {
            name: 'Adicionais',
            required: false,
            min: 0,
            max: 3,
            options: [
              {
                name: 'Embalagem para presente',
                priceDelta: '9.90',
                sku: 'ADD-PRESENTE',
                active: true,
              },
              {
                name: 'Etiqueta personalizada',
                priceDelta: '4.90',
                active: true,
              },
            ],
          },
        ],
      })
      .expect(201);

    expect(complexProductResponse.body).toEqual(
      expect.objectContaining({
        categoryId: shirtsResponse.body.id,
        categoryName: 'Camisetas',
        attributes: expect.objectContaining({
          tecido: 'algodao',
          genero: 'unissex',
        }),
        variants: expect.arrayContaining([
          expect.objectContaining({
            sku: 'CAM-OVR-P-PRETO',
            size: 'P',
            color: 'Preto',
          }),
        ]),
        optionGroups: expect.arrayContaining([
          expect.objectContaining({
            name: 'Adicionais',
            required: false,
            min: 0,
            max: 3,
            options: expect.arrayContaining([
              expect.objectContaining({
                name: 'Embalagem para presente',
                priceDelta: '9.90',
              }),
            ]),
          }),
        ]),
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/catalog/items?categoryId=${shirtsResponse.body.id}`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(listResponse.body).toEqual([
      expect.objectContaining({
        id: complexProductResponse.body.id,
        attributes: expect.objectContaining({
          tabelaMedidas: expect.objectContaining({
            M: '72x55',
          }),
        }),
        variants: expect.arrayContaining([
          expect.objectContaining({
            sku: 'CAM-OVR-M-AZUL',
            color: 'Azul',
          }),
        ]),
        optionGroups: expect.arrayContaining([
          expect.objectContaining({
            name: 'Adicionais',
          }),
        ]),
      }),
    ]);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/tenants/${tenantId}/catalog/categories/${apparelResponse.body.id}`,
      )
      .set('Cookie', [authCookie])
      .expect(422);
  });

  it('should enqueue a catalog report job and download the csv', async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .send({
        name: 'Relatorio',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Produto relatorio catalogo',
        description: 'Item criado para validar o CSV assíncrono',
        basePrice: '89.90',
        categoryId: categoryResponse.body.id,
        tags: ['relatorio', 'csv'],
        externalReference: 'CAT-REL-001',
      })
      .expect(201);

    const startResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/report-jobs`)
      .set('Cookie', [authCookie])
      .send({
        types: ['PRODUCT'],
        categoryIds: [categoryResponse.body.id],
        query: 'relatorio',
        includeInactive: true,
      })
      .expect(202);

    expect(startResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'EXPORT_CATALOG_REPORT_CSV',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
      }),
    );

    const reportJob = await waitForJobCompletion(startResponse.body.id);
    expect(reportJob.status).toBe('COMPLETED');
    expect(reportJob.fileName).toContain('relatorio-catalogo-');

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/jobs/${reportJob.id}/download`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(downloadResponse.header['content-type']).toContain('text/csv');
    expect(downloadResponse.text).toContain('Produto relatorio catalogo');
    expect(downloadResponse.text).toContain('CAT-REL-001');
  });

  it('should create inventory snapshots for manually created products and variants', async () => {
    const simpleProductResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Pote de molho artesanal',
        basePrice: '24.90',
        externalReference: 'MOLHO-ART',
        initialStock: 18,
      })
      .expect(201);

    const simpleInventoryResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?query=MOLHO-ART`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(simpleInventoryResponse.body).toEqual([
      expect.objectContaining({
        catalogItemId: simpleProductResponse.body.id,
        sku: 'MOLHO-ART',
        availableQuantity: 18,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '24.90',
        source: 'MANUAL_SNAPSHOT',
      }),
    ]);

    const productResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/items`)
      .set('Cookie', [authCookie])
      .send({
        type: 'PRODUCT',
        name: 'Filtro de agua compacto',
        basePrice: '189.90',
        externalReference: 'FILTRO-COMP',
        variants: [
          {
            name: 'Bivolt com refil extra',
            reference: 'FILTRO-COMP-BIVOLT',
            price: '219.90',
            stock: 7,
            attributes: {
              voltagem: 'bivolt',
              pacote: 'com refil extra',
            },
          },
        ],
      })
      .expect(201);

    const baseInventoryResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/tenants/${tenantId}/inventory/items?query=FILTRO-COMP-BIVOLT`,
      )
      .set('Cookie', [authCookie])
      .expect(200);

    expect(baseInventoryResponse.body).toEqual([
      expect.objectContaining({
        catalogItemId: productResponse.body.id,
        sku: 'FILTRO-COMP-BIVOLT',
        name: 'Filtro de agua compacto - Bivolt com refil extra',
        availableQuantity: 7,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '219.90',
        source: 'MANUAL_SNAPSHOT',
      }),
    ]);
  });

  it('should import catalog items from a flexible spreadsheet schema and sync inventory when applicable', async () => {
    const startResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/import-jobs`)
      .set('Cookie', [authCookie])
      .send({
        rawText: [
          'Tipo do item;Produto;preço de venda;Grupo;Codigo interno;Qtd estoque;Tags;Detalhes',
          'Produto;Cafe gelado lata;11,90;Bebidas frias;BEB-090;14;cafe|gelado;Bebida pronta para consumo',
          'SERVICE;Assinatura clube cafe;49,90;Assinaturas;CLUBE-CAF;999;assinatura|recorrente;Plano mensal do clube',
        ].join('\n'),
        defaultSource: 'IMPORT',
        syncInventory: true,
      })
      .expect(202);

    expect(startResponse.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'IMPORT_CATALOG_ITEMS',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
      }),
    );

    const importJob = await waitForJobCompletion(startResponse.body.id);
    expect(importJob.status).toBe('COMPLETED');
    expect(importJob.resultSummary).toEqual(
      expect.objectContaining({
        totalRows: 2,
        created: 2,
        updated: 0,
        inventorySynced: 1,
      }),
    );

    const categoriesResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/categories`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(categoriesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Bebidas frias' }),
        expect.objectContaining({ name: 'Assinaturas' }),
      ]),
    );

    const itemsResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/catalog/items?includeInactive=true`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(itemsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Cafe gelado lata',
          type: 'PRODUCT',
          basePrice: '11.90',
          externalReference: 'BEB-090',
        }),
        expect.objectContaining({
          name: 'Assinatura clube cafe',
          type: 'SERVICE',
          basePrice: '49.90',
          externalReference: 'CLUBE-CAF',
        }),
      ]),
    );

    const inventoryResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?query=BEB-090`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(inventoryResponse.body).toEqual([
      expect.objectContaining({
        sku: 'BEB-090',
        name: 'Cafe gelado lata',
        availableQuantity: 14,
        availabilityStatus: 'AVAILABLE',
        currentPrice: '11.90',
      }),
    ]);
  });

  it('should create an initial inventory snapshot for product imports even without stock columns', async () => {
    const startResponse = await request(app.getHttpServer())
      .post(`/api/v1/tenants/${tenantId}/catalog/import-jobs`)
      .set('Cookie', [authCookie])
      .send({
        rawText: [
          'Produto;Categoria;preço',
          'Cookie integral;Padaria;8,50',
        ].join('\n'),
        defaultType: 'PRODUCT',
        defaultSource: 'IMPORT',
        syncInventory: true,
      })
      .expect(202);

    const importJob = await waitForJobCompletion(startResponse.body.id);
    expect(importJob.status).toBe('COMPLETED');
    expect(importJob.resultSummary).toEqual(
      expect.objectContaining({
        totalRows: 1,
        created: 1,
        inventorySynced: 1,
      }),
    );

    const inventoryResponse = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantId}/inventory/items?query=COOKIE-INTEGRAL`)
      .set('Cookie', [authCookie])
      .expect(200);

    expect(inventoryResponse.body).toEqual([
      expect.objectContaining({
        sku: 'COOKIE-INTEGRAL',
        name: 'Cookie integral',
        availableQuantity: 0,
        availabilityStatus: 'UNAVAILABLE',
        currentPrice: '8.50',
      }),
    ]);
  });
});
