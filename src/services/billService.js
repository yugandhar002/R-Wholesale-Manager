import { supabase, IS_MOCK } from '../lib/supabase';
import { ensureCustomer } from './customerService';
import { getCachedData, setCachedData, CACHE_KEYS, pushToOfflineQueue } from './cacheService';

const getLocalDateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

const MOCK_BILLS = [];

export async function saveBill({ customerName, customerPhone, items, subtotal, discount, total, billNumber }) {
  if (IS_MOCK) {
    const bill = {
      id: String(Date.now()),
      bill_number: billNumber,
      customer_name: customerName,
      customer_phone: customerPhone,
      subtotal,
      discount,
      total_amount: total,
      created_at: new Date().toISOString(),
      bill_items: items.map(i => ({
        product_name: i.product?.name || i.product_name,
        mrp: i.product?.mrp || i.mrp,
        rate: i.product?.wholesale_rate || i.rate,
        quantity: i.quantity,
        subtotal: (i.product?.wholesale_rate || i.rate) * i.quantity,
        unit: i.product?.unit || i.unit || '',
      })),
    };
    MOCK_BILLS.unshift(bill);
    return { data: bill, error: null };
  }

  // Pre-calculate line items to minimize gap between DB calls
  const itemsToSave = items.map(i => ({
    product_id: i.product?.id || i.product_id,
    product_name: i.product?.name || i.product_name,
    mrp: i.product?.mrp || i.mrp || 0,
    rate: i.product?.wholesale_rate || i.rate || 0,
    unit: i.product?.unit || i.unit || '',
    quantity: i.quantity,
    subtotal: (i.product?.wholesale_rate || i.rate || 0) * i.quantity,
  }));

  // Ensure customer exists and get their record
  const customer = await ensureCustomer(customerName, customerPhone);
  const cleanName = customer?.name || customerName.trim();
  const cleanPhone = customer?.phone || customerPhone?.trim();

  // Save the bill header - only select the ID to minimize response size
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .insert([{ 
      customer_name: cleanName, 
      customer_phone: cleanPhone,
      customer_id: customer?.id,
      bill_number: billNumber, 
      subtotal, 
      discount, 
      total_amount: total 
    }])
    .select('id')
    .single();

  if (billError) {
    const isNetworkError = billError.message?.toLowerCase().includes('fetch') || 
                           billError.message?.toLowerCase().includes('network') ||
                           billError.code === 'FetchError';
                           
    if (isNetworkError) {
      console.log('Network error detected. Saving to offline queue.');
      // Create a fake UUID for local UI rendering (starts with offline_ to clearly distinguish)
      const fakeId = `offline_${Date.now()}`;
      
      const offlineBill = {
        id: fakeId,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        customer_id: customer?.id || null,
        bill_number: billNumber,
        subtotal,
        discount,
        total_amount: total,
         // the UI needs created_at
        created_at: new Date().toISOString(),
        bill_items: itemsToSave
      };
      
      // Push to Background Sync Queue
      await pushToOfflineQueue(CACHE_KEYS.OFFLINE_BILLS, offlineBill);
      
      // Also inject into RECENT_BILLS cache so the Home Screen sees it instantly!
      const existingRecent = await getCachedData(CACHE_KEYS.RECENT_BILLS) || [];
      await setCachedData(CACHE_KEYS.RECENT_BILLS, [offlineBill, ...existingRecent]);
      
      return { data: offlineBill, error: null };
    }
    
    return { data: null, error: billError };
  }

  // Attach bill_id to pre-mapped items
  const lineItems = itemsToSave.map(item => ({ ...item, bill_id: bill.id }));

  const { error: itemsError } = await supabase
    .from('bill_items')
    .insert(lineItems);
  if (itemsError) return { data: null, error: itemsError };

  // Clear caches so next load instantly fetches fresh data instead of stale cache
  await setCachedData(CACHE_KEYS.RECENT_BILLS, null);
  await setCachedData(CACHE_KEYS.SALES_STATS, null);
  await setCachedData(CACHE_KEYS.SALES_HISTORY, null);

  return { data: bill, error: null };
}

