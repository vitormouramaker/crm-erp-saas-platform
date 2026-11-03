import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { getInstagramStatusIntegracao, InstagramAccountSummary } from '@/services/metaIgApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface InstagramIntegrationTabProps {
  user: User;
}

export function InstagramIntegrationTab({ user }: InstagramIntegrationTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [contas, setContas] = useState<InstagramAccountSummary[]>([]);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const status = await getInstagramStatusIntegracao(user);
        setConectado(Boolean(status.conectado));
        setContas(status.contas || []);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível verificar a integração com o Instagram.');
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.muted} />}
    >
      <Text style={styles.title}>Instagram</Text>
      <Text style={styles.subtitle}>Acompanhe as contas do Instagram liberadas para esta empresa.</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Erro</Text>
          <Text style={styles.cardDescription}>{error}</Text>
          <Pressable style={styles.refreshButton} onPress={() => load()}>
            <Ionicons name="refresh-outline" size={14} color="#141414" />
            <Text style={styles.refreshButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : !conectado ? (
        <View style={styles.card}>
          <Text style={styles.cardDescription}>
            A integração ainda não está ativa. Faça a aprovação na aba de integração para liberar as
            consultas.
          </Text>

          <Pressable style={styles.refreshButton} onPress={() => load(true)} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color="#141414" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={14} color="#141414" />
                <Text style={styles.refreshButtonText}>Atualizar lista</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Contas do Instagram conectadas</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {contas.length} {contas.length === 1 ? 'CONTA' : 'CONTAS'}
              </Text>
            </View>
          </View>

          {contas.map((conta) => (
            <View key={conta.id} style={styles.accountRow}>
              {conta.instagram_profile_picture_url ? (
                <Image source={{ uri: conta.instagram_profile_picture_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="logo-instagram" size={20} color={colors.muted} />
                </View>
              )}
              <View style={styles.accountInfo}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {conta.instagram_username ? `@${conta.instagram_username}` : conta.instagram_name || 'Conta sem nome'}
                </Text>
                <Text style={styles.accountSub} numberOfLines={1}>
                  {conta.page_name || 'Página não identificada'}
                  {conta.business_name ? ` • ${conta.business_name}` : ''}
                </Text>
              </View>
            </View>
          ))}

          <Pressable style={styles.refreshButton} onPress={() => load(true)} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color="#141414" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={14} color="#141414" />
                <Text style={styles.refreshButtonText}>Atualizar lista</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    card: {
      borderRadius: 16,
      padding: 16,
      gap: 12,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignSelf: 'flex-start',
      paddingHorizontal: 18,
    },
    refreshButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    countBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    countBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.border,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountInfo: {
      flex: 1,
      gap: 2,
    },
    accountName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    accountSub: {
      fontSize: 12,
      color: colors.muted,
    },
  });
