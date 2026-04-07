import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import SalesHistoryScreen from '../screens/SalesHistoryScreen';
import ProductSelectionScreen from '../screens/ProductSelectionScreen';
import BillScreen from '../screens/BillScreen';
import BillPreviewScreen from '../screens/BillPreviewScreen';
import ProductManagementScreen from '../screens/ProductManagementScreen';
import CustomersScreen from '../screens/CustomersScreen';
import CustomerDetailsScreen from '../screens/CustomerDetailsScreen';
import { useBillStore } from '../store/billStore';
import { COLORS, FONTS } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ── Home Stack (Simple Dashboard) ───────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="SalesHistory" component={SalesHistoryScreen} />
      <Stack.Screen name="Customers" component={CustomersScreen} />
      <Stack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
    </Stack.Navigator>
  );
}

// ── New Bill Stack (Billing Flow) ───────────────────────────────────────────
function NewBillStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="SelectProducts" component={ProductSelectionScreen} />
      <Stack.Screen name="Bill" component={BillScreen} />
      <Stack.Screen name="BillPreview" component={BillPreviewScreen} />
    </Stack.Navigator>
  );
}

// ── Main Tab Navigator ──────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'NewBillTab') iconName = focused ? 'receipt' : 'receipt-outline';
            else if (route.name === 'Products') iconName = focused ? 'cube' : 'cube-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textLight,
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
            backgroundColor: COLORS.glassBg,
            borderTopColor: COLORS.glassBorder,
            elevation: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -1 },
            shadowRadius: 5,
            shadowOpacity: 0.05,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: FONTS.weights.semibold,
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Dashboard' }} />
        <Tab.Screen
          name="NewBillTab"
          component={NewBillStack}
          options={{ title: 'New Bill' }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              // Always reset to product selection when tapping the "New Bill" tab
              e.preventDefault();
              useBillStore.getState().clearBill();
              navigation.navigate('NewBillTab', { screen: 'SelectProducts' });
            },
          })}
        />
        <Tab.Screen name="Products" component={ProductManagementScreen} options={{ title: 'Products' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
