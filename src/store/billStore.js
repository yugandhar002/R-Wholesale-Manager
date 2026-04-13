import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BILL_STATE = {
  items: [],
  customerName: '',
  customerPhone: '',
  discount: 0,
  editingId: null,
  editingBillNumber: null,
  isSaved: false,
};

export const useBillStore = create(
  persist(
    (set, get) => ({
      ...DEFAULT_BILL_STATE,
      drafts: {}, // { [id]: billState }
      activeDraftId: null,
      nextDraftNum: 1,

      // ── Actions ──────────────────────────────────────────────────────────────────
      
      createNewDraft: () => {
        const id = `local_${Date.now()}`;
        const draftNum = get().nextDraftNum;
        const newDraft = {
          ...DEFAULT_BILL_STATE,
          customerName: '', // Keep empty as requested
          draftNumber: draftNum,
          updatedAt: Date.now(),
        };

        set((s) => ({
          ...newDraft,
          activeDraftId: id,
          nextDraftNum: s.nextDraftNum + 1,
          drafts: {
            ...s.drafts,
            [id]: newDraft
          }
        }));
        return id;
      },

      switchDraft: (id) => {
        const draft = get().drafts[id];
        if (!draft) return;
        set({
          ...draft,
          activeDraftId: id
        });
      },

      deleteDraft: (id) => {
        set((s) => {
          const { drafts, activeDraftId } = s;
          const newDrafts = { ...drafts };
          delete newDrafts[id];

          let newState = { drafts: newDrafts };

          if (id === activeDraftId) {
            const remainingIds = Object.keys(newDrafts);
            if (remainingIds.length > 0) {
              const nextId = remainingIds[0];
              newState = { ...newState, ...newDrafts[nextId], activeDraftId: nextId };
            } else {
              newState = { ...newState, ...DEFAULT_BILL_STATE, activeDraftId: null };
            }
          }
          return newState;
        });
      },

      _updateStateAndSync: (updater) => {
        set((s) => {
          const nextState = typeof updater === 'function' ? updater(s) : updater;
          // Apply changes to active state
          const updatedActive = { ...s, ...nextState };
          
          // If we have an active draft, sync it into the collection
          if (updatedActive.activeDraftId) {
            const currentData = {
              items: updatedActive.items,
              customerName: updatedActive.customerName,
              customerPhone: updatedActive.customerPhone,
              discount: updatedActive.discount,
              editingId: updatedActive.editingId,
              editingBillNumber: updatedActive.editingBillNumber,
              isSaved: updatedActive.isSaved,
              draftNumber: updatedActive.draftNumber, // Sync draft number
              updatedAt: Date.now(),
            };
            
            return {
              ...nextState,
              drafts: {
                ...s.drafts,
                [updatedActive.activeDraftId]: currentData
              }
            };
          }
          
          return nextState;
        });
      },

      addItem: (product) => {
        const { activeDraftId, createNewDraft, _updateStateAndSync } = get();
        
        let currentActiveId = activeDraftId;
        if (!currentActiveId) {
          currentActiveId = createNewDraft();
        }

        const items = get().items;
        const existing = items.find(i => i.product.id === product.id);
        
        if (existing) {
          _updateStateAndSync({
            items: items.map(i =>
              i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          _updateStateAndSync({ 
            items: [...items, { product, quantity: 1 }], 
            isSaved: false 
          });
        }
      },

      decrementItem: (productId) => {
        const items = get().items;
        const existing = items.find(i => i.product.id === productId);
        if (!existing) return;
        
        if (existing.quantity <= 1) {
          get()._updateStateAndSync({ 
            items: items.filter(i => i.product.id !== productId), 
            isSaved: false 
          });
        } else {
          get()._updateStateAndSync({
            items: items.map(i =>
              i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
            ),
            isSaved: false
          });
        }
      },

      removeItem: (productId) => {
        get()._updateStateAndSync({ 
          items: get().items.filter(i => i.product.id !== productId), 
          isSaved: false 
        });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get()._updateStateAndSync({ items: get().items.filter(i => i.product.id !== productId) });
        } else {
          get()._updateStateAndSync({
            items: get().items.map(i =>
              i.product.id === productId ? { ...i, quantity } : i
            ),
          });
        }
      },

      updateRate: (productId, rate) => {
        get()._updateStateAndSync({
          items: get().items.map(i =>
            i.product.id === productId ? { ...i, product: { ...i.product, wholesale_rate: Number(rate) || 0 } } : i
          ),
          isSaved: false
        });
      },

      setCustomerName: (name) => {
        get()._updateStateAndSync({ customerName: name, isSaved: false });
      },

      setCustomerPhone: (phone) => {
        get()._updateStateAndSync({ customerPhone: phone, isSaved: false });
      },

      setDiscount: (discount) => {
        get()._updateStateAndSync({ discount: Number(discount) || 0, isSaved: false });
      },

      setIsSaved: (val) => {
        get()._updateStateAndSync({ isSaved: val });
      },

      loadBill: (bill) => {
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

        const activeId = bill.id || `edit_${Date.now()}`;
        const draftData = {
          items: Object.values(itemsMap),
          customerName: bill.customer_name || '',
          customerPhone: bill.customer_phone || '',
          discount: Number(bill.discount) || 0,
          editingId: bill.id,
          editingBillNumber: bill.bill_number,
          isSaved: true,
          updatedAt: Date.now(),
        };

        set((s) => ({
          ...draftData,
          activeDraftId: activeId,
          drafts: {
            ...s.drafts,
            [activeId]: draftData
          }
        }));
      },

      clearBill: () => {
        const { activeDraftId } = get();
        if (activeDraftId) {
          get().deleteDraft(activeDraftId);
        } else {
          set(DEFAULT_BILL_STATE);
        }
      },

      // ── Computed Accessors ──
      // Note: Use these inside components with useMemo or select primitives
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
    }),
    {
      name: 'wholesale-bill-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        drafts: state.drafts, 
        activeDraftId: state.activeDraftId,
        nextDraftNum: state.nextDraftNum 
      }),
    }
  )
);
