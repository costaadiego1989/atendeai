import { InventorySyncWorker } from '../application/workers/InventorySyncWorker';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { SyncInventoryConnectionUseCase } from '../application/use-cases/SyncInventoryConnectionUseCase';

describe('InventorySyncWorker', () => {
  it('INV-T-080: handleHourlySync chama sync por cada conexão ativa', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'c1', tenantId: 't1' },
      { id: 'c2', tenantId: 't2' },
    ]);
    const prisma = {
      inventoryConnection: { findMany },
    } as unknown as PrismaService;

    const syncExecute = jest.fn().mockResolvedValue(undefined);
    const syncUseCase = {
      execute: syncExecute,
    } as unknown as SyncInventoryConnectionUseCase;

    const worker = new InventorySyncWorker(prisma, syncUseCase);
    await worker.handleHourlySync();

    expect(findMany).toHaveBeenCalledWith({ where: {} });
    expect(syncExecute).toHaveBeenCalledTimes(2);
    expect(syncExecute).toHaveBeenNthCalledWith(1, {
      tenantId: 't1',
      connectionId: 'c1',
    });
    expect(syncExecute).toHaveBeenNthCalledWith(2, {
      tenantId: 't2',
      connectionId: 'c2',
    });
  });

  it('INV-T-081: falha em uma conexão não impede processamento das outras', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'c1', tenantId: 't1' },
      { id: 'c2', tenantId: 't2' },
    ]);
    const prisma = {
      inventoryConnection: { findMany },
    } as unknown as PrismaService;

    const syncExecute = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const syncUseCase = { execute: syncExecute } as unknown as SyncInventoryConnectionUseCase;

    const worker = new InventorySyncWorker(prisma, syncUseCase);
    await worker.handleHourlySync();

    expect(syncExecute).toHaveBeenCalledTimes(2);
  });
});
