-- Enable UPDATE and DELETE for bills (needed for editing bills)
CREATE POLICY "Public update access for bills" ON bills FOR UPDATE USING (true);
CREATE POLICY "Public delete access for bills" ON bills FOR DELETE USING (true);

-- Enable UPDATE and DELETE for bill_items (needed for editing bills)
CREATE POLICY "Public update access for bill_items" ON bill_items FOR UPDATE USING (true);
CREATE POLICY "Public delete access for bill_items" ON bill_items FOR DELETE USING (true);