export async function updateBill({ billId, customerName, customerPhone, items, subtotal, discount, total, billNumber }) {
  if (IS_MOCK) {
    const idx = MOCK_BILLS.findIndex(b => b.id === billId);
    if (idx !== -1) {
      MOCK_BILLS[idx] = {
        ...MOCK_BILLS[idx],
        customer_name: customerName,
        customer_phone: customerPhone,
        subtotal,
        discount,
        total_amount: total,
        bill_items: items.map(i => ({
          product_id: i.product?.id || i.product_id,
          product_name: i.product?.name || i.product_name,
          mrp: i.product?.mrp || i.mrp || 0,
          rate: i.product?.wholesale_rate || i.rate || 0,
          unit: i.product?.unit || i.unit || '',
          quantity: i.quantity,
          subtotal: (i.product?.wholesale_rate || i.rate || 0) * i.quantity,
        })),
      };
      return { data: MOCK_BILLS[idx], error: null };
    }
    return { data: null, error: { message: 'Bill not found' } };
  }

  try {
    // 1. Ensure customer exists/links
    const customer = await ensureCustomer(customerName, customerPhone);
    const cleanName = customer?.name || customerName.trim();
    const cleanPhone = customer?.phone || customerPhone?.trim();

    // 2. Update the bill header
    const { error: billError } = await supabase
      .from('bills')
      .update({
        customer_id: customer?.id,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        subtotal,
        discount,
        total_amount: total,
        // bill_number stays the same
      })
      .eq('id', billId);

    if (billError) throw billError;

    // 3. Delete old items
    const { error: deleteError } = await supabase
      .from('bill_items')
      .delete()
      .eq('bill_id', billId);

    if (deleteError) throw deleteError;

    // 4. Insert new items
    const itemsToSave = items.map(i => ({
      bill_id: billId,
      product_id: i.product?.id || i.product_id,
      product_name: i.product?.name || i.product_name,
      mrp: i.product?.mrp || i.mrp || 0,
      rate: i.product?.wholesale_rate || i.rate || 0,
      unit: i.product?.unit || i.unit || '',
      quantity: i.quantity,
      subtotal: (i.product?.wholesale_rate || i.rate || 0) * i.quantity,
    }));

    const { error: itemsError } = await supabase
      .from('bill_items')
      .insert(itemsToSave);

    if (itemsError) throw itemsError;

    return { error: null };
  } catch (error) {
    console.error('Error updating bill:', error);
    return { error };
  }
}

export async function getRecentBills(limit = 10, onFreshData = null) {
  if (IS_MOCK) {
    return { data: MOCK_BILLS.slice(0, limit), error: null };
  }

  if (onFreshData) {
    const cached = await getCachedData(CACHE_KEYS.RECENT_BILLS);
    if (cached) onFreshData({ data: cached });
  }

  const { data, error } = await supabase
    .from('bills')
    .select('*, bill_items(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (data) {
    await setCachedData(CACHE_KEYS.RECENT_BILLS, data);
    if (onFreshData) onFreshData({ data });
  }

  return { data, error };
}

