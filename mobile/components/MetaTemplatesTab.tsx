import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CreateTemplateSheet } from '@/components/CreateTemplateSheet';
import { MetaAccountSelector } from '@/components/MetaAccountSelector';
import { TemplateDetailSheet } from '@/components/TemplateDetailSheet';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  deletarTemplate,
  DispatchCostSummary,
  getContasMeta,
  getTemplates,
  MetaAccount,
  MetaTemplate,
  metricasCustoDisparo,
  metricasTemplate,
  summarizeTemplateMetrics,
} from '@/services/metaApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface MetaTemplatesTabProps {
  user: User;
}

const STATUS_STYLES: Record<string, { label: string; color: string; background: string }> = {
  APPROVED: { label: 'Aprovado', color: '#3DDC97', background: 'rgba(61,220,151,0.12)' },
  PENDING: { label: 'Pendente', color: '#F2C94C', background: 'rgba(242,201,76,0.12)' },
  REJECTED: { label: 'Rejeitado', color: '#FF6B6B', background: 'rgba(255,107,107,0.12)' },
};

function getBodyPreview(template: MetaTemplate): string {
  return String(template.components?.body?.text || '');
}

export function MetaTemplatesTab({ user }: MetaTemplatesTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [costSummary, setCostSummary] = useState<DispatchCostSummary | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [templateMetrics, setTemplateMetrics] = useState<{ sent: number; delivered: number; read: number } | null>(
    null
  );
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<MetaTemplate | null>(null);

  useEffect(() => {
    getContasMeta(user)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length > 0 ? data[0].id : null);
      })
      .catch(() => setNumeros([]));
  }, [user]);

  useEffect(() => {
    if (!metaParamId) return;
    metricasCustoDisparo(user, metaParamId)
      .then((data) => setCostSummary(data.summary))
      .catch(() => setCostSummary(null));
  }, [user, metaParamId]);

  const load = useCallback(async () => {
    if (!metaParamId) return;
    setError('');
    try {
      const data = await getTemplates(user, metaParamId);
      setTemplates(data);
    } catch (err: any) {
      setTemplates([]);
      setError(err?.message || 'Não foi possível carregar os templates.');
    }
  }, [user, metaParamId]);

  useEffect(() => {
    if (!metaParamId) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, metaParamId]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const activeAccount = useMemo(
    () => numeros.find((numero) => numero.id === metaParamId) || null,
    [numeros, metaParamId]
  );

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [templates, search]);

  async function toggleMetrics(template: MetaTemplate) {
    if (expandedName === template.name) {
      setExpandedName(null);
      setTemplateMetrics(null);
      return;
    }

    setExpandedName(template.name);
    setTemplateMetrics(null);

    if (!template.id) return;

    setLoadingMetrics(true);
    try {
      const data = await metricasTemplate(user, template.id, metaParamId ?? undefined);
      setTemplateMetrics(summarizeTemplateMetrics(data.metrics));
    } catch {
      setTemplateMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
  }

  function confirmDelete(template: MetaTemplate) {
    Alert.alert(
      'Remover template',
      `Tem certeza que deseja remover o template ${template.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setDeletingName(template.name);
            try {
              await deletarTemplate(user, template.name, metaParamId ?? undefined);
              setTemplates((prev) => prev.filter((item) => item.name !== template.name));
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover o template.');
            } finally {
              setDeletingName(null);
            }
          },
        },
      ]
    );
  }

  function renderTemplate({ item }: { item: MetaTemplate }) {
    const statusKey = String(item.status || '').toUpperCase();
    const statusStyle = STATUS_STYLES[statusKey] || {
      label: item.status || '-',
      color: colors.muted,
      background: colors.elevated,
    };
    const preview = getBodyPreview(item);
    const expanded = expandedName === item.name;

    return (
      <Pressable style={styles.card} onPress={() => setDetailTemplate(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
            <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {!!item.category && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{item.category}</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text style={styles.chipText}>{item.language}</Text>
          </View>
        </View>

        {!!preview && (
          <Text style={styles.previewText} numberOfLines={3}>
            {preview}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.openButton} onPress={() => setDetailTemplate(item)}>
            <Ionicons name="open-outline" size={14} color={colors.accent} />
            <Text style={styles.openButtonText}>Abrir template</Text>
          </Pressable>
          <Pressable
            style={[styles.metricsButton, expanded && styles.metricsButtonActive]}
            onPress={() => toggleMetrics(item)}
          >
            <Ionicons
              name="stats-chart-outline"
              size={14}
              color={expanded ? '#141414' : colors.accent}
            />
            <Text style={[styles.metricsButtonText, expanded && styles.metricsButtonTextActive]}>
              Métricas
            </Text>
          </Pressable>
          <Pressable
            style={styles.deleteButton}
            onPress={() => confirmDelete(item)}
            disabled={deletingName === item.name}
          >
            {deletingName === item.name ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
                <Text style={styles.deleteText}>Remover</Text>
              </>
            )}
          </Pressable>
        </View>

        {expanded && (
          <View style={styles.metricsBox}>
            {loadingMetrics ? (
              <ActivityIndicator color={colors.muted} style={styles.metricsLoading} />
            ) : !item.id ? (
              <Text style={styles.metricsEmpty}>
                Este template não tem ID retornado pela Meta para consultar métricas.
              </Text>
            ) : !templateMetrics ? (
              <Text style={styles.metricsEmpty}>Não foi possível carregar as métricas.</Text>
            ) : (
              <View style={styles.metricsRow}>
                <View style={styles.metricStat}>
                  <Text style={styles.metricValue}>{templateMetrics.sent}</Text>
                  <Text style={styles.metricLabel}>Enviados</Text>
                </View>
                <View style={styles.metricStat}>
                  <Text style={styles.metricValue}>{templateMetrics.delivered}</Text>
                  <Text style={styles.metricLabel}>Entregues</Text>
                </View>
                <View style={styles.metricStat}>
                  <Text style={styles.metricValue}>{templateMetrics.read}</Text>
                  <Text style={styles.metricLabel}>Lidos</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <>
      <View style={styles.accountSelectorWrap}>
        <MetaAccountSelector numeros={numeros} activeId={metaParamId} onChange={setMetaParamId} />
      </View>

      {!!activeAccount && (
        <View style={styles.linkedRow}>
          <Text style={styles.linkedText}>
            Vinculado a: {activeAccount.display_phone_number || `#${activeAccount.id}`}
            {activeAccount.whatsapp_account_name ? ` • ${activeAccount.whatsapp_account_name}` : ''}
            {activeAccount.whatsapp_account_id ? ` • WABA ${activeAccount.whatsapp_account_id}` : ''}
          </Text>
        </View>
      )}

      {!!costSummary && (
        <View style={styles.costBar}>
          <Ionicons name="cash-outline" size={14} color={colors.muted} />
          <Text style={styles.costBarText}>
            Custo (7 dias): US$ {costSummary.total_cost.toFixed(2)} • {costSummary.total_volume} msg
            {costSummary.cost_per_message > 0
              ? ` • US$ ${costSummary.cost_per_message.toFixed(4)}/msg`
              : ''}
          </Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar template..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable style={styles.newButton} onPress={() => setCreateVisible(true)}>
          <Ionicons name="add" size={16} color="#141414" />
          <Text style={styles.newButtonText}>Novo Template</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Erro</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.flatListFlex}
          data={filteredTemplates}
          keyExtractor={(item) => `${item.name}-${item.language}`}
          renderItem={renderTemplate}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.subtitle}>Nenhum template encontrado.</Text>
            </View>
          }
        />
      )}

      <CreateTemplateSheet
        visible={createVisible}
        user={user}
        metaParamId={metaParamId}
        onClose={() => setCreateVisible(false)}
        onCreated={load}
      />

      <TemplateDetailSheet
        visible={!!detailTemplate}
        user={user}
        template={detailTemplate}
        metaParamId={metaParamId}
        onClose={() => setDetailTemplate(null)}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') => StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  flatListFlex: {
    flex: 1,
  },
  accountSelectorWrap: {
    paddingHorizontal: 24,
    marginBottom: 12,
    flexShrink: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 14,
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141414',
  },
  linkedRow: {
    paddingHorizontal: 24,
    marginBottom: 8,
    flexShrink: 0,
  },
  linkedText: {
    fontSize: 11,
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    ...cardSurface(colors, scheme),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primarySubtle,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  previewText: {
    fontSize: 13,
    color: '#D0D0D0',
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  openButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  metricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.primarySubtle,
  },
  metricsButtonActive: {
    backgroundColor: colors.accent,
  },
  metricsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  metricsButtonTextActive: {
    color: '#141414',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  metricsBox: {
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricsLoading: {
    paddingVertical: 10,
  },
  metricsEmpty: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricStat: {
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  costBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  costBarText: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
  },
});
