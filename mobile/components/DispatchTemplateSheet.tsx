import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { getContatosLista, type ListaTransmissao } from '@/services/clientesApi';
import { useBatchDispatch } from '@/hooks/useBatchDispatch';
import { useHeaderMediaPicker } from '@/hooks/useHeaderMediaPicker';
import {
  getTemplateHeaderFormat,
  getTemplates,
  MetaTemplate,
  templateHasVariables,
} from '@/services/metaApi';
import type { User } from '@/types';

interface DispatchTemplateSheetProps {
  visible: boolean;
  user: User;
  lista: ListaTransmissao | null;
  onClose: () => void;
}

export function DispatchTemplateSheet({ visible, user, lista, onClose }: DispatchTemplateSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selected, setSelected] = useState<MetaTemplate | null>(null);
  const { asset: headerAsset, pick: pickHeaderMedia, reset: resetHeaderAsset } = useHeaderMediaPicker();
  const { starting, progress, start, reset: resetBatch } = useBatchDispatch(user);

  useEffect(() => {
    if (!visible || !lista?.empresa_meta_param_id) return;
    setSelected(null);
    resetHeaderAsset();
    resetBatch();
    setLoadingTemplates(true);
    setTemplatesError('');
    getTemplates(user, lista.empresa_meta_param_id)
      .then((data) =>
        setTemplates(data.filter((template) => String(template.status || '').toUpperCase() === 'APPROVED'))
      )
      .catch((err: any) => {
        setTemplates([]);
        setTemplatesError(err?.message || 'Não foi possível carregar os templates.');
      })
      .finally(() => setLoadingTemplates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lista, user]);

  const selectedHasVariables = useMemo(
    () => (selected ? templateHasVariables(selected) : false),
    [selected]
  );

  const selectedHeaderFormat = useMemo(
    () => (selected ? getTemplateHeaderFormat(selected) : null),
    [selected]
  );

  useEffect(() => {
    resetHeaderAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function handleStartDispatch() {
    if (!lista?.empresa_meta_param_id || !selected) return;
    if (selectedHeaderFormat && !headerAsset) {
      Alert.alert('Atenção', 'Este template exige um arquivo de mídia no cabeçalho. Anexe antes de disparar.');
      return;
    }

    try {
      const contatos = await getContatosLista(user, lista.id);
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
          template_name: selected.name,
          language: selected.language || 'pt_BR',
          meta_param_id: lista.empresa_meta_param_id,
          items,
          lista_id: lista.id,
        },
        headerAsset
          ? { uri: headerAsset.uri, name: headerAsset.name, type: headerAsset.mimeType || 'application/octet-stream' }
          : undefined
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível iniciar o disparo em lote.');
    }
  }

  function handleClose() {
    resetBatch();
    onClose();
  }

  const statusLabel: Record<string, string> = {
    processing: 'Enviando...',
    completed: 'Concluído',
    stopped_on_error: 'Interrompido por erro',
    failed: 'Falhou',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Disparar Template</Text>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          {!!lista && (
            <Text style={styles.subtitle}>
              {lista.nome} • {lista.total_contatos} contato(s)
            </Text>
          )}

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {!lista?.empresa_meta_param_id ? (
              <Text style={styles.empty}>Esta lista não tem um número WhatsApp vinculado.</Text>
            ) : progress ? (
              <View style={styles.progressBox}>
                <Text style={styles.progressStatus}>
                  {statusLabel[progress.status] || progress.status}
                </Text>
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
                <Text style={styles.label}>Template</Text>
                {loadingTemplates ? (
                  <ActivityIndicator color={colors.muted} style={styles.loading} />
                ) : templatesError ? (
                  <Text style={styles.empty}>{templatesError}</Text>
                ) : templates.length === 0 ? (
                  <Text style={styles.empty}>Nenhum template aprovado neste número.</Text>
                ) : (
                  templates.map((template) => {
                    const active = selected?.name === template.name && selected?.language === template.language;
                    return (
                      <Pressable
                        key={`${template.name}-${template.language}`}
                        onPress={() => setSelected(template)}
                        style={[styles.optionCard, active && styles.optionCardActive]}
                      >
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active && <View style={styles.radioDot} />}
                        </View>
                        <View style={styles.optionInfo}>
                          <Text style={styles.optionTitle}>{template.name}</Text>
                          <Text style={styles.optionSub}>
                            {template.language}
                            {template.category ? ` • ${template.category}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}

                {selectedHasVariables && (
                  <View style={styles.warnBox}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.accent} />
                    <Text style={styles.warnText}>
                      Este template possui variáveis ou mídia. O sistema tentará preenchê-las
                      automaticamente; se a estrutura exigir dados manuais, o envio será recusado.
                    </Text>
                  </View>
                )}

                {!!selectedHeaderFormat && (
                  <>
                    <Text style={styles.label}>Mídia do cabeçalho</Text>
                    <Pressable
                      style={styles.attachButton}
                      onPress={() => selectedHeaderFormat && pickHeaderMedia(selectedHeaderFormat)}
                    >
                      <Ionicons name="attach-outline" size={16} color={colors.accent} />
                      <Text style={styles.attachText} numberOfLines={1}>
                        {headerAsset?.name || `Selecionar ${selectedHeaderFormat.toLowerCase()}`}
                      </Text>
                    </Pressable>
                  </>
                )}

                <Pressable
                  style={[
                    styles.sendButton,
                    (!selected || starting || (!!selectedHeaderFormat && !headerAsset)) && styles.sendDisabled,
                  ]}
                  onPress={handleStartDispatch}
                  disabled={!selected || starting || (!!selectedHeaderFormat && !headerAsset)}
                >
                  {starting ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={15} color="#141414" />
                      <Text style={styles.sendText}>Iniciar Disparo em Lote</Text>
                    </>
                  )}
                </Pressable>
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
    maxHeight: '85%',
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
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  body: {
    gap: 10,
    paddingBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: 6,
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
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(197,210,0,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  warnText: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
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
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
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
