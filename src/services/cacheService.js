import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
  PRODUCTS: 'cache_products',
  CATEGORIES: 'cache_categories',
  RECENT_BILLS: 'cache_recent_bills',
  SALES_STATS: 'cache_sales_stats',
  SALES_HISTORY: 'cache_sales_history',
  CUSTOMERS: 'cache_customers',
  OFFLINE_BILLS: 'offline_queue_bills',
};

// Queue Helpers
export async function pushToOfflineQueue(key, item) {
  try {
    const existing = await getCachedData(key) || [];
    await setCachedData(key, [...existing, item]);
  } catch (err) {
    console.error('Error pushing to queue:', err);
  }
}

export async function removeFormOfflineQueue(key, itemId) {
  try {
    const existing = await getCachedData(key) || [];
    await setCachedData(key, existing.filter(i => i.id !== itemId));
  } catch (err) {
    console.error('Error removing from queue:', err);
  }
}

// Expiration time in milliseconds (e.g., 24 hours)
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

export async function setCachedData(key, data) {
  try {
    const payload = {
      timestamp: Date.now(),
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.error(`Error writing cache for ${key}:`, error);
  }
}

export async function getCachedData(key, checkExpiry = false) {
  try {
    const jsonStr = await AsyncStorage.getItem(key);
    if (!jsonStr) return null;

    const payload = JSON.parse(jsonStr);
    
    if (checkExpiry) {
      if (Date.now() - payload.timestamp > CACHE_EXPIRY) {
        // Cache expired
        await AsyncStorage.removeItem(key);
        return null;
      }
    }
    
    return payload.data;
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return null;
  }
}

export async function clearCache() {
  try {
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}
