import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  StatusBar, TouchableOpacity, RefreshControl, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../components/GlassCard';
import { getDailySalesHistory } from '../services/billService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

export default function SalesHistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);

  const loadData = useCallback(async () => {
    const { data } = await getDailySalesHistory(({ data: freshData }) => {
      if (freshData) {
        setHistory(freshData);
      }
    });
    if (data) setHistory(data);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleExpand = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={[
        styles.header,
        Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight || 0) + SPACING.md }
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sales History</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No sales history found</Text>
          </View>
        ) : (
          history.map((day) => (
            <View key={day.date} style={styles.dayGroup}>
              <TouchableOpacity
                onPress={() => toggleExpand(day.date)}
                activeOpacity={0.7}
              >
                <GlassCard style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                      <Text style={styles.dayCount}>{day.count} {day.count === 1 ? 'Bill' : 'Bills'}</Text>
                    </View>
                    <View style={styles.dayRight}>
                      <Text style={styles.dayTotal}>₹{day.total.toLocaleString('en-IN')}</Text>
                      <Ionicons 
                        name={expandedDate === day.date ? "chevron-up" : "chevron-down"} 
                        size={18} 
                        color={COLORS.textLight} 
                      />
                    </View>
                  </View>
                </GlassCard>
              </TouchableOpacity>

              {expandedDate === day.date && (
                <View style={styles.billsList}>
                  {day.bills.map((bill) => (
                    <TouchableOpacity
                      key={bill.id}
                      onPress={() => navigation.navigate('NewBillTab', { screen: 'BillPreview', params: { bill } })}
                      activeOpacity={0.7}
                      style={styles.billItem}
                    >
                      <View style={styles.billIcon}>
                        <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
                      </View>
                      <View style={styles.billMain}>
                        <Text style={styles.billCustomer}>{bill.customer_name}</Text>
                        <Text style={styles.billNo}>#{bill.bill_number}</Text>
                      </View>
                      <Text style={styles.billAmount}>₹{bill.total_amount.toLocaleString('en-IN')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.xl },
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
  headerTitle: { fontSize: FONTS.sizes.xl, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  dayGroup: { marginBottom: SPACING.md },
  dayCard: { padding: SPACING.lg },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayDate: { fontSize: 16, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  dayCount: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  dayRight: { alignItems: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayTotal: { fontSize: 18, color: COLORS.primary, fontWeight: FONTS.weights.heavy },
  billsList: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    marginHorizontal: 4,
    marginTop: -4,
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    zIndex: -1,
  },
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  billIcon: { marginRight: SPACING.sm },
  billMain: { flex: 1 },
  billCustomer: { fontSize: 14, color: COLORS.textDark, fontWeight: FONTS.weights.semibold },
  billNo: { fontSize: 10, color: COLORS.textLight },
  billAmount: { fontSize: 14, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyText: { fontSize: 16, color: COLORS.textLight, marginTop: 16, fontWeight: FONTS.weights.medium },
});
