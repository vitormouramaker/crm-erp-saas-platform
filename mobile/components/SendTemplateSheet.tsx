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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import type { Cliente } from '@/services/clientesApi';
import {
  dispararTemplate,
  getTemplateHeaderFormat,
  getTemplates,
  MetaTemplate,
  templateHasVariables,
} from '@/services/metaApi';
import { AllowedMetaNumber, getMetaNumeros } from '@/services/usersApi';
import type { User } from '@/types';

interface SendTemplateSheetProps {
  visible: boolean;
  authUser: User;
  cliente: Cliente | null;
  onClose: () => void;
}

export function SendTemplateSheet({ visible, authUser, cliente, onClose }: SendTemplateSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [numeros, setNumeros] = useState<AllowedMetaNumber[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingNumeros, setLoadingNumeros] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selected, setSelected] = useState<MetaTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [headerAsset, setHeaderAsset] = useState<{ uri: string; name: string; mimeType?: string } | null>(
    null
  );

  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setTemplates([]);
    setTemplatesError('');
    setLoadingNumeros(true);
    getMetaNumeros(authUser)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length === 1 ? data[0].id : null);
      })
      .catch(() => setNumeros([]))
      .finally(() => setLoadingNumeros(false));
  }, [visible, authUser]);

  useEffect(() => {
    if (!visible || !metaParamId) return;
    setLoadingTemplates(true);
    setTemplatesError('');
    setSelected(null);
    getTemplates(authUser, metaParamId)
      .then((data) =>
        setTemplates(data.filter((template) => String(template.status || '').toUpperCase() === 'APPROVED'))
      )
      .catch((err: any) => {
        setTemplates([]);
        setTemplatesError(err?.message || 'Não foi possível carregar os templates.');
      })
      .finally(() => setLoadingTemplates(false));
  }, [visible, metaParamId, authUser]);

  const selectedHasVariables = useMemo(
    () => (selected ? templateHasVariables(selected) : false),
    [selected]
  );

  const selectedHeaderFormat = useMemo(
    () => (selected ? getTemplateHeaderFormat(selected) : null),
    [selected]
  );

  useEffect(() => {
    setHeaderAsset(null);
  }, [selected]);

  async function handlePickHeaderMedia() {
    if (!selectedHeaderFormat) return;

    if (selectedHeaderFormat === 'DOCUMENT') {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.length) return;
      const asset = resultado.assets[0];
      setHeaderAsset({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined });
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: selectedHeaderFormat === 'VIDEO' ? ['videos'] : ['images'],
      quality: 0.8,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    setHeaderAsset({
      uri: asset.uri,
      name: asset.fileName || `midia_${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`,
      mimeType: asset.mimeType,
    });
  }

  async function handleSend() {
    if (!cliente || !metaParamId || !selected) return;
    if (!cliente.phone) {
      Alert.alert('Atenção', 'Este contato não possui telefone cadastrado.');
      return;
    }
    if (selectedHeaderFormat && !headerAsset) {
      Alert.alert('Atenção', 'Este template exige um arquivo de mídia no cabeçalho. Anexe antes de enviar.');
      return;
    }

    setSending(true);
    try {
      const message = await dispararTemplate(
        authUser,
        {
          template_name: selected.name,
          language: selected.language || 'pt_BR',
          numero: cliente.phone,
          cliente_id: cliente.id,
          meta_param_id: metaParamId,
          contact_name: cliente.name,
        },
        headerAsset
          ? { uri: headerAsset.uri, name: headerAsset.name, type: headerAsset.mimeType || 'application/octet-stream' }
          : undefined
      );
      Alert.alert('Enviado', message || `Template enviado para ${cliente.name}.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o template.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Enviar Template</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          {!!cliente && (
            <Text style={styles.subtitle}>
              {cliente.name} • {cliente.phone || 'sem telefone'}
            </Text>
          )}

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {loadingNumeros ? (
              <ActivityIndicator color={colors.muted} style={styles.loading} />
            ) : numeros.length === 0 ? (
              <Text style={styles.empty}>Nenhum número WhatsApp disponível para envio.</Text>
            ) : (
              <>
                {numeros.length > 1 && (
                  <>
                    <Text style={styles.label}>Enviar pelo número</Text>
                    {numeros.map((numero) => {
                      const active = numero.id === metaParamId;
                      return (
                        <Pressable
                          key={numero.id}
                          onPress={() => setMetaParamId(numero.id)}
                          style={[styles.optionCard, active && styles.optionCardActive]}
                        >
                          <View style={[styles.radio, active && styles.radioActive]}>
                            {active && <View style={styles.radioDot} />}
                          </View>
                          <View style={styles.optionInfo}>
                            <Text style={styles.optionTitle}>
                              {numero.display_phone_number || `#${numero.id}`}
                            </Text>
                            {(numero.verified_name || numero.whatsapp_account_name) && (
                              <Text style={styles.optionSub}>
                                {numero.verified_name || numero.whatsapp_account_name}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}

                {!!metaParamId && (
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
                  </>
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
                    <Pressable style={styles.attachButton} onPress={handlePickHeaderMedia}>
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
                    (!selected || sending || (!!selectedHeaderFormat && !headerAsset)) && styles.sendDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!selected || sending || (!!selectedHeaderFormat && !headerAsset)}
                >
                  {sending ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane-outline" size={15} color="#141414" />
                      <Text style={styles.sendText}>Enviar Template</Text>
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
});
