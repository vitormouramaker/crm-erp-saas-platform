import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import {
  AtendimentoConfig,
  getAtendimentoConfig,
  salvarAtendimentoConfig,
} from '@/services/atendimentoApi';
import { getUsuarios, ManagedUser } from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface AtendimentoConfigModalProps {
  visible: boolean;
  authUser: User;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function AtendimentoConfigModal({
  visible,
  authUser,
  onClose,
  onSaved,
}: AtendimentoConfigModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [filaAtiva, setFilaAtiva] = useState(false);
  const [filaUsuarios, setFilaUsuarios] = useState<number[]>([]);
  const [atribuicaoManual, setAtribuicaoManual] = useState(false);
  const [mensagensRapidas, setMensagensRapidas] = useState(true);
  const [disparoNps, setDisparoNps] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setDropdownOpen(false);
    setSelecionadoId(null);
    Promise.all([getAtendimentoConfig(authUser), getUsuarios(authUser)])
      .then(([config, users]) => {
        setFilaAtiva(config.atendimento_fila_automatica_ativa);
        setFilaUsuarios(config.atendimento_fila_usuarios);
        setAtribuicaoManual(config.atendimento_lista_atribuida_adm);
        setMensagensRapidas(config.atendimento_mensagens_rapidas_ativas);
        setDisparoNps(config.atendimento_disparo_nps_ativo);
        setUsuarios(users);
      })
      .catch((err: any) => {
        Alert.alert('Erro', err?.message || 'Não foi possível carregar as configurações.');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [visible, authUser]);

  const disponiveis = useMemo(
    () => usuarios.filter((item) => !filaUsuarios.includes(item.id)),
    [usuarios, filaUsuarios]
  );

  const selecionado = usuarios.find((item) => item.id === selecionadoId) || null;

  function nomeUsuario(id: number): string {
    return usuarios.find((item) => item.id === id)?.name || `Usuário ${id}`;
  }

  function adicionarAtendente() {
    if (!selecionadoId) return;
    setFilaUsuarios((prev) => (prev.includes(selecionadoId) ? prev : [...prev, selecionadoId]));
    setSelecionadoId(null);
    setDropdownOpen(false);
  }

  function removerAtendente(id: number) {
    setFilaUsuarios((prev) => prev.filter((item) => item !== id));
  }

  function toggleFila(value: boolean) {
    setFilaAtiva(value);
    if (value) setAtribuicaoManual(false);
  }

  function toggleAtribuicaoManual(value: boolean) {
    setAtribuicaoManual(value);
    if (value) setFilaAtiva(false);
  }

  async function handleSalvar() {
    if (filaAtiva && filaUsuarios.length === 0) {
      Alert.alert('Atenção', 'Selecione ao menos um atendente para ativar a fila automática.');
      return;
    }
    setSaving(true);
    try {
      const config: AtendimentoConfig = {
        atendimento_fila_automatica_ativa: filaAtiva,
        atendimento_fila_usuarios: filaUsuarios,
        atendimento_lista_atribuida_adm: atribuicaoManual,
        atendimento_mensagens_rapidas_ativas: mensagensRapidas,
        atendimento_disparo_nps_ativo: disparoNps,
      };
      const message = await salvarAtendimentoConfig(authUser, config);
      onSaved(message || 'Configurações salvas com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Configurações de atendimento</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.muted} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionInfo}>
                    <Text style={styles.sectionTitle}>Fila automática</Text>
                    <Text style={styles.sectionSubtitle}>
                      Distribui os novos atendimentos automaticamente entre os atendentes da fila.
                    </Text>
                  </View>
                  <Switch
                    value={filaAtiva}
                    onValueChange={toggleFila}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.textPrimary}
                  />
                </View>

                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>
                    {filaUsuarios.length} atendente{filaUsuarios.length === 1 ? '' : 's'}
                  </Text>
                </View>

                <Pressable
                  style={styles.selectBox}
                  onPress={() => setDropdownOpen((prev) => !prev)}
                >
                  <Text style={selecionado ? styles.selectText : styles.selectPlaceholder}>
                    {selecionado ? selecionado.name : 'Selecione um atendente'}
                  </Text>
                  <Ionicons
                    name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>

                {dropdownOpen && (
                  <View style={styles.dropdown}>
                    {disponiveis.length === 0 ? (
                      <Text style={styles.dropdownEmpty}>Nenhum atendente disponível.</Text>
                    ) : (
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                        {disponiveis.map((item) => (
                          <Pressable
                            key={item.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setSelecionadoId(item.id);
                              setDropdownOpen(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{item.name}</Text>
                            {item.is_master && <Text style={styles.dropdownItemTag}>Admin</Text>}
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                <Pressable
                  style={[styles.addButton, !selecionadoId && styles.addButtonDisabled]}
                  onPress={adicionarAtendente}
                  disabled={!selecionadoId}
                >
                  <Text style={styles.addButtonText}>Adicionar</Text>
                </Pressable>

                {filaUsuarios.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Nenhum atendente foi adicionado à fila ainda.</Text>
                  </View>
                ) : (
                  <View style={styles.queueList}>
                    {filaUsuarios.map((id) => (
                      <View key={id} style={styles.queueItem}>
                        <Text style={styles.queueItemText} numberOfLines={1}>
                          {nomeUsuario(id)}
                        </Text>
                        <Pressable onPress={() => removerAtendente(id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionInfo}>
                    <Text style={styles.sectionTitle}>Atribuição manual</Text>
                    <Text style={styles.sectionSubtitle}>
                      Somente o administrador atribui os atendimentos aguardando aos atendentes.
                    </Text>
                  </View>
                  <Switch
                    value={atribuicaoManual}
                    onValueChange={toggleAtribuicaoManual}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.textPrimary}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionInfo}>
                    <Text style={styles.sectionTitle}>Ativar mensagens rápidas</Text>
                    <Text style={styles.sectionSubtitle}>
                      Permite que os atendentes usem atalhos com comando '/' durante o atendimento.
                    </Text>
                  </View>
                  <Switch
                    value={mensagensRapidas}
                    onValueChange={setMensagensRapidas}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.textPrimary}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionInfo}>
                    <Text style={styles.sectionTitle}>Disparo de NPS</Text>
                    <Text style={styles.sectionSubtitle}>
                      Define se o link de avaliação NPS será enviado automaticamente após a
                      finalização do atendimento.
                    </Text>
                  </View>
                  <Switch
                    value={disparoNps}
                    onValueChange={setDisparoNps}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.textPrimary}
                  />
                </View>
              </View>

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={saving}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSalvar}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#141414" size="small" />
                  ) : (
                    <Text style={styles.saveText}>Salvar configurações</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
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
    },
    body: {
      gap: 14,
      paddingBottom: 8,
    },
    section: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sectionInfo: {
      flex: 1,
      gap: 4,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
    countChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primarySubtle,
    },
    countChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
    },
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    selectPlaceholder: {
      fontSize: 14,
      color: colors.muted,
    },
    dropdown: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    dropdownScroll: {
      maxHeight: 180,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.elevated,
    },
    dropdownItemText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    dropdownItemTag: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
    },
    dropdownEmpty: {
      fontSize: 12,
      color: colors.muted,
      padding: 12,
    },
    addButton: {
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: {
      opacity: 0.5,
    },
    addButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    emptyBox: {
      borderRadius: 12,
      backgroundColor: colors.hoverSurface,
      padding: 14,
    },
    emptyText: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
    },
    queueList: {
      gap: 8,
    },
    queueItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.hoverSurface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    queueItemText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    footer: {
      gap: 10,
      marginTop: 4,
    },
    cancelButton: {
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    saveButton: {
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
  });
