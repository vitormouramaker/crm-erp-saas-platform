import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AddToListSheet } from '@/components/AddToListSheet';
import { AppDrawer } from '@/components/AppDrawer';
import { BroadcastListsTab } from '@/components/BroadcastListsTab';
import {
  ContactFilters,
  ContactFilterSheet,
  countActiveContactFilters,
  EMPTY_CONTACT_FILTERS,
} from '@/components/ContactFilterSheet';
import { ContactFormModal } from '@/components/ContactFormModal';
import { ContactsActionsMenu } from '@/components/ContactsActionsMenu';
import { DirectSaleModal } from '@/components/DirectSaleModal';
import {
  type AdReferralInfo,
  buscarAnuncioOrigemConversa,
  buscarDetalhesCliente,
  formatEnderecoCliente,
} from '@/services/atendimentoApi';
import { LeadsTab } from '@/components/LeadsTab';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { SendTemplateSheet } from '@/components/SendTemplateSheet';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useContactsImportExport } from '@/hooks/useContactsImportExport';
import {
  Cliente,
  ClienteTag,
  getClientes,
  getTags,
  removerCliente,
} from '@/services/clientesApi';
import { canSeeContatos } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatCurrency } from '@/utils/format';

const PAGE_SIZE = 15;

type ContatosTab = 'clientes' | 'listas' | 'leads';

const TABS: { key: ContatosTab; label: string; enabled: boolean }[] = [
  { key: 'clientes', label: 'Clientes', enabled: true },
  { key: 'listas', label: 'Lista de transmissão', enabled: true },
  { key: 'leads', label: 'Leads Meta Ads', enabled: true },
];

const ORIGEM_LABELS: Record<string, string> = {
  manual: 'Manual',
  whatsapp: 'WhatsApp',
  meta_ads: 'Meta Ads',
  importacao: 'Importação',
  comercial: 'Comercial',
};

