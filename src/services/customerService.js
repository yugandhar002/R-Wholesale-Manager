import { supabase, IS_MOCK } from '../lib/supabase';

const MOCK_CUSTOMERS = [
  { id: '1', name: 'John Doe', phone: '9876543210', total_bills: 5, total_spent: 15000, created_at: new Date().toISOString() },
  { id: '2', name: 'Jane Smith', phone: '8765432109', total_bills: 2, total_spent: 8000, created_at: new Date().toISOString() },
];

export async function getCustomers() {
  if (IS_MOCK) {
    return { data: MOCK_CUSTOMERS, error: null };
  }
  return await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });
}

export async function updateCustomer(id, data) {
  if (IS_MOCK) {
    const index = MOCK_CUSTOMERS.findIndex(c => c.id === id);
    if (index !== -1) {
      MOCK_CUSTOMERS[index] = { ...MOCK_CUSTOMERS[index], ...data };
    }
    return { data: MOCK_CUSTOMERS[index], error: null };
  }
  return await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select()
    .single();
}

export async function deleteCustomer(id) {
  if (IS_MOCK) {
    const index = MOCK_CUSTOMERS.findIndex(c => c.id === id);
    if (index !== -1) MOCK_CUSTOMERS.splice(index, 1);
    return { error: null };
  }
  
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Core deletion error:', error);
    // Standardize error message for UI
    if (error.code === '23503') {
      return { error: { ...error, message: 'Cannot delete customer because they have bills. Please run the SQL fix.' } };
    }
  }
  
  return { error };
}

export async function getCustomerBills(customerName, customerId = null) {
  if (IS_MOCK) {
    return { data: [], error: null };
  }
  
  let query = supabase.from('bills').select('*, bill_items(*)');
  
  if (customerId) {
    query = query.eq('customer_id', customerId);
  } else {
    query = query.ilike('customer_name', customerName.trim());
  }
  
  return await query.order('created_at', { ascending: false });
}

/**
 * Syncs unique customers from the bills table into the customers table.
 * Good for initial migration.
 */
export async function syncCustomersFromBills() {
  if (IS_MOCK) return { count: 0, error: null };

  try {
    // 1. Get unique customer names and phones from bills
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('customer_name, customer_phone')
      .not('customer_name', 'is', null);

    if (billsError) throw billsError;

    // 2. Filter unique in JS
    const uniqueMap = new Map();
    bills.forEach(b => {
      const name = b.customer_name?.trim();
      if (name && !uniqueMap.has(name.toLowerCase())) {
        uniqueMap.set(name.toLowerCase(), {
          name: name,
          phone: b.customer_phone?.trim() || ''
        });
      }
    });

    // 3. Get existing customers to avoid duplicates
    const { data: existing, error: existingError } = await supabase
      .from('customers')
      .select('name');

    if (existingError) throw existingError;
    const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

    // 4. Prepare new customers for insertion
    const toInsert = Array.from(uniqueMap.values())
      .filter(c => !existingNames.has(c.name.toLowerCase()));

    if (toInsert.length === 0) return { count: 0, error: null };

    // 5. Insert new customers
    const { data, error: insertError } = await supabase
      .from('customers')
      .insert(toInsert);

    if (insertError) throw insertError;

    return { count: toInsert.length, error: null };
  } catch (error) {
    console.error('Error syncing customers:', error);
    return { count: 0, error };
  }
}

export async function ensureCustomer(name, phone) {
  if (!name) return null;
  if (IS_MOCK) return null;

  try {
    const cleanName = name.trim();
    const cleanPhone = phone?.trim() || '';

    // 1. If phone is provided, check by phone first (to prevent duplicate numbers with different names)
    if (cleanPhone) {
      const { data: existingByPhone } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();
      
      if (existingByPhone) {
        return existingByPhone;
      }
    }

    // 2. If no phone provided, or phone not found, check by name
    const { data: existingByName, error: checkError } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', cleanName)
      .maybeSingle();

    if (existingByName) {
      // Update phone if it was empty before and we have one now
      if (cleanPhone && !existingByName.phone) {
        const { data: updated } = await supabase
          .from('customers')
          .update({ phone: cleanPhone })
          .eq('id', existingByName.id)
          .select()
          .single();
        return updated || existingByName;
      }
      return existingByName;
    }

    // 3. Create new customer if neither phone nor name matches
    const { data: created, error: insertError } = await supabase
      .from('customers')
      .insert([{ name: cleanName, phone: cleanPhone }])
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  } catch (error) {
    console.error('Error ensuring customer:', error);
    return null;
  }
}
