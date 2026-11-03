import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { criarTemplate, TemplateComponent, TemplateMediaSampleType } from '@/services/metaApi';
import type { User } from '@/types';

interface CreateTemplateSheetProps {
  visible: boolean;
  user: User;
  metaParamId: number | null;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'UTILITY', label: 'Utilitário' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
];

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'pt_BR', label: 'Português (BR)' },
  { value: 'en_US', label: 'Inglês (EUA)' },
  { value: 'es_ES', label: 'Espanhol' },
];

type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

const HEADER_TYPES: { value: HeaderType; label: string }[] = [
  { value: 'NONE', label: 'Sem cabeçalho' },
  { value: 'TEXT', label: 'Texto' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'VIDEO', label: 'Vídeo' },
  { value: 'DOCUMENT', label: 'Documento (PDF)' },
];

function sanitizeTemplateName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '_');
}

export function CreateTemplateSheet({
  visible,
  user,
  metaParamId,
  onClose,
  onCreated,
}: CreateTemplateSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('pt_BR');
  const [headerType, setHeaderType] = useState<HeaderType>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerAsset, setHeaderAsset] = useState<{ uri: string; name: string; mimeType?: string } | null>(
    null
  );
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName('');
    setCategory('UTILITY');
    setLanguage('pt_BR');
    setHeaderType('NONE');
    setHeaderText('');
    setHeaderAsset(null);
    setBodyText('');
    setFooterText('');
  }

  function handleClose() {
    if (submitting) return;
    resetForm();
    onClose();
  }

  async function handlePickHeaderMedia() {
    if (headerType === 'DOCUMENT') {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.length) return;
      const asset = resultado.assets[0];
      setHeaderAsset({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined });
      return;
    }

    if (headerType === 'IMAGE' || headerType === 'VIDEO') {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: headerType === 'VIDEO' ? ['videos'] : ['images'],
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
  }

  async function handleSubmit() {
    const sanitizedName = sanitizeTemplateName(name.trim());
    if (!sanitizedName) {
      Alert.alert('Atenção', 'Informe o nome do template.');
      return;
    }
    if (!bodyText.trim()) {
      Alert.alert('Atenção', 'Informe o texto do corpo do template.');
      return;
    }
    if (headerType === 'TEXT' && !headerText.trim()) {
      Alert.alert('Atenção', 'Informe o texto do cabeçalho ou selecione "Sem cabeçalho".');
      return;
    }
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && !headerAsset) {
      Alert.alert('Atenção', 'Anexe o arquivo de amostra do cabeçalho.');
      return;
    }
    if (!metaParamId) {
      Alert.alert('Atenção', 'Selecione um número WhatsApp antes de criar o template.');
      return;
    }

    const components: TemplateComponent[] = [];
    if (headerType === 'TEXT') {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText.trim() });
    }
    components.push({ type: 'BODY', text: bodyText.trim() });
    if (footerText.trim()) {
      components.push({ type: 'FOOTER', text: footerText.trim() });
    }

    const mediaSampleType: TemplateMediaSampleType =
      headerType === 'IMAGE' || headerType === 'VIDEO' || headerType === 'DOCUMENT'
        ? headerType
        : 'NONE';

    setSubmitting(true);
    try {
      const { message } = await criarTemplate(
        user,
        metaParamId,
        {
          name: sanitizedName,
          category,
          language,
          components,
          media_sample_type: mediaSampleType,
        },
        headerAsset
          ? { uri: headerAsset.uri, name: headerAsset.name, type: headerAsset.mimeType || 'application/octet-stream' }
          : undefined
      );
      Alert.alert('Sucesso', message || 'Template criado com sucesso.');
      resetForm();
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível criar o template.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Novo Template</Text>
              <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <View style={styles.field}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(value) => setName(sanitizeTemplateName(value))}
                  placeholder="nome_do_template"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Categoria</Text>
                <View style={styles.chipsRow}>
                  {CATEGORIES.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setCategory(option.value)}
                      style={[styles.chip, category === option.value && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, category === option.value && styles.chipTextActive]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Idioma</Text>
                <View style={styles.chipsRow}>
                  {LANGUAGES.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setLanguage(option.value)}
                      style={[styles.chip, language === option.value && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, language === option.value && styles.chipTextActive]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Cabeçalho</Text>
                <View style={styles.chipsRow}>
                  {HEADER_TYPES.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setHeaderType(option.value);
                        setHeaderText('');
                        setHeaderAsset(null);
                      }}
                      style={[styles.chip, headerType === option.value && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, headerType === option.value && styles.chipTextActive]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {headerType === 'TEXT' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Texto do cabeçalho</Text>
                  <TextInput
                    style={styles.input}
                    value={headerText}
                    onChangeText={setHeaderText}
                    placeholder="Texto do cabeçalho"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              )}

              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                <View style={styles.field}>
                  <Text style={styles.label}>Arquivo de amostra</Text>
                  <Pressable style={styles.attachButton} onPress={handlePickHeaderMedia}>
                    <Ionicons name="attach-outline" size={16} color={colors.accent} />
                    <Text style={styles.attachText} numberOfLines={1}>
                      {headerAsset?.name || `Selecionar ${headerType.toLowerCase()}`}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Corpo</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={bodyText}
                  onChangeText={setBodyText}
                  placeholder="Texto do corpo da mensagem"
                  placeholderTextColor={colors.muted}
                  multiline
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Rodapé (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={footerText}
                  onChangeText={setFooterText}
                  placeholder="Texto do rodapé"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                style={[styles.submitButton, submitting && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#141414" />
                ) : (
                  <Text style={styles.submitText}>Criar Template</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  multilineInput: {
    height: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  chipTextActive: {
    color: '#141414',
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
  submitButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
