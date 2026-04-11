import { create } from 'zustand';

export const useBillStore = create((set, get) => ({
  items: [], // [{ product, quantity }]
  customerName: '',
  customerPhone: '',
  discount: 0,
  editingId: null, // Track the bill being edited
  editingBillNumber: null, // Track the original bill number
  isSaved: false,

  // ── Actions ──────────────────────────────────────────────────────────────────
  addItem: (product) => {
    const { items } = get();
    const existing = items.find(i => i.product.id === product.id);
    if (existing) {
      set({
        items: items.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      });
    } else {
      set({ items: [...items, { product, quantity: 1 }], isSaved: false });
    }
  },

  decrementItem: (productId) => {
    const { items } = get();
    const existing = items.find(i => i.product.id === productId);
    if (!existing) return;
    
    if (existing.quantity <= 1) {
      set({ items: items.filter(i => i.product.id !== productId), isSaved: false });
    } else {
      set({
        items: items.map(i =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        ),
        isSaved: false
      });
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.product.id !== productId), isSaved: false });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter(i => i.product.id !== productId) });
    } else {
      set({
        items: get().items.map(i =>
          i.product.id === productId ? { ...i, quantity } : i
        ),
      });
    }
  },

  updateRate: (productId, rate) => {
    set({
      items: get().items.map(i =>
        i.product.id === productId ? { ...i, product: { ...i.product, wholesale_rate: Number(rate) || 0 } } : i
      ),
      isSaved: false
    });
  },

  setCustomerName: (name) => set({ customerName: name, isSaved: false }),
  setCustomerPhone: (phone) => set({ customerPhone: phone, isSaved: false }),
  setDiscount: (discount) => set({ discount: Number(discount) || 0, isSaved: false }),
  setIsSaved: (val) => set({ isSaved: val }),

  loadBill: (bill) => {
    // Map and de-duplicate bill_items by product_id
    const itemsMap = {};
    (bill.bill_items || []).forEach(bi => {
      const pid = bi.product_id;
      if (itemsMap[pid]) {
        itemsMap[pid].quantity += (bi.quantity || 0);
      } else {
        itemsMap[pid] = {
          product: {
            id: pid,
            name: bi.product_name,
            wholesale_rate: Number(bi.rate) || 0,
            mrp: Number(bi.mrp) || 0,
            unit: bi.unit || '',
          },
          quantity: bi.quantity || 0,
        };
      }
    });

    set({
      items: Object.values(itemsMap),
      customerName: bill.customer_name || '',
      customerPhone: bill.customer_phone || '',
      discount: Number(bill.discount) || 0,
      editingId: bill.id,
      editingBillNumber: bill.bill_number,
      isSaved: true,
    });
  },

  clearBill: () => set({ 
    items: [], 
    customerName: '', 
    customerPhone: '', 
    discount: 0, 
    editingId: null, 
    editingBillNumber: null,
    isSaved: false 
  }),

  // ── Computed ─────────────────────────────────────────────────────────────────
  getSubtotal: () => {
    return get().items.reduce(
      (sum, i) => sum + i.product.wholesale_rate * i.quantity,
      0
    );
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    return Math.max(0, subtotal - (get().discount || 0));
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },

  isInCart: (productId) => get().items.some(i => i.product.id === productId),

  getQuantityInCart: (productId) => {
    const item = get().items.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  },
}));
