import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import {
  Cliente,
  getClientes,
  getContatosLista,
  getListasTransmissao,
  ListaTransmissao,
} from '@/services/clientesApi';
import { useBatchDispatch } from '@/hooks/useBatchDispatch';
import { useHeaderMediaPicker } from '@/hooks/useHeaderMediaPicker';
import { dispararTemplate, getTemplateHeaderFormat, MetaTemplate } from '@/services/metaApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface TemplateDetailSheetProps {
  visible: boolean;
  user: User;
  template: MetaTemplate | null;
  metaParamId: number | null;
  onClose: () => void;
}

type Step = 'preview' | 'disparo';
type DispatchMode = 'individual' | 'lote';

const STATUS_LABEL: Record<string, string> = {
  processing: 'Enviando...',
  completed: 'Concluído',
  stopped_on_error: 'Interrompido por erro',
  failed: 'Falhou',
};

export function TemplateDetailSheet({
  visible,
  user,
  template,
  metaParamId,
  onClose,
}: TemplateDetailSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('preview');
  const [mode, setMode] = useState<Exclude<DispatchMode, null>>('individual');

  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [sendingIndividual, setSendingIndividual] = useState(false);

  const [listas, setListas] = useState<ListaTransmissao[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [selectedLista, setSelectedLista] = useState<ListaTransmissao | null>(null);

  const { asset: headerAsset, pick: pickHeaderMedia, reset: resetHeaderAsset } = useHeaderMediaPicker();
  const { starting, progress, start, reset: resetBatch } = useBatchDispatch(user);

  const headerFormat = useMemo(
    () => (template ? getTemplateHeaderFormat(template) : null),
    [template]
  );

  useEffect(() => {
    if (!visible) return;
    setStep('preview');
    setMode('individual');
    setClienteSearch('');
    setClienteResults([]);
    setSelectedCliente(null);
    setListas([]);
    setSelectedLista(null);
    resetHeaderAsset();
    resetBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, template]);

  useEffect(() => {
    if (mode !== 'individual') return;
    const query = clienteSearch.trim();
    const timer = setTimeout(() => {
      setLoadingClientes(true);
      getClientes(user, { pagina: 1, limite: 15, busca: query })
        .then((page) => setClienteResults(page.items))
        .catch(() => setClienteResults([]))
        .finally(() => setLoadingClientes(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [mode, clienteSearch, user]);

  useEffect(() => {
    if (mode !== 'lote' || !metaParamId) return;
    setLoadingListas(true);
    getListasTransmissao(user, metaParamId)
      .then(setListas)
      .catch(() => setListas([]))
      .finally(() => setLoadingListas(false));
  }, [mode, metaParamId, user]);

  function handleClose() {
    resetBatch();
    onClose();
  }

  function handleNext() {
    if (headerFormat && !headerAsset) {
      Alert.alert('Atenção', 'Este template exige um arquivo de mídia no cabeçalho. Anexe antes de continuar.');
      return;
    }
    setStep('disparo');
  }

  async function handleSendIndividual() {
    if (!template || !metaParamId || !selectedCliente) return;
    if (!selectedCliente.phone) {
      Alert.alert('Atenção', 'Este contato não possui telefone cadastrado.');
      return;
    }

    setSendingIndividual(true);
    try {
      const message = await dispararTemplate(
        user,
        {
          template_name: template.name,
          language: template.language || 'pt_BR',
          numero: selectedCliente.phone,
          cliente_id: selectedCliente.id,
          meta_param_id: metaParamId,
          contact_name: selectedCliente.name,
        },
        headerAsset
          ? { uri: headerAsset.uri, name: headerAsset.name, type: headerAsset.mimeType || 'application/octet-stream' }
          : undefined
      );
      Alert.alert('Enviado', message || `Template enviado para ${selectedCliente.name}.`);
      handleClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o template.');
    } finally {
      setSendingIndividual(false);
    }
  }

  async function handleStartLote() {
    if (!template || !metaParamId || !selectedLista) return;

    try {
      const contatos = await getContatosLista(user, selectedLista.id);
      const items = contatos
        .filter((contato) => !!contato.telefone)
        .map((contato) => ({
          cliente_id: contato.cliente_id,
          numero: contato.telefone!,
          contato_nome: contato.nome,
          email: contato.email || undefined,
        }));

      if (items.length === 0) {
        Alert.alert('Atenção', 'Nenhum contato com telefone nesta lista.');
        return;
      }

      await start(
        {
          template_name: template.name,
          language: template.language || 'pt_BR',
          meta_param_id: metaParamId,
          items,
          lista_id: selectedLista.id,
        },
        headerAsset
          ? { uri: headerAsset.uri, name: headerAsset.name, type: headerAsset.mimeType || 'application/octet-stream' }
          : undefined
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível iniciar o disparo em lote.');
    }
  }

  if (!template) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              Template: {template.name}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.stepsRow}>
            <View style={[styles.stepPill, step === 'preview' && styles.stepPillActive]}>
              <View style={[styles.stepBadge, step === 'preview' && styles.stepBadgeActive]}>
                <Text style={[styles.stepBadgeText, step === 'preview' && styles.stepBadgeTextActive]}>1</Text>
              </View>
              <View>
                <Text style={styles.stepTitle}>Preview</Text>
                <Text style={styles.stepSub}>Configure e valide</Text>
              </View>
            </View>
            <View style={[styles.stepPill, step === 'disparo' && styles.stepPillActive]}>
              <View style={[styles.stepBadge, step === 'disparo' && styles.stepBadgeActive]}>
                <Text style={[styles.stepBadgeText, step === 'disparo' && styles.stepBadgeTextActive]}>2</Text>
              </View>
              <View>
                <Text style={styles.stepTitle}>Disparo</Text>
                <Text style={styles.stepSub}>Individual ou lote</Text>
              </View>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {step === 'preview' ? (
              <>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Header: </Text>
                    {template.components?.header
                      ? `${template.components.header.type}${headerFormat ? ' - mídia obrigatória' : ''}`
                      : 'Nenhum'}
                  </Text>
                  <Text style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Body: </Text>
                    {template.components?.body?.parameter_indexes?.length
                      ? `${template.components.body.parameter_indexes.length} variável(is)`
                      : 'Sem variáveis'}
                  </Text>
                  <Text style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Botões: </Text>
                    {template.components?.buttons?.length
                      ? `${template.components.buttons.length}`
                      : 'Nenhum'}
                  </Text>
                </View>

                <Text style={styles.label}>Idioma do disparo</Text>
                <View style={styles.readonlyBox}>
                  <Text style={styles.readonlyText}>{template.language}</Text>
                </View>

                {!!headerFormat && (
                  <>
                    <Text style={styles.label}>Arquivo para header de mídia</Text>
                    <Pressable style={styles.attachButton} onPress={() => pickHeaderMedia(headerFormat)}>
                      <Ionicons name="attach-outline" size={16} color={colors.accent} />
                      <Text style={styles.attachText} numberOfLines={1}>
                        {headerAsset?.name || `Selecionar ${headerFormat.toLowerCase()}`}
                      </Text>
                    </Pressable>
                    <Text style={styles.helperText}>
                      Envie imagem, vídeo ou documento quando o template exigir header de mídia.
                    </Text>
                  </>
                )}

                <Pressable
                  style={[styles.primaryButton, !!headerFormat && !headerAsset && styles.primaryButtonDisabled]}
                  onPress={handleNext}
                  disabled={!!headerFormat && !headerAsset}
                >
                  <Text style={styles.primaryButtonText}>Próximo</Text>
                </Pressable>
              </>
            ) : progress ? (
              <View style={styles.progressBox}>
                <Text style={styles.progressStatus}>{STATUS_LABEL[progress.status] || progress.status}</Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progress.progress_percent}%` }]} />
                </View>
                <Text style={styles.progressCounts}>
                  {progress.processed_items}/{progress.total_items} processados • {progress.success_count} enviados •{' '}
                  {progress.error_count} erros
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.modeToggleRow}>
                  <Pressable
                    style={[styles.modeToggle, mode === 'individual' && styles.modeToggleActive]}
                    onPress={() => setMode('individual')}
                  >
                    <Text style={[styles.modeToggleText, mode === 'individual' && styles.modeToggleTextActive]}>
                      Disparo unitário
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modeToggle, mode === 'lote' && styles.modeToggleActive]}
                    onPress={() => setMode('lote')}
                  >
                    <Text style={[styles.modeToggleText, mode === 'lote' && styles.modeToggleTextActive]}>
                      Disparo em lote
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.sectionTitle}>Preview do disparo</Text>
                <View style={styles.previewCard}>
                  <View style={styles.previewHeaderBar}>
                    <Text style={styles.previewHeaderBarText}>Conversa no WhatsApp</Text>
                    <Text style={styles.previewHeaderBarLang}>{template.language}</Text>
                  </View>
                  <View style={styles.previewBody}>
                    {!!headerFormat && (
                      <View style={styles.previewBubble}>
                        <Text style={styles.previewBubbleTitle}>Header com {headerFormat.toLowerCase()}</Text>
                        <Text style={styles.previewBubbleText}>
                          {headerAsset
                            ? `Arquivo selecionado: ${headerAsset.name}`
                            : `Selecione um${headerFormat === 'IMAGE' ? 'a imagem' : headerFormat === 'VIDEO' ? ' vídeo' : ' documento'} para visualizar o header.`}
                        </Text>
                      </View>
                    )}
                    {!!template.components?.body?.text && (
                      <Text style={styles.previewBodyText}>{template.components.body.text}</Text>
                    )}
                  </View>
                </View>

                {mode === 'individual' ? (
                  <>
                    <Text style={styles.sectionTitle}>Disparo unitário</Text>
                    <Text style={styles.sectionDesc}>
                      Selecione um cliente cadastrado e o sistema usa o telefone salvo nesse cadastro.
                    </Text>
                    <Text style={styles.label}>Cliente destino</Text>
                    <View style={styles.searchBox}>
                      <Ionicons name="search-outline" size={16} color={colors.muted} />
                      <TextInput
                        style={styles.searchInput}
                        value={clienteSearch}
                        onChangeText={setClienteSearch}
                        placeholder="Busque por nome, telefone ou email"
                        placeholderTextColor={colors.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    {loadingClientes ? (
                      <ActivityIndicator color={colors.muted} style={styles.loading} />
                    ) : clienteResults.length === 0 ? (
                      <Text style={styles.empty}>Nenhum contato encontrado.</Text>
                    ) : (
                      clienteResults.map((cliente) => {
                        const active = selectedCliente?.id === cliente.id;
                        return (
                          <Pressable
                            key={cliente.id}
                            onPress={() => setSelectedCliente(cliente)}
                            style={[styles.optionCard, active && styles.optionCardActive]}
                          >
                            <View style={[styles.radio, active && styles.radioActive]}>
                              {active && <View style={styles.radioDot} />}
                            </View>
                            <View style={styles.optionInfo}>
                              <Text style={styles.optionTitle}>{cliente.name}</Text>
                              <Text style={styles.optionSub}>{cliente.phone || 'sem telefone'}</Text>
                            </View>
                          </Pressable>
                        );
                      })
                    )}

                    <Pressable
                      style={[
                        styles.primaryButton,
                        (!selectedCliente || sendingIndividual) && styles.primaryButtonDisabled,
                      ]}
                      onPress={handleSendIndividual}
                      disabled={!selectedCliente || sendingIndividual}
                    >
                      {sendingIndividual ? (
                        <ActivityIndicator color={colors.background} />
                      ) : (
                        <Text style={styles.primaryButtonText}>Disparar template</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>Disparo em lote</Text>
                    <Text style={styles.sectionDesc}>
                      Selecione uma lista de transmissão para disparar aos contatos vinculados a ela.
                    </Text>
                    <Text style={styles.label}>Lista destino</Text>

                    {loadingListas ? (
                      <ActivityIndicator color={colors.muted} style={styles.loading} />
                    ) : listas.length === 0 ? (
                      <Text style={styles.empty}>Nenhuma lista de transmissão neste número.</Text>
                    ) : (
                      listas.map((lista) => {
                        const active = selectedLista?.id === lista.id;
                        return (
                          <Pressable
                            key={lista.id}
                            onPress={() => setSelectedLista(lista)}
                            style={[styles.optionCard, active && styles.optionCardActive]}
                          >
                            <View style={[styles.radio, active && styles.radioActive]}>
                              {active && <View style={styles.radioDot} />}
                            </View>
                            <View style={styles.optionInfo}>
                              <Text style={styles.optionTitle}>{lista.nome}</Text>
                              <Text style={styles.optionSub}>{lista.total_contatos} contato(s)</Text>
                            </View>
                          </Pressable>
                        );
                      })
                    )}

                    <Pressable
                      style={[styles.primaryButton, (!selectedLista || starting) && styles.primaryButtonDisabled]}
                      onPress={handleStartLote}
                      disabled={!selectedLista || starting}
                    >
                      {starting ? (
                        <ActivityIndicator color={colors.background} />
                      ) : (
                        <Text style={styles.primaryButtonText}>Disparar template</Text>
                      )}
                    </Pressable>
                  </>
                )}
              </>
            )}
          </ScrollView>
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
      gap: 12,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 17,
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
    stepsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
      marginBottom: 12,
    },
    stepPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
    },
    stepPillActive: {
      borderColor: colors.accent,
    },
    stepBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeActive: {
      backgroundColor: colors.accent,
    },
    stepBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    stepBadgeTextActive: {
      color: '#141414',
    },
    stepTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    stepSub: {
      fontSize: 10,
      color: colors.muted,
    },
    body: {
      gap: 10,
      paddingBottom: 8,
    },
    summaryBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      gap: 6,
    },
    summaryLine: {
      fontSize: 13,
      color: '#D0D0D0',
    },
    summaryLabel: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    readonlyBox: {
      height: 44,
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    readonlyText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    attachButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    attachText: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    helperText: {
      fontSize: 11,
      color: colors.muted,
    },
    primaryButton: {
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    modeToggleRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modeToggle: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeToggleActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    modeToggleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
    },
    modeToggleTextActive: {
      color: '#141414',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 8,
    },
    sectionDesc: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 17,
    },
    previewCard: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeaderBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#0E4D45',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    previewHeaderBarText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    previewHeaderBarLang: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
    },
    previewBody: {
      backgroundColor: '#EDEAE3',
      padding: 14,
      gap: 8,
    },
    previewBubble: {
      backgroundColor: '#D9F2CE',
      borderRadius: 10,
      padding: 10,
      alignSelf: 'flex-end',
      maxWidth: '85%',
    },
    previewBubbleTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1A1A1A',
    },
    previewBubbleText: {
      fontSize: 12,
      color: '#3A3A3A',
      marginTop: 2,
    },
    previewBodyText: {
      fontSize: 13,
      color: '#5A5A5A',
    },
    searchBox: {
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
    loading: {
      paddingVertical: 24,
    },
    empty: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 24,
    },
    optionCard: {
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
    optionCardActive: {
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
    optionInfo: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    optionSub: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    progressBox: {
      gap: 10,
      paddingVertical: 12,
    },
    progressStatus: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    progressBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    progressCounts: {
      fontSize: 12,
      color: colors.muted,
    },
  });
