import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { FeedbackSheet } from '@/components/FeedbackSheet';
import { SupportContacts } from '@/components/SupportContacts';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import type { FeedbackTipo } from '@/services/feedbackApi';
import {
  AssinaturaAtual,
  HistoricoPagamento,
  getAssinaturaAtual,
  listarHistoricoPagamentos,
} from '@/services/pagamentoApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatCurrency, formatDate } from '@/utils/format';

const PORTAL_ASSINATURA_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/configuracoes`;

function diasRestantes(validade: string | null): number | null {
  if (!validade) return null;
  const alvo = new Date(validade);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  return Math.max(0, diff);
}

export default function PlanosScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [assinatura, setAssinatura] = useState<AssinaturaAtual | null>(null);

  const [feedbackTipo, setFeedbackTipo] = useState<FeedbackTipo | null>(null);
  const [historicoVisible, setHistoricoVisible] = useState(false);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historico, setHistorico] = useState<HistoricoPagamento[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const atual = await getAssinaturaAtual(user);
        setAssinatura(atual);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível carregar sua assinatura.');
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  const dias = diasRestantes(assinatura?.validade ?? null);
  const cancelada = Boolean(assinatura?.stripe_cancel_at_period_end || assinatura?.request_unsubscribe);

  async function handleVerHistorico() {
    setHistoricoVisible(true);
    setHistoricoLoading(true);
    try {
      const rows = await listarHistoricoPagamentos(user!, 30);
      setHistorico(rows);
    } catch (err: any) {
      setHistorico([]);
    } finally {
      setHistoricoLoading(false);
    }
  }

  function handleGerenciarNoPortal() {
    WebBrowser.openBrowserAsync(PORTAL_ASSINATURA_URL);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Planos e Suporte</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.muted} />}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.subtitle}>{error}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              {cancelada ? 'ASSINATURA CANCELADA' : 'ASSINATURA VIGENTE'}
            </Text>

            <Text style={styles.planoLabel}>
              Você está inscrito no plano:{' '}
              <Text style={styles.planoNome}>{(assinatura?.plano_nome || '-').toUpperCase()}</Text>
            </Text>

            {cancelada && (
              <Text style={styles.avisoCancelamento}>
                Assinatura cancelada ao fim do período. Você ainda pode usar normalmente até a validade.
              </Text>
            )}

            {dias !== null && (
              <View style={styles.diasPill}>
                <Text style={styles.diasPillText}>Acesso por mais {dias} dia(s)</Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryButton} onPress={handleVerHistorico}>
                <Text style={styles.secondaryButtonText}>Ver histórico de pagamentos</Text>
              </Pressable>
            </View>

            {cancelada && (
              <Pressable style={styles.dangerButton} onPress={handleGerenciarNoPortal}>
                <Text style={styles.dangerButtonText}>Reativar assinatura</Text>
              </Pressable>
            )}

            <Pressable style={styles.primaryButton} onPress={handleGerenciarNoPortal}>
              <Text style={styles.primaryButtonText}>Gerenciar</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.hint}>
          Troca de plano, cupons e cobrança avançada são feitos no portal web
          (localhost:5173). O botão acima abre o portal para você concluir por lá.
        </Text>

        <Text style={styles.sectionTitle}>Precisa de Ajuda?</Text>

        <View style={styles.helpRow}>
          <Pressable style={styles.helpCard} onPress={() => setFeedbackTipo('support')}>
            <View style={[styles.helpIcon, styles.helpIconSuporte]}>
              <Ionicons name="headset-outline" size={18} color="#38bdf8" />
            </View>
            <View style={styles.helpInfo}>
              <Text style={styles.helpLabel}>Suporte Técnico</Text>
              <Text style={styles.helpDescription}>Relatar um problema ou erro</Text>
            </View>
          </Pressable>

          <Pressable style={styles.helpCard} onPress={() => setFeedbackTipo('suggestion')}>
            <View style={[styles.helpIcon, styles.helpIconSugestoes]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#f59e0b" />
            </View>
            <View style={styles.helpInfo}>
              <Text style={styles.helpLabel}>Sugestões</Text>
              <Text style={styles.helpDescription}>Envie ideias de melhoria</Text>
            </View>
          </Pressable>
        </View>

        <SupportContacts />
      </ScrollView>

      <FeedbackSheet
        visible={feedbackTipo !== null}
        tipo={feedbackTipo ?? 'support'}
        onClose={() => setFeedbackTipo(null)}
      />

      <Modal
        visible={historicoVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoricoVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHistoricoVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Histórico de pagamentos</Text>
              <Pressable onPress={() => setHistoricoVisible(false)} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {historicoLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.muted} />
              </View>
            ) : historico.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.subtitle}>Nenhum pagamento encontrado.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.historicoList}>
                {historico.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.historicoRow}
                    onPress={() =>
                      item.hosted_invoice_url && WebBrowser.openBrowserAsync(item.hosted_invoice_url)
                    }
                    disabled={!item.hosted_invoice_url}
                  >
                    <View style={styles.historicoInfo}>
                      <Text style={styles.historicoPlano}>{item.plano_nome || 'Assinatura'}</Text>
                      <Text style={styles.historicoData}>
                        {formatDate(item.paid_at || item.due_date || item.created_at)}
                      </Text>
                    </View>
                    <View style={styles.historicoValorBox}>
                      <Text style={styles.historicoValor}>{formatCurrency(Number(item.valor_total || 0))}</Text>
                      <Text
                        style={[
                          styles.historicoStatus,
                          item.paid ? styles.historicoStatusPago : styles.historicoStatusPendente,
                        ]}
                      >
                        {item.paid ? 'PAGO' : item.status.toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 16,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 40,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    card: {
      borderRadius: 16,
      padding: 18,
      gap: 14,
      ...cardSurface(colors, scheme),
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      letterSpacing: 0.6,
    },
    planoLabel: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    planoNome: {
      fontWeight: '800',
      color: colors.textPrimary,
    },
    avisoCancelamento: {
      fontSize: 13,
      color: '#f59e0b',
    },
    diasPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    diasPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    secondaryButton: {
      flexGrow: 1,
      height: 46,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dangerButton: {
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.4)',
      backgroundColor: 'rgba(239,68,68,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ef4444',
    },
    primaryButton: {
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    hint: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: 4,
    },
    helpRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    helpCard: {
      flexGrow: 1,
      flexBasis: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      padding: 14,
      ...cardSurface(colors, scheme),
    },
    helpIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpIconSuporte: {
      backgroundColor: 'rgba(56,189,248,0.12)',
    },
    helpIconSugestoes: {
      backgroundColor: 'rgba(245,158,11,0.12)',
    },
    helpInfo: {
      flex: 1,
      gap: 2,
    },
    helpLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    helpDescription: {
      fontSize: 11,
      color: colors.muted,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '80%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 28,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historicoList: {
      gap: 10,
      paddingBottom: 12,
    },
    historicoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 14,
      padding: 14,
      ...cardSurface(colors, scheme),
    },
    historicoInfo: {
      gap: 2,
    },
    historicoPlano: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    historicoData: {
      fontSize: 12,
      color: colors.muted,
    },
    historicoValorBox: {
      alignItems: 'flex-end',
      gap: 2,
    },
    historicoValor: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    historicoStatus: {
      fontSize: 10,
      fontWeight: '700',
    },
    historicoStatusPago: {
      color: '#22c55e',
    },
    historicoStatusPendente: {
      color: '#f59e0b',
    },
  });
