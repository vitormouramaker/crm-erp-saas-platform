import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import {
  AnaliseAtendimentoIA,
  analisarAtendimentoIA,
  Conversa,
} from '@/services/atendimentoApi';
import type { User } from '@/types';

interface AnaliseIASheetProps {
  visible: boolean;
  authUser: User;
  conversa: (Pick<Conversa, 'id'> & Partial<Pick<Conversa, 'nome'>>) | null;
  onClose: () => void;
}

function notaColor(nota: number, colors: ThemeColors): string {
  if (nota >= 8) return '#4ADE80';
  if (nota >= 5) return colors.accent;
  return '#FF6B6B';
}

export function AnaliseIASheet({ visible, authUser, conversa, onClose }: AnaliseIASheetProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<AnaliseAtendimentoIA | null>(null);

  useEffect(() => {
    if (!visible || !conversa) return;
    setLoading(true);
    setError('');
    setResultado(null);
    analisarAtendimentoIA(authUser, conversa.id)
      .then(setResultado)
      .catch((err: any) => {
        setError(err?.message || 'Não foi possível gerar a análise.');
      })
      .finally(() => setLoading(false));
  }, [visible, conversa?.id, authUser.id]);

  const analise = resultado?.analise;
  const etapas = analise ? Object.entries(analise.notas_por_etapa || {}) : [];

  function renderLista(titulo: string, itens: string[]) {
    if (!itens?.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{titulo}</Text>
        {itens.map((item, index) => (
          <View key={index} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Análise IA do atendimento</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.muted} />
              <Text style={styles.loadingText}>Analisando conversa com IA...</Text>
            </View>
          ) : error ? (
            <View style={styles.loadingBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : analise ? (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.headerCard}>
                <View style={styles.headerInfo}>
                  <Text style={styles.clienteNome} numberOfLines={1}>
                    {resultado?.cliente?.nome || conversa?.nome || 'Cliente'}
                  </Text>
                  {!!resultado?.atendente?.nome && (
                    <Text style={styles.atendenteNome} numberOfLines={1}>
                      Atendente: {resultado.atendente.nome}
                    </Text>
                  )}
                  <Text style={styles.totalMensagens}>
                    {resultado?.total_mensagens || 0} mensagem(ns) analisada(s)
                  </Text>
                </View>
                <View style={[styles.notaCircle, { borderColor: notaColor(analise.nota_final, colors) }]}>
                  <Text style={[styles.notaValor, { color: notaColor(analise.nota_final, colors) }]}>
                    {Number(analise.nota_final || 0).toFixed(1)}
                  </Text>
                  <Text style={styles.notaLabel}>nota</Text>
                </View>
              </View>

              {etapas.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notas por etapa</Text>
                  {etapas.map(([etapa, nota]) => (
                    <View key={etapa} style={styles.etapaRow}>
                      <Text style={styles.etapaNome}>{etapa.replace(/_/g, ' ')}</Text>
                      <Text style={[styles.etapaNota, { color: notaColor(Number(nota), colors) }]}>
                        {Number(nota || 0).toFixed(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Risco de perda</Text>
                <Text style={styles.sectionText}>{analise.risco_perda}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Probabilidade de avanço</Text>
                <Text style={styles.sectionText}>{analise.probabilidade_avanco}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Próxima etapa recomendada</Text>
                <Text style={styles.sectionText}>{analise.proxima_etapa_recomendada}</Text>
              </View>

              {renderLista('Diagnóstico de gargalos', analise.diagnostico_gargalos)}
              {renderLista('KPIs comerciais', analise.kpis_comerciais)}
              {renderLista('Ajustes finos', analise.ajustes_finos)}
              {renderLista('Boas práticas a reforçar', analise.boas_praticas_reforcar)}
              {renderLista('Sugestão de script imediato', analise.script_sugestao_imediato)}
              {renderLista('Script completo nota 10', analise.script_completo_nota_10)}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '90%',
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
      marginBottom: 18,
    },
    sheetTitle: {
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
    loadingBox: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 13,
      color: colors.muted,
    },
    errorText: {
      fontSize: 13,
      color: '#FF6B6B',
      textAlign: 'center',
    },
    body: {
      gap: 14,
      paddingBottom: 8,
    },
    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 16,
      padding: 14,
      ...cardSurface(colors, scheme),
    },
    headerInfo: {
      flex: 1,
      gap: 4,
    },
    clienteNome: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    atendenteNome: {
      fontSize: 12,
      color: colors.muted,
    },
    totalMensagens: {
      fontSize: 11,
      color: colors.muted,
    },
    notaCircle: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notaValor: {
      fontSize: 18,
      fontWeight: '700',
    },
    notaLabel: {
      fontSize: 9,
      color: colors.muted,
    },
    section: {
      borderRadius: 16,
      padding: 14,
      gap: 8,
      ...cardSurface(colors, scheme),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    sectionText: {
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
    },
    etapaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    etapaNome: {
      flex: 1,
      fontSize: 12,
      color: colors.muted,
      textTransform: 'capitalize',
    },
    etapaNota: {
      fontSize: 13,
      fontWeight: '700',
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 8,
    },
    bulletDot: {
      fontSize: 13,
      color: colors.muted,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 19,
    },
  });
