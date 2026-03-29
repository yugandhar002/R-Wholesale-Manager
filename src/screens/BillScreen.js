import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  StatusBar, TouchableOpacity, TextInput, Alert, Platform, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BillItem from '../components/BillItem';
import GlassButton from '../components/GlassButton';
import { useBillStore } from '../store/billStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';
import { searchCustomers } from '../services/billService';

export default function BillScreen({ navigation }) {
  const items = useBillStore(s => s.items);
  const customerName = useBillStore(s => s.customerName);
  const customerPhone = useBillStore(s => s.customerPhone);
  const discount = useBillStore(s => s.discount);
  const setCustomerName = useBillStore(s => s.setCustomerName);
  const setCustomerPhone = useBillStore(s => s.setCustomerPhone);
  const setDiscount = useBillStore(s => s.setDiscount);
  const updateQuantity = useBillStore(s => s.updateQuantity);
  const removeItem = useBillStore(s => s.removeItem);
  const getSubtotal = useBillStore(s => s.getSubtotal);
  const getTotal = useBillStore(s => s.getTotal);

  const subtotal = getSubtotal();
  const total = getTotal();

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const isSelectionRef = useRef(false);

  useEffect(() => {
    // If name was just selected from the list, skip fetching suggestions again
    if (isSelectionRef.current) {
      isSelectionRef.current = false;
      return;
    }

    const fetchSuggestions = async () => {
      if (customerName.length >= 2) {
        const { data, error } = await searchCustomers(customerName);
        if (!error && data) {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 350);
    return () => clearTimeout(timeoutId);
  }, [customerName]);

  // Robust visibility check for the footer
  useEffect(() => {
    if (contentHeight > 0 && layoutHeight > 0) {
      // If the entire content fits on the screen (no scrolling needed),
      // we show the footer immediately so the user can generate the bill.
      if (contentHeight <= layoutHeight + 20) {
        setIsFooterVisible(true);
      }
    }
  }, [contentHeight, layoutHeight, items.length]);

  const handleUpdateQuantity = useCallback((id, qty) => {
    updateQuantity(id, qty);
  }, [updateQuantity]);

  const handleRemoveItem = useCallback((id) => {
    removeItem(id);
  }, [removeItem]);

  const handleSelectCustomer = useCallback((cust) => {
    isSelectionRef.current = true;
    setCustomerName(cust.customer_name);
    if (cust.customer_phone) {
      setCustomerPhone(cust.customer_phone);
    }
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, [setCustomerName, setCustomerPhone]);

  const handleGenerateBill = useCallback(() => {
    if (items.length === 0) {
      Alert.alert('Empty Bill', 'Please add at least one product.');
      return;
    }
    // Use 'replace' so BillPreview replaces Bill in the stack.
    // This prevents Bill from piling up behind BillPreview on every bill creation.
    navigation.replace('BillPreview');
  }, [items.length, navigation]);

  const handleClearBill = () => {
    Alert.alert('Clear Bill', 'Remove all items from this bill?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          useBillStore.getState().clearBill();
          navigation.navigate('SelectProducts');
        }
      },
    ]);
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    // Show footer once user has scrolled to the bottom (where total payable is)
    // We add a small buffer (50px) to trigger it slightly before the absolute end
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (isAtBottom !== isFooterVisible) {
      setIsFooterVisible(isAtBottom);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ─────────────────────────────────────── */}
      <View style={[
        styles.header,
        { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Bill</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearBill} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
          onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(w, h) => setContentHeight(h)}
        >
          {/* ── Customer + Discount ─────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Customer Details</Text>
            <View style={{ zIndex: 10 }}>
              <View style={styles.inputCard}>
                <Ionicons name="person-outline" size={18} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Customer name (optional)"
                  placeholderTextColor={COLORS.textLight}
                  value={customerName}
                  onChangeText={setCustomerName}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
              </View>

              {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.suggestionItem,
                        index !== suggestions.length - 1 && styles.suggestionBorder
                      ]}
                      onPress={() => handleSelectCustomer(item)}
                    >
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName}>{item.customer_name}</Text>
                        {item.customer_phone && (
                          <Text style={styles.suggestionPhone}>{item.customer_phone}</Text>
                        )}
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.inputCard}>
              <Ionicons name="call-outline" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Phone number (optional)"
                placeholderTextColor={COLORS.textLight}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputCard}>
              <Ionicons name="pricetag-outline" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <Text style={styles.rupeePrefix}>₹</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Discount amount (₹)"
                placeholderTextColor={COLORS.textLight}
                value={discount > 0 ? String(discount) : ''}
                onChangeText={setDiscount}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* ── Item List ───────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.itemsHeader}>
              <Text style={styles.sectionLabel}>
                Items ({items.length})
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('SelectProducts')}
                style={styles.addMoreBtn}
              >
                <Ionicons name="add" size={14} color={COLORS.primary} />
                <Text style={styles.addMoreText}>Add more</Text>
              </TouchableOpacity>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyItems}>
                <Ionicons name="cube-outline" size={40} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No items added yet</Text>
                <GlassButton
                  title="Browse Products"
                  variant="glass"
                  size="sm"
                  onPress={() => navigation.navigate('SelectProducts')}
                />
              </View>
            ) : (
              items.map(item => (
                <BillItem
                  key={item.product.id}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemoveItem}
                />
              ))
            )}
          </View>

          {/* ── Summary ─────────────────────────────────── */}
          {items.length > 0 && (
            <View style={styles.summaryCard}>
              {discount > 0 ? (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: COLORS.success }]}>Discount</Text>
                    <Text style={[styles.summaryValue, { color: COLORS.success }]}>- ₹{Number(discount).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.divider} />
                </>
              ) : null}
              
              <View style={[styles.summaryRow, { marginBottom: 0 }]}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <LinearGradient
                  colors={COLORS.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.totalBadge}
                >
                  <Text style={styles.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
                </LinearGradient>
              </View>
            </View>
          )}

          <View style={{ height: 10 }} />
        </ScrollView>
      </View>

      {/* ── Generate Bill Bar ─────────────────────────── */}
      {items.length > 0 && isFooterVisible && (
        <TouchableOpacity
          onPress={handleGenerateBill}
          style={styles.footerBar}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['rgba(108, 63, 232, 0.85)', 'rgba(0, 210, 255, 0.85)']} // Glass gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.footerGradient}
          >
            <Text style={styles.footerText}>Generate Bill →</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.glassBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginRight: SPACING.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONTS.sizes.xl,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.bold,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(231,76,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMid,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: FONTS.sizes.xs,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glassBg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.subtle,
  },
  inputIcon: { marginRight: SPACING.sm },
  rupeePrefix: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.semibold,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    paddingVertical: 13,
    fontWeight: FONTS.weights.medium,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glassButtonBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.glassButtonBorder,
    gap: 3,
  },
  addMoreText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
    backgroundColor: COLORS.glassBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
    ...SHADOWS.subtle,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    fontWeight: FONTS.weights.medium,
  },
  summaryCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.glassBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
    padding: SPACING.lg,
    ...SHADOWS.card,
    marginBottom: SPACING.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMid,
    fontWeight: FONTS.weights.medium,
  },
  summaryValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.md,
  },
  totalLabel: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.bold,
  },
  totalBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  totalAmount: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.white,
    fontWeight: FONTS.weights.heavy,
  },
  footerBar: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  footerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    height: 64,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderBottomWidth: 0,
  },
  footerText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.white,
    fontWeight: FONTS.weights.bold,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 63, 232, 0.2)',
    ...SHADOWS.card,
    zIndex: 100,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  suggestionPhone: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
});
