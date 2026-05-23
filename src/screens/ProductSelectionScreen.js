import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, StatusBar,
  TouchableOpacity, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import CategoryChip from '../components/CategoryChip';
import { useBillStore } from '../store/billStore';
import { searchProducts, getCategories } from '../services/productService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

export default function ProductSelectionScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loading, setLoading] = useState(true);

  const debounceRef = useRef(null);
  const categoryDebounceRef = useRef(null);
  const addItem = useBillStore(s => s.addItem);
  const decrementItem = useBillStore(s => s.decrementItem);
  const updateQuantity = useBillStore(s => s.updateQuantity);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Load all categories on mount + keyboard listeners
  useEffect(() => {
    getCategories(({ data }) => { 
      if (data) setCategories(data); 
    });

    const showSub = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Update categories when search query changes
  // Shows only categories that have products matching the search
  useEffect(() => {
    clearTimeout(categoryDebounceRef.current);
    categoryDebounceRef.current = setTimeout(async () => {
      const { data } = await getCategories(({ data: cachedCats }) => {
        if (cachedCats) setCategories(cachedCats);
      }, query);
      if (data) setCategories(data);
    }, 300);
    return () => clearTimeout(categoryDebounceRef.current);
  }, [query]);

  // Reset selected category back to 'All' when query changes
  // so user doesn't get stuck on a category that has no matches for the new query
  const prevQueryRef = useRef(query);
  useEffect(() => {
    if (prevQueryRef.current !== query) {
      setCategory('All');
      prevQueryRef.current = query;
    }
  }, [query]);

  // Debounced search
  const doSearch = useCallback(async (q, cat, showLoader = false) => {
    if (showLoader) setLoading(true);
    
    // Fire and forget cache read + network callback
    const { data } = await searchProducts(q, cat, ({ data: freshData }) => {
      if (freshData) {
        setProducts(freshData);
        setLoading(false); // Instantly turn off loading when cache hits
      }
    });

    if (data) {
      setProducts(data);
      setLoading(false); // Turn off loading when network finishes if cache was empty
    }
  }, []);

  const queryRef = useRef(query);
  const categoryRef = useRef(category);
  const isFirstMount = useRef(true);

  useEffect(() => {
    queryRef.current = query;
    categoryRef.current = category;
    
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return; // Let useFocusEffect handle the instant initial load to avoid double-fetching
    }
    
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, category, true), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, category, doSearch]);

  useFocusEffect(
    useCallback(() => {
      // Refresh list whenever tab is focused silently (no loading spinner flash!)
      doSearch(queryRef.current, categoryRef.current, false);
    }, [doSearch])
  );

  const handleUpdateQuantity = useCallback((id, qty) => {
    updateQuantity(id, qty);
  }, [updateQuantity]);

  const handleAdd = useCallback((product) => {
    addItem(product);
  }, [addItem]);

  const handleRemove = useCallback((id) => {
    decrementItem(id);
  }, [decrementItem]);

  const renderProduct = useCallback(({ item }) => (
    <ProductCard
      product={item}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onUpdateQuantity={handleUpdateQuantity}
    />
  ), [handleAdd, handleRemove, handleUpdateQuantity]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View
          style={[
            styles.header,
            { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }
          ]}
        >
          <TouchableOpacity 
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('HomeTab');
              }
            }} 
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Select Products</Text>
            <Text style={styles.headerSub}>{products.length} products found</Text>
          </View>
        </View>

        {/* ── Search ─────────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search 1000+ products..."
          />
        </View>

        {/* ── Categories ─────────────────────────────────────── */}
        <View style={styles.categoriesWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {categories.map(cat => (
              <CategoryChip
                key={cat}
                label={cat}
                active={category === cat}
                onPress={() => {
                  if (cat === 'All') {
                    setCategory('All');
                  } else {
                    setCategory(category === cat ? 'All' : cat);
                  }
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── Product List Section ───────────────────────────── */}
        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loaderText}>Searching...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={52} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No products found</Text>
              <Text style={styles.emptySubText}>Try a different keyword or category</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={item => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={Platform.OS === 'android'}
              getItemLayout={(data, index) => ({
                length: 210, // Approximate row height (minHeight 190 + margin)
                offset: 210 * index,
                index,
              })}
            />
          )}
        </View>

        <FloatingBillBar
          isVisible={!isKeyboardVisible}
          onPress={() => navigation.navigate('Bill')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
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
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.bold,
  },
  headerSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  searchRow: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: 0,
  },
  categoriesWrapper: {
    paddingTop: 0,
    paddingBottom: SPACING.sm,
    height: 54,
  },
  categoriesContent: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  grid: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  row: {
    justifyContent: 'space-between',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loaderText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textMid,
    fontWeight: FONTS.weights.semibold,
  },
  emptySubText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  floatingBar: {
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
  floatingBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    height: 64,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderBottomWidth: 0,
  },
  floatingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  floatingCount: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: FONTS.weights.semibold,
  },
  floatingRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  floatingAction: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: FONTS.weights.bold,
  },
});

/** ── Optimized Floating Bar Sub-component ────────────────────────── */
/** This component listens to the store INDEPENDENTLY so the main list */
/** never has to re-render when you add items.                       */
const FloatingBillBar = React.memo(({ isVisible, onPress }) => {
  const itemCount = useBillStore(s => s.items.length);

  if (itemCount === 0 || !isVisible) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.floatingBar}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['rgba(108, 63, 232, 0.85)', 'rgba(0, 210, 255, 0.85)']} // Semi-transparent glass gradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.floatingBarGradient}
      >
        <View style={styles.floatingLeft}>
          <Ionicons name="cart" size={22} color={COLORS.white} />
          <Text style={styles.floatingCount}>{itemCount} item{itemCount > 1 ? 's' : ''} added</Text>
        </View>
        <View style={styles.floatingRight}>
          <Text style={styles.floatingAction}>View Bill</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});
