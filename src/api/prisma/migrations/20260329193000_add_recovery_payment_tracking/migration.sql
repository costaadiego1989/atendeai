ALTER TABLE recovery_schema.recovery_cases
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_recovery_cases_payment_reference
ON recovery_schema.recovery_cases (payment_reference)
WHERE payment_reference IS NOT NULL;
