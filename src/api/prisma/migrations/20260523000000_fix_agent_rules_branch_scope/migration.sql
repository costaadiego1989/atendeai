-- Pre-check: abort if duplicate (tenant_id, module_id) rows exist across scopes (would violate new indexes)
DO $$
BEGIN
  IF EXISTS (
    SELECT tenant_id, module_id, COUNT(*)
    FROM tenant_schema.tenant_agent_rules
    GROUP BY tenant_id, module_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate (tenant_id, module_id) rows detected. Reconcile before applying this migration.';
  END IF;
END $$;

-- Drop old unique constraint
ALTER TABLE tenant_schema.tenant_agent_rules
  DROP CONSTRAINT IF EXISTS tenant_agent_rules_tenant_id_module_id_key;

-- Tenant-level rule: one per (tenant, module) when no branch
CREATE UNIQUE INDEX uq_agent_rules_tenant_scope
  ON tenant_schema.tenant_agent_rules (tenant_id, module_id)
  WHERE branch_id IS NULL;

-- Branch-level rule: one per (tenant, module, branch)
CREATE UNIQUE INDEX uq_agent_rules_branch_scope
  ON tenant_schema.tenant_agent_rules (tenant_id, module_id, branch_id)
  WHERE branch_id IS NOT NULL;

-- Covering index for read path (branch fallback query)
CREATE INDEX idx_agent_rules_lookup
  ON tenant_schema.tenant_agent_rules (tenant_id, module_id, branch_id);
