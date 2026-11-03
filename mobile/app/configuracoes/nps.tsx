import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { canManageNPS } from '@/services/permissions';
import { criarPerguntaNps, deletarPerguntaNps, editarPerguntaNps, getPerguntasNps, NpsPergunta } from '@/services/npsApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

export default function NpsScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [perguntas, setPerguntas] = useState<NpsPergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [pergunta, setPergunta] = useState('');
  const [ordem, setOrdem] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const allowed = !!user && canManageNPS(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const data = await getPerguntasNps(user);
      setPerguntas(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as perguntas de NPS.');
    }
  }, [user, allowed]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setOrdem((prev) => (editingId ? prev : String(perguntas.length + 1)));
  }, [perguntas.length]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function resetForm() {
    setEditingId(null);
    setPergunta('');
    setOrdem(String(perguntas.length + 1));
  }

  function openEdit(item: NpsPergunta) {
    setEditingId(item.id);
    setPergunta(item.pergunta);
    setOrdem(String(item.ordem));
  }

  function confirmDelete(item: NpsPergunta) {
    if (!user) return;
    Alert.alert('Remover pergunta', `Tem certeza que deseja remover "${item.pergunta}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletarPerguntaNps(user, item.id);
            if (editingId === item.id) resetForm();
            await load();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover a pergunta.');
          }
        },
      },
    ]);
  }

  async function handleSubmit() {
    if (!user) return;
    const perguntaValue = pergunta.trim();
    if (!perguntaValue) return Alert.alert('Atenção', 'Informe a pergunta do NPS.');
    const ordemValue = Number(ordem);
    if (!Number.isInteger(ordemValue) || ordemValue <= 0) {
      return Alert.alert('Atenção', 'Informe uma ordem válida.');
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await editarPerguntaNps(user, editingId, perguntaValue, ordemValue);
      } else {
        await criarPerguntaNps(user, perguntaValue, ordemValue);
      }
      resetForm();
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a pergunta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Perguntas de NPS</Text>
      </View>

      {!allowed ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Você não tem permissão para gerenciar o NPS.</Text>
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <Text style={styles.description}>
            Cadastre as perguntas de NPS que serão exibidas na avaliação de atendimento.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>{editingId ? 'Editar pergunta' : 'Nova pergunta'}</Text>
            <View style={styles.formRow}>
              <TextInput
                style={[styles.input, styles.inputPergunta]}
                value={pergunta}
                onChangeText={setPergunta}
                placeholder="Ex.: De 1 a 10, como você avalia seu atendimento?"
                placeholderTextColor={colors.muted}
                multiline
              />
              <View style={styles.ordemField}>
                <Text style={styles.ordemLabel}>Ordem</Text>
                <TextInput
                  style={styles.input}
                  value={ordem}
                  onChangeText={setOrdem}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <View style={styles.formActions}>
              <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#141414" />
                ) : (
                  <Text style={styles.primaryButtonText}>{editingId ? 'Salvar edição' : 'Adicionar pergunta'}</Text>
                )}
              </Pressable>
              {editingId ? (
                <Pressable style={styles.secondaryButton} onPress={resetForm} disabled={submitting}>
                  <Text style={styles.secondaryButtonText}>Cancelar edição</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryButton} onPress={handleRefresh} disabled={submitting}>
                  <Text style={styles.secondaryButtonText}>Atualizar lista</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.list}>
            {perguntas.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.ordemBadge}>
                    <Text style={styles.ordemBadgeText}>{item.ordem}</Text>
                  </View>
                  <Text style={styles.cardPergunta}>{item.pergunta}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={6}>
                    <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => confirmDelete(item)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={16} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            ))}

            {perguntas.length === 0 && (
              <View style={styles.centered}>
                <Text style={styles.subtitle}>Nenhuma pergunta cadastrada ainda.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
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
      paddingBottom: 24,
      gap: 18,
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
    formCard: {
      borderRadius: 16,
      padding: 14,
      gap: 12,
      ...cardSurface(colors, scheme),
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    formRow: {
      gap: 12,
    },
    input: {
      minHeight: 46,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
    },
    inputPergunta: {
      textAlignVertical: 'top',
    },
    ordemField: {
      gap: 6,
      width: 100,
    },
    ordemLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    secondaryButton: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    list: {
      gap: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: 14,
      padding: 14,
      ...cardSurface(colors, scheme),
    },
    cardTop: {
      flex: 1,
      flexDirection: 'row',
      gap: 10,
    },
    ordemBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(197,210,0,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ordemBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
    },
    cardPergunta: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
