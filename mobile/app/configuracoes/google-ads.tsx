import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import {
  GoogleAdsIntegrationStatus,
  GoogleAdsLinkedAccount,
  getGoogleAdsStatusIntegracao,
  removerContaGoogleAds,
} from '@/services/googleAdsApi';
import { canSeeGoogleAds } from '@/services/permissions';
import { useAuth } from '@/store/authStore';

const PORTAL_CONFIG_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/configuracoes`;

function formatDate(value: string | null): string {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function GoogleAdsConfigScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [status, setStatus] = useState<GoogleAdsIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const allowed = !!user && canSeeGoogleAds(user);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user || !allowed) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const data = await getGoogleAdsStatusIntegracao(user);
        setStatus(data);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível verificar a integração com o Google Ads.');
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [user, allowed]
  );

  useEffect(() => {
    load();
  }, [load]);

  function abrirNoPortal() {
    WebBrowser.openBrowserAsync(PORTAL_CONFIG_URL);
  }

  function confirmarRemocao(conta: GoogleAdsLinkedAccount) {
    if (!user) return;
    Alert.alert(
      'Remover acesso',
      `Remover o acesso à conta ${conta.customer_name || conta.customer_id}? Você pode reconectar depois pelo portal.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(conta.customer_id);
            try {
              await removerContaGoogleAds(user, conta.customer_id);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover o acesso.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  }

  const statusLabel = status
    ? status.total_contas > 0
      ? `${status.total_contas} conta(s) Google Ads vinculada(s)`
      : 'Nenhuma conta Google Ads vinculada'
    : '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Google Ads</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para ver a integração com o Google Ads.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : status ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.muted} />}
        >
          <View style={styles.card}>
            <Text style={styles.eyebrow}>GOOGLE ADS</Text>
            <Text style={styles.cardTitle}>Conecte a empresa ao Google Ads</Text>
            <Text style={styles.cardDescription}>
              Vincule contas do Google Ads via OAuth para liberar consultas e futuras automações de campanhas
              dentro do sistema.
            </Text>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status da integração:</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText}>{statusLabel}</Text>
              </View>
            </View>

            <Pressable style={styles.primaryButton} onPress={abrirNoPortal}>
              <Text style={styles.primaryButtonText}>Conectar Google Ads</Text>
            </Pressable>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Status atual</Text>
                <Text style={styles.statValue}>{statusLabel}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Integração</Text>
                <Text style={styles.statValue}>{status.conectado ? 'Ativa' : 'Pendente'}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Contas vinculadas</Text>
                <Text style={styles.statValue}>{status.total_contas}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Fluxo OAuth</Text>
                <Text style={styles.statValue}>Login não iniciado</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contas atualmente vinculadas</Text>
            <Text style={styles.sectionDescription}>Lista persistida no banco para uso posterior no módulo de Google Ads.</Text>

            {status.contas.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardDescription}>Nenhuma conta vinculada ainda.</Text>
              </View>
            ) : (
              <View style={styles.accountsList}>
                {status.contas.map((conta) => (
                  <View key={conta.id} style={styles.accountCard}>
                    <View style={styles.accountHeader}>
                      <Text style={styles.accountName}>{conta.customer_name || conta.customer_id}</Text>
                      <View style={styles.enabledBadge}>
                        <Text style={styles.enabledBadgeText}>{conta.status || 'DESCONHECIDO'}</Text>
                      </View>
                    </View>

                    <View style={styles.accountGrid}>
                      <View style={styles.accountField}>
                        <Text style={styles.accountFieldLabel}>ID da conta</Text>
                        <Text style={styles.accountFieldValue}>{conta.customer_id}</Text>
                      </View>
                      <View style={styles.accountField}>
                        <Text style={styles.accountFieldLabel}>Fuso</Text>
                        <Text style={styles.accountFieldValue}>{conta.time_zone || 'Não informado'}</Text>
                      </View>
                      <View style={styles.accountField}>
                        <Text style={styles.accountFieldLabel}>Moeda</Text>
                        <Text style={styles.accountFieldValue}>{conta.currency_code || 'Não informado'}</Text>
                      </View>
                      <View style={styles.accountField}>
                        <Text style={styles.accountFieldLabel}>Tipo</Text>
                        <Text style={styles.accountFieldValue}>{conta.manager ? 'Conta gerenciadora' : 'Conta de anúncios'}</Text>
                      </View>
                      <View style={styles.accountField}>
                        <Text style={styles.accountFieldLabel}>Último OAuth</Text>
                        <Text style={styles.accountFieldValue}>{formatDate(conta.last_oauth_at)}</Text>
                      </View>
                      <View style={styles.accountField}>
                        <Text style={styles.accountFieldLabel}>Token expira em</Text>
                        <Text style={styles.accountFieldValue}>{formatDate(conta.token_expires_at)}</Text>
                      </View>
                    </View>

                    <Pressable
                      style={styles.removeButton}
                      onPress={() => confirmarRemocao(conta)}
                      disabled={removingId === conta.customer_id}
                    >
                      {removingId === conta.customer_id ? (
                        <ActivityIndicator color={colors.textPrimary} size="small" />
                      ) : (
                        <Text style={styles.removeButtonText}>Remover acesso</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...cardSurface(colors, scheme),
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardDescription: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3ECF8E',
  },
  statusPillText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionDescription: {
    fontSize: 12,
    color: colors.muted,
  },
  accountsList: {
    gap: 14,
  },
  accountCard: {
    borderRadius: 16,
    padding: 16,
    gap: 14,
    ...cardSurface(colors, scheme),
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  enabledBadge: {
    backgroundColor: 'rgba(62,207,142,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enabledBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3ECF8E',
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accountField: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  accountFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  accountFieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  removeButton: {
    alignSelf: 'flex-start',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
