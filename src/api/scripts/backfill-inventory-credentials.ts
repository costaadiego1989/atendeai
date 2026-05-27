import { PrismaClient } from '@prisma/client';
import { AesGcmCredentialCipher } from '../modules/inventory/infrastructure/security/AesGcmCredentialCipher';
import { ICredentialCipher } from '../modules/inventory/application/ports/ICredentialCipher';
import { getProviderSecretKeys } from '../modules/inventory/application/providers/provider-secret-keys';

const ENCRYPTED_PREFIX = 'v1:';

export interface BackfillConnectionStore {
  findMany(): Promise<
    Array<{ id: string; sourceType: string; config: unknown }>
  >;
  update(args: {
    where: { id: string };
    data: { config: object };
  }): Promise<unknown>;
}

export interface BackfillResult {
  scanned: number;
  updated: number;
}

export async function backfillEncryptCredentials(
  store: BackfillConnectionStore,
  cipher: ICredentialCipher,
): Promise<BackfillResult> {
  let scanned = 0;
  let updated = 0;

  const connections = await store.findMany();

  for (const connection of connections) {
    scanned++;
    const secretKeys = getProviderSecretKeys(connection.sourceType);
    if (secretKeys.length === 0) {
      continue;
    }

    const config =
      connection.config && typeof connection.config === 'object'
        ? { ...(connection.config as Record<string, unknown>) }
        : {};

    let changed = false;
    for (const key of secretKeys) {
      const value = config[key];
      if (typeof value === 'string' && !value.startsWith(ENCRYPTED_PREFIX)) {
        config[key] = cipher.encrypt(value);
        changed = true;
      }
    }

    if (!changed) {
      continue;
    }

    await store.update({
      where: { id: connection.id },
      data: { config: config as object },
    });
    updated++;

    console.log(
      `Encrypted credentials (connectionId=${connection.id}, sourceType=${connection.sourceType})`,
    );
  }

  return { scanned, updated };
}

async function run(): Promise<void> {
  const prisma = new PrismaClient();
  const cipher = new AesGcmCredentialCipher();

  try {
    const result = await backfillEncryptCredentials(
      prisma.inventoryConnection,
      cipher,
    );

    console.log(
      `Backfill complete. Scanned ${result.scanned} connection(s), updated ${result.updated}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(
      'Backfill failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  });
}
