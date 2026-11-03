import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { getPromptIA, salvarPromptIA } from '@/services/iaApi';
import { canManageIA } from '@/services/permissions';
import { useAuth } from '@/store/authStore';

const PROMPT_MAX_LENGTH = 12000;

export default function IAScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const allowed = !!user && canManageIA(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getPromptIA(user);
      setPrompt(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o prompt da IA.');
    }
  }, [user, allowed]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function handleAtualizar() {
    setDraft(prompt);
    setEditing(true);
  }

  function handleCancelar() {
    setEditing(false);
  }

  async function handleSalvar() {
    if (!user) return;
    setSaving(true);
    try {
      const saved = await salvarPromptIA(user, draft);
      setPrompt(saved);
      setEditing(false);
      Alert.alert('Sucesso', 'Prompt da IA salvo com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o prompt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Prompt da IA</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para configurar a IA.</Text>
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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>
            Defina as instruções da IA para análise de atendimento e assistente de conversão.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Prompt personalizado</Text>
            {editing ? (
              <>
                <TextInput
                  style={styles.textarea}
                  value={draft}
                  onChangeText={(value) => setDraft(value.slice(0, PROMPT_MAX_LENGTH))}
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="top"
                  placeholderTextColor={colors.muted}
                  autoFocus
                />
                <Text style={styles.counter}>
                  {draft.length}/{PROMPT_MAX_LENGTH}
                </Text>
              </>
            ) : (
              <View style={styles.textareaFixed}>
                <Text style={styles.textareaFixedText}>{prompt}</Text>
              </View>
            )}
          </View>

          {editing ? (
            <>
              <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSalvar} disabled={saving}>
                {saving ? <ActivityIndicator color="#141414" /> : <Text style={styles.saveButtonText}>Salvar prompt</Text>}
              </Pressable>

              <Pressable style={styles.reloadButton} onPress={handleCancelar} disabled={saving}>
                <Text style={styles.reloadButtonText}>Cancelar</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.reloadButton} onPress={handleAtualizar}>
              <Text style={styles.reloadButtonText}>Editar prompt</Text>
            </Pressable>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Formato fixo: </Text>
              O formato de retorno da IA permanece padrão do sistema e não é editável nesta tela.
            </Text>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    flex: {
      flex: 1,
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
      paddingBottom: 32,
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
    description: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
    },
    field: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    textarea: {
      minHeight: 260,
      borderRadius: 14,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: '#000000',
      fontSize: 14,
      lineHeight: 20,
    },
    textareaFixed: {
      minHeight: 260,
      borderRadius: 14,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textareaFixedText: {
      color: '#000000',
      fontSize: 14,
      lineHeight: 20,
    },
    counter: {
      alignSelf: 'flex-end',
      fontSize: 11,
      color: colors.muted,
    },
    saveButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    reloadButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reloadButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    infoBox: {
      backgroundColor: 'rgba(61,107,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(61,107,255,0.35)',
      borderRadius: 14,
      padding: 14,
    },
    infoText: {
      fontSize: 12,
      color: '#C7D3FF',
      lineHeight: 18,
    },
    infoBold: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
