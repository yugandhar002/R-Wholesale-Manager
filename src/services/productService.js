import { supabase, IS_MOCK } from '../lib/supabase';
import { getCachedData, setCachedData, CACHE_KEYS } from './cacheService';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_PRODUCTS = [
  { id: '1', name: 'Basmati Rice (5kg)', category: 'Grains', mrp: 380, wholesale_rate: 320, unit: 'Bag' },
  { id: '2', name: 'Whole Wheat Flour (10kg)', category: 'Grains', mrp: 340, wholesale_rate: 280, unit: 'Bag' },
  { id: '3', name: 'Toor Dal (1kg)', category: 'Pulses', mrp: 175, wholesale_rate: 145, unit: 'Kg' },
  { id: '4', name: 'Chana Dal (1kg)', category: 'Pulses', mrp: 135, wholesale_rate: 110, unit: 'Kg' },
  { id: '5', name: 'Moong Dal (1kg)', category: 'Pulses', mrp: 155, wholesale_rate: 130, unit: 'Kg' },
  { id: '6', name: 'Refined Sunflower Oil (1L)', category: 'Oils', mrp: 150, wholesale_rate: 125, unit: 'Bottle' },
  { id: '7', name: 'Mustard Oil (1L)', category: 'Oils', mrp: 170, wholesale_rate: 140, unit: 'Bottle' },
  { id: '8', name: 'Groundnut Oil (1L)', category: 'Oils', mrp: 200, wholesale_rate: 165, unit: 'Bottle' },
  { id: '9', name: 'Sugar (1kg)', category: 'Essentials', mrp: 50, wholesale_rate: 42, unit: 'Kg' },
  { id: '10', name: 'Salt (1kg)', category: 'Essentials', mrp: 22, wholesale_rate: 18, unit: 'Kg' },
  { id: '11', name: 'Turmeric Powder (100g)', category: 'Spices', mrp: 35, wholesale_rate: 28, unit: 'Pack' },
  { id: '12', name: 'Red Chilli Powder (100g)', category: 'Spices', mrp: 45, wholesale_rate: 35, unit: 'Pack' },
  { id: '13', name: 'Coriander Powder (100g)', category: 'Spices', mrp: 30, wholesale_rate: 22, unit: 'Pack' },
  { id: '14', name: 'Cumin Seeds (100g)', category: 'Spices', mrp: 55, wholesale_rate: 45, unit: 'Pack' },
  { id: '15', name: 'Black Pepper (50g)', category: 'Spices', mrp: 70, wholesale_rate: 55, unit: 'Pack' },
  { id: '16', name: 'Tea (250g)', category: 'Beverages', mrp: 105, wholesale_rate: 85, unit: 'Pack' },
  { id: '17', name: 'Coffee (100g)', category: 'Beverages', mrp: 145, wholesale_rate: 120, unit: 'Pack' },
  { id: '18', name: 'Poha (500g)', category: 'Breakfast', mrp: 48, wholesale_rate: 38, unit: 'Pack' },
  { id: '19', name: 'Vermicelli (200g)', category: 'Breakfast', mrp: 28, wholesale_rate: 22, unit: 'Pack' },
  { id: '20', name: 'Semolina / Rava (500g)', category: 'Grains', mrp: 40, wholesale_rate: 32, unit: 'Pack' },
];

const MOCK_CATEGORIES = ['All', 'Grains', 'Pulses', 'Oils', 'Essentials', 'Spices', 'Beverages', 'Breakfast'];

// ─── HELPER: Filter cached products locally ───────────────────────────────────
function filterProductsLocally(products, query = '', category = 'All') {
  let results = [...products];
  if (category && category !== 'All') {
    results = results.filter(p => p.category === category);
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(q));
    results.sort((a, b) => (a.mrp || 0) - (b.mrp || 0));
  } else {
    results.sort((a, b) => a.name.localeCompare(b.name));
  }
  return results;
}

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

export async function searchProducts(query = '', category = 'All', onFreshData = null) {
  if (IS_MOCK) {
    const results = filterProductsLocally(MOCK_PRODUCTS, query, category);
    return { data: results, error: null };
  }

  // 1. ALWAYS try cache first for instant results (works offline!)
  const cached = await getCachedData(CACHE_KEYS.PRODUCTS);
  if (cached) {
    const cachedResults = filterProductsLocally(cached, query, category);
    if (onFreshData) {
      onFreshData({ data: cachedResults });
    }
  }

  // 2. Try network fetch — with timeout to avoid hanging offline
  try {
    let q = supabase.from('products').select('*');
    if (query.trim()) {
      q = q.ilike('name', `%${query}%`).order('mrp', { ascending: true });
    } else {
      q = q.order('name');
    }
    if (category && category !== 'All') q = q.eq('category', category);

    // Race with a timeout so offline doesn't hang forever
    const networkPromise = q;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), 5000)
    );

    const { data, error } = await Promise.race([networkPromise, timeoutPromise]);

    if (error) throw error;

    // Background cache update if it was a generic "all" fetch
    if (!query.trim() && category === 'All' && data) {
      setCachedData(CACHE_KEYS.PRODUCTS, data);
    }

    return { data, error: null };
  } catch (networkError) {
    // Network failed (offline or timeout) — return cached data if available
    console.log('Network unavailable, using cached products:', networkError.message);
    if (cached) {
      const cachedResults = filterProductsLocally(cached, query, category);
      return { data: cachedResults, error: null };
    }
    // No cache available either
    return { data: [], error: networkError };
  }
}

