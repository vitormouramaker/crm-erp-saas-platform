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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AnaliseIASheet } from '@/components/AnaliseIASheet';
import { AppDrawer } from '@/components/AppDrawer';
import { AtendimentoConfigModal } from '@/components/AtendimentoConfigModal';
import {
  AtendimentoFilterSheet,
  ConversaFilters,
  countActiveConversaFilters,
  EMPTY_CONVERSA_FILTERS,
} from '@/components/AtendimentoFilterSheet';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { usePushMessageReceivedListener } from '@/hooks/usePushNotifications';
import type { ThemeColors } from '@/constants/theme/tokens';
import {
  buscarConversas,
  Conversa,
  ConversaSearchItem,
  ConversaStatus,
  finalizarAtendimentoFila,
  finalizarFilaExpirados,
  getConversas,
} from '@/services/atendimentoApi';
import { canSeeChat } from '@/services/permissions';
import { getUsuarios, ManagedUser } from '@/services/usersApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import { formatConversaDate, formatMensagemPreview, getAtendenteColorSet, getInitials, isWaitingOver48h } from '@/utils/chatHelpers';

const TABS: { key: ConversaStatus; label: string }[] = [
  { key: 'active', label: 'Ativos' },
  { key: 'waiting', label: 'Aguardando' },
  { key: 'finished', label: 'Finalizados' },
];

// Mensagem de cliente em atendimento já finalizado cria conversa nova no back
// sem disparar push (back só notifica quando NÃO cria conversa) — por isso a
// lista precisa desse polling pra pegar esses casos, além do push normal.
const POLL_INTERVAL_MS = 15000;
const SEARCH_DEBOUNCE_MS = 250;

