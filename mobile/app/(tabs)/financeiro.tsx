import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertasTab } from '@/components/AlertasTab';
import { AppDrawer } from '@/components/AppDrawer';
import { AssinaturasTab } from '@/components/AssinaturasTab';
import { CategoriasTab } from '@/components/CategoriasTab';
import { ComissoesTab } from '@/components/ComissoesTab';
import { ContasTab } from '@/components/ContasTab';
import { EstruturaTab } from '@/components/EstruturaTab';
import { FinanceiroDashboardTab } from '@/components/FinanceiroDashboardTab';
import { LancamentosTab } from '@/components/LancamentosTab';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PermissionDeniedState } from '@/components/ScreenState';
import type { ThemeColors } from '@/constants/theme/tokens';
import { canSeeFinanceiro } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

type FinanceiroTab =
  | 'dashboard'
  | 'pagar'
  | 'receber'
  | 'lancamentos'
  | 'alertas'
  | 'categorias'
  | 'estrutura'
  | 'comissoes'
  | 'assinaturas';

const TABS: { key: FinanceiroTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pagar', label: 'Contas a Pagar' },
  { key: 'receber', label: 'Contas a Receber' },
  { key: 'lancamentos', label: 'Lançamentos' },
  { key: 'alertas', label: 'Alertas' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'estrutura', label: 'Estrutura' },
  { key: 'comissoes', label: 'Comissões e Metas' },
  { key: 'assinaturas', label: 'Assinaturas' },
];

export default function FinanceiroScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FinanceiroTab>('dashboard');

  const allowed = !!user && canSeeFinanceiro(user);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Financeiro" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/financeiro" />

      {!allowed || !user ? (
        <PermissionDeniedState message="Você não tem acesso ao financeiro." />
      ) : (
        <>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsRow}
            >
              {TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tab, tab.key === activeTab && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab.key === activeTab && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.tabsBorder} />
          </View>

          {activeTab === 'dashboard' && <FinanceiroDashboardTab user={user} />}
          {activeTab === 'pagar' && <ContasTab key="pagar" user={user} kind="pagar" />}
          {activeTab === 'receber' && <ContasTab key="receber" user={user} kind="receber" />}
          {activeTab === 'lancamentos' && <LancamentosTab user={user} />}
          {activeTab === 'alertas' && <AlertasTab user={user} />}
          {activeTab === 'categorias' && <CategoriasTab user={user} />}
          {activeTab === 'estrutura' && <EstruturaTab user={user} />}
          {activeTab === 'comissoes' && <ComissoesTab user={user} />}
          {activeTab === 'assinaturas' && <AssinaturasTab user={user} />}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabsRow: {
      paddingHorizontal: 24,
      gap: 18,
    },
    tabsBorder: {
      height: 1,
      backgroundColor: colors.border,
    },
    tab: {
      paddingBottom: 10,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    tabTextActive: {
      color: colors.accent,
    },
  });
