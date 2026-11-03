import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DispatchTemplateSheet } from '@/components/DispatchTemplateSheet';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  ClienteTag,
  criarListaTransmissao,
  deletarListaTransmissao,
  editarListaTransmissao,
  getContatosLista,
  getListasTransmissao,
  getTags,
  ListaContato,
  ListaTransmissao,
  ListaTransmissaoUtmFilters,
  removerContatoLista,
  sincronizarLista,
} from '@/services/clientesApi';
import { AllowedMetaNumber, getMetaNumeros } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface BroadcastListsTabProps {
  user: User;
}

const UTM_FIELDS: { key: keyof ListaTransmissaoUtmFilters; label: string; placeholder: string }[] = [
  { key: 'utm_source', label: 'UTM Source', placeholder: 'Filtrar por utm source' },
  { key: 'utm_medium', label: 'UTM Medium', placeholder: 'Filtrar por utm medium' },
  { key: 'utm_campaign', label: 'UTM Campaign', placeholder: 'Filtrar por utm campaign' },
  { key: 'utm_term', label: 'UTM Term', placeholder: 'Filtrar por utm term' },
  { key: 'utm_content', label: 'UTM Content', placeholder: 'Filtrar por utm content' },
  { key: 'utm_id', label: 'UTM ID', placeholder: 'Filtrar por utm id' },
];

const EMPTY_UTM_FILTERS: ListaTransmissaoUtmFilters = {
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
  utm_id: '',
};

