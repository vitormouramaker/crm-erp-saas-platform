import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Logo } from '@/components/Logo';
import type { ThemeColors } from '@/constants/theme/tokens';
import { FONT_SIZE, SPACING } from '@/constants/Theme';
import { canManageUsers, canSeeChat, canSeeComercial, canSeeContatos, canSeeDashboard, canSeeEstoque, canSeeFinanceiro, canSeeGoogleAds, canSeeMeta, canSeeNpsReport, canSeePdv, canSeeRH, canSeeSettings, type LandingRoute } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import type { ThemePreference } from '@/store/themeStore';
import { useTheme } from '@/store/themeStore';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.8);

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'light',
};

const THEME_TOGGLE_META: Record<ThemePreference, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  light: { icon: 'sunny-outline', label: 'Claro' },
  dark: { icon: 'moon-outline', label: 'Escuro' },
};

type IconName = keyof typeof Ionicons.glyphMap;

interface DrawerItem {
  key: string;
  label: string;
  icon: IconName;
  route?: LandingRoute | '/configuracoes' | '/planos' | '/perfil' | '/(tabs)/manual' | '/relatorio-nps';
  enabled: boolean;
  renderIcon?: () => React.ReactNode;
}

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeRoute?: LandingRoute | '/perfil' | '/(tabs)/manual' | '/relatorio-nps';
}

