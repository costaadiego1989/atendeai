import { Page } from '@playwright/test';
import { execSync } from 'child_process';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

interface SeedContact {
  name: string;
  phone: string;
  document?: string;
  email?: string;
  stage?: string;
  tags?: string[];
  notes?: string;
}

/**
 * Seed a contact directly into the database via psql.
 * Bypasses the API's BullMQ/Redis requirement.
 */
export async function seedContactViaDB(contact: SeedContact): Promise<string> {
  const id = crypto.randomUUID();
  const phone = contact.phone.replace(/\D/g, '');
  const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const stage = contact.stage || 'LEAD';
  const tags = JSON.stringify(contact.tags || []);
  const doc = contact.document || '';
  const email = contact.email || '';
  const notes = contact.notes || '';

  const sql = `INSERT INTO contact_schema.contacts (id, tenant_id, name, phone, document, email, stage, tags, notes, created_at, updated_at) VALUES ('${id}', '${TENANT_ID}', '${contact.name.replace(/'/g, "''")}', '${fullPhone}', '${doc}', ${email ? `'${email}'` : 'NULL'}, '${stage}', '${tags}'::jsonb, ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}, NOW(), NOW()) ON CONFLICT (tenant_id, phone) DO NOTHING;`;

  const env = { ...process.env, PGPASSWORD: 'atendeai_dev', PGCLIENTENCODING: 'UTF8' };
  execSync(
    `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5433 -U atendeai -d atendeai -c "${sql.replace(/"/g, '\\"')}"`,
    { env, stdio: 'pipe', encoding: 'utf-8' },
  );

  return id;
}

/**
 * Delete a contact directly from the database.
 */
export async function deleteContactFromDB(contactId: string): Promise<void> {
  const sql = `DELETE FROM contact_schema.contacts WHERE id = '${contactId}' AND tenant_id = '${TENANT_ID}';`;
  const env = { ...process.env, PGPASSWORD: 'atendeai_dev', PGCLIENTENCODING: 'UTF8' };
  execSync(
    `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5433 -U atendeai -d atendeai -c "${sql}"`,
    { env, stdio: 'pipe', encoding: 'utf-8' },
  );
}

/**
 * Clean up all E2E test contacts from the database.
 */
export async function cleanupE2EContacts(): Promise<void> {
  const sql = `DELETE FROM contact_schema.contacts WHERE tenant_id = '${TENANT_ID}' AND name LIKE '%E2E%';`;
  const env = { ...process.env, PGPASSWORD: 'atendeai_dev', PGCLIENTENCODING: 'UTF8' };
  execSync(
    `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5433 -U atendeai -d atendeai -c "${sql}"`,
    { env, stdio: 'pipe', encoding: 'utf-8' },
  );
}

/**
 * Mock the POST /contacts endpoint to simulate successful creation.
 * This bypasses the BullMQ/Redis version issue on Windows.
 * The mock returns a realistic response and the UI will close the sheet.
 */
export async function mockCreateContactSuccess(page: Page) {
  await page.route('**/api/v1/tenants/*/contacts', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }

    const body = JSON.parse(request.postData() || '{}');
    const id = crypto.randomUUID();

    // Also insert into DB so the contact appears after query invalidation
    try {
      const phone = (body.phone || '').replace(/\D/g, '');
      const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
      const tags = JSON.stringify(body.tags || []);
      const sql = `INSERT INTO contact_schema.contacts (id, tenant_id, name, phone, document, email, stage, tags, notes, created_at, updated_at) VALUES ('${id}', '${TENANT_ID}', '${(body.name || '').replace(/'/g, "''")}', '${fullPhone}', '${body.document || ''}', ${body.email ? `'${body.email}'` : 'NULL'}, 'LEAD', '${tags}'::jsonb, ${body.notes ? `'${(body.notes as string).replace(/'/g, "''")}'` : 'NULL'}, NOW(), NOW()) ON CONFLICT (tenant_id, phone) DO NOTHING;`;
      const env = { ...process.env, PGPASSWORD: 'atendeai_dev' };
      execSync(
        `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5433 -U atendeai -d atendeai -c "${sql.replace(/"/g, '\\"')}"`,
        { env, stdio: 'pipe' },
      );
    } catch {
      // If DB insert fails, still return success to test UI behavior
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        statusCode: 201,
        data: {
          id,
          tenantId: TENANT_ID,
          branchId: null,
          name: body.name,
          phone: body.phone,
          document: body.document,
          stage: 'LEAD',
          tags: body.tags || [],
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });
}

/** Generate a unique phone number */
export function uniquePhone(): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `119${ts}${rand}`.slice(0, 11);
}
