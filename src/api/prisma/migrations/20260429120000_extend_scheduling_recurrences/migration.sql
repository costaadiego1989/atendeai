CREATE SCHEMA IF NOT EXISTS scheduling_schema;

ALTER TABLE scheduling_schema.scheduling_recurring_reservations
  ADD COLUMN IF NOT EXISTS interval INTEGER NOT NULL DEFAULT 1;

ALTER TABLE scheduling_schema.scheduling_recurring_reservations
  ADD COLUMN IF NOT EXISTS end_date DATE NULL;

UPDATE scheduling_schema.scheduling_recurring_reservations
SET occurrences_created = 0
WHERE occurrences_created IS NULL;

ALTER TABLE scheduling_schema.scheduling_recurring_reservations
  ALTER COLUMN occurrences_created SET DEFAULT 0;
