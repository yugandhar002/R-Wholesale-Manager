import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import GlassButton from '../components/GlassButton';
import { getRecentBills, getSalesStats } from '../services/billService';
import { useBillStore } from '../store/billStore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

export default function HomeScreen({ navigation }) {
  const [stats, setStats] = useState({ todaySales: 0, billsToday: 0, recentBillsCount: 0 });
  const [recentBills, setRecentBills] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const itemCount = useBillStore(s => s.getItemCount());
  const isSaved = useBillStore(s => s.isSaved);

  const loadData = useCallback(async () => {
    const [statsRes, billsRes] = await Promise.all([
      getSalesStats(),
      getRecentBills(),
    ]);
    if (statsRes.data) setStats(statsRes.data);
    if (billsRes.data) setRecentBills(billsRes.data);
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
      >
        {/* ── Hero Section ──────────────────────────────────── */}
        <LinearGradient
          colors={['#6C3FE8', '#00D2FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back 👋</Text>
              <Text style={styles.shopName}>Wholesale Manager</Text>
            </View>
            <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Products')}>
              <Ionicons name="cube-outline" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{stats.todaySales.toLocaleString('en-IN')}</Text>
              <Text style={styles.statLabel}>Today's Sales</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.billsToday}</Text>
              <Text style={styles.statLabel}>Bills Today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.recentBillsCount}</Text>
              <Text style={styles.statLabel}>Recent Bills</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* ── New Bill CTA ──────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => {
              useBillStore.getState().clearBill();
              // Reset the NewBillTab stack to SelectProducts so nothing is hidden behind it
              navigation.reset({
                index: 0,
                routes: [{
                  name: 'NewBillTab',
                  state: {
                    routes: [{ name: 'SelectProducts' }],
                  },
                }],
              });
            }}
            style={styles.newBillBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#00D2FF', '#3A7BD5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.newBillGradient}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="add" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Create New Bill</Text>
                <Text style={styles.ctaSub}>Tap to select products & generate bill</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Manage Customers CTA ────────────────────────────── */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Customers')}
            style={styles.customersBtn}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8E2DE2', '#4A00E0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.newBillGradient}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="people" size={26} color="#8E2DE2" />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Manage Customers</Text>
                <Text style={styles.ctaSub}>View history, edit names & phone numbers</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Continue Bill (if cart not empty and not saved) ───────────── */}
          {itemCount > 0 && !isSaved && (
            <TouchableOpacity
              onPress={() => navigation.navigate('NewBillTab', { screen: 'Bill' })}
              style={styles.continueBillBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="cart" size={20} color={COLORS.primary} />
              <Text style={styles.continueText}>Finish Current Bill ({itemCount} items)</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          {/* ── Recent Bills ─────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.lg, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => navigation.navigate('SalesHistory')} style={styles.historyBtn}>
                <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                <Text style={styles.historyBtnText}>View History</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={loadData}>
                <Ionicons name="refresh" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {recentBills.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No bills yet</Text>
              <Text style={styles.emptySub}>Your generated bills will appear here</Text>
            </View>
          ) : (
            recentBills.map(bill => (
              <TouchableOpacity
                key={bill.id}
                onPress={() => navigation.navigate('NewBillTab', { screen: 'BillPreview', params: { bill } })}
                activeOpacity={0.8}
              >
                <GlassCard style={styles.billCard}>
                  <View style={styles.billInfo}>
                    <Text style={styles.billCustomer}>{bill.customer_name}</Text>
                    <Text style={styles.billNo}>Bill #{bill.bill_number}</Text>
                  </View>
                  <View style={styles.billMeta}>
                    <Text style={styles.billTotal}>₹{bill.total_amount.toLocaleString('en-IN')}</Text>
                    <Text style={styles.billDate}>{new Date(bill.created_at).toLocaleDateString()}</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  hero: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + SPACING.lg : SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  greeting: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.weights.medium },
  shopName: { fontSize: 32, color: COLORS.white, fontWeight: FONTS.weights.heavy, letterSpacing: -0.5 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 20, color: COLORS.white, fontWeight: FONTS.weights.bold },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  body: { paddingHorizontal: SPACING.xl, marginTop: -30 },
  newBillBtn: { borderRadius: 24, ...SHADOWS.strong, marginBottom: SPACING.lg, overflow: 'hidden' },
  customersBtn: { borderRadius: 24, ...SHADOWS.strong, marginBottom: SPACING.lg, overflow: 'hidden' },
  newBillGradient: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  ctaText: { flex: 1, marginLeft: 16 },
  ctaTitle: { fontSize: 18, color: COLORS.white, fontWeight: FONTS.weights.bold },
  ctaSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  continueBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 16,
    marginBottom: SPACING.lg,
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '20',
  },
  continueText: { color: COLORS.primary, fontWeight: FONTS.weights.bold, fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md, marginTop: SPACING.sm },
  sectionTitle: { fontSize: 20, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  historyBtnText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },
  billCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 12 },
  billInfo: { gap: 4 },
  billCustomer: { fontSize: 16, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  billNo: { fontSize: 12, color: COLORS.textLight },
  billMeta: { alignItems: 'flex-end', gap: 4 },
  billTotal: { fontSize: 16, color: COLORS.primary, fontWeight: FONTS.weights.heavy },
  billDate: { fontSize: 12, color: COLORS.textLight },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 18, color: COLORS.textMid, fontWeight: FONTS.weights.bold, marginTop: 12 },
  emptySub: { fontSize: 14, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
});
