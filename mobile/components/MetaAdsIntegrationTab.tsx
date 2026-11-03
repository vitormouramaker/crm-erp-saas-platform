import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { getMetaAdsStatusIntegracao, MetaAdsAccountSummary } from '@/services/metaAdsApi';
import type { User } from '@/types';

interface MetaAdsIntegrationTabProps {
  user: User;
}

const BUSINESS_MANAGER_URL = 'https://business.facebook.com/settings';
const META_BUSINESS_ID = process.env.EXPO_PUBLIC_META_BUSINESS_ID || '';

const AD_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  '1': 'Ativa',
  '2': 'Desativada',
  '3': 'Não confirmada',
  '7': 'Em análise de risco',
  '8': 'Pendente de liquidação',
  '9': 'Em período de carência',
  '100': 'Pendente de encerramento',
  '101': 'Encerrada',
};

export function MetaAdsIntegrationTab({ user }: MetaAdsIntegrationTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [contas, setContas] = useState<MetaAdsAccountSummary[]>([]);
  const [conectado, setConectado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const status = await getMetaAdsStatusIntegracao(user);
        setConectado(Boolean(status.conectado));
        setContas(status.contas || []);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível verificar a integração com o Meta Ads.');
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
      <Text style={styles.title}>Meta Ads</Text>
      <Text style={styles.subtitle}>
        Acompanhe as contas de anúncio da Meta liberadas para esta empresa.
      </Text>

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
          <Text style={styles.cardTitle}>Recursos da integração</Text>
          <Text style={styles.cardDescription}>
            O trackeamento só fica disponível quando a Meta realmente liberar pelo menos uma conta
            de anúncio para este business. Se a aprovação já foi feita e a lista ainda está vazia, o
            dono da conta de anúncio precisa compartilhar o ativo com{' '}
            <Text style={styles.emphasis}>Sua Empresa ({META_BUSINESS_ID})</Text>. Depois disso, use
            Atualizar lista para importar as contas acessíveis.
          </Text>

          <Pressable style={styles.linkRow} onPress={() => WebBrowser.openBrowserAsync(BUSINESS_MANAGER_URL)}>
            <Text style={styles.linkText}>Abrir configurações do Business Manager</Text>
            <Ionicons name="open-outline" size={14} color={colors.accent} />
          </Pressable>

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
            <Text style={styles.cardTitle}>Contas de anúncio conectadas</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {contas.length} {contas.length === 1 ? 'CONTA' : 'CONTAS'}
              </Text>
            </View>
          </View>

          {contas.map((conta) => {
            const statusKey = String(conta.ad_account_status ?? '');
            const isActive = statusKey === '1';
            return (
              <View key={conta.id} style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {conta.ad_account_name || conta.ad_account_id}
                  </Text>
                  <Text style={styles.accountSub} numberOfLines={1}>
                    {conta.business_name || 'Business não identificado'}
                    {conta.currency ? ` • ${conta.currency}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusPill, isActive && styles.statusPillActive]}>
                  <Text style={[styles.statusPillText, isActive && styles.statusPillTextActive]}>
                    {AD_ACCOUNT_STATUS_LABELS[statusKey] || 'Status desconhecido'}
                  </Text>
                </View>
              </View>
            );
          })}

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
    emphasis: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    linkText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
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
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
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
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusPillActive: {
      borderColor: colors.accent,
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.muted,
    },
    statusPillTextActive: {
      color: colors.accent,
    },
  });
