import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { getWebhookConfig, WebhookConfig } from '@/services/integracoesApi';
import { canSeeIntegracoes } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

const PORTAL_INTEGRACOES_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/configuracoes`;

function CopyField({ label, value }: { label: string; value: string }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [copiado, setCopiado] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldValue} numberOfLines={1} selectable>
          {value}
        </Text>
        <Pressable style={styles.copyButton} onPress={handleCopy} hitSlop={8}>
          <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={16} color={copiado ? colors.accent : colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function IntegracoesScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const allowed = !!user && canSeeIntegracoes(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getWebhookConfig(user);
      setConfig(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as integrações.');
    }
  }, [user, allowed]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Integrações</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para ver as integrações.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : config ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Webhook de Cliente</Text>
              <View style={[styles.statusBadge, config.webhookAtivo ? styles.statusActive : styles.statusInactive]}>
                <Text style={[styles.statusText, !config.webhookAtivo && styles.statusTextInactive]}>
                  {config.webhookAtivo ? 'ATIVO' : 'INATIVO'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>
              Use esta URL para enviar novos clientes automaticamente de outra ferramenta.
            </Text>
            <CopyField label="URL do webhook" value={config.webhookUrl} />
            <CopyField label="Método" value={config.webhookMetodo} />
            <CopyField label="Código de validação" value={config.webhookCodigoValidacao} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Webhook N8N</Text>
            <Text style={styles.cardDescription}>Endpoint dedicado para automações via N8N.</Text>
            <CopyField label="URL do webhook" value={config.n8nWebhookUrl} />
            <CopyField label="Método" value={config.n8nWebhookMetodo} />
            <CopyField label="Campo do segredo" value={config.n8nWebhookSecretField} />
            <CopyField label="Header de validação" value={config.n8nWebhookHeaderValidacao} />
          </View>

          <Text style={styles.hint}>
            Novas integrações e conexões são configuradas apenas no portal web
            (localhost:5173). Aqui você consulta e copia as URLs e credenciais já geradas.
          </Text>

          <Pressable style={styles.portalButton} onPress={() => WebBrowser.openBrowserAsync(PORTAL_INTEGRACOES_URL)}>
            <Ionicons name="open-outline" size={16} color="#141414" />
            <Text style={styles.portalButtonText}>Abrir portal web</Text>
          </Pressable>
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
    hint: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
    },
    portalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.accent,
    },
    portalButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    card: {
      borderRadius: 16,
      padding: 16,
      gap: 14,
      ...cardSurface(colors, scheme),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDescription: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
      marginTop: -6,
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusActive: {
      backgroundColor: colors.primarySubtle,
    },
    statusInactive: {
      backgroundColor: 'rgba(163,163,163,0.15)',
    },
    statusText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.accent,
    },
    statusTextInactive: {
      color: colors.muted,
    },
    field: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fieldValue: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    copyButton: {
      padding: 4,
    },
  });
