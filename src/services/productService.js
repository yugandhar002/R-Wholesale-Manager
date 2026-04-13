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

// ─── SERVICE FUNCTIONS ────────────────────────────────────────────────────────

export async function searchProducts(query = '', category = 'All', onFreshData = null) {
  if (IS_MOCK) {
    let results = [...MOCK_PRODUCTS];
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
    return { data: results, error: null };
  }

  // Optional fast read for non-query searches
  if (!query.trim() && onFreshData) {
    const cached = await getCachedData(CACHE_KEYS.PRODUCTS);
    if (cached) {
      let results = cached;
      if (category && category !== 'All') {
         results = results.filter(p => p.category === category);
      }
      onFreshData({ data: results });
    }
  }

  let q = supabase.from('products').select('*');
  if (query.trim()) {
    q = q.ilike('name', `%${query}%`).order('mrp', { ascending: true });
  } else {
    q = q.order('name');
  }
  if (category && category !== 'All') q = q.eq('category', category);
  
  const { data, error } = await q;
  // Background cache update if it was a generic "all" fetch
  if (!query.trim() && category === 'All' && data) {
    setCachedData(CACHE_KEYS.PRODUCTS, data);
  }
  
  return { data, error };
}

export async function getCategories(onFreshData) {
  if (IS_MOCK) return { data: MOCK_CATEGORIES, error: null };

  if (onFreshData) {
    const cached = await getCachedData(CACHE_KEYS.CATEGORIES);
    if (cached) onFreshData({ data: cached });
  }

  const { data, error } = await supabase
    .from('products')
    .select('category')
    .order('category');

  if (error) return { data: [], error };
  const unique = ['All', ...new Set(data.map(r => r.category).filter(Boolean))];
  
  setCachedData(CACHE_KEYS.CATEGORIES, unique);
  return { data: unique, error: null };
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

  // 2. NETWORK FETCH
  const { data, error } = await supabase.from('products').select('*').order('name');
  
  // 3. BACKGROUND UPDATE
  if (data) {
    await setCachedData(CACHE_KEYS.PRODUCTS, data);
    if (onFreshData) onFreshData({ data });
  }
  
  return { data, error };
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
