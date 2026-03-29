import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBillStore } from '../store/billStore';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme';

const ProductCard = ({
  product,
  onAdd,
  onRemove,
  onUpdateQuantity,
  scrollRef,
}) => {
  const quantityInCart = useBillStore(s => s.getQuantityInCart(product.id));
  const scale = useRef(new Animated.Value(1)).current;
  const cardRef = useRef(null);

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const handleInputFocus = () => {
    if (!scrollRef?.current || !cardRef?.current) return;
    setTimeout(() => {
      cardRef.current.measureLayout(
        scrollRef.current,
        (x, y) => {
          scrollRef.current.scrollTo({ y: y - 20, animated: true });
        },
        () => { }
      );
    }, 150);
  };

  const inCart = quantityInCart > 0;
  const hasDiscount = !!product.mrp && product.mrp > product.wholesale_rate;
  const discount = hasDiscount
    ? Math.round(((product.mrp - product.wholesale_rate) / product.mrp) * 100)
    : 0;

  return (
    <Animated.View ref={cardRef} style={[styles.wrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={() => onAdd(product)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[styles.card, inCart && styles.cardActive]}
      >
        <View style={styles.topRow}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {product.category}
            </Text>
          </View>
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% off</Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.divider} />

        <View style={styles.priceSection}>
          <View>
            <Text style={styles.rateLabel}>Wholesale</Text>
            <View style={styles.priceRow}>
              <Text style={styles.rate}>₹{product.wholesale_rate}</Text>
              <Text style={styles.unit}>/{product.unit}</Text>
            </View>
          </View>
          {hasDiscount && (
            <View style={styles.mrpBlock}>
              <Text style={styles.mrpLabel}>MRP</Text>
              <Text style={styles.mrpValue}>₹{product.mrp}</Text>
            </View>
          )}
        </View>

        <View style={styles.cartRow}>
          {inCart ? (
            <View style={styles.qtyContainer}>
              <TouchableOpacity
                onPress={() => onRemove(product.id)}
                style={styles.qtyBtn}
              >
                <Ionicons name="remove" size={16} color={COLORS.white} />
              </TouchableOpacity>

              <TextInput
                style={styles.qtyInput}
                value={String(quantityInCart)}
                onChangeText={val => {
                  const num = parseInt(val.replace(/[^0-9]/g, '')) || 0;
                  onUpdateQuantity(product.id, num);
                }}
                onFocus={handleInputFocus}
                keyboardType="numeric"
                maxLength={4}
                selectTextOnFocus
              />

              <TouchableOpacity
                onPress={() => onAdd(product)}
                style={styles.qtyBtn}
              >
                <Ionicons name="add" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => onAdd(product)}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={16} color={COLORS.white} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default React.memo(ProductCard);

const styles = StyleSheet.create({
  wrapper: {
    width: '48%',
    marginBottom: 14,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EBEBF0',
    padding: 14,
    minHeight: 190,
    ...SHADOWS.card,
  },
  cardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAFAFF',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: COLORS.primary + '14',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '65%',
  },
  categoryText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.3,
  },
  discountBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  discountText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: FONTS.weights.bold,
  },
  name: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.bold,
    lineHeight: 19,
    marginBottom: 10,
    minHeight: 38,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginBottom: 10,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  rateLabel: {
    fontSize: 9,
    color: COLORS.textLight,
    fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  rate: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.primary,
    fontWeight: FONTS.weights.heavy,
  },
  unit: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: FONTS.weights.medium,
  },
  mrpBlock: {
    alignItems: 'flex-end',
  },
  mrpLabel: {
    fontSize: 9,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  mrpValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    fontWeight: FONTS.weights.medium,
  },
  cartRow: {
    alignItems: 'flex-start',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 4,
  },
  addBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: FONTS.weights.bold,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    padding: 3,
    gap: 2,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.white,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
    paddingHorizontal: 2,
  },
});



