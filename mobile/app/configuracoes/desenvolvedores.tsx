import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  DeveloperWebhook,
  DeveloperWebhookEvent,
  listarDeveloperWebhooks,
} from '@/services/developerWebhooksApi';
import { canManageDesenvolvedores } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

const PORTAL_DEV_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/configuracoes`;

export default function DesenvolvedoresScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [webhooks, setWebhooks] = useState<DeveloperWebhook[]>([]);
  const [eventCatalog, setEventCatalog] = useState<DeveloperWebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const allowed = !!user && canManageDesenvolvedores(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await listarDeveloperWebhooks(user);
      setWebhooks(data.webhooks);
      setEventCatalog(data.eventCatalog);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os webhooks.');
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
        <Text style={styles.title}>Desenvolvedores</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para ver esta área.</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Webhooks cadastrados</Text>

            {webhooks.length === 0 ? (
              <Text style={styles.cardDescription}>Nenhum webhook cadastrado ainda.</Text>
            ) : (
              <View style={styles.webhookList}>
                {webhooks.map((webhook) => (
                  <View key={webhook.id} style={styles.webhookItem}>
                    <View style={styles.webhookItemHeader}>
                      <Text style={styles.webhookName}>{webhook.nome}</Text>
                      <View style={[styles.statusBadge, webhook.ativo ? styles.statusActive : styles.statusInactive]}>
                        <Text style={[styles.statusText, !webhook.ativo && styles.statusTextInactive]}>
                          {webhook.ativo ? 'ATIVO' : 'INATIVO'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.webhookUrl} numberOfLines={1}>
                      {webhook.url}
                    </Text>
                    <View style={styles.chipsRow}>
                      {webhook.eventos.map((key) => (
                        <View key={key} style={styles.chip}>
                          <Text style={styles.chipText}>
                            {eventCatalog.find((item) => item.key === key)?.label || key}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.hint}>
            Novos webhooks são criados e editados apenas no portal web (localhost:5173).
            Aqui você acompanha os que já estão cadastrados.
          </Text>

          <Pressable style={styles.portalButton} onPress={() => WebBrowser.openBrowserAsync(PORTAL_DEV_URL)}>
            <Ionicons name="open-outline" size={16} color="#141414" />
            <Text style={styles.portalButtonText}>Abrir portal web</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') => StyleSheet.create({
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
    gap: 14,
    ...cardSurface(colors, scheme),
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
  webhookList: {
    gap: 12,
  },
  webhookItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  webhookItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webhookName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  webhookUrl: {
    fontSize: 12,
    color: colors.muted,
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
    backgroundColor: colors.elevated,
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
