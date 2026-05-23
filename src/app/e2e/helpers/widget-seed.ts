import { execSync } from 'child_process';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const PSQL = '"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5434 -U atendeai -d atendeai';
const ENV = { ...process.env, PGPASSWORD: 'atendeai_dev', PGCLIENTENCODING: 'UTF8' };

function runSQL(sql: string): string {
  try {
    return execSync(`${PSQL} -c "${sql.replace(/"/g, '\\"')}"`, {
      env: ENV,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (e) {
    console.error('widget-seed SQL error:', (e as Error).message);
    return '';
  }
}

export interface WidgetSeedOptions {
  name: string;
  greeting: string;
  color?: string;
  position?: 'bottom-right' | 'bottom-left';
  collectName?: boolean;
  collectPhone?: boolean;
  collectEmail?: boolean;
  collectCpf?: boolean;
  quickReplies?: string[];
}

/**
 * Insert a WidgetConfig in the dev DB and return the publicToken UUID.
 * Uses a fixed deterministic UUID per name so tests are idempotent.
 */
export function seedWidgetConfig(opts: WidgetSeedOptions): string {
  const configId = execSync(
    `${PSQL} -t -A -c "SELECT gen_random_uuid();"`,
    { env: ENV, encoding: 'utf-8' },
  ).trim();

  const publicToken = execSync(
    `${PSQL} -t -A -c "SELECT gen_random_uuid();"`,
    { env: ENV, encoding: 'utf-8' },
  ).trim();

  const quickReplies = JSON.stringify(opts.quickReplies ?? []).replace(/'/g, "''");
  const greeting = (opts.greeting ?? '').replace(/'/g, "''");
  const name = opts.name.replace(/'/g, "''");
  const color = opts.color ?? '#00C59E';
  const position = opts.position ?? 'bottom-right';

  const sql = `
    INSERT INTO messaging_schema.widget_configs (
      id, tenant_id, enabled, public_token, name, greeting, color, position,
      avatar_url, collect_name, collect_phone, collect_email, collect_cpf,
      proactive_delay, proactive_msg, quick_replies, allowed_origins,
      created_at, updated_at
    ) VALUES (
      '${configId}', '${TENANT_ID}', true, '${publicToken}',
      '${name}', '${greeting}', '${color}', '${position}',
      null,
      ${opts.collectName ?? false}, ${opts.collectPhone ?? false},
      ${opts.collectEmail ?? false}, ${opts.collectCpf ?? false},
      null, null,
      '${quickReplies}'::jsonb, '[]'::jsonb,
      NOW(), NOW()
    )
    ON CONFLICT DO NOTHING;
  `;

  runSQL(sql);
  return publicToken;
}

export function deleteWidgetConfig(publicToken: string): void {
  runSQL(`DELETE FROM messaging_schema.widget_configs WHERE public_token = '${publicToken}' AND tenant_id = '${TENANT_ID}';`);
}

/**
 * Seed an agent rule for moduleId 'widget'.
 * Overwrites existing rule for same tenant+module.
 */
export function seedWidgetAgentRule(customPrompt: string): string {
  const ruleId = execSync(
    `${PSQL} -t -A -c "SELECT gen_random_uuid();"`,
    { env: ENV, encoding: 'utf-8' },
  ).trim();

  const prompt = customPrompt.replace(/'/g, "''");

  runSQL(`
    INSERT INTO tenant_schema.tenant_agent_rules
      (id, tenant_id, module_id, custom_prompt, is_active, fallback_to_global, revision, created_at, updated_at)
    VALUES
      ('${ruleId}', '${TENANT_ID}', 'widget', '${prompt}', true, false, 1, NOW(), NOW())
    ON CONFLICT (tenant_id, module_id)
    DO UPDATE SET
      custom_prompt = EXCLUDED.custom_prompt,
      is_active = true,
      fallback_to_global = false,
      revision = tenant_schema.tenant_agent_rules.revision + 1,
      updated_at = NOW();
  `);

  return ruleId;
}

export function deleteWidgetAgentRule(): void {
  runSQL(`DELETE FROM tenant_schema.tenant_agent_rules WHERE tenant_id = '${TENANT_ID}' AND module_id = 'widget';`);
}
