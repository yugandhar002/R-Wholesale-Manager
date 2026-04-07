-- 1. Create Customers Table (with UNIQUE name constraint for linking)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  phone TEXT,
  total_bills INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_bill_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Public insert access for customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for customers" ON customers FOR UPDATE USING (true);
CREATE POLICY "Public delete access for customers" ON customers FOR DELETE USING (true);

-- 3. Migrate existing customers from the bills table
-- This populates the customers table with unique names from your history
INSERT INTO customers (name, phone)
SELECT DISTINCT TRIM(customer_name), TRIM(customer_phone)
FROM bills
WHERE customer_name IS NOT NULL AND TRIM(customer_name) != ''
ON CONFLICT (name) DO NOTHING;

-- 4. Add a customer_id column to the bills table to create a permanent link
ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- 5. Link existing bills to the new customer records
-- This updates old bills to point to their corresponding customer ID
UPDATE bills
SET customer_id = customers.id
FROM customers
WHERE TRIM(bills.customer_name) = customers.name
AND bills.customer_id IS NULL;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);

-- 7. (Optional) Populate stats for existing customers
UPDATE customers c
SET 
  total_bills = (SELECT COUNT(*``) FROM bills b WHERE b.customer_id = c.id),
  total_spent = (SELECT COALESCE(SUM(total_amount), 0) FROM bills b WHERE b.customer_id = c.id),
  last_bill_date = (SELECT MAX(created_at) FROM bills b WHERE b.customer_id = c.id)
WHERE c.id IN (SELECT DISTINCT customer_id FROM bills);
