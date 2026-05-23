import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, StatusBar,
  TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SearchBar from '../components/SearchBar';
import GlassButton from '../components/GlassButton';
import GlassCard from '../components/GlassCard';
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '../services/productService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

const EMPTY_FORM = { name: '', category: '', mrp: '', wholesale_rate: '', unit: 'Pc' };

export default function ProductManagementScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState('name');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    // 1. Fire and forget cache read + network callback
    const { data } = await getAllProducts(({ data: freshData }) => {
      if (freshData) {
        setProducts(freshData);
        setLoading(false);
      }
    });

    // 2. Fallback if cache is empty but network works
    if (data) {
      setProducts(data);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.category?.toLowerCase().includes(query.toLowerCase())
  );

  const sortedProducts = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'mrp') {
        return (a.mrp || 0) - (b.mrp || 0); // Lowest Price first
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'recent') {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA; // Newest first
      }
      return 0;
    });
  }, [filtered, sortBy]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      category: product.category || '',
      mrp: String(product.mrp || ''),
      wholesale_rate: String(product.wholesale_rate),
      unit: product.unit || 'Pc',
    });
    setEditingId(product.id);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Product name is required.'); return; }
    if (!form.wholesale_rate || isNaN(Number(form.wholesale_rate))) { Alert.alert('Error', 'Enter a valid wholesale rate.'); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || 'General',
      mrp: Number(form.mrp) || 0,
      wholesale_rate: Number(form.wholesale_rate),
      unit: form.unit.trim() || 'Pc',
    };

    const { error } = editingId
      ? await updateProduct(editingId, payload)
      : await addProduct(payload);

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      fetchAll();
    }
  };

  const handleDelete = (product) => {
    Alert.alert('Delete Product', `Remove "${product.name}" from the database?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteProduct(product.id);
          fetchAll();
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.productRow}>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productMeta}>{item.category} · {item.unit}</Text>
      </View>
      <View style={styles.productPriceGroup}>
        <Text style={styles.productRate}>₹{item.wholesale_rate}</Text>
        {item.mrp > 0 && <Text style={styles.productMrp}>MRP ₹{item.mrp}</Text>}
      </View>
      <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
        <Ionicons name="pencil" size={16} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn]}>
        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <LinearGradient
        colors={['#F0F2FF', '#E8EAFF']}
        style={[
          styles.header,
          Platform.OS === 'android' && { paddingTop: (StatusBar.currentHeight || 0) + SPACING.lg }
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Products</Text>
          <GlassButton
            title="Add New"
            variant="primary"
            size="sm"
            icon={<Ionicons name="add" size={14} color={COLORS.white} />}
            onPress={openAdd}
          />
        </View>
        <Text style={styles.headerSub}>{products.length} products in database</Text>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search products..."
        />
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'mrp' && styles.sortChipActive]}
          onPress={() => setSortBy('mrp')}
        >
          <Ionicons name="pricetag" size={12} color={sortBy === 'mrp' ? COLORS.white : COLORS.primary} />
          <Text style={[styles.sortChipText, sortBy === 'mrp' && styles.sortChipTextActive]}>Price</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'name' && styles.sortChipActive]}
          onPress={() => setSortBy('name')}
        >
          <Ionicons name="text" size={12} color={sortBy === 'name' ? COLORS.white : COLORS.primary} />
          <Text style={[styles.sortChipText, sortBy === 'name' && styles.sortChipTextActive]}>A-Z</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortChip, sortBy === 'recent' && styles.sortChipActive]}
          onPress={() => setSortBy('recent')}
        >
          <Ionicons name="time" size={12} color={sortBy === 'recent' ? COLORS.white : COLORS.primary} />
          <Text style={[styles.sortChipText, sortBy === 'recent' && styles.sortChipTextActive]}>Recent</Text>
        </TouchableOpacity>
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedProducts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingId ? 'Edit Product' : 'Add New Product'}</Text>

            {[
              { label: 'Product Name *', key: 'name', placeholder: 'e.g. Mysore sandle Soap (80gm)' },
              { label: 'Category', key: 'category', placeholder: 'e.g. Soap' },
              { label: 'MRP (₹)', key: 'mrp', placeholder: 'e.g. 40', numeric: true },
              { label: 'Wholesale Rate (₹) *', key: 'wholesale_rate', placeholder: 'e.g. 50', numeric: true },
              { label: 'Unit', key: 'unit', placeholder: 'e.g. Pc, Dozen, Mala, Pack' },
            ].map(field => (
              <View key={field.key} style={styles.formGroup}>
                <Text style={styles.formLabel}>{field.label}</Text>
                <View style={styles.inputCard}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textLight}
                    value={form[field.key]}
                    onChangeText={val => setForm(f => ({ ...f, [field.key]: val }))}
                    keyboardType={field.numeric ? 'numeric' : 'default'}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            ))}

            <View style={styles.modalActions}>
              <GlassButton
                title="Cancel"
                variant="glass"
                size="md"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <GlassButton
                title={editingId ? 'Update' : 'Add Product'}
                variant="primary"
                size="md"
                loading={saving}
                onPress={handleSave}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  headerTitle: { fontSize: FONTS.sizes.xxxl, color: COLORS.textDark, fontWeight: FONTS.weights.heavy },
  headerSub: { fontSize: FONTS.sizes.sm, color: COLORS.textLight },
  searchWrap: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.glassBg, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.glassBorder,
    padding: SPACING.md, marginBottom: SPACING.sm,
    ...SHADOWS.subtle,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: FONTS.sizes.sm, color: COLORS.textDark, fontWeight: FONTS.weights.semibold },
  productMeta: { fontSize: FONTS.sizes.xs, color: COLORS.textLight, marginTop: 2 },
  productPriceGroup: { alignItems: 'flex-end', marginRight: SPACING.md },
  productMrp: { fontSize: 10, color: COLORS.textLight, textDecorationLine: 'line-through' },
  productRate: { fontSize: FONTS.sizes.md, color: COLORS.primary, fontWeight: FONTS.weights.bold },
  actionBtn: {
    width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.glassButtonBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.glassButtonBorder, marginLeft: SPACING.xs,
  },
  deleteBtn: { backgroundColor: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.lg, color: COLORS.textLight },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26,16,51,0.45)' },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SPACING.xl, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.xl,
  },
  modalTitle: { fontSize: FONTS.sizes.xxl, color: COLORS.textDark, fontWeight: FONTS.weights.bold, marginBottom: SPACING.xl },
  formGroup: { marginBottom: SPACING.md },
  formLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMid, fontWeight: FONTS.weights.semibold, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputCard: {
    backgroundColor: COLORS.glassBg, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.md, ...SHADOWS.subtle,
  },
  textInput: { fontSize: FONTS.sizes.md, color: COLORS.textDark, paddingVertical: 12, fontWeight: FONTS.weights.medium },
  modalActions: { flexDirection: 'row', marginTop: SPACING.xl },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sortLabel: {
    fontSize: 12,
    color: COLORS.textMid,
    fontWeight: FONTS.weights.semibold,
    marginRight: 4,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
    gap: 6,
  },
  sortChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortChipText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },
  sortChipTextActive: {
    color: COLORS.white,
  },
});