/**
 * Get categories relevant to the current search query.
 * When query is provided, only returns categories that have matching products.
 * This way, searching "Himalaya" shows only Himalaya's categories (baby soap, baby powder, etc.)
 */
export async function getCategories(onFreshData, query = '') {
  if (IS_MOCK) {
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchingProducts = MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(q));
      const cats = ['All', ...new Set(matchingProducts.map(p => p.category).filter(Boolean))];
      return { data: cats, error: null };
    }
    return { data: MOCK_CATEGORIES, error: null };
  }

  // 1. Try cache first for instant response
  const cachedProducts = await getCachedData(CACHE_KEYS.PRODUCTS);

  if (query.trim()) {
    // When there's a search query, derive categories from matching products
    // Use cached products for instant filtering
    if (cachedProducts) {
      const q = query.toLowerCase();
      const matchingProducts = cachedProducts.filter(p => p.name.toLowerCase().includes(q));
      const filteredCats = ['All', ...new Set(matchingProducts.map(p => p.category).filter(Boolean))];
      if (onFreshData) onFreshData({ data: filteredCats });
    }

    // Try network for fresh category list based on matching products
    try {
      const networkPromise = supabase
        .from('products')
        .select('category')
        .ilike('name', `%${query}%`)
        .order('category');

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), 5000)
      );

      const { data, error } = await Promise.race([networkPromise, timeoutPromise]);

      if (error) throw error;

      const unique = ['All', ...new Set(data.map(r => r.category).filter(Boolean))];
      return { data: unique, error: null };
    } catch (networkError) {
      console.log('Network unavailable for categories, using cached data:', networkError.message);
      // Fall back to cache-derived categories
      if (cachedProducts) {
        const q = query.toLowerCase();
        const matchingProducts = cachedProducts.filter(p => p.name.toLowerCase().includes(q));
        const filteredCats = ['All', ...new Set(matchingProducts.map(p => p.category).filter(Boolean))];
        return { data: filteredCats, error: null };
      }
      return { data: ['All'], error: null };
    }
  }

  // No query — return all categories
  if (onFreshData) {
    const cachedCats = await getCachedData(CACHE_KEYS.CATEGORIES);
    if (cachedCats) onFreshData({ data: cachedCats });
  }

  try {
    const networkPromise = supabase
      .from('products')
      .select('category')
      .order('category');

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), 5000)
    );

    const { data, error } = await Promise.race([networkPromise, timeoutPromise]);

    if (error) throw error;

    const unique = ['All', ...new Set(data.map(r => r.category).filter(Boolean))];
    setCachedData(CACHE_KEYS.CATEGORIES, unique);
    return { data: unique, error: null };
  } catch (networkError) {
    console.log('Network unavailable for categories, using cached data:', networkError.message);
    const cachedCats = await getCachedData(CACHE_KEYS.CATEGORIES);
    if (cachedCats) return { data: cachedCats, error: null };
    return { data: ['All'], error: null };
  }
}

export async function getAllProducts(onFreshData) {
  if (IS_MOCK) {
    return { data: [...MOCK_PRODUCTS].sort((a, b) => a.name.localeCompare(b.name)), error: null };
  }

  // 1. FAST RENDER from cache
  if (onFreshData) {
    const cached = await getCachedData(CACHE_KEYS.PRODUCTS);
    if (cached) onFreshData({ data: cached });
  }

  // 2. NETWORK FETCH with timeout
  try {
    const networkPromise = supabase.from('products').select('*').order('name');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), 5000)
    );

    const { data, error } = await Promise.race([networkPromise, timeoutPromise]);

    if (error) throw error;

    // 3. BACKGROUND UPDATE
    if (data) {
      await setCachedData(CACHE_KEYS.PRODUCTS, data);
      if (onFreshData) onFreshData({ data });
    }

    return { data, error };
  } catch (networkError) {
    console.log('Network unavailable, using cached products:', networkError.message);
    const cached = await getCachedData(CACHE_KEYS.PRODUCTS);
    if (cached) return { data: cached, error: null };
    return { data: [], error: networkError };
  }
}

export async function addProduct(product) {
  if (IS_MOCK) {
    const newProduct = { ...product, id: String(Date.now()) };
    MOCK_PRODUCTS.push(newProduct);
    return { data: newProduct, error: null };
  }
  const result = await supabase.from('products').insert([product]).select().single();
  // Clear cache to force refresh on next load
  if (!result.error) {
    // Ideally we would prepend to cache, but simple approach is to trigger a refetch
    // For now we just let the next network call heal the cache
  }
  return result;
}

export async function updateProduct(id, updates) {
  if (IS_MOCK) {
    const idx = MOCK_PRODUCTS.findIndex(p => p.id === id);
    if (idx > -1) Object.assign(MOCK_PRODUCTS[idx], updates);
    return { data: MOCK_PRODUCTS[idx], error: null };
  }
  return await supabase.from('products').update(updates).eq('id', id).select().single();
}

export async function deleteProduct(id) {
  if (IS_MOCK) {
    const idx = MOCK_PRODUCTS.findIndex(p => p.id === id);
    if (idx > -1) MOCK_PRODUCTS.splice(idx, 1);
    return { error: null };
  }
  return await supabase.from('products').delete().eq('id', id);
}
