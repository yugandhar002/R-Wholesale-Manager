import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  StatusBar, TouchableOpacity, Alert, Share, Platform, Linking,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import GlassButton from '../components/GlassButton';
import { useBillStore } from '../store/billStore';
import { saveBill, updateBill, generateBillNumber } from '../services/billService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

export default function BillPreviewScreen({ navigation, route }) {
  const pastBill = route.params?.bill;
  const editingId = useBillStore(s => s.editingId);
  const editingBillNumber = useBillStore(s => s.editingBillNumber);
  const storeItems = useBillStore(s => s.items);
  const storeCustomer = useBillStore(s => s.customerName);
  const storePhone = useBillStore(s => s.customerPhone);
  const storeDiscount = useBillStore(s => s.discount);
  const storeSubtotal = useBillStore(s => s.getSubtotal());
  const storeTotal = useBillStore(s => s.getTotal());
  const clearBill = useBillStore(s => s.clearBill);
  const setIsSaved = useBillStore(s => s.setIsSaved);
  const loadBill = useBillStore(s => s.loadBill);

  // ── Derived Data ──────────────────────────────────────────────────────────
  const isEditing = !!editingId;
  const isViewing = !!pastBill && !isEditing;

  const billItems = isViewing ? (pastBill.bill_items || []) : storeItems;
  const custName = isViewing ? pastBill.customer_name : storeCustomer;
  const custPhone = isViewing ? pastBill.customer_phone : storePhone;
  const billDiscount = isViewing ? (pastBill.discount || 0) : storeDiscount;
  const subtotal = isViewing ? (pastBill.subtotal || pastBill.total_amount) : storeSubtotal;
  const total = isViewing ? pastBill.total_amount : storeTotal;

  // Still need a stable bill number for new bills
  const [sessionBillNo] = useState(() => generateBillNumber());
  const billNo = isViewing ? pastBill.bill_number : (isEditing ? editingBillNumber : sessionBillNo);

  const totalSavings = useMemo(() => {
    return billItems.reduce((sum, i) => {
      const mrp = i.product?.mrp || i.mrp || i.product?.wholesale_rate || i.rate || 0;
      const rate = i.product?.wholesale_rate || i.rate || 0;
      return sum + (mrp - rate) * i.quantity;
    }, 0);
  }, [billItems]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isViewing);

  // Keep saved status in sync for past bills
  useEffect(() => {
    if (isViewing) setSaved(true);
  }, [isViewing]);

  const dateStr = pastBill
    ? new Date(pastBill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const timeStr = pastBill
    ? new Date(pastBill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // ── PDF HTML Template ────────────────────────────────────────────────────────
  const buildHtml = () => {
    const rows = billItems.map(i => {
      const name = i.product_name || i.product?.name;
      const unit = (i.product?.unit) || '';
      const mrp = i.mrp || i.product?.mrp || i.rate || i.product?.wholesale_rate || 0;
      const rate = i.rate || i.product?.wholesale_rate || 0;

      return `
      <tr>
        <td>
          <div style="font-weight:600">${name}</div>
        </td>
        <td style="text-align:center">${unit}</td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:right">₹${mrp.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${rate.toLocaleString('en-IN')}</td>
        <td style="text-align:right;font-weight:700">₹${(rate * i.quantity).toLocaleString('en-IN')}</td>
      </tr>
    `;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #1e293b; padding-bottom: 15px; }
  .shop-info { flex: 1; }
  .shop-name { font-size: 32px; font-weight: 800; color: #0f172a; letter-spacing: -1px; text-transform: uppercase; margin: 0; }
  .shop-sub { color: #64748b; font-size: 11px; margin-top: 4px; font-weight: 500; line-height: 1.5; }
  .address-info { text-align: right; max-width: 250px; }
  .address-text { color: #475569; font-size: 11px; line-height: 1.4; font-weight: 500; }
  .meta { display:flex; justify-content:space-between; margin-bottom: 20px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; }
  .meta-col .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; }
  .meta-col .value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 3px; }
  table { width:100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #1e293b; color: white; padding: 9px 12px; text-align: left; font-size: 12px; }
  td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) { background: #f8fafc; }
  .totals { margin-top: 16px; float: right; width: 240px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals-divider { border-top: 2px solid #1e293b; margin: 8px 0; }
  .total-final { font-size: 18px; font-weight: 800; color: #0f172a; }
  .footer { clear:both; margin-top: 40px; text-align:center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="shop-info">
      <div class="shop-name">RAJESHWARI WHOLESALE</div>
      <div class="shop-sub">
        Ph: 7873574186, 9437067428<br/>
        Email: gkrishna0744@gmail.com
      </div>
    </div>
    <div class="address-info">
      <div class="address-text">
        Infront of kanha xerox, beside Utkal grameen bank,<br/>
        Main road Muniguda, Dist Rayagada
      </div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-col">
      <div class="label">Bill Number</div>
      <div class="value">${billNo}</div>
    </div>
    <div class="meta-col">
      <div class="label">Date & Time</div>
      <div class="value">${dateStr}, ${timeStr}</div>
    </div>
    <div class="meta-col">
      <div class="label">Customer</div>
      <div class="value">${custName || 'Walk-in Customer'}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:35%">Product</th>
        <th style="text-align:center;width:10%">Unit</th>
        <th style="text-align:center;width:8%">Qty</th>
        <th style="text-align:right;width:15%">MRP</th>
        <th style="text-align:right;width:15%">WS Rate</th>
        <th style="text-align:right;width:17%">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
    ${totalSavings > 0 ? `<div class="totals-row"><span style="color:#475569">Wholesale Savings</span><span style="color:#475569">₹${totalSavings.toLocaleString('en-IN')}</span></div>` : ''}
    ${Number(billDiscount) > 0 ? `<div class="totals-row"><span style="color:#0f172a">Additional Discount</span><span style="color:#0f172a">- ₹${Number(billDiscount).toLocaleString('en-IN')}</span></div>` : ''}
    <div class="totals-divider"></div>
    <div class="totals-row"><span class="total-final">Total</span><span class="total-final">₹${total.toLocaleString('en-IN')}</span></div>
  </div>
  <div class="footer">
    This bill is computer generated.<br/>
    Created and owned by <b>Yugandhar Ganteda</b> | Contact: 7205938316
  </div>
</body>
</html>`;
  };

  const goToSelectProducts = useCallback(() => {
    // FULL STACK RESET — ensures no stale screens remain in memory
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'SelectProducts' }],
      })
    );
  }, [navigation]);

  const performSave = async () => {
    if (saved && !editingId) return true;
    setSaving(true);
    
    let result;
    if (editingId) {
      // Update existing bill
      result = await updateBill({
        billId: editingId,
        customerName: custName || 'Walk-in Customer',
        customerPhone: custPhone || '',
        items: billItems,
        subtotal,
        discount: billDiscount,
        total,
        billNumber: billNo,
      });
    } else {
      // Create new bill
      result = await saveBill({
        customerName: custName || 'Walk-in Customer',
        customerPhone: custPhone || '',
        items: billItems,
        subtotal,
        discount: billDiscount,
        total,
        billNumber: billNo,
      });
    }

    setSaving(false);
    if (result.error) {
      Alert.alert('Save Failed', result.error.message);
      return false;
    } else {
      setSaved(true);
      setIsSaved(true);
      clearBill(); // Clear global store for next bill
      return true;
    }
  };

  const handleEdit = () => {
    if (!pastBill) return;
    loadBill(pastBill);
    navigation.navigate('Bill');
  };

  const handleExportPDF = async () => {
    // Auto-save if not already saved
    const isSavedNow = await performSave();
    if (!isSavedNow) return; // Don't proceed if save failed

    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml() });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Bill PDF' });
      } else {
        Alert.alert('PDF Saved', `Bill saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    }
  };


  const handleWhatsAppShare = async () => {
    // Auto-save if not already saved
    const isSavedNow = await performSave();
    if (!isSavedNow) return; // Don't proceed if save failed

    if (!custPhone) {
      Alert.alert('Phone Number Missing', 'Please provide a customer phone number to use direct WhatsApp sharing.');
      return;
    }

    // Clean phone number (remove non-digits, add country code if missing)
    let cleaned = custPhone.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned; // Assume India if 10 digits

    // Build detailed items list in requested format
    const itemsSection = billItems.map(item => {
      const name = (item.product?.name || item.product_name || '').trim();
      const qty = item.quantity;
      const rate = item.product?.wholesale_rate || item.rate || 0;
      const mrp = item.product?.mrp || item.mrp || 0;
      const amt = rate * qty;

      return `*${name}*\nQty: ${qty}   Mrp: ₹${mrp}   WS: ₹${rate}   Amt: ₹${amt.toLocaleString('en-IN')}`;
    }).join('\n\n');

    const message = ` *RAJESHWARI WHOLESALE* (7873574186)\n\n` +
      `${itemsSection}\n` +
      `---------------------------------------------\n` +
      `*Total Amount: ₹${total.toLocaleString('en-IN')}*\n` +
      `---------------------------------------------\n` +
      `Thank you for shopping!\n` +
      `Visit Again`;

    const url = `whatsapp://send?phone=${cleaned}&text=${encodeURIComponent(message)}`;

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Error', 'WhatsApp is not installed on this device.');
      }
    });
  };

  const handleNewBill = () => {
    goToSelectProducts();
  };

  const handleBack = () => {
    if (pastBill) {
      // If we're viewing a past bill, return to the previous tab (History/Home)
      navigation.navigate('HomeTab');
    } else if (saved) {
      // If we just saved a new bill, reset the current stack to start fresh
      goToSelectProducts();
    } else {
      // Default behavior for in-progress bills
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[
        styles.header,
        Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight || 0) + SPACING.md }
      ]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pastBill ? 'Bill Detail' : 'Review Bill'}</Text>
        {pastBill && (
          <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleExportPDF} style={styles.pdfBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Bill Document */}
        <View style={styles.billDoc}>
          {/* Bill header */}
          <View style={styles.docHeaderContainer}>
            <LinearGradient
              colors={['#6C3FE8', '#8E2DE2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.docHeaderPill}
            >
              <Text style={styles.docShopName}>RAJESHWARI WHOLESALE</Text>
            </LinearGradient>
            <Text style={styles.docSub}>{billNo}  •  {dateStr}</Text>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>BILL NUMBER</Text>
              <Text style={styles.metaValue}>{billNo}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>DATE</Text>
              <Text style={styles.metaValue}>{dateStr}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>TIME</Text>
              <Text style={styles.metaValue}>{timeStr}</Text>
            </View>
          </View>

          {/* Customer */}
          <View style={styles.customerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.customerName}>{custName || 'Walk-in Customer'}</Text>
            </View>
            {custPhone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="call-outline" size={16} color={COLORS.textLight} style={{ marginRight: 4 }} />
                <Text style={[styles.metaValue, { fontSize: 13 }]}>{custPhone}</Text>
              </View>
            ) : null}
          </View>

          {/* Modern Item List (Stacked) */}
          <View style={styles.itemListContainer}>
            {billItems.map((item, idx) => {
              const name = item.product_name || item.product?.name;
              const unit = item.product?.unit || '';
              const mrp = item.mrp || item.product?.mrp || item.rate || item.product?.wholesale_rate || 0;
              const rate = item.rate || item.product?.wholesale_rate || 0;
              const amt = rate * item.quantity;

              return (
                <View key={item.id || item.product?.id || idx} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemDetail}>
                        Qty: <Text style={styles.itemValue}>{item.quantity}</Text>
                        {unit ? ` ${unit}` : ''}
                      </Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.itemDetail}>
                        Rate: <Text style={styles.itemValue}>₹{rate}</Text>
                      </Text>
                      {mrp > rate && (
                        <>
                          <View style={styles.metaDot} />
                          <Text style={[styles.itemDetail, { textDecorationLine: 'line-through' }]}>
                            ₹{mrp}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.itemTotal}>
                    <Text style={styles.itemTotalText}>₹{amt.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₹{subtotal.toLocaleString('en-IN')}</Text>
            </View>
            {totalSavings > 0 && (
              <View style={styles.savingsPill}>
                <Ionicons name="gift" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.savingsText}>You saved ₹{totalSavings.toLocaleString('en-IN')} on this bill!</Text>
              </View>
            )}
            {billDiscount > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: COLORS.success }]}>Extra Discount</Text>
                <Text style={[styles.totalValue, { color: COLORS.success }]}>- ₹{Number(billDiscount).toLocaleString('en-IN')}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandLabel}>TOTAL PAYABLE</Text>
              <LinearGradient colors={COLORS.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.grandBadge}>
                <Text style={styles.grandAmount}>₹{total.toLocaleString('en-IN')}</Text>
              </LinearGradient>
            </View>
          </View>

        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <GlassButton
            title="Export / PDF"
            variant="primary"
            size="md"
            icon={<Ionicons name="share-outline" size={16} color={COLORS.white} />}
            onPress={handleExportPDF}
            style={styles.actionBtn}
          />
          <GlassButton
            title="WhatsApp"
            variant="glass"
            size="md"
            icon={<Ionicons name="logo-whatsapp" size={16} color="#25D366" />}
            onPress={handleWhatsAppShare}
            style={[styles.actionBtn, { borderColor: '#25D366' }]}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingVertical: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: COLORS.glassBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.glassBorder, marginRight: SPACING.md,
  },
  headerTitle: { flex: 1, fontSize: FONTS.sizes.xl, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  pdfBtn: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: COLORS.glassButtonBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.glassButtonBorder,
    marginLeft: SPACING.md,
  },
  editBtn: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: COLORS.glassButtonBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.glassButtonBorder,
    marginLeft: SPACING.md,
  },
  billDoc: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.card,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  docHeaderContainer: { alignItems: 'center', paddingVertical: SPACING.xl, backgroundColor: '#FAFAFF' },
  docHeaderPill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xs,
    marginBottom: 4,
  },
  docShopName: { fontSize: 16, color: COLORS.white, fontWeight: FONTS.weights.heavy, letterSpacing: 1.2 },
  docSub: { fontSize: 10, color: COLORS.textLight, fontWeight: FONTS.weights.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderColor: '#F5F5F7',
  },
  metaBlock: { flex: 1 },
  metaLabel: { fontSize: 9, color: COLORS.textLight, fontWeight: FONTS.weights.bold, letterSpacing: 0.8 },
  metaValue: { fontSize: 11, color: COLORS.textDark, fontWeight: FONTS.weights.semibold, marginTop: 1 },
  customerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm,
    backgroundColor: '#FAFAFF',
  },
  customerName: { fontSize: 13, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  divider: { height: 1.5, backgroundColor: COLORS.divider, marginHorizontal: SPACING.lg, opacity: 0.5 },

  // New Item List
  itemListContainer: { paddingVertical: SPACING.md },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F9F9FB',
    alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, color: COLORS.textDark, fontWeight: FONTS.weights.bold, lineHeight: 20 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  itemDetail: { fontSize: 11, color: COLORS.textLight, fontWeight: FONTS.weights.medium },
  itemValue: { color: COLORS.textMid, fontWeight: FONTS.weights.bold },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.divider, mx: 8, marginHorizontal: 8 },
  itemTotal: { paddingLeft: SPACING.md, alignItems: 'flex-end' },
  itemTotalText: { fontSize: 15, color: COLORS.primary, fontWeight: FONTS.weights.bold },

  totalsSection: {
    backgroundColor: '#FAFAFF',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xl,
    borderTopWidth: 1.5, borderTopColor: '#EEEEF5',
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  savingsText: { fontSize: 12, color: COLORS.primary, fontWeight: FONTS.weights.bold },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  totalLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textMid, fontWeight: FONTS.weights.medium },
  totalValue: { fontSize: FONTS.sizes.sm, color: COLORS.textDark, fontWeight: FONTS.weights.semibold },
  grandTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: SPACING.sm,
  },
  grandLabel: { fontSize: FONTS.sizes.md, color: COLORS.textDark, fontWeight: FONTS.weights.heavy, letterSpacing: 0.5 },
  grandBadge: { borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  grandAmount: { fontSize: FONTS.sizes.xl, color: COLORS.white, fontWeight: FONTS.weights.heavy },
  thankYou: {
    textAlign: 'center', fontSize: FONTS.sizes.sm, color: COLORS.textLight,
    paddingTop: SPACING.lg, fontStyle: 'italic',
  },
  creditsContainer: {
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  creditText: {
    fontSize: 10,
    color: COLORS.textLight,
    opacity: 0.8,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  actionBtn: { flex: 1 },
});
