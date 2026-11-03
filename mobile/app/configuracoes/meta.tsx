import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { API_BASE } from '@/services/apiClient';
import { getMetaBusinessStatus, MetaBusinessIntegrationStatus } from '@/services/metaApi';
import { getMetaAdsStatusIntegracao } from '@/services/metaAdsApi';
import { getInstagramStatusIntegracao } from '@/services/metaIgApi';
import { canSeeMeta } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

const PORTAL_CONFIG_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/configuracoes`;
const META_WEBHOOK_URL = `${API_BASE}/meta/webhook`;

interface CardState {
  conectado: boolean;
  statusLabel: string;
}

export default function MetaConfigScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [whatsapp, setWhatsapp] = useState<MetaBusinessIntegrationStatus | null>(null);
  const [whatsappExpandido, setWhatsappExpandido] = useState(false);
  const [ads, setAds] = useState<CardState | null>(null);
  const [instagram, setInstagram] = useState<CardState | null>(null);

  const allowed = !!user && canSeeMeta(user);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user || !allowed) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const [statusWhatsapp, statusAds, statusInstagram] = await Promise.all([
          getMetaBusinessStatus(user),
          getMetaAdsStatusIntegracao(user),
          getInstagramStatusIntegracao(user),
        ]);

        setWhatsapp(statusWhatsapp);
        setAds({
          conectado: statusAds.conectado,
          statusLabel:
            statusAds.total_contas > 0
              ? `${statusAds.total_contas} ${statusAds.total_contas === 1 ? 'conta vinculada' : 'contas vinculadas'}`
              : 'Nenhuma conta de anúncio vinculada',
        });
        setInstagram({
          conectado: statusInstagram.conectado,
          statusLabel:
            statusInstagram.total_contas > 0
              ? `${statusInstagram.total_contas} ${statusInstagram.total_contas === 1 ? 'conta vinculada' : 'contas vinculadas'}`
              : 'Nenhuma conta Instagram vinculada',
        });
      } catch (err: any) {
        setError(err?.message || 'Não foi possível verificar as integrações da Meta.');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Configurar Meta</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para ver as integrações da Meta.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.muted} />}
        >
          <View style={styles.card}>
            <Text style={styles.eyebrow}>META BUSINESS</Text>
            <Text style={styles.cardTitle}>Conecte a empresa ao WhatsApp oficial da Meta</Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, whatsapp?.conectado ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={styles.statusLabel}>
                Status da integração: {whatsapp?.conectado ? 'Integração ativa' : 'Integração pendente'}
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.primaryButton} onPress={abrirNoPortal}>
                <Text style={styles.primaryButtonText}>Vincular conta da Meta</Text>
              </Pressable>
              <Pressable style={styles.secondaryPill} onPress={() => setWhatsappExpandido((prev) => !prev)}>
                <Text style={styles.secondaryPillText}>{whatsappExpandido ? 'Ver menos' : 'Ver mais'}</Text>
              </Pressable>
            </View>

            {whatsappExpandido && whatsapp && (
              <View style={styles.expandedPanel}>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Status atual</Text>
                    <Text style={styles.statValue}>{whatsapp.conectado ? 'Integração ativa' : 'Integração pendente'}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Webhook</Text>
                    <Text style={styles.statValueSmall} numberOfLines={3}>
                      {META_WEBHOOK_URL}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Números vinculados</Text>
                    <Text style={styles.statValue}>{whatsapp.accounts.length}</Text>
                  </View>
                </View>

                {whatsapp.accounts.map((account) => (
                  <View key={account.id} style={styles.numberRow}>
                    <View style={styles.numberInfo}>
                      <Text style={styles.numberPhone}>{account.display_phone_number || '-'}</Text>
                      <Text style={styles.numberSub}>{account.verified_name || '-'}</Text>
                      <Text style={styles.numberSub}>ID técnico: {account.phone_number_id || '-'}</Text>
                    </View>
                    <View style={[styles.activeBadge, !account.ativo && styles.activeBadgeInactive]}>
                      <Text style={[styles.activeBadgeText, !account.ativo && styles.activeBadgeTextInactive]}>
                        {account.ativo ? 'Ativo' : 'Inativo'}
                      </Text>
                    </View>
                  </View>
                ))}

                <Pressable onPress={() => router.replace('/(tabs)/meta')}>
                  <Text style={styles.openManagementLink}>Abrir gestão</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>META ADS</Text>
            <Text style={styles.cardTitle}>Aprove o acesso e importe as contas liberadas</Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, ads?.conectado ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={styles.statusLabel}>Status da integração: {ads?.statusLabel}</Text>
            </View>

            <Pressable style={styles.primaryButton} onPress={abrirNoPortal}>
              <Text style={styles.primaryButtonText}>Aprovar acesso na Meta Ads</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>META INSTAGRAM</Text>
            <Text style={styles.cardTitle}>Conecte e sincronize contas Instagram profissionais</Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, instagram?.conectado ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={styles.statusLabel}>Status da integração: {instagram?.statusLabel}</Text>
            </View>

            <Pressable style={styles.primaryButton} onPress={abrirNoPortal}>
              <Text style={styles.primaryButtonText}>Aprovar acesso Instagram</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Os botões acima abrem o portal web (localhost:5173) para concluir a vinculação com a Meta.
          </Text>
        </ScrollView>
      )}
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
      gap: 16,
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
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 22,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusDotActive: {
      backgroundColor: '#3ECF8E',
    },
    statusDotInactive: {
      backgroundColor: colors.muted,
    },
    statusLabel: {
      fontSize: 12,
      color: colors.textPrimary,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    primaryButton: {
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    primaryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    secondaryPill: {
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    expandedPanel: {
      gap: 12,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.elevated,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      gap: 4,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.muted,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    statValueSmall: {
      fontSize: 11,
      color: colors.textPrimary,
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    numberInfo: {
      flex: 1,
      gap: 2,
    },
    numberPhone: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    numberSub: {
      fontSize: 11,
      color: colors.muted,
    },
    activeBadge: {
      backgroundColor: 'rgba(62,207,142,0.15)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    activeBadgeInactive: {
      backgroundColor: 'rgba(163,163,163,0.15)',
    },
    activeBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#3ECF8E',
    },
    activeBadgeTextInactive: {
      color: colors.muted,
    },
    openManagementLink: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
    hint: {
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
