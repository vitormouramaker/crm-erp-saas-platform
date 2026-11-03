import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';

import { AppDrawer } from '@/components/AppDrawer';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SupportContacts } from '@/components/SupportContacts';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { router } from 'expo-router';

import { purgeStoredCredentials } from '@/services/authApi';
import {
  alterarMinhaSenha,
  excluirMinhaConta,
  getMeuPerfil,
  removerMinhaFotoPerfil,
  salvarMeuPerfil,
  uploadMinhaFotoPerfil,
} from '@/services/perfilApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

function getPerfilAcessoLabel(user: User): string {
  if (user.cargo) return String(user.cargo);
  return user.is_master ? 'Administrador' : 'Colaborador';
}

export default function PerfilScreen() {
  const { user, token, setSession, logout, pushEnabled, togglePushNotifications } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  const [senhaModalVisible, setSenhaModalVisible] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

  const [excluirModalVisible, setExcluirModalVisible] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const perfil = await getMeuPerfil(user);
      setNome(perfil.name || '');
      setEmail(perfil.email || '');
      setTelefone(perfil.telefone || '');
      setFotoUrl(perfil.foto_perfil_url || null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar seu perfil.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  if (!user) return null;
  const currentUser = user;

  function applyUpdatedSession(updated: User) {
    if (token) setSession(token, updated);
    setNome(updated.name || updated.nome || '');
    setEmail(updated.email || '');
    setTelefone(updated.telefone || '');
    setFotoUrl(updated.foto_perfil_url || null);
  }

  function handleCancelEdit() {
    setEditing(false);
    load();
  }

  async function handleSaveInfo() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }
    setSavingInfo(true);
    try {
      const updated = await salvarMeuPerfil(currentUser, { name: nome.trim(), email: email.trim(), telefone });
      applyUpdatedSession(updated);
      setEditing(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o perfil.');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handlePickFoto() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];

    setUploadingFoto(true);
    try {
      const updated = await uploadMinhaFotoPerfil(currentUser, {
        uri: asset.uri,
        name: asset.fileName || `perfil_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      applyUpdatedSession(updated);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a foto.');
    } finally {
      setUploadingFoto(false);
    }
  }

  function handleRemoverFoto() {
    Alert.alert('Remover foto', 'Deseja remover sua foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setUploadingFoto(true);
          try {
            const updated = await removerMinhaFotoPerfil(currentUser);
            applyUpdatedSession(updated);
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover a foto.');
          } finally {
            setUploadingFoto(false);
          }
        },
      },
    ]);
  }

  async function handleTogglePush() {
    setTogglingPush(true);
    try {
      const ok = await togglePushNotifications();
      if (!ok) {
        Alert.alert(
          'Permissão necessária',
          'Ative as notificações do Órbita nas configurações do aparelho para receber alertas de atendimento.'
        );
      }
    } finally {
      setTogglingPush(false);
    }
  }

  function handleCloseSenhaModal() {
    setSenhaModalVisible(false);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
  }

  function handleCloseExcluirModal() {
    if (excluindo) return;
    setExcluirModalVisible(false);
    setSenhaExclusao('');
  }

  function handleConfirmarExclusao() {
    if (!senhaExclusao) {
      Alert.alert('Atenção', 'Informe sua senha para confirmar.');
      return;
    }
    Alert.alert(
      'Excluir conta',
      'Esta ação é permanente e não pode ser desfeita. Deseja realmente excluir sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setExcluindo(true);
            try {
              await excluirMinhaConta(currentUser, senhaExclusao);
              await purgeStoredCredentials();
              await logout();
              setExcluirModalVisible(false);
              router.replace('/(auth)/login');
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível excluir a conta.');
            } finally {
              setExcluindo(false);
            }
          },
        },
      ]
    );
  }

  async function handleSalvarSenha() {
    if (!senhaAtual || !novaSenha) {
      Alert.alert('Atenção', 'Preencha a senha atual e a nova senha.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      Alert.alert('Atenção', 'A confirmação deve ser igual à nova senha.');
      return;
    }
    setSavingSenha(true);
    try {
      const updated = await alterarMinhaSenha(currentUser, senhaAtual, novaSenha);
      applyUpdatedSession(updated);
      handleCloseSenhaModal();
      Alert.alert('Sucesso', 'Senha atualizada com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível atualizar a senha.');
    } finally {
      setSavingSenha(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Perfil" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/perfil" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              {fotoUrl ? (
                <Image source={{ uri: fotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={28} color={colors.muted} />
                </View>
              )}
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryName}>{nome || '-'}</Text>
                <Text style={styles.summaryCargo}>{getPerfilAcessoLabel(user)}</Text>
                <Text style={styles.summaryEmail}>{email}</Text>
              </View>
            </View>

            <View style={styles.fotoActionsRow}>
              <Pressable style={styles.outlineButton} onPress={handlePickFoto} disabled={uploadingFoto}>
                {uploadingFoto ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.outlineButtonText}>Alterar foto</Text>
                  </>
                )}
              </Pressable>
              {fotoUrl && (
                <Pressable style={styles.dangerLinkButton} onPress={handleRemoverFoto} disabled={uploadingFoto}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={styles.dangerLinkText}>Remover</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Informações pessoais</Text>
            </View>

            {editing ? (
              <>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Seu nome"
                  placeholderTextColor={colors.muted}
                />

                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />

                <View style={styles.editActionsRow}>
                  <Pressable style={styles.secondaryButton} onPress={handleCancelEdit} disabled={savingInfo}>
                    <Text style={styles.secondaryButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={handleSaveInfo} disabled={savingInfo}>
                    {savingInfo ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Salvar</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
                  <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </Pressable>

                <Text style={styles.label}>Nome</Text>
                <Text style={styles.value}>{nome || '-'}</Text>

                <Text style={styles.label}>E-mail</Text>
                <Text style={styles.value}>{email || '-'}</Text>

                <Text style={styles.label}>Telefone</Text>
                <Text style={styles.value}>{telefone || 'Não informado'}</Text>

                <Text style={styles.label}>Perfil de acesso</Text>
                <Text style={styles.value}>{getPerfilAcessoLabel(user)}</Text>

                <Text style={styles.label}>Plano</Text>
                <Text style={styles.value}>{user.nome_plano || '-'}</Text>

                <Text style={styles.label}>Empresa</Text>
                <Text style={styles.value}>{user.empresa || 'Não informado'}</Text>
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Notificações</Text>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                disabled={togglingPush}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.helperText}>
              Receba um alerta no aparelho quando chegar uma nova mensagem de atendimento.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Segurança</Text>
            <Pressable style={styles.outlineButtonFull} onPress={() => setSenhaModalVisible(true)}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineButtonText}>Alterar senha</Text>
            </Pressable>
            <Text style={styles.helperText}>Proteja sua conta utilizando uma senha segura.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Suporte</Text>
            <SupportContacts />
            <Pressable style={styles.outlineButtonFull} onPress={() => router.push('/planos')}>
              <Ionicons name="headset-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineButtonText}>Enviar mensagem ao suporte</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <Pressable style={styles.outlineButtonFull} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
              <Ionicons name="document-text-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineButtonText}>Termos de Uso</Text>
            </Pressable>
            <Pressable style={styles.outlineButtonFull} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.outlineButtonText}>Política de Privacidade</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Excluir conta</Text>
            <Pressable style={styles.dangerButtonFull} onPress={() => setExcluirModalVisible(true)}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={styles.dangerLinkText}>Excluir minha conta</Text>
            </Pressable>
            <Text style={styles.helperText}>
              Seu acesso e seus dados pessoais serão removidos de forma permanente.
            </Text>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={excluirModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseExcluirModal}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseExcluirModal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Excluir conta</Text>
              <Pressable onPress={handleCloseExcluirModal} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.helperText}>
              Ao excluir, você perde o acesso ao Órbita e seus dados pessoais (nome, e-mail, telefone e
              foto) são apagados. Essa ação não pode ser desfeita.
            </Text>

            <Text style={styles.label}>Confirme sua senha</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={senhaExclusao}
                onChangeText={setSenhaExclusao}
                placeholder="Digite sua senha"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.dangerFilledButton, excluindo && styles.saveDisabled]}
              onPress={handleConfirmarExclusao}
              disabled={excluindo}
            >
              {excluindo ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.dangerFilledText}>Excluir minha conta</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={senhaModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseSenhaModal}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSenhaModal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Alterar senha</Text>
              <Pressable onPress={handleCloseSenhaModal} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.label}>Senha atual</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={senhaAtual}
                onChangeText={setSenhaAtual}
                placeholder="Digite a senha atual"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.label}>Nova senha</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={novaSenha}
                onChangeText={setNovaSenha}
                placeholder="Digite a nova senha"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.label}>Confirmar nova senha</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.helperText}>
              Mínimo de 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.
            </Text>

            <Pressable
              style={[styles.primaryButtonFull, savingSenha && styles.saveDisabled]}
              onPress={handleSalvarSenha}
              disabled={savingSenha}
            >
              {savingSenha ? (
                <ActivityIndicator color="#141414" />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar nova senha</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 16,
    },
    card: {
      borderRadius: 16,
      padding: 16,
      gap: 10,
      ...cardSurface(colors, scheme),
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.elevated,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryInfo: {
      flex: 1,
      gap: 2,
    },
    summaryName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    summaryCargo: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    summaryEmail: {
      fontSize: 12,
      color: colors.muted,
    },
    fotoActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    outlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    outlineButtonFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    outlineButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dangerButtonFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#ef4444',
    },
    dangerFilledButton: {
      height: 50,
      borderRadius: 14,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    dangerFilledText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    dangerLinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 44,
    },
    dangerLinkText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ef4444',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    editActionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    secondaryButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
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
    primaryButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonFull: {
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    saveDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    value: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    input: {
      height: 48,
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
    },
    passwordWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordInput: {
      flex: 1,
      height: '100%',
      paddingHorizontal: 14,
      color: colors.textPrimary,
      fontSize: 14,
    },
    eyeButton: {
      paddingHorizontal: 12,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    helperText: {
      fontSize: 11,
      color: colors.muted,
    },
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
      gap: 6,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
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
  });
