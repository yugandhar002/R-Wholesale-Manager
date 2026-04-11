-- This script fix the "Failed to delete customer" error by allowing 
-- customers to be deleted even if they have associated bills.
-- The bills will NOT be deleted; their customer_id will simply be set to NULL.

BEGIN;

-- 1. Safely drop the existing foreign key constraint
-- The default name for anonymous foreign keys is table_column_fkey
ALTER TABLE bills 
DROP CONSTRAINT IF EXISTS bills_customer_id_fkey;

-- 2. Re-add the constraint with ON DELETE SET NULL
ALTER TABLE bills
ADD CONSTRAINT bills_customer_id_fkey 
FOREIGN KEY (customer_id) 
REFERENCES customers(id) 
ON DELETE SET NULL;

COMMIT;
