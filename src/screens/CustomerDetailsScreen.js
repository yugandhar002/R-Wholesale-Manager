import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import { getCustomerBills } from '../services/customerService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

export default function CustomerDetailsScreen({ route, navigation }) {
  const { customer } = route.params;
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBills = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getCustomerBills(customer.name, customer.id);
    if (error) {
      console.error('Error fetching customer bills:', error);
    } else {
      setBills(data || []);
    }
    setLoading(false);
  }, [customer.name, customer.id]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const totalSpent = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const renderBillItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('NewBillTab', { screen: 'BillPreview', params: { bill: item } })}
      activeOpacity={0.8}
    >
      <GlassCard style={styles.billCard}>
        <View style={styles.billHeader}>
          <Text style={styles.billNumber}>Bill #{item.bill_number}</Text>
          <Text style={styles.billDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={styles.billFooter}>
          <Text style={styles.itemCount}>{item.bill_items?.length || 0} items</Text>
          <Text style={styles.billTotal}>₹{item.total_amount.toLocaleString('en-IN')}</Text>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ── Profile Header ──────────────────────────────────── */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHeader}
      >
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{customer.name}</Text>
          <Text style={styles.profilePhone}>{customer.phone || 'No phone number'}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{bills.length}</Text>
            <Text style={styles.statLabel}>Total Bills</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{totalSpent.toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Purchase History ─────────────────────────────────── */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Purchase History</Text>
        
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={bills}
            keyExtractor={item => item.id}
            renderItem={renderBillItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No purchase history yet</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileHeader: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + SPACING.lg : SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...SHADOWS.strong,
  },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xl },
  headerTitle: { fontSize: 18, fontWeight: FONTS.weights.bold, color: COLORS.white },
  backBtn: { padding: 4 },
  profileInfo: { alignItems: 'center', marginBottom: SPACING.xl },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
  },
  avatarText: { fontSize: 36, fontWeight: FONTS.weights.heavy, color: COLORS.white },
  profileName: { fontSize: 24, fontWeight: FONTS.weights.bold, color: COLORS.white },
  profilePhone: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statsRow: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: 20, 
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: FONTS.weights.bold, color: COLORS.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.2)' },
  body: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl },
  sectionTitle: { fontSize: 20, fontWeight: FONTS.weights.bold, color: COLORS.textDark, marginBottom: SPACING.lg },
  listContent: { paddingBottom: 40 },
  billCard: { padding: 16, marginBottom: 12 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billNumber: { fontSize: 13, color: COLORS.textLight, fontWeight: FONTS.weights.semibold },
  billDate: { fontSize: 13, color: COLORS.textLight },
  billFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCount: { fontSize: 14, color: COLORS.textMid },
  billTotal: { fontSize: 18, fontWeight: FONTS.weights.heavy, color: COLORS.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: COLORS.textLight, marginTop: 12 },
});