function formatContatoDesde(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function BroadcastListsTab({ user }: BroadcastListsTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [listas, setListas] = useState<ListaTransmissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [contatos, setContatos] = useState<ListaContato[]>([]);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [verMaisContatoId, setVerMaisContatoId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [dispatchLista, setDispatchLista] = useState<ListaTransmissao | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<ListaTransmissao | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [numeros, setNumeros] = useState<AllowedMetaNumber[]>([]);
  const [tags, setTags] = useState<ClienteTag[]>([]);
  const [tagLogic, setTagLogic] = useState<'or' | 'and'>('or');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [utmFilters, setUtmFilters] = useState<ListaTransmissaoUtmFilters>(EMPTY_UTM_FILTERS);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getListasTransmissao(user);
      setListas(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as listas.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    getMetaNumeros(user).then(setNumeros).catch(() => setNumeros([]));
  }, [user]);

  useEffect(() => {
    getTags(user).then(setTags).catch(() => setTags([]));
  }, [user]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function loadContatos(listaId: number) {
    setContatos([]);
    setLoadingContatos(true);
    try {
      const data = await getContatosLista(user, listaId);
      setContatos(data);
    } catch {
      setContatos([]);
    } finally {
      setLoadingContatos(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setNome('');
    setDescricao('');
    setMetaParamId(numeros.length === 1 ? numeros[0].id : null);
    setTagLogic('or');
    setTagIds([]);
    setUtmFilters(EMPTY_UTM_FILTERS);
    setContatos([]);
    setVerMaisContatoId(null);
    setFormVisible(true);
  }

  function openEdit(lista: ListaTransmissao) {
    setEditing(lista);
    setNome(lista.nome ?? '');
    setDescricao(lista.descricao ?? '');
    setMetaParamId(lista.empresa_meta_param_id);
    setTagLogic(lista.tag_logic === 'and' ? 'and' : 'or');
    setTagIds((lista.tags || []).map((tag) => tag.id));
    setUtmFilters({ ...EMPTY_UTM_FILTERS, ...(lista.utm_filters || {}) });
    setVerMaisContatoId(null);
    setFormVisible(true);
    loadContatos(lista.id);
  }

  function toggleTag(tagId: number) {
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  }

  async function handleSubmit() {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome da lista.');
    if (!editing && !metaParamId) return Alert.alert('Atenção', 'Selecione o número WhatsApp da lista.');

    setSubmitting(true);
    try {
      if (editing) {
        await editarListaTransmissao(user, {
          lista_id: editing.id,
          meta_param_id: metaParamId,
          nome: nome.trim(),
          descricao: descricao.trim(),
          tag_logic: tagLogic,
          tag_ids: tagIds,
          utm_filters: utmFilters,
        });
      } else {
        await criarListaTransmissao(user, {
          meta_param_id: metaParamId!,
          nome: nome.trim(),
          descricao: descricao.trim(),
        });
      }
      setFormVisible(false);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a lista.');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(lista: ListaTransmissao) {
    Alert.alert(
      'Remover lista',
      `Tem certeza que deseja remover a lista ${lista.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletarListaTransmissao(user, lista.id);
              if (editing?.id === lista.id) setFormVisible(false);
              await load();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível remover a lista.');
            }
          },
        },
      ]
    );
  }

  async function handleSync(lista: ListaTransmissao) {
    setSyncingId(lista.id);
    try {
      await sincronizarLista(user, lista.id);
      await load();
      if (editing?.id === lista.id) {
        await loadContatos(lista.id);
      }
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível sincronizar a lista.');
    } finally {
      setSyncingId(null);
    }
  }

  async function handleRemoveContato(lista: ListaTransmissao, contato: ListaContato) {
    try {
      await removerContatoLista(user, lista.id, contato.cliente_id);
      setContatos((prev) => prev.filter((item) => item.cliente_id !== contato.cliente_id));
      setListas((prev) =>
        prev.map((item) =>
          item.id === lista.id ? { ...item, total_contatos: Math.max(item.total_contatos - 1, 0) } : item
        )
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível remover o contato da lista.');
    }
  }

  function renderLista({ item }: { item: ListaTransmissao }) {
    return (
      <View style={styles.card}>
        <Pressable onPress={() => openEdit(item)}>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.nome}
              </Text>
              {!!item.descricao && (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.descricao}
                </Text>
              )}
            </View>
            <View style={styles.countBadge}>
              <Ionicons name="people-outline" size={11} color={colors.accent} />
              <Text style={styles.countText}>{item.total_contatos}</Text>
            </View>
          </View>

          {!!item.meta_display_phone_number && (
            <View style={styles.phoneRow}>
              <Ionicons name="logo-whatsapp" size={12} color={colors.muted} />
              <Text style={styles.phoneText}>
                {item.meta_display_phone_number}
                {item.meta_verified_name ? ` • ${item.meta_verified_name}` : ''}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={() => confirmDelete(item)} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleSync(item)}
            hitSlop={6}
            disabled={syncingId === item.id}
          >
            {syncingId === item.id ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Ionicons name="sync-outline" size={16} color={colors.textPrimary} />
            )}
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => setDispatchLista(item)}
            hitSlop={6}
            disabled={!item.empresa_meta_param_id}
          >
            <Ionicons name="paper-plane-outline" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Erro</Text>
        <Text style={styles.subtitle}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={listas}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderLista}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.headerTitle}>Listas</Text>
                <Text style={styles.headerCount}>
                  {listas.length} cadastrada{listas.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable style={styles.newButton} onPress={openCreate}>
                <Ionicons name="add" size={16} color="#141414" />
                <Text style={styles.newButtonText}>Nova Lista</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.subtitle}>Nenhuma lista de transmissão criada.</Text>
          </View>
        }
      />

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormVisible(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{editing ? 'Editar Lista' : 'Nova Lista de Transmissão'}</Text>
                <Pressable onPress={() => setFormVisible(false)} hitSlop={12} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.form}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.field}>
                  <Text style={styles.label}>Nome</Text>
                  <TextInput
                    style={styles.input}
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Nome da lista"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Descrição</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={descricao}
                    onChangeText={setDescricao}
                    placeholder="Descrição (opcional)"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                </View>

                {numeros.length > 0 && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Número WhatsApp</Text>
                    {numeros.map((numero) => {
                      const active = numero.id === metaParamId;
                      return (
                        <Pressable
                          key={numero.id}
                          onPress={() => setMetaParamId(numero.id)}
                          style={[styles.numeroCard, active && styles.numeroCardActive]}
                        >
                          <View style={[styles.radio, active && styles.radioActive]}>
                            {active && <View style={styles.radioDot} />}
                          </View>
                          <View style={styles.numeroInfo}>
                            <Text style={styles.numeroPhone}>
                              {numero.display_phone_number || `#${numero.id}`}
                            </Text>
                            {(numero.verified_name || numero.whatsapp_account_name) && (
                              <Text style={styles.numeroName}>
                                {numero.verified_name || numero.whatsapp_account_name}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {editing && (
                <View style={styles.field}>
                  <Text style={styles.label}>Regras por tags</Text>
                  <Text style={styles.hint}>
                    Adicione uma ou várias tags e escolha se o contato precisa ter todas ou apenas uma delas.
                  </Text>
                  <View style={styles.logicToggle}>
                    <Pressable
                      style={[styles.logicOption, tagLogic === 'or' && styles.logicOptionActiveOr]}
                      onPress={() => setTagLogic('or')}
                    >
                      <Text style={[styles.logicOptionText, tagLogic === 'or' && styles.logicOptionTextActive]}>
                        OU
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.logicOption, tagLogic === 'and' && styles.logicOptionActiveAnd]}
                      onPress={() => setTagLogic('and')}
                    >
                      <Text style={[styles.logicOptionText, tagLogic === 'and' && styles.logicOptionTextActive]}>
                        E
                      </Text>
                    </Pressable>
                  </View>
                  {tags.length > 0 ? (
                    <View style={styles.chipsWrap}>
                      {tags.map((tag) => {
                        const active = tagIds.includes(tag.id);
                        return (
                          <Pressable
                            key={tag.id}
                            onPress={() => toggleTag(tag.id)}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            {active && <Ionicons name="checkmark" size={13} color="#141414" />}
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.hint}>Nenhuma tag cadastrada ainda.</Text>
                  )}
                </View>
                )}

                {editing && (
                <View style={styles.field}>
                  <Text style={styles.label}>Regras por UTM</Text>
                  <Text style={styles.hint}>
                    Os filtros de UTM são combinados entre si. Preencha apenas os que quiser considerar.
                  </Text>
                  {UTM_FIELDS.map((field) => (
                    <View key={field.key} style={styles.utmField}>
                      <Text style={styles.utmLabel}>{field.label}</Text>
                      <TextInput
                        style={styles.input}
                        value={utmFilters[field.key] || ''}
                        onChangeText={(text) => setUtmFilters((prev) => ({ ...prev, [field.key]: text }))}
                        placeholder={field.placeholder}
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                      />
                    </View>
                  ))}
                  <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={15} color={colors.accent} />
                    <Text style={styles.infoText}>
                      A sincronização automática usa as regras de tags e UTMs.
                    </Text>
                  </View>
                </View>
                )}

                {editing && (
                  <Pressable style={styles.removeButton} onPress={() => confirmDelete(editing)}>
                    <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                    <Text style={styles.removeButtonText}>Remover lista</Text>
                  </Pressable>
                )}

                {editing && (
                  <View style={styles.field}>
                    <View style={styles.contactsHeader}>
                      <Text style={styles.label}>Contatos da lista</Text>
                      <Text style={styles.hint}>{editing.total_contatos} contato(s) no momento.</Text>
                    </View>
                    {loadingContatos ? (
                      <ActivityIndicator color={colors.muted} style={styles.contactsLoading} />
                    ) : contatos.length === 0 ? (
                      <Text style={styles.emptyContacts}>Nenhum contato nesta lista.</Text>
                    ) : (
                      <View style={styles.contactsBox}>
                        {contatos.map((contato) => {
                          const verMais = verMaisContatoId === contato.id;
                          return (
                            <View key={contato.id} style={styles.contactCard}>
                              <View style={styles.contactRow}>
                                <View style={styles.contactInfo}>
                                  <Text style={styles.contactName} numberOfLines={1}>
                                    {contato.nome}
                                  </Text>
                                  {!!contato.added_at && (
                                    <Text style={styles.contactPhone}>
                                      Desde {formatContatoDesde(contato.added_at)}
                                    </Text>
                                  )}
                                </View>
                                <Pressable onPress={() => handleRemoveContato(editing, contato)} hitSlop={8}>
                                  <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                </Pressable>
                              </View>
                              <View style={styles.contactBadgeRow}>
                                <View style={styles.contactBadge}>
                                  <Text style={styles.contactBadgeText}>
                                    {contato.origem === 'manual' ? 'Manual' : 'Segmento'}
                                  </Text>
                                </View>
                                <Pressable
                                  style={styles.verMaisButton}
                                  onPress={() => setVerMaisContatoId(verMais ? null : contato.id)}
                                >
                                  <Text style={styles.verMaisText}>{verMais ? 'Ver menos' : 'Ver mais'}</Text>
                                  <Ionicons
                                    name={verMais ? 'chevron-up' : 'chevron-down'}
                                    size={13}
                                    color={colors.muted}
                                  />
                                </Pressable>
                              </View>
                              {verMais && (
                                <View style={styles.contactDetails}>
                                  <Text style={styles.contactDetailText}>
                                    Telefone: {contato.telefone || '-'}
                                  </Text>
                                  <Text style={styles.contactDetailText}>
                                    E-mail: {contato.email || '-'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.footer}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setFormVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, submitting && styles.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>{editing ? 'Salvar' : 'Criar Lista'}</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <DispatchTemplateSheet
        visible={!!dispatchLista}
        user={user}
        lista={dispatchLista}
        onClose={() => setDispatchLista(null)}
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
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  header: {
    gap: 16,
    marginBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerCount: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  newButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    ...cardSurface(colors, scheme),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardDescription: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primarySubtle,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 12,
    color: colors.muted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  contactsBox: {
    backgroundColor: colors.elevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contactsLoading: {
    paddingVertical: 14,
  },
  emptyContacts: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 14,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactPhone: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '92%',
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
  form: {
    gap: 18,
    paddingBottom: 12,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
  },
  logicToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  logicOption: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logicOptionActiveOr: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  logicOptionActiveAnd: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  logicOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  logicOptionTextActive: {
    color: '#141414',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#141414',
    fontWeight: '700',
  },
  utmField: {
    gap: 6,
  },
  utmLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.primarySubtle,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.accent,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  contactsHeader: {
    gap: 2,
  },
  contactCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    gap: 8,
  },
  contactBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySubtle,
  },
  contactBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  verMaisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verMaisText: {
    fontSize: 12,
    color: colors.muted,
  },
  contactDetails: {
    gap: 4,
    paddingTop: 4,
  },
  contactDetailText: {
    fontSize: 12,
    color: colors.muted,
  },
  numeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  numeroCardActive: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  numeroInfo: {
    flex: 1,
  },
  numeroPhone: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  numeroName: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitButton: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
});