export default function ChatScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ConversaStatus>('active');
  const [configOpen, setConfigOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ConversaFilters>(EMPTY_CONVERSA_FILTERS);
  const [analiseConversa, setAnaliseConversa] = useState<Conversa | null>(null);
  const [finalizandoId, setFinalizandoId] = useState<number | null>(null);
  const [finalizandoLote, setFinalizandoLote] = useState(false);
  const [searchResults, setSearchResults] = useState<ConversaSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);

  const allowed = !!user && canSeeChat(user);
  const isMaster = !!user?.is_master;

  const loadConversas = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const lista = await getConversas(user);
      setConversas(lista);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os atendimentos.');
    }
  }, [user, allowed]);

  useEffect(() => {
    setLoading(true);
    loadConversas().finally(() => setLoading(false));
  }, [loadConversas]);

  useEffect(() => {
    if (!user || !allowed) return;
    getUsuarios(user)
      .then(setUsuarios)
      .catch(() => {});
  }, [user, allowed]);

  // Recarrega ao voltar da tela de conversa (status pode ter mudado) e
  // enquanto a aba fica focada, refaz a cada POLL_INTERVAL_MS
  useFocusEffect(
    useCallback(() => {
      loadConversas();
      const timer = setInterval(loadConversas, POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [loadConversas])
  );

  // Recarrega ao chegar mensagem nova em foreground (ex.: cliente responde
  // atendimento já finalizado) — sem isso só atualizava em foco/pull-to-refresh
  usePushMessageReceivedListener(loadConversas);

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversas();
    setRefreshing(false);
  }

  const atendenteOptions = useMemo(() => {
    const map = new Map<number, string>();
    usuarios.forEach((item) => map.set(item.id, item.name));
    // usuarios só traz quem tá ativo (u.ativo = true no back); atendente
    // desligado que finalizou/atendeu antes some da lista mesmo continuando
    // como nome_atendente nas conversas — inclui esses aqui pra não sumir
    // do filtro. `conversas` (lista principal) dedup 1 conversa por cliente;
    // `searchResults` não faz esse dedup, então cobre atendente que só
    // aparece em conversa antiga/duplicada que a busca acha.
    const addFrom = (item: Conversa) => {
      const id = item.usuario_atribuido_id ?? item.usuario_id;
      const nome = item.nome_usuario_atribuido || item.nome_atendente;
      if (id && nome && !map.has(id)) map.set(id, nome);
    };
    conversas.forEach(addFrom);
    searchResults.forEach(addFrom);
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [usuarios, conversas, searchResults]);

  const numeroOptions = useMemo(() => {
    const map = new Map<string, string>();
    conversas.forEach((item) => {
      if (item.meta_numero_conta) map.set(item.meta_numero_conta, item.meta_nome_conta || item.meta_numero_conta);
    });
    return Array.from(map.entries())
      .map(([numero, nome]) => ({ numero, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [conversas]);

  const activeFilters = countActiveConversaFilters(filters);
  const isSearching = search.trim().length > 0;

  const filtered = useMemo(() => {
    return conversas.filter((item) => {
      if (filters.atendenteId === 'sem_atendente') {
        if (item.usuario_atribuido_id !== null) return false;
      } else if (filters.atendenteId !== null && item.usuario_atribuido_id !== filters.atendenteId) {
        return false;
      }
      if (filters.numeroConta !== null && item.meta_numero_conta !== filters.numeroConta) return false;
      if (filters.somenteNaoLidas && item.unread_count <= 0) return false;
      return true;
    });
  }, [conversas, filters]);

  // Busca por texto vai pro back (/buscar_conversas_usuario) em vez de filtrar
  // só o que já carregou: pega match dentro do conteúdo das mensagens também,
  // não só nome/telefone/última mensagem.
  const runSearch = useCallback(
    async (term: string, offset: number, append: boolean) => {
      if (!user) return;
      setSearchLoading(true);
      setSearchError('');
      try {
        const attendantFilter =
          filters.atendenteId === 'sem_atendente'
            ? 'unassigned'
            : filters.atendenteId !== null
              ? String(filters.atendenteId)
              : '';
        const result = await buscarConversas(user, {
          pesquisa: term,
          status: activeTab,
          selectedAttendantFilter: attendantFilter,
          selectedMetaNumberFilter: filters.numeroConta || '',
          showUnreadOnly: filters.somenteNaoLidas,
          offset,
        });
        setSearchResults((prev) => (append ? [...prev, ...result.items] : result.items));
        setSearchHasMore(result.hasMore);
        setSearchOffset(result.nextOffset);
      } catch (err: any) {
        setSearchError(err?.message || 'Não foi possível buscar.');
      } finally {
        setSearchLoading(false);
      }
    },
    [user, activeTab, filters]
  );

  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchOffset(0);
      setSearchError('');
      return;
    }
    const timer = setTimeout(() => runSearch(term, 0, false), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, runSearch]);

  function handleSearchLoadMore() {
    const term = search.trim();
    if (!term || searchLoading || !searchHasMore) return;
    runSearch(term, searchOffset, true);
  }

  const byStatus = useMemo(() => {
    const groups: Record<ConversaStatus, Conversa[]> = {
      active: [],
      waiting: [],
      finished: [],
    };
    filtered.forEach((item) => {
      if (groups[item.status]) groups[item.status].push(item);
    });
    return groups;
  }, [filtered]);

  const listData: (Conversa | ConversaSearchItem)[] = isSearching ? searchResults : byStatus[activeTab];

  const waitingCount = useMemo(
    () => conversas.filter((item) => item.status === 'waiting').length,
    [conversas]
  );
  const activeUnreadCount = useMemo(
    () => conversas.filter((item) => item.status === 'active' && item.unread_count > 0).length,
    [conversas]
  );
  const expired48hCount = useMemo(
    () => conversas.filter((item) => item.status === 'waiting' && isWaitingOver48h(item)).length,
    [conversas]
  );

  function confirmFinalizarFila(conversa: Conversa) {
    if (!user) return;
    Alert.alert(
      'Finalizar fila',
      `Finalizar o atendimento aguardando de ${conversa.nome || conversa.telefone || 'este contato'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setFinalizandoId(conversa.id);
            try {
              await finalizarAtendimentoFila(user, conversa.id);
              await loadConversas();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível finalizar o atendimento.');
            } finally {
              setFinalizandoId(null);
            }
          },
        },
      ]
    );
  }

  function confirmFinalizarLote() {
    if (!user) return;
    Alert.alert(
      'Finalizar fila +48h',
      'Finalizar todos os atendimentos aguardando há mais de 48 horas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setFinalizandoLote(true);
            try {
              const resultado = await finalizarFilaExpirados(user);
              await loadConversas();
              Alert.alert(
                'Fila finalizada',
                `${resultado?.total_finalizados || 0} atendimento(s) finalizado(s).`
              );
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível finalizar a fila.');
            } finally {
              setFinalizandoLote(false);
            }
          },
        },
      ]
    );
  }

  function handleCardPress(conversa: Conversa) {
    // Abrir uma conversa da fila normalmente assume o atendimento (deixa de
    // ser "waiting"); ao voltar, cai direto em Ativos em vez de Aguardando,
    // onde ela não vai mais aparecer.
    if (conversa.status === 'waiting') {
      setActiveTab('active');
    }
    router.push({
      pathname: '/conversa/[id]',
      params: {
        id: String(conversa.id),
        nome: conversa.nome || '',
        telefone: conversa.telefone || '',
      },
    });
  }

  function renderConversa({ item, index }: { item: Conversa | ConversaSearchItem; index: number }) {
    const atendenteNome = item.nome_atendente || item.nome_usuario_atribuido;
    const atendenteCores = getAtendenteColorSet(item.usuario_id ?? item.usuario_atribuido_id);
    const isLast = index === listData.length - 1;
    const previewText =
      (isSearching && (item as ConversaSearchItem).search_match_preview) ||
      formatMensagemPreview(item.ultima_mensagem);

    return (
      <Pressable
        style={[styles.row, isLast && styles.rowLast]}
        onPress={() => handleCardPress(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.nome)}</Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.nome || item.telefone || 'Sem nome'}
          </Text>
          <Text style={styles.cardMessage} numberOfLines={1}>
            {previewText || 'Sem mensagens'}
          </Text>

          {item.status === 'waiting' ? (
            <Text style={styles.cardAtendenteMuted}>Sem atendente</Text>
          ) : item.status === 'finished' ? (
            <>
              {atendenteNome && (
                <View
                  style={[
                    styles.atendentePill,
                    { backgroundColor: atendenteCores.bg, borderColor: atendenteCores.border },
                  ]}
                >
                  <View style={[styles.atendenteDot, { backgroundColor: atendenteCores.dot }]} />
                  <Text style={[styles.atendentePillText, { color: atendenteCores.text }]} numberOfLines={1}>
                    Atendente: {atendenteNome}
                  </Text>
                </View>
              )}
              {atendenteNome && (
                <View style={styles.finalizadoRow}>
                  <Ionicons name="checkmark-circle-outline" size={12} color="#4ADE80" />
                  <Text style={styles.finalizadoText} numberOfLines={1}>
                    Finalizado por: {atendenteNome}
                  </Text>
                </View>
              )}
            </>
          ) : (
            atendenteNome && (
              <View
                style={[
                  styles.atendentePill,
                  { backgroundColor: atendenteCores.bg, borderColor: atendenteCores.border },
                ]}
              >
                <View style={[styles.atendenteDot, { backgroundColor: atendenteCores.dot }]} />
                <Text style={[styles.atendentePillText, { color: atendenteCores.text }]} numberOfLines={1}>
                  Atendente: {atendenteNome}
                </Text>
              </View>
            )
          )}

          {item.status === 'waiting' && isMaster && (
            <Pressable
              style={styles.finalizarFilaButton}
              onPress={() => confirmFinalizarFila(item)}
              disabled={finalizandoId === item.id}
            >
              {finalizandoId === item.id ? (
                <ActivityIndicator size="small" color="#FF6B6B" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={13} color="#FF6B6B" />
                  <Text style={styles.finalizarFilaText}>Finalizar fila</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.cardDate}>
            {formatConversaDate(item.data_fim || item.ultima_atualizacao)}
          </Text>
          {item.status === 'finished' && (
            <Pressable style={styles.iaBadge} onPress={() => setAnaliseConversa(item)} hitSlop={6}>
              <Ionicons name="sparkles-outline" size={11} color="#7EA0FF" />
              <Text style={styles.iaBadgeText}>IA</Text>
            </Pressable>
          )}
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Atendimentos" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/chat" />

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso ao atendimento." />
      ) : (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Pesquisar..."
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isSearching && searchLoading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                search.length > 0 && (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.muted} />
                  </Pressable>
                )
              )}
            </View>
            <Pressable style={styles.iconButton} onPress={() => setFilterOpen(true)}>
              <Ionicons name="options-outline" size={18} color={colors.accent} />
              {activeFilters > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilters}</Text>
                </View>
              )}
            </Pressable>
            {isMaster && (
              <Pressable style={styles.iconButton} onPress={() => setConfigOpen(true)}>
                <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
              </Pressable>
            )}
          </View>

          <View style={styles.tabsWrap}>
            <View style={styles.tabsRow}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabItem, tab.key === activeTab && styles.tabItemActive]}
                >
                  <View style={styles.tabLabelRow}>
                    <Text style={[styles.tabText, tab.key === activeTab && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                    {tab.key === 'waiting' && waitingCount > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{waitingCount}</Text>
                      </View>
                    )}
                    {tab.key === 'active' && activeUnreadCount > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{activeUnreadCount}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {activeTab === 'waiting' && isMaster && (
            <Pressable
              style={styles.loteButton}
              onPress={confirmFinalizarLote}
              disabled={finalizandoLote}
            >
              {finalizandoLote ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={14} color={colors.muted} />
                  <Text style={styles.loteButtonText}>
                    Finalizar fila +48h ({expired48hCount})
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={handleRefresh} />
          ) : isSearching && searchError ? (
            <ErrorState message={searchError} onRetry={() => runSearch(search.trim(), 0, false)} />
          ) : isSearching && searchLoading && searchResults.length === 0 ? (
            <LoadingState />
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderConversa}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
              }
              onEndReachedThreshold={0.4}
              onEndReached={isSearching ? handleSearchLoadMore : undefined}
              ListFooterComponent={
                isSearching && searchLoading && searchResults.length > 0 ? (
                  <ActivityIndicator size="small" color={colors.muted} style={styles.searchFooterLoading} />
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  message={
                    isSearching
                      ? 'Nenhum resultado para essa busca.'
                      : activeTab === 'active'
                        ? 'Nenhum atendimento ativo.'
                        : activeTab === 'waiting'
                          ? 'Nenhum atendimento aguardando.'
                          : 'Nenhum atendimento finalizado.'
                  }
                />
              }
            />
          )}

          {user && (
            <AtendimentoConfigModal
              visible={configOpen}
              authUser={user}
              onClose={() => setConfigOpen(false)}
              onSaved={(message) => {
                setConfigOpen(false);
                Alert.alert('Configurações', message);
              }}
            />
          )}

          {user && (
            <AnaliseIASheet
              visible={analiseConversa !== null}
              authUser={user}
              conversa={analiseConversa}
              onClose={() => setAnaliseConversa(null)}
            />
          )}

          <AtendimentoFilterSheet
            visible={filterOpen}
            filters={filters}
            atendentes={atendenteOptions}
            numeros={numeroOptions}
            onClose={() => setFilterOpen(false)}
            onApply={setFilters}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
      paddingBottom: 20,
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
      position: 'relative',
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
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
    tabsWrap: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabsRow: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      gap: 22,
    },
    tabItem: {
      paddingTop: 4,
      paddingBottom: 14,
    },
    tabItemActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
    },
    tabLabelRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    tabTextActive: {
      color: colors.accent,
    },
    tabBadge: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#E5484D',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      marginTop: -6,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    loteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 24,
      marginTop: 12,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    loteButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    listContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 14,
    },
    searchFooterLoading: {
      paddingVertical: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
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
      gap: 3,
    },
    cardName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardMessage: {
      fontSize: 13,
      color: colors.muted,
    },
    cardAtendenteMuted: {
      fontSize: 11,
      color: colors.muted,
    },
    atendentePill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      marginTop: 2,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      maxWidth: '100%',
    },
    atendentePillText: {
      fontSize: 11,
      fontWeight: '600',
      flexShrink: 1,
    },
    atendenteDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    finalizadoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    finalizadoText: {
      fontSize: 11,
      color: '#4ADE80',
    },
    finalizarFilaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      marginTop: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,107,107,0.5)',
      backgroundColor: 'rgba(255,107,107,0.08)',
    },
    finalizarFilaText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FF6B6B',
    },
    cardRight: {
      alignItems: 'flex-end',
      gap: 6,
    },
    cardDate: {
      fontSize: 11,
      color: colors.muted,
    },
    iaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(61,107,255,0.15)',
    },
    iaBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#7EA0FF',
    },
    unreadBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#22C55E',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    unreadText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#052E16',
    },
  });