export function AppDrawer({ visible, onClose, activeRoute }: AppDrawerProps) {
  const { user, logout } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  if (!user) return null;

  const topItems: DrawerItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', route: '/(tabs)/dashboard', enabled: canSeeDashboard(user) },
    { key: 'relatorio-nps', label: 'Relatório NPS', icon: 'star-outline', route: '/relatorio-nps', enabled: canSeeNpsReport(user) },
  ];

  const atendimentoItems: DrawerItem[] = [
    { key: 'chat', label: 'Atendimentos', icon: 'chatbubble-outline', route: '/(tabs)/chat', enabled: canSeeChat(user) },
    { key: 'contatos', label: 'Contatos', icon: 'person-outline', route: '/(tabs)/contatos', enabled: canSeeContatos(user) },
    { key: 'comercial', label: 'Comercial (Funil)', icon: 'filter-outline', route: '/(tabs)/comercial', enabled: canSeeComercial(user) },
  ];

  const operacaoItems: DrawerItem[] = [
    { key: 'estoque', label: 'Estoque', icon: 'cube-outline', route: '/(tabs)/estoque', enabled: canSeeEstoque(user) },
    { key: 'pdv', label: 'Transações PDV', icon: 'receipt-outline', route: '/(tabs)/pdv', enabled: canSeePdv(user) },
    { key: 'equipe', label: 'Gestão de Equipe', icon: 'people-outline', route: '/(tabs)/usuarios', enabled: canManageUsers(user) },
    { key: 'rh', label: 'Recursos humanos', icon: 'time-outline', route: '/(tabs)/rh', enabled: canSeeRH(user) },
  ];

  const financeiroItems: DrawerItem[] = [
    { key: 'financeiro', label: 'Financeiro', icon: 'cash-outline', route: '/(tabs)/financeiro', enabled: canSeeFinanceiro(user) },
    { key: 'meta', label: 'Gestão da Meta', icon: 'infinite-outline', route: '/(tabs)/meta', enabled: canSeeMeta(user) },
    { key: 'googleads', label: 'Google Ads', icon: 'radio-outline', route: '/(tabs)/google_ads', enabled: canSeeGoogleAds(user) },
  ];

  const accountItems: DrawerItem[] = [
    {
      key: 'perfil',
      label: 'Perfil',
      icon: 'person-circle-outline',
      route: '/perfil',
      enabled: true,
      renderIcon: () =>
        user.foto_perfil_url ? (
          <Image source={{ uri: user.foto_perfil_url }} style={styles.itemAvatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
          </View>
        ),
    },
    { key: 'config', label: 'Configurações', icon: 'settings-outline', route: '/configuracoes', enabled: canSeeSettings(user) },
    { key: 'manual', label: 'Manual Operacional', icon: 'book-outline', route: '/(tabs)/manual', enabled: true },
    { key: 'planos', label: 'Planos e Suporte', icon: 'star-outline', route: '/planos', enabled: true },
  ];

  function handlePress(item: DrawerItem) {
    if (!item.enabled || !item.route) return;
    onClose();
    if (item.route === '/configuracoes' || item.route === '/planos' || item.route === '/perfil' || item.route === '/relatorio-nps') {
      // rota fora do grupo (tabs); typed routes regenera ao rodar `expo start`
      router.push(item.route as never);
    } else {
      router.replace(item.route);
    }
  }

  async function handleLogout() {
    onClose();
    await logout();
    router.replace('/(auth)/login');
  }

  function renderItem(item: DrawerItem) {
    const isActive = item.route === activeRoute;
    return (
      <Pressable
        key={item.key}
        onPress={() => handlePress(item)}
        style={[styles.item, isActive && styles.itemActive]}
      >
        {item.renderIcon ? (
          item.renderIcon()
        ) : (
          <Ionicons
            name={item.icon}
            size={18}
            color={colors.accent}
            style={[styles.itemIcon, !item.enabled && styles.itemDisabledIcon]}
          />
        )}
        <Text style={[styles.itemLabel, isActive && styles.itemLabelActive, !item.enabled && styles.itemDisabledText]}>
          {item.label}
        </Text>
      </Pressable>
    );
  }

  const themeToggle = THEME_TOGGLE_META[preference];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <View style={[styles.safeArea, { paddingTop: insets.top }]}>
            <View style={styles.brandRow}>
              <View style={styles.brandInfo}>
                <Logo size={28} color={colors.accent} />
                <Text style={styles.brandName}>ÓRBITA</Text>
              </View>
              <Pressable
                onPress={() => setPreference(NEXT_PREFERENCE[preference])}
                style={styles.themeToggle}
                hitSlop={8}
              >
                <Ionicons name={themeToggle.icon} size={18} color={colors.accent} />
                <Text style={styles.themeToggleLabel}>{themeToggle.label}</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={[styles.list, { paddingBottom: 12 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
            >
              {topItems.map(renderItem)}

              <Text style={styles.groupHeaderFirst}>ATENDIMENTO & RELACIONAMENTO</Text>
              {atendimentoItems.map(renderItem)}

              <Text style={styles.groupHeader}>OPERAÇÃO</Text>
              {operacaoItems.map(renderItem)}

              <Text style={styles.groupHeader}>FINANCEIRO & METAS</Text>
              {financeiroItems.map(renderItem)}

              <View style={styles.divider} />

              <Text style={styles.groupHeader}>CONTA</Text>
              {accountItems.map(renderItem)}

              <Pressable onPress={handleLogout} style={[styles.item, styles.logoutItem]}>
                <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} style={styles.itemIcon} />
                <Text style={[styles.itemLabel, styles.logoutText]}>Sair</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    drawer: {
      width: DRAWER_WIDTH,
      height: '100%',
      backgroundColor: colors.background,
      borderRightWidth: 1,
      borderRightColor: colors.surface,
    },
    safeArea: {
      flex: 1,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    brandInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    brandName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    themeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: colors.primarySubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeToggleLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },
    list: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 2,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 10,
    },
    itemActive: {
      backgroundColor: colors.surface,
    },
    itemIcon: {
      width: 20,
    },
    itemAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    avatarPlaceholder: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: colors.surface,
      marginVertical: 8,
      marginHorizontal: 4,
    },
    itemDisabledIcon: {
      opacity: 0.5,
    },
    itemLabel: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    itemLabelActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    itemDisabledText: {
      color: colors.muted,
      opacity: 0.5,
    },
    groupHeader: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      paddingHorizontal: 12,
    },
    groupHeaderFirst: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: SPACING.md,
      marginBottom: SPACING.sm,
      paddingHorizontal: 12,
    },
    logoutItem: {
      marginTop: SPACING.sm,
    },
    logoutText: {
      color: colors.textSecondary,
    },
  });
