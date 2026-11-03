import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { canManageUsers, canSeeChat, canSeeComercial, canSeeContatos, canSeeDashboard, canSeeEstoque, canSeeFinanceiro, canSeeGoogleAds, canSeeMeta, canSeePdv, canSeeRH } from '@/services/permissions';
import { useAuth } from '@/store/authStore';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  const showDashboard = !!user && canSeeDashboard(user);
  const showComercial = !!user && canSeeComercial(user);
  const showChat = !!user && canSeeChat(user);
  const showUsuarios = !!user && canManageUsers(user);
  const showEstoque = !!user && canSeeEstoque(user);
  const showContatos = !!user && canSeeContatos(user);
  const showMeta = !!user && canSeeMeta(user);
  const showGoogleAds = !!user && canSeeGoogleAds(user);
  const showRH = !!user && canSeeRH(user);
  const showFinanceiro = !!user && canSeeFinanceiro(user);
  const showPdv = !!user && canSeePdv(user);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: showDashboard ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="comercial"
        options={{
          title: 'Comercial',
          href: showComercial ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Atendimento',
          href: showChat ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'message', android: 'chat', web: 'chat' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{
          title: 'Usuários',
          href: showUsuarios ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.2', android: 'group', web: 'group' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="estoque"
        options={{
          title: 'Estoque',
          href: showEstoque ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rh"
        options={{
          title: 'Recursos Humanos',
          href: showRH ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pdv"
        options={{
          title: 'Transações PDV',
          href: showPdv ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'doc.text', android: 'receipt_long', web: 'receipt_long' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: 'Financeiro',
          href: showFinanceiro ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'dollarsign.circle', android: 'attach_money', web: 'attach_money' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="contatos"
        options={{
          title: 'Contatos',
          href: showContatos ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.crop.circle', android: 'contacts', web: 'contacts' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meta"
        options={{
          title: 'Gestão da Meta',
          href: showMeta ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'infinity', android: 'all_inclusive', web: 'all_inclusive' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="google_ads"
        options={{
          title: 'Google Ads',
          href: showGoogleAds ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="manual"
        options={{
          title: 'Manual Operacional',
          href: user ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