interface ClienteExtraDetalhes {
  empresa: string | null;
  cargo: string | null;
  faturamento: string | null;
  endereco: string | null;
  produtoPrincipal: string | null;
  valorEstimado: number | null;
  interacoesCount: number;
  historicoCount: number;
  adReferral: AdReferralInfo | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatBRDate(value: string | null): string {
  if (!value) return '-';
  const iso = value.split('T')[0];
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '-';
  return `${d}/${m}/${y}`;
}

function formatBirthday(value: string | null): string {
  if (!value) return '-';
  const iso = value.split('T')[0];
  const [, m, d] = iso.split('-');
  if (!m || !d) return '-';
  return `${d}/${m}`;
}

export default function ContatosScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<ContactFilters>(EMPTY_CONTACT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tags, setTags] = useState<ClienteTag[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [extraById, setExtraById] = useState<Record<number, 'loading' | 'error' | ClienteExtraDetalhes>>({});
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState<ContatosTab>('clientes');
  const [listSheetCliente, setListSheetCliente] = useState<Cliente | null>(null);
  const [templateSheetCliente, setTemplateSheetCliente] = useState<Cliente | null>(null);
  const [directSaleCliente, setDirectSaleCliente] = useState<Cliente | null>(null);
  const [actionsMenuVisible, setActionsMenuVisible] = useState(false);
  const paginaRef = useRef(1);

  const allowed = !!user && canSeeContatos(user);
  const activeFilters = countActiveContactFilters(filters);
  const { exporting, importing, exportContacts, importContacts } = useContactsImportExport(user);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadFirstPage = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const page = await getClientes(user, {
        pagina: 1,
        limite: PAGE_SIZE,
        busca: debouncedSearch,
        filtro: filters.filtro,
        filtros_compostos: filters.compostos,
      });
      paginaRef.current = 1;
      setClientes(page.items);
      setTotal(page.total);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os contatos.');
    }
  }, [user, allowed, debouncedSearch, filters]);

  useEffect(() => {
    setLoading(true);
    loadFirstPage().finally(() => setLoading(false));
  }, [loadFirstPage]);

  useEffect(() => {
    if (!user || !allowed) return;
    getTags(user)
      .then(setTags)
      .catch(() => setTags([]));
  }, [user, allowed]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }

  const hasMore = clientes.length < total;

  async function handleEndReached() {
    if (!user || !hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = paginaRef.current + 1;
      const page = await getClientes(user, {
        pagina: nextPage,
        limite: PAGE_SIZE,
        busca: debouncedSearch,
        filtro: filters.filtro,
        filtros_compostos: filters.compostos,
      });
      paginaRef.current = nextPage;
      setClientes((prev) => {
        const known = new Set(prev.map((item) => item.id));
        return [...prev, ...page.items.filter((item) => !known.has(item.id))];
      });
      if (page.total > 0) setTotal(page.total);
    } catch {
      // Falha ao paginar não derruba a lista já carregada
    } finally {
      setLoadingMore(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormVisible(true);
  }

  function openEdit(cliente: Cliente) {
    setEditing(cliente);
    setFormVisible(true);
  }

  async function handleSaved() {
    setFormVisible(false);
    setEditing(null);
    await loadFirstPage();
  }

  async function loadExtraDetalhes(clienteId: number) {
    if (!user || extraById[clienteId]) return;
    setExtraById((prev) => ({ ...prev, [clienteId]: 'loading' }));
    try {
      const detalhes = await buscarDetalhesCliente(user, clienteId);
      const conversaId = detalhes.historico_atendimentos_whatsapp[0]?.conversa_id;
      const adReferral = conversaId ? await buscarAnuncioOrigemConversa(user, conversaId) : null;

      setExtraById((prev) => ({
        ...prev,
        [clienteId]: {
          empresa: detalhes.cliente?.empresa || null,
          cargo: detalhes.cliente?.cargo || null,
          faturamento: detalhes.cliente?.faturamento || null,
          endereco: formatEnderecoCliente(detalhes.cliente),
          produtoPrincipal: detalhes.crm.atendimento?.produto_principal || null,
          valorEstimado: detalhes.crm.atendimento?.valor_estimado ?? null,
          interacoesCount: detalhes.crm.interacoes.length,
          historicoCount: detalhes.crm.historico.length,
          adReferral,
        },
      }));
    } catch {
      setExtraById((prev) => ({ ...prev, [clienteId]: 'error' }));
    }
  }

  function confirmDelete(cliente: Cliente) {
    Alert.alert(
      'Remover contato',
      `Tem certeza que deseja remover ${cliente.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removerCliente(cliente.id);
              await loadFirstPage();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover o contato.');
            }
          },
        },
      ]
    );
  }

  function renderMiniSection(label: string) {
    return <Text style={styles.detailSectionLabel}>{label}</Text>;
  }

  function renderDetailRow(label: string, value: string) {
    return (
      <View style={styles.detailRow} key={label}>
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  }

  function renderAdReferralCard(ref: AdReferralInfo) {
    return (
      <View style={styles.adReferralCard}>
        <View style={styles.adReferralHeaderRow}>
          {!!ref.image_url && (
            <Image source={{ uri: ref.image_url }} style={styles.adReferralThumb} resizeMode="cover" />
          )}
          <View style={styles.adReferralHeaderText}>
            <Text style={styles.adReferralTitle}>Anúncio de origem</Text>
            {!!ref.headline && (
              <Text style={styles.adReferralHeadline} numberOfLines={2}>
                {ref.headline}
              </Text>
            )}
          </View>
        </View>
        {!!ref.body && (
          <Text style={styles.adReferralBody} numberOfLines={3}>
            {ref.body}
          </Text>
        )}
        {(!!ref.source_type || !!ref.media_type) && (
          <Text style={styles.adReferralMeta}>
            {[ref.source_type ? `Origem: ${ref.source_type}` : null, ref.media_type ? `Mídia: ${ref.media_type}` : null]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        )}
        {!!ref.source_id && <Text style={styles.adReferralMeta}>ID do clique: {ref.source_id}</Text>}
        {!!ref.source_url && (
          <Pressable style={styles.adReferralLink} onPress={() => Linking.openURL(ref.source_url!)}>
            <Ionicons name="open-outline" size={13} color={colors.accent} />
            <Text style={styles.adReferralLinkText}>Abrir anúncio</Text>
          </Pressable>
        )}
      </View>
    );
  }

  function renderCliente({ item }: { item: Cliente }) {
    const expanded = expandedId === item.id;
    const origemLabel = item.origem ? ORIGEM_LABELS[item.origem] || item.origem : null;
    const extra = extraById[item.id];
    const extraLoaded = extra && extra !== 'loading' && extra !== 'error' ? extra : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={12} color={colors.muted} />
              <Text style={styles.cardPhone}>{item.phone || '-'}</Text>
            </View>
          </View>
          {origemLabel && (
            <View style={styles.origemBadge}>
              <Text style={styles.origemText}>{origemLabel}</Text>
            </View>
          )}
        </View>

        <View style={styles.chipsRow}>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={11} color={colors.muted} />
            <Text style={styles.metaChipText}>{formatBirthday(item.data_aniversario)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={11} color={colors.muted} />
            <Text style={styles.metaChipText}>{formatBRDate(item.data_cadastro)}</Text>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {item.tags.length === 0 ? (
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>Sem tags</Text>
            </View>
          ) : (
            item.tags.map((tag) => (
              <View key={tag.id} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={() => confirmDelete(item)} hitSlop={4}>
            <Ionicons name="trash-outline" size={14} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={4}>
            <Ionicons name="create-outline" size={14} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            style={[styles.actionButton, expanded && styles.actionButtonActive]}
            onPress={() => {
              const next = !expanded;
              setExpandedId(next ? item.id : null);
              if (next) loadExtraDetalhes(item.id);
            }}
            hitSlop={4}
          >
            <Ionicons name="eye-outline" size={14} color={expanded ? '#141414' : colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.saleButton} onPress={() => setDirectSaleCliente(item)} hitSlop={4}>
            <Ionicons name="cash-outline" size={14} color="#141414" />
          </Pressable>
          <Pressable style={styles.listButton} onPress={() => setListSheetCliente(item)}>
            <Ionicons name="albums-outline" size={12} color="#7EA0FF" />
            <Text style={styles.listButtonText} numberOfLines={1}>Lista</Text>
          </Pressable>
          <Pressable style={styles.templateButton} onPress={() => setTemplateSheetCliente(item)}>
            <Ionicons name="paper-plane-outline" size={12} color={colors.textPrimary} />
            <Text style={styles.templateButtonText} numberOfLines={1}>Template</Text>
          </Pressable>
        </View>

        {expanded && (
          <View style={styles.details}>
            {renderMiniSection('Contato')}
            {renderDetailRow('E-mail', item.email || '-')}
            {renderDetailRow('CPF', item.cpf || '-')}
            {renderDetailRow('Último contato', formatBRDate(item.last_contact))}

            {renderMiniSection('Comercial')}
            {renderDetailRow(
              'Compras',
              `${Number(item.total_purchases || 0)} • ${formatCurrency(Number(item.total_spent || 0))}`
            )}
            {renderDetailRow('Ticket médio', formatCurrency(Number(item.average_ticket || 0)))}
            {renderDetailRow('Atendimentos', String(Number(item.total_whatsapp_attendances || 0)))}

            {(item.crm_title || extraLoaded) && (
              <>
                {renderMiniSection('Funil')}
                {!!item.crm_title &&
                  renderDetailRow(
                    'Funil',
                    [item.crm_nome, item.crm_title, item.crm_stage_name].filter(Boolean).join(' • ')
                  )}
                {!!item.crm_responsible_name && renderDetailRow('Responsável', item.crm_responsible_name)}
                {!!extraLoaded?.produtoPrincipal && renderDetailRow('Produto', extraLoaded.produtoPrincipal)}
                {extraLoaded?.valorEstimado != null &&
                  renderDetailRow('Valor estimado', formatCurrency(Number(extraLoaded.valorEstimado)))}
                {!!extraLoaded && renderDetailRow('Interações', String(extraLoaded.interacoesCount))}
                {!!extraLoaded && renderDetailRow('Histórico do funil', String(extraLoaded.historicoCount))}
              </>
            )}

            {extra === 'loading' && (
              <View style={styles.adReferralLoading}>
                <ActivityIndicator size="small" color={colors.muted} />
                <Text style={styles.adReferralLoadingText}>Carregando dados adicionais...</Text>
              </View>
            )}

            {!!extraLoaded && (extraLoaded.empresa || extraLoaded.cargo || extraLoaded.faturamento || extraLoaded.endereco) && (
              <>
                {renderMiniSection('Empresa')}
                {!!extraLoaded.empresa && renderDetailRow('Empresa', extraLoaded.empresa)}
                {!!extraLoaded.cargo && renderDetailRow('Cargo', extraLoaded.cargo)}
                {!!extraLoaded.faturamento && renderDetailRow('Faturamento', extraLoaded.faturamento)}
                {!!extraLoaded.endereco && renderDetailRow('Endereço', extraLoaded.endereco)}
              </>
            )}

            {!!extraLoaded?.adReferral && (
              <>
                {renderMiniSection('Origem do lead')}
                {renderAdReferralCard(extraLoaded.adReferral)}
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Contatos" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/contatos" />

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso aos contatos." />
      ) : (
        <>
          <View style={styles.tabsWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => tab.enabled && setActiveTab(tab.key)}
                  style={[styles.tabItem, tab.key === activeTab && styles.tabItemActive]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      tab.key === activeTab && styles.tabTextActive,
                      !tab.enabled && styles.tabTextDisabled,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {activeTab === 'listas' && user && <BroadcastListsTab user={user} />}
          {activeTab === 'leads' && user && <LeadsTab user={user} />}

          {activeTab === 'clientes' && (
          <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar contatos..."
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>
            <Pressable style={styles.iconButton} onPress={() => setSheetOpen(true)}>
              <Ionicons name="options-outline" size={18} color={colors.accent} />
              {activeFilters > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.iconButton} onPress={openCreate}>
              <Ionicons name="add" size={20} color={colors.accent} />
            </Pressable>
            <Pressable style={styles.actionsMenuButton} onPress={() => setActionsMenuVisible(true)}>
              <Text style={styles.actionsMenuButtonText}>Ações</Text>
              <Ionicons name="chevron-down" size={14} color={colors.textPrimary} />
            </Pressable>
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={loadFirstPage} />
          ) : (
            <FlatList
              data={clientes}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderCliente}
              contentContainerStyle={styles.listContent}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
              }
              ListHeaderComponent={
                <Text style={styles.countText}>{total} contato(s)</Text>
              }
              ListEmptyComponent={<EmptyState message="Nenhum contato encontrado." />}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoading}>
                    <ActivityIndicator color={colors.muted} />
                  </View>
                ) : !hasMore && clientes.length > 0 ? (
                  <Text style={styles.footerEnd}>Fim da lista • {clientes.length} contato(s)</Text>
                ) : null
              }
            />
          )}

          <ContactFilterSheet
            visible={sheetOpen}
            filters={filters}
            tags={tags}
            onClose={() => setSheetOpen(false)}
            onApply={setFilters}
          />

          <ContactsActionsMenu
            visible={actionsMenuVisible}
            onClose={() => setActionsMenuVisible(false)}
            exporting={exporting}
            importing={importing}
            onExport={() =>
              exportContacts({
                busca: debouncedSearch,
                filtro: filters.filtro,
                filtros_compostos: filters.compostos,
              })
            }
            onImport={() => importContacts(loadFirstPage)}
          />

          {user && (
            <ContactFormModal
              visible={formVisible}
              authUser={user}
              editing={editing}
              onClose={() => {
                setFormVisible(false);
                setEditing(null);
              }}
              onSaved={handleSaved}
            />
          )}

          {user && (
            <AddToListSheet
              visible={listSheetCliente !== null}
              authUser={user}
              cliente={listSheetCliente}
              onClose={() => setListSheetCliente(null)}
            />
          )}

          {user && (
            <SendTemplateSheet
              visible={templateSheetCliente !== null}
              authUser={user}
              cliente={templateSheetCliente}
              onClose={() => setTemplateSheetCliente(null)}
            />
          )}

          {user && (
            <DirectSaleModal
              visible={directSaleCliente !== null}
              authUser={user}
              cliente={directSaleCliente}
              onClose={() => setDirectSaleCliente(null)}
              onSaved={loadFirstPage}
            />
          )}
          </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 18,
  },
  tabItem: {
    paddingBottom: 10,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.accent,
  },
  tabTextDisabled: {
    opacity: 0.5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 14,
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionsMenuButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#141414',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 14,
  },
  countText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 2,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    ...cardSurface(colors, scheme),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  cardPhone: {
    fontSize: 12,
    color: colors.muted,
  },
  origemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySubtle,
  },
  origemText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.elevated,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.elevated,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  saleButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DBF73',
  },
  listButton: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    minWidth: 0,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(61,107,255,0.15)',
  },
  listButtonText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#7EA0FF',
  },
  templateButton: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    minWidth: 0,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#0E7A6B',
  },
  templateButtonText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  details: {
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  detailSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
    marginTop: 10,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  detailValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  adReferralLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  adReferralLoadingText: {
    fontSize: 12,
    color: colors.muted,
  },
  adReferralCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  adReferralHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adReferralThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  adReferralHeaderText: {
    flex: 1,
    gap: 2,
  },
  adReferralTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.muted,
  },
  adReferralHeadline: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  adReferralBody: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  adReferralMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  adReferralLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  adReferralLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  footerLoading: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  footerEnd: {
    paddingVertical: 18,
    textAlign: 'center',
    fontSize: 12,
    color: colors.muted,
  },
});