export async function getSalesStats(onFreshData = null) {
  if (IS_MOCK) {
    const today = getLocalDateString(new Date());
    const todayBills = MOCK_BILLS.filter(b => getLocalDateString(b.created_at) === today);
    const todaySales = todayBills.reduce((sum, b) => sum + b.total_amount, 0);
    return {
      data: {
        todaySales,
        billsToday: todayBills.length,
        recentBillsCount: MOCK_BILLS.length,
      },
      error: null,
    };
  }

  if (onFreshData) {
    const cached = await getCachedData(CACHE_KEYS.SALES_STATS);
    if (cached) onFreshData({ data: cached });
  }

  try {
    const { start, end } = getLocalDayRange();
    
    // Get today's bills for totals
    const { data: todayData, error: todayError } = await supabase
      .from('bills')
      .select('total_amount')
      .gte('created_at', start)
      .lte('created_at', end);

    if (todayError) throw todayError;

    // Get total count of all bills
    const { count, error: countError } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    const todaySales = todayData.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    
    const stats = {
      todaySales,
      billsToday: todayData.length,
      recentBillsCount: count || 0,
    };

    await setCachedData(CACHE_KEYS.SALES_STATS, stats);
    if (onFreshData) onFreshData({ data: stats });

    return {
      data: stats,
      error: null,
    };
  } catch (error) {
    console.warn('Error fetching sales stats offline. Using cache.', error.message);
    return { data: { todaySales: 0, billsToday: 0, recentBillsCount: 0 }, error };
  }
}

export async function getDailySalesHistory(onFreshData = null) {
  if (IS_MOCK) {
    // Group MOCK_BILLS by day using local date
    const history = MOCK_BILLS.reduce((acc, bill) => {
      const date = getLocalDateString(bill.created_at);
      if (!acc[date]) {
        acc[date] = { date, total: 0, count: 0, bills: [] };
      }
      acc[date].total += bill.total_amount;
      acc[date].count += 1;
      acc[date].bills.push(bill);
      return acc;
    }, {});
    
    return { 
      data: Object.values(history).sort((a, b) => b.date.localeCompare(a.date)), 
      error: null 
    };
  }

  if (onFreshData) {
    const cached = await getCachedData(CACHE_KEYS.SALES_HISTORY);
    if (cached) onFreshData({ data: cached });
  }

  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const history = data.reduce((acc, bill) => {
      const date = getLocalDateString(bill.created_at);
      if (!acc[date]) {
        acc[date] = { date, total: 0, count: 0, bills: [] };
      }
      acc[date].total += (bill.total_amount || 0);
      acc[date].count += 1;
      acc[date].bills.push(bill);
      return acc;
    }, {});

    const historyArray = Object.values(history);
    await setCachedData(CACHE_KEYS.SALES_HISTORY, historyArray);
    if (onFreshData) onFreshData({ data: historyArray });

    return { 
      data: historyArray, 
      error: null 
    };
  } catch (error) {
    console.warn('Error fetching sales history offline. Using cache.', error.message);
    return { data: [], error };
  }
}

export async function searchCustomers(query) {
  if (!query || query.length < 2) return { data: [], error: null };

  if (IS_MOCK) {
    const unique = [];
    const seen = new Set();
    MOCK_BILLS.forEach(b => {
      if (b.customer_name && b.customer_name.toLowerCase().includes(query.toLowerCase())) {
        if (!seen.has(b.customer_name.toLowerCase())) {
          seen.add(b.customer_name.toLowerCase());
          unique.push({
            customer_name: b.customer_name,
            customer_phone: b.customer_phone
          });
        }
      }
    });
    return { data: unique.slice(0, 5), error: null };
  }

  try {
    const { data, error } = await supabase
      .from('bills')
      .select('customer_name, customer_phone')
      .ilike('customer_name', `%${query}%`)
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Filter unique by name in JS
    const unique = [];
    const seen = new Set();
    data?.forEach(b => {
      const nameKey = b.customer_name.trim().toLowerCase();
      if (!seen.has(nameKey)) {
        seen.add(nameKey);
        unique.push({
          customer_name: b.customer_name.trim(),
          customer_phone: b.customer_phone
        });
      }
    });
    
    return { data: unique.slice(0, 5), error: null };
  } catch (error) {
    console.error('Error searching customers:', error);
    return { data: [], error };
  }
}

export function generateBillNumber() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `BILL-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(Date.now()).slice(-4)}`;
}
