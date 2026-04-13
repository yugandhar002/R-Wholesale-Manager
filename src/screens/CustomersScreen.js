import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Modal, TextInput, ActivityIndicator,
  StatusBar, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import GlassButton from '../components/GlassButton';
import SearchBar from '../components/SearchBar';
import { getCustomers, updateCustomer, deleteCustomer, syncCustomersFromBills } from '../services/customerService';
import { COLORS, FONTS, SPACING, RADIUS, GLASS_STYLE } from '../theme';

export default function CustomersScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const loadCustomers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); // Always start loading, cache instant return will kill it

    const { data, error } = await getCustomers(({ data: freshData }) => {
      if (freshData) {
        setCustomers(freshData);
        setFilteredCustomers(freshData);
        setLoading(false);
        setRefreshing(false);
      }
    });

    if (data) {
      setCustomers(data);
      setFilteredCustomers(data);
    } else if (error) {
      console.error('Error fetching customers:', error);
    }
    
    setLoading(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCustomers(true);
  }, [loadCustomers]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCustomers(customers);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => 
          c.name.toLowerCase().includes(q) || 
          (c.phone && c.phone.includes(q))
        )
      );
    }
  }, [searchQuery, customers]);


  const handleDelete = (id, name) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${name}? Their bills will NOT be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            // Optimistic Update: Remove from UI immediately
            const previousCustomers = [...customers];
            const previousFiltered = [...filteredCustomers];
            
            const newCustomers = customers.filter(c => c.id !== id);
            setCustomers(newCustomers);
            setFilteredCustomers(filteredCustomers.filter(c => c.id !== id));

            const { error } = await deleteCustomer(id);
            
            if (error) {
              // Rollback on error
              setCustomers(previousCustomers);
              setFilteredCustomers(previousFiltered);
              Alert.alert('Error', error.message || 'Failed to delete customer.');
            } else {
              // Optionally refresh in background to stay in sync
              loadCustomers(true);
            }
          }
        }
      ]
    );
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone || '');
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    const { error } = await updateCustomer(editingCustomer.id, {
      name: editName.trim(),
      phone: editPhone.trim()
    });
    if (error) {
      Alert.alert('Error', 'Failed to update customer.');
    } else {
      setEditingCustomer(null);
      loadCustomers(true); // Smooth refresh for updates too
    }
  };

  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('CustomerDetails', { customer: item })}
      activeOpacity={0.7}
    >
      <GlassCard style={styles.customerCard}>
        <View style={styles.cardInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          <Text style={styles.customerPhone}>
            <Ionicons name="call-outline" size={12} color={COLORS.textLight} /> {item.phone || 'No phone'}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Customers</Text>
        <View style={{ width: 32 }} /> 
      </View>

      <View style={styles.searchContainer}>
        <SearchBar 
          placeholder="Search customers..." 
          value={searchQuery} 
          onChangeText={setSearchQuery} 
        />
      </View>

      {loading && customers.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={item => item.id}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No customers found</Text>
              <Text style={styles.emptySub}>Tap the sync icon above to import from bills</Text>
            </View>
          }
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editingCustomer} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Customer</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput 
                style={styles.input} 
                value={editName} 
                onChangeText={setEditName} 
                placeholder="Name"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput 
                style={styles.input} 
                value={editPhone} 
                onChangeText={setEditPhone} 
                placeholder="Phone (optional)"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.modalButtons}>
              <GlassButton 
                title="Cancel" 
                onPress={() => setEditingCustomer(null)} 
                type="outline"
                containerStyle={{ flex: 1 }}
              />
              <GlassButton 
                title="Save Changes" 
                onPress={saveEdit} 
                containerStyle={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + SPACING.lg : SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: FONTS.weights.bold, color: COLORS.textDark },
  syncBtn: { padding: 4 },
  searchContainer: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  customerCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    marginBottom: 12 
  },
  customerName: { fontSize: 18, color: COLORS.textDark, fontWeight: FONTS.weights.bold },
  customerPhone: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, color: COLORS.textMid, fontWeight: FONTS.weights.bold, marginTop: 16 },
  emptySub: { fontSize: 14, color: COLORS.textLight, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: COLORS.white, 
    borderRadius: 24, 
    padding: 24,
    ...GLASS_STYLE, 
  },
  modalTitle: { fontSize: 20, fontWeight: FONTS.weights.bold, color: COLORS.textDark, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, color: COLORS.textLight, marginBottom: 8, fontWeight: FONTS.weights.semibold },
  input: { 
    backgroundColor: '#F3F4F6', 
    borderRadius: 12, 
    padding: 12, 
    fontSize: 16, 
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
