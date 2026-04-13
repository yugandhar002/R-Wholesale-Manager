import { getCachedData, setCachedData, CACHE_KEYS, removeFormOfflineQueue } from './cacheService';
import { supabase } from '../lib/supabase';
import { ensureCustomer } from './customerService';

export async function processOfflineBills() {
  try {
    const offlineBills = await getCachedData(CACHE_KEYS.OFFLINE_BILLS);
    if (!offlineBills || offlineBills.length === 0) return;

    for (const bill of offlineBills) {
      if (bill.syncing) continue;

      try {
        // Mark as syncing to avoid duplicates if loop fires again
        bill.syncing = true;
        
        // Ensure customer
        const customer = await ensureCustomer(bill.customer_name, bill.customer_phone);
        const cleanName = customer?.name || bill.customer_name.trim();
        const cleanPhone = customer?.phone || bill.customer_phone?.trim();

        // 1. Insert Bill Header
        const { data: insertedBill, error: billError } = await supabase
          .from('bills')
          .insert([{ 
            customer_name: cleanName, 
            customer_phone: cleanPhone,
            customer_id: customer?.id,
            bill_number: bill.bill_number, 
            subtotal: bill.subtotal, 
            discount: bill.discount, 
            total_amount: bill.total_amount 
          }])
          .select('id')
          .single();

        if (billError) throw billError;

        // 2. Insert Bill Items
        if (bill.bill_items && bill.bill_items.length > 0) {
          const lineItems = bill.bill_items.map(item => ({
            ...item,
            bill_id: insertedBill.id,
          }));

          const { error: itemsError } = await supabase
            .from('bill_items')
            .insert(lineItems);
            
          if (itemsError) throw itemsError;
        }

        // 3. Success! Remove from offline queue
        await removeFormOfflineQueue(CACHE_KEYS.OFFLINE_BILLS, bill.id);

        // 4. Force global cache wipes so when user reloads, true data is fetched
        await setCachedData(CACHE_KEYS.RECENT_BILLS, null);
        await setCachedData(CACHE_KEYS.SALES_STATS, null);
        await setCachedData(CACHE_KEYS.SALES_HISTORY, null);

      } catch (err) {
        console.warn('Failed to sync offline bill:', err);
        bill.syncing = false; // Release lock for next try
      }
    }
  } catch (err) {
    console.warn('Error processing offline bills:', err);
  }
}
